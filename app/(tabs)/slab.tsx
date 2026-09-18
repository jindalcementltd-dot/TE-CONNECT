import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { Calendar } from 'react-native-calendars';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Colors } from '../../src/theme/colors';
import { Spacing, BorderRadius } from '../../src/theme/spacing';
import { apiGetSlabs } from '../../src/services/api';
import { getUser } from '../../src/services/auth';
import { formatDate, currentMonthISO } from '../../src/utils/helpers';
import { Slab } from '../../src/types';
import { Ionicons } from '@expo/vector-icons';
import { format, startOfMonth, endOfMonth } from 'date-fns';

function SlabStatusBadge({ status }: { status: Slab['status'] }) {
  const config = {
    UPCOMING: { bg: Colors.statusUpcomingBg, text: Colors.statusUpcoming, label: 'UPCOMING' },
    COMPLETED: { bg: Colors.statusCompletedBg, text: Colors.statusCompleted, label: 'COMPLETED' },
    CANCELLED: { bg: Colors.statusCancelledBg, text: Colors.statusCancelled, label: 'CANCELLED' },
  }[status];
  return (
    <View style={[badgeStyles.container, { backgroundColor: config.bg }]}>
      <Text style={[badgeStyles.text, { color: config.text }]}>{config.label}</Text>
    </View>
  );
}

function SlabCard({ slab, onPress }: { slab: Slab; onPress: () => void }) {
  return (
    <TouchableOpacity style={cardStyles.card} onPress={onPress} activeOpacity={0.85}>
      <View style={cardStyles.header}>
        <View style={{ flex: 1 }}>
          <Text style={cardStyles.dealer}>{slab.dealer_name}</Text>
          <Text style={cardStyles.contractor}>{slab.contractor_name}</Text>
        </View>
        <SlabStatusBadge status={slab.status} />
      </View>
      {slab.customer_name ? (
        <Text style={cardStyles.row}>🏠 {slab.customer_name}</Text>
      ) : null}
      <View style={cardStyles.detailRow}>
        {slab.expected_cement ? <Text style={cardStyles.detail}>🧱 {slab.expected_cement}</Text> : null}
        {slab.assigned_te ? <Text style={cardStyles.detail}>👤 {slab.assigned_te}</Text> : null}
        {slab.source === 'DEALER_QR' && (
          <View style={cardStyles.qrBadge}><Text style={cardStyles.qrText}>QR</Text></View>
        )}
      </View>
      {(slab.latitude && slab.longitude) ? (
        <Text style={cardStyles.location}>📍 Location saved</Text>
      ) : null}
    </TouchableOpacity>
  );
}

