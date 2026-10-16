import React, { useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Platform, ActivityIndicator, Share, Alert, Linking,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import QRCode from 'react-native-qrcode-svg';
import Toast from 'react-native-toast-message';
import { Colors } from '../../src/theme/colors';
import { Spacing, BorderRadius } from '../../src/theme/spacing';
import { Typography, FontFamily, FontSize } from '../../src/theme/typography';
import { apiGetDealer } from '../../src/services/api';
import { Ionicons, MaterialCommunityIcons, Feather } from '@expo/vector-icons';

export default function DealerQRScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [qrRef, setQrRef] = useState<any>(null);

  const { data: dealer, isLoading } = useQuery({ queryKey: ['dealer', id], queryFn: () => apiGetDealer(id), enabled: !!id });

  const qrValue = dealer?.public_slab_link || `TE CONNECT - ${dealer?.dealer_name}`;

  const handleShare = async () => {
    if (!dealer?.public_slab_link) { Alert.alert('No Link', 'Please generate a QR link for this dealer first.'); return; }
    await Share.share({ message: `TE CONNECT - Slab Entry Link for ${dealer.dealer_name}\n\n${dealer.public_slab_link}`, url: dealer.public_slab_link });
  };

  const handleCopyLink = () => {
    if (dealer?.public_slab_link) Toast.show({ type: 'success', text1: 'Link Copied ✅', text2: dealer.public_slab_link });
  };

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
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}><Ionicons name="close" size={24} color={Colors.textPrimary} /></TouchableOpacity>
        <Text style={styles.title}>Dealer QR Code</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.heroCard}>
          <View style={styles.heroIconCircle}><Text style={styles.heroIconText}>{dealer.dealer_name ? dealer.dealer_name.charAt(0).toUpperCase() : 'D'}</Text></View>
          <Text style={styles.heroDealerName}>{dealer.dealer_name}</Text>
          <Text style={styles.heroDealerArea}>{dealer.area || 'Jajpur Territory'}</Text>
          <View style={[styles.activeBadge, { backgroundColor: dealer.active ? Colors.successLight : Colors.statusCancelledBg }]}>
            <Text style={[styles.activeText, { color: dealer.active ? Colors.success : Colors.textSecondary }]}>{dealer.active ? '● ACTIVE DEALER' : '● INACTIVE'}</Text>
          </View>
        </View>

        <View style={styles.qrCard}>
          <Text style={styles.qrTitle}>Dealer Slab Entry QR</Text>
          <Text style={styles.qrSub}>Dealer or contractor scans this to submit casting directly</Text>

          {dealer.public_slab_link ? (
            <View style={styles.qrContainer}>
              <QRCode value={qrValue} size={210} color={Colors.textPrimary} backgroundColor={Colors.white} getRef={setQrRef} />
            </View>
          ) : (
            <View style={styles.noQR}>
              <MaterialCommunityIcons name="qrcode-remove" size={48} color={Colors.textMuted} />
              <Text style={styles.noQRText}>No QR Link Configured</Text>
              <Text style={styles.noQRSub}>Generate a link or token in the Google Sheet.</Text>
            </View>
          )}

          {dealer.public_slab_link ? (
            <View style={styles.linkBox}>
              <Text style={styles.linkText} numberOfLines={2}>{dealer.public_slab_link}</Text>
            </View>
          ) : null}

          <View style={styles.qrActionRow}>
            <TouchableOpacity style={styles.actionBtn} onPress={handleShare} activeOpacity={0.85}>
              <Ionicons name="share-social-outline" size={18} color={Colors.white} style={{ marginRight: 6 }} />
              <Text style={styles.actionText}>Share Link</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtnOutline} onPress={handleCopyLink} activeOpacity={0.85}>
              <Ionicons name="copy-outline" size={18} color={Colors.primary} style={{ marginRight: 6 }} />
              <Text style={styles.actionTextOutline}>Copy Link</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.detailCard}>
          <Text style={styles.detailCardHeader}>Counter Details</Text>
          <DetailRow icon="barcode-scan" label="Company SAP Code" value={dealer.sap_code ? dealer.sap_code : 'Not Configured'} />
          <DetailRow icon="account-tie" label="Owner Name" value={dealer.owner_name || '—'} />
          <DetailRow icon="phone-outline" label="Contact Mobile" value={dealer.phone || '—'} />
          <DetailRow icon="map-marker-outline" label="Shop Address" value={dealer.address || dealer.area || 'Jajpur'} />
          <DetailRow icon="badge-account-horizontal-outline" label="Assigned TE" value={dealer.assigned_te || 'Team Jajpur'} />
          <DetailRow icon="shield-key-outline" label="QR Token Status" value={dealer.qr_token ? '✅ Active Security Token' : '❌ Not Generated'} />

          <TouchableOpacity style={styles.directionsBtn} onPress={openDirections} activeOpacity={0.85}>
            <MaterialCommunityIcons name="navigation-variant" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
            <Text style={styles.directionsBtnText}>Get Directions in Google Maps</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: Spacing['5xl'] }} />
      </ScrollView>
    </View>
  );
}

