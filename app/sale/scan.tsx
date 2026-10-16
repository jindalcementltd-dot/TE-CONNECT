import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  TextInput, ActivityIndicator, Platform, Alert, Image, Modal,
} from 'react-native';
import { router } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Toast from 'react-native-toast-message';
import { Colors } from '../../src/theme/colors';
import { Spacing, BorderRadius } from '../../src/theme/spacing';
import { Typography, FontFamily, FontSize } from '../../src/theme/typography';
import { apiGetDealers, apiCreateBatchSales } from '../../src/services/api';
import { getUser } from '../../src/services/auth';
import {
  pickImageFromCamera, pickImageFromGallery,
  callCloudVisionApi, parseVisionSalesSheet,
} from '../../src/services/visionOcr';
import { currentDateISO } from '../../src/utils/helpers';
import { User, Dealer, ScannedDealerSale, BatchSaleItem } from '../../src/types';
import { Ionicons, MaterialCommunityIcons, Feather } from '@expo/vector-icons';

export default function ScanSalesScreen() {
  const queryClient = useQueryClient();
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  // Scan state
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [scanError, setScanError] = useState<string | null>(null);

  // Scanned dealers list
  const [scannedDealers, setScannedDealers] = useState<ScannedDealerSale[]>([]);
  const [saleDate, setSaleDate] = useState<string>(currentDateISO());
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);
  const [pendingItemsToSave, setPendingItemsToSave] = useState<BatchSaleItem[]>([]);

  useEffect(() => {
    getUser().then(setCurrentUser);
  }, []);

  const { data: dealers } = useQuery({ queryKey: ['dealers'], queryFn: () => apiGetDealers() });

  // Handle picking image from Camera or Gallery
  const handlePick = async (source: 'camera' | 'gallery') => {
    setScanError(null);
    try {
      const result = source === 'camera'
        ? await pickImageFromCamera()
        : await pickImageFromGallery();

      if (!result) return;

      setImageUri(result.uri);
      if (result.base64) {
        runVisionOcr(result.base64);
      } else {
        Toast.show({
          type: 'error',
          text1: 'Image Error',
          text2: 'Could not encode image for OCR.',
        });
      }
    } catch (err: any) {
      Toast.show({
        type: 'error',
        text1: 'Picker Error',
        text2: err.message || 'Failed to select image.',
      });
    }
  };

  // Run Cloud Vision OCR & Parse
  const runVisionOcr = async (base64Data: string) => {
    setIsScanning(true);
    setScanError(null);
    try {
      const visionResponse = await callCloudVisionApi(base64Data);
      const parsed = parseVisionSalesSheet(visionResponse, dealers || []);

      if (!parsed.success || parsed.dealers.length === 0) {
        setScanError(parsed.error || 'No dealer sales could be extracted. Please check the image.');
        Toast.show({
          type: 'error',
          text1: 'Scan Failed',
          text2: parsed.error || 'Please make sure dealer codes & sales columns are visible.',
        });
      } else {
        setScannedDealers(parsed.dealers);
        const activeCount = parsed.dealers.filter(d => d.total_bags > 0).length;
        Toast.show({
          type: 'success',
          text1: 'AI Scan Successful! ✅',
          text2: `Detected ${parsed.dealers.length} counters (${activeCount} with active sales).`,
        });
      }
    } catch (err: any) {
      setScanError(err.message || 'Vision API call failed.');
      Toast.show({
        type: 'error',
        text1: 'OCR Error',
        text2: err.message || 'Failed to analyze image.',
      });
    } finally {
      setIsScanning(false);
    }
  };

  // Selection toggles
  const toggleSelect = (index: number) => {
    setScannedDealers(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], selected: !copy[index].selected };
      return copy;
    });
  };

  const toggleSelectAll = () => {
    const allSelected = scannedDealers.every(d => d.selected);
    setScannedDealers(prev => prev.map(d => ({ ...d, selected: !allSelected })));
  };

  // Quantity updates (Input in MT, automatically converts to Bags = MT * 20)
  const updateQuantity = (index: number, product: 'f2r' | 'gold' | 'hpc', text: string) => {
    const valMT = parseInt(text.replace(/[^0-9]/g, ''), 10) || 0;
    setScannedDealers(prev => {
      const copy = [...prev];
      const cur = { ...copy[index] };
      if (product === 'f2r') {
        cur.f2r_mt = valMT;
        cur.f2r_bags = valMT * 20;
      }
      if (product === 'gold') {
        cur.gold_mt = valMT;
        cur.gold_bags = valMT * 20;
      }
      if (product === 'hpc') {
        cur.hpc_mt = valMT;
        cur.hpc_bags = valMT * 20;
      }
      cur.total_mt = cur.f2r_mt + cur.gold_mt + cur.hpc_mt;
      cur.total_bags = cur.total_mt * 20;
      copy[index] = cur;
      return copy;
    });
  };

  const updateDealerName = (index: number, name: string) => {
    setScannedDealers(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], dealer_name: name };
      return copy;
    });
  };

  // Filtered dealers by search term
  const filteredDealersWithIndex = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return scannedDealers
      .map((d, index) => ({ dealer: d, originalIndex: index }))
      .filter(({ dealer }) => {
        if (!q) return true;
        return (
          (dealer.dealer_name || '').toLowerCase().includes(q) ||
          String(dealer.sap_code || '').toLowerCase().includes(q)
        );
      });
  }, [scannedDealers, searchQuery]);

  // Aggregate stats of selected items in both MT and Bags
  const selectedStats = useMemo(() => {
    const selected = scannedDealers.filter(d => d.selected && d.total_mt > 0);
    const totalMT = selected.reduce((sum, d) => sum + d.total_mt, 0);
    const totalF2RMT = selected.reduce((sum, d) => sum + d.f2r_mt, 0);
    const totalGoldMT = selected.reduce((sum, d) => sum + d.gold_mt, 0);
    const totalHpcMT = selected.reduce((sum, d) => sum + d.hpc_mt, 0);
    const totalBags = totalMT * 20;
    const totalF2R = totalF2RMT * 20;
    const totalGold = totalGoldMT * 20;
    const totalHpc = totalHpcMT * 20;
    return {
      count: selected.length,
      totalMT,
      totalF2RMT,
      totalGoldMT,
      totalHpcMT,
      totalBags,
      totalF2R,
      totalGold,
      totalHpc,
    };
  }, [scannedDealers]);

  // Batch Save Mutation
  const batchMutation = useMutation({
    mutationFn: (items: BatchSaleItem[]) =>
      apiCreateBatchSales({ sales: items, created_by: currentUser?.name || 'OCR_USER' }),
    onSuccess: (res) => {
      if (res && res.success) {
        queryClient.invalidateQueries({ queryKey: ['sales'] });
        queryClient.invalidateQueries({ queryKey: ['dealers'] });
        queryClient.invalidateQueries({ queryKey: ['todaySummary'] });
        queryClient.invalidateQueries({ queryKey: ['dealerSalesSummary'] });
        queryClient.invalidateQueries({ queryKey: ['activeTrackers'] });

        Toast.show({
          type: 'success',
          text1: 'Sales Saved to Sheet! 🎉',
          text2: `${selectedStats.count} dealer counters recorded (${selectedStats.totalBags.toLocaleString()} bags / ${selectedStats.totalMT} MT).`,
          position: 'top',
        });

        if (Platform.OS === 'web') {
          window.alert(`✅ Sales Saved to Sheet!\n\n${selectedStats.count} dealer counters recorded (${selectedStats.totalBags.toLocaleString()} bags / ${selectedStats.totalMT} MT).`);
          router.back();
        } else {
          Alert.alert(
            'Sales Saved to Sheet! 🎉',
            `${selectedStats.count} dealer counters recorded (${selectedStats.totalBags.toLocaleString()} bags / ${selectedStats.totalMT} MT) in Google Sheet.`,
            [{ text: 'OK', onPress: () => router.back() }]
          );
        }
      } else {
        const errMsg = res?.message || 'Could not write to Google Sheet.';
        if (Platform.OS === 'web') {
          window.alert(`Save Failed: ${errMsg}`);
        } else {
          Alert.alert('Save Failed', errMsg);
        }
      }
    },
    onError: (err: any) => {
      const errMsg = err?.message || 'Failed to submit batch sales.';
      if (Platform.OS === 'web') {
        window.alert(`Network Error: ${errMsg}`);
      } else {
        Alert.alert('Network Error', errMsg);
      }
    },
  });

  const handleSaveToSheet = () => {
    const selected = scannedDealers.filter(d => d.selected && d.total_bags > 0);
    if (selected.length === 0) {
      if (Platform.OS === 'web') {
        window.alert('Please select at least 1 counter with sales greater than 0.');
      } else {
        Alert.alert('No Dealers Selected', 'Please select at least 1 counter with sales greater than 0.');
      }
      return;
    }

    const itemsToSave: BatchSaleItem[] = [];

    selected.forEach(d => {
      // ACC F2R
      if (d.f2r_bags > 0) {
        itemsToSave.push({
          sale_date: saleDate,
          dealer_id: d.matched_dealer_id,
          dealer_name: d.dealer_name,
          sap_code: d.sap_code,
          product: 'ACC F2R',
          quantity_bags: d.f2r_bags,
          assigned_te: currentUser?.name || '',
          remark: `OCR MTD Scan (SAP: ${d.sap_code})`,
        });
      }
      // ACC GOLD
      if (d.gold_bags > 0) {
        itemsToSave.push({
          sale_date: saleDate,
          dealer_id: d.matched_dealer_id,
          dealer_name: d.dealer_name,
          sap_code: d.sap_code,
          product: 'ACC GOLD',
          quantity_bags: d.gold_bags,
          assigned_te: currentUser?.name || '',
          remark: `OCR MTD Scan (SAP: ${d.sap_code})`,
        });
      }
      // ACC HPC
      if (d.hpc_bags > 0) {
        itemsToSave.push({
          sale_date: saleDate,
          dealer_id: d.matched_dealer_id,
          dealer_name: d.dealer_name,
          sap_code: d.sap_code,
          product: 'ACC HPC',
          quantity_bags: d.hpc_bags,
          assigned_te: currentUser?.name || '',
          remark: `OCR MTD Scan (SAP: ${d.sap_code})`,
        });
      }
      // Fallback if individual bags are 0 but total > 0
      if (d.f2r_bags === 0 && d.gold_bags === 0 && d.hpc_bags === 0 && d.total_bags > 0) {
        itemsToSave.push({
          sale_date: saleDate,
          dealer_id: d.matched_dealer_id,
          dealer_name: d.dealer_name,
          sap_code: d.sap_code,
          product: 'ACC F2R',
          quantity_bags: d.total_bags,
          assigned_te: currentUser?.name || '',
          remark: `OCR MTD Scan (SAP: ${d.sap_code})`,
        });
      }
    });

    setPendingItemsToSave(itemsToSave);
    setShowConfirmModal(true);
  };

  return (
    <View style={styles.container}>
      {/* ── HEADER ── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
          <Ionicons name="close" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={styles.headerTitle}>AI Sales Sheet Scanner</Text>
          <Text style={styles.headerSub}>Google Cloud Vision AI · Auto SAP & Product Extraction</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* ── 1. SCANNER HERO / UPLOAD CARD ── */}
        <View style={styles.uploadHeroCard}>
          <View style={styles.aiBadgeRow}>
            <View style={styles.aiBadge}>
              <MaterialCommunityIcons name="robot-confused-outline" size={14} color="#FFFFFF" />
              <Text style={styles.aiBadgeText}>CLOUD VISION AI OCR</Text>
            </View>
            {imageUri ? (
              <TouchableOpacity
                style={styles.retakePill}
                onPress={() => handlePick('camera')}
                activeOpacity={0.8}
              >
                <Ionicons name="camera-reverse-outline" size={13} color="#FFFFFF" />
                <Text style={styles.retakePillText}>Retake Photo</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          <Text style={styles.uploadTitle}>Photograph Excel Screen / Challan</Text>
          <Text style={styles.uploadSub}>
            Take a clear photo of the MIS Excel screen. AI will automatically read Dealer Codes (SAP), Names, HPC, F2R and GOLD bags.
          </Text>

          {/* Action Buttons: Camera & Gallery */}
          <View style={styles.actionButtonsRow}>
            <TouchableOpacity
              style={styles.actionBtnCamera}
              onPress={() => handlePick('camera')}
              disabled={isScanning}
              activeOpacity={0.85}
            >
              <Ionicons name="camera" size={20} color="#800E20" />
              <Text style={styles.actionBtnCameraText}>Take Photo</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionBtnGallery}
              onPress={() => handlePick('gallery')}
              disabled={isScanning}
              activeOpacity={0.85}
            >
              <Ionicons name="image" size={20} color="#FFFFFF" />
              <Text style={styles.actionBtnGalleryText}>Choose from Gallery</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── 2. SCANNING LOADER ── */}
        {isScanning && (
          <View style={styles.scanningCard}>
            <ActivityIndicator size="large" color="#800E20" />
            <Text style={styles.scanningTitle}>Scanning with Google Cloud Vision AI...</Text>
            <Text style={styles.scanningSub}>
              Detecting dealer rows, matching SAP codes and aligning MTD sale columns...
            </Text>
          </View>
        )}

        {/* ── SCAN ERROR BANNER ── */}
        {scanError && !isScanning && (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle" size={20} color="#DC2626" />
            <View style={{ flex: 1 }}>
              <Text style={styles.errorTitle}>Scan Incomplete</Text>
              <Text style={styles.errorSub}>{scanError}</Text>
            </View>
          </View>
        )}

        {/* ── 3. RESULTS & REVIEW SECTION ── */}
        {scannedDealers.length > 0 && !isScanning && (
          <View style={styles.resultsContainer}>
            {/* Summary Statistics Card */}
            <View style={styles.summaryCard}>
              <View style={styles.summaryTopRow}>
                <View>
                  <Text style={styles.summaryHeading}>Extracted Sales Summary</Text>
                  <Text style={styles.summarySub}>
                    {selectedStats.count} of {scannedDealers.length} counters selected
                  </Text>
                </View>
                <View style={styles.totalVolumeBadge}>
                  <Text style={styles.totalVolumeMT}>{selectedStats.totalMT} <Text style={{ fontSize: 11 }}>MT</Text></Text>
                  <Text style={styles.totalVolumeBags}>({selectedStats.totalBags.toLocaleString()} Bags)</Text>
                </View>
              </View>

              {/* 3 Product Split Pills */}
              <View style={styles.productSplitPillsRow}>
                <View style={styles.productSplitPillRed}>
                  <View style={[styles.miniDot, { backgroundColor: '#EF4444' }]} />
                  <Text style={styles.productSplitPillText}>F2R: {selectedStats.totalF2RMT} MT ({selectedStats.totalF2R.toLocaleString()} Bags)</Text>
                </View>
                <View style={styles.productSplitPillGold}>
                  <View style={[styles.miniDot, { backgroundColor: '#F59E0B' }]} />
                  <Text style={styles.productSplitPillText}>Gold: {selectedStats.totalGoldMT} MT ({selectedStats.totalGold.toLocaleString()} Bags)</Text>
                </View>
                <View style={styles.productSplitPillBlue}>
                  <View style={[styles.miniDot, { backgroundColor: '#3B82F6' }]} />
                  <Text style={styles.productSplitPillText}>HPC: {selectedStats.totalHpcMT} MT ({selectedStats.totalHpc.toLocaleString()} Bags)</Text>
                </View>
              </View>
            </View>

            {/* Sale Date Input */}
            <View style={styles.datePickerCard}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="calendar-outline" size={16} color="#800E20" />
                <Text style={styles.datePickerLabel}>Sale Date for Google Sheet:</Text>
              </View>
              <TextInput
                style={styles.dateInput}
                value={saleDate}
                onChangeText={setSaleDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#A0858C"
              />
            </View>

            {/* Search & Select All Strip */}
            <View style={styles.searchAndToggleRow}>
              <View style={styles.searchBox}>
                <Ionicons name="search" size={16} color="#8A7277" />
                <TextInput
                  style={styles.searchInput}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder="Filter by name or SAP code..."
                  placeholderTextColor="#A0858C"
                />
                {searchQuery ? (
                  <TouchableOpacity onPress={() => setSearchQuery('')}>
                    <Ionicons name="close-circle" size={16} color="#8A7277" />
                  </TouchableOpacity>
                ) : null}
              </View>

              <TouchableOpacity
                style={styles.toggleAllBtn}
                onPress={toggleSelectAll}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={scannedDealers.every(d => d.selected) ? 'checkmark-circle' : 'remove-circle-outline'}
                  size={16}
                  color="#800E20"
                />
                <Text style={styles.toggleAllBtnText}>
                  {scannedDealers.every(d => d.selected) ? 'Deselect All' : 'Select All'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Dealer Cards List */}
            {filteredDealersWithIndex.map(({ dealer, originalIndex }) => {
              const hasSales = dealer.total_bags > 0;
              const isMatched = !!dealer.matched_dealer_id;

              return (
                <View
                  key={dealer.sap_code + '_' + originalIndex}
                  style={[
                    styles.scannedDealerCard,
                    dealer.selected && hasSales && styles.scannedDealerCardSelected,
                    !hasSales && styles.scannedDealerCardZero,
                  ]}
                >
                  {/* Top: Checkbox, SAP Code, Match Status */}
                  <View style={styles.dealerCardTop}>
                    <TouchableOpacity
                      style={styles.checkboxTouch}
                      onPress={() => toggleSelect(originalIndex)}
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name={dealer.selected ? 'checkbox' : 'square-outline'}
                        size={22}
                        color={dealer.selected ? '#800E20' : '#A0858C'}
                      />
                    </TouchableOpacity>

                    <View style={styles.sapCodePill}>
                      <Text style={styles.sapCodePillLabel}>SAP</Text>
                      <Text style={styles.sapCodePillVal}>{dealer.sap_code}</Text>
                    </View>

                    <View style={{ flex: 1 }} />

                    {isMatched ? (
                      <View style={styles.matchedBadge}>
                        <Ionicons name="checkmark-circle" size={12} color="#15803D" />
                        <Text style={styles.matchedBadgeText}>Linked in App</Text>
                      </View>
                    ) : (
                      <View style={styles.newCounterBadge}>
                        <Ionicons name="sparkles" size={11} color="#D97706" />
                        <Text style={styles.newCounterBadgeText}>New Counter</Text>
                      </View>
                    )}
                  </View>

                  {/* Dealer Name (Editable) */}
                  <View style={styles.nameRow}>
                    <TextInput
                      style={styles.dealerNameInput}
                      value={dealer.dealer_name}
                      onChangeText={(t) => updateDealerName(originalIndex, t)}
                      placeholder="Dealer Counter Name"
                      placeholderTextColor="#A0858C"
                    />
                  </View>

                  {/* 3 Product Quantities (F2R, Gold, HPC) + Total */}
                  <View style={styles.productsInputRow}>
                    {/* ACC F2R */}
                    <View style={styles.productInputCol}>
                      <Text style={[styles.productInputLabel, { color: '#B91C1C' }]}>F2R (MT)</Text>
                      <TextInput
                        style={[styles.productNumInput, styles.productNumInputF2R]}
                        value={dealer.f2r_mt > 0 ? String(dealer.f2r_mt) : ''}
                        onChangeText={(t) => updateQuantity(originalIndex, 'f2r', t)}
                        keyboardType="numeric"
                        placeholder="0"
                      />
                      <Text style={styles.productSubBagsText}>{dealer.f2r_bags.toLocaleString()} Bags</Text>
                    </View>

                    {/* ACC GOLD */}
                    <View style={styles.productInputCol}>
                      <Text style={[styles.productInputLabel, { color: '#B45309' }]}>GOLD / K (MT)</Text>
                      <TextInput
                        style={[styles.productNumInput, styles.productNumInputGold]}
                        value={dealer.gold_mt > 0 ? String(dealer.gold_mt) : ''}
                        onChangeText={(t) => updateQuantity(originalIndex, 'gold', t)}
                        keyboardType="numeric"
                        placeholder="0"
                      />
                      <Text style={styles.productSubBagsText}>{dealer.gold_bags.toLocaleString()} Bags</Text>
                    </View>

                    {/* ACC HPC */}
                    <View style={styles.productInputCol}>
                      <Text style={[styles.productInputLabel, { color: '#1D4ED8' }]}>HPC (MT)</Text>
                      <TextInput
                        style={[styles.productNumInput, styles.productNumInputHpc]}
                        value={dealer.hpc_mt > 0 ? String(dealer.hpc_mt) : ''}
                        onChangeText={(t) => updateQuantity(originalIndex, 'hpc', t)}
                        keyboardType="numeric"
                        placeholder="0"
                      />
                      <Text style={styles.productSubBagsText}>{dealer.hpc_bags.toLocaleString()} Bags</Text>
                    </View>

                    {/* Total MT / Bags Capsule */}
                    <View style={styles.dealerTotalCapsule}>
                      <Text style={styles.dealerTotalCapsuleLabel}>TOTAL MTD</Text>
                      <Text style={styles.dealerTotalCapsuleVal}>
                        {dealer.total_mt} <Text style={{ fontSize: 10 }}>MT</Text>
                      </Text>
                      <Text style={styles.dealerTotalCapsuleMT}>
                        {dealer.total_bags.toLocaleString()} Bags
                      </Text>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        <View style={{ height: 110 }} />
      </ScrollView>

      {/* ── 4. STICKY BOTTOM SAVE ACTION BAR ── */}
      {scannedDealers.length > 0 && !isScanning && (
        <View style={styles.stickyFooterBar}>
          <View style={styles.footerStatsCol}>
            <Text style={styles.footerCountersText}>
              <Text style={{ fontWeight: '800', color: '#1F0B10' }}>{selectedStats.count}</Text> Counters Selected
            </Text>
            <Text style={styles.footerBagsText}>
              {selectedStats.totalBags.toLocaleString()} Bags ({selectedStats.totalMT} MT)
            </Text>
          </View>

          <TouchableOpacity
            style={[
              styles.saveAllBtn,
              (batchMutation.isPending || selectedStats.count === 0) && styles.saveAllBtnDisabled,
            ]}
            onPress={handleSaveToSheet}
            disabled={batchMutation.isPending || selectedStats.count === 0}
            activeOpacity={0.85}
          >
            {batchMutation.isPending ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="cloud-upload" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.saveAllBtnText}>Save All to Sheet</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* ── 5. CONFIRMATION MODAL ── */}
      <Modal visible={showConfirmModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.confirmModalCard}>
            <View style={styles.confirmModalHeader}>
              <Ionicons name="cloud-upload" size={24} color="#800E20" />
              <Text style={styles.confirmModalTitle}>Confirm Sheet Upload</Text>
            </View>

            <View style={styles.confirmModalBody}>
              <View style={styles.confirmModalRow}>
                <Text style={styles.confirmModalLabel}>Total Counters:</Text>
                <Text style={styles.confirmModalVal}>{selectedStats.count} Selected</Text>
              </View>
              <View style={styles.confirmModalRow}>
                <Text style={styles.confirmModalLabel}>Total Volume:</Text>
                <Text style={styles.confirmModalVal}>
                  {selectedStats.totalMT} MT ({selectedStats.totalBags.toLocaleString()} Bags)
                </Text>
              </View>
              <View style={styles.confirmModalRow}>
                <Text style={styles.confirmModalLabel}>Sale Date:</Text>
                <Text style={styles.confirmModalVal}>{saleDate}</Text>
              </View>
              <View style={styles.confirmModalRow}>
                <Text style={styles.confirmModalLabel}>Product Entries:</Text>
                <Text style={styles.confirmModalVal}>{pendingItemsToSave.length} rows to write</Text>
              </View>
            </View>

            <View style={styles.confirmModalActions}>
              <TouchableOpacity
                style={styles.confirmCancelBtn}
                onPress={() => setShowConfirmModal(false)}
                activeOpacity={0.8}
              >
                <Text style={styles.confirmCancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.confirmUploadBtn}
                onPress={() => {
                  setShowConfirmModal(false);
                  batchMutation.mutate(pendingItemsToSave);
                }}
                activeOpacity={0.85}
              >
                <Text style={styles.confirmUploadBtnText}>Upload Now 🚀</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── 6. SAVING PROGRESS OVERLAY ── */}
      <Modal visible={batchMutation.isPending} transparent animationType="fade">
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingCard}>
            <ActivityIndicator size="large" color="#800E20" />
            <Text style={styles.loadingTitle}>Writing to Google Sheet...</Text>
            <Text style={styles.loadingSub}>
              Recording {pendingItemsToSave.length} sales entries for {selectedStats.count} counters. Please wait...
            </Text>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9F5F6',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 56 : 38,
    paddingBottom: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F0E2E5',
  },
  closeBtn: {
    width: 40,
    alignItems: 'flex-start',
  },
  headerTitle: {
    fontFamily: FontFamily.displayBlack,
    fontSize: 18,
    fontWeight: '900',
    color: '#1F0B10',
    letterSpacing: -0.3,
  },
  headerSub: {
    fontFamily: FontFamily.sansRegular,
    fontSize: 10,
    color: '#8A7277',
    marginTop: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },

  // ── 1. UPLOAD HERO CARD ──
  uploadHeroCard: {
    backgroundColor: '#4A0611',
    borderRadius: 24,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#4A0611',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  aiBadgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  aiBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  aiBadgeText: {
    fontFamily: FontFamily.sansBold,
    fontSize: 10,
    color: '#FFFFFF',
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  retakePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 10,
  },
  retakePillText: {
    fontFamily: FontFamily.sansMedium,
    fontSize: 11,
    color: '#FFFFFF',
  },
  uploadTitle: {
    fontFamily: FontFamily.displayBold,
    fontSize: 19,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: 4,
  },
  uploadSub: {
    fontFamily: FontFamily.sansRegular,
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 4,
    lineHeight: 18,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  actionBtnCamera: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 13,
    paddingHorizontal: 14,
    borderRadius: 14,
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  actionBtnCameraText: {
    fontFamily: FontFamily.sansBold,
    fontSize: 13,
    color: '#800E20',
    fontWeight: '800',
  },
  actionBtnGallery: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingVertical: 13,
    paddingHorizontal: 14,
    borderRadius: 14,
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  actionBtnGalleryText: {
    fontFamily: FontFamily.sansBold,
    fontSize: 13,
    color: '#FFFFFF',
    fontWeight: '800',
  },

  // ── 2. SCANNING LOADER ──
  scanningCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: '#EEDCE1',
  },
  scanningTitle: {
    fontFamily: FontFamily.displayBold,
    fontSize: 16,
    fontWeight: '800',
    color: '#1F0B10',
    marginTop: 12,
  },
  scanningSub: {
    fontFamily: FontFamily.sansRegular,
    fontSize: 12,
    color: '#8A7277',
    marginTop: 4,
    textAlign: 'center',
    lineHeight: 18,
  },

  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FEE2E2',
    borderWidth: 1.5,
    borderColor: '#F87171',
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
  },
  errorTitle: {
    fontFamily: FontFamily.sansBold,
    fontSize: 13,
    color: '#991B1B',
    fontWeight: '800',
  },
  errorSub: {
    fontFamily: FontFamily.sansRegular,
    fontSize: 11,
    color: '#7F1D1D',
    marginTop: 2,
  },

  // ── 3. RESULTS & REVIEW ──
  resultsContainer: {
    gap: 12,
  },
  summaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#EEDCE1',
    shadowColor: 'rgba(78, 5, 17, 0.05)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 10,
    elevation: 3,
  },
  summaryTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  summaryHeading: {
    fontFamily: FontFamily.displayBold,
    fontSize: 16,
    fontWeight: '800',
    color: '#1F0B10',
  },
  summarySub: {
    fontFamily: FontFamily.sansMedium,
    fontSize: 11,
    color: '#8A7277',
    marginTop: 2,
  },
  totalVolumeBadge: {
    alignItems: 'flex-end',
    backgroundColor: '#FAF0F2',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F8B4BD',
  },
  totalVolumeMT: {
    fontFamily: FontFamily.displayBlack,
    fontSize: 18,
    fontWeight: '900',
    color: '#800E20',
  },
  totalVolumeBags: {
    fontFamily: FontFamily.sansBold,
    fontSize: 10,
    color: '#8A7277',
  },
  productSplitPillsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  productSplitPillRed: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  productSplitPillGold: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFBEB',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  productSplitPillBlue: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  miniDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  productSplitPillText: {
    fontFamily: FontFamily.sansBold,
    fontSize: 10,
    color: '#1F0B10',
    fontWeight: '700',
  },

  datePickerCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1.5,
    borderColor: '#EEDCE1',
  },
  datePickerLabel: {
    fontFamily: FontFamily.sansBold,
    fontSize: 12,
    color: '#1F0B10',
    fontWeight: '700',
  },
  dateInput: {
    fontFamily: FontFamily.sansBold,
    fontSize: 13,
    color: '#800E20',
    padding: 0,
    minWidth: 100,
    textAlign: 'right',
  },

  searchAndToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1.5,
    borderColor: '#EEDCE1',
    gap: 6,
  },
  searchInput: {
    flex: 1,
    fontFamily: FontFamily.sansRegular,
    fontSize: 12,
    color: '#1F0B10',
    padding: 0,
  },
  toggleAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FAF0F2',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F8B4BD',
  },
  toggleAllBtnText: {
    fontFamily: FontFamily.sansBold,
    fontSize: 11,
    color: '#800E20',
    fontWeight: '700',
  },

  // ── DEALER CARD ──
  scannedDealerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1.5,
    borderColor: '#EEDCE1',
    shadowColor: 'rgba(78, 5, 17, 0.04)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 2,
  },
  scannedDealerCardSelected: {
    borderColor: '#800E20',
    backgroundColor: '#FFFDFD',
  },
  scannedDealerCardZero: {
    opacity: 0.65,
    backgroundColor: '#FAFAFA',
  },
  dealerCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  checkboxTouch: {
    padding: 2,
  },
  sapCodePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FDE8EA',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    gap: 4,
    borderWidth: 1,
    borderColor: '#F8B4BD',
  },
  sapCodePillLabel: {
    fontFamily: FontFamily.sansBold,
    fontSize: 9,
    color: '#800E20',
    fontWeight: '800',
  },
  sapCodePillVal: {
    fontFamily: FontFamily.displayBold,
    fontSize: 11,
    color: '#800E20',
    fontWeight: '800',
  },
  matchedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  matchedBadgeText: {
    fontFamily: FontFamily.sansBold,
    fontSize: 9,
    color: '#15803D',
    fontWeight: '700',
  },
  newCounterBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  newCounterBadgeText: {
    fontFamily: FontFamily.sansBold,
    fontSize: 9,
    color: '#B45309',
    fontWeight: '700',
  },
  nameRow: {
    marginBottom: 10,
  },
  dealerNameInput: {
    fontFamily: FontFamily.displayBold,
    fontSize: 14,
    fontWeight: '800',
    color: '#1F0B10',
    paddingVertical: 2,
    borderBottomWidth: 1,
    borderBottomColor: '#F0E2E5',
  },
  productsInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  productInputCol: {
    flex: 1,
  },
  productInputLabel: {
    fontFamily: FontFamily.sansBold,
    fontSize: 9,
    fontWeight: '800',
    marginBottom: 3,
  },
  productNumInput: {
    borderWidth: 1.5,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    fontSize: 13,
    fontFamily: FontFamily.sansBold,
    fontWeight: '700',
    textAlign: 'center',
  },
  productNumInputF2R: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
    color: '#991B1B',
  },
  productNumInputGold: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
    color: '#92400E',
  },
  productNumInputHpc: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
    color: '#1D4ED8',
  },
  productSubBagsText: {
    fontSize: 9,
    color: '#8A7277',
    textAlign: 'center',
    marginTop: 2,
    fontFamily: FontFamily.sansRegular,
  },
  dealerTotalCapsule: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FAF0F2',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#F8B4BD',
    minWidth: 65,
  },
  dealerTotalCapsuleLabel: {
    fontFamily: FontFamily.sansBold,
    fontSize: 8,
    color: '#8A7277',
    fontWeight: '800',
  },
  dealerTotalCapsuleVal: {
    fontFamily: FontFamily.displayBlack,
    fontSize: 13,
    fontWeight: '900',
    color: '#800E20',
  },
  dealerTotalCapsuleMT: {
    fontFamily: FontFamily.sansRegular,
    fontSize: 9,
    color: '#8A7277',
  },

  // ── 4. STICKY FOOTER ──
  stickyFooterBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1.5,
    borderTopColor: '#F0E2E5',
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 8,
  },
  footerStatsCol: {
    flex: 1,
  },
  footerCountersText: {
    fontFamily: FontFamily.sansBold,
    fontSize: 13,
    color: '#800E20',
  },
  footerBagsText: {
    fontFamily: FontFamily.sansRegular,
    fontSize: 11,
    color: '#8A7277',
    marginTop: 1,
  },
  saveAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#800E20',
    paddingVertical: 13,
    paddingHorizontal: 20,
    borderRadius: 14,
    shadowColor: '#800E20',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  saveAllBtnDisabled: {
    opacity: 0.5,
  },
  saveAllBtnText: {
    fontFamily: FontFamily.sansBold,
    fontSize: 13,
    color: '#FFFFFF',
    fontWeight: '800',
  },

  // ── MODAL STYLES ──
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(31, 11, 16, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  confirmModalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  confirmModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  confirmModalTitle: {
    fontFamily: FontFamily.displayBold,
    fontSize: 18,
    fontWeight: '800',
    color: '#1F0B10',
    flex: 1,
  },
  confirmModalBody: {
    backgroundColor: '#FAF0F2',
    borderRadius: 14,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#F8B4BD',
    gap: 10,
  },
  confirmModalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  confirmModalLabel: {
    fontFamily: FontFamily.sansMedium,
    fontSize: 13,
    color: '#8A7277',
  },
  confirmModalVal: {
    fontFamily: FontFamily.sansBold,
    fontSize: 14,
    fontWeight: '700',
    color: '#800E20',
  },
  confirmModalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  confirmCancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F6',
  },
  confirmCancelBtnText: {
    fontFamily: FontFamily.sansBold,
    fontSize: 14,
    fontWeight: '700',
    color: '#4B5563',
  },
  confirmUploadBtn: {
    flex: 1.5,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#800E20',
  },
  confirmUploadBtnText: {
    fontFamily: FontFamily.sansBold,
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  loadingOverlay: {
    flex: 1,
    backgroundColor: 'rgba(31, 11, 16, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    width: '100%',
    maxWidth: 320,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  loadingTitle: {
    fontFamily: FontFamily.displayBold,
    fontSize: 16,
    fontWeight: '800',
    color: '#1F0B10',
    marginTop: 16,
    textAlign: 'center',
  },
  loadingSub: {
    fontFamily: FontFamily.sansRegular,
    fontSize: 12,
    color: '#8A7277',
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 18,
  },
});
