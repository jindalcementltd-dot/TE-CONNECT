import React, { useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Platform, ActivityIndicator,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Toast from 'react-native-toast-message';
import { Colors } from '../../src/theme/colors';
import { Spacing, BorderRadius } from '../../src/theme/spacing';
import { Typography, FontFamily, FontSize } from '../../src/theme/typography';
import { apiGetSlabs, apiUpdateSlab } from '../../src/services/api';
import { getUser } from '../../src/services/auth';
import { normalizeDate } from '../../src/utils/helpers';
import { Slab, SlabStatus } from '../../src/types';
import { Ionicons, MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import { format } from 'date-fns';
import { useUndo } from '../../src/context/UndoContext';
import { addNotification } from '../../src/services/notifications';

export default function SlabDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { showUndo } = useUndo();
  const [localStatus, setLocalStatus] = useState<SlabStatus | null>(null);

  const { data: slabs, isLoading } = useQuery({ queryKey: ['slabs'], queryFn: () => apiGetSlabs() });

  const slab = (slabs || []).find(s => s.slab_id === id);
  const currentStatus = localStatus || slab?.status || 'UPCOMING';

  const updateMutation = useMutation({
    mutationFn: (newStatus: SlabStatus) => apiUpdateSlab(id, { status: newStatus, updated_by: 'Administrator' }),
    onMutate: async (newStatus) => { setLocalStatus(newStatus); },
    onSuccess: (res, newStatus) => {
      Toast.show({ type: 'success', text1: 'Status Updated ✅', text2: `Slab is now marked as ${newStatus}.` });
      queryClient.invalidateQueries({ queryKey: ['slabs'] });
      queryClient.invalidateQueries({ queryKey: ['todaySummary'] });
      addNotification(
        `🏗️ Slab ${newStatus} (${slab?.dealer_name || 'Dealer'})`,
        `Contractor: ${slab?.contractor_name || 'N/A'} · Cement: ${slab?.expected_cement || 'N/A'}`,
        'SLAB'
      );
    },
    onError: (err: any) => {
      setLocalStatus(null);
      Toast.show({ type: 'error', text1: 'Update Failed', text2: err.message || 'Could not update slab status.' });
    },
  });

  const handleSetStatus = async (status: SlabStatus) => {
    if (status === currentStatus) return;
    const previousStatus = currentStatus;
    updateMutation.mutate(status);
    showUndo(`Slab marked as ${status}`, () => {
      updateMutation.mutate(previousStatus);
      Toast.show({ type: 'info', text1: 'Undone ↩️', text2: `Slab restored to ${previousStatus}.` });
    }, 5);
  };

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (!slab) {
    return (
      <View style={styles.center}>
        <MaterialCommunityIcons name="alert-circle-outline" size={48} color={Colors.primary} />
        <Text style={styles.notFoundTitle}>Slab Not Found</Text>
        <Text style={styles.notFoundSub}>This slab record may have been removed.</Text>
        <TouchableOpacity style={styles.backButtonSimple} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>‹ Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const normDate = normalizeDate(slab.slab_date);
  let formattedDate = normDate;
  try { if (normDate) formattedDate = format(new Date(normDate + 'T00:00:00'), 'EEEE, dd MMMM yyyy'); } catch {}

  const isCompleted = currentStatus === 'COMPLETED';
  const isCancelled = currentStatus === 'CANCELLED';

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}><Ionicons name="close" size={24} color={Colors.textPrimary} /></TouchableOpacity>
        <Text style={styles.title}>Slab Details</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.heroCard}>
          <View style={styles.heroTop}>
            <View>
              <Text style={styles.heroSubtitle}>CASTING SCHEDULE</Text>
              <Text style={styles.heroDealerName}>{slab.dealer_name}</Text>
            </View>
            <View style={[styles.heroStatusBadge, isCompleted ? styles.heroStatusComp : isCancelled ? styles.heroStatusCanc : styles.heroStatusUpc]}>
              <Text style={[styles.heroStatusBadgeText, isCompleted ? { color: Colors.success } : isCancelled ? { color: Colors.statusCancelled } : { color: Colors.primary }]}>{currentStatus}</Text>
            </View>
          </View>
          <View style={styles.heroDivider} />
          <View style={styles.heroDateRow}>
            <Ionicons name="calendar" size={18} color={Colors.primaryLight} style={{ marginRight: 8 }} />
            <Text style={styles.heroDateText}>{formattedDate}</Text>
          </View>
        </View>

        <View style={styles.statusSectionCard}>
          <Text style={styles.sectionHeading}>Update Casting Status</Text>
          <Text style={styles.sectionSubHeading}>Tap below to immediately update Google Sheets:</Text>

          <View style={styles.statusButtonsRow}>
            <TouchableOpacity style={[styles.statusSelectBtn, currentStatus === 'UPCOMING' && styles.statusSelectBtnUpcomingActive]} onPress={() => handleSetStatus('UPCOMING')} disabled={updateMutation.isPending} activeOpacity={0.8}>
              <MaterialCommunityIcons name="clock-outline" size={18} color={currentStatus === 'UPCOMING' ? Colors.white : Colors.primary} />
              <Text style={[styles.statusSelectBtnText, currentStatus === 'UPCOMING' && styles.statusSelectBtnTextActive]}>Upcoming</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.statusSelectBtn, currentStatus === 'COMPLETED' && styles.statusSelectBtnCompletedActive]} onPress={() => handleSetStatus('COMPLETED')} disabled={updateMutation.isPending} activeOpacity={0.8}>
              <MaterialCommunityIcons name="check-circle" size={18} color={currentStatus === 'COMPLETED' ? Colors.white : Colors.success} />
              <Text style={[styles.statusSelectBtnText, { color: currentStatus === 'COMPLETED' ? Colors.white : Colors.success }]}>Completed</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.statusSelectBtn, currentStatus === 'CANCELLED' && styles.statusSelectBtnCancelledActive]} onPress={() => handleSetStatus('CANCELLED')} disabled={updateMutation.isPending} activeOpacity={0.8}>
              <MaterialCommunityIcons name="close-circle-outline" size={18} color={currentStatus === 'CANCELLED' ? Colors.white : Colors.textSecondary} />
              <Text style={[styles.statusSelectBtnText, { color: currentStatus === 'CANCELLED' ? Colors.white : Colors.textSecondary }]}>Cancelled</Text>
            </TouchableOpacity>
          </View>

          {updateMutation.isPending && (
            <View style={styles.updatingRow}>
              <ActivityIndicator size="small" color={Colors.primary} />
              <Text style={styles.updatingText}>Syncing with Google Sheet...</Text>
            </View>
          )}
        </View>

        <View style={styles.detailsCard}>
          <Text style={styles.detailsCardHeader}>Slab Information</Text>
          <DetailRow icon="office-building" label="Dealer / Shop" value={slab.dealer_name} highlight />
          <DetailRow icon="account-hard-hat" label="Contractor" value={slab.contractor_name || 'No contractor assigned'} />
          {slab.customer_name ? <DetailRow icon="home-city-outline" label="Customer / Site Name" value={slab.customer_name} /> : null}
          <DetailRow icon="package-variant-closed" label="Expected Cement" value={slab.expected_cement ? `${slab.expected_cement} Bags` : 'Not specified'} />
          <DetailRow icon="account-tie" label="Assigned TE" value={slab.assigned_te || 'Team Jajpur'} />
          {(slab.latitude && slab.longitude) ? <DetailRow icon="map-marker-radius" label="Site GPS Coordinates" value={`${Number(slab.latitude).toFixed(5)}, ${Number(slab.longitude).toFixed(5)}`} /> : null}
          {slab.remark ? (
            <View style={styles.remarkContainer}>
              <Text style={styles.remarkLabel}>Remarks / Notes / Address:</Text>
              <Text style={styles.remarkValue}>{slab.remark}</Text>
            </View>
          ) : null}
          <View style={styles.metaRow}>
            <Text style={styles.metaText}>Source: {slab.source || 'APP'}</Text>
            <Text style={styles.metaText}>Created by: {slab.created_by || 'Admin'}</Text>
          </View>
        </View>
        <View style={{ height: Spacing['5xl'] }} />
      </ScrollView>
    </View>
  );
}