function DetailRow({ icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <View style={detailStyles.row}>
      <View style={detailStyles.iconBox}><MaterialCommunityIcons name={icon} size={20} color={Colors.primary} /></View>
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
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.lg, paddingTop: Platform.OS === 'ios' ? 60 : Spacing['2xl'], paddingBottom: Spacing.base, backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border },
  backBtn: { width: 40 },
  title: { fontFamily: FontFamily.displayBold, fontSize: FontSize.lg, color: Colors.textPrimary },
  scroll: { flex: 1, padding: Spacing.lg },

  heroCard: { backgroundColor: Colors.primaryDark, borderRadius: BorderRadius['2xl'], padding: Spacing.xl, alignItems: 'center', marginBottom: Spacing.lg, shadowColor: Colors.primaryDark, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.35, shadowRadius: 16, elevation: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  heroIconCircle: { width: 68, height: 68, borderRadius: 34, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.md, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.25)' },
  heroIconText: { fontFamily: FontFamily.displayBlack, fontSize: FontSize['3xl'], color: Colors.white },
  heroDealerName: { fontFamily: FontFamily.displayBold, fontSize: FontSize['2xl'], color: Colors.white, textAlign: 'center' },
  heroDealerArea: { fontFamily: FontFamily.sansSemiBold, fontSize: FontSize.sm, color: 'rgba(255,255,255,0.75)', marginTop: 3 },
  activeBadge: { borderRadius: BorderRadius.md, paddingHorizontal: Spacing.md, paddingVertical: 5, marginTop: Spacing.md },
  activeText: { fontFamily: FontFamily.sansBold, fontSize: 11, letterSpacing: 0.5 },

  qrCard: { backgroundColor: Colors.surface, borderRadius: BorderRadius['2xl'], padding: Spacing.xl, alignItems: 'center', marginBottom: Spacing.lg, borderWidth: 1, borderColor: Colors.border, shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 10, elevation: 3 },
  qrTitle: { fontFamily: FontFamily.displayBold, fontSize: FontSize.md, color: Colors.textPrimary, marginBottom: 4 },
  qrSub: { fontFamily: FontFamily.sansRegular, fontSize: FontSize.xs, color: Colors.textSecondary, marginBottom: Spacing.lg, textAlign: 'center', lineHeight: 16 },
  qrContainer: { padding: Spacing.lg, backgroundColor: Colors.white, borderRadius: BorderRadius.xl, borderWidth: 2, borderColor: Colors.borderLight, shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 8, elevation: 3 },
  noQR: { alignItems: 'center', paddingVertical: Spacing.xl },
  noQRText: { fontFamily: FontFamily.displayBold, fontSize: FontSize.base, color: Colors.textPrimary, marginTop: Spacing.sm },
  noQRSub: { fontFamily: FontFamily.sansRegular, fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 4, textAlign: 'center' },
  linkBox: { marginTop: Spacing.lg, backgroundColor: Colors.primaryLight, borderRadius: BorderRadius.lg, padding: Spacing.md, width: '100%', borderWidth: 1, borderColor: Colors.borderLight },
  linkText: { fontSize: 11, color: Colors.textSecondary, textAlign: 'center', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  qrActionRow: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.lg, width: '100%' },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.primary, paddingVertical: 13, borderRadius: BorderRadius.lg, shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 6, elevation: 4 },
  actionText: { fontFamily: FontFamily.sansBold, fontSize: FontSize.sm, color: Colors.white },
  actionBtnOutline: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.background, borderWidth: 1, borderColor: Colors.primary, paddingVertical: 13, borderRadius: BorderRadius.lg },
  actionTextOutline: { fontFamily: FontFamily.sansBold, fontSize: FontSize.sm, color: Colors.primary },

  detailCard: { backgroundColor: Colors.surface, borderRadius: BorderRadius['2xl'], padding: Spacing.lg, borderWidth: 1, borderColor: Colors.border, marginBottom: Spacing.xl, shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 10, elevation: 3 },
  detailCardHeader: { fontFamily: FontFamily.displayBold, fontSize: FontSize.base, color: Colors.textPrimary, marginBottom: Spacing.md },
  directionsBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.primary, paddingVertical: 14, borderRadius: BorderRadius.lg, marginTop: Spacing.base, shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 6, elevation: 4 },
  directionsBtnText: { fontFamily: FontFamily.sansBold, fontSize: FontSize.sm, color: Colors.white },
});

const detailStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.borderLight, gap: Spacing.md },
  iconBox: { width: 36, height: 36, borderRadius: BorderRadius.md, backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  label: { fontFamily: FontFamily.sansSemiBold, fontSize: 11, color: Colors.textSecondary },
  value: { fontFamily: FontFamily.sansBold, fontSize: FontSize.sm, color: Colors.textPrimary, marginTop: 2 },
});
