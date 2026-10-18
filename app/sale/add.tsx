import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  TextInput, ActivityIndicator, Platform, Modal, FlatList,
} from 'react-native';
import { router } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Toast from 'react-native-toast-message';
import { Colors } from '../../src/theme/colors';
import { Spacing, BorderRadius } from '../../src/theme/spacing';
import { Typography, FontFamily, FontSize } from '../../src/theme/typography';
import { apiGetDealers, apiCreateSale } from '../../src/services/api';
import { getUser } from '../../src/services/auth';
import { currentDateISO } from '../../src/utils/helpers';
import { User, Dealer, Product } from '../../src/types';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

export default function AddSaleScreen() {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<User | null>(null);

  const [saleDate, setSaleDate] = useState<string>(currentDateISO());
  const [selectedDealer, setSelectedDealer] = useState<Dealer | null>(null);
  const [product, setProduct] = useState<Product>('ACC F2R');
  const [quantityBags, setQuantityBags] = useState<string>('');
  const [saleRemark, setSaleRemark] = useState<string>('');
  const [showDealerPicker, setShowDealerPicker] = useState<boolean>(false);
  const [dealerSearch, setDealerSearch] = useState<string>('');

  useEffect(() => {
    getUser().then(setUser);
  }, []);

  const { data: dealers } = useQuery({ queryKey: ['dealers'], queryFn: () => apiGetDealers() });

  const saleMutation = useMutation({
    mutationFn: (data: any) => apiCreateSale(data),
    onSuccess: (res) => {
      if (res && res.success) {
        Toast.show({
          type: 'success',
          text1: 'Sale Recorded Successfully! ✅',
          text2: `${quantityBags} bags of ${product} for ${selectedDealer?.dealer_name}`,
          position: 'top',
        });
        queryClient.invalidateQueries({ queryKey: ['sales'] });
        queryClient.invalidateQueries({ queryKey: ['dealerSalesSummary'] });
        queryClient.invalidateQueries({ queryKey: ['todaySummary'] });
        router.back();
      } else {
        Toast.show({ type: 'error', text1: 'Error', text2: res?.message || 'Failed to record sale.' });
      }
    },
    onError: (err: any) => {
      Toast.show({ type: 'error', text1: 'Submission Error', text2: err.message || 'Could not save sale.' });
    },
  });

  const handleSubmit = () => {
    if (!saleDate) {
      Toast.show({ type: 'error', text1: 'Missing Date', text2: 'Please select sale date.' });
      return;
    }
    if (!selectedDealer) {
      Toast.show({ type: 'error', text1: 'Missing Dealer', text2: 'Please select a dealer.' });
      return;
    }
    const bags = Number(quantityBags);
    if (!bags || isNaN(bags) || bags <= 0) {
      Toast.show({ type: 'error', text1: 'Invalid Quantity', text2: 'Please enter valid bag count.' });
      return;
    }

    saleMutation.mutate({
      sale_date: saleDate,
      dealer_id: selectedDealer.dealer_id,
      dealer_name: selectedDealer.dealer_name,
      product,
      quantity_bags: bags,
      assigned_te: selectedDealer.assigned_te || user?.name || 'Team Jajpur',
      remark: saleRemark,
      source: 'APP',
      created_by: user?.name || '',
    });
  };

  const filteredDealers = (dealers || []).filter(d => {
    const q = dealerSearch.toLowerCase().trim();
    if (!q) return true;
    const nameMatch = (d.dealer_name || '').toLowerCase().includes(q);
    const sapMatch = (d.sap_code || '').toLowerCase().includes(q);
    const areaMatch = (d.area || '').toLowerCase().includes(q);
    return nameMatch || sapMatch || areaMatch;
  });

  const numBags = Number(quantityBags) || 0;
  const mtValue = (numBags / 20).toFixed(2);

  return (
    <View style={styles.container}>
      {/* ── HEADER ── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="close" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Add Cement Sale</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── AI OCR SCAN BANNER ── */}
        <TouchableOpacity
          style={styles.aiScanBanner}
          onPress={() => router.push('/sale/scan')}
          activeOpacity={0.85}
        >
          <View style={styles.aiScanIconBox}>
            <MaterialCommunityIcons name="camera-metering-center" size={24} color="#FFFFFF" />
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <View style={styles.aiTagRow}>
              <Text style={styles.aiTagText}>CLOUD VISION AI</Text>
              <View style={styles.autoPill}>
                <Text style={styles.autoPillText}>AUTO FILL</Text>
              </View>
            </View>
            <Text style={styles.aiScanTitle}>Scan Excel Sheet / Challan</Text>
            <Text style={styles.aiScanSub}>
              Photo se direct SAP Code, Dealer & Product bags sheet me upload karein
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#FFFFFF" />
        </TouchableOpacity>

        <View style={styles.card}>
          {/* Sale Date */}
          <View style={styles.group}>
            <Text style={styles.label}>Sale Date <Text style={styles.required}>*</Text></Text>
            <TextInput
              style={styles.input}
              value={saleDate}
              onChangeText={setSaleDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={Colors.textMuted}
            />
          </View>

          {/* Dealer / Counter */}
          <View style={styles.group}>
            <Text style={styles.label}>Dealer / Counter <Text style={styles.required}>*</Text></Text>
            <TouchableOpacity
              style={styles.pickerBtn}
              onPress={() => setShowDealerPicker(true)}
              activeOpacity={0.8}
            >
              <View style={{ flex: 1 }}>
                <Text style={selectedDealer ? styles.pickerSelected : styles.pickerPlaceholder}>
                  {selectedDealer ? selectedDealer.dealer_name : 'Select dealer / counter...'}
                </Text>
                {selectedDealer ? (
                  <Text style={styles.pickerSubtext}>
                    {selectedDealer.area || 'Jajpur'} {selectedDealer.sap_code ? `· SAP: ${selectedDealer.sap_code}` : ''}
                  </Text>
                ) : null}
              </View>
              <Ionicons name="chevron-down" size={18} color="#800E20" />
            </TouchableOpacity>
          </View>

          {/* Product Type */}
          <View style={styles.group}>
            <Text style={styles.label}>Product Type <Text style={styles.required}>*</Text></Text>
            <View style={styles.productRow}>
              {(['ACC F2R', 'ACC GOLD'] as Product[]).map(p => {
                const isSelected = product === p;
                const isF2R = p === 'ACC F2R';
                return (
                  <TouchableOpacity
                    key={p}
                    style={[
                      styles.productCard,
                      isSelected && (isF2R ? styles.productCardActiveF2R : styles.productCardActiveGold),
                    ]}
                    onPress={() => setProduct(p)}
                    activeOpacity={0.8}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <View style={[styles.productDot, { backgroundColor: isF2R ? '#EF4444' : '#F59E0B' }]} />
                      <Text style={[styles.productName, isSelected && { color: '#800E20', fontWeight: '800' }]}>
                        {p}
                      </Text>
                    </View>
                    <Text style={styles.productSub}>{isF2R ? 'Premium Super Fast' : 'Water Shield Armor'}</Text>
                    {isSelected && (
                      <View style={styles.productCheckCircle}>
                        <Ionicons name="checkmark" size={12} color="#FFFFFF" />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Quantity Bags & MT */}
          <View style={styles.group}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <Text style={[styles.label, { marginBottom: 0 }]}>Quantity (Bags) <Text style={styles.required}>*</Text></Text>
              {numBags > 0 && (
                <View style={styles.mtBadge}>
                  <Text style={styles.mtBadgeText}>{mtValue} Metric Ton (MT)</Text>
                </View>
              )}
            </View>
            <TextInput
              style={styles.input}
              placeholder="e.g. 100"
              placeholderTextColor={Colors.textMuted}
              keyboardType="numeric"
              value={quantityBags}
              onChangeText={setQuantityBags}
            />

            {/* Quick Bag Pills */}
            <View style={styles.quickCountRow}>
              {[50, 100, 200, 500, 1000].map(amt => (
                <TouchableOpacity
                  key={amt}
                  style={styles.quickCountPill}
                  onPress={() => setQuantityBags(String((Number(quantityBags) || 0) + amt))}
                >
                  <Text style={styles.quickCountPillText}>+{amt}</Text>
                </TouchableOpacity>
              ))}
              {quantityBags ? (
                <TouchableOpacity
                  style={[styles.quickCountPill, { backgroundColor: '#FEE2E2', borderColor: '#FCA5A5' }]}
                  onPress={() => setQuantityBags('')}
                >
                  <Text style={[styles.quickCountPillText, { color: '#DC2626' }]}>Clear</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>

          {/* Remark */}
          <View style={styles.group}>
            <Text style={styles.label}>Remark / Invoice No. (Optional)</Text>
            <TextInput
              style={[styles.input, { height: 60, textAlignVertical: 'top' }]}
              multiline
              placeholder="Invoice number, delivery site, vehicle..."
              placeholderTextColor={Colors.textMuted}
              value={saleRemark}
              onChangeText={setSaleRemark}
            />
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            style={[styles.submitBtn, saleMutation.isPending && { opacity: 0.7 }]}
            onPress={handleSubmit}
            disabled={saleMutation.isPending}
            activeOpacity={0.85}
          >
            {saleMutation.isPending ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.submitBtnText}>Record Sale in Google Sheet 📈</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ── DEALER PICKER MODAL ── */}
      <Modal
        visible={showDealerPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowDealerPicker(false)}
      >
        <View style={styles.pickerOverlay}>
          <View style={styles.pickerSheet}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Select Dealer Counter</Text>
              <TouchableOpacity onPress={() => setShowDealerPicker(false)}>
                <Ionicons name="close" size={22} color={Colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <View style={styles.pickerSearchRow}>
              <Ionicons name="search" size={16} color="#8A7277" style={{ marginRight: 6 }} />
              <TextInput
                style={styles.pickerSearchInput}
                placeholder="Search by name, area or SAP code..."
                placeholderTextColor={Colors.textMuted}
                value={dealerSearch}
                onChangeText={setDealerSearch}
              />
              {dealerSearch ? (
                <TouchableOpacity onPress={() => setDealerSearch('')}>
                  <Ionicons name="close-circle" size={16} color="#8A7277" />
                </TouchableOpacity>
              ) : null}
            </View>

            <FlatList
              data={filteredDealers}
              keyExtractor={d => d.dealer_id}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.dealerItemRow}
                  onPress={() => {
                    setSelectedDealer(item);
                    setShowDealerPicker(false);
                    setDealerSearch('');
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.dealerItemName}>{item.dealer_name}</Text>
                    <Text style={styles.dealerItemSub}>
                      {item.area || 'Jajpur'} {item.sap_code ? `· SAP: ${item.sap_code}` : ''}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color="#C9A3AA" />
                </TouchableOpacity>
              )}
            />
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
  backBtn: {
    width: 40,
    alignItems: 'flex-start',
  },
  headerTitle: {
    fontFamily: FontFamily.displayBold,
    fontSize: 18,
    color: '#1F0B10',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  aiScanBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4A0611',
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    shadowColor: '#4A0611',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  aiScanIconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  aiTagText: {
    fontFamily: FontFamily.sansBold,
    fontSize: 9,
    color: '#FCA5A5',
    letterSpacing: 0.5,
  },
  autoPill: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  autoPillText: {
    fontFamily: FontFamily.sansBold,
    fontSize: 8,
    color: '#15803D',
  },
  aiScanTitle: {
    fontFamily: FontFamily.displayBold,
    fontSize: 15,
    color: '#FFFFFF',
  },
  aiScanSub: {
    fontFamily: FontFamily.sansRegular,
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 2,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#EEDCE1',
    shadowColor: 'rgba(78, 5, 17, 0.04)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 2,
  },
  group: {
    marginBottom: 16,
  },
  label: {
    fontFamily: FontFamily.sansBold,
    fontSize: 12,
    color: '#1F0B10',
    marginBottom: 6,
  },
  required: {
    color: '#800E20',
  },
  input: {
    backgroundColor: '#FAF0F2',
    borderWidth: 1.5,
    borderColor: '#EEDCE1',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    fontFamily: FontFamily.sansMedium,
    color: '#1F0B10',
  },
  pickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FAF0F2',
    borderWidth: 1.5,
    borderColor: '#EEDCE1',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  pickerSelected: {
    fontFamily: FontFamily.displayBold,
    fontSize: 14,
    color: '#1F0B10',
  },
  pickerPlaceholder: {
    fontFamily: FontFamily.sansRegular,
    fontSize: 14,
    color: Colors.textMuted,
  },
  pickerSubtext: {
    fontFamily: FontFamily.sansRegular,
    fontSize: 11,
    color: '#8A7277',
    marginTop: 2,
  },
  productRow: {
    flexDirection: 'row',
    gap: 10,
  },
  productCard: {
    flex: 1,
    backgroundColor: '#FAF0F2',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1.5,
    borderColor: '#EEDCE1',
  },
  productCardActiveF2R: {
    backgroundColor: '#FDE8EA',
    borderColor: '#800E20',
  },
  productCardActiveGold: {
    backgroundColor: '#FEF3C7',
    borderColor: '#D97706',
  },
  productDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  productName: {
    fontFamily: FontFamily.displayBold,
    fontSize: 13,
    color: '#1F0B10',
  },
  productSub: {
    fontFamily: FontFamily.sansRegular,
    fontSize: 10,
    color: '#8A7277',
    marginTop: 3,
  },
  productCheckCircle: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#800E20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mtBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  mtBadgeText: {
    fontFamily: FontFamily.sansBold,
    fontSize: 10,
    color: '#15803D',
  },
  quickCountRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  quickCountPill: {
    backgroundColor: '#FAF0F2',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#EEDCE1',
  },
  quickCountPillText: {
    fontFamily: FontFamily.sansBold,
    fontSize: 11,
    color: '#800E20',
  },
  submitBtn: {
    backgroundColor: '#800E20',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#800E20',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
    marginTop: 8,
  },
  submitBtnText: {
    fontFamily: FontFamily.sansBold,
    fontSize: 15,
    color: '#FFFFFF',
  },
  pickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  pickerSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '75%',
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  pickerTitle: {
    fontFamily: FontFamily.displayBold,
    fontSize: 16,
    color: '#1F0B10',
  },
  pickerSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FAF0F2',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#EEDCE1',
    marginBottom: 12,
  },
  pickerSearchInput: {
    flex: 1,
    fontFamily: FontFamily.sansRegular,
    fontSize: 13,
    color: '#1F0B10',
    padding: 0,
  },
  dealerItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3E8EB',
  },
  dealerItemName: {
    fontFamily: FontFamily.displayBold,
    fontSize: 14,
    color: '#1F0B10',
  },
  dealerItemSub: {
    fontFamily: FontFamily.sansRegular,
    fontSize: 11,
    color: '#8A7277',
    marginTop: 2,
  },
});
