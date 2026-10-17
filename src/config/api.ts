// TE CONNECT — API Configuration
// ============================================================
// IMPORTANT: After deploying Google Apps Script, paste your
// Web App URL below. It looks like:
// https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec
// ============================================================

export const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwD_2lt1qBbtcEiTcjbct565HUusllU1YW4b5i3fS_cEQBmBE_ZZ8WLBlPOXhs6ELum_g/exec';

// Google Cloud Vision API Key for OCR scanning of sales sheets & invoices
export const GOOGLE_CLOUD_VISION_API_KEY = 'AIzaSyCOncyHcL6NN6HgZrR2r6-Cu9B5gAzbAdU';

// Timeout for API calls (milliseconds) - 60s for batch uploads & vision OCR
export const API_TIMEOUT = 60000;

// App version
export const APP_VERSION = '1.0.0';

// Cache durations (milliseconds)
export const CACHE = {
  SHORT: 2 * 60 * 1000,    // 2 minutes
  MEDIUM: 5 * 60 * 1000,   // 5 minutes
  LONG: 30 * 60 * 1000,    // 30 minutes
};

// Generates the active live QR scan URL for any dealer
export function getDealerPublicSlabUrl(dealer: { dealer_id: string; qr_token?: string; public_slab_link?: string }): string {
  if (dealer.public_slab_link && dealer.public_slab_link.startsWith('http')) {
    return dealer.public_slab_link;
  }
  const tokenPart = dealer.qr_token ? `&token=${encodeURIComponent(dealer.qr_token)}` : '';
  return `${APPS_SCRIPT_URL}?action=page&page=slab&dealer_id=${encodeURIComponent(dealer.dealer_id)}${tokenPart}`;
}

