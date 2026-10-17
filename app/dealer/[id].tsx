import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Platform, ActivityIndicator, Share, Alert, Linking, Modal, Dimensions, Image,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import QRCode from 'react-native-qrcode-svg';
import Toast from 'react-native-toast-message';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
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
  const [downloading, setDownloading] = useState(false);
  const [qrViewMode, setQrViewMode] = useState<'poster' | 'simple'>('poster');

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
    onError: () => {},
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

  // Download / Save QR image
  const handleDownloadQR = () => {
    if (!qrRef) {
      Toast.show({ type: 'error', text1: 'QR Not Ready', text2: 'Please wait a moment for QR to render.' });
      return;
    }

    setDownloading(true);
    qrRef.toDataURL(async (base64Data: string) => {
      try {
        const cleanName = (dealer.dealer_name || 'Dealer').replace(/[^a-zA-Z0-9_-]/g, '_');

        if (Platform.OS === 'web') {
          // Web download
          const link = document.createElement('a');
          link.href = `data:image/png;base64,${base64Data}`;
          link.download = `TE_CONNECT_QR_${cleanName}.png`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          Toast.show({ type: 'success', text1: 'QR Downloaded! 📥', text2: 'Saved to Downloads.' });
        } else {
          // Native mobile (Android / iOS)
          const fileUri = `${FileSystem.cacheDirectory}TE_QR_${cleanName}.png`;
          await FileSystem.writeAsStringAsync(fileUri, base64Data, {
            encoding: FileSystem.EncodingType.Base64,
          });

          if (await Sharing.isAvailableAsync()) {
            await Sharing.shareAsync(fileUri, {
              mimeType: 'image/png',
              dialogTitle: `Save or Print QR for ${dealer.dealer_name}`,
              UTI: 'public.png',
            });
            Toast.show({ type: 'success', text1: 'QR Image Ready ✅', text2: 'Save to Photos or Print.' });
          } else {
            Toast.show({ type: 'success', text1: 'QR Saved', text2: fileUri });
          }
        }
      } catch (err: any) {
        Toast.show({ type: 'error', text1: 'Download Failed', text2: err.message || 'Could not download image.' });
      } finally {
        setDownloading(false);
      }
    });
  };

  // Download Full HD Standee Poster
  const handleDownloadPoster = () => {
    if (!qrRef) {
      Toast.show({ type: 'error', text1: 'QR Not Ready', text2: 'Please wait for QR to load.' });
      return;
    }

    setDownloading(true);
    qrRef.toDataURL(async (qrBase64: string) => {
      try {
        const cleanName = (dealer.dealer_name || 'Dealer').replace(/[^a-zA-Z0-9_-]/g, '_');

        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          let templateUri = '';
          try {
            const resolved = Image.resolveAssetSource(require('../../assets/images/qr-standee-template.jpg'));
            templateUri = resolved?.uri || '';
          } catch (e) {
            templateUri = '/assets/images/qr-standee-template.jpg';
          }

          const bgImg = new (window as any).Image();
          bgImg.crossOrigin = 'anonymous';
          bgImg.src = templateUri;

          await new Promise<void>((resolve, reject) => {
            bgImg.onload = () => resolve();
            bgImg.onerror = () => {
              bgImg.src = require('../../assets/images/qr-standee-template.jpg');
              bgImg.onload = () => resolve();
              bgImg.onerror = () => reject(new Error('Failed to load standee template'));
            };
          });

          const qrImg = new (window as any).Image();
          qrImg.src = `data:image/png;base64,${qrBase64}`;
          await new Promise<void>((resolve, reject) => {
            qrImg.onload = () => resolve();
            qrImg.onerror = () => reject(new Error('Failed to load QR image'));
          });

          const canvas = document.createElement('canvas');
          canvas.width = 682;
          canvas.height = 1024;
          const ctx = canvas.getContext('2d');

          if (ctx) {
            ctx.drawImage(bgImg, 0, 0, 682, 1024);
            ctx.drawImage(qrImg, 74, 624, 214, 214);

            ctx.fillStyle = '#0F172A';
            ctx.font = 'bold 13px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(dealer.dealer_name, 181, 834);

            ctx.fillStyle = '#FFFFFF';
            ctx.font = '900 17px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(dealer.dealer_name.toUpperCase(), 181, 874);

            ctx.fillStyle = '#FEF08A';
            ctx.font = 'bold 13px sans-serif';
            ctx.fillText(`📍 ${dealer.area || dealer.address || 'Jajpur Territory'}`, 181, 894);

            if (dealer.phone) {
              ctx.fillStyle = '#FFFFFF';
              ctx.font = '600 12px sans-serif';
              ctx.fillText(`📞 ${dealer.phone}`, 181, 912);
            }

            const posterData = canvas.toDataURL('image/png');
            const link = document.createElement('a');
            link.href = posterData;
            link.download = `Adani_ACC_Standee_${cleanName}.png`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            Toast.show({
              type: 'success',
              text1: 'Standee Poster Downloaded! 🖼️',
              text2: 'Full HD Print Ready PNG saved.',
            });
          }
        } else {
          handleDownloadQR();
        }
      } catch (err: any) {
        handleDownloadQR();
      } finally {
        setDownloading(false);
      }
    });
  };

  const handleShare = async () => {
    try {
      await Share.share({
        title: `TE CONNECT — Slab Booking for ${dealer.dealer_name}`,
        message: `🏗️ *TE CONNECT — ସ୍ଲାବ୍ ଢଳାଇ ବୁକିଂ (Slab Booking)*\n\nଅନୁମୋଦିତ କାଉଣ୍ଟର: *${dealer.dealer_name} (${dealer.area || 'Jajpur'})*\n\nମିସ୍ତ୍ରୀ / ଗ୍ରାହକ ଭାଇ, ଏହି ଲିଙ୍କ୍ ରେ କ୍ଲିକ୍ କରି ସିଧାସଳଖ ସ୍ଲାବ୍ ଢଳାଇ ବୁକ୍ କରନ୍ତୁ:\n${slabLink}`,
        url: slabLink,
      });
    } catch (e) {}
  };

  const handleWhatsAppShare = () => {
    const text = encodeURIComponent(
      `🏗️ *TE CONNECT — ସ୍ଲାବ୍ ଢଳାଇ ବୁକିଂ (Slab Booking)*\n\n` +
      `ଅନୁମୋଦିତ କାଉଣ୍ଟର: *${dealer.dealer_name}*\n` +
      `ସ୍ଥାନ / Area: *${dealer.area || 'Jajpur Territory'}*\n\n` +
      `ମିସ୍ତ୍ରୀ ଭାଇ, ଏହି ଲିଙ୍କ୍ କ୍ଲିକ୍ କରି ସିଧାସଳଖ ସ୍ଲାବ୍ ଢଳାଇ ବୁକ୍ କରନ୍ତୁ:\n` +
      `${slabLink}\n\n` +
      `*(କେବଳ ୧୦ ଅଙ୍କର ମୋବାଇଲ୍ ନମ୍ବର ଦିଅନ୍ତୁ, ବାକି ସବୁ ୧-କ୍ଲିକ୍ ରେ ବୁକ୍ ହୋଇଯିବ)*`
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
      text2: 'WhatsApp ବା SMS ରେ ମିସ୍ତ୍ରୀଙ୍କୁ ପଠାନ୍ତୁ।',
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
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={styles.title}>Dealer QR Code</Text>
          <Text style={styles.titleSub}>ଡିଲର QR କୋଡ୍</Text>
        </View>
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
          <Text style={styles.heroDealerArea}>📍 {dealer.area || 'Jajpur Territory'}</Text>
          <View style={[styles.activeBadge, { backgroundColor: dealer.active ? Colors.successLight : Colors.statusCancelledBg }]}>
            <Text style={[styles.activeText, { color: dealer.active ? Colors.success : Colors.textSecondary }]}>
              {dealer.active ? '● ଅନୁମୋଦିତ କାଉଣ୍ଟର (ACTIVE DEALER)' : '● INACTIVE'}
            </Text>
          </View>
        </View>

        {/* QR Card */}
        <View style={styles.qrCard}>
          <View style={styles.qrHeaderRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.qrTitle}>Official Counter Standee & QR</Text>
              <Text style={styles.qrSub}>ଆଦାନୀ ଏସିସି ସିମେଣ୍ଟ · ସ୍ଲାବ୍ ଢଳାଇ ବୁକିଂ ପୋଷ୍ଟର</Text>
            </View>
            <View style={styles.livePill}>
              <View style={styles.liveDot} />
              <Text style={styles.livePillText}>LIVE QR</Text>
            </View>
          </View>

          {/* Mode Switcher */}
          <View style={styles.modeSwitcher}>
            <TouchableOpacity
              style={[styles.modeTab, qrViewMode === 'poster' && styles.modeTabActive]}
              onPress={() => setQrViewMode('poster')}
              activeOpacity={0.85}
            >
              <Ionicons
                name="images"
                size={16}
                color={qrViewMode === 'poster' ? Colors.white : Colors.textSecondary}
                style={{ marginRight: 6 }}
              />
              <Text style={[styles.modeTabText, qrViewMode === 'poster' && styles.modeTabTextActive]}>
                Standee Poster 🖼️
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.modeTab, qrViewMode === 'simple' && styles.modeTabActive]}
              onPress={() => setQrViewMode('simple')}
              activeOpacity={0.85}
            >
              <Ionicons
                name="qr-code"
                size={16}
                color={qrViewMode === 'simple' ? Colors.white : Colors.textSecondary}
                style={{ marginRight: 6 }}
              />
              <Text style={[styles.modeTabText, qrViewMode === 'simple' && styles.modeTabTextActive]}>
                Simple QR 📲
              </Text>
            </TouchableOpacity>
          </View>

          {/* QR Display according to mode */}
          {qrViewMode === 'poster' ? (
            <View style={styles.standeePreviewWrap}>
              <View style={styles.standeeMiniCard}>
                <Image
                  source={require('../../assets/images/qr-standee-template.jpg')}
                  style={styles.standeeMiniBg}
                  resizeMode="cover"
                />

                {/* Overlaid QR code in white box with [ ] brackets */}
                <View style={styles.standeeMiniQrBox}>
                  <QRCode
                    value={slabLink}
                    size={78}
                    color="#000000"
                    backgroundColor="#FFFFFF"
                    getRef={setQrRef}
                  />
                  <Text style={styles.standeeMiniQrDealer} numberOfLines={1}>
                    {dealer.dealer_name}
                  </Text>
                </View>

                {/* Overlaid Dealer identity in red banner */}
                <View style={styles.standeeMiniBannerBox}>
                  <Text style={styles.standeeMiniBannerName} numberOfLines={1}>
                    {dealer.dealer_name.toUpperCase()}
                  </Text>
                  <Text style={styles.standeeMiniBannerArea} numberOfLines={1}>
                    📍 {dealer.area || dealer.address || 'Jajpur Territory'}
                  </Text>
                </View>
              </View>
            </View>
          ) : (
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
          )}

          {/* Action Row 1: Direct Download Standee & QR */}
          <View style={styles.topActionRow}>
            <TouchableOpacity
              style={[styles.btnDownloadPosterMain, downloading && { opacity: 0.7 }]}
              onPress={handleDownloadPoster}
              disabled={downloading}
              activeOpacity={0.85}
            >
              {downloading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="images-outline" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                  <Text style={styles.btnDownloadPosterMainText}>Download Standee (HD) 🖼️</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.btnDownloadQRMain, downloading && { opacity: 0.7 }]}
              onPress={handleDownloadQR}
              disabled={downloading}
              activeOpacity={0.85}
            >
              <Ionicons name="qr-code-outline" size={18} color={Colors.primary} style={{ marginRight: 6 }} />
              <Text style={styles.btnDownloadQRMainText}>QR Only 📥</Text>
            </TouchableOpacity>
          </View>

          {/* Action Row 2: Print Standee Modal & WhatsApp */}
          <View style={styles.topActionRow}>
            <TouchableOpacity
              style={styles.btnStandeeSecondary}
              onPress={() => setShowStandeeModal(true)}
              activeOpacity={0.85}
            >
              <Ionicons name="expand-outline" size={18} color={Colors.primary} style={{ marginRight: 6 }} />
              <Text style={styles.btnStandeeSecondaryText}>Full Standee Preview 🖨️</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.btnWhatsAppSecondary}
              onPress={handleWhatsAppShare}
              activeOpacity={0.85}
            >
              <Ionicons name="logo-whatsapp" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={styles.btnWhatsAppSecondaryText}>WhatsApp 💬</Text>
            </TouchableOpacity>
          </View>

          {/* Quick Explainer for Mason / Anpadh users */}
          <View style={styles.counterGuidanceBox}>
            <View style={styles.guideRow}>
              <Text style={styles.guideIcon}>1️⃣</Text>
              <Text style={styles.guideText}>ଫୋନ୍ କ୍ୟାମେରା ବା Google Lens ଦ୍ୱାରା QR ସ୍କାନ୍ କରନ୍ତୁ</Text>
            </View>
            <View style={styles.guideRow}>
              <Text style={styles.guideIcon}>2️⃣</Text>
              <Text style={styles.guideText}>କେବଳ ୧୦ ଅଙ୍କର ମୋବାଇଲ୍ ନମ୍ବର ଦିଅନ୍ତୁ (ବାକି ସବୁ ୧-ଟ୍ୟାପ୍)</Text>
            </View>
            <View style={styles.guideRow}>
              <Text style={styles.guideIcon}>3️⃣</Text>
              <Text style={styles.guideText}>ଡିଲର ନାମ ଓ ଲୋକେସନ୍ ଆପେ ଆପେ ଦର୍ଜ ହୋଇଯିବ</Text>
            </View>
          </View>

          {/* Link URL preview */}
          <View style={styles.linkBox}>
            <Text style={styles.linkBoxLabel}>QR WEB LINK (ଲାଇଭ୍ ଲିଙ୍କ୍):</Text>
            <Text style={styles.linkText} numberOfLines={2}>{slabLink}</Text>
          </View>

          {/* Primary Quick Action Buttons */}
          <View style={styles.primaryActionGrid}>
            <TouchableOpacity style={styles.actionBtnBrowser} onPress={handleOpenBrowser} activeOpacity={0.85}>
              <Ionicons name="globe-outline" size={18} color={Colors.white} style={{ marginRight: 6 }} />
              <Text style={styles.actionBtnBrowserText}>Open & Test Form in Browser 🌐</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionBtnWhatsApp} onPress={handleWhatsAppShare} activeOpacity={0.85}>
              <Ionicons name="logo-whatsapp" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={styles.actionBtnWhatsAppText}>Share on WhatsApp (ହ୍ୱାଟ୍ସଆପ୍)</Text>
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
          </View>
        </View>

        {/* Counter Details Card */}
        <View style={styles.detailCard}>
          <Text style={styles.detailCardHeader}>Counter Details (ଡିଲର ବିବରଣୀ)</Text>
          <DetailRow icon="barcode-scan" label="Company SAP Code" value={dealer.sap_code ? String(dealer.sap_code) : 'Not Configured'} />
          <DetailRow icon="account-tie" label="Owner Name (ମାଲିକଙ୍କ ନାମ)" value={dealer.owner_name || '—'} />
          <DetailRow icon="phone-outline" label="Contact Mobile (ମୋବାଇଲ୍)" value={dealer.phone ? String(dealer.phone) : '—'} />
          <DetailRow icon="map-marker-outline" label="Shop Address (ଠିକଣା)" value={dealer.address || dealer.area || 'Jajpur'} />
          <DetailRow icon="badge-account-horizontal-outline" label="Assigned TE" value={dealer.assigned_te || 'Team Jajpur'} />
          <DetailRow
            icon="shield-check-outline"
            label="QR Status"
            value={dealer.public_slab_link ? '✅ Cloud Synced & Active' : '⚡ Live Auto-Generated'}
          />

          <TouchableOpacity style={styles.directionsBtn} onPress={openDirections} activeOpacity={0.85}>
            <MaterialCommunityIcons name="navigation-variant" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
            <Text style={styles.directionsBtnText}>Google Maps ରେ ଦେଖନ୍ତୁ (Directions)</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: Spacing['5xl'] }} />
      </ScrollView>

      {/* Standee Poster Modal - Ready to screenshot / print for counter */}
      <Modal visible={showStandeeModal} animationType="slide" transparent>
        <View style={modalStyles.overlay}>
          <View style={modalStyles.container}>
            <View style={modalStyles.header}>
              <View>
                <Text style={modalStyles.modalTitle}>Counter Standee Poster</Text>
                <Text style={modalStyles.modalSub}>କାଉଣ୍ଟର ପୋଷ୍ଟର ପ୍ରିଭ୍ୟୁ</Text>
              </View>
              <TouchableOpacity onPress={() => setShowStandeeModal(false)} style={modalStyles.closeBtn}>
                <Ionicons name="close" size={24} color={Colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={modalStyles.posterScroll}>
              {/* Official Adani ACC Cement Standee Poster Container */}
              <View style={modalStyles.standeeFrame}>
                <Image
                  source={require('../../assets/images/qr-standee-template.jpg')}
                  style={modalStyles.standeeBg}
                  resizeMode="cover"
                />

                {/* Overlaid QR code in white card box with [ ] corner brackets */}
                <View style={modalStyles.standeeQrBox}>
                  <QRCode
                    value={slabLink}
                    size={94}
                    color="#000000"
                    backgroundColor="#FFFFFF"
                  />
                  <Text style={modalStyles.standeeQrDealer} numberOfLines={1}>
                    {dealer.dealer_name}
                  </Text>
                </View>

                {/* Overlaid Dealer identity in red bottom banner */}
                <View style={modalStyles.standeeBannerBox}>
                  <Text style={modalStyles.standeeBannerName} numberOfLines={1}>
                    {dealer.dealer_name.toUpperCase()}
                  </Text>
                  <Text style={modalStyles.standeeBannerArea} numberOfLines={1}>
                    📍 {dealer.area || dealer.address || 'Jajpur Territory'}
                  </Text>
                  {dealer.phone ? (
                    <Text style={modalStyles.standeeBannerPhone}>
                      📞 {dealer.phone}
                    </Text>
                  ) : null}
                </View>
              </View>

              {/* Action buttons inside poster modal */}
              <View style={modalStyles.modalBtnRow}>
                <TouchableOpacity
                  style={[modalStyles.modalDownloadBtn, downloading && { opacity: 0.7 }]}
                  onPress={handleDownloadPoster}
                  disabled={downloading}
                  activeOpacity={0.85}
                >
                  <Ionicons name="images-outline" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                  <Text style={modalStyles.modalDownloadBtnText}>Download Poster (HD) 🖼️</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[modalStyles.modalDownloadQrBtn, downloading && { opacity: 0.7 }]}
                  onPress={handleDownloadQR}
                  disabled={downloading}
                  activeOpacity={0.85}
                >
                  <Ionicons name="qr-code-outline" size={18} color={Colors.primary} style={{ marginRight: 6 }} />
                  <Text style={modalStyles.modalDownloadQrBtnText}>QR Only 📥</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={modalStyles.modalShareBtnFull}
                onPress={handleWhatsAppShare}
                activeOpacity={0.85}
              >
                <Ionicons name="logo-whatsapp" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={modalStyles.modalShareBtnText}>Share Poster on WhatsApp 💬</Text>
              </TouchableOpacity>

              <Text style={modalStyles.hintText}>💡 'Download Poster (HD)' ଉପରେ କ୍ଲିକ୍ କରି ଫୁଲ୍ ପ୍ରିଣ୍ଟ-ରେଡି ପୋଷ୍ଟର ଡାଉନଲୋଡ୍ କରନ୍ତୁ ଏବଂ କାଉଣ୍ଟରରେ ଲଗାନ୍ତୁ।</Text>
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
  titleSub: { fontFamily: FontFamily.sansRegular, fontSize: 11, color: Colors.textSecondary, marginTop: 1 },
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
  heroDealerArea: { fontFamily: FontFamily.sansSemiBold, fontSize: FontSize.sm, color: 'rgba(255,255,255,0.85)', marginTop: 3 },
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

  modeSwitcher: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
    width: '100%',
  },
  modeTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    borderRadius: 10,
  },
  modeTabActive: {
    backgroundColor: Colors.primary,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  modeTabText: {
    fontFamily: FontFamily.sansSemiBold,
    fontSize: 12,
    color: Colors.textSecondary,
  },
  modeTabTextActive: {
    color: Colors.white,
    fontFamily: FontFamily.sansBold,
  },
  standeePreviewWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingVertical: 6,
  },
  standeeMiniCard: {
    width: 280,
    height: 420,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 2,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
    backgroundColor: '#FFFFFF',
  },
  standeeMiniBg: {
    width: 280,
    height: 420,
  },
  standeeMiniQrBox: {
    position: 'absolute',
    left: 26,
    top: 252,
    width: 96,
    height: 92,
    alignItems: 'center',
    justifyContent: 'center',
  },
  standeeMiniQrDealer: {
    fontSize: 7,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
    marginTop: 2,
    maxWidth: 90,
  },
  standeeMiniBannerBox: {
    position: 'absolute',
    left: 14,
    top: 352,
    width: 122,
    alignItems: 'center',
    justifyContent: 'center',
  },
  standeeMiniBannerName: {
    fontSize: 9,
    fontWeight: '900',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  standeeMiniBannerArea: {
    fontSize: 7,
    fontWeight: '700',
    color: '#FEF08A',
    textAlign: 'center',
    marginTop: 1,
  },
  topActionRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
    marginTop: Spacing.base,
  },
  btnDownloadPosterMain: {
    flex: 1.4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    paddingVertical: 13,
    borderRadius: BorderRadius.lg,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  btnDownloadPosterMainText: { fontFamily: FontFamily.sansBold, fontSize: 13, color: Colors.white },
  btnDownloadQRMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1.5,
    borderColor: Colors.primary,
    paddingVertical: 13,
    borderRadius: BorderRadius.lg,
  },
  btnDownloadQRMainText: { fontFamily: FontFamily.sansBold, fontSize: 13, color: Colors.primary },
  btnStandeeSecondary: {
    flex: 1.2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F6',
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    paddingVertical: 12,
    borderRadius: BorderRadius.lg,
  },
  btnStandeeSecondaryText: { fontFamily: FontFamily.sansBold, fontSize: 12, color: Colors.textPrimary },
  btnWhatsAppSecondary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#25D366',
    paddingVertical: 12,
    borderRadius: BorderRadius.lg,
  },
  btnWhatsAppSecondaryText: { fontFamily: FontFamily.sansBold, fontSize: 12, color: Colors.white },

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
    marginTop: Spacing.md,
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
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'center', padding: 14 },
  container: {
    backgroundColor: Colors.white,
    borderRadius: 24,
    maxHeight: '92%',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: { fontFamily: FontFamily.displayBold, fontSize: 17, color: Colors.textPrimary },
  modalSub: { fontFamily: FontFamily.sansRegular, fontSize: 11, color: Colors.textSecondary },
  closeBtn: { padding: 4 },
  posterScroll: { padding: 16, alignItems: 'center' },
  standeeFrame: {
    width: 330,
    height: 495,
    borderRadius: 18,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 2.5,
    borderColor: Colors.primary,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
    backgroundColor: '#FFFFFF',
  },
  standeeBg: {
    width: 330,
    height: 495,
  },
  standeeQrBox: {
    position: 'absolute',
    left: 31,
    top: 298,
    width: 113,
    height: 108,
    alignItems: 'center',
    justifyContent: 'center',
  },
  standeeQrDealer: {
    fontSize: 8,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
    marginTop: 2,
    maxWidth: 106,
  },
  standeeBannerBox: {
    position: 'absolute',
    left: 15,
    top: 414,
    width: 145,
    alignItems: 'center',
    justifyContent: 'center',
  },
  standeeBannerName: {
    fontSize: 10,
    fontWeight: '900',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  standeeBannerArea: {
    fontSize: 8,
    fontWeight: '700',
    color: '#FEF08A',
    textAlign: 'center',
    marginTop: 1,
  },
  standeeBannerPhone: {
    fontSize: 8,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    marginTop: 1,
  },
  modalBtnRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
    maxWidth: 340,
    marginTop: 14,
  },
  modalDownloadBtn: {
    flex: 1.4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    paddingVertical: 13,
    borderRadius: BorderRadius.lg,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  modalDownloadBtnText: { fontFamily: FontFamily.sansBold, fontSize: 13, color: '#FFFFFF' },
  modalDownloadQrBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1.5,
    borderColor: Colors.primary,
    paddingVertical: 13,
    borderRadius: BorderRadius.lg,
  },
  modalDownloadQrBtnText: { fontFamily: FontFamily.sansBold, fontSize: 13, color: Colors.primary },
  modalShareBtnFull: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#25D366',
    paddingVertical: 13,
    borderRadius: BorderRadius.lg,
    width: '100%',
    maxWidth: 340,
    marginTop: 10,
  },
  modalShareBtnText: { fontFamily: FontFamily.sansBold, fontSize: 13, color: '#FFFFFF' },
  hintText: { fontFamily: FontFamily.sansMedium, fontSize: 12, color: Colors.textSecondary, marginTop: 12, textAlign: 'center', maxWidth: 340 },
});

const detailStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.borderLight, gap: Spacing.md },
  iconBox: { width: 36, height: 36, borderRadius: BorderRadius.md, backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  label: { fontFamily: FontFamily.sansSemiBold, fontSize: 11, color: Colors.textSecondary },
  value: { fontFamily: FontFamily.sansBold, fontSize: FontSize.sm, color: Colors.textPrimary, marginTop: 2 },
});
