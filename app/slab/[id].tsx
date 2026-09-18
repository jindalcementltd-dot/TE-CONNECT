import React, { useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Platform, Alert, ActivityIndicator,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Toast from 'react-native-toast-message';
import { Colors } from '../../src/theme/colors';
import { Spacing, BorderRadius } from '../../src/theme/spacing';
import { apiGetSlabs, apiUpdateSlab } from '../../src/services/api';
import { getUser } from '../../src/services/auth';
import { formatDate } from '../../src/utils/helpers';
import { Slab } from '../../src/types';
import { Ionicons } from '@expo/vector-icons';

export default function SlabDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const { data: slabs, isLoading } = useQuery({
    queryKey: ['allSlabs'],
    queryFn: () => apiGetSlabs({}),
  });

  const slab = slabs?.find(s => s.slab_id === id);

  const updateMutation = useMutation({
    mutationFn: (data: any) => apiUpdateSlab(id, data),
    onSuccess: () => {
      Toast.show({ type: 'success', text1: 'Updated', text2: 'Slab status updated.' });
      queryClient.invalidateQueries({ queryKey: ['slabs'] });
      queryClient.invalidateQueries({ queryKey: ['allSlabs'] });
    },
    onError: (err: any) => Toast.show({ type: 'error', text1: 'Error', text2: err.message }),
  });

  const updateStatus = async (status: Slab['status']) => {
    const user = await getUser();
    Alert.alert(
      'Update Status',
      `Mark this slab as ${status}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Yes', onPress: () => updateMutation.mutate({ status, updated_by: user?.name || '' }) },
      ]
    );
  };

  if (isLoading) return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color={Colors.primary} />
    </View>
  );

  if (!slab) return (
    <View style={styles.center}>
      <Text style={{ color: Colors.textSecondary }}>Slab not found.</Text>
    </View>
  );

  const statusConfig = {
    UPCOMING: { color: Colors.statusUpcoming, bg: Colors.statusUpcomingBg },
    COMPLETED: { color: Colors.statusCompleted, bg: Colors.statusCompletedBg },
    CANCELLED: { color: Colors.statusCancelled, bg: Colors.statusCancelledBg },
  }[slab.status];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>Slab Details</Text>
        <View style={[styles.statusBadge, { backgroundColor: statusConfig.bg }]}>
          <Text style={[styles.statusText, { color: statusConfig.color }]}>{slab.status}</Text>
        </View>
      </View>

      <ScrollView style={styles.scroll}>
        <View style={styles.dateCard}>
          <Text style={styles.dateLabel}>Slab Date</Text>
          <Text style={styles.dateValue}>{formatDate(slab.slab_date)}</Text>
        </View>

        <View style={styles.card}>
          <DetailRow icon="🏬" label="Dealer" value={slab.dealer_name} />
          <DetailRow icon="👷" label="Contractor" value={slab.contractor_name || '—'} />
          {slab.customer_name && <DetailRow icon="🏠" label="Customer/Site" value={slab.customer_name} />}
          <DetailRow icon="🧱" label="Expected Cement" value={slab.expected_cement || '—'} />
          <DetailRow icon="👤" label="Assigned TE" value={slab.assigned_te || '—'} />
          {(slab.latitude && slab.longitude) && (
            <DetailRow icon="📍" label="Location" value={`${Number(slab.latitude).toFixed(5)}, ${Number(slab.longitude).toFixed(5)}`} />
          )}
          {slab.remark && <DetailRow icon="📝" label="Remark" value={slab.remark} />}
          <DetailRow icon="📡" label="Source" value={slab.source} />
          <DetailRow icon="🕐" label="Added" value={formatDate(slab.created_at)} />
        </View>

        {slab.status === 'UPCOMING' && (
          <View style={styles.actionsCard}>
            <Text style={styles.actionsTitle}>Update Status</Text>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: Colors.statusCompletedBg }]}
              onPress={() => updateStatus('COMPLETED')}
              disabled={updateMutation.isPending}
            >
              <Text style={[styles.actionBtnText, { color: Colors.statusCompleted }]}>✅ Mark as Completed</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: Colors.statusCancelledBg }]}
              onPress={() => updateStatus('CANCELLED')}
              disabled={updateMutation.isPending}
            >
              <Text style={[styles.actionBtnText, { color: Colors.statusCancelled }]}>❌ Mark as Cancelled</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

function DetailRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={detailStyles.row}>
      <Text style={detailStyles.icon}>{icon}</Text>
      <View style={{ flex: 1 }}>
        <Text style={detailStyles.label}>{label}</Text>
        <Text style={detailStyles.value}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.base,
    paddingTop: Platform.OS === 'ios' ? 56 : 36,
    paddingBottom: 16,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backBtn: { width: 36 },
  title: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary, flex: 1, textAlign: 'center' },
  statusBadge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  statusText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  scroll: { flex: 1, padding: Spacing.base },
  dateCard: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  dateLabel: { fontSize: 12, color: 'rgba(255,255,255,0.7)', fontWeight: '500', letterSpacing: 1 },
  dateValue: { fontSize: 26, fontWeight: '800', color: Colors.white, marginTop: 4 },
  card: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.xl,
    padding: Spacing.base,
    marginBottom: Spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  actionsCard: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.xl,
    padding: Spacing.base,
    marginBottom: Spacing.md,
  },
  actionsTitle: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary, marginBottom: 12 },
  actionBtn: { borderRadius: 12, padding: 14, alignItems: 'center', marginBottom: 10 },
  actionBtnText: { fontSize: 15, fontWeight: '600' },
});

const detailStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
    gap: 12,
  },
  icon: { fontSize: 18, width: 24 },
  label: { fontSize: 12, color: Colors.textSecondary, fontWeight: '500', marginBottom: 2 },
  value: { fontSize: 14, color: Colors.textPrimary, fontWeight: '600' },
});
