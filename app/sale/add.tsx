import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  TextInput, ActivityIndicator, Platform, Modal, FlatList,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Toast from 'react-native-toast-message';
import { Colors } from '../../src/theme/colors';
import { Spacing, BorderRadius } from '../../src/theme/spacing';
import { apiGetDealers, apiCreateSale, apiAddPunch, apiGetUsers } from '../../src/services/api';
import { getUser } from '../../src/services/auth';
import { currentDateISO } from '../../src/utils/helpers';
import { User, Dealer, Product } from '../../src/types';
import { Ionicons } from '@expo/vector-icons';

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
        Toast.show({ type: 'success', text1: 'Sale Added', text2: 'Sale recorded successfully.' });
        queryClient.invalidateQueries({ queryKey: ['sales'] });
        queryClient.invalidateQueries({ queryKey: ['dealerSalesSummary'] });
        router.back();
      } else {
        Toast.show({ type: 'error', text1: 'Error', text2: res.message });
      }
    },
    onError: (err: any) => Toast.show({ type: 'error', text1: 'Error', text2: err.message }),
  });

  const punchMutation = useMutation({
    mutationFn: (data: any) => apiAddPunch(data),
    onSuccess: (res) => {
      if (res.success) {
        Toast.show({ type: 'success', text1: 'Punch Recorded', text2: 'Punch quantity saved.' });
        queryClient.invalidateQueries({ queryKey: ['teActiveSummary'] });
        router.back();
      } else {
        Toast.show({ type: 'error', text1: 'Error', text2: res.message });
      }
    },
    onError: (err: any) => Toast.show({ type: 'error', text1: 'Error', text2: err.message }),
  });

  const handleSaleSubmit = () => {
    if (!saleDate) { Toast.show({ type: 'error', text1: 'Missing', text2: 'Date is required.' }); return; }
    if (!selectedDealer) { Toast.show({ type: 'error', text1: 'Missing', text2: 'Select a dealer.' }); return; }
    if (!quantityBags || isNaN(Number(quantityBags))) { Toast.show({ type: 'error', text1: 'Missing', text2: 'Enter valid quantity.' }); return; }
    saleMutation.mutate({
      sale_date: saleDate,
      dealer_id: selectedDealer.dealer_id,
      dealer_name: selectedDealer.dealer_name,
      product,
      quantity_bags: Number(quantityBags),
      assigned_te: selectedDealer.assigned_te,
      source: 'APP',
      created_by: user?.name || '',
    });
  };

  const handlePunchSubmit = () => {
    if (!punchDate || !punchTE || !punchQty) {
      Toast.show({ type: 'error', text1: 'Missing', text2: 'Date, TE, and quantity are required.' }); return;
    }
    punchMutation.mutate({
      date: punchDate,
      te: punchTE,
      punch_quantity_bags: Number(punchQty),
      remark: punchRemark,
      updated_by: user?.name || '',
    });
  };

  const filteredDealers = (dealers || []).filter(d =>
    d.dealer_name.toLowerCase().includes(dealerSearch.toLowerCase()) && d.active
  );

  const isPending = saleMutation.isPending || punchMutation.isPending;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="close" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>{mode === 'sale' ? 'Add Sale' : 'Add Punch'}</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Mode Toggle */}
      <View style={modeStyles.container}>
        <TouchableOpacity
          style={[modeStyles.btn, mode === 'sale' && modeStyles.btnActive]}
          onPress={() => setMode('sale')}
        >
          <Text style={[modeStyles.btnText, mode === 'sale' && modeStyles.btnTextActive]}>Sale Entry</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[modeStyles.btn, mode === 'punch' && modeStyles.btnActive]}
          onPress={() => setMode('punch')}
        >
          <Text style={[modeStyles.btnText, mode === 'punch' && modeStyles.btnTextActive]}>Add Punch</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {mode === 'sale' ? (
          <>
            <View style={styles.group}>
              <Text style={styles.label}>Date <Text style={styles.required}>*</Text></Text>
              <TextInput style={styles.input} value={saleDate} onChangeText={setSaleDate} placeholder="YYYY-MM-DD" placeholderTextColor={Colors.textMuted} />
            </View>
            <View style={styles.group}>
              <Text style={styles.label}>Dealer <Text style={styles.required}>*</Text></Text>
              <TouchableOpacity style={styles.pickerBtn} onPress={() => setShowDealerPicker(true)}>
                <Text style={selectedDealer ? styles.pickerSelected : styles.pickerPlaceholder}>
                  {selectedDealer ? selectedDealer.dealer_name : 'Select dealer...'}
                </Text>
                <Ionicons name="chevron-down" size={16} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>
            <View style={styles.group}>
              <Text style={styles.label}>Product <Text style={styles.required}>*</Text></Text>
              <View style={productStyles.row}>
                {(['ACC F2R', 'ACC GOLD'] as Product[]).map(p => (
                  <TouchableOpacity
                    key={p}
                    style={[productStyles.btn, product === p && productStyles.btnActive]}
                    onPress={() => setProduct(p)}
                  >
                    <Text style={[productStyles.btnText, product === p && productStyles.btnTextActive]}>{p}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <View style={styles.group}>
              <Text style={styles.label}>Quantity (Bags) <Text style={styles.required}>*</Text></Text>
              <TextInput
                style={styles.input}
                value={quantityBags}
                onChangeText={setQuantityBags}
                placeholder="Number of bags"
                placeholderTextColor={Colors.textMuted}
                keyboardType="numeric"
              />
            </View>
            <View style={styles.group}>
              <Text style={styles.label}>Remark</Text>
              <TextInput
                style={[styles.input, styles.textarea]}
                value={saleRemark}
                onChangeText={setSaleRemark}
                placeholder="Optional note"
                placeholderTextColor={Colors.textMuted}
                multiline
              />
            </View>
            <TouchableOpacity style={[styles.submitBtn, isPending && styles.submitBtnDisabled]} onPress={handleSaleSubmit} disabled={isPending}>
              {isPending ? <ActivityIndicator color={Colors.white} /> : <Text style={styles.submitText}>Add Sale 📊</Text>}
            </TouchableOpacity>
          </>
        ) : (
          <>
            <View style={styles.group}>
              <Text style={styles.label}>Date <Text style={styles.required}>*</Text></Text>
              <TextInput style={styles.input} value={punchDate} onChangeText={setPunchDate} placeholder="YYYY-MM-DD" placeholderTextColor={Colors.textMuted} />
            </View>
            <View style={styles.group}>
              <Text style={styles.label}>TE <Text style={styles.required}>*</Text></Text>
              <TextInput style={styles.input} value={punchTE} onChangeText={setPunchTE} placeholder="TE name" placeholderTextColor={Colors.textMuted} />
            </View>
            <View style={styles.group}>
              <Text style={styles.label}>Punch Quantity (Bags) <Text style={styles.required}>*</Text></Text>
              <TextInput
                style={styles.input}
                value={punchQty}
                onChangeText={setPunchQty}
                placeholder="Bags punched"
                placeholderTextColor={Colors.textMuted}
                keyboardType="numeric"
              />
            </View>
            <View style={styles.group}>
              <Text style={styles.label}>Remark</Text>
              <TextInput
                style={[styles.input, styles.textarea]}
                value={punchRemark}
                onChangeText={setPunchRemark}
                placeholder="Optional note"
                placeholderTextColor={Colors.textMuted}
                multiline
              />
            </View>
            <TouchableOpacity style={[styles.submitBtn, isPending && styles.submitBtnDisabled]} onPress={handlePunchSubmit} disabled={isPending}>
              {isPending ? <ActivityIndicator color={Colors.white} /> : <Text style={styles.submitText}>Record Punch ⚡</Text>}
            </TouchableOpacity>
          </>
        )}
        <View style={{ height: 40 }} />
      </ScrollView>

      <Modal visible={showDealerPicker} animationType="slide" transparent>
        <View style={pickerStyles.overlay}>
          <View style={pickerStyles.sheet}>
            <View style={pickerStyles.header}>
              <Text style={pickerStyles.title}>Select Dealer</Text>
              <TouchableOpacity onPress={() => setShowDealerPicker(false)}>
                <Ionicons name="close" size={22} color={Colors.textPrimary} />
              </TouchableOpacity>
            </View>
            <TextInput style={pickerStyles.search} value={dealerSearch} onChangeText={setDealerSearch} placeholder="Search dealer..." placeholderTextColor={Colors.textMuted} />
            <FlatList
              data={filteredDealers}
              keyExtractor={d => d.dealer_id}
              renderItem={({ item }) => (
                <TouchableOpacity style={pickerStyles.item} onPress={() => { setSelectedDealer(item); setShowDealerPicker(false); }}>
                  <Text style={pickerStyles.itemName}>{item.dealer_name}</Text>
                  <Text style={pickerStyles.itemSub}>{item.area}</Text>
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
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.base, paddingTop: Platform.OS === 'ios' ? 56 : 36, paddingBottom: 16, backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.border },
  backBtn: { width: 40, alignItems: 'flex-start' },
  title: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary },
  scroll: { flex: 1, padding: Spacing.base },
  group: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '600', color: Colors.textPrimary, marginBottom: 7 },
  required: { color: Colors.error },
  input: { borderWidth: 1.5, borderColor: Colors.border, borderRadius: BorderRadius.md, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: Colors.textPrimary, backgroundColor: Colors.white },
  textarea: { height: 80, textAlignVertical: 'top' },
  pickerBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1.5, borderColor: Colors.border, borderRadius: BorderRadius.md, paddingHorizontal: 14, paddingVertical: 13, backgroundColor: Colors.white },
  pickerSelected: { fontSize: 15, color: Colors.textPrimary, flex: 1 },
  pickerPlaceholder: { fontSize: 15, color: Colors.textMuted, flex: 1 },
  submitBtn: { backgroundColor: Colors.primary, borderRadius: BorderRadius.lg, padding: 16, alignItems: 'center', marginTop: 8, shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 8, elevation: 5 },
  submitBtnDisabled: { opacity: 0.7 },
  submitText: { color: Colors.white, fontSize: 17, fontWeight: '700' },
});

const modeStyles = StyleSheet.create({
  container: { flexDirection: 'row', margin: Spacing.base, backgroundColor: Colors.borderLight, borderRadius: 12, padding: 4 },
  btn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10 },
  btnActive: { backgroundColor: Colors.white, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 },
  btnText: { fontSize: 14, fontWeight: '600', color: Colors.textSecondary },
  btnTextActive: { color: Colors.primary },
});

const productStyles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 10 },
  btn: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 12, borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.white },
  btnActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  btnText: { fontSize: 14, fontWeight: '600', color: Colors.textSecondary },
  btnTextActive: { color: Colors.primary },
});

const pickerStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: Colors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '80%' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  title: { fontSize: 17, fontWeight: '700', color: Colors.textPrimary },
  search: { borderWidth: 1.5, borderColor: Colors.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15, color: Colors.textPrimary, marginBottom: 8 },
  item: { paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  itemName: { fontSize: 15, fontWeight: '600', color: Colors.textPrimary },
  itemSub: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
});