export default function SlabScreen() {
  const today = new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState(today);
  const [currentMonth, setCurrentMonth] = useState(currentMonthISO());
  const [refreshing, setRefreshing] = useState(false);

  const { data: slabs, isLoading, refetch } = useQuery({
    queryKey: ['slabs', currentMonth],
    queryFn: () => apiGetSlabs({ month: currentMonth }),
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  // Build marked dates for calendar
  const markedDates: Record<string, any> = {};
  (slabs || []).forEach(slab => {
    const date = slab.slab_date.split('T')[0];
    if (!markedDates[date]) {
      markedDates[date] = { dots: [], marked: true };
    }
    markedDates[date].dots = markedDates[date].dots || [];
    markedDates[date].dots.push({ color: Colors.primary });
  });

  // Selected date highlighting
  if (selectedDate) {
    markedDates[selectedDate] = {
      ...markedDates[selectedDate],
      selected: true,
      selectedColor: Colors.primary,
    };
  }

  const selectedSlabs = (slabs || []).filter(s =>
    s.slab_date.split('T')[0] === selectedDate
  );

  const selectedDateLabel = selectedDate
    ? format(new Date(selectedDate), 'dd MMMM yyyy')
    : '';

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Slabs</Text>
          <Text style={styles.headerSub}>Slab Casting Calendar</Text>
        </View>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => router.push('/slab/add')}
        >
          <Ionicons name="add" size={22} color={Colors.white} />
          <Text style={styles.addBtnText}>Add Slab</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      >
        {/* Calendar */}
        <View style={styles.calendarContainer}>
          <Calendar
            current={currentMonth + '-01'}
            onDayPress={(day: any) => setSelectedDate(day.dateString)}
            onMonthChange={(month: any) => {
              setCurrentMonth(month.dateString.substring(0, 7));
            }}
            markedDates={markedDates}
            markingType="multi-dot"
            theme={{
              backgroundColor: Colors.white,
              calendarBackground: Colors.white,
              textSectionTitleColor: Colors.textSecondary,
              selectedDayBackgroundColor: Colors.primary,
              selectedDayTextColor: Colors.white,
              todayTextColor: Colors.primary,
              dayTextColor: Colors.textPrimary,
              textDisabledColor: Colors.textMuted,
              arrowColor: Colors.primary,
              monthTextColor: Colors.textPrimary,
              textMonthFontWeight: '700',
              textDayFontWeight: '500',
              textDayHeaderFontWeight: '600',
              dotColor: Colors.primary,
              selectedDotColor: Colors.white,
            }}
          />
        </View>

        {/* Loading */}
        {isLoading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color={Colors.primary} />
            <Text style={styles.loadingText}>Loading slabs...</Text>
          </View>
        )}

        {/* Selected Date Slabs */}
        <View style={styles.selectedSection}>
          <View style={styles.selectedHeader}>
            <Text style={styles.selectedDate}>{selectedDateLabel}</Text>
            <View style={styles.countBadge}>
              <Text style={styles.countText}>{selectedSlabs.length} Slab{selectedSlabs.length !== 1 ? 's' : ''}</Text>
            </View>
          </View>

          {selectedSlabs.length === 0 && !isLoading ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>📅</Text>
              <Text style={styles.emptyTitle}>No slabs on this date</Text>
              <Text style={styles.emptySub}>Tap + Add Slab to schedule one</Text>
            </View>
          ) : (
            selectedSlabs.map(slab => (
              <SlabCard
                key={slab.slab_id}
                slab={slab}
                onPress={() => router.push(`/slab/${slab.slab_id}` as any)}
              />
            ))
          )}
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    paddingTop: 56,
    paddingBottom: 16,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: { fontSize: 24, fontWeight: '800', color: Colors.textPrimary },
  headerSub: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 4,
  },
  addBtnText: { color: Colors.white, fontWeight: '700', fontSize: 14 },
  calendarContainer: {
    backgroundColor: Colors.white,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  loadingContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 20, gap: 8 },
  loadingText: { color: Colors.textSecondary, fontSize: 13 },
  selectedSection: { paddingHorizontal: Spacing.base },
  selectedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    marginTop: 4,
  },
  selectedDate: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary },
  countBadge: {
    backgroundColor: Colors.primaryLight,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  countText: { fontSize: 12, fontWeight: '600', color: Colors.primary },
  emptyState: { alignItems: 'center', paddingVertical: 40 },
  emptyEmoji: { fontSize: 40, marginBottom: 12 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: Colors.textPrimary },
  emptySub: { fontSize: 13, color: Colors.textSecondary, marginTop: 4 },
});

const badgeStyles = StyleSheet.create({
  container: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  text: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
});

const cardStyles = StyleSheet.create({
  card: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 3,
  },
  header: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
  dealer: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  contractor: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  row: { fontSize: 13, color: Colors.textSecondary, marginBottom: 6 },
  detailRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  detail: { fontSize: 12, color: Colors.textSecondary },
  location: { fontSize: 12, color: Colors.textSecondary, marginTop: 6 },
  qrBadge: {
    backgroundColor: Colors.primaryLight,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  qrText: { fontSize: 9, fontWeight: '700', color: Colors.primary },
});
