import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ScrollView, ActivityIndicator, SafeAreaView, Alert, Platform,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import * as Location from 'expo-location';
import { apiGetDealerByToken, apiPublicSlabSubmit } from '../../src/services/api';
import { currentDateISO } from '../../src/utils/helpers';
import { Ionicons, MaterialCommunityIcons, Feather } from '@expo/vector-icons';

export default function PublicSlabPage() {
  const params = useLocalSearchParams<{ dealer_id?: string; token?: string }>();
  const [dealerName, setDealerName] = useState<string | null>(null);
  const [invalidLink, setInvalidLink] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);

  const [slabDate, setSlabDate] = useState(currentDateISO());
  const [contractorName, setContractorName] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [siteAddress, setSiteAddress] = useState('');
  const [expectedCement, setExpectedCement] = useState('');
  const [remark, setRemark] = useState('');
  const [latitude, setLatitude] = useState<number | undefined>();
  const [longitude, setLongitude] = useState<number | undefined>();

  useEffect(() => {
    if (params.dealer_id && params.token) {
      apiGetDealerByToken(params.dealer_id, params.token)
        .then(d => setDealerName(d.dealer_name))
        .catch(() => setInvalidLink(true));
    }
  }, [params.dealer_id, params.token]);

  const handleGetLocation = async () => {
    setLocationLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') { Alert.alert('Location Permission', 'Location permission is required to save site GPS.'); return; }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setLatitude(loc.coords.latitude);
      setLongitude(loc.coords.longitude);
    } catch { Alert.alert('Error', 'Could not obtain GPS location.'); }
    finally { setLocationLoading(false); }
  };

  const handleSubmit = async () => {
    if (!slabDate) { Alert.alert('Missing Date', 'Slab date is required.'); return; }
    if (!params.dealer_id || !params.token) { Alert.alert('Error', 'Invalid dealer link.'); return; }
    setLoading(true);

    const combinedRemark = siteAddress
      ? `Address: ${siteAddress}${remark ? ' | ' + remark : ''}`
      : remark;

    try {
      const res = await apiPublicSlabSubmit({
        dealer_id: params.dealer_id!,
        dealer_name: dealerName || '',
        token: params.token!,
        slab_date: slabDate,
        contractor_name: contractorName,
        customer_name: customerName,
        expected_cement: expectedCement,
        latitude,
        longitude,
        remark: combinedRemark,
      });
      if (res.success) { setSubmitted(true); }
      else { Alert.alert('Error', res.message || 'Submission failed.'); }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Network error. Please try again.');
    } finally { setLoading(false); }
  };

  if (invalidLink) return (
    <SafeAreaView style={styles.center}>
      <View style={[styles.statusIconCircle, { backgroundColor: '#FEE2E2' }]}>
        <MaterialCommunityIcons name="alert-circle-outline" size={48} color="#DC2626" />
      </View>
      <Text style={styles.errorTitle}>Invalid Link</Text>
      <Text style={styles.errorSub}>This link is invalid or expired.{"\n"}Please contact your Territory Executive.</Text>
    </SafeAreaView>
  );

  if (submitted) return (
    <SafeAreaView style={styles.center}>
      <View style={[styles.statusIconCircle, { backgroundColor: '#DCFCE7' }]}>
        <MaterialCommunityIcons name="check-decagram" size={54} color="#15803D" />
      </View>
      <Text style={styles.successTitle}>Slab Casting Submitted!</Text>
      <Text style={styles.successSub}>Thank you! Team Jajpur has been notified and your schedule has been added directly to Google Sheets.</Text>
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.brandRow}>
          <Text style={styles.appNameTE}>TE </Text>
          <Text style={styles.appNameCONNECT}>CONNECT</Text>
        </View>
        <Text style={styles.subtitle}>Slab Casting Direct Request</Text>
      </View>

      <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {dealerName && (
          <View style={styles.dealerBadge}>
            <Text style={styles.dealerLabel}>AUTHORIZED COUNTER</Text>
            <Text style={styles.dealerName}>{dealerName}</Text>
          </View>
        )}

        <View style={styles.formCard}>
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

          <View style={styles.group}>
            <Text style={styles.label}>Contractor Name</Text>
            <TextInput
              style={styles.input}
              value={contractorName}
              onChangeText={setContractorName}
              placeholder="Contractor name"
              placeholderTextColor="#A0858C"
            />
          </View>

          <View style={styles.group}>
            <Text style={styles.label}>Customer / Site Name <Text style={styles.optional}>(Optional)</Text></Text>
            <TextInput
              style={styles.input}
              value={customerName}
              onChangeText={setCustomerName}
              placeholder="Customer name or site"
              placeholderTextColor="#A0858C"
            />
          </View>

          <View style={styles.group}>
            <Text style={styles.label}>Site Address / Landmark</Text>
            <TextInput
              style={styles.input}
              value={siteAddress}
              onChangeText={setSiteAddress}
              placeholder="e.g. Near Bus Stand, Kuakhia"
              placeholderTextColor="#A0858C"
            />
          </View>

          <View style={styles.group}>
            <Text style={styles.label}>Expected Cement (Bags)</Text>
            <TextInput
              style={styles.input}
              value={expectedCement}
              onChangeText={setExpectedCement}
              placeholder="e.g. 50 bags"
              placeholderTextColor="#A0858C"
            />
          </View>

          <View style={styles.group}>
            <Text style={styles.label}>Site GPS Location</Text>
            <TouchableOpacity
              style={[styles.locationBtn, (latitude && longitude) ? styles.locationBtnSaved : null]}
              onPress={handleGetLocation}
              disabled={locationLoading}
              activeOpacity={0.85}
            >
              {locationLoading ? (
                <ActivityIndicator size="small" color="#800E20" />
              ) : (
                <Ionicons
                  name="location-outline"
                  size={20}
                  color={(latitude && longitude) ? '#15803D' : '#800E20'}
                />
              )}
              <Text style={[styles.locationText, (latitude && longitude) ? { color: '#15803D' } : null]}>
                {(latitude && longitude) ? `📍 GPS Logged: ${latitude.toFixed(5)}, ${longitude.toFixed(5)}` : 'Tag Current Location (GPS)'}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.group}>
            <Text style={styles.label}>Remarks / Additional Instructions</Text>
            <TextInput
              style={[styles.input, styles.textarea]}
              value={remark}
              onChangeText={setRemark}
              placeholder="Any notes for the engineer..."
              placeholderTextColor="#A0858C"
              multiline
              numberOfLines={3}
            />
          </View>

          <TouchableOpacity
            style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.submitText}>Submit Slab Casting Request 🏗️</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={{ height: 60 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9F5F6',
  },
  center: {
    flex: 1,
    backgroundColor: '#F9F5F6',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  statusIconCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  header: {
    alignItems: 'center',
    paddingTop: 24,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F0E2E5',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  appNameTE: {
    fontSize: 24,
    fontWeight: '900',
    color: '#1F0B10',
    letterSpacing: 1,
  },
  appNameCONNECT: {
    fontSize: 24,
    fontWeight: '900',
    color: '#800E20',
    letterSpacing: 1,
  },
  subtitle: {
    fontSize: 13,
    color: '#8A7277',
    marginTop: 4,
    fontWeight: '600',
  },
  scroll: {
    flex: 1,
    padding: 16,
  },
  dealerBadge: {
    backgroundColor: '#4A0611',
    borderRadius: 20,
    padding: 18,
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#4A0611',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 5,
  },
  dealerLabel: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '800',
    letterSpacing: 1,
  },
  dealerName: {
    fontSize: 20,
    fontWeight: '900',
    color: '#FFFFFF',
    marginTop: 4,
  },
  formCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1.5,
    borderColor: '#EEDCE1',
    shadowColor: 'rgba(78, 5, 17, 0.06)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 10,
    elevation: 3,
  },
  group: {
    marginBottom: 16,
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
  input: {
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
  textarea: {
    height: 76,
    textAlignVertical: 'top',
  },
  locationBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderColor: '#EEDCE1',
    borderRadius: 14,
    padding: 13,
    backgroundColor: '#FAF6F7',
  },
  locationBtnSaved: {
    borderColor: '#15803D',
    backgroundColor: '#DCFCE7',
  },
  locationText: {
    fontSize: 14,
    color: '#800E20',
    fontWeight: '700',
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
  submitText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  errorTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1F0B10',
    marginBottom: 8,
  },
  errorSub: {
    fontSize: 14,
    color: '#8A7277',
    textAlign: 'center',
    lineHeight: 20,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: '#15803D',
    marginBottom: 8,
    textAlign: 'center',
  },
  successSub: {
    fontSize: 14,
    color: '#6B4E55',
    textAlign: 'center',
    lineHeight: 20,
  },
});

