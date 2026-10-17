import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Platform, ActivityIndicator, Share, Alert, Linking, Modal, Dimensions,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import QRCode from 'react-native-qrcode-svg';
import Toast from 'react-native-toast-message';
import { Colors } from '../../src/theme/colors';
import { Spacing, BorderRadius } from '../../src/theme/spacing';
import { Typography, FontFamily, FontSize } from '../../src/theme/typography';
import { apiGetDealer, apiGenerateDealerQR } from '../../src/services/api';
import { getDealerPublicSlabUrl, APPS_SCRIPT_URL } from '../../src/config/api';
import { Ionicons, MaterialCommunityIcons, Feather } from '@expo/vector-icons';

export default function DealerQRScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [qrRef, setQrRef] = useState<any>(null);
  const [showStandeeModal, setShowStandeeModal] = useState(false);

  const { data: dealer, isLoading } = useQuery({
    queryKey: ['dealer', id],
    queryFn: () => apiGetDealer(id),
    enabled: !!id,
  });

  const syncMutation = useMutation({
    mutationFn: () => apiGenerateDealerQR(id),
    onSuccess: (res) => {
      if (res.success) {
        Toast.show({ type: 'success', text1: 'Cloud Link Synced ✅', text2: 'Saved to Google Sheets.' });
        queryClient.invalidateQueries({ queryKey: ['dealer', id] });
        queryClient.invalidateQueries({ queryKey: ['dealers'] });
      }
    },
    onError: () => {
      // Quiet fail - local dynamic QR is already functional
    },
  });

  // Auto-sync token/link to Google Sheet if missing
  useEffect(() => {
    if (dealer && !dealer.public_slab_link && !syncMutation.isPending) {
      syncMutation.mutate();
    }
  }, [dealer?.dealer_id, dealer?.public_slab_link]);

  if (isLoading) return (
    <View style={styles.center}><ActivityIndicator size="large" color={Colors.primary} /></View>
  );

  if (!dealer) return (
    <View style={styles.center}>
      <MaterialCommunityIcons name="alert-circle-outline" size={48} color={Colors.primary} />
      <Text style={styles.notFoundTitle}>Dealer Not Found</Text>
      <Text style={styles.notFoundSub}>This dealer record may have been removed.</Text>
      <TouchableOpacity style={styles.backButtonSimple} onPress={() => router.back()}><Text style={styles.backButtonText}>‹ Go Back</Text></TouchableOpacity>
    </View>
  );

  // Active live URL — Guaranteed to never be empty
  const slabLink = getDealerPublicSlabUrl(dealer);

  const handleShare = async () => {
    try {
      await Share.share({
        title: `TE CONNECT — Slab Booking for ${dealer.dealer_name}`,
        message: `🏗️ *TE CONNECT — स्लैब ढलाई बुकिंग*\n\nडीलर काउंटर: *${dealer.dealer_name} (${dealer.area || 'Jajpur'})*\n\nमिस्त्री भाई, नीचे दिए गए लिंक पर क्लिक करके 10 सेकंड में स्लैब ढलाई बुक करें:\n${slabLink}`,
        url: slabLink,
      });
    } catch (e) {}
  };

  const handleWhatsAppShare = () => {
    const text = encodeURIComponent(
      `🏗️ *TE CONNECT — स्लैब ढलाई बुकिंग*\n\n` +
      `अधिकृत काउंटर: *${dealer.dealer_name}*\n` +
      `क्षेत्र: *${dealer.area || 'Jajpur Territory'}*\n\n` +
      `मिस्त्री / ठेकेदार भाई, यहाँ क्लिक करके सीधे स्लैब ढलाई रजिस्टर करें:\n` +
      `${slabLink}\n\n` +
      `*(केवल मोबाइल नंबर डालें, बाकी सब 1-क्लिक में हो जाएगा)*`
    );
    Linking.openURL(`https://api.whatsapp.com/send?text=${text}`).catch(() => {
      Linking.openURL(`whatsapp://send?text=${text}`);
    });
  };

  const handleCopyLink = () => {
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(slabLink);
    }
    Toast.show({
      type: 'success',
      text1: 'QR Link Copied! 📋',
      text2: 'WhatsApp या SMS से मिस्त्री को भेजें।',
    });
  };

  const handleOpenBrowser = () => {
    Linking.openURL(slabLink).catch(() => {
      Alert.alert('Unable to open browser', slabLink);
    });
  };

  const openDirections = () => {
    if (dealer.latitude && dealer.longitude) {
      const url = `https://www.google.com/maps/dir/?api=1&destination=${dealer.latitude},${dealer.longitude}`;
      Linking.openURL(url).catch(() => {
        Linking.openURL(`geo:${dealer.latitude},${dealer.longitude}?q=${dealer.latitude},${dealer.longitude}`);
      });
      return;
    }
    if (dealer.address && (dealer.address.startsWith('http://') || dealer.address.startsWith('https://'))) {
      Linking.openURL(dealer.address);
      return;
    }
    const q = encodeURIComponent([dealer.dealer_name, dealer.address, dealer.area, 'Jajpur'].filter(Boolean).join(', '));
    const url = `https://www.google.com/maps/dir/?api=1&destination=${q}`;
    Linking.openURL(url);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>Dealer QR Code</Text>
        <TouchableOpacity onPress={() => setShowStandeeModal(true)} style={styles.printHeaderBtn}>
          <Ionicons name="print-outline" size={22} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Hero Card */}
        <View style={styles.heroCard}>
          <View style={styles.heroIconCircle}>
            <Text style={styles.heroIconText}>{dealer.dealer_name ? dealer.dealer_name.charAt(0).toUpperCase() : 'D'}</Text>
          </View>
          <Text style={styles.heroDealerName}>{dealer.dealer_name}</Text>
          <Text style={styles.heroDealerArea}>{dealer.area || 'Jajpur Territory'}</Text>
          <View style={[styles.activeBadge, { backgroundColor: dealer.active ? Colors.successLight : Colors.statusCancelledBg }]}>
            <Text style={[styles.activeText, { color: dealer.active ? Colors.success : Colors.textSecondary }]}>
              {dealer.active ? '● ACTIVE DEALER COUNTER' : '● INACTIVE'}
            </Text>
          </View>
        </View>

        {/* QR Card */}
        <View style={styles.qrCard}>
          <View style={styles.qrHeaderRow}>
            <View>
              <Text style={styles.qrTitle}>Dealer Slab Entry QR</Text>
              <Text style={styles.qrSub}>मिस्त्री / ग्राहक यह QR स्कैन करके ढलाई बुक करेंगे</Text>
            </View>
            <View style={styles.livePill}>
              <View style={styles.liveDot} />
              <Text style={styles.livePillText}>LIVE QR</Text>
            </View>
          </View>

          {/* QR Code Container - Guaranteed Active */}
          <View style={styles.qrContainer}>
            <QRCode
              value={slabLink}
              size={220}
              color="#111827"
              backgroundColor={Colors.white}
              getRef={setQrRef}
            />
            <View style={styles.qrBrandBar}>
              <Text style={styles.qrBrandText}>🏗️ TE CONNECT · {dealer.dealer_name}</Text>
            </View>
          </View>

          {/* Quick Explainer for Mason / Anpadh users */}
          <View style={styles.counterGuidanceBox}>
            <View style={styles.guideRow}>
              <Text style={styles.guideIcon}>1️⃣</Text>
              <Text style={styles.guideText}>कैमरा / Google Lens से QR स्कैन करें</Text>
            </View>
            <View style={styles.guideRow}>
              <Text style={styles.guideIcon}>2️⃣</Text>
              <Text style={styles.guideText}>केवल 10 अंकों का मोबाइल नंबर डालें (बाकी सब 1-टैप)</Text>
            </View>
            <View style={styles.guideRow}>
              <Text style={styles.guideIcon}>3️⃣</Text>
              <Text style={styles.guideText}>डीलर नाम और लोकेशन ऑटोमैटिक जुड़ जाएगी</Text>
            </View>
          </View>

          {/* Link URL preview */}
          <View style={styles.linkBox}>
            <Text style={styles.linkBoxLabel}>QR WEB LINK:</Text>
            <Text style={styles.linkText} numberOfLines={2}>{slabLink}</Text>
          </View>

          {/* Primary Quick Action Buttons */}
          <View style={styles.primaryActionGrid}>
            <TouchableOpacity style={styles.actionBtnBrowser} onPress={handleOpenBrowser} activeOpacity={0.85}>
              <Ionicons name="globe-outline" size={18} color={Colors.white} style={{ marginRight: 6 }} />
              <Text style={styles.actionBtnBrowserText}>Test Form in Browser</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionBtnWhatsApp} onPress={handleWhatsAppShare} activeOpacity={0.85}>
              <Ionicons name="logo-whatsapp" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={styles.actionBtnWhatsAppText}>Share on WhatsApp</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.secondaryActionRow}>
            <TouchableOpacity style={styles.actionBtnOutline} onPress={handleShare} activeOpacity={0.85}>
              <Ionicons name="share-social-outline" size={16} color={Colors.textPrimary} style={{ marginRight: 6 }} />
              <Text style={styles.actionTextOutline}>Share Link</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtnOutline} onPress={handleCopyLink} activeOpacity={0.85}>
              <Ionicons name="copy-outline" size={16} color={Colors.primary} style={{ marginRight: 6 }} />
              <Text style={[styles.actionTextOutline, { color: Colors.primary }]}>Copy Link</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtnOutline} onPress={() => setShowStandeeModal(true)} activeOpacity={0.85}>
              <Ionicons name="images-outline" size={16} color={Colors.textPrimary} style={{ marginRight: 6 }} />
              <Text style={styles.actionTextOutline}>Standee Card</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Counter Details Card */}
        <View style={styles.detailCard}>
          <Text style={styles.detailCardHeader}>Counter Details</Text>
          <DetailRow icon="barcode-scan" label="Company SAP Code" value={dealer.sap_code ? String(dealer.sap_code) : 'Not Configured'} />
          <DetailRow icon="account-tie" label="Owner Name" value={dealer.owner_name || '—'} />
          <DetailRow icon="phone-outline" label="Contact Mobile" value={dealer.phone ? String(dealer.phone) : '—'} />
          <DetailRow icon="map-marker-outline" label="Shop Address" value={dealer.address || dealer.area || 'Jajpur'} />
          <DetailRow icon="badge-account-horizontal-outline" label="Assigned TE" value={dealer.assigned_te || 'Team Jajpur'} />
          <DetailRow
            icon="shield-check-outline"
            label="QR Status"
            value={dealer.public_slab_link ? '✅ Cloud Synced & Active' : '⚡ Live Auto-Generated'}
          />

          <TouchableOpacity style={styles.directionsBtn} onPress={openDirections} activeOpacity={0.85}>
            <MaterialCommunityIcons name="navigation-variant" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
            <Text style={styles.directionsBtnText}>Get Directions in Google Maps</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: Spacing['5xl'] }} />
      </ScrollView>

      {/* Standee Poster Modal - Ready to screenshot / print for counter */}
      <Modal visible={showStandeeModal} animationType="slide" transparent>
        <View style={modalStyles.overlay}>
          <View style={modalStyles.container}>
            <View style={modalStyles.header}>
              <Text style={modalStyles.modalTitle}>Counter Standee Poster</Text>
              <TouchableOpacity onPress={() => setShowStandeeModal(false)}>
                <Ionicons name="close" size={24} color={Colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={modalStyles.posterScroll}>
              <View style={modalStyles.poster}>
                {/* Brand Top Header */}
                <View style={modalStyles.posterBrandHeader}>
                  <Text style={modalStyles.posterBrandTitle}>TE CONNECT</Text>
                  <Text style={modalStyles.posterBrandSub}>अधिकृत डीलर काउंटर · AUTHORIZED COUNTER</Text>
                </View>

                {/* Dealer Identity */}
                <View style={modalStyles.posterDealerBox}>
                  <Text style={modalStyles.posterDealerName}>{dealer.dealer_name}</Text>
                  <Text style={modalStyles.posterDealerArea}>📍 {dealer.area || dealer.address || 'Jajpur Territory'}</Text>
                  {dealer.phone ? <Text style={modalStyles.posterDealerPhone}>📞 {dealer.phone}</Text> : null}
                </View>

                {/* Big QR Code */}
                <View style={modalStyles.posterQrBox}>
                  <QRCode
                    value={slabLink}
                    size={240}
                    color="#000000"
                    backgroundColor="#FFFFFF"
                  />
                  <Text style={modalStyles.scanPrompt}>📲 मोबाइल कैमरा से स्कैन करें</Text>
                </View>

                {/* Mason Guidance Banner */}
                <View style={modalStyles.posterInstructionCard}>
                  <Text style={modalStyles.instructionHead}>🏗️ स्लैब ढलाई तुरंत बुक करें</Text>
                  <Text style={modalStyles.instructionBullet}>✓ केवल 10 अंकों का मोबाइल नंबर डालें</Text>
                  <Text style={modalStyles.instructionBullet}>✓ 1 क्लिक में सीमेंट बैग (25, 50, 100...) चुनें</Text>
                  <Text style={modalStyles.instructionBullet}>✓ ढलाई की तारीख चुनें (आज / कल / परसों)</Text>
                  <Text style={modalStyles.instructionFooter}>टेक्निकल टीम (TE) द्वारा तुरंत संपर्क किया जाएगा।</Text>
                </View>

                {/* Footer Note */}
                <View style={modalStyles.posterFooter}>
                  <Text style={modalStyles.posterFooterText}>JINDAL CEMENT LTD · JAJPUR DISTRICT</Text>
                </View>
              </View>

              <Text style={modalStyles.hintText}>💡 टिप: इस पोस्टर का स्क्रीनशॉट लें और प्रिंट करके काउंटर पर लगाएं।</Text>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function DetailRow({ icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <View style={detailStyles.row}>
      <View style={detailStyles.iconBox}>
        <MaterialCommunityIcons name={icon} size={20} color={Colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={detailStyles.label}>{label}</Text>
        <Text style={detailStyles.value}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl, backgroundColor: Colors.background },
  notFoundTitle: { fontFamily: FontFamily.displayBold, fontSize: FontSize.lg, color: Colors.textPrimary, marginTop: Spacing.md },
  notFoundSub: { fontFamily: FontFamily.sansRegular, fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: Spacing.xs, textAlign: 'center' },
  backButtonSimple: { marginTop: Spacing.lg, paddingHorizontal: Spacing.lg, paddingVertical: 10, backgroundColor: Colors.primary, borderRadius: BorderRadius.lg },
  backButtonText: { fontFamily: FontFamily.sansBold, color: Colors.white },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: Platform.OS === 'ios' ? 60 : Spacing['2xl'],
    paddingBottom: Spacing.base,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backBtn: { width: 40 },
  printHeaderBtn: { width: 40, alignItems: 'flex-end' },
  title: { fontFamily: FontFamily.displayBold, fontSize: FontSize.lg, color: Colors.textPrimary },
  scroll: { flex: 1, padding: Spacing.lg },

  heroCard: {
    backgroundColor: Colors.primaryDark,
    borderRadius: BorderRadius['2xl'],
    padding: Spacing.xl,
    alignItems: 'center',
    marginBottom: Spacing.lg,
    shadowColor: Colors.primaryDark,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  heroIconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  heroIconText: { fontFamily: FontFamily.displayBlack, fontSize: FontSize['3xl'], color: Colors.white },
  heroDealerName: { fontFamily: FontFamily.displayBold, fontSize: FontSize['2xl'], color: Colors.white, textAlign: 'center' },
  heroDealerArea: { fontFamily: FontFamily.sansSemiBold, fontSize: FontSize.sm, color: 'rgba(255,255,255,0.75)', marginTop: 3 },
  activeBadge: { borderRadius: BorderRadius.md, paddingHorizontal: Spacing.md, paddingVertical: 5, marginTop: Spacing.md },
  activeText: { fontFamily: FontFamily.sansBold, fontSize: 11, letterSpacing: 0.5 },

  qrCard: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius['2xl'],
    padding: Spacing.lg,
    alignItems: 'center',
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 10,
    elevation: 3,
  },
  qrHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    width: '100%',
    marginBottom: Spacing.base,
  },
  qrTitle: { fontFamily: FontFamily.displayBold, fontSize: FontSize.md, color: Colors.textPrimary },
  qrSub: { fontFamily: FontFamily.sansRegular, fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.successLight,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.success },
  livePillText: { fontFamily: FontFamily.sansBold, fontSize: 10, color: Colors.success },

  qrContainer: {
    padding: Spacing.lg,
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.xl,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  qrBrandBar: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    width: '100%',
    alignItems: 'center',
  },
  qrBrandText: { fontFamily: FontFamily.sansBold, fontSize: 11, color: Colors.textSecondary },

  counterGuidanceBox: {
    backgroundColor: '#F9FAFB',
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    width: '100%',
    marginTop: Spacing.md,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 6,
  },
  guideRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  guideIcon: { fontSize: 14 },
  guideText: { fontFamily: FontFamily.sansMedium, fontSize: 12, color: Colors.textPrimary, flex: 1 },

  linkBox: {
    marginTop: Spacing.md,
    backgroundColor: '#FEF2F2',
    borderRadius: BorderRadius.md,
    padding: 10,
    width: '100%',
    borderWidth: 1,
    borderColor: '#FEE2E2',
  },
  linkBoxLabel: { fontFamily: FontFamily.sansBold, fontSize: 10, color: Colors.primary, marginBottom: 2 },
  linkText: { fontSize: 11, color: Colors.textSecondary, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },

  primaryActionGrid: {
    width: '100%',
    gap: 10,
    marginTop: Spacing.lg,
  },
  actionBtnBrowser: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    borderRadius: BorderRadius.lg,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  actionBtnBrowserText: { fontFamily: FontFamily.sansBold, fontSize: FontSize.sm, color: Colors.white },
  actionBtnWhatsApp: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#25D366',
    paddingVertical: 14,
    borderRadius: BorderRadius.lg,
    shadowColor: '#25D366',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  actionBtnWhatsAppText: { fontFamily: FontFamily.sansBold, fontSize: FontSize.sm, color: Colors.white },

  secondaryActionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
    width: '100%',
  },
  actionBtnOutline: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F9FAFB',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    paddingVertical: 10,
    borderRadius: BorderRadius.md,
  },
  actionTextOutline: { fontFamily: FontFamily.sansSemiBold, fontSize: 12, color: Colors.textPrimary },

  detailCard: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius['2xl'],
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.xl,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 10,
    elevation: 3,
  },
  detailCardHeader: { fontFamily: FontFamily.displayBold, fontSize: FontSize.base, color: Colors.textPrimary, marginBottom: Spacing.md },
  directionsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primaryDark,
    paddingVertical: 14,
    borderRadius: BorderRadius.lg,
    marginTop: Spacing.base,
    shadowColor: Colors.primaryDark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  directionsBtnText: { fontFamily: FontFamily.sansBold, fontSize: FontSize.sm, color: Colors.white },
});

const modalStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 16 },
  container: {
    backgroundColor: Colors.white,
    borderRadius: 24,
    maxHeight: '90%',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: { fontFamily: FontFamily.displayBold, fontSize: 17, color: Colors.textPrimary },
  posterScroll: { padding: 16, alignItems: 'center' },
  poster: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 3,
    borderColor: Colors.primary,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  posterBrandHeader: {
    backgroundColor: Colors.primary,
    width: '100%',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 10,
    alignItems: 'center',
    marginBottom: 12,
  },
  posterBrandTitle: { fontFamily: FontFamily.displayBlack, fontSize: 22, color: '#FFFFFF', letterSpacing: 1 },
  posterBrandSub: { fontFamily: FontFamily.sansBold, fontSize: 10, color: 'rgba(255,255,255,0.9)', marginTop: 2 },
  posterDealerBox: { alignItems: 'center', marginBottom: 14 },
  posterDealerName: { fontFamily: FontFamily.displayBold, fontSize: 20, color: '#111827', textAlign: 'center' },
  posterDealerArea: { fontFamily: FontFamily.sansBold, fontSize: 13, color: Colors.primary, marginTop: 2 },
  posterDealerPhone: { fontFamily: FontFamily.sansSemiBold, fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  posterQrBox: {
    padding: 14,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    marginBottom: 14,
  },
  scanPrompt: { fontFamily: FontFamily.sansBold, fontSize: 12, color: Colors.textPrimary, marginTop: 8 },
  posterInstructionCard: {
    width: '100%',
    backgroundColor: '#FEF2F2',
    borderWidth: 1.5,
    borderColor: '#FCA5A5',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  instructionHead: { fontFamily: FontFamily.displayBold, fontSize: 14, color: '#991B1B', marginBottom: 6, textAlign: 'center' },
  instructionBullet: { fontFamily: FontFamily.sansSemiBold, fontSize: 12, color: '#1F2937', marginBottom: 4 },
  instructionFooter: { fontFamily: FontFamily.sansRegular, fontSize: 11, color: '#6B7280', marginTop: 4, textAlign: 'center', fontStyle: 'italic' },
  posterFooter: { borderTopWidth: 1, borderTopColor: '#E5E7EB', width: '100%', paddingTop: 8, alignItems: 'center' },
  posterFooterText: { fontFamily: FontFamily.sansBold, fontSize: 9, color: Colors.textSecondary, letterSpacing: 0.5 },
  hintText: { fontFamily: FontFamily.sansMedium, fontSize: 12, color: Colors.textSecondary, marginTop: 14, textAlign: 'center' },
});

const detailStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.borderLight, gap: Spacing.md },
  iconBox: { width: 36, height: 36, borderRadius: BorderRadius.md, backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  label: { fontFamily: FontFamily.sansSemiBold, fontSize: 11, color: Colors.textSecondary },
  value: { fontFamily: FontFamily.sansBold, fontSize: FontSize.sm, color: Colors.textPrimary, marginTop: 2 },
});
