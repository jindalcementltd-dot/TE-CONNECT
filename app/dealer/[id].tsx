import React, { useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Platform, ActivityIndicator, Share, Alert,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import QRCode from 'react-native-qrcode-svg';
import Toast from 'react-native-toast-message';
import { apiGetDealer } from '../../src/services/api';
import { Ionicons, MaterialCommunityIcons, Feather } from '@expo/vector-icons';

export default function DealerQRScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [qrRef, setQrRef] = useState<any>(null);

  const { data: dealer, isLoading } = useQuery({
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
      Toast.show({ type: 'success', text1: 'Link Copied ✅', text2: dealer.public_slab_link });
    }
  };

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#800E20" />
      </View>
    );
  }

  if (!dealer) {
    return (
      <View style={styles.center}>
        <MaterialCommunityIcons name="alert-circle-outline" size={48} color="#800E20" />
        <Text style={styles.notFoundTitle}>Dealer Not Found</Text>
        <Text style={styles.notFoundSub}>This dealer record may have been removed.</Text>
        <TouchableOpacity style={styles.backButtonSimple} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>‹ Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="close" size={24} color="#1F0B10" />
        </TouchableOpacity>
        <Text style={styles.title}>Dealer QR Code</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* ── 1. DEALER HERO CARD ── */}
        <View style={styles.heroCard}>
          <View style={styles.heroIconCircle}>
            <Text style={styles.heroIconText}>{dealer.dealer_name ? dealer.dealer_name.charAt(0).toUpperCase() : 'D'}</Text>
          </View>
          <Text style={styles.heroDealerName}>{dealer.dealer_name}</Text>
          <Text style={styles.heroDealerArea}>{dealer.area || 'Jajpur Territory'}</Text>
          <View style={[styles.activeBadge, { backgroundColor: dealer.active ? '#DCFCE7' : '#F3F4F6' }]}>
            <Text style={[styles.activeText, { color: dealer.active ? '#15803D' : '#6B7280' }]}>
              {dealer.active ? '● ACTIVE DEALER' : '● INACTIVE'}
            </Text>
          </View>
        </View>

        {/* ── 2. QR CODE CARD ── */}
        <View style={styles.qrCard}>
          <Text style={styles.qrTitle}>Dealer Slab Entry QR</Text>
          <Text style={styles.qrSub}>Dealer or contractor scans this to submit casting directly</Text>

          {dealer.public_slab_link ? (
            <View style={styles.qrContainer}>
              <QRCode
                value={qrValue}
                size={210}
                color="#1F0B10"
                backgroundColor="#FFFFFF"
                getRef={setQrRef}
              />
            </View>
          ) : (
            <View style={styles.noQR}>
              <MaterialCommunityIcons name="qrcode-remove" size={48} color="#A0858C" />
              <Text style={styles.noQRText}>No QR Link Configured</Text>
              <Text style={styles.noQRSub}>Generate a link or token in the Google Sheet.</Text>
            </View>
          )}

          {dealer.public_slab_link ? (
            <View style={styles.linkBox}>
              <Text style={styles.linkText} numberOfLines={2}>{dealer.public_slab_link}</Text>
            </View>
          ) : null}

          {/* Action Buttons */}
          <View style={styles.qrActionRow}>
            <TouchableOpacity style={styles.actionBtn} onPress={handleShare} activeOpacity={0.85}>
              <Ionicons name="share-social-outline" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={styles.actionText}>Share Link</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionBtnOutline} onPress={handleCopyLink} activeOpacity={0.85}>
              <Ionicons name="copy-outline" size={18} color="#800E20" style={{ marginRight: 6 }} />
              <Text style={styles.actionTextOutline}>Copy Link</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── 3. DEALER DETAILS CARD ── */}
        <View style={styles.detailCard}>
          <Text style={styles.detailCardHeader}>Counter Details</Text>

          <DetailRow icon="account-tie" label="Owner Name" value={dealer.owner_name || '—'} />
          <DetailRow icon="phone-outline" label="Contact Mobile" value={dealer.phone || '—'} />
          <DetailRow icon="map-marker-outline" label="Shop Address" value={dealer.address || dealer.area || 'Jajpur'} />
          <DetailRow icon="badge-account-horizontal-outline" label="Assigned TE" value={dealer.assigned_te || 'Team Jajpur'} />
          <DetailRow icon="shield-key-outline" label="QR Token Status" value={dealer.qr_token ? '✅ Active Security Token' : '❌ Not Generated'} />
        </View>

        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
}

