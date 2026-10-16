import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ScrollView, ActivityIndicator, SafeAreaView, Alert, Platform,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import * as Location from 'expo-location';
import { apiGetDealerByToken, apiPublicSlabSubmit } from '../../src/services/api';
import { currentDateISO, formatDate } from '../../src/utils/helpers';
import { Dealer } from '../../src/types';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { format, addDays } from 'date-fns';

const QUICK_BAG_OPTIONS = [25, 50, 75, 100, 150, 200, 250, 300];

export default function PublicSlabPage() {
  const params = useLocalSearchParams<{ dealer_id?: string; token?: string }>();
  const [dealer, setDealer] = useState<Dealer | null>(null);
  const [loadingDealer, setLoadingDealer] = useState(true);
  const [invalidLink, setInvalidLink] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);

  // Form Fields
  const [mobile, setMobile] = useState('');
  const [selectedBags, setSelectedBags] = useState<number | null>(50);
  const [customBags, setCustomBags] = useState('');
  const [slabDate, setSlabDate] = useState(currentDateISO());
  const [contractorName, setContractorName] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [siteAddress, setSiteAddress] = useState('');
  const [remark, setRemark] = useState('');
  const [latitude, setLatitude] = useState<number | undefined>();
  const [longitude, setLongitude] = useState<number | undefined>();

  useEffect(() => {
    if (params.dealer_id && params.token) {
      setLoadingDealer(true);
      apiGetDealerByToken(params.dealer_id, params.token)
        .then(d => {
          setDealer(d);
          if (d.latitude && d.longitude && !latitude) {
            setLatitude(d.latitude);
            setLongitude(d.longitude);
          }
        })
        .catch(() => setInvalidLink(true))
        .finally(() => setLoadingDealer(false));
    } else {
      setLoadingDealer(false);
      setInvalidLink(true);
    }
  }, [params.dealer_id, params.token]);

  const handleSelectQuickBags = (bags: number) => {
    setSelectedBags(bags);
    setCustomBags('');
  };

  const handleCustomBagsChange = (text: string) => {
    setCustomBags(text);
    if (text.trim()) {
      setSelectedBags(null);
    }
  };

  const handleGetLocation = async () => {
    setLocationLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('लोकेशन अनुमति (Permission)', 'साइट की GPS लोकेशन दर्ज करने के लिए अनुमति दें।');
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setLatitude(loc.coords.latitude);
      setLongitude(loc.coords.longitude);
      Alert.alert('लोकेशन सेलेक्ट हो गई ✅', 'साइट की GPS लोकेशन सफलतापूर्वक जुड़ गई है।');
    } catch {
      Alert.alert('लोकेशन एरर', 'GPS लोकेशन नहीं मिल सकी। कृपया मोबाइल का GPS ऑन रखें।');
    } finally {
      setLocationLoading(false);
    }
  };

  const setDateOffset = (days: number) => {
    const target = addDays(new Date(), days);
    setSlabDate(format(target, 'yyyy-MM-dd'));
  };

  const finalExpectedCement = customBags.trim()
    ? `${customBags.trim()} बैग`
    : selectedBags ? `${selectedBags} बैग` : '';

  const handleSubmit = async () => {
    // ONLY MOBILE NUMBER IS MANDATORY!
    const cleanMobile = mobile.replace(/[^0-9]/g, '');
    if (!cleanMobile || cleanMobile.length < 10) {
      Alert.alert('मोबाइल नंबर जरूरी है ⚠️', 'कृपया 10 अंकों का सही मोबाइल नंबर दर्ज करें ताकि हमारी टीम आपसे संपर्क कर सके।');
      return;
    }

    if (!params.dealer_id || !params.token) {
      Alert.alert('एरर', 'अमान्य डीलर लिंक।');
      return;
    }

    setSubmitting(true);

    const combinedRemark = [
      `मोबाइल: ${cleanMobile}`,
      siteAddress ? `पता: ${siteAddress}` : '',
      remark ? `नोट: ${remark}` : '',
    ].filter(Boolean).join(' | ');

    try {
      const res = await apiPublicSlabSubmit({
        dealer_id: params.dealer_id,
        dealer_name: dealer?.dealer_name || '',
        token: params.token,
        slab_date: slabDate || currentDateISO(),
        contractor_name: contractorName.trim() || `मिस्त्री (${cleanMobile})`,
        mobile: cleanMobile,
        customer_name: customerName.trim(),
        expected_cement: finalExpectedCement,
        latitude,
        longitude,
        remark: combinedRemark,
      });

      if (res.success) {
        setSubmitted(true);
      } else {
        Alert.alert('एरर', res.message || 'स्लैब सबमिट नहीं हो सका। कृपया दोबारा कोशिश करें।');
      }
    } catch (e: any) {
      Alert.alert('एरर', e.message || 'नेटवर्क समस्या। कृपया इंटरनेट चेक करके दोबारा दबाएं।');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetForm = () => {
    setSubmitted(false);
    setMobile('');
    setSelectedBags(50);
    setCustomBags('');
    setSlabDate(currentDateISO());
    setContractorName('');
    setCustomerName('');
    setSiteAddress('');
    setRemark('');
  };

  if (loadingDealer) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#C91F2B" />
        <Text style={styles.loadingText}>डीलर जानकारी लोड हो रही है...</Text>
      </SafeAreaView>
    );
  }

  if (invalidLink) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <View style={styles.errorCircle}>
          <MaterialCommunityIcons name="alert-circle-outline" size={54} color="#DC2626" />
        </View>
        <Text style={styles.errorTitle}>अमान्य या पुराना लिंक</Text>
        <Text style={styles.errorSubtitle}>
          यह QR कोड या लिंक एक्सपायर हो चुका है।{"\n"}कृपया अपने डीलर काउंटर से नया QR कोड स्कैन करें।
        </Text>
      </SafeAreaView>
    );
  }

  if (submitted) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <ScrollView contentContainerStyle={styles.successScroll} showsVerticalScrollIndicator={false}>
          <View style={styles.successCircle}>
            <MaterialCommunityIcons name="check-decagram" size={64} color="#16A34A" />
          </View>
          <Text style={styles.successHeading}>स्लैब ढलाई दर्ज हो गई! 🎉</Text>
          <Text style={styles.successMessage}>
            धन्यवाद! आपकी ढलाई की जानकारी हमारे टेक्निकल इंजीनियर (TE) के पास पहुँच गई है।
          </Text>

          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>बुकिंग विवरण (Booking Summary)</Text>
            
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>डीलर काउंटर:</Text>
              <Text style={styles.summaryValue}>{dealer?.dealer_name || '—'}</Text>
            </View>

            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>मोबाइल नंबर:</Text>
              <Text style={[styles.summaryValue, { color: '#C91F2B', fontWeight: '800' }]}>{mobile}</Text>
            </View>

            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>सीमेंट मात्रा:</Text>
              <Text style={styles.summaryValue}>{finalExpectedCement || '50 बैग'}</Text>
            </View>

            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>ढलाई तारीख:</Text>
              <Text style={styles.summaryValue}>{formatDate(slabDate)}</Text>
            </View>

            {contractorName ? (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>मिस्त्री का नाम:</Text>
                <Text style={styles.summaryValue}>{contractorName}</Text>
              </View>
            ) : null}

            {customerName ? (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>साइट / गांव:</Text>
                <Text style={styles.summaryValue}>{customerName}</Text>
              </View>
            ) : null}
          </View>

          <TouchableOpacity style={styles.newSlabBtn} onPress={handleResetForm} activeOpacity={0.85}>
            <Ionicons name="add-circle-outline" size={20} color="#FFFFFF" />
            <Text style={styles.newSlabBtnText}>एक और स्लैब जोड़ें (Add Another)</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  const todayStr = currentDateISO();
  const tomorrowStr = format(addDays(new Date(), 1), 'yyyy-MM-dd');
  const dayAfterStr = format(addDays(new Date(), 2), 'yyyy-MM-dd');

  return (
    <SafeAreaView style={styles.mainContainer}>
      {/* Top Header */}
      <View style={styles.topHeader}>
        <View style={styles.brandBadge}>
          <Text style={styles.brandTextTE}>TE </Text>
          <Text style={styles.brandTextCONNECT}>CONNECT</Text>
        </View>
        <Text style={styles.headerTitleHindi}>स्लैब ढलाई बुकिंग (Slab Booking)</Text>
        <Text style={styles.headerSubtitle}>आसान और तेज़ स्लैब बुकिंग सेवा</Text>
      </View>

      <ScrollView
        style={styles.contentScroll}
        contentContainerStyle={styles.scrollContentContainer}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Dealer Info Card (Auto-Fetched from QR) */}
        {dealer && (
          <View style={styles.dealerInfoCard}>
            <View style={styles.verifiedRow}>
              <MaterialCommunityIcons name="check-decagram" size={18} color="#16A34A" />
              <Text style={styles.verifiedText}>अधिकृत काउंटर (Authorized Dealer Counter)</Text>
            </View>
            <Text style={styles.dealerShopName}>{dealer.dealer_name}</Text>
            {(dealer.area || dealer.address) && (
              <View style={styles.dealerAddressRow}>
                <Ionicons name="location-sharp" size={14} color="#8A7277" />
                <Text style={styles.dealerAddressText} numberOfLines={2}>
                  {dealer.address || dealer.area} {dealer.area && dealer.address && !dealer.address.includes(dealer.area) ? `(${dealer.area})` : ''}
                </Text>
              </View>
            )}
            {dealer.owner_name ? (
              <Text style={styles.dealerOwnerText}>संचालक: {dealer.owner_name} {dealer.phone ? `· ${dealer.phone}` : ''}</Text>
            ) : null}
          </View>
        )}

        {/* STEP 1: MOBILE NUMBER (MANDATORY) */}
        <View style={styles.sectionCardHighlighted}>
          <View style={styles.mandatoryHeaderRow}>
            <Text style={styles.sectionStepNum}>1</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.mandatoryTitle}>
                मिस्त्री / ठेकेदार का मोबाइल नंबर <Text style={styles.requiredStar}>* (जरूरी)</Text>
              </Text>
              <Text style={styles.mandatorySubtitle}>Contact Mobile Number (Mandatory)</Text>
            </View>
          </View>

          <View style={styles.phoneInputContainer}>
            <View style={styles.countryCodeBox}>
              <Text style={styles.flagIcon}>🇮🇳</Text>
              <Text style={styles.countryCodeText}>+91</Text>
            </View>
            <TextInput
              style={styles.phoneTextInput}
              value={mobile}
              onChangeText={setMobile}
              placeholder="10 अंकों का मोबाइल नंबर"
              placeholderTextColor="#9CA3AF"
              keyboardType="phone-pad"
              maxLength={10}
              autoFocus={true}
            />
          </View>
          <Text style={styles.phoneHint}>
            ℹ️ हमारी टेक्निकल टीम (TE) स्लैब टेस्टिंग व सहायता के लिए इस नंबर पर संपर्क करेगी।
          </Text>
        </View>

        {/* STEP 2: CEMENT QUANTITY (1-TAP QUICK SELECT) */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionStepNumGray}>2</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.sectionTitle}>सीमेंट बैग की मात्रा (Select Bags)</Text>
              <Text style={styles.sectionSub}>कितना बैग सीमेंट लगेगा? एक विकल्प चुनें:</Text>
            </View>
          </View>

          {/* Quick Bag Chips */}
          <View style={styles.bagGrid}>
            {QUICK_BAG_OPTIONS.map((bags) => {
              const isSelected = selectedBags === bags && !customBags.trim();
              return (
                <TouchableOpacity
                  key={bags}
                  style={[styles.bagChip, isSelected && styles.bagChipActive]}
                  onPress={() => handleSelectQuickBags(bags)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.bagChipNumber, isSelected && styles.bagChipNumberActive]}>
                    {bags}
                  </Text>
                  <Text style={[styles.bagChipLabel, isSelected && styles.bagChipLabelActive]}>
                    बैग (Bags)
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Custom Bag Input */}
          <View style={styles.customBagRow}>
            <Text style={styles.customBagLabel}>या अन्य मात्रा लिखें:</Text>
            <TextInput
              style={styles.customBagInput}
              value={customBags}
              onChangeText={handleCustomBagsChange}
              placeholder="उदा. 80"
              placeholderTextColor="#9CA3AF"
              keyboardType="number-pad"
            />
            <Text style={styles.customBagUnit}>बैग</Text>
          </View>
        </View>

        {/* STEP 3: SLAB DATE (1-TAP DATE CHIPS) */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionStepNumGray}>3</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.sectionTitle}>ढलाई की तारीख (Slab Date)</Text>
              <Text style={styles.sectionSub}>ढलाई किस दिन होगी? सेलेक्ट करें:</Text>
            </View>
          </View>

          <View style={styles.dateChipsRow}>
            <TouchableOpacity
              style={[styles.dateChip, slabDate === todayStr && styles.dateChipActive]}
              onPress={() => setDateOffset(0)}
              activeOpacity={0.8}
            >
              <Text style={[styles.dateChipTitle, slabDate === todayStr && styles.dateChipTitleActive]}>
                आज (Today)
              </Text>
              <Text style={[styles.dateChipSub, slabDate === todayStr && styles.dateChipSubActive]}>
                {format(new Date(), 'dd MMM')}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.dateChip, slabDate === tomorrowStr && styles.dateChipActive]}
              onPress={() => setDateOffset(1)}
              activeOpacity={0.8}
            >
              <Text style={[styles.dateChipTitle, slabDate === tomorrowStr && styles.dateChipTitleActive]}>
                कल (Tomorrow)
              </Text>
              <Text style={[styles.dateChipSub, slabDate === tomorrowStr && styles.dateChipSubActive]}>
                {format(addDays(new Date(), 1), 'dd MMM')}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.dateChip, slabDate === dayAfterStr && styles.dateChipActive]}
              onPress={() => setDateOffset(2)}
              activeOpacity={0.8}
            >
              <Text style={[styles.dateChipTitle, slabDate === dayAfterStr && styles.dateChipTitleActive]}>
                परसों (In 2 Days)
              </Text>
              <Text style={[styles.dateChipSub, slabDate === dayAfterStr && styles.dateChipSubActive]}>
                {format(addDays(new Date(), 2), 'dd MMM')}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Custom Date Input */}
          <View style={styles.customDateContainer}>
            <Text style={styles.customDateLabel}>अन्य तारीख (YYYY-MM-DD):</Text>
            <TextInput
              style={styles.customDateInput}
              value={slabDate}
              onChangeText={setSlabDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#9CA3AF"
            />
          </View>
        </View>

        {/* STEP 4: OPTIONAL DETAILS (CONTRACTOR / SITE / GPS) */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionStepNumGray}>4</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.sectionTitle}>अतिरिक्त विवरण (Optional Details)</Text>
              <Text style={styles.sectionSub}>अगर चाहें तो भरें, नहीं तो खाली छोड़ सकते हैं:</Text>
            </View>
          </View>

          {/* Contractor Name */}
          <View style={styles.inputGroup}>
            <Text style={styles.fieldLabel}>👷 मिस्त्री / ठेकेदार का नाम (Contractor Name)</Text>
            <TextInput
              style={styles.textInput}
              value={contractorName}
              onChangeText={setContractorName}
              placeholder="जैसे: रमेश मिस्त्री"
              placeholderTextColor="#9CA3AF"
            />
          </View>

          {/* Site / Customer Name */}
          <View style={styles.inputGroup}>
            <Text style={styles.fieldLabel}>🏠 मकान मालिक / गांव का नाम (Site / Village)</Text>
            <TextInput
              style={styles.textInput}
              value={customerName}
              onChangeText={setCustomerName}
              placeholder="जैसे: कुआखिया बाजार, स्कूल के पास"
              placeholderTextColor="#9CA3AF"
            />
          </View>

          {/* Location Button */}
          <View style={styles.inputGroup}>
            <Text style={styles.fieldLabel}>📍 साइट लोकेशन (Current GPS Location)</Text>
            <TouchableOpacity
              style={[styles.gpsButton, (latitude && longitude) ? styles.gpsButtonSaved : null]}
              onPress={handleGetLocation}
              disabled={locationLoading}
              activeOpacity={0.8}
            >
              {locationLoading ? (
                <ActivityIndicator size="small" color="#C91F2B" />
              ) : (
                <Ionicons
                  name={latitude && longitude ? "checkmark-circle" : "location"}
                  size={20}
                  color={latitude && longitude ? "#16A34A" : "#C91F2B"}
                />
              )}
              <Text style={[styles.gpsButtonText, (latitude && longitude) ? styles.gpsButtonTextSaved : null]}>
                {latitude && longitude
                  ? `📍 GPS सुरक्षित: ${Number(latitude).toFixed(4)}, ${Number(longitude).toFixed(4)}`
                  : '📍 अभी की लोकेशन जोड़ें (1-Tap GPS)'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* BIG SUBMIT BUTTON */}
        <TouchableOpacity
          style={[styles.mainSubmitBtn, submitting && styles.mainSubmitBtnDisabled]}
          onPress={handleSubmit}
          disabled={submitting}
          activeOpacity={0.85}
        >
          {submitting ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <View style={styles.submitBtnContent}>
              <Text style={styles.submitBtnHindi}>स्लैब ढलाई बुक करें 🏗️</Text>
              <Text style={styles.submitBtnEnglish}>Submit Slab Casting Request →</Text>
            </View>
          )}
        </TouchableOpacity>

        <View style={styles.footerBranding}>
          <Text style={styles.footerText}>🏗️ TE CONNECT · Jindal Cement Service Platform</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  centerContainer: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 15,
    fontWeight: '600',
    color: '#4B5563',
  },
  topHeader: {
    backgroundColor: '#FFFFFF',
    paddingTop: Platform.OS === 'ios' ? 12 : 20,
    paddingBottom: 16,
    paddingHorizontal: 20,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  brandBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  brandTextTE: {
    fontSize: 22,
    fontWeight: '900',
    color: '#111827',
    letterSpacing: 1,
  },
  brandTextCONNECT: {
    fontSize: 22,
    fontWeight: '900',
    color: '#C91F2B',
    letterSpacing: 1,
  },
  headerTitleHindi: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  contentScroll: {
    flex: 1,
  },
  scrollContentContainer: {
    padding: 16,
    paddingBottom: 40,
  },
  dealerInfoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: '#DCFCE7',
    shadowColor: '#16A34A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 2,
  },
  verifiedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  verifiedText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#16A34A',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  dealerShopName: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 4,
  },
  dealerAddressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  dealerAddressText: {
    fontSize: 13,
    color: '#4B5563',
    fontWeight: '500',
    flex: 1,
  },
  dealerOwnerText: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 6,
    fontWeight: '500',
  },
  sectionCardHighlighted: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#C91F2B',
    shadowColor: '#C91F2B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 3,
  },
  mandatoryHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 14,
  },
  sectionStepNum: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#C91F2B',
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 28,
  },
  mandatoryTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
  },
  requiredStar: {
    color: '#DC2626',
    fontWeight: '800',
  },
  mandatorySubtitle: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 1,
  },
  phoneInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#C91F2B',
    borderRadius: 12,
    backgroundColor: '#FEF2F2',
    overflow: 'hidden',
  },
  countryCodeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 14,
    backgroundColor: '#FDE8EA',
    borderRightWidth: 1.5,
    borderRightColor: '#FCA5A5',
  },
  flagIcon: {
    fontSize: 16,
  },
  countryCodeText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#991B1B',
  },
  phoneTextInput: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
    letterSpacing: 1,
  },
  phoneHint: {
    fontSize: 11,
    color: '#4B5563',
    marginTop: 8,
    lineHeight: 16,
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 14,
  },
  sectionStepNumGray: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#E5E7EB',
    color: '#374151',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 26,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  sectionSub: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 1,
  },
  bagGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  bagChip: {
    width: '23%',
    flexGrow: 1,
    backgroundColor: '#F9FAFB',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  bagChipActive: {
    backgroundColor: '#FDE8EA',
    borderColor: '#C91F2B',
  },
  bagChipNumber: {
    fontSize: 17,
    fontWeight: '800',
    color: '#1F2937',
  },
  bagChipNumberActive: {
    color: '#C91F2B',
  },
  bagChipLabel: {
    fontSize: 10,
    color: '#6B7280',
    fontWeight: '600',
    marginTop: 1,
  },
  bagChipLabelActive: {
    color: '#C91F2B',
  },
  customBagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  customBagLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4B5563',
    marginRight: 8,
  },
  customBagInput: {
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    width: 90,
    textAlign: 'center',
    backgroundColor: '#FFFFFF',
  },
  customBagUnit: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
    marginLeft: 6,
  },
  dateChipsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  dateChip: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  dateChipActive: {
    backgroundColor: '#FDE8EA',
    borderColor: '#C91F2B',
  },
  dateChipTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#374151',
  },
  dateChipTitleActive: {
    color: '#C91F2B',
  },
  dateChipSub: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 2,
    fontWeight: '600',
  },
  dateChipSubActive: {
    color: '#C91F2B',
  },
  customDateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  customDateLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginRight: 8,
  },
  customDateInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 13,
    color: '#374151',
    backgroundColor: '#FFFFFF',
  },
  inputGroup: {
    marginBottom: 14,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6,
  },
  textInput: {
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: '#111827',
    backgroundColor: '#FFFFFF',
  },
  gpsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderColor: '#C91F2B',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: '#FEF2F2',
  },
  gpsButtonSaved: {
    borderColor: '#16A34A',
    backgroundColor: '#DCFCE7',
  },
  gpsButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#C91F2B',
  },
  gpsButtonTextSaved: {
    color: '#16A34A',
  },
  mainSubmitBtn: {
    backgroundColor: '#C91F2B',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#C91F2B',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 4,
    marginTop: 8,
  },
  mainSubmitBtnDisabled: {
    opacity: 0.7,
  },
  submitBtnContent: {
    alignItems: 'center',
  },
  submitBtnHindi: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
  },
  submitBtnEnglish: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  footerBranding: {
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 10,
  },
  footerText: {
    fontSize: 11,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  errorCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#DC2626',
    marginBottom: 8,
  },
  errorSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  successScroll: {
    alignItems: 'center',
    paddingVertical: 20,
    width: '100%',
  },
  successCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  successHeading: {
    fontSize: 22,
    fontWeight: '900',
    color: '#15803D',
    marginBottom: 8,
    textAlign: 'center',
  },
  successMessage: {
    fontSize: 14,
    color: '#4B5563',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  summaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 24,
  },
  summaryTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#111827',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    paddingBottom: 8,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  summaryLabel: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '500',
  },
  summaryValue: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '700',
  },
  newSlabBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#16A34A',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 24,
  },
  newSlabBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
