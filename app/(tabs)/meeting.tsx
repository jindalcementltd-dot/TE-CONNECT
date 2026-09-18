import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, RefreshControl,
} from 'react-native';
import { Calendar } from 'react-native-calendars';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Colors } from '../../src/theme/colors';
import { Spacing, BorderRadius } from '../../src/theme/spacing';
import { apiGetMeetings, apiGetMeetingTargetSummary } from '../../src/services/api';
import { getUser } from '../../src/services/auth';
import { currentMonthISO, formatPercent } from '../../src/utils/helpers';
import { Meeting } from '../../src/types';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';

// ── Sub-components ───────────────────────────────────────────

function MeetingTypeBadge({ type }: { type: Meeting['meeting_type'] }) {
  const config = {
    CUSTOMER: { bg: Colors.meetingCustomerBg, text: Colors.meetingCustomer, label: 'CUSTOMER' },
    CONTRACTOR: { bg: Colors.meetingContractorBg, text: Colors.meetingContractor, label: 'CONTRACTOR' },
    OTHER: { bg: Colors.meetingOtherBg, text: Colors.meetingOther, label: 'OTHER' },
  }[type];
  return (
    <View style={[badge.container, { backgroundColor: config.bg }]}>
      <Text style={[badge.text, { color: config.text }]}>{config.label}</Text>
    </View>
  );
}

function MeetingStatusBadge({ status }: { status: Meeting['status'] }) {
  const colors: Record<string, { bg: string; text: string }> = {
    PLANNED: { bg: Colors.infoLight, text: Colors.info },
    COMPLETED: { bg: Colors.successLight, text: Colors.success },
    CANCELLED: { bg: Colors.borderLight, text: Colors.textMuted },
    RESCHEDULED: { bg: Colors.warningLight, text: Colors.warning },
  };
  const cfg = colors[status] || colors.PLANNED;
  return (
    <View style={[badge.container, { backgroundColor: cfg.bg }]}>
      <Text style={[badge.text, { color: cfg.text }]}>{status}</Text>
    </View>
  );
}

function MeetingCard({ meeting, onPress }: { meeting: Meeting; onPress: () => void }) {
  return (
    <TouchableOpacity style={cardStyles.card} onPress={onPress} activeOpacity={0.85}>
      <View style={cardStyles.header}>
        <MeetingTypeBadge type={meeting.meeting_type} />
        <MeetingStatusBadge status={meeting.status} />
      </View>
      <Text style={cardStyles.name}>{meeting.meeting_name || '(No name)'}</Text>
      {meeting.location ? <Text style={cardStyles.detail}>📍 {meeting.location}</Text> : null}
      {meeting.purpose ? <Text style={cardStyles.detail}>🎯 {meeting.purpose}</Text> : null}
      <View style={cardStyles.footer}>
        <Text style={cardStyles.te}>👤 {meeting.te || 'Unassigned'}</Text>
        {meeting.people_count ? <Text style={cardStyles.detail}>👥 {meeting.people_count} people</Text> : null}
        {meeting.expense_amount ? <Text style={cardStyles.detail}>💰 ₹{meeting.expense_amount}</Text> : null}
      </View>
    </TouchableOpacity>
  );
}

function TargetCard({ label, completed, target, color }: {
  label: string; completed: number; target: number; color: string;
}) {
  const pct = target > 0 ? Math.min((completed / target) * 100, 100) : 0;
  return (
    <View style={targetStyles.card}>
      <View style={targetStyles.header}>
        <Text style={targetStyles.label}>{label}</Text>
        <Text style={targetStyles.fraction}>
          <Text style={{ color }}>{completed}</Text>/{target}
        </Text>
      </View>
      <View style={targetStyles.barBg}>
        <View style={[targetStyles.barFill, { width: `${pct}%` as any, backgroundColor: color }]} />
      </View>
      <View style={targetStyles.footer}>
        <Text style={targetStyles.pct}>{formatPercent(pct)}</Text>
        <Text style={targetStyles.remaining}>
          {Math.max(0, target - completed)} remaining
        </Text>
      </View>
    </View>
  );
}

// ── Main Screen ──────────────────────────────────────────────