function DetailRow({ icon, label, value, highlight }: { icon: any; label: string; value: string; highlight?: boolean }) {
  return (
    <View style={detailStyles.row}>
      <View style={detailStyles.iconBox}><MaterialCommunityIcons name={icon} size={20} color={Colors.primary} /></View>
      <View style={{ flex: 1 }}>
        <Text style={detailStyles.label}>{label}</Text>
        <Text style={[detailStyles.value, highlight && detailStyles.highlightValue]}>{value}</Text>
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

  heroCard: { backgroundColor: Colors.primaryDark, borderRadius: BorderRadius['2xl'], padding: Spacing.xl, marginBottom: Spacing.lg, shadowColor: Colors.primaryDark, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.35, shadowRadius: 16, elevation: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  heroSubtitle: { fontFamily: FontFamily.sansBold, fontSize: 10, color: 'rgba(255,255,255,0.7)', letterSpacing: 1.5 },
  heroDealerName: { fontFamily: FontFamily.displayBlack, fontSize: FontSize['2xl'], color: Colors.white, marginTop: 4 },
  heroStatusBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: BorderRadius.md, borderWidth: 1 },
  heroStatusUpc: { backgroundColor: Colors.primaryLight, borderColor: Colors.borderLight },
  heroStatusComp: { backgroundColor: Colors.successLight, borderColor: Colors.success },
  heroStatusCanc: { backgroundColor: Colors.statusCancelledBg, borderColor: Colors.border },
  heroStatusBadgeText: { fontFamily: FontFamily.sansBold, fontSize: 11, letterSpacing: 0.5 },
  heroDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.15)', marginVertical: 14 },
  heroDateRow: { flexDirection: 'row', alignItems: 'center' },
  heroDateText: { fontFamily: FontFamily.sansBold, fontSize: FontSize.sm, color: Colors.white },

  statusSectionCard: { backgroundColor: Colors.surface, borderRadius: BorderRadius['2xl'], padding: Spacing.lg, borderWidth: 1, borderColor: Colors.border, marginBottom: Spacing.lg, shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 10, elevation: 3 },
  sectionHeading: { fontFamily: FontFamily.displayBold, fontSize: FontSize.base, color: Colors.textPrimary },
  sectionSubHeading: { fontFamily: FontFamily.sansRegular, fontSize: 11, color: Colors.textSecondary, marginTop: 2, marginBottom: Spacing.md },
  statusButtonsRow: { flexDirection: 'row', gap: Spacing.sm },
  statusSelectBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: BorderRadius.lg, backgroundColor: Colors.background, borderWidth: 1, borderColor: Colors.border, gap: 6 },
  statusSelectBtnUpcomingActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  statusSelectBtnCompletedActive: { backgroundColor: Colors.success, borderColor: Colors.success },
  statusSelectBtnCancelledActive: { backgroundColor: Colors.statusCancelled, borderColor: Colors.statusCancelled },
  statusSelectBtnText: { fontFamily: FontFamily.sansBold, fontSize: FontSize.xs, color: Colors.primary },
  statusSelectBtnTextActive: { color: Colors.white },
  updatingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: Spacing.md, gap: Spacing.sm },
  updatingText: { fontFamily: FontFamily.sansMedium, fontSize: FontSize.xs, color: Colors.primary },

  detailsCard: { backgroundColor: Colors.surface, borderRadius: BorderRadius['2xl'], padding: Spacing.lg, borderWidth: 1, borderColor: Colors.border, marginBottom: Spacing.xl, shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 10, elevation: 3 },
  detailsCardHeader: { fontFamily: FontFamily.displayBold, fontSize: FontSize.base, color: Colors.textPrimary, marginBottom: Spacing.md },
  remarkContainer: { backgroundColor: Colors.primaryLight, borderRadius: BorderRadius.lg, padding: Spacing.md, borderWidth: 1, borderColor: Colors.borderLight, marginTop: Spacing.sm, marginBottom: Spacing.md },
  remarkLabel: { fontFamily: FontFamily.sansBold, fontSize: 11, color: Colors.primary, marginBottom: 4 },
  remarkValue: { fontFamily: FontFamily.sansRegular, fontSize: FontSize.sm, color: Colors.textPrimary, lineHeight: 18 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: Spacing.md, borderTopWidth: 1, borderTopColor: Colors.borderLight },
  metaText: { fontFamily: FontFamily.sansRegular, fontSize: 11, color: Colors.textMuted },
});

const detailStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.borderLight, gap: Spacing.md },
  iconBox: { width: 36, height: 36, borderRadius: BorderRadius.md, backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  label: { fontFamily: FontFamily.sansSemiBold, fontSize: 11, color: Colors.textSecondary },
  value: { fontFamily: FontFamily.sansBold, fontSize: FontSize.sm, color: Colors.textPrimary, marginTop: 2 },
  highlightValue: { fontFamily: FontFamily.sansBold, color: Colors.primary, fontSize: FontSize.base },
});
