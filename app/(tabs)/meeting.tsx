import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, RefreshControl, Platform,
} from 'react-native';
import { Calendar } from 'react-native-calendars';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Colors } from '../../src/theme/colors';
import { apiGetMeetings, apiGetTargets } from '../../src/services/api';
import { getUser } from '../../src/services/auth';
import { currentMonthISO, formatPercent, normalizeDate } from '../../src/utils/helpers';
import { Meeting } from '../../src/types';
import { Ionicons, MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import { format } from 'date-fns';

function MeetingTypeBadge({ type }: { type: Meeting['meeting_type'] }) {
  const isCust = type === 'CUSTOMER';
  const isCont = type === 'CONTRACTOR';
  return (
    <View style={[
      badge.container,
      { backgroundColor: isCust ? '#FBE8EC' : isCont ? '#FFEDD5' : '#CCFBF1' }
    ]}>
      <Text style={[
        badge.text,
        { color: isCust ? '#800E20' : isCont ? '#C2410C' : '#0F766E' }
      ]}>
        {type}
      </Text>
    </View>
  );
}

function MeetingStatusBadge({ status }: { status: Meeting['status'] }) {
  const colors: Record<string, { bg: string; text: string }> = {
    PLANNED: { bg: '#FBE8EC', text: '#800E20' },
    COMPLETED: { bg: '#DCFCE7', text: '#15803D' },
    CANCELLED: { bg: '#F3F4F6', text: '#6B7280' },
    RESCHEDULED: { bg: '#FEF3C7', text: '#D97706' },
  };
  const cfg = colors[status] || colors.PLANNED;
  return (
    <View style={[badge.container, { backgroundColor: cfg.bg }]}>
      <Text style={[badge.text, { color: cfg.text }]}>{status || 'PLANNED'}</Text>
    </View>
  );
}

function MeetingCard({ meeting, onPress }: { meeting: Meeting; onPress: () => void }) {
  return (
    <TouchableOpacity style={cardStyles.card} onPress={onPress} activeOpacity={0.88}>
      <View style={cardStyles.header}>
        <MeetingTypeBadge type={meeting.meeting_type} />
        <MeetingStatusBadge status={meeting.status} />
      </View>
      <Text style={cardStyles.name}>{meeting.meeting_name || meeting.meeting_type || 'Meeting'}</Text>
      
      {meeting.location ? (
        <View style={cardStyles.infoRow}>
          <Feather name="map-pin" size={13} color="#8A7277" style={{ marginRight: 6 }} />
          <Text style={cardStyles.detail}>{meeting.location}</Text>
        </View>
      ) : null}

      {meeting.purpose ? (
        <View style={cardStyles.infoRow}>
          <Feather name="target" size={13} color="#8A7277" style={{ marginRight: 6 }} />
          <Text style={cardStyles.detail}>{meeting.purpose}</Text>
        </View>
      ) : null}

      <View style={cardStyles.footer}>
        <View style={cardStyles.teTag}>
          <Feather name="user" size={12} color="#800E20" style={{ marginRight: 4 }} />
          <Text style={cardStyles.te}>{meeting.te || meeting.created_by || 'Team Jajpur'}</Text>
        </View>
        {meeting.people_count ? (
          <Text style={cardStyles.detail}>👥 {meeting.people_count} people</Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

export default function MeetingScreen() {
  const today = normalizeDate(new Date());
  const [selectedDate, setSelectedDate] = useState(today);
  const [refreshing, setRefreshing] = useState(false);

  const { data: allMeetings, refetch: refetchMeetings } = useQuery({
    queryKey: ['meetings'],
    queryFn: () => apiGetMeetings(),
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetchMeetings();
    setRefreshing(false);
  }, [refetchMeetings]);

  const meetingsList = allMeetings || [];

  // Build marked dates for calendar
  const markedDates: Record<string, any> = {};
  meetingsList.forEach(m => {
    if (!m.meeting_date) return;
    const dateKey = normalizeDate(m.meeting_date);
    if (!dateKey) return;
    markedDates[dateKey] = {
      marked: true,
      dotColor: '#800E20',
    };
  });

  // Selected date highlighting
  const isSelectedDateMarked = !!markedDates[selectedDate];
  markedDates[selectedDate] = {
    ...markedDates[selectedDate],
    selected: true,
    selectedColor: '#800E20',
    selectedTextColor: '#FFFFFF',
    marked: isSelectedDateMarked,
    dotColor: '#FFFFFF',
  };

  const selectedMeetings = meetingsList.filter(m =>
    normalizeDate(m.meeting_date) === selectedDate
  );

  const customerMeetingsCount = meetingsList.filter(m => m.meeting_type === 'CUSTOMER').length;
  const contractorMeetingsCount = meetingsList.filter(m => m.meeting_type === 'CONTRACTOR').length;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Meetings</Text>
          <Text style={styles.headerSub}>Customer & Contractor Meets</Text>
        </View>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => router.push('/meeting/add')}
          activeOpacity={0.85}
        >
          <Ionicons name="add" size={20} color="#FFFFFF" />
          <Text style={styles.addBtnText}>Add Meeting</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#800E20" />}
      >
        {/* ── 1. TARGET SUMMARY CARDS ── */}
        <View style={styles.targetsRow}>
          <View style={styles.targetCard}>
            <Text style={styles.targetCardTitle}>Customer Meets</Text>
            <Text style={styles.targetCardValue}>{customerMeetingsCount}</Text>
            <Text style={styles.targetCardSub}>Total Logged</Text>
          </View>

          <View style={styles.targetCard}>
            <Text style={styles.targetCardTitle}>Contractor Meets</Text>
            <Text style={styles.targetCardValue}>{contractorMeetingsCount}</Text>
            <Text style={styles.targetCardSub}>Total Logged</Text>
          </View>
        </View>

        {/* ── 2. CALENDAR ── */}
        <View style={styles.calendarCard}>
          <Calendar
            current={selectedDate}
            onDayPress={(day) => setSelectedDate(day.dateString)}
            markedDates={markedDates}
            theme={{
              backgroundColor: '#FFFFFF',
              calendarBackground: '#FFFFFF',
              textSectionTitleColor: '#8A7277',
              selectedDayBackgroundColor: '#800E20',
              selectedDayTextColor: '#FFFFFF',
              todayTextColor: '#800E20',
              dayTextColor: '#1F0B10',
              textDisabledColor: '#D1C2C5',
              dotColor: '#800E20',
              selectedDotColor: '#FFFFFF',
              arrowColor: '#800E20',
              monthTextColor: '#1F0B10',
              textDayFontWeight: '600',
              textMonthFontWeight: '800',
              textDayHeaderFontWeight: '700',
            }}
          />
        </View>

        {/* ── 3. MEETINGS FOR SELECTED DATE ── */}
        <View style={styles.sectionHeaderRow}>
          <View>
            <Text style={styles.sectionTitle}>Meetings on Selected Date</Text>
            <Text style={styles.sectionDate}>{selectedDate}</Text>
          </View>
          <View style={styles.countBadge}>
            <Text style={styles.countBadgeText}>{selectedMeetings.length} Meetings</Text>
          </View>
        </View>

        {selectedMeetings.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No Meetings Scheduled on This Date</Text>
            <Text style={styles.emptySub}>Tap below to plan a customer or contractor meeting.</Text>
            <TouchableOpacity
              style={styles.emptyAddBtn}
              onPress={() => router.push('/meeting/add')}
            >
              <Text style={styles.emptyAddBtnText}>+ Schedule Meeting</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.list}>
            {selectedMeetings.map(m => (
              <MeetingCard
                key={m.meeting_id}
                meeting={m}
                onPress={() => router.push(`/meeting/${m.meeting_id}` as any)}
              />
            ))}
          </View>
        )}

        {/* ── 4. ALL MEETINGS OVERVIEW ── */}
        <View style={[styles.sectionHeaderRow, { marginTop: 24 }]}>
          <Text style={styles.sectionTitle}>All Meetings ({meetingsList.length})</Text>
          <TouchableOpacity onPress={() => onRefresh()}>
            <Text style={styles.refreshLink}>Refresh ⟳</Text>
          </TouchableOpacity>
        </View>

        {meetingsList.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No Meetings Found</Text>
            <Text style={styles.emptySub}>Recorded meetings in Google Sheets will appear here.</Text>
          </View>
        ) : (
          <View style={styles.list}>
            {meetingsList.map(m => (
              <MeetingCard
                key={m.meeting_id}
                meeting={m}
                onPress={() => router.push(`/meeting/${m.meeting_id}` as any)}
              />
            ))}
          </View>
        )}

        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9F5F6' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingTop: Platform.OS === 'ios' ? 56 : 38,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F0E2E5',
  },
  headerTitle: { fontSize: 22, fontWeight: '900', color: '#1F0B10', letterSpacing: -0.5 },
  headerSub: { fontSize: 12, color: '#8A7277', fontWeight: '500', marginTop: 2 },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#800E20',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 14,
    gap: 4,
    shadowColor: '#800E20',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  addBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  scroll: { flex: 1 },
  scrollContent: { padding: 16 },
  targetsRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  targetCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#EEDCE1',
    alignItems: 'center',
  },
  targetCardTitle: { fontSize: 12, fontWeight: '700', color: '#8A7277' },
  targetCardValue: { fontSize: 28, fontWeight: '900', color: '#800E20', marginVertical: 4 },
  targetCardSub: { fontSize: 11, color: '#A0858C' },
  calendarCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 12,
    borderWidth: 1.5,
    borderColor: '#EEDCE1',
    marginBottom: 20,
    overflow: 'hidden',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 17, fontWeight: '800', color: '#1F0B10', letterSpacing: -0.3 },
  sectionDate: { fontSize: 12, color: '#800E20', fontWeight: '600', marginTop: 2 },
  countBadge: {
    backgroundColor: '#FBE8EC',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  countBadgeText: { fontSize: 12, fontWeight: '800', color: '#800E20' },
  refreshLink: { fontSize: 13, fontWeight: '700', color: '#800E20' },
  list: { gap: 10 },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#EEDCE1',
  },
  emptyTitle: { fontSize: 14, fontWeight: '800', color: '#1F0B10' },
  emptySub: { fontSize: 12, color: '#8A7277', marginTop: 4, textAlign: 'center' },
  emptyAddBtn: {
    backgroundColor: '#800E20',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginTop: 12,
  },
  emptyAddBtnText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
});

const cardStyles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#EEDCE1',
    shadowColor: 'rgba(78, 5, 17, 0.05)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 2,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  name: { fontSize: 16, fontWeight: '800', color: '#1F0B10', marginBottom: 6 },
  infoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  detail: { fontSize: 13, color: '#6B4E55' },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F7EFF1',
  },
  teTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FBE8EC',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  te: { fontSize: 11, fontWeight: '700', color: '#800E20' },
});

const badge = StyleSheet.create({
  container: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  text: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
});
