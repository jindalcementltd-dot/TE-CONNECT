// ============================================================
// TE CONNECT — Google Cloud Vision AI OCR Service
// Automatically extracts Dealer SAP Code, Dealer Name, MTD Sales
// (HPC, ACC F2R, ACC GOLD [K], Total) in MT & Bags from photos
// Supports tilted photos, different Excel column layouts & challans
// ============================================================

import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { GOOGLE_CLOUD_VISION_API_KEY } from '../config/api';
import { Dealer, ScannedDealerSale, VisionScanResult } from '../types';

export interface OcrWord {
  text: string;
  cx: number;
  cy: number;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  w: number;
  h: number;
  adjustedY: number;
}

/**
 * Pick an image from device camera
 */
export async function pickImageFromCamera(): Promise<{ uri: string; base64?: string } | null> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) {
    throw new Error('Camera permission is required to photograph the sales sheet.');
  }

  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: false,
    quality: 0.85,
    base64: true,
  });

  if (result.canceled || !result.assets || result.assets.length === 0) {
    return null;
  }

  const asset = result.assets[0];
  let base64 = asset.base64;
  if (!base64 && asset.uri) {
    base64 = await FileSystem.readAsStringAsync(asset.uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
  }

  return { uri: asset.uri, base64: base64 || undefined };
}

/**
 * Pick an image from gallery / photo library
 */
export async function pickImageFromGallery(): Promise<{ uri: string; base64?: string } | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) {
    throw new Error('Gallery permission is required to select the sales sheet image.');
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: false,
    quality: 0.85,
    base64: true,
  });

  if (result.canceled || !result.assets || result.assets.length === 0) {
    return null;
  }

  const asset = result.assets[0];
  let base64 = asset.base64;
  if (!base64 && asset.uri) {
    base64 = await FileSystem.readAsStringAsync(asset.uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
  }

  return { uri: asset.uri, base64: base64 || undefined };
}

/**
 * Calls Google Cloud Vision API with DOCUMENT_TEXT_DETECTION
 */
