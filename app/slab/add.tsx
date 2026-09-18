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
import {
  apiGetDealers, apiGetContractors, apiCreateSlab,
  apiAddContractor, apiAddDealer
} from '../../src/services/api';
import { getUser } from '../../src/services/auth';
import { currentDateISO } from '../../src/utils/helpers';
import { User, Dealer, Contractor } from '../../src/types';
import { Ionicons, MaterialCommunityIcons, Feather } from '@expo/vector-icons';

export default function AddSlabScreen() {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<User | null>(null);

  // Form state
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

  // Picker & New Modals
  const [showDealerPicker, setShowDealerPicker] = useState(false);
  const [showContractorPicker, setShowContractorPicker] = useState(false);
  const [newDealerMode, setNewDealerMode] = useState(false);
  const [newContractorMode, setNewContractorMode] = useState(false);

  // New Dealer fields
  const [newDealerName, setNewDealerName] = useState('');
  const [newDealerArea, setNewDealerArea] = useState('');
  const [newDealerPhone, setNewDealerPhone] = useState('');
  const [newDealerOwner, setNewDealerOwner] = useState('');

  // New Contractor fields
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

  const { data: dealers } = useQuery({ queryKey: ['dealers'], queryFn: apiGetDealers });
  const { data: contractors } = useQuery({ queryKey: ['contractors'], queryFn: apiGetContractors });

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
        setNewDealerName('');
        setNewDealerArea('');
        setNewDealerPhone('');
        setNewDealerOwner('');
      } else {
        Toast.show({ type: 'error', text1: 'Error', text2: res.message });
      }
    },
    onError: (err: any) => {
      Toast.show({ type: 'error', text1: 'Error', text2: err.message });
    },
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
        setNewContractorName('');
        setNewContractorMobile('');
        setNewContractorArea('');
      } else {
        Toast.show({ type: 'error', text1: 'Error', text2: res.message });
      }
    },
    onError: (err: any) => {
      Toast.show({ type: 'error', text1: 'Error', text2: err.message });
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

  const handleCreateNewDealer = () => {
    if (!newDealerName.trim()) {
      Toast.show({ type: 'error', text1: 'Missing', text2: 'Dealer name is required.' });
      return;
    }
    addDealerMutation.mutate({
      dealer_name: newDealerName.trim(),
      area: newDealerArea.trim(),
      phone: newDealerPhone.trim(),
      owner_name: newDealerOwner.trim(),
      assigned_te: user?.name || '',
      created_by: user?.name || '',
    });
  };

  const handleCreateNewContractor = () => {
    if (!newContractorName.trim()) {
      Toast.show({ type: 'error', text1: 'Missing', text2: 'Contractor name is required.' });
      return;
    }
    addContractorMutation.mutate({
      contractor_name: newContractorName.trim(),
      mobile: newContractorMobile.trim(),
      area: newContractorArea.trim(),
      assigned_te: user?.name || '',
    });
  };

  const handleSubmit = () => {
    if (!slabDate) { Toast.show({ type: 'error', text1: 'Missing', text2: 'Slab date is required.' }); return; }
    if (!selectedDealer) { Toast.show({ type: 'error', text1: 'Missing', text2: 'Please select a dealer.' }); return; }
    
    // Combine site address with remarks if provided
    const combinedRemark = siteAddress
      ? `Address: ${siteAddress}${remark ? ' | ' + remark : ''}`
      : remark;

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
      remark: combinedRemark,
      source: 'APP',
      created_by: user?.name || '',
    });
  };

  const filteredDealers = (dealers || []).filter(d => {
    const nameMatch = (d.dealer_name || '').toLowerCase().includes(dealerSearch.toLowerCase());
    const isNotInactive = d.active === undefined || d.active === null || d.active === '' || String(d.active).toLowerCase() !== 'false';
    return nameMatch && isNotInactive;
  });

  const filteredContractors = (contractors || []).filter(c =>
    (c.contractor_name || '').toLowerCase().includes(contractorSearch.toLowerCase())
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="close" size={24} color="#1F0B10" />
        </TouchableOpacity>
        <Text style={styles.title}>Schedule New Slab</Text>
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
            placeholderTextColor="#A0858C"
          />
        </View>

        {/* Dealer Picker & Quick Add */}
        <View style={styles.group}>
          <View style={styles.labelRow}>
            <Text style={styles.label}>Dealer / Shop <Text style={styles.required}>*</Text></Text>
            <TouchableOpacity onPress={() => { setNewDealerMode(true); setShowDealerPicker(true); }}>
              <Text style={styles.quickAddLink}>+ Add New Dealer</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={styles.pickerBtn} onPress={() => { setNewDealerMode(false); setShowDealerPicker(true); }}>
            <Text style={selectedDealer ? styles.pickerSelected : styles.pickerPlaceholder}>
              {selectedDealer ? `${selectedDealer.dealer_name} (${selectedDealer.area || 'Jajpur'})` : 'Select dealer...'}
            </Text>
            <Ionicons name="chevron-down" size={18} color="#800E20" />
          </TouchableOpacity>
        </View>

        {/* Contractor Picker & Quick Add */}
        <View style={styles.group}>
          <View style={styles.labelRow}>
            <Text style={styles.label}>Contractor</Text>
            <TouchableOpacity onPress={() => { setNewContractorMode(true); setShowContractorPicker(true); }}>
              <Text style={styles.quickAddLink}>+ Add New Contractor</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={styles.pickerBtn}
            onPress={() => { setNewContractorMode(false); setShowContractorPicker(true); }}
          >
            <Text style={contractorName ? styles.pickerSelected : styles.pickerPlaceholder}>
              {contractorName || 'Select or add contractor...'}
            </Text>
            <Ionicons name="chevron-down" size={18} color="#800E20" />
          </TouchableOpacity>
        </View>

        {/* Customer / Site Name */}
        <View style={styles.group}>
          <Text style={styles.label}>Customer / Site Name <Text style={styles.optional}>(Optional)</Text></Text>
          <TextInput
            style={styles.input}
            value={customerName}
            onChangeText={setCustomerName}
            placeholder="Customer or site name"
            placeholderTextColor="#A0858C"
          />
        </View>

        {/* Site Address / Landmark */}
        <View style={styles.group}>
          <Text style={styles.label}>Site Address / Landmark</Text>
          <TextInput
            style={styles.input}
            value={siteAddress}
            onChangeText={setSiteAddress}
            placeholder="e.g. Near Market, Kuakhia, Jajpur"
            placeholderTextColor="#A0858C"
          />
        </View>

        {/* Expected Cement */}
        <View style={styles.group}>
          <Text style={styles.label}>Expected Cement</Text>
          <TextInput
            style={styles.input}
            value={expectedCement}
            onChangeText={setExpectedCement}
            placeholder="e.g. 50 bags, 2.5 MT"
            placeholderTextColor="#A0858C"
          />
        </View>

        {/* GPS Location */}
        <View style={styles.group}>
          <Text style={styles.label}>GPS Location</Text>
          <TouchableOpacity
            style={[styles.locationBtn, (latitude && longitude) ? styles.locationBtnSaved : null]}
            onPress={handleGetLocation}
            disabled={locationLoading}
          >
            {locationLoading
              ? <ActivityIndicator size="small" color="#800E20" />
              : <Ionicons name="location-outline" size={20} color={(latitude && longitude) ? '#16A34A' : '#800E20'} />
            }
            <Text style={[styles.locationBtnText, (latitude && longitude) ? { color: '#16A34A' } : null]}>
              {(latitude && longitude)
                ? `📍 GPS Saved: ${latitude.toFixed(5)}, ${longitude.toFixed(5)}`
                : 'Use Current Location'
              }
            </Text>
          </TouchableOpacity>
        </View>

        {/* Remarks / Notes */}
        <View style={styles.group}>
          <Text style={styles.label}>Remarks / Additional Notes</Text>
          <TextInput
            style={[styles.input, styles.textarea]}
            value={remark}
            onChangeText={setRemark}
            placeholder="Any extra info..."
            placeholderTextColor="#A0858C"
            multiline
            numberOfLines={3}
          />
        </View>

        {/* Submit Button */}
        <TouchableOpacity
          style={[styles.submitBtn, createMutation.isPending && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={createMutation.isPending}
          activeOpacity={0.85}
        >
          {createMutation.isPending ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.submitBtnText}>Schedule Slab 🏗️</Text>
          )}
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ── DEALER PICKER / ADD MODAL ── */}
      <Modal visible={showDealerPicker} animationType="slide" transparent>
        <View style={pickerStyles.overlay}>
          <View style={pickerStyles.sheet}>
            <View style={pickerStyles.header}>
              <Text style={pickerStyles.title}>{newDealerMode ? 'Add New Dealer' : 'Select Dealer'}</Text>
              <TouchableOpacity onPress={() => setShowDealerPicker(false)}>
                <Ionicons name="close" size={22} color="#1F0B10" />
              </TouchableOpacity>
            </View>

            {newDealerMode ? (
              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                <View style={pickerStyles.formGroup}>
                  <Text style={pickerStyles.formLabel}>Dealer Name *</Text>
                  <TextInput
                    style={pickerStyles.formInput}
                    value={newDealerName}
                    onChangeText={setNewDealerName}
                    placeholder="e.g. Maa Mangala Store"
                    placeholderTextColor="#A0858C"
                  />
                </View>

                <View style={pickerStyles.formGroup}>
                  <Text style={pickerStyles.formLabel}>Area / Town</Text>
                  <TextInput
                    style={pickerStyles.formInput}
                    value={newDealerArea}
                    onChangeText={setNewDealerArea}
                    placeholder="e.g. Kuakhia, Jajpur"
                    placeholderTextColor="#A0858C"
                  />
                </View>

                <View style={pickerStyles.formGroup}>
                  <Text style={pickerStyles.formLabel}>Phone Number</Text>
                  <TextInput
                    style={pickerStyles.formInput}
                    value={newDealerPhone}
                    onChangeText={setNewDealerPhone}
                    placeholder="10-digit mobile"
                    placeholderTextColor="#A0858C"
                    keyboardType="phone-pad"
                  />
                </View>

                <View style={pickerStyles.formGroup}>
                  <Text style={pickerStyles.formLabel}>Owner Name</Text>
                  <TextInput
                    style={pickerStyles.formInput}
                    value={newDealerOwner}
                    onChangeText={setNewDealerOwner}
                    placeholder="Owner's full name"
                    placeholderTextColor="#A0858C"
                  />
                </View>

                <TouchableOpacity
                  style={pickerStyles.submitModalBtn}
                  onPress={handleCreateNewDealer}
                  disabled={addDealerMutation.isPending}
                >
                  {addDealerMutation.isPending ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={pickerStyles.submitModalBtnText}>Save Dealer to Google Sheet</Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={pickerStyles.switchModeBtn}
                  onPress={() => setNewDealerMode(false)}
                >
                  <Text style={pickerStyles.switchModeText}>‹ Back to Existing Dealers</Text>
                </TouchableOpacity>
              </ScrollView>
            ) : (
              <>
                <TextInput
                  style={pickerStyles.search}
                  value={dealerSearch}
                  onChangeText={setDealerSearch}
                  placeholder="Search dealer by name..."
                  placeholderTextColor="#A0858C"
                />

                <TouchableOpacity
                  style={pickerStyles.addNewPromptBtn}
                  onPress={() => setNewDealerMode(true)}
                >
                  <Feather name="plus-circle" size={18} color="#800E20" style={{ marginRight: 8 }} />
                  <Text style={pickerStyles.addNewPromptText}>+ Add New Dealer</Text>
                </TouchableOpacity>

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
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* ── CONTRACTOR PICKER / ADD MODAL ── */}
      <Modal visible={showContractorPicker} animationType="slide" transparent>
        <View style={pickerStyles.overlay}>
          <View style={pickerStyles.sheet}>
            <View style={pickerStyles.header}>
              <Text style={pickerStyles.title}>{newContractorMode ? 'Add New Contractor' : 'Select Contractor'}</Text>
              <TouchableOpacity onPress={() => setShowContractorPicker(false)}>
                <Ionicons name="close" size={22} color="#1F0B10" />
              </TouchableOpacity>
            </View>

            {newContractorMode ? (
              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                <View style={pickerStyles.formGroup}>
                  <Text style={pickerStyles.formLabel}>Contractor Name *</Text>
                  <TextInput
                    style={pickerStyles.formInput}
                    value={newContractorName}
                    onChangeText={setNewContractorName}
                    placeholder="e.g. Ramesh Kumar"
                    placeholderTextColor="#A0858C"
                  />
                </View>

                <View style={pickerStyles.formGroup}>
                  <Text style={pickerStyles.formLabel}>Mobile Number</Text>
                  <TextInput
                    style={pickerStyles.formInput}
                    value={newContractorMobile}
                    onChangeText={setNewContractorMobile}
                    placeholder="10-digit mobile"
                    placeholderTextColor="#A0858C"
                    keyboardType="phone-pad"
                  />
                </View>

                <View style={pickerStyles.formGroup}>
                  <Text style={pickerStyles.formLabel}>Area / Village</Text>
                  <TextInput
                    style={pickerStyles.formInput}
                    value={newContractorArea}
                    onChangeText={setNewContractorArea}
                    placeholder="e.g. Jajpur Town"
                    placeholderTextColor="#A0858C"
                  />
                </View>

                <TouchableOpacity
                  style={pickerStyles.submitModalBtn}
                  onPress={handleCreateNewContractor}
                  disabled={addContractorMutation.isPending}
                >
                  {addContractorMutation.isPending ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={pickerStyles.submitModalBtnText}>Save Contractor to Google Sheet</Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={pickerStyles.switchModeBtn}
                  onPress={() => setNewContractorMode(false)}
                >
                  <Text style={pickerStyles.switchModeText}>‹ Back to Existing Contractors</Text>
                </TouchableOpacity>
              </ScrollView>
            ) : (
              <>
                <TextInput
                  style={pickerStyles.search}
                  value={contractorSearch}
                  onChangeText={setContractorSearch}
                  placeholder="Search contractor..."
                  placeholderTextColor="#A0858C"
                />

                <TouchableOpacity
                  style={pickerStyles.addNewPromptBtn}
                  onPress={() => setNewContractorMode(true)}
                >
                  <Feather name="plus-circle" size={18} color="#800E20" style={{ marginRight: 8 }} />
                  <Text style={pickerStyles.addNewPromptText}>+ Add New Contractor</Text>
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
                      <Text style={pickerStyles.itemSub}>{item.mobile || 'No mobile'} • {item.area || 'Jajpur'}</Text>
                    </TouchableOpacity>
                  )}
                  keyboardShouldPersistTaps="handled"
                />
              </>
            )}
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
    paddingTop: Platform.OS === 'ios' ? 56 : 36,
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
    fontSize: 18,
    fontWeight: '800',
    color: '#1F0B10',
  },
  scroll: {
    flex: 1,
    padding: 16,
  },
  group: {
    marginBottom: 16,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1F0B10',
    marginBottom: 6,
  },
  required: {
    color: '#DC2626',
  },
  optional: {
    color: '#8A7277',
    fontWeight: '400',
    fontSize: 11,
  },
  quickAddLink: {
    fontSize: 12,
    fontWeight: '700',
    color: '#800E20',
  },
  input: {
    borderWidth: 1.5,
    borderColor: '#EEDCE1',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#1F0B10',
    backgroundColor: '#FFFFFF',
    fontWeight: '500',
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
    backgroundColor: '#FFFFFF',
  },
  pickerSelected: {
    fontSize: 15,
    color: '#1F0B10',
    fontWeight: '600',
    flex: 1,
  },
  pickerPlaceholder: {
    fontSize: 15,
    color: '#A0858C',
    flex: 1,
  },
  locationBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#EEDCE1',
    borderRadius: 14,
    paddingVertical: 13,
    backgroundColor: '#FFFFFF',
    gap: 8,
  },
  locationBtnSaved: {
    borderColor: '#16A34A',
    backgroundColor: '#DCFCE7',
  },
  locationBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#800E20',
  },
  submitBtn: {
    backgroundColor: '#800E20',
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 10,
    shadowColor: '#800E20',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  submitBtnDisabled: {
    opacity: 0.7,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
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
    maxHeight: '85%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1F0B10',
  },
  search: {
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
  addNewPromptBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FBE8EC',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E8D5DA',
  },
  addNewPromptText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#800E20',
  },
  item: {
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: '#F7EFF1',
  },
  itemName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1F0B10',
  },
  itemSub: {
    fontSize: 12,
    color: '#8A7277',
    marginTop: 2,
  },
  formGroup: {
    marginBottom: 12,
  },
  formLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1F0B10',
    marginBottom: 4,
  },
  formInput: {
    borderWidth: 1.5,
    borderColor: '#EEDCE1',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#1F0B10',
    backgroundColor: '#FAF6F7',
  },
  submitModalBtn: {
    backgroundColor: '#800E20',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 10,
  },
  submitModalBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  switchModeBtn: {
    alignItems: 'center',
    paddingVertical: 12,
    marginTop: 6,
  },
  switchModeText: {
    color: '#800E20',
    fontSize: 13,
    fontWeight: '700',
  },
});
