import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { router } from 'expo-router';
import * as Location from 'expo-location';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { Colors } from '../../src/theme/colors';
import { FontFamily, FontSize } from '../../src/theme/typography';
import { Spacing } from '../../src/theme/spacing';
import Toast from 'react-native-toast-message';
import { apiAddDealer } from '../../src/services/api';
import { getUser } from '../../src/services/auth';

export default function AddDealerScreen() {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [user, setUser] = useState<any>(null);

  const [form, setForm] = useState({
    dealer_name: '',
    sap_code: '',
    owner_name: '',
    phone: '',
    area: '',
    address: '',
  });

  const [latitude, setLatitude] = useState<number | undefined>();
  const [longitude, setLongitude] = useState<number | undefined>();

  useEffect(() => {
    getUser().then(setUser);
  }, []);

  const handleGetLocation = async () => {
    setLocationLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Location Permission Required',
          'Please allow location access to capture this counter’s exact GPS coordinates for Google Maps directions.'
        );
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setLatitude(loc.coords.latitude);
      setLongitude(loc.coords.longitude);
      Toast.show({
        type: 'success',
        text1: 'Shop GPS Captured! 📍',
        text2: `Coordinates: ${loc.coords.latitude.toFixed(5)}, ${loc.coords.longitude.toFixed(5)}`,
        position: 'top',
      });
    } catch (e: any) {
      Alert.alert('GPS Error', 'Could not fetch device location. Please make sure phone GPS / Location is turned on.');
    } finally {
      setLocationLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!form.dealer_name.trim()) {
      Alert.alert('Required', 'Please enter the Dealer firm name');
      return;
    }

    setLoading(true);
    try {
      const res = await apiAddDealer({
        ...form,
        latitude,
        longitude,
        assigned_te: user?.name || '',
        created_by: user?.name || '',
      });
      if (res && res.success) {
        queryClient.invalidateQueries({ queryKey: ['dealers'] });
        setSuccessMsg(`✅ ${form.dealer_name} added successfully!`);
        Toast.show({
          type: 'success',
          text1: 'Dealer Added Successfully! 🎉',
          text2: `${form.dealer_name} is saved with GPS navigation.`,
          position: 'top',
          visibilityTime: 2500,
        });
        setTimeout(() => {
          router.back();
        }, 1000);
      } else {
        Alert.alert('Error', res?.message || 'Failed to add dealer');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to add dealer');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="close" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Add New Dealer</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.container} contentContainerStyle={{ padding: Spacing.xl }}>
        {/* Firm Name */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Firm Name <Text style={styles.required}>*</Text></Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Maa Tarini Traders"
            placeholderTextColor={Colors.textMuted}
            value={form.dealer_name}
            onChangeText={(t) => setForm({ ...form, dealer_name: t })}
          />
        </View>

        {/* SAP Code (Unique Company Dealer Code) */}
        <View style={styles.inputGroup}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <Text style={[styles.label, { marginBottom: 0 }]}>SAP Code (Company Dealer Code)</Text>
            <View style={styles.sapBadgeTag}>
              <Text style={styles.sapBadgeTagText}>Unique Code</Text>
            </View>
          </View>
          <TextInput
            style={styles.input}
            placeholder="e.g. 10048291"
            placeholderTextColor={Colors.textMuted}
            keyboardType="numeric"
            value={form.sap_code}
            onChangeText={(t) => setForm({ ...form, sap_code: t })}
          />
          <Text style={styles.inputHelp}>
            Company ka official SAP Dealer code enter karein (Punch & Sales me show hoga).
          </Text>
        </View>

        {/* Owner Name */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Owner Name</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Ramesh Kumar"
            placeholderTextColor={Colors.textMuted}
            value={form.owner_name}
            onChangeText={(t) => setForm({ ...form, owner_name: t })}
          />
        </View>

        {/* Phone Number */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Phone Number</Text>
          <TextInput
            style={styles.input}
            placeholder="10 digit mobile number"
            placeholderTextColor={Colors.textMuted}
            keyboardType="phone-pad"
            value={form.phone}
            onChangeText={(t) => setForm({ ...form, phone: t })}
          />
        </View>

        {/* Area / Market */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Area / Location</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Kuakhia Market"
            placeholderTextColor={Colors.textMuted}
            value={form.area}
            onChangeText={(t) => setForm({ ...form, area: t })}
          />
        </View>

        {/* Full Address */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Full Address</Text>
          <TextInput
            style={[styles.input, { height: 75, textAlignVertical: 'top' }]}
            placeholder="Complete address or landmark"
            placeholderTextColor={Colors.textMuted}
            multiline
            value={form.address}
            onChangeText={(t) => setForm({ ...form, address: t })}
          />
        </View>

        {/* ── GPS LOCATION CAPTURE BOX ── */}
        <View style={styles.inputGroup}>
          <View style={styles.gpsHeaderRow}>
            <Text style={styles.label}>Counter GPS Location</Text>
            {latitude && longitude && (
              <View style={styles.gpsCapturedBadge}>
                <Ionicons name="checkmark-circle" size={13} color="#15803D" />
                <Text style={styles.gpsCapturedBadgeText}>GPS Locked</Text>
              </View>
            )}
          </View>
          <Text style={styles.gpsSubtext}>
            Capture the exact GPS coordinates so any team member can tap "Directions" to navigate directly to this counter.
          </Text>

          <TouchableOpacity
            style={[styles.locationBtn, (latitude && longitude) ? styles.locationBtnSaved : null]}
            onPress={handleGetLocation}
            disabled={locationLoading}
            activeOpacity={0.85}
          >
            {locationLoading ? (
              <ActivityIndicator size="small" color="#800E20" />
            ) : (
              <MaterialCommunityIcons
                name={(latitude && longitude) ? "map-marker-check" : "map-marker-radius"}
                size={24}
                color={(latitude && longitude) ? "#15803D" : "#800E20"}
              />
            )}
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={[styles.locationBtnTitle, (latitude && longitude) ? { color: '#15803D' } : null]}>
                {(latitude && longitude)
                  ? `📍 ${latitude.toFixed(6)}, ${longitude.toFixed(6)}`
                  : 'Capture Current Shop GPS'}
              </Text>
              <Text style={styles.locationBtnSub}>
                {(latitude && longitude)
                  ? 'Tap to re-capture or update location'
                  : 'Stand at counter & tap to fetch GPS'}
              </Text>
            </View>
            {(latitude && longitude) ? (
              <Ionicons name="refresh" size={18} color="#15803D" />
            ) : (
              <Ionicons name="chevron-forward" size={18} color="#800E20" />
            )}
          </TouchableOpacity>
        </View>

      </ScrollView>

      <View style={styles.footer}>
        {!!successMsg && (
          <View style={styles.successBanner}>
            <Text style={styles.successBannerText}>{successMsg}</Text>
          </View>
        )}
        <TouchableOpacity
          style={[styles.submitBtn, (!form.dealer_name.trim() || loading || !!successMsg) && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={loading || !!successMsg}
        >
          {loading ? (
            <ActivityIndicator color={Colors.white} />
          ) : (
            <Text style={styles.submitText}>
              {successMsg ? 'Saved! Returning...' : 'Add Dealer 🏪'}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    paddingTop: Platform.OS === 'ios' ? 60 : Spacing.xl,
    paddingBottom: Spacing.base,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderColor: Colors.borderLight,
  },
  backBtn: {
    padding: 4,
  },
  headerTitle: {
    fontFamily: FontFamily.displayBold,
    fontSize: FontSize.lg,
    color: Colors.textPrimary,
  },
  inputGroup: {
    marginBottom: Spacing.xl,
  },
  label: {
    fontFamily: FontFamily.sansMedium,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginBottom: 6,
  },
  required: {
    color: '#800E20',
    fontWeight: '700',
  },
  input: {
    backgroundColor: Colors.white,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontFamily: FontFamily.sansMedium,
    fontSize: FontSize.base,
    color: Colors.textPrimary,
  },
  sapBadgeTag: {
    backgroundColor: '#FDE8EA',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#F8B4BD',
  },
  sapBadgeTagText: {
    fontFamily: FontFamily.sansBold,
    fontSize: 10,
    color: '#800E20',
  },
  inputHelp: {
    fontFamily: FontFamily.sansRegular,
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 4,
  },
  gpsHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  gpsSubtext: {
    fontFamily: FontFamily.sansRegular,
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 10,
    lineHeight: 16,
  },
  gpsCapturedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  gpsCapturedBadgeText: {
    fontFamily: FontFamily.sansBold,
    fontSize: 11,
    color: '#15803D',
  },
  locationBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FAF0F2',
    borderWidth: 1.5,
    borderColor: '#800E20',
    borderRadius: 14,
    padding: 14,
  },
  locationBtnSaved: {
    backgroundColor: '#DCFCE7',
    borderColor: '#16A34A',
  },
  locationBtnTitle: {
    fontFamily: FontFamily.sansBold,
    fontSize: 13,
    color: '#800E20',
  },
  locationBtnSub: {
    fontFamily: FontFamily.sansRegular,
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  footer: {
    padding: Spacing.xl,
    backgroundColor: Colors.white,
    borderTopWidth: 1,
    borderColor: Colors.borderLight,
  },
  successBanner: {
    backgroundColor: '#DCFCE7',
    padding: 12,
    borderRadius: 10,
    marginBottom: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#16A34A',
  },
  successBannerText: {
    fontFamily: FontFamily.sansBold,
    fontSize: FontSize.sm,
    color: '#15803D',
  },
  submitBtn: {
    backgroundColor: '#800E20',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    shadowColor: '#800E20',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  submitBtnDisabled: {
    opacity: 0.7,
  },
  submitText: {
    fontFamily: FontFamily.sansBold,
    fontSize: FontSize.base,
    color: Colors.white,
  },
});
