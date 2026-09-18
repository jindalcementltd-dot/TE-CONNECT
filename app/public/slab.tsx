import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ScrollView, ActivityIndicator, SafeAreaView, Alert,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import * as Location from 'expo-location';
import { Colors } from '../../src/theme/colors';
import { Spacing, BorderRadius } from '../../src/theme/spacing';
import { apiGetDealerByToken, apiPublicSlabSubmit } from '../../src/services/api';
import { currentDateISO } from '../../src/utils/helpers';
import { Ionicons } from '@expo/vector-icons';

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
      if (status !== 'granted') { Alert.alert('Location', 'Location permission needed.'); return; }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setLatitude(loc.coords.latitude);
      setLongitude(loc.coords.longitude);
    } catch { Alert.alert('Error', 'Could not get location.'); }
    finally { setLocationLoading(false); }
  };

  const handleSubmit = async () => {
    if (!slabDate) { Alert.alert('Missing', 'Slab date is required.'); return; }
    if (!params.dealer_id || !params.token) { Alert.alert('Error', 'Invalid dealer link.'); return; }
    setLoading(true);
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
        remark,
      });
      if (res.success) { setSubmitted(true); }
      else { Alert.alert('Error', res.message || 'Submission failed.'); }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Network error. Please try again.');
    } finally { setLoading(false); }
  };

  if (invalidLink) return (
    <SafeAreaView style={styles.center}>
      <Text style={styles.errorEmoji}>⚠️</Text>
      <Text style={styles.errorTitle}>Invalid Link</Text>
      <Text style={styles.errorSub}>This link is invalid or expired.{"\n"}Please contact your TE.</Text>
    </SafeAreaView>
  );

  if (submitted) return (
    <SafeAreaView style={styles.center}>
      <Text style={styles.successEmoji}>✅</Text>
      <Text style={styles.successTitle}>Slab Submitted!</Text>
      <Text style={styles.successSub}>Your team has been notified.{"\n"}Thank you!</Text>
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.logo}>🏗️ TE CONNECT</Text>
        <Text style={styles.subtitle}>Slab Casting Request</Text>
      </View>
      <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {dealerName && (
          <View style={styles.dealerBadge}>
            <Text style={styles.dealerLabel}>Dealer</Text>
            <Text style={styles.dealerName}>{dealerName}</Text>
          </View>
        )}
        <View style={styles.group}>
          <Text style={styles.label}>Slab Date *</Text>
          <TextInput style={styles.input} value={slabDate} onChangeText={setSlabDate} placeholder="YYYY-MM-DD" placeholderTextColor={Colors.textMuted} />
        </View>
        <View style={styles.group}>
          <Text style={styles.label}>Contractor Name</Text>
          <TextInput style={styles.input} value={contractorName} onChangeText={setContractorName} placeholder="Contractor name" placeholderTextColor={Colors.textMuted} />
        </View>
        <View style={styles.group}>
          <Text style={styles.label}>Customer / Site <Text style={styles.optional}>(Optional)</Text></Text>
          <TextInput style={styles.input} value={customerName} onChangeText={setCustomerName} placeholder="Customer or site" placeholderTextColor={Colors.textMuted} />
        </View>
        <View style={styles.group}>
          <Text style={styles.label}>Expected Cement</Text>
          <TextInput style={styles.input} value={expectedCement} onChangeText={setExpectedCement} placeholder="e.g. 50 bags" placeholderTextColor={Colors.textMuted} />
        </View>
        <View style={styles.group}>
          <Text style={styles.label}>Location</Text>
          <TouchableOpacity style={styles.locationBtn} onPress={handleGetLocation} disabled={locationLoading}>
            {locationLoading ? <ActivityIndicator size="small" color={Colors.primary} /> :
              <Ionicons name="location-outline" size={18} color={(latitude && longitude) ? Colors.success : Colors.primary} />}
            <Text style={[styles.locationText, (latitude && longitude) ? { color: Colors.success } : null]}>
              {(latitude && longitude) ? `📍 ${latitude.toFixed(5)}, ${longitude.toFixed(5)}` : 'Use Current Location'}
            </Text>
          </TouchableOpacity>
        </View>
        <View style={styles.group}>
          <Text style={styles.label}>Remark <Text style={styles.optional}>(Optional)</Text></Text>
          <TextInput style={[styles.input, styles.textarea]} value={remark} onChangeText={setRemark} placeholder="Any notes..." placeholderTextColor={Colors.textMuted} multiline />
        </View>
        <TouchableOpacity style={[styles.submitBtn, loading && styles.submitBtnDisabled]} onPress={handleSubmit} disabled={loading}>
          {loading ? <ActivityIndicator color={Colors.white} /> : <Text style={styles.submitText}>Submit Slab →</Text>}
        </TouchableOpacity>
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, backgroundColor: Colors.background, alignItems: 'center', justifyContent: 'center', padding: 32 },
  header: { alignItems: 'center', paddingTop: 24, paddingBottom: 16, backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.border },
  logo: { fontSize: 22, fontWeight: '800', color: Colors.primary, letterSpacing: 1 },
  subtitle: { fontSize: 13, color: Colors.textSecondary, marginTop: 4 },
  scroll: { flex: 1, padding: Spacing.base },
  dealerBadge: { backgroundColor: Colors.primaryLight, borderRadius: 14, padding: Spacing.base, alignItems: 'center', marginBottom: Spacing.base },
  dealerLabel: { fontSize: 11, color: Colors.primary, fontWeight: '600', letterSpacing: 0.5 },
  dealerName: { fontSize: 20, fontWeight: '800', color: Colors.primary, marginTop: 4 },
  group: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '600', color: Colors.textPrimary, marginBottom: 7 },
  optional: { color: Colors.textMuted, fontWeight: '400', fontSize: 11 },
  input: { borderWidth: 1.5, borderColor: Colors.border, borderRadius: BorderRadius.md, paddingHorizontal: 14, paddingVertical: 13, fontSize: 16, color: Colors.textPrimary, backgroundColor: Colors.white },
  textarea: { height: 80, textAlignVertical: 'top' },
  locationBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1.5, borderColor: Colors.primary, borderRadius: BorderRadius.md, padding: 13, backgroundColor: Colors.primaryMuted },
  locationText: { fontSize: 14, color: Colors.primary, fontWeight: '500', flex: 1 },
  submitBtn: { backgroundColor: Colors.primary, borderRadius: BorderRadius.lg, padding: 17, alignItems: 'center', shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5 },
  submitBtnDisabled: { opacity: 0.7 },
  submitText: { color: Colors.white, fontSize: 18, fontWeight: '700' },
  errorEmoji: { fontSize: 48, marginBottom: 12 },
  errorTitle: { fontSize: 22, fontWeight: '700', color: Colors.textPrimary, marginBottom: 8 },
  errorSub: { fontSize: 15, color: Colors.textSecondary, textAlign: 'center' },
  successEmoji: { fontSize: 56, marginBottom: 16 },
  successTitle: { fontSize: 24, fontWeight: '800', color: Colors.success, marginBottom: 8 },
  successSub: { fontSize: 16, color: Colors.textSecondary, textAlign: 'center' },
});