export default function MeetingScreen() {
  const today = new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState(today);
  const [currentMonth, setCurrentMonth] = useState(currentMonthISO());
  const [refreshing, setRefreshing] = useState(false);

  const { data: meetings, refetch: refetchMeetings } = useQuery({
    queryKey: ['meetings', currentMonth],
    queryFn: () => apiGetMeetings({ month: currentMonth }),
  });

  const { data: targetSummary, refetch: refetchTargets } = useQuery({
    queryKey: ['meetingTargetSummary', currentMonth],
    queryFn: () => apiGetMeetingTargetSummary(currentMonth),
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refetchMeetings(), refetchTargets()]);
    setRefreshing(false);
  }, []);

  // Build marked dates
  const markedDates: Record<string, any> = {};
  (meetings || []).forEach(m => {
    const date = m.meeting_date.split('T')[0];
    if (!markedDates[date]) markedDates[date] = { dots: [], marked: true };
    markedDates[date].dots = markedDates[date].dots || [];
    const dotColor = m.meeting_type === 'CUSTOMER' ? Colors.meetingCustomer
      : m.meeting_type === 'CONTRACTOR' ? Colors.meetingContractor
      : Colors.meetingOther;
    markedDates[date].dots.push({ color: dotColor });
  });
  if (selectedDate) {
    markedDates[selectedDate] = {
      ...markedDates[selectedDate],
      selected: true,
      selectedColor: Colors.primary,
    };
  }

  const selectedMeetings = (meetings || []).filter(m =>
    m.meeting_date.split('T')[0] === selectedDate
  );

  // Aggregate target summary across all TEs
  const totalCustomerTarget = (targetSummary || []).reduce((s, t) => s + t.customer_target, 0);
  const totalCustomerCompleted = (targetSummary || []).reduce((s, t) => s + t.customer_completed, 0);
  const totalContractorTarget = (targetSummary || []).reduce((s, t) => s + t.contractor_target, 0);
  const totalContractorCompleted = (targetSummary || []).reduce((s, t) => s + t.contractor_completed, 0);
  const totalPlanned = (targetSummary || []).reduce((s, t) => s + t.total_planned, 0);
  const totalCompleted = (targetSummary || []).reduce((s, t) => s + t.total_completed, 0);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Meeting</Text>
          <Text style={styles.headerSub}>Planning Calendar</Text>
        </View>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => router.push('/meeting/add')}
        >
          <Ionicons name="add" size={20} color={Colors.white} />
          <Text style={styles.addBtnText}>Add Meeting</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      >
        {/* Target Summary Cards */}
        <View style={styles.targetsSection}>
          <TargetCard
            label="Customer Meetings"
            completed={totalCustomerCompleted}
            target={totalCustomerTarget}
            color={Colors.meetingCustomer}
          />
          <TargetCard
            label="Contractor Meetings"
            completed={totalContractorCompleted}
            target={totalContractorTarget}
            color={Colors.meetingContractor}
          />
          <View style={targetStyles.totalRow}>
            <View style={targetStyles.totalItem}>
              <Text style={targetStyles.totalValue}>{totalPlanned}</Text>
              <Text style={targetStyles.totalLabel}>Total Planned</Text>
            </View>
            <View style={targetStyles.totalItem}>
              <Text style={[targetStyles.totalValue, { color: Colors.success }]}>{totalCompleted}</Text>
              <Text style={targetStyles.totalLabel}>Completed</Text>
            </View>
            <View style={targetStyles.totalItem}>
              <Text style={[targetStyles.totalValue, { color: Colors.error }]}>
                {totalPlanned - totalCompleted}
              </Text>
              <Text style={targetStyles.totalLabel}>Remaining</Text>
            </View>
          </View>
        </View>

        {/* Calendar */}
        <View style={styles.calendarContainer}>
          <Calendar
            current={currentMonth + '-01'}
            onDayPress={(day: any) => setSelectedDate(day.dateString)}
            onMonthChange={(month: any) => setCurrentMonth(month.dateString.substring(0, 7))}
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
            }}
          />
        </View>

        {/* Selected Date Meetings */}
        <View style={styles.selectedSection}>
          <View style={styles.selectedHeader}>
            <Text style={styles.selectedDate}>
              {format(new Date(selectedDate), 'dd MMMM yyyy')}
            </Text>
            <View style={styles.countBadge}>
              <Text style={styles.countText}>
                {selectedMeetings.length} Meeting{selectedMeetings.length !== 1 ? 's' : ''}
              </Text>
            </View>
          </View>

          {selectedMeetings.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>🤝</Text>
              <Text style={styles.emptyTitle}>No meetings on this date</Text>
              <Text style={styles.emptySub}>Tap + Add Meeting to plan one</Text>
            </View>
          ) : (
            selectedMeetings.map(m => (
              <MeetingCard
                key={m.meeting_id}
                meeting={m}
                onPress={() => router.push(`/meeting/${m.meeting_id}` as any)}
              />
            ))
          )}
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────

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
  headerSub: { fontSize: 13, color: Colors.textSecondary },
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
  targetsSection: {
    backgroundColor: Colors.white,
    marginBottom: 8,
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.base,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  calendarContainer: {
    backgroundColor: Colors.white,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  selectedSection: { paddingHorizontal: Spacing.base },
  selectedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.md,
    marginBottom: 12,
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

const badge = StyleSheet.create({
  container: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
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
  header: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  name: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary, marginBottom: 6 },
  detail: { fontSize: 12, color: Colors.textSecondary, marginBottom: 3 },
  footer: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 6 },
  te: { fontSize: 12, color: Colors.textSecondary },
});

const targetStyles = StyleSheet.create({
  card: {
    marginBottom: 12,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  label: { fontSize: 13, fontWeight: '600', color: Colors.textPrimary },
  fraction: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  barBg: { height: 8, backgroundColor: Colors.borderLight, borderRadius: 4, overflow: 'hidden' },
  barFill: { height: 8, borderRadius: 4 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  pct: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary },
  remaining: { fontSize: 12, color: Colors.textMuted },
  totalRow: {
    flexDirection: 'row',
    backgroundColor: Colors.background,
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
  },
  totalItem: { flex: 1, alignItems: 'center' },
  totalValue: { fontSize: 22, fontWeight: '800', color: Colors.textPrimary },
  totalLabel: { fontSize: 11, color: Colors.textSecondary, marginTop: 2, fontWeight: '500' },
});