function DetailRow({ icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <View style={detailStyles.row}>
      <View style={detailStyles.iconBox}>
        <MaterialCommunityIcons name={icon} size={20} color="#800E20" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={detailStyles.label}>{label}</Text>
        <Text style={detailStyles.value}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9F5F6',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#F9F5F6',
  },
  notFoundTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1F0B10',
    marginTop: 12,
  },
  notFoundSub: {
    fontSize: 13,
    color: '#8A7277',
    marginTop: 4,
    textAlign: 'center',
  },
  backButtonSimple: {
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#800E20',
    borderRadius: 12,
  },
  backButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: Platform.OS === 'ios' ? 56 : 36,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F0E2E5',
  },
  backBtn: {
    width: 36,
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

  // 1. Hero Card
  heroCard: {
    backgroundColor: '#4A0611',
    borderRadius: 26,
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#4A0611',
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
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  heroIconText: {
    fontSize: 30,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  heroDealerName: {
    fontSize: 22,
    fontWeight: '900',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  heroDealerArea: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.75)',
    marginTop: 3,
    fontWeight: '600',
  },
  activeBadge: {
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginTop: 12,
  },
  activeText: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5,
  },

  // 2. QR Code Card
  qrCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 22,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: '#EEDCE1',
    shadowColor: 'rgba(78, 5, 17, 0.06)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 10,
    elevation: 3,
  },
  qrTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1F0B10',
    marginBottom: 4,
  },
  qrSub: {
    fontSize: 12,
    color: '#8A7277',
    marginBottom: 18,
    textAlign: 'center',
    lineHeight: 16,
  },
  qrContainer: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#EEDCE1',
    shadowColor: 'rgba(78, 5, 17, 0.08)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 3,
  },
  noQR: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  noQRText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1F0B10',
    marginTop: 8,
  },
  noQRSub: {
    fontSize: 12,
    color: '#8A7277',
    marginTop: 4,
    textAlign: 'center',
  },
  linkBox: {
    marginTop: 16,
    backgroundColor: '#FAF0F2',
    borderRadius: 12,
    padding: 12,
    width: '100%',
    borderWidth: 1,
    borderColor: '#F0D5DA',
  },
  linkText: {
    fontSize: 11,
    color: '#6B4E55',
    textAlign: 'center',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontWeight: '600',
  },
  qrActionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
    width: '100%',
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#800E20',
    paddingVertical: 13,
    borderRadius: 14,
    shadowColor: '#800E20',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  actionText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  actionBtnOutline: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FAF6F7',
    borderWidth: 1.5,
    borderColor: '#800E20',
    paddingVertical: 13,
    borderRadius: 14,
  },
  actionTextOutline: {
    fontSize: 13,
    fontWeight: '800',
    color: '#800E20',
  },

  // 3. Detail Card
  detailCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 18,
    borderWidth: 1.5,
    borderColor: '#EEDCE1',
    marginBottom: 20,
    shadowColor: 'rgba(78, 5, 17, 0.06)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 10,
    elevation: 3,
  },
  detailCardHeader: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1F0B10',
    marginBottom: 10,
  },
});

const detailStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F7EFF1',
    gap: 12,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#FBE8EC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 11,
    color: '#8A7277',
    fontWeight: '600',
  },
  value: {
    fontSize: 14,
    color: '#1F0B10',
    fontWeight: '700',
    marginTop: 2,
  },
});

