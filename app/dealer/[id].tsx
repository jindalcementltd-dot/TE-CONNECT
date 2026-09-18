import React, { useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Platform, ActivityIndicator, Share, Alert,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import QRCode from 'react-native-qrcode-svg';
import Toast from 'react-native-toast-message';
import { Colors } from '../../src/theme/colors';
import { Spacing, BorderRadius } from '../../src/theme/spacing';
import { apiGetDealer } from '../../src/services/api';
import { Ionicons } from '@expo/vector-icons';

export default function DealerQRScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [qrRef, setQrRef] = useState<any>(null);

  const { data: dealer, isLoading, error } = useQuery({
    queryKey: ['dealer', id],
    queryFn: () => apiGetDealer(id),
    enabled: !!id,
  });

  const qrValue = dealer?.public_slab_link || `TE CONNECT - ${dealer?.dealer_name}`;

  const handleShare = async () => {
    if (!dealer?.public_slab_link) {
      Alert.alert('No Link', 'Please generate a QR link for this dealer first.');
      return;
    }
    await Share.share({
      message: `TE CONNECT - Slab Entry Link for ${dealer.dealer_name}\n\n${dealer.public_slab_link}`,
      url: dealer.public_slab_link,
    });
  };

  const handleCopyLink = () => {
    if (dealer?.public_slab_link) {
      Toast.show({ type: 'success', text1: 'Link Copied', text2: dealer.public_slab_link });
    }
  };

  if (isLoading) return <View style={styles.center}><ActivityIndicator size="large" color={Colors.primary} /></View>;
  if (!dealer) return <View style={styles.center}><Text style={{ color: Colors.textSecondary }}>Dealer not found.</Text></View>;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>Dealer QR Code</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {/* Dealer Info */}
        <View style={styles.dealerCard}>
          <View style={styles.dealerIcon}>
            <Text style={styles.dealerIconText}>{dealer.dealer_name.charAt(0).toUpperCase()}</Text>
          </View>
          <Text style={styles.dealerName}>{dealer.dealer_name}</Text>
          <Text style={styles.dealerArea}>{dealer.area}</Text>
          <View style={[styles.activeBadge, { backgroundColor: dealer.active ? Colors.successLight : Colors.borderLight }]}>
            <Text style={[styles.activeText, { color: dealer.active ? Colors.success : Colors.textMuted }]}>
              {dealer.active ? '● ACTIVE' : '● INACTIVE'}
            </Text>
          </View>
        </View>

        {/* QR Code */}
        <View style={styles.qrCard}>
          <Text style={styles.qrTitle}>Dealer Slab Entry QR</Text>
          <Text style={styles.qrSub}>Dealer scans this to submit a slab</Text>
          {dealer.public_slab_link ? (
            <View style={styles.qrContainer}>
              <QRCode
                value={qrValue}
                size={200}
                color={Colors.textPrimary}
                backgroundColor={Colors.white}
                getRef={setQrRef}
              />
            </View>
          ) : (
            <View style={styles.noQR}>
              <Text style={styles.noQRText}>No QR generated yet.</Text>
              <Text style={styles.noQRSub}>Generate a QR from the admin panel or Google Sheet.</Text>
            </View>
          )}

          {dealer.public_slab_link ? (
            <View style={styles.linkBox}>
              <Text style={styles.linkText} numberOfLines={2}>{dealer.public_slab_link}</Text>
            </View>
          ) : null}
        </View>

        {/* Actions */}
        <View style={styles.actionsCard}>
          <TouchableOpacity style={styles.actionBtn} onPress={handleShare}>
            <Ionicons name="share-outline" size={20} color={Colors.primary} />
            <Text style={styles.actionText}>Share QR / Link</Text>
          </TouchableOpacity>
          <View style={styles.divider} />
          <TouchableOpacity style={styles.actionBtn} onPress={handleCopyLink}>
            <Ionicons name="copy-outline" size={20} color={Colors.primary} />
            <Text style={styles.actionText}>Copy Link</Text>
          </TouchableOpacity>
        </View>

        {/* Dealer Details */}
        <View style={styles.detailCard}>
          <DetailRow label="Owner" value={dealer.owner_name || '—'} />
          <DetailRow label="Phone" value={dealer.phone || '—'} />
          <DetailRow label="Address" value={dealer.address || '—'} />
          <DetailRow label="Assigned TE" value={dealer.assigned_te || '—'} />
          <DetailRow label="QR Token" value={dealer.qr_token ? '✅ Generated' : '❌ Not Generated'} />
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={detailStyles.row}>
      <Text style={detailStyles.label}>{label}</Text>
      <Text style={detailStyles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.base, paddingTop: Platform.OS === 'ios' ? 56 : 36, paddingBottom: 16, backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.border },
  backBtn: { width: 36 },
  title: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary },
  scroll: { flex: 1 },
  scrollContent: { padding: Spacing.base },
  dealerCard: { backgroundColor: Colors.white, borderRadius: BorderRadius.xl, padding: Spacing.xl, alignItems: 'center', marginBottom: Spacing.md, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 },
  dealerIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  dealerIconText: { fontSize: 28, fontWeight: '800', color: Colors.white },
  dealerName: { fontSize: 22, fontWeight: '800', color: Colors.textPrimary },
  dealerArea: { fontSize: 14, color: Colors.textSecondary, marginTop: 4 },
  activeBadge: { borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5, marginTop: 10 },
  activeText: { fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },
  qrCard: { backgroundColor: Colors.white, borderRadius: BorderRadius.xl, padding: Spacing.xl, alignItems: 'center', marginBottom: Spacing.md, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 },
  qrTitle: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary, marginBottom: 4 },
  qrSub: { fontSize: 13, color: Colors.textSecondary, marginBottom: 20 },
  qrContainer: { padding: 16, backgroundColor: Colors.white, borderRadius: 16, borderWidth: 2, borderColor: Colors.border },
  noQR: { alignItems: 'center', paddingVertical: 24 },
  noQRText: { fontSize: 15, fontWeight: '600', color: Colors.textSecondary },
  noQRSub: { fontSize: 12, color: Colors.textMuted, marginTop: 6, textAlign: 'center' },
  linkBox: { marginTop: 16, backgroundColor: Colors.background, borderRadius: 10, padding: 12, width: '100%' },
  linkText: { fontSize: 11, color: Colors.textSecondary, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  actionsCard: { backgroundColor: Colors.white, borderRadius: BorderRadius.xl, marginBottom: Spacing.md, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: Spacing.base },
  actionText: { fontSize: 15, fontWeight: '600', color: Colors.primary },
  divider: { height: 1, backgroundColor: Colors.borderLight, marginLeft: Spacing.base },
  detailCard: { backgroundColor: Colors.white, borderRadius: BorderRadius.xl, padding: Spacing.base, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 },
});

const detailStyles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  label: { fontSize: 13, color: Colors.textSecondary, fontWeight: '500' },
  value: { fontSize: 14, color: Colors.textPrimary, fontWeight: '600', maxWidth: '60%', textAlign: 'right' },
});
