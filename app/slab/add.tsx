import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  TextInput, ActivityIndicator, Platform, Alert, Modal, FlatList,
} from 'react-native';
import { router } from 'expo-router';
import * as Location from 'expo-location';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Toast from 'react-native-toast-message';
import { Colors } from '../../src/theme/colors';
import { Spacing, BorderRadius } from '../../src/theme/spacing';
import { Typography, FontFamily, FontSize } from '../../src/theme/typography';
import {
  apiGetDealers, apiGetContractors, apiCreateSlab,
  apiAddContractor, apiAddDealer
} from '../../src/services/api';
import { getUser } from '../../src/services/auth';
import { currentDateISO } from '../../src/utils/helpers';
import { User, Dealer, Contractor } from '../../src/types';
import { Ionicons, Feather } from '@expo/vector-icons';

export default function AddSlabScreen() {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<User | null>(null);

  const [slabDate, setSlabDate] = useState(currentDateISO());
  const [selectedDealer, setSelectedDealer] = useState<Dealer | null>(null);
  const [contractorName, setContractorName] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [siteAddress, setSiteAddress] = useState('');
  const [expectedCement, setExpectedCement] = useState('');
  const [remark, setRemark] = useState('');
  const [assignedTE, setAssignedTE] = useState('');
  const [latitude, setLatitude] = useState<number | undefined>();
  const [longitude, setLongitude] = useState<number | undefined>();
  const [locationLoading, setLocationLoading] = useState(false);

  const [showDealerPicker, setShowDealerPicker] = useState(false);
  const [showContractorPicker, setShowContractorPicker] = useState(false);
  const [newDealerMode, setNewDealerMode] = useState(false);
  const [newContractorMode, setNewContractorMode] = useState(false);

  const [newDealerName, setNewDealerName] = useState('');
  const [newDealerArea, setNewDealerArea] = useState('');
  const [newDealerPhone, setNewDealerPhone] = useState('');
  const [newDealerOwner, setNewDealerOwner] = useState('');

  const [newContractorName, setNewContractorName] = useState('');
  const [newContractorMobile, setNewContractorMobile] = useState('');
  const [newContractorArea, setNewContractorArea] = useState('');

  const [dealerSearch, setDealerSearch] = useState('');
  const [contractorSearch, setContractorSearch] = useState('');

  useEffect(() => {
    getUser().then(u => {
      setUser(u);
      if (u) setAssignedTE(u.name);
    });
  }, []);

  const { data: dealers } = useQuery({ queryKey: ['dealers'], queryFn: () => apiGetDealers() });
  const { data: contractors } = useQuery({ queryKey: ['contractors'], queryFn: () => apiGetContractors() });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiCreateSlab(data),
    onSuccess: (res) => {
      if (res.success) {
        Toast.show({ type: 'success', text1: 'Slab Added', text2: 'Slab scheduled successfully.' });
        queryClient.invalidateQueries({ queryKey: ['slabs'] });
        queryClient.invalidateQueries({ queryKey: ['todaySummary'] });
        router.back();
      } else {
        Toast.show({ type: 'error', text1: 'Error', text2: res.message });
      }
    },
    onError: (err: any) => {
      Toast.show({ type: 'error', text1: 'Error', text2: err.message || 'Failed to add slab.' });
    },
  });

  const addDealerMutation = useMutation({
    mutationFn: (data: any) => apiAddDealer(data),
    onSuccess: (res) => {
      if (res.success && res.data) {
        Toast.show({ type: 'success', text1: 'Dealer Added', text2: `${res.data.dealer_name} created.` });
        queryClient.invalidateQueries({ queryKey: ['dealers'] });
        setSelectedDealer(res.data);
        setShowDealerPicker(false);
        setNewDealerMode(false);
        setNewDealerName(''); setNewDealerArea(''); setNewDealerPhone(''); setNewDealerOwner('');
      } else {
        Toast.show({ type: 'error', text1: 'Error', text2: res.message });
      }
    },
    onError: (err: any) => { Toast.show({ type: 'error', text1: 'Error', text2: err.message }); },
  });

  const addContractorMutation = useMutation({
    mutationFn: (data: any) => apiAddContractor(data),
    onSuccess: (res) => {
      if (res.success && res.data) {
        Toast.show({ type: 'success', text1: 'Contractor Added', text2: `${res.data.contractor_name} added.` });
        queryClient.invalidateQueries({ queryKey: ['contractors'] });
        setContractorName(res.data.contractor_name);
        setShowContractorPicker(false);
        setNewContractorMode(false);
        setNewContractorName(''); setNewContractorMobile(''); setNewContractorArea('');
      } else {
        Toast.show({ type: 'error', text1: 'Error', text2: res.message });
      }
    },
    onError: (err: any) => { Toast.show({ type: 'error', text1: 'Error', text2: err.message }); },
  });

  const handleGetLocation = async () => {
    setLocationLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') { Alert.alert('Location Permission', 'Please allow location access to save the slab site.'); return; }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setLatitude(loc.coords.latitude);
      setLongitude(loc.coords.longitude);
      Toast.show({ type: 'success', text1: 'Location Saved', text2: `${loc.coords.latitude.toFixed(6)}, ${loc.coords.longitude.toFixed(6)}` });
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'Location Error', text2: 'Could not get location.' });
    } finally {
      setLocationLoading(false);
    }
  };

  const handleCreateNewDealer = () => {
    if (!newDealerName.trim()) { Toast.show({ type: 'error', text1: 'Missing', text2: 'Dealer name is required.' }); return; }
    addDealerMutation.mutate({ dealer_name: newDealerName.trim(), area: newDealerArea.trim(), phone: newDealerPhone.trim(), owner_name: newDealerOwner.trim(), assigned_te: user?.name || '', created_by: user?.name || '' });
  };

  const handleCreateNewContractor = () => {
    if (!newContractorName.trim()) { Toast.show({ type: 'error', text1: 'Missing', text2: 'Contractor name is required.' }); return; }
    addContractorMutation.mutate({ contractor_name: newContractorName.trim(), mobile: newContractorMobile.trim(), area: newContractorArea.trim(), assigned_te: user?.name || '' });
  };

  const handleSubmit = () => {
    if (!slabDate) { Toast.show({ type: 'error', text1: 'Missing', text2: 'Slab date is required.' }); return; }
    if (!selectedDealer) { Toast.show({ type: 'error', text1: 'Missing', text2: 'Please select a dealer.' }); return; }
    const combinedRemark = siteAddress ? `Address: ${siteAddress}${remark ? ' | ' + remark : ''}` : remark;
    createMutation.mutate({
      slab_date: slabDate, dealer_id: selectedDealer.dealer_id, dealer_name: selectedDealer.dealer_name,
      contractor_name: contractorName, customer_name: customerName, expected_cement: expectedCement,
      latitude, longitude, assigned_te: assignedTE, remark: combinedRemark, source: 'APP', created_by: user?.name || '',
    });
  };

  const filteredDealers = (dealers || []).filter(d => {
    const nameMatch = (d.dealer_name || '').toLowerCase().includes(dealerSearch.toLowerCase());
    const isNotInactive = d.active === undefined || d.active === null || String(d.active) === '' || String(d.active).toLowerCase() !== 'false';
    return nameMatch && isNotInactive;
  });
  const filteredContractors = (contractors || []).filter(c => (c.contractor_name || '').toLowerCase().includes(contractorSearch.toLowerCase()));

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}><Ionicons name="close" size={24} color={Colors.textPrimary} /></TouchableOpacity>
        <Text style={styles.title}>Schedule New Slab</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={styles.group}>
          <Text style={styles.label}>Slab Date <Text style={styles.required}>*</Text></Text>
          <TextInput style={styles.input} value={slabDate} onChangeText={setSlabDate} placeholder="YYYY-MM-DD" placeholderTextColor={Colors.textMuted} />
        </View>

        <View style={styles.group}>
          <View style={styles.labelRow}>
            <Text style={styles.label}>Dealer / Shop <Text style={styles.required}>*</Text></Text>
            <TouchableOpacity onPress={() => { setNewDealerMode(true); setShowDealerPicker(true); }}><Text style={styles.quickAddLink}>+ Add New Dealer</Text></TouchableOpacity>
          </View>
          <TouchableOpacity style={styles.pickerBtn} onPress={() => { setNewDealerMode(false); setShowDealerPicker(true); }}>
            <Text style={selectedDealer ? styles.pickerSelected : styles.pickerPlaceholder}>{selectedDealer ? `${selectedDealer.dealer_name} (${selectedDealer.area || 'Jajpur'})` : 'Select dealer...'}</Text>
            <Ionicons name="chevron-down" size={18} color={Colors.primary} />
          </TouchableOpacity>
        </View>

        <View style={styles.group}>
          <View style={styles.labelRow}>
            <Text style={styles.label}>Contractor</Text>
            <TouchableOpacity onPress={() => { setNewContractorMode(true); setShowContractorPicker(true); }}><Text style={styles.quickAddLink}>+ Add New Contractor</Text></TouchableOpacity>
          </View>
          <TouchableOpacity style={styles.pickerBtn} onPress={() => { setNewContractorMode(false); setShowContractorPicker(true); }}>
            <Text style={contractorName ? styles.pickerSelected : styles.pickerPlaceholder}>{contractorName || 'Select or add contractor...'}</Text>
            <Ionicons name="chevron-down" size={18} color={Colors.primary} />
          </TouchableOpacity>
        </View>

        <View style={styles.group}>
          <Text style={styles.label}>Customer / Site Name <Text style={styles.optional}>(Optional)</Text></Text>
          <TextInput style={styles.input} value={customerName} onChangeText={setCustomerName} placeholder="Customer or site name" placeholderTextColor={Colors.textMuted} />
        </View>

        <View style={styles.group}>
          <Text style={styles.label}>Site Address / Landmark</Text>
          <TextInput style={styles.input} value={siteAddress} onChangeText={setSiteAddress} placeholder="e.g. Near Market, Kuakhia, Jajpur" placeholderTextColor={Colors.textMuted} />
        </View>

        <View style={styles.group}>
          <Text style={styles.label}>Expected Cement</Text>
          <TextInput style={styles.input} value={expectedCement} onChangeText={setExpectedCement} placeholder="e.g. 50 bags, 2.5 MT" placeholderTextColor={Colors.textMuted} />
        </View>

        <View style={styles.group}>
          <Text style={styles.label}>GPS Location</Text>
          <TouchableOpacity style={[styles.locationBtn, (latitude && longitude) ? styles.locationBtnSaved : null]} onPress={handleGetLocation} disabled={locationLoading}>
            {locationLoading ? <ActivityIndicator size="small" color={Colors.primary} /> : <Ionicons name="location-outline" size={20} color={(latitude && longitude) ? Colors.success : Colors.primary} />}
            <Text style={[styles.locationBtnText, (latitude && longitude) ? { color: Colors.success } : null]}>
              {(latitude && longitude) ? `📍 GPS Saved: ${latitude.toFixed(5)}, ${longitude.toFixed(5)}` : 'Use Current Location'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.group}>
          <Text style={styles.label}>Remarks / Additional Notes</Text>
          <TextInput style={[styles.input, styles.textarea]} value={remark} onChangeText={setRemark} placeholder="Any extra info..." placeholderTextColor={Colors.textMuted} multiline numberOfLines={3} />
        </View>

        <TouchableOpacity style={[styles.submitBtn, createMutation.isPending && styles.submitBtnDisabled]} onPress={handleSubmit} disabled={createMutation.isPending} activeOpacity={0.85}>
          {createMutation.isPending ? <ActivityIndicator color={Colors.white} /> : <Text style={styles.submitBtnText}>Schedule Slab 🏗️</Text>}
        </TouchableOpacity>

        <View style={{ height: Spacing['5xl'] }} />
      </ScrollView>

      {/* DEALER MODAL */}
      <Modal visible={showDealerPicker} animationType="slide" transparent>
        <View style={pickerStyles.overlay}>
          <View style={pickerStyles.sheet}>
            <View style={pickerStyles.header}>
              <Text style={pickerStyles.title}>{newDealerMode ? 'Add New Dealer' : 'Select Dealer'}</Text>
              <TouchableOpacity onPress={() => setShowDealerPicker(false)}><Ionicons name="close" size={24} color={Colors.textPrimary} /></TouchableOpacity>
            </View>

            {newDealerMode ? (
              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                <View style={pickerStyles.formGroup}><Text style={pickerStyles.formLabel}>Dealer Name *</Text><TextInput style={pickerStyles.formInput} value={newDealerName} onChangeText={setNewDealerName} placeholder="e.g. Maa Mangala Store" placeholderTextColor={Colors.textMuted} /></View>
                <View style={pickerStyles.formGroup}><Text style={pickerStyles.formLabel}>Area / Town</Text><TextInput style={pickerStyles.formInput} value={newDealerArea} onChangeText={setNewDealerArea} placeholder="e.g. Kuakhia, Jajpur" placeholderTextColor={Colors.textMuted} /></View>
                <View style={pickerStyles.formGroup}><Text style={pickerStyles.formLabel}>Phone Number</Text><TextInput style={pickerStyles.formInput} value={newDealerPhone} onChangeText={setNewDealerPhone} placeholder="10-digit mobile" placeholderTextColor={Colors.textMuted} keyboardType="phone-pad" /></View>
                <View style={pickerStyles.formGroup}><Text style={pickerStyles.formLabel}>Owner Name</Text><TextInput style={pickerStyles.formInput} value={newDealerOwner} onChangeText={setNewDealerOwner} placeholder="Owner's full name" placeholderTextColor={Colors.textMuted} /></View>
                <TouchableOpacity style={pickerStyles.submitModalBtn} onPress={handleCreateNewDealer} disabled={addDealerMutation.isPending}>
                  {addDealerMutation.isPending ? <ActivityIndicator color={Colors.white} /> : <Text style={pickerStyles.submitModalBtnText}>Save Dealer</Text>}
                </TouchableOpacity>
                <TouchableOpacity style={pickerStyles.switchModeBtn} onPress={() => setNewDealerMode(false)}><Text style={pickerStyles.switchModeText}>‹ Back to Existing Dealers</Text></TouchableOpacity>
              </ScrollView>
            ) : (
              <>
                <TextInput style={pickerStyles.search} value={dealerSearch} onChangeText={setDealerSearch} placeholder="Search dealer by name..." placeholderTextColor={Colors.textMuted} />
                <TouchableOpacity style={pickerStyles.addNewPromptBtn} onPress={() => setNewDealerMode(true)}>
                  <Feather name="plus-circle" size={18} color={Colors.primary} style={{ marginRight: 8 }} />
                  <Text style={pickerStyles.addNewPromptText}>+ Add New Dealer</Text>
                </TouchableOpacity>
                <FlatList data={filteredDealers} keyExtractor={d => d.dealer_id} renderItem={({ item }) => (
                  <TouchableOpacity style={pickerStyles.item} onPress={() => { setSelectedDealer(item); setShowDealerPicker(false); }}>
                    <Text style={pickerStyles.itemName}>{item.dealer_name}</Text>
                    <Text style={pickerStyles.itemSub}>{item.area || 'Jajpur'} • {item.owner_name || 'Dealer'}</Text>
                  </TouchableOpacity>
                )} keyboardShouldPersistTaps="handled" />
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* CONTRACTOR MODAL */}
      <Modal visible={showContractorPicker} animationType="slide" transparent>
        <View style={pickerStyles.overlay}>
          <View style={pickerStyles.sheet}>
            <View style={pickerStyles.header}>
              <Text style={pickerStyles.title}>{newContractorMode ? 'Add New Contractor' : 'Select Contractor'}</Text>
              <TouchableOpacity onPress={() => setShowContractorPicker(false)}><Ionicons name="close" size={24} color={Colors.textPrimary} /></TouchableOpacity>
            </View>

            {newContractorMode ? (
              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                <View style={pickerStyles.formGroup}><Text style={pickerStyles.formLabel}>Contractor Name *</Text><TextInput style={pickerStyles.formInput} value={newContractorName} onChangeText={setNewContractorName} placeholder="e.g. Ramesh Kumar" placeholderTextColor={Colors.textMuted} /></View>
                <View style={pickerStyles.formGroup}><Text style={pickerStyles.formLabel}>Mobile Number</Text><TextInput style={pickerStyles.formInput} value={newContractorMobile} onChangeText={setNewContractorMobile} placeholder="10-digit mobile" placeholderTextColor={Colors.textMuted} keyboardType="phone-pad" /></View>
                <View style={pickerStyles.formGroup}><Text style={pickerStyles.formLabel}>Area / Village</Text><TextInput style={pickerStyles.formInput} value={newContractorArea} onChangeText={setNewContractorArea} placeholder="e.g. Jajpur Town" placeholderTextColor={Colors.textMuted} /></View>
                <TouchableOpacity style={pickerStyles.submitModalBtn} onPress={handleCreateNewContractor} disabled={addContractorMutation.isPending}>
                  {addContractorMutation.isPending ? <ActivityIndicator color={Colors.white} /> : <Text style={pickerStyles.submitModalBtnText}>Save Contractor</Text>}
                </TouchableOpacity>
                <TouchableOpacity style={pickerStyles.switchModeBtn} onPress={() => setNewContractorMode(false)}><Text style={pickerStyles.switchModeText}>‹ Back to Existing Contractors</Text></TouchableOpacity>
              </ScrollView>
            ) : (
              <>
                <TextInput style={pickerStyles.search} value={contractorSearch} onChangeText={setContractorSearch} placeholder="Search contractor..." placeholderTextColor={Colors.textMuted} />
                <TouchableOpacity style={pickerStyles.addNewPromptBtn} onPress={() => setNewContractorMode(true)}>
                  <Feather name="plus-circle" size={18} color={Colors.primary} style={{ marginRight: 8 }} />
                  <Text style={pickerStyles.addNewPromptText}>+ Add New Contractor</Text>
                </TouchableOpacity>
                <FlatList data={filteredContractors} keyExtractor={c => c.contractor_id} renderItem={({ item }) => (
                  <TouchableOpacity style={pickerStyles.item} onPress={() => { setContractorName(item.contractor_name); setShowContractorPicker(false); }}>
                    <Text style={pickerStyles.itemName}>{item.contractor_name}</Text>
                    <Text style={pickerStyles.itemSub}>{item.mobile || 'No mobile'} • {item.area || 'Jajpur'}</Text>
                  </TouchableOpacity>
                )} keyboardShouldPersistTaps="handled" />
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.lg, paddingTop: Platform.OS === 'ios' ? 60 : Spacing['2xl'], paddingBottom: Spacing.base, backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border },
  backBtn: { width: 40, alignItems: 'flex-start' },
  title: { fontFamily: FontFamily.displayBold, fontSize: FontSize.lg, color: Colors.textPrimary },
  scroll: { flex: 1, padding: Spacing.lg },
  group: { marginBottom: Spacing.lg },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.xs },
  label: { fontFamily: FontFamily.sansBold, fontSize: FontSize.sm, color: Colors.textPrimary, marginBottom: Spacing.xs },
  required: { color: Colors.error },
  optional: { fontFamily: FontFamily.sansRegular, color: Colors.textSecondary, fontSize: 11 },
  quickAddLink: { fontFamily: FontFamily.sansBold, fontSize: FontSize.xs, color: Colors.primary },
  input: { fontFamily: FontFamily.sansMedium, borderWidth: 1, borderColor: Colors.border, borderRadius: BorderRadius.lg, paddingHorizontal: Spacing.md, paddingVertical: 12, fontSize: FontSize.base, color: Colors.textPrimary, backgroundColor: Colors.surface },
  textarea: { height: 80, textAlignVertical: 'top' },
  pickerBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: Colors.border, borderRadius: BorderRadius.lg, paddingHorizontal: Spacing.md, paddingVertical: 14, backgroundColor: Colors.surface },
  pickerSelected: { fontFamily: FontFamily.sansBold, fontSize: FontSize.base, color: Colors.textPrimary, flex: 1 },
  pickerPlaceholder: { fontFamily: FontFamily.sansMedium, fontSize: FontSize.base, color: Colors.textMuted, flex: 1 },
  locationBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.border, borderRadius: BorderRadius.lg, paddingVertical: 14, backgroundColor: Colors.surface, gap: 8 },
  locationBtnSaved: { borderColor: Colors.success, backgroundColor: Colors.successLight },
  locationBtnText: { fontFamily: FontFamily.sansBold, fontSize: FontSize.sm, color: Colors.primary },
  submitBtn: { backgroundColor: Colors.primary, borderRadius: BorderRadius.xl, paddingVertical: Spacing.lg, alignItems: 'center', marginTop: Spacing.sm, shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6 },
  submitBtnDisabled: { opacity: 0.7 },
  submitBtnText: { fontFamily: FontFamily.sansBold, color: Colors.white, fontSize: FontSize.md, letterSpacing: 0.5 },
});

const pickerStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: Colors.overlay, justifyContent: 'flex-end' },
  sheet: { backgroundColor: Colors.surface, borderTopLeftRadius: BorderRadius['2xl'], borderTopRightRadius: BorderRadius['2xl'], padding: Spacing.xl, maxHeight: '85%' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.lg },
  title: { fontFamily: FontFamily.displayBold, fontSize: FontSize.lg, color: Colors.textPrimary },
  search: { fontFamily: FontFamily.sansMedium, borderWidth: 1, borderColor: Colors.border, borderRadius: BorderRadius.lg, paddingHorizontal: Spacing.md, paddingVertical: 12, fontSize: FontSize.base, color: Colors.textPrimary, marginBottom: Spacing.md, backgroundColor: Colors.background },
  addNewPromptBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.primaryLight, paddingVertical: 12, paddingHorizontal: Spacing.md, borderRadius: BorderRadius.lg, marginBottom: Spacing.md, borderWidth: 1, borderColor: Colors.borderLight },
  addNewPromptText: { fontFamily: FontFamily.sansBold, fontSize: FontSize.sm, color: Colors.primary },
  item: { paddingVertical: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  itemName: { fontFamily: FontFamily.sansBold, fontSize: FontSize.base, color: Colors.textPrimary },
  itemSub: { fontFamily: FontFamily.sansMedium, fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 4 },
  formGroup: { marginBottom: Spacing.md },
  formLabel: { fontFamily: FontFamily.sansBold, fontSize: FontSize.sm, color: Colors.textPrimary, marginBottom: Spacing.xs },
  formInput: { fontFamily: FontFamily.sansMedium, borderWidth: 1, borderColor: Colors.border, borderRadius: BorderRadius.lg, paddingHorizontal: Spacing.md, paddingVertical: 12, fontSize: FontSize.base, color: Colors.textPrimary, backgroundColor: Colors.background },
  submitModalBtn: { backgroundColor: Colors.primary, borderRadius: BorderRadius.xl, paddingVertical: 16, alignItems: 'center', marginTop: Spacing.sm },
  submitModalBtnText: { fontFamily: FontFamily.sansBold, color: Colors.white, fontSize: FontSize.base },
  switchModeBtn: { alignItems: 'center', marginTop: Spacing.lg, paddingVertical: Spacing.sm },
  switchModeText: { fontFamily: FontFamily.sansBold, fontSize: FontSize.sm, color: Colors.textSecondary },
});
