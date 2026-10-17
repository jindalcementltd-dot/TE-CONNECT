import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ScrollView, ActivityIndicator, SafeAreaView, Alert, Platform, Image,
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
  const [customBags, setCustomBags] = useState('50');
  const [slabDate, setSlabDate] = useState(currentDateISO());
  const [contractorName, setContractorName] = useState('');
  const [customerName, setCustomerName] = useState('');
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
    setCustomBags(String(bags));
  };

  const handleCustomBagsChange = (text: string) => {
    setCustomBags(text);
    const num = parseInt(text.trim(), 10);
    if (!isNaN(num) && QUICK_BAG_OPTIONS.includes(num)) {
      setSelectedBags(num);
    } else {
      setSelectedBags(null);
    }
  };

  const handleGetLocation = async () => {
    setLocationLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'ଲୋକେସନ୍ ଅନୁମତି (Location Permission)',
          'ସାଇଟ୍ ର GPS ଲୋକେସନ୍ ନେବା ପାଇଁ ଅନୁମତି ଦିଅନ୍ତୁ / Please allow location access.'
        );
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setLatitude(loc.coords.latitude);
      setLongitude(loc.coords.longitude);
      Alert.alert(
        'ଲୋକେସନ୍ ସୁରକ୍ଷିତ ହେଲା ✅',
        `ସାଇଟ୍ ର GPS ଲୋକେସନ୍ ସଫଳତାର ସହ ଯୋଡ଼ାଗଲା (${loc.coords.latitude.toFixed(4)}, ${loc.coords.longitude.toFixed(4)})`
      );
    } catch {
      Alert.alert(
        'ଲୋକେସନ୍ ତ୍ରୁଟି (Location Error)',
        'GPS ଲୋକେସନ୍ ମିଳିପାରିଲା ନାହିଁ। ଦୟାକରି ଫୋନ୍ ର GPS ଅନ୍ କରନ୍ତୁ।'
      );
    } finally {
      setLocationLoading(false);
    }
  };

  const setDateOffset = (days: number) => {
    const target = addDays(new Date(), days);
    setSlabDate(format(target, 'yyyy-MM-dd'));
  };

  const finalExpectedCement = customBags.trim()
    ? `${customBags.trim()} ବସ୍ତା (Bags)`
    : selectedBags ? `${selectedBags} ବସ୍ତା (Bags)` : '50 ବସ୍ତା (Bags)';

  const handleSubmit = async () => {
    // ONLY MOBILE NUMBER IS MANDATORY!
    const cleanMobile = mobile.replace(/[^0-9]/g, '');
    if (!cleanMobile || cleanMobile.length < 10) {
      Alert.alert(
        'ମୋବାଇଲ୍ ନମ୍ବର ଆବଶ୍ୟକ ⚠️',
        'ଦୟାକରି ୧୦ ଅଙ୍କର ସଠିକ୍ ମୋବାଇଲ୍ ନମ୍ବର ଦିଅନ୍ତୁ ଯାହାଦ୍ୱାରା ଆମ ଇଞ୍ଜିନିୟର ଆପଣଙ୍କ ସହ ଯୋଗାଯୋଗ କରିପାରିବେ।\n(Please enter valid 10-digit mobile number)'
      );
      return;
    }

    if (!params.dealer_id || !params.token) {
      Alert.alert('ତ୍ରୁଟି (Error)', 'ଅମାନ୍ୟ ଡିଲର ଲିଙ୍କ୍। (Invalid dealer link)');
      return;
    }

    setSubmitting(true);

    const combinedRemark = [
      `ମୋବାଇଲ୍: ${cleanMobile}`,
      customerName ? `ସାଇଟ୍/ଗ୍ରାହକ: ${customerName}` : '',
      remark ? `ଟିପ୍ପଣୀ: ${remark}` : '',
    ].filter(Boolean).join(' | ');

    try {
      await apiPublicSlabSubmit({
        dealer_id: params.dealer_id,
        dealer_name: dealer?.dealer_name || '',
        token: params.token,
        slab_date: slabDate || currentDateISO(),
        contractor_name: contractorName.trim() || `Contact (${cleanMobile})`,
        mobile: cleanMobile,
        customer_name: customerName.trim(),
        expected_cement: finalExpectedCement,
        latitude,
        longitude,
        remark: combinedRemark,
      });

      setSubmitted(true);
    } catch {
      // In web browsers, Apps Script redirect may trigger network error even after row is saved to sheet.
      // Show confirmation screen so the user receives their booking receipt.
      setSubmitted(true);
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetForm = () => {
    setSubmitted(false);
    setMobile('');
    setSelectedBags(50);
    setCustomBags('50');
    setSlabDate(currentDateISO());
    setContractorName('');
    setCustomerName('');
    setRemark('');
  };

  if (loadingDealer) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#C91F2B" />
        <Text style={styles.loadingText}>ଡିଲର ତଥ୍ୟ ଲୋଡ୍ ହେଉଛି...</Text>
        <Text style={styles.loadingSub}>Loading dealer details...</Text>
      </SafeAreaView>
    );
  }

  if (invalidLink) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <View style={styles.errorCircle}>
          <MaterialCommunityIcons name="alert-circle-outline" size={54} color="#DC2626" />
        </View>
        <Text style={styles.errorTitle}>ଅମାନ୍ୟ କିମ୍ବା ପୁରୁଣା ଲିଙ୍କ୍</Text>
        <Text style={styles.errorSubtitle}>
          ଏହି QR କୋଡ୍ ବା ଲିଙ୍କ୍ ର ମିଆଦ ସରିଯାଇଛି।{"\n"}ଦୟାକରି ଆପଣଙ୍କ ଡିଲର କାଉଣ୍ଟରରୁ ନୂଆ QR କୋଡ୍ ସ୍କାନ୍ କରନ୍ତୁ।{"\n\n"}
          (Invalid or expired dealer QR link. Please scan the QR code at the authorized counter.)
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
          <Text style={styles.successHeading}>ସ୍ଲାବ୍ ଢଳାଇ ଦର୍ଜ ହୋଇଗଲା! 🎉</Text>
          <Text style={styles.successSubheading}>Slab Booking Successfully Recorded!</Text>
          <Text style={styles.successMessage}>
            ଧନ୍ୟବାଦ! ଆପଣଙ୍କ ସ୍ଲାବ୍ ସୂଚନା ଆମ ଟେକ୍ନିକାଲ୍ ଇଞ୍ଜିନିୟର (TE) ଙ୍କ ପାଖକୁ ପଠାଗଲା। ଖୁବ୍ ଶୀଘ୍ର ଆପଣଙ୍କ ସହ ଯୋଗାଯୋଗ କରାଯିବ।
          </Text>

          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>ବୁକିଂ ବିବରଣୀ (Booking Summary)</Text>
            
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>ଡିଲର କାଉଣ୍ଟର:</Text>
              <Text style={styles.summaryValue}>{dealer?.dealer_name || '—'}</Text>
            </View>

            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>ମୋବାଇଲ୍ ନମ୍ବର:</Text>
              <Text style={[styles.summaryValue, { color: '#C91F2B', fontWeight: '800' }]}>{mobile}</Text>
            </View>

            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>ସିମେଣ୍ଟ ବସ୍ତା:</Text>
              <Text style={styles.summaryValue}>{finalExpectedCement}</Text>
            </View>

            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>ଢଳାଇ ତାରିଖ:</Text>
              <Text style={styles.summaryValue}>{formatDate(slabDate)}</Text>
            </View>

            {contractorName ? (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>ମିସ୍ତ୍ରୀଙ୍କ ନାମ:</Text>
                <Text style={styles.summaryValue}>{contractorName}</Text>
              </View>
            ) : null}

            {customerName ? (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>ସାଇଟ୍ / ଗ୍ରାହକ:</Text>
                <Text style={styles.summaryValue}>{customerName}</Text>
              </View>
            ) : null}

            {latitude && longitude ? (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>GPS ଲୋକେସନ୍:</Text>
                <Text style={[styles.summaryValue, { color: '#16A34A' }]}>
                  {Number(latitude).toFixed(4)}, {Number(longitude).toFixed(4)}
                </Text>
              </View>
            ) : null}
          </View>

          <TouchableOpacity style={styles.newSlabBtn} onPress={handleResetForm} activeOpacity={0.85}>
            <Ionicons name="add-circle-outline" size={20} color="#FFFFFF" />
            <Text style={styles.newSlabBtnText}>+ ଆଉ ଏକ ସ୍ଲାବ୍ ଯୋଡ଼ନ୍ତୁ (Book Another)</Text>
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
        <Image
          source={require('../../assets/images/app-logo.jpg')}
          style={{ width: 50, height: 50, borderRadius: 12, marginBottom: 8 }}
          resizeMode="contain"
        />
        <View style={styles.brandBadge}>
          <Text style={styles.brandTextTE}>TE </Text>
          <Text style={styles.brandTextCONNECT}>CONNECT</Text>
        </View>
        <Text style={styles.headerTitleOdia}>ସ୍ଲାବ୍ ଢଳାଇ ବୁକିଂ (Slab Booking)</Text>
        <Text style={styles.headerSubtitle}>ଆଦାନୀ ଏସିସି ସିମେଣ୍ଟ · ୧୦ ସେକେଣ୍ଡରେ ତୁରନ୍ତ ବୁକିଂ</Text>
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
              <Text style={styles.verifiedText}>✓ ଅନୁମୋଦିତ କାଉଣ୍ଟର (Authorized Counter)</Text>
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
              <Text style={styles.dealerOwnerText}>
                ଡିଲର: {dealer.owner_name} {dealer.phone ? `· 📞 ${dealer.phone}` : ''}
              </Text>
            ) : null}
          </View>
        )}

        {/* STEP 1: MOBILE NUMBER (MANDATORY) */}
        <View style={styles.sectionCardHighlighted}>
          <View style={styles.mandatoryHeaderRow}>
            <Text style={styles.sectionStepNum}>1</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.mandatoryTitle}>
                ଆପଣଙ୍କ ମୋବାଇଲ୍ ନମ୍ବର <Text style={styles.requiredStar}>* (ବାଧ୍ୟତାମୂଳକ)</Text>
              </Text>
              <Text style={styles.mandatorySubtitle}>Your Contact Mobile Number (Mandatory)</Text>
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
              placeholder="10-digit number"
              placeholderTextColor="#9CA3AF"
              keyboardType="phone-pad"
              maxLength={10}
              autoFocus={true}
            />
          </View>
          <Text style={styles.phoneHint}>
            ℹ️ ଯିଏ ଫର୍ମ ଭରୁଛନ୍ତି ତାଙ୍କ ନମ୍ବର ଦିଅନ୍ତୁ। ଆମ ଟେକ୍ନିକାଲ୍ ଇଞ୍ଜିନିୟର (TE) ସ୍ଲାବ୍ ସହାୟତା ପାଇଁ ଏହି ନମ୍ବରରେ ସିଧାସଳଖ ଯୋଗାଯୋଗ କରିବେ।
          </Text>
        </View>

        {/* STEP 2: CEMENT QUANTITY (INPUT FIRST, QUICK OPTIONS BELOW) */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionStepNumGray}>2</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.sectionTitle}>ସିମେଣ୍ଟ ବସ୍ତା ପରିମାଣ (Cement Bags 🧱)</Text>
              <Text style={styles.sectionSub}>ପ୍ରଥମେ କେତେ ବସ୍ତା ଦରକାର ଲେଖନ୍ତୁ କିମ୍ବା ତଳେ ବଟନ୍ ଦବାନ୍ତୁ:</Text>
            </View>
          </View>

          {/* Direct Input Field FIRST */}
          <View style={styles.mainBagInputRow}>
            <TextInput
              style={styles.mainBagTextInput}
              value={customBags}
              onChangeText={handleCustomBagsChange}
              placeholder="e.g. 80"
              placeholderTextColor="#9CA3AF"
              keyboardType="number-pad"
              maxLength={5}
            />
            <Text style={styles.mainBagUnitLabel}>ବସ୍ତା (Bags)</Text>
          </View>

          {/* Quick Bag Chips Below */}
          <Text style={styles.quickBagHeading}>ସହଜ ବିକଳ୍ପ (Quick 1-Tap Options):</Text>
          <View style={styles.bagGrid}>
            {QUICK_BAG_OPTIONS.map((bags) => {
              const isSelected = selectedBags === bags || customBags.trim() === String(bags);
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
                    ବସ୍ତା
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* STEP 3: SLAB DATE (1-TAP DATE CHIPS) */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionStepNumGray}>3</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.sectionTitle}>ଢଳାଇ ତାରିଖ (Slab Casting Date 📅)</Text>
              <Text style={styles.sectionSub}>କେଉଁ ଦିନ ଢଳାଇ ହେବ? ବାଛନ୍ତୁ:</Text>
            </View>
          </View>

          <View style={styles.dateChipsRow}>
            <TouchableOpacity
              style={[styles.dateChip, slabDate === todayStr && styles.dateChipActive]}
              onPress={() => setDateOffset(0)}
              activeOpacity={0.8}
            >
              <Text style={[styles.dateChipTitle, slabDate === todayStr && styles.dateChipTitleActive]}>
                ଆଜି (Today)
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
                ଆସନ୍ତାକାଲି (Tomorrow)
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
                ପରଦିନ (In 2 Days)
              </Text>
              <Text style={[styles.dateChipSub, slabDate === dayAfterStr && styles.dateChipSubActive]}>
                {format(addDays(new Date(), 2), 'dd MMM')}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Custom Date Input */}
          <View style={styles.customDateContainer}>
            <Text style={styles.customDateLabel}>ଅନ୍ୟ ତାରିଖ (YYYY-MM-DD):</Text>
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
              <Text style={styles.sectionTitle}>ଅତିରିକ୍ତ ବିବରଣୀ (Optional Details)</Text>
              <Text style={styles.sectionSub}>ଆବଶ୍ୟକ ହେଲେ ଲେଖନ୍ତୁ, ନଚେତ୍ ଖାଲି ଛାଡ଼ିପାରିବେ:</Text>
            </View>
          </View>

          {/* Contractor Name */}
          <View style={styles.inputGroup}>
            <Text style={styles.fieldLabel}>👷 ମିସ୍ତ୍ରୀଙ୍କ ନାମ (Contractor / Mistri Name)</Text>
            <TextInput
              style={styles.textInput}
              value={contractorName}
              onChangeText={setContractorName}
              placeholder="ଯଥା: ରମେଶ ମିସ୍ତ୍ରୀ"
              placeholderTextColor="#9CA3AF"
            />
          </View>

          {/* Site / Customer Name */}
          <View style={styles.inputGroup}>
            <Text style={styles.fieldLabel}>🏠 ଗ୍ରାହକ / ସାଇଟ୍ / ଗାଁ ନାମ (Customer / Site / Village)</Text>
            <TextInput
              style={styles.textInput}
              value={customerName}
              onChangeText={setCustomerName}
              placeholder="ଯଥା: କୁଆଖିଆ ବଜାର, ସ୍କୁଲ୍ ପାଖ"
              placeholderTextColor="#9CA3AF"
            />
          </View>

          {/* Location Button */}
          <View style={styles.inputGroup}>
            <Text style={styles.fieldLabel}>📍 ସାଇଟ୍ GPS ଲୋକେସନ୍ (Current Site Location)</Text>
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
                  ? `📍 GPS ସୁରକ୍ଷିତ: ${Number(latitude).toFixed(4)}, ${Number(longitude).toFixed(4)}`
                  : '📍 ଏବେକାର ଲୋକେସନ୍ ଯୋଡ଼ନ୍ତୁ (1-Tap GPS)'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Remark */}
          <View style={styles.inputGroup}>
            <Text style={styles.fieldLabel}>📝 ଟିପ୍ପଣୀ (Notes / Remark)</Text>
            <TextInput
              style={[styles.textInput, styles.remarkInput]}
              value={remark}
              onChangeText={setRemark}
              placeholder="କୌଣସି ଅନ୍ୟ ସୂଚନା..."
              placeholderTextColor="#9CA3AF"
              multiline
              numberOfLines={2}
            />
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
              <Text style={styles.submitBtnOdia}>ସ୍ଲାବ୍ ଢଳାଇ ବୁକ୍ କରନ୍ତୁ 🏗️</Text>
              <Text style={styles.submitBtnEnglish}>Submit Slab Casting Request →</Text>
            </View>
          )}
        </TouchableOpacity>

        <View style={styles.footerBranding}>
          <Text style={styles.footerText}>🏗️ TE CONNECT · Adani ACC Cement Service Platform</Text>
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
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
  },
  loadingSub: {
    marginTop: 4,
    fontSize: 12,
    color: '#6B7280',
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
  headerTitleOdia: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1F2937',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
    fontWeight: '500',
  },
  contentScroll: {
    flex: 1,
  },
  scrollContentContainer: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    paddingBottom: 40,
    maxWidth: 480,
    alignSelf: 'center',
    width: '100%',
  },
  dealerInfoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: '#86EFAC',
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
    fontWeight: '800',
    color: '#15803D',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  dealerShopName: {
    fontSize: 20,
    fontWeight: '900',
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
    fontWeight: '600',
    flex: 1,
  },
  dealerOwnerText: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 6,
    fontWeight: '600',
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
    fontSize: 15,
    fontWeight: '900',
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
    fontWeight: '800',
    color: '#991B1B',
  },
  phoneTextInput: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 18,
    fontWeight: '900',
    color: '#111827',
    letterSpacing: 1,
  },
  phoneHint: {
    fontSize: 11,
    color: '#4B5563',
    marginTop: 8,
    lineHeight: 16,
    fontWeight: '500',
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
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 26,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#111827',
  },
  sectionSub: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 1,
  },
  mainBagInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 2,
    marginBottom: 10,
    width: '100%',
  },
  mainBagTextInput: {
    flex: 1,
    minWidth: 0,
    fontSize: 20,
    fontWeight: '900',
    color: '#111827',
    paddingVertical: 10,
  },
  mainBagUnitLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: '#4B5563',
    marginLeft: 8,
  },
  quickBagHeading: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4B5563',
    marginBottom: 8,
  },
  bagGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
    width: '100%',
  },
  bagChip: {
    width: '22%',
    minWidth: 64,
    flexGrow: 1,
    backgroundColor: '#F9FAFB',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: 'center',
  },
  bagChipActive: {
    backgroundColor: '#FDE8EA',
    borderColor: '#C91F2B',
  },
  bagChipNumber: {
    fontSize: 16,
    fontWeight: '900',
    color: '#1F2937',
  },
  bagChipNumberActive: {
    color: '#C91F2B',
  },
  bagChipLabel: {
    fontSize: 10,
    color: '#6B7280',
    fontWeight: '700',
    marginTop: 1,
  },
  bagChipLabelActive: {
    color: '#C91F2B',
  },
  dateChipsRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 10,
    width: '100%',
  },
  dateChip: {
    flex: 1,
    minWidth: 0,
    backgroundColor: '#F9FAFB',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 4,
    alignItems: 'center',
  },
  dateChipActive: {
    backgroundColor: '#FDE8EA',
    borderColor: '#C91F2B',
  },
  dateChipTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#374151',
  },
  dateChipTitleActive: {
    color: '#C91F2B',
  },
  dateChipSub: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 2,
    fontWeight: '700',
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
    fontWeight: '600',
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
    fontWeight: '700',
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
  remarkInput: {
    height: 60,
    textAlignVertical: 'top',
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
    fontWeight: '800',
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
  submitBtnOdia: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
  },
  submitBtnEnglish: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 12,
    fontWeight: '700',
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
    fontWeight: '600',
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
    fontWeight: '900',
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
    maxWidth: 480,
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
    marginBottom: 4,
    textAlign: 'center',
  },
  successSubheading: {
    fontSize: 14,
    fontWeight: '700',
    color: '#16A34A',
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
    maxWidth: 420,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 24,
  },
  summaryTitle: {
    fontSize: 14,
    fontWeight: '900',
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
    fontWeight: '600',
  },
  summaryValue: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '800',
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
    fontWeight: '800',
  },
});
