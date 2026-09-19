import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  TextInput, ActivityIndicator, Platform, Modal, FlatList,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Toast from 'react-native-toast-message';
import { Colors } from '../../src/theme/colors';
import { apiGetDealers, apiCreateSale, apiAddPunch, apiGetUsers } from '../../src/services/api';
import { getUser } from '../../src/services/auth';
import { currentDateISO, normalizeDate } from '../../src/utils/helpers';
import { User, Dealer, Product } from '../../src/types';
import { FontFamily } from '../../src/theme/typography';
import { Ionicons, MaterialCommunityIcons, Feather } from '@expo/vector-icons';

type Mode = 'sale' | 'punch';

export default function AddSaleScreen() {
  const params = useLocalSearchParams<{ type?: string }>();
  const queryClient = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const [mode, setMode] = useState<Mode>(params.type === 'punch' ? 'punch' : 'sale');

  // Sale form
  const [saleDate, setSaleDate] = useState(currentDateISO());
  const [selectedDealer, setSelectedDealer] = useState<Dealer | null>(null);
  const [product, setProduct] = useState<Product>('ACC F2R');
  const [quantityBags, setQuantityBags] = useState('');
  const [saleRemark, setSaleRemark] = useState('');
  const [showDealerPicker, setShowDealerPicker] = useState(false);
  const [dealerSearch, setDealerSearch] = useState('');

  // Punch form
  const [punchDate, setPunchDate] = useState(currentDateISO());
  const [punchTE, setPunchTE] = useState('');
  const [punchQty, setPunchQty] = useState('');
  const [punchRemark, setPunchRemark] = useState('');

  useEffect(() => {
    getUser().then(u => {
      setUser(u);
      if (u) setPunchTE(u.name);
    });
  }, []);

  const { data: dealers } = useQuery({ queryKey: ['dealers'], queryFn: apiGetDealers });
  const { data: users } = useQuery({ queryKey: ['users'], queryFn: apiGetUsers });
  const teUsers = (users || []).filter(u => u.role === 'TE' && u.active);

  const saleMutation = useMutation({
    mutationFn: (data: any) => apiCreateSale(data),
    onSuccess: (res) => {
      if (res.success) {
        Toast.show({ type: 'success', text1: 'Sale Recorded ✅', text2: 'Logged in Google Sheet successfully.' });
        queryClient.invalidateQueries({ queryKey: ['sales'] });
        queryClient.invalidateQueries({ queryKey: ['dealerSalesSummary'] });
        queryClient.invalidateQueries({ queryKey: ['todaySummary'] });
        router.back();
      } else {
        Toast.show({ type: 'error', text1: 'Error', text2: res.message });
      }
    },
    onError: (err: any) => Toast.show({ type: 'error', text1: 'Error', text2: err.message || 'Failed to add sale.' }),
  });

  const punchMutation = useMutation({
    mutationFn: (data: any) => apiAddPunch(data),
    onSuccess: (res) => {
      if (res.success) {
        Toast.show({ type: 'success', text1: 'Punch Saved ✅', text2: 'Active tracker updated in Google Sheet.' });
        queryClient.invalidateQueries({ queryKey: ['activeTrackers'] });
        queryClient.invalidateQueries({ queryKey: ['teActiveSummary'] });
        queryClient.invalidateQueries({ queryKey: ['todaySummary'] });
        router.back();
      } else {
        Toast.show({ type: 'error', text1: 'Error', text2: res.message });
      }
    },
    onError: (err: any) => Toast.show({ type: 'error', text1: 'Error', text2: err.message || 'Failed to save punch.' }),
  });

  const handleSaleSubmit = () => {
    if (!saleDate) { Toast.show({ type: 'error', text1: 'Missing Date', text2: 'Please specify the sale date.' }); return; }
    if (!selectedDealer) { Toast.show({ type: 'error', text1: 'Missing Dealer', text2: 'Please select a dealer.' }); return; }
    if (!quantityBags || isNaN(Number(quantityBags)) || Number(quantityBags) <= 0) {
      Toast.show({ type: 'error', text1: 'Invalid Quantity', text2: 'Please enter a valid bag quantity.' }); return;
    }
    saleMutation.mutate({
      sale_date: saleDate,
      dealer_id: selectedDealer.dealer_id,
      dealer_name: selectedDealer.dealer_name,
      product,
      quantity_bags: Number(quantityBags),
      assigned_te: selectedDealer.assigned_te || user?.name || 'Team Jajpur',
      source: 'APP',
      created_by: user?.name || '',
    });
  };

  const handlePunchSubmit = () => {
    if (!punchDate || !punchTE || !punchQty || Number(punchQty) <= 0) {
      Toast.show({ type: 'error', text1: 'Missing Fields', text2: 'Date, TE name, and valid punch bag quantity are required.' }); return;
    }
    punchMutation.mutate({
      date: punchDate,
      te: punchTE,
      punch_quantity_bags: Number(punchQty),
      remark: punchRemark,
      updated_by: user?.name || '',
    });
  };

  const filteredDealers = (dealers || []).filter(d => {
    const nameMatch = (d.dealer_name || '').toLowerCase().includes(dealerSearch.toLowerCase());
    const isNotInactive = d.active === undefined || d.active === null || String(d.active) === '' || String(d.active).toLowerCase() !== 'false';
    return nameMatch && isNotInactive;
  });

  const isPending = saleMutation.isPending || punchMutation.isPending;

  return (
    <View style={styles.container}>
      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="close" size={24} color="#1F0B10" />
        </TouchableOpacity>
        <Text style={styles.title}>{mode === 'sale' ? 'Record Sale Entry' : 'Record Contractor Punch'}</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Mode Switcher */}
      <View style={styles.modeToggleContainer}>
        <TouchableOpacity
          style={[styles.modeBtn, mode === 'sale' && styles.modeBtnActive]}
          onPress={() => setMode('sale')}
          activeOpacity={0.8}
        >
          <MaterialCommunityIcons
            name="cart-outline"
            size={18}
            color={mode === 'sale' ? '#FFFFFF' : '#8A7277'}
            style={{ marginRight: 6 }}
          />
          <Text style={[styles.modeBtnText, mode === 'sale' && styles.modeBtnTextActive]}>
            Sale Entry
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.modeBtn, mode === 'punch' && styles.modeBtnActive]}
          onPress={() => setMode('punch')}
          activeOpacity={0.8}
        >
          <MaterialCommunityIcons
            name="cube-send"
            size={18}
            color={mode === 'punch' ? '#FFFFFF' : '#8A7277'}
            style={{ marginRight: 6 }}
          />
          <Text style={[styles.modeBtnText, mode === 'punch' && styles.modeBtnTextActive]}>
            Contractor Punch
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {mode === 'sale' ? (
          <View style={styles.formCard}>
            {/* Sale Date */}
            <View style={styles.group}>
              <Text style={styles.label}>Sale Date <Text style={styles.required}>*</Text></Text>
              <TextInput
                style={styles.input}
                value={saleDate}
                onChangeText={setSaleDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#A0858C"
              />
            </View>

            {/* Dealer Picker */}
            <View style={styles.group}>
              <Text style={styles.label}>Dealer / Counter <Text style={styles.required}>*</Text></Text>
              <TouchableOpacity
                style={styles.pickerBtn}
                onPress={() => setShowDealerPicker(true)}
                activeOpacity={0.8}
              >
                <Text style={selectedDealer ? styles.pickerSelected : styles.pickerPlaceholder}>
                  {selectedDealer ? `${selectedDealer.dealer_name} (${selectedDealer.area || 'Jajpur'})` : 'Select dealer...'}
                </Text>
                <Ionicons name="chevron-down" size={18} color="#800E20" />
              </TouchableOpacity>
            </View>

            {/* Product Selector */}
            <View style={styles.group}>
              <Text style={styles.label}>Product Type <Text style={styles.required}>*</Text></Text>
              <View style={styles.productRow}>
                {(['ACC F2R', 'ACC GOLD'] as Product[]).map(p => {
                  const isSelected = product === p;
                  return (
                    <TouchableOpacity
                      key={p}
                      style={[styles.productBtn, isSelected && styles.productBtnActive]}
                      onPress={() => setProduct(p)}
                      activeOpacity={0.8}
                    >
                      <View style={[styles.productDot, { backgroundColor: p === 'ACC F2R' ? '#E53935' : '#F59E0B' }]} />
                      <Text style={[styles.productBtnText, isSelected && styles.productBtnTextActive]}>{p}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Quantity */}
            <View style={styles.group}>
              <Text style={styles.label}>Quantity (Bags) <Text style={styles.required}>*</Text></Text>
              <View style={styles.qtyInputContainer}>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  value={quantityBags}
                  onChangeText={setQuantityBags}
                  placeholder="e.g. 100"
                  placeholderTextColor="#A0858C"
                  keyboardType="numeric"
                />
                {quantityBags && !isNaN(Number(quantityBags)) ? (
                  <View style={styles.mtBadge}>
                    <Text style={styles.mtBadgeText}>{(Number(quantityBags) / 20).toFixed(1)} MT</Text>
                  </View>
                ) : null}
              </View>
            </View>

            {/* Remark */}
            <View style={styles.group}>
              <Text style={styles.label}>Remark / Dispatch Details</Text>
              <TextInput
                style={[styles.input, styles.textarea]}
                value={saleRemark}
                onChangeText={setSaleRemark}
                placeholder="Optional notes, invoice no, vehicle details..."
                placeholderTextColor="#A0858C"
                multiline
                numberOfLines={3}
              />
            </View>

            {/* Submit Button */}
            <TouchableOpacity
              style={[styles.submitBtn, isPending && styles.submitBtnDisabled]}
              onPress={handleSaleSubmit}
              disabled={isPending}
              activeOpacity={0.85}
            >
              {isPending ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <View style={styles.submitBtnRow}>
                  <MaterialCommunityIcons name="cart-arrow-down" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
                  <Text style={styles.submitText}>Save Sale to Google Sheet</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.formCard}>
            {/* Punch Date */}
            <View style={styles.group}>
              <Text style={styles.label}>Punch Date <Text style={styles.required}>*</Text></Text>
              <TextInput
                style={styles.input}
                value={punchDate}
                onChangeText={setPunchDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#A0858C"
              />
            </View>

            {/* TE User */}
            <View style={styles.group}>
              <Text style={styles.label}>Territory Executive (TE) <Text style={styles.required}>*</Text></Text>
              <TextInput
                style={styles.input}
                value={punchTE}
                onChangeText={setPunchTE}
                placeholder="TE full name"
                placeholderTextColor="#A0858C"
              />
            </View>

            {/* Punch Quantity */}
            <View style={styles.group}>
              <Text style={styles.label}>Punched Quantity (Bags) <Text style={styles.required}>*</Text></Text>
              <View style={styles.qtyInputContainer}>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  value={punchQty}
                  onChangeText={setPunchQty}
                  placeholder="Total bags punched against contractor"
                  placeholderTextColor="#A0858C"
                  keyboardType="numeric"
                />
                {punchQty && !isNaN(Number(punchQty)) ? (
                  <View style={styles.mtBadge}>
                    <Text style={styles.mtBadgeText}>{(Number(punchQty) / 20).toFixed(1)} MT</Text>
                  </View>
                ) : null}
              </View>
            </View>

            {/* Remark */}
            <View style={styles.group}>
              <Text style={styles.label}>Remark / Contractor Details</Text>
              <TextInput
                style={[styles.input, styles.textarea]}
                value={punchRemark}
                onChangeText={setPunchRemark}
                placeholder="Contractor names, coupons punched..."
                placeholderTextColor="#A0858C"
                multiline
                numberOfLines={3}
              />
            </View>

            {/* Submit Button */}
            <TouchableOpacity
              style={[styles.submitBtn, isPending && styles.submitBtnDisabled]}
              onPress={handlePunchSubmit}
              disabled={isPending}
              activeOpacity={0.85}
            >
              {isPending ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <View style={styles.submitBtnRow}>
                  <MaterialCommunityIcons name="cube-send" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
                  <Text style={styles.submitText}>Save Punch to Google Sheet</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        )}
        <View style={{ height: 60 }} />
      </ScrollView>

      {/* Dealer Selection Modal */}
      <Modal visible={showDealerPicker} animationType="slide" transparent>
        <View style={pickerStyles.overlay}>
          <View style={pickerStyles.sheet}>
            <View style={pickerStyles.header}>
              <Text style={pickerStyles.title}>Select Dealer</Text>
              <TouchableOpacity onPress={() => setShowDealerPicker(false)}>
                <Ionicons name="close" size={24} color="#1F0B10" />
              </TouchableOpacity>
            </View>
            <TextInput
              style={pickerStyles.search}
              value={dealerSearch}
              onChangeText={setDealerSearch}
              placeholder="Search dealer by name..."
              placeholderTextColor="#A0858C"
            />
            <FlatList
              data={filteredDealers}
              keyExtractor={d => d.dealer_id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={pickerStyles.item}
                  onPress={() => { setSelectedDealer(item); setShowDealerPicker(false); }}
                >
                  <Text style={pickerStyles.itemName}>{item.dealer_name}</Text>
                  <Text style={pickerStyles.itemSub}>{item.area || 'Jajpur'} • {item.owner_name || 'Dealer'}</Text>
                </TouchableOpacity>
              )}
              keyboardShouldPersistTaps="handled"
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
    paddingHorizontal: 18,
    paddingTop: Platform.OS === 'ios' ? 56 : 38,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F0E2E5',
  },
  backBtn: {
    width: 40,
    alignItems: 'flex-start',
  },
  title: {
    fontFamily: FontFamily.displayBold,
    fontSize: 18,
    fontWeight: '800',
    color: '#1F0B10',
  },
  modeToggleContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 14,
    marginBottom: 8,
    borderRadius: 16,
    padding: 4,
    borderWidth: 1.5,
    borderColor: '#EEDCE1',
  },
  modeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 12,
  },
  modeBtnActive: {
    backgroundColor: '#800E20',
  },
  modeBtnText: {
    fontFamily: FontFamily.sansBold,
    fontSize: 13,
    fontWeight: '700',
    color: '#8A7277',
  },
  modeBtnTextActive: {
    color: '#FFFFFF',
  },
  scroll: {
    flex: 1,
    padding: 16,
  },
  formCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1.5,
    borderColor: '#EEDCE1',
    shadowColor: 'rgba(78, 5, 17, 0.06)',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 14,
    elevation: 4,
  },
  group: {
    marginBottom: 16,
  },
  label: {
    fontFamily: FontFamily.sansBold,
    fontSize: 13,
    fontWeight: '700',
    color: '#1F0B10',
    marginBottom: 6,
  },
  required: {
    color: '#DC2626',
  },
  input: {
    fontFamily: FontFamily.sansMedium,
    borderWidth: 1.5,
    borderColor: '#EEDCE1',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#1F0B10',
    backgroundColor: '#FAF6F7',
    fontWeight: '600',
  },
  qtyInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  mtBadge: {
    backgroundColor: '#FBE8EC',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E8D5DA',
  },
  mtBadgeText: {
    fontFamily: FontFamily.sansBold,
    fontSize: 14,
    fontWeight: '800',
    color: '#800E20',
  },
  textarea: {
    height: 76,
    textAlignVertical: 'top',
  },
  pickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1.5,
    borderColor: '#EEDCE1',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 13,
    backgroundColor: '#FAF6F7',
  },
  pickerSelected: {
    fontFamily: FontFamily.sansBold,
    fontSize: 15,
    color: '#1F0B10',
    fontWeight: '700',
    flex: 1,
  },
  pickerPlaceholder: {
    fontFamily: FontFamily.sansRegular,
    fontSize: 15,
    color: '#A0858C',
    flex: 1,
  },
  productRow: {
    flexDirection: 'row',
    gap: 10,
  },
  productBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#EEDCE1',
    backgroundColor: '#FAF6F7',
    gap: 8,
  },
  productBtnActive: {
    borderColor: '#800E20',
    backgroundColor: '#FBE8EC',
  },
  productDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  productBtnText: {
    fontFamily: FontFamily.sansBold,
    fontSize: 14,
    fontWeight: '700',
    color: '#6B4E55',
  },
  productBtnTextActive: {
    color: '#800E20',
    fontWeight: '900',
  },
  submitBtn: {
    backgroundColor: '#800E20',
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
    shadowColor: '#800E20',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  submitBtnDisabled: {
    opacity: 0.7,
  },
  submitBtnRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  submitText: {
    fontFamily: FontFamily.sansBold,
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});

const pickerStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(31, 11, 16, 0.65)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 20,
    maxHeight: '80%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  title: {
    fontFamily: FontFamily.displayBold,
    fontSize: 18,
    fontWeight: '800',
    color: '#1F0B10',
  },
  search: {
    fontFamily: FontFamily.sansMedium,
    borderWidth: 1.5,
    borderColor: '#EEDCE1',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: '#1F0B10',
    marginBottom: 10,
    backgroundColor: '#FAF6F7',
  },
  item: {
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: '#F7EFF1',
  },
  itemName: {
    fontFamily: FontFamily.sansBold,
    fontSize: 15,
    fontWeight: '700',
    color: '#1F0B10',
  },
  itemSub: {
    fontFamily: FontFamily.sansRegular,
    fontSize: 12,
    color: '#8A7277',
    marginTop: 2,
  },
});