export async function callCloudVisionApi(base64Image: string): Promise<any> {
  if (!GOOGLE_CLOUD_VISION_API_KEY) {
    throw new Error('Google Cloud Vision API Key is missing. Please check src/config/api.ts');
  }

  const url = `https://vision.googleapis.com/v1/images:annotate?key=${GOOGLE_CLOUD_VISION_API_KEY}`;

  const requestBody = {
    requests: [
      {
        image: { content: base64Image },
        features: [{ type: 'DOCUMENT_TEXT_DETECTION' }],
      },
    ],
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Cloud Vision API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  return data;
}

/**
 * Adaptive smart table parser for MTD Sales Excel sheets & slips
 * Handles camera tilt / perspective slant, column shifts & MT / Bags conversions
 */
export function parseVisionSalesSheet(
  visionResponse: any,
  existingDealers: Dealer[] = []
): VisionScanResult {
  const emptySummary = {
    total_dealers: 0,
    active_dealers: 0,
    total_mt: 0,
    total_f2r_mt: 0,
    total_gold_mt: 0,
    total_hpc_mt: 0,
    total_bags: 0,
    total_f2r: 0,
    total_gold: 0,
    total_hpc: 0,
  };

  if (!visionResponse || !visionResponse.responses || !visionResponse.responses[0]) {
    return {
      success: false,
      error: 'Invalid response received from Vision API.',
      dealers: [],
      summary: emptySummary,
    };
  }

  const annotations = visionResponse.responses[0].textAnnotations;
  if (!annotations || annotations.length <= 1) {
    return {
      success: false,
      error: 'No readable text or table detected in the uploaded image.',
      dealers: [],
      summary: emptySummary,
    };
  }

  // Pre-index known dealers for fast lookup by SAP code and Name
  const dealerBySap = new Map<string, Dealer>();
  const dealerByName = new Map<string, Dealer>();
  existingDealers.forEach(d => {
    if (d.sap_code && d.sap_code.trim()) {
      dealerBySap.set(d.sap_code.trim(), d);
    }
    if (d.dealer_name && d.dealer_name.trim()) {
      dealerByName.set(d.dealer_name.toLowerCase().trim(), d);
    }
  });

  // Convert bounding polygon vertices to center coordinates
  const words: OcrWord[] = annotations.slice(1).map((a: any): OcrWord => {
    const vs = a.boundingPoly?.vertices || [];
    const xs = vs.map((v: any) => v.x || 0);
    const ys = vs.map((v: any) => v.y || 0);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    return {
      text: (a.description || '').trim(),
      cx: (minX + maxX) / 2,
      cy: (minY + maxY) / 2,
      minX, maxX, minY, maxY,
      w: maxX - minX,
      h: maxY - minY,
      adjustedY: (minY + maxY) / 2,
    };
  });

  // 1. Calculate Tilt Angle / Deskew Slope
  let slope = 0;
  const leftHeader = words.find(w => w.text.toLowerCase().includes('dealer') && w.cx < 180);
  const rightHeader = words.find(w => ['tot', 'total', 'hpc'].includes(w.text.toLowerCase()) && w.cx > 650);

  if (leftHeader && rightHeader && Math.abs(rightHeader.cy - leftHeader.cy) < 60) {
    slope = (rightHeader.cy - leftHeader.cy) / (rightHeader.cx - leftHeader.cx);
  }

  // De-skew all words to reference X = 100
  const refX = 100;
  words.forEach(w => {
    w.adjustedY = w.cy - slope * (w.cx - refX);
  });

  // 2. Find all SAP codes (10 digit starting with 9110 or 911, or 8-10 digit numbers)
  const codeWords = words.filter(w =>
    /^9110\d{5,6}$/.test(w.text) ||
    /^911\d{7}$/.test(w.text) ||
    /^\d{10}$/.test(w.text)
  ).sort((a, b) => a.adjustedY - b.adjustedY);

  if (codeWords.length === 0) {
    return parseSingleChallan(words, existingDealers);
  }

  // 3. Find Column Header positions for MTD Sale:
  // Detects: HPC, 2R / F2R / ZRK, K / KAW / GOLD, Tot / Total
  const hpcHeader = words.find(w => w.text.toLowerCase() === 'hpc' || w.text.toLowerCase().startsWith('hpc-'));
  const f2rHeader = words.find(w =>
    ['2r', 'f2r'].includes(w.text.toLowerCase()) ||
    w.text.includes('2r-') ||
    w.text.includes('ZRK')
  );
  const totHeader = words.find(w =>
    ['total', 'tot'].includes(w.text.toLowerCase()) ||
    w.text.startsWith('Tot')
  );

  let hpcColX = hpcHeader ? hpcHeader.cx : null;
  let f2rColX = f2rHeader ? f2rHeader.cx : null;
  let totColX = totHeader ? totHeader.cx : null;

  // Fallback: If headers are cut off, detect from top summary numbers in row 3
  if (!hpcColX || !f2rColX || !totColX) {
    const topNumbers = words.filter(w => w.adjustedY < codeWords[0].adjustedY && /^\d{2,4}$/.test(w.text) && w.cx > 650)
      .sort((a, b) => a.cx - b.cx);
    if (topNumbers.length >= 3) {
      if (!hpcColX) hpcColX = topNumbers[0].cx;
      if (!f2rColX) f2rColX = topNumbers[1].cx;
      if (!totColX) totColX = topNumbers[topNumbers.length - 1].cx;
    }
  }

  // Gold Column X: Located between F2R and Total (header usually contains K / KAW / GOLD)
  const goldHeader = words.find(w =>
    ['k', 'kaw', 'gold'].includes(w.text.toLowerCase()) ||
    w.text.includes('kaw') ||
    w.text.includes('gold')
  );
  let goldColX = goldHeader
    ? goldHeader.cx
    : (f2rColX ? (f2rColX + (totColX ? (totColX - f2rColX) * 0.45 : 32)) : null);

  const parsedDealers: ScannedDealerSale[] = [];

  // 4. Mid-point Row Segmentation (prevents any row overlap or skipping)
  for (let i = 0; i < codeWords.length; i++) {
    const curCode = codeWords[i];
    const prevY = i > 0 ? codeWords[i - 1].adjustedY : curCode.adjustedY - 16;
    const nextY = i < codeWords.length - 1 ? codeWords[i + 1].adjustedY : curCode.adjustedY + 16;

    const topBound = (prevY + curCode.adjustedY) / 2;
    const bottomBound = (curCode.adjustedY + nextY) / 2;

    // All words belonging strictly to this row slice
    const rowWords = words.filter(w => w.adjustedY >= topBound && w.adjustedY < bottomBound)
      .sort((a, b) => a.cx - b.cx);

    const sapCode = curCode.text;

    // Dealer name: words to the right of code up to district / date
    const nameWords = rowWords.filter(w =>
      w.cx > curCode.maxX &&
      w.cx <= (curCode.cx + 200) &&
      !/^\d{2}-\d{2}-\d{4}$/.test(w.text) &&
      !['cuttack', 'ganjam', 'nayagarh', 'jajpur', 'active', 'new', 'revived'].includes(w.text.toLowerCase())
    );

    let dealerName = nameWords.map(w => w.text).join(' ')
      .replace(/M\s*\/\s*S\.?\s*/i, 'M/S. ')
      .replace(/[,;]+$/, '')
      .replace(/\s+/g, ' ')
      .trim();

    // Check if matched in database
    const matched = dealerBySap.get(sapCode) || (dealerName ? dealerByName.get(dealerName.toLowerCase()) : undefined);
    if (!dealerName && matched) {
      dealerName = matched.dealer_name;
    } else if (!dealerName) {
      dealerName = `Dealer Counter (${sapCode})`;
    }

    // Number extraction helper with OCR character normalizer
    function getValAtCol(targetX: number | null, maxDist = 20): number {
      if (!targetX) return 0;
      const candidates = rowWords.filter(w => Math.abs(w.cx - targetX) <= maxDist);
      for (const c of candidates) {
        // Vision API sometimes OCRs '0' as 'O', 'o', '°', 'c', 'с', 'D', 'Q'
        const cleaned = c.text.replace(/^[Oo°cсDQ]$/, '0');
        const num = parseInt(cleaned.replace(/[^0-9]/g, ''), 10);
        if (!isNaN(num)) return num;
      }
      return 0;
    }

    let hpcMT = getValAtCol(hpcColX, 22);
    let f2rMT = getValAtCol(f2rColX, 22);
    let goldMT = getValAtCol(goldColX, 20);
    let totalMT = getValAtCol(totColX, 25);

    // Fallback: If total has a value but individual cells were obscured (e.g. mouse cursor in Excel)
    if (totalMT > 0 && (hpcMT + f2rMT + goldMT === 0)) {
      f2rMT = totalMT;
    }

    // Recompute total if individual products are present
    if (totalMT === 0 && (hpcMT + f2rMT + goldMT > 0)) {
      totalMT = hpcMT + f2rMT + goldMT;
    }

    // Convert MT to Bags (1 MT = 20 Bags)
    const hpcBags = hpcMT * 20;
    const f2rBags = f2rMT * 20;
    const goldBags = goldMT * 20;
    const totalBags = totalMT * 20;

    parsedDealers.push({
      sap_code: sapCode,
      dealer_name: dealerName,
      matched_dealer_id: matched?.dealer_id,
      hpc_mt: hpcMT,
      f2r_mt: f2rMT,
      gold_mt: goldMT,
      total_mt: totalMT,
      hpc_bags: hpcBags,
      f2r_bags: f2rBags,
      gold_bags: goldBags,
      total_bags: totalBags,
      selected: totalMT > 0, // Pre-select all dealers with active sales
    });
  }

  const totalMT = parsedDealers.reduce((sum, d) => sum + d.total_mt, 0);
  const totalF2RMT = parsedDealers.reduce((sum, d) => sum + d.f2r_mt, 0);
  const totalGoldMT = parsedDealers.reduce((sum, d) => sum + d.gold_mt, 0);
  const totalHpcMT = parsedDealers.reduce((sum, d) => sum + d.hpc_mt, 0);

  return {
    success: true,
    dealers: parsedDealers,
    summary: {
      total_dealers: parsedDealers.length,
      active_dealers: parsedDealers.filter(d => d.total_mt > 0).length,
      total_mt: totalMT,
      total_f2r_mt: totalF2RMT,
      total_gold_mt: totalGoldMT,
      total_hpc_mt: totalHpcMT,
      total_bags: totalMT * 20,
      total_f2r: totalF2RMT * 20,
      total_gold: totalGoldMT * 20,
      total_hpc: totalHpcMT * 20,
    },
  };
}

/**
 * Fallback parser for single invoice or challan document
 */
function parseSingleChallan(words: OcrWord[], existingDealers: Dealer[]): VisionScanResult {
  const allText = words.map(w => w.text).join(' ');

  // Look for any 6-10 digit number as SAP code
  const sapMatch = allText.match(/\b(91\d{8}|\d{6,10})\b/);
  const sapCode = sapMatch ? sapMatch[1] : '';

  // Look for quantity
  const mtMatch = allText.match(/(\d+(\.\d+)?)\s*(mt|ton|tonnes)/i);
  const bagMatch = allText.match(/(\d{1,4})\s*(bags?|katta|bora|bag)/i) ||
                   allText.match(/qty[:\s]*(\d{1,4})/i);

  let totalMT = 0;
  let totalBags = 0;

  if (mtMatch) {
    totalMT = Math.round(parseFloat(mtMatch[1]));
    totalBags = totalMT * 20;
  } else if (bagMatch) {
    totalBags = parseInt(bagMatch[1], 10);
    totalMT = totalBags / 20;
  }

  // Detect product
  let f2rMT = 0;
  let goldMT = 0;
  let hpcMT = 0;

  if (/gold|kaw/i.test(allText)) {
    goldMT = totalMT;
  } else if (/hpc/i.test(allText)) {
    hpcMT = totalMT;
  } else {
    f2rMT = totalMT;
  }

  // Find dealer match
  let dealerName = 'Counter Sale';
  let matchedId: string | undefined;

  for (const d of existingDealers) {
    if (sapCode && d.sap_code === sapCode) {
      dealerName = d.dealer_name;
      matchedId = d.dealer_id;
      break;
    }
    if (d.dealer_name && allText.toLowerCase().includes(d.dealer_name.toLowerCase())) {
      dealerName = d.dealer_name;
      matchedId = d.dealer_id;
      break;
    }
  }

  const dealer: ScannedDealerSale = {
    sap_code: sapCode,
    dealer_name: dealerName,
    matched_dealer_id: matchedId,
    hpc_mt: hpcMT,
    f2r_mt: f2rMT,
    gold_mt: goldMT,
    total_mt: totalMT,
    hpc_bags: hpcMT * 20,
    f2r_bags: f2rMT * 20,
    gold_bags: goldMT * 20,
    total_bags: totalBags,
    selected: totalMT > 0,
  };

  return {
    success: totalMT > 0 || !!sapCode,
    dealers: [dealer],
    summary: {
      total_dealers: 1,
      active_dealers: totalMT > 0 ? 1 : 0,
      total_mt: totalMT,
      total_f2r_mt: f2rMT,
      total_gold_mt: goldMT,
      total_hpc_mt: hpcMT,
      total_bags: totalBags,
      total_f2r: f2rMT * 20,
      total_gold: goldMT * 20,
      total_hpc: hpcMT * 20,
    },
  };
}
