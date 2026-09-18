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
import { apiGetDealers, apiGetContractors, apiCreateSlab, apiAddContractor } from '../../src/services/api';
import { getUser } from '../../src/services/auth';
import { currentDateISO } from '../../src/utils/helpers';
import { User, Dealer, Contractor } from '../../src/types';
import { Ionicons } from '@expo/vector-icons';

export default function AddSlabScreen() {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<User | null>(null);

  // Form state
  const [slabDate, setSlabDate] = useState(currentDateISO());
  const [selectedDealer, setSelectedDealer] = useState<Dealer | null>(null);
  const [contractorName, setContractorName] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [expectedCement, setExpectedCement] = useState('');
  const [remark, setRemark] = useState('');
  const [assignedTE, setAssignedTE] = useState('');
  const [latitude, setLatitude] = useState<number | undefined>();
  const [longitude, setLongitude] = useState<number | undefined>();
  const [locationLoading, setLocationLoading] = useState(false);
  const [showDealerPicker, setShowDealerPicker] = useState(false);
  const [showContractorPicker, setShowContractorPicker] = useState(false);
  const [newContractorMode, setNewContractorMode] = useState(false);
  const [dealerSearch, setDealerSearch] = useState('');
  const [contractorSearch, setContractorSearch] = useState('');

  useEffect(() => {
    getUser().then(u => {
      setUser(u);
      if (u) setAssignedTE(u.name);
    });
  }, []);

  const { data: dealers } = useQuery({ queryKey: ['dealers'], queryFn: apiGetDealers });
  const { data: contractors } = useQuery({ queryKey: ['contractors'], queryFn: apiGetContractors });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiCreateSlab(data),
    onSuccess: (res) => {
      if (res.success) {
        Toast.show({ type: 'success', text1: 'Slab Added', text2: 'Slab scheduled successfully.' });
        queryClient.invalidateQueries({ queryKey: ['slabs'] });
        router.back();
      } else {
        Toast.show({ type: 'error', text1: 'Error', text2: res.message });
      }
    },
    onError: (err: any) => {
      Toast.show({ type: 'error', text1: 'Error', text2: err.message || 'Failed to add slab.' });
    },
  });

  const handleGetLocation = async () => {
    setLocationLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Location Permission', 'Please allow location access to save the slab site.');
        return;
      }
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

  const handleSubmit = () => {
    if (!slabDate) { Toast.show({ type: 'error', text1: 'Missing', text2: 'Slab date is required.' }); return; }
    if (!selectedDealer) { Toast.show({ type: 'error', text1: 'Missing', text2: 'Please select a dealer.' }); return; }
    createMutation.mutate({
      slab_date: slabDate,
      dealer_id: selectedDealer.dealer_id,
      dealer_name: selectedDealer.dealer_name,
      contractor_name: contractorName,
      customer_name: customerName,
      expected_cement: expectedCement,
      latitude,
      longitude,
      assigned_te: assignedTE,
      remark,
      source: 'APP',
      created_by: user?.name || '',
    });
  };

  const filteredDealers = (dealers || []).filter(d =>
    d.dealer_name.toLowerCase().includes(dealerSearch.toLowerCase()) && d.active
  );

  const filteredContractors = (contractors || []).filter(c =>
    c.contractor_name.toLowerCase().includes(contractorSearch.toLowerCase())
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="close" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>Add Slab</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {/* Slab Date */}
        <View style={styles.group}>
          <Text style={styles.label}>Slab Date <Text style={styles.required}>*</Text></Text>
          <TextInput
            style={styles.input}
            value={slabDate}
            onChangeText={setSlabDate}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={Colors.textMuted}
          />
        </View>

        {/* Dealer */}
        <View style={styles.group}>
          <Text style={styles.label}>Dealer <Text style={styles.required}>*</Text></Text>
          <TouchableOpacity style={styles.pickerBtn} onPress={() => setShowDealerPicker(true)}>
            <Text style={selectedDealer ? styles.pickerSelected : styles.pickerPlaceholder}>
              {selectedDealer ? selectedDealer.dealer_name : 'Select dealer...'}
            </Text>
            <Ionicons name="chevron-down" size={16} color={Colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Contractor */}
        <View style={styles.group}>
          <Text style={styles.label}>Contractor</Text>
          <TouchableOpacity
            style={styles.pickerBtn}
            onPress={() => { setNewContractorMode(false); setShowContractorPicker(true); }}
          >
            <Text style={contractorName ? styles.pickerSelected : styles.pickerPlaceholder}>
              {contractorName || 'Select or add contractor...'}
            </Text>
            <Ionicons name="chevron-down" size={16} color={Colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Customer/Site */}
        <View style={styles.group}>
          <Text style={styles.label}>Customer / Site <Text style={styles.optional}>(Optional)</Text></Text>
          <TextInput
            style={styles.input}
            value={customerName}
            onChangeText={setCustomerName}
            placeholder="Customer or site name"
            placeholderTextColor={Colors.textMuted}
          />
        </View>

        {/* Expected Cement */}
        <View style={styles.group}>
          <Text style={styles.label}>Expected Cement</Text>
          <TextInput
            style={styles.input}
            value={expectedCement}
            onChangeText={setExpectedCement}
            placeholder="e.g. 50 bags, 2 MT"
            placeholderTextColor={Colors.textMuted}
          />
        </View>

        {/* Location */}
        <View style={styles.group}>
          <Text style={styles.label}>Site Location</Text>
          <TouchableOpacity
            style={[styles.locationBtn, (latitude && longitude) ? styles.locationBtnSaved : null]}
            onPress={handleGetLocation}
            disabled={locationLoading}
          >
            {locationLoading
              ? <ActivityIndicator size="small" color={Colors.primary} />
              : <Ionicons name="location-outline" size={18} color={(latitude && longitude) ? Colors.success : Colors.primary} />
            }
            <Text style={[styles.locationBtnText, (latitude && longitude) ? { color: Colors.success } : null]}>
              {(latitude && longitude)
                ? `📍 ${latitude.toFixed(5)}, ${longitude.toFixed(5)}`
                : 'Use Current Location'
              }
            </Text>
          </TouchableOpacity>
        </View>

        {/* Assigned TE */}
        <View style={styles.group}>
          <Text style={styles.label}>Assigned TE</Text>
          <TextInput
            style={styles.input}
            value={assignedTE}
            onChangeText={setAssignedTE}
            placeholder="TE name"
            placeholderTextColor={Colors.textMuted}
          />
        </View>

        {/* Remark */}
        <View style={styles.group}>
          <Text style={styles.label}>Remark <Text style={styles.optional}>(Optional)</Text></Text>
          <TextInput
            style={[styles.input, styles.textarea]}
            value={remark}
            onChangeText={setRemark}
            placeholder="Any notes..."
            placeholderTextColor={Colors.textMuted}
            multiline
            numberOfLines={3}
          />
        </View>

        {/* Submit */}
        <TouchableOpacity
          style={[styles.submitBtn, createMutation.isPending && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={createMutation.isPending}
        >
          {createMutation.isPending
            ? <ActivityIndicator color={Colors.white} />
            : <Text style={styles.submitText}>Add Slab 🏗️</Text>
          }
        </TouchableOpacity>
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Dealer Picker Modal */}
      <Modal visible={showDealerPicker} animationType="slide" transparent>
        <View style={pickerStyles.overlay}>
          <View style={pickerStyles.sheet}>
            <View style={pickerStyles.header}>
              <Text style={pickerStyles.title}>Select Dealer</Text>
              <TouchableOpacity onPress={() => setShowDealerPicker(false)}>
                <Ionicons name="close" size={22} color={Colors.textPrimary} />
              </TouchableOpacity>
            </View>
            <TextInput
              style={pickerStyles.search}
              value={dealerSearch}
              onChangeText={setDealerSearch}
              placeholder="Search dealer..."
              placeholderTextColor={Colors.textMuted}
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
                  <Text style={pickerStyles.itemSub}>{item.area}</Text>
                </TouchableOpacity>
              )}
              keyboardShouldPersistTaps="handled"
            />
          </View>
        </View>
      </Modal>

      {/* Contractor Picker Modal */}
      <Modal visible={showContractorPicker} animationType="slide" transparent>
        <View style={pickerStyles.overlay}>
          <View style={pickerStyles.sheet}>
            <View style={pickerStyles.header}>
              <Text style={pickerStyles.title}>Select Contractor</Text>
              <TouchableOpacity onPress={() => setShowContractorPicker(false)}>
                <Ionicons name="close" size={22} color={Colors.textPrimary} />
              </TouchableOpacity>
            </View>
            {!newContractorMode ? (
              <>
                <TextInput
                  style={pickerStyles.search}
                  value={contractorSearch}
                  onChangeText={setContractorSearch}
                  placeholder="Search contractor..."
                  placeholderTextColor={Colors.textMuted}
                />
                <TouchableOpacity
                  style={pickerStyles.addNewBtn}
                  onPress={() => setNewContractorMode(true)}
                >
                  <Ionicons name="add-circle-outline" size={18} color={Colors.primary} />
                  <Text style={pickerStyles.addNewText}>Add New Contractor</Text>
                </TouchableOpacity>
                <FlatList
                  data={filteredContractors}
                  keyExtractor={c => c.contractor_id}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={pickerStyles.item}
                      onPress={() => { setContractorName(item.contractor_name); setShowContractorPicker(false); }}
                    >
                      <Text style={pickerStyles.itemName}>{item.contractor_name}</Text>
                      <Text style={pickerStyles.itemSub}>{item.area} · {item.mobile}</Text>
                    </TouchableOpacity>
                  )}
                  keyboardShouldPersistTaps="handled"
                />
              </>
            ) : (
              <View style={pickerStyles.newContractorForm}>
                <Text style={pickerStyles.newTitle}>Add New Contractor</Text>
                <TextInput
                  style={pickerStyles.search}
                  value={contractorSearch}
                  onChangeText={setContractorSearch}
                  placeholder="Contractor name *"
                  placeholderTextColor={Colors.textMuted}
                />
                <TouchableOpacity
                  style={pickerStyles.saveBtn}
                  onPress={() => {
                    if (contractorSearch.trim()) {
                      setContractorName(contractorSearch.trim());
                      setShowContractorPicker(false);
                      setNewContractorMode(false);
                      setContractorSearch('');
                    }
                  }}
                >
                  <Text style={pickerStyles.saveBtnText}>Use This Name</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={pickerStyles.cancelBtn}
                  onPress={() => setNewContractorMode(false)}
                >
                  <Text style={pickerStyles.cancelBtnText}>← Back to List</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.base,
    paddingTop: Platform.OS === 'ios' ? 56 : 36,
    paddingBottom: 16,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backBtn: { width: 40, alignItems: 'flex-start' },
  title: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary },
  scroll: { flex: 1, padding: Spacing.base },
  group: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '600', color: Colors.textPrimary, marginBottom: 7 },
  required: { color: Colors.error },
  optional: { color: Colors.textMuted, fontWeight: '400', fontSize: 11 },
  input: {
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: Colors.textPrimary,
    backgroundColor: Colors.white,
  },
  textarea: { height: 80, textAlignVertical: 'top' },
  pickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    paddingHorizontal: 14,
    paddingVertical: 13,
    backgroundColor: Colors.white,
  },
  pickerSelected: { fontSize: 15, color: Colors.textPrimary, flex: 1 },
  pickerPlaceholder: { fontSize: 15, color: Colors.textMuted, flex: 1 },
  locationBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    borderRadius: BorderRadius.md,
    padding: 13,
    backgroundColor: Colors.primaryMuted,
  },
  locationBtnSaved: { borderColor: Colors.success, backgroundColor: Colors.successLight },
  locationBtnText: { fontSize: 14, color: Colors.primary, fontWeight: '500', flex: 1 },
  submitBtn: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.lg,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  submitBtnDisabled: { opacity: 0.7 },
  submitText: { color: Colors.white, fontSize: 17, fontWeight: '700' },
});

const pickerStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '80%',
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  title: { fontSize: 17, fontWeight: '700', color: Colors.textPrimary },
  search: {
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  item: {
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  itemName: { fontSize: 15, fontWeight: '600', color: Colors.textPrimary },
  itemSub: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  addNewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    marginBottom: 4,
  },
  addNewText: { color: Colors.primary, fontWeight: '600', fontSize: 14 },
  newContractorForm: { paddingTop: 8 },
  newTitle: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary, marginBottom: 12 },
  saveBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    marginBottom: 10,
  },
  saveBtnText: { color: Colors.white, fontWeight: '700', fontSize: 15 },
  cancelBtn: { alignItems: 'center', padding: 10 },
  cancelBtnText: { color: Colors.textSecondary, fontSize: 14 },
});
