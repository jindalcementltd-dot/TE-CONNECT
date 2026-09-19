import React, { useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Platform, ActivityIndicator,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Toast from 'react-native-toast-message';
import { Colors } from '../../src/theme/colors';
import { apiGetSlabs, apiUpdateSlab } from '../../src/services/api';
import { getUser } from '../../src/services/auth';
import { normalizeDate } from '../../src/utils/helpers';
import { Slab, SlabStatus } from '../../src/types';
import { Ionicons, MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import { format } from 'date-fns';

export default function SlabDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [localStatus, setLocalStatus] = useState<SlabStatus | null>(null);

  const { data: slabs, isLoading } = useQuery({
    queryKey: ['slabs'],
    queryFn: () => apiGetSlabs(),
  });

  const slab = (slabs || []).find(s => s.slab_id === id);
  const currentStatus = localStatus || slab?.status || 'UPCOMING';

  const updateMutation = useMutation({
    mutationFn: (newStatus: SlabStatus) => {
      return apiUpdateSlab(id, {
        status: newStatus,
        updated_by: 'Administrator',
      });
    },
    onMutate: async (newStatus) => {
      setLocalStatus(newStatus);
    },
    onSuccess: (res, newStatus) => {
      Toast.show({
        type: 'success',
        text1: 'Status Updated ✅',
        text2: `Slab is now marked as ${newStatus}.`,
      });
      queryClient.invalidateQueries({ queryKey: ['slabs'] });
      queryClient.invalidateQueries({ queryKey: ['todaySummary'] });
    },
    onError: (err: any) => {
      setLocalStatus(null);
      Toast.show({
        type: 'error',
        text1: 'Update Failed',
        text2: err.message || 'Could not update slab status in Google Sheet.',
      });
    },
  });

  const handleSetStatus = async (status: SlabStatus) => {
    if (status === currentStatus) return;
    const user = await getUser();
    updateMutation.mutate(status);
  };

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#800E20" />
      </View>
    );
  }

  if (!slab) {
    return (
      <View style={styles.center}>
        <MaterialCommunityIcons name="alert-circle-outline" size={48} color="#800E20" />
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
  try {
    if (normDate) {
      formattedDate = format(new Date(normDate + 'T00:00:00'), 'EEEE, dd MMMM yyyy');
    }
  } catch {}

  const isCompleted = currentStatus === 'COMPLETED';
  const isCancelled = currentStatus === 'CANCELLED';

  return (
    <View style={styles.container}>
      {/* Top Glass Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="close" size={24} color="#1F0B10" />
        </TouchableOpacity>
        <Text style={styles.title}>Slab Details</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* ── 1. PROTON HERO CARD ── */}
        <View style={styles.heroCard}>
          <View style={styles.heroTop}>
            <View>
              <Text style={styles.heroSubtitle}>CASTING SCHEDULE</Text>
              <Text style={styles.heroDealerName}>{slab.dealer_name}</Text>
            </View>
            <View style={[
              styles.heroStatusBadge,
              isCompleted ? styles.heroStatusComp : isCancelled ? styles.heroStatusCanc : styles.heroStatusUpc
            ]}>
              <Text style={[
                styles.heroStatusBadgeText,
                isCompleted ? { color: '#15803D' } : isCancelled ? { color: '#6B7280' } : { color: '#800E20' }
              ]}>
                {currentStatus}
              </Text>
            </View>
          </View>

          <View style={styles.heroDivider} />

          <View style={styles.heroDateRow}>
            <Ionicons name="calendar" size={18} color="#E53935" style={{ marginRight: 8 }} />
            <Text style={styles.heroDateText}>{formattedDate}</Text>
          </View>
        </View>

        {/* ── 2. INSTANT STATUS CHANGER (1-TAP GLASS CONTROLS) ── */}
        <View style={styles.statusSectionCard}>
          <Text style={styles.sectionHeading}>Update Casting Status</Text>
          <Text style={styles.sectionSubHeading}>Tap below to immediately update Google Sheets:</Text>

          <View style={styles.statusButtonsRow}>
            {/* Upcoming */}
            <TouchableOpacity
              style={[
                styles.statusSelectBtn,
                currentStatus === 'UPCOMING' && styles.statusSelectBtnUpcomingActive
              ]}
              onPress={() => handleSetStatus('UPCOMING')}
              disabled={updateMutation.isPending}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons
                name="clock-outline"
                size={18}
                color={currentStatus === 'UPCOMING' ? '#FFFFFF' : '#800E20'}
              />
              <Text style={[
                styles.statusSelectBtnText,
                currentStatus === 'UPCOMING' && styles.statusSelectBtnTextActive
              ]}>
                Upcoming
              </Text>
            </TouchableOpacity>

            {/* Completed */}
            <TouchableOpacity
              style={[
                styles.statusSelectBtn,
                currentStatus === 'COMPLETED' && styles.statusSelectBtnCompletedActive
              ]}
              onPress={() => handleSetStatus('COMPLETED')}
              disabled={updateMutation.isPending}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons
                name="check-circle"
                size={18}
                color={currentStatus === 'COMPLETED' ? '#FFFFFF' : '#15803D'}
              />
              <Text style={[
                styles.statusSelectBtnText,
                { color: currentStatus === 'COMPLETED' ? '#FFFFFF' : '#15803D' }
              ]}>
                Completed
              </Text>
            </TouchableOpacity>

            {/* Cancelled */}
            <TouchableOpacity
              style={[
                styles.statusSelectBtn,
                currentStatus === 'CANCELLED' && styles.statusSelectBtnCancelledActive
              ]}
              onPress={() => handleSetStatus('CANCELLED')}
              disabled={updateMutation.isPending}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons
                name="close-circle-outline"
                size={18}
                color={currentStatus === 'CANCELLED' ? '#FFFFFF' : '#6B7280'}
              />
              <Text style={[
                styles.statusSelectBtnText,
                { color: currentStatus === 'CANCELLED' ? '#FFFFFF' : '#6B7280' }
              ]}>
                Cancelled
              </Text>
            </TouchableOpacity>
          </View>

          {updateMutation.isPending && (
            <View style={styles.updatingRow}>
              <ActivityIndicator size="small" color="#800E20" />
              <Text style={styles.updatingText}>Syncing with Google Sheet...</Text>
            </View>
          )}
        </View>

        {/* ── 3. FULL DETAILS CARD ── */}
        <View style={styles.detailsCard}>
          <Text style={styles.detailsCardHeader}>Slab Information</Text>

          <DetailRow
            icon="office-building"
            label="Dealer / Shop"
            value={slab.dealer_name}
            highlight
          />

          <DetailRow
            icon="account-hard-hat"
            label="Contractor"
            value={slab.contractor_name || 'No contractor assigned'}
          />

          {slab.customer_name ? (
            <DetailRow
              icon="home-city-outline"
              label="Customer / Site Name"
              value={slab.customer_name}
            />
          ) : null}

          <DetailRow
            icon="package-variant-closed"
            label="Expected Cement"
            value={slab.expected_cement ? `${slab.expected_cement} Bags` : 'Not specified'}
          />

          <DetailRow
            icon="account-tie"
            label="Assigned TE"
            value={slab.assigned_te || 'Team Jajpur'}
          />

          {(slab.latitude && slab.longitude) ? (
            <DetailRow
              icon="map-marker-radius"
              label="Site GPS Coordinates"
              value={`${Number(slab.latitude).toFixed(5)}, ${Number(slab.longitude).toFixed(5)}`}
            />
          ) : null}

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

        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
}

function DetailRow({ icon, label, value, highlight }: { icon: any; label: string; value: string; highlight?: boolean }) {
  return (
    <View style={detailStyles.row}>
      <View style={detailStyles.iconBox}>
        <MaterialCommunityIcons name={icon} size={20} color="#800E20" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={detailStyles.label}>{label}</Text>
        <Text style={[detailStyles.value, highlight && detailStyles.highlightValue]}>{value}</Text>
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
    padding: 22,
    marginBottom: 16,
    shadowColor: '#4A0611',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  heroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  heroSubtitle: {
    fontSize: 10,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.7)',
    letterSpacing: 1.5,
  },
  heroDealerName: {
    fontSize: 22,
    fontWeight: '900',
    color: '#FFFFFF',
    marginTop: 4,
  },
  heroStatusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
  },
  heroStatusUpc: {
    backgroundColor: '#FBE8EC',
    borderColor: '#E8D5DA',
  },
  heroStatusComp: {
    backgroundColor: '#DCFCE7',
    borderColor: '#86EFAC',
  },
  heroStatusCanc: {
    backgroundColor: '#F3F4F6',
    borderColor: '#E5E7EB',
  },
  heroStatusBadgeText: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  heroDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.15)',
    marginVertical: 14,
  },
  heroDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  heroDateText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '700',
  },

  // 2. Status Changer
  statusSectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 18,
    borderWidth: 1.5,
    borderColor: '#EEDCE1',
    marginBottom: 16,
    shadowColor: 'rgba(78, 5, 17, 0.06)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 10,
    elevation: 3,
  },
  sectionHeading: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1F0B10',
  },
  sectionSubHeading: {
    fontSize: 11,
    color: '#8A7277',
    marginTop: 2,
    marginBottom: 12,
  },
  statusButtonsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  statusSelectBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: '#FAF6F7',
    borderWidth: 1.5,
    borderColor: '#EEDCE1',
    gap: 6,
  },
  statusSelectBtnUpcomingActive: {
    backgroundColor: '#800E20',
    borderColor: '#800E20',
  },
  statusSelectBtnCompletedActive: {
    backgroundColor: '#15803D',
    borderColor: '#15803D',
  },
  statusSelectBtnCancelledActive: {
    backgroundColor: '#4B5563',
    borderColor: '#4B5563',
  },
  statusSelectBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#800E20',
  },
  statusSelectBtnTextActive: {
    color: '#FFFFFF',
  },
  updatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    gap: 8,
  },
  updatingText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#800E20',
  },

  // 3. Details Card
  detailsCard: {
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
  detailsCardHeader: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1F0B10',
    marginBottom: 12,
  },
  remarkContainer: {
    backgroundColor: '#FAF0F2',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#F0D5DA',
    marginTop: 8,
    marginBottom: 12,
  },
  remarkLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#800E20',
    marginBottom: 4,
  },
  remarkValue: {
    fontSize: 13,
    color: '#1F0B10',
    lineHeight: 18,
    fontWeight: '500',
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F7EFF1',
  },
  metaText: {
    fontSize: 11,
    color: '#A0858C',
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
  highlightValue: {
    color: '#800E20',
    fontWeight: '900',
    fontSize: 15,
  },
});
