import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, RefreshControl, Platform,
} from 'react-native';
import { Calendar } from 'react-native-calendars';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Colors } from '../../src/theme/colors';
import { apiGetMeetings, apiGetTargets, apiGetUsers } from '../../src/services/api';
import { getUser } from '../../src/services/auth';
import { currentMonthISO, formatPercent, normalizeDate } from '../../src/utils/helpers';
import { Meeting } from '../../src/types';
import { FontFamily } from '../../src/theme/typography';
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
  const normDate = normalizeDate(meeting.meeting_date);
  let formattedDate = normDate;
  try {
    if (normDate) {
      formattedDate = format(new Date(normDate + 'T00:00:00'), 'EEE, dd MMM yyyy');
    }
  } catch {}

  return (
    <TouchableOpacity style={cardStyles.card} onPress={onPress} activeOpacity={0.88}>
      <View style={cardStyles.header}>
        <MeetingTypeBadge type={meeting.meeting_type} />
        <MeetingStatusBadge status={meeting.status} />
      </View>
      <Text style={cardStyles.name}>{meeting.meeting_name || meeting.meeting_type || 'Meeting'}</Text>
      
      {/* Date Row */}
      <View style={cardStyles.infoRow}>
        <Ionicons name="calendar-outline" size={13} color="#800E20" style={{ marginRight: 6 }} />
        <Text style={cardStyles.detail}>Date: <Text style={{ fontFamily: FontFamily.sansBold, fontWeight: '700', color: '#1F0B10' }}>{formattedDate}</Text></Text>
      </View>

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
  const [selectedTE, setSelectedTE] = useState<string>('ALL');
  const [selectedDate, setSelectedDate] = useState(today);
  const [currentMonth, setCurrentMonth] = useState(currentMonthISO());
  const [refreshing, setRefreshing] = useState(false);

  const { data: usersList } = useQuery({
    queryKey: ['users'],
    queryFn: () => apiGetUsers(),
  });

  const { data: allMeetings, refetch: refetchMeetings } = useQuery({
    queryKey: ['meetings'],
    queryFn: () => apiGetMeetings(),
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetchMeetings();
    setRefreshing(false);
  }, [refetchMeetings]);

  // Unique team list
  const uniqueTeamList = useMemo(() => {
    const set = new Set<string>();
    (usersList || []).forEach(u => {
      if (u.name && u.name.trim()) set.add(u.name.trim());
    });
    (allMeetings || []).forEach(m => {
      if (m.te && m.te.trim()) set.add(m.te.trim());
    });
    return Array.from(set).filter(Boolean);
  }, [usersList, allMeetings]);

  const rawMeetings = useMemo(() => allMeetings || [], [allMeetings]);

  // Filter meetings by team member
  const meetingsList = useMemo(() => {
    if (selectedTE === 'ALL') return rawMeetings;
    return rawMeetings.filter(m => 
      String(m.te || m.created_by || '').toLowerCase() === selectedTE.toLowerCase()
    );
  }, [rawMeetings, selectedTE]);

  // Build marked dates for calendar & count map
  const markedDates: Record<string, any> = {};
  const dateMeetingCountMap: Record<string, number> = {};

  meetingsList.forEach(m => {
    if (!m.meeting_date) return;
    const dateKey = normalizeDate(m.meeting_date);
    if (!dateKey) return;
    
    dateMeetingCountMap[dateKey] = (dateMeetingCountMap[dateKey] || 0) + 1;
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

  const scheduledDatesList = Object.keys(dateMeetingCountMap).sort();

  const customerMeetingsCount = meetingsList.filter(m => m.meeting_type === 'CUSTOMER').length;
  const contractorMeetingsCount = meetingsList.filter(m => m.meeting_type === 'CONTRACTOR').length;

  let formattedSelectedDate = selectedDate;
  try {
    if (selectedDate) {
      formattedSelectedDate = format(new Date(selectedDate + 'T00:00:00'), 'EEEE, dd MMMM yyyy');
    }
  } catch {}

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Meetings Command</Text>
          <Text style={styles.headerSub}>
            {selectedTE === 'ALL' ? 'Team Jajpur • All Meetings' : `${selectedTE} • Logged Meets`}
          </Text>
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
        {/* ── TEAM MEMBER SELECTOR CHIP BAR ("SARE USER KA DATA") ── */}
        <View style={styles.teamFilterContainer}>
          <View style={styles.teamFilterHeaderRow}>
            <View style={styles.teamFilterTitleWrap}>
              <MaterialCommunityIcons name="account-group-outline" size={18} color="#800E20" />
              <Text style={styles.teamFilterHeading}>Team Visibility</Text>
            </View>
            {selectedTE !== 'ALL' && (
              <TouchableOpacity onPress={() => setSelectedTE('ALL')} style={styles.resetFilterBtn}>
                <Text style={styles.resetFilterBtnText}>Show All Team ✕</Text>
              </TouchableOpacity>
            )}
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.teamFilterScroll}>
            <TouchableOpacity
              style={[styles.teamSelectChip, selectedTE === 'ALL' && styles.teamSelectChipActive]}
              onPress={() => setSelectedTE('ALL')}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons
                name="account-multiple"
                size={15}
                color={selectedTE === 'ALL' ? '#FFFFFF' : '#800E20'}
                style={{ marginRight: 6 }}
              />
              <Text style={[styles.teamSelectChipText, selectedTE === 'ALL' && styles.teamSelectChipTextActive]}>
                All Team (Consolidated)
              </Text>
            </TouchableOpacity>

            {uniqueTeamList.map((member) => {
              const isSelected = selectedTE === member;
              return (
                <TouchableOpacity
                  key={member}
                  style={[styles.teamSelectChip, isSelected && styles.teamSelectChipActive]}
                  onPress={() => setSelectedTE(member)}
                  activeOpacity={0.8}
                >
                  <Feather
                    name="user"
                    size={13}
                    color={isSelected ? '#FFFFFF' : '#800E20'}
                    style={{ marginRight: 5 }}
                  />
                  <Text style={[styles.teamSelectChipText, isSelected && styles.teamSelectChipTextActive]}>
                    {member}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

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
            current={selectedDate || today}
            onDayPress={(day) => setSelectedDate(day.dateString)}
            onMonthChange={(month) => setCurrentMonth(month.dateString.substring(0, 7))}
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

        {/* Quick Date Jump Chips */}
        {scheduledDatesList.length > 0 && (
          <View style={styles.chipsSection}>
            <Text style={styles.chipsSectionTitle}>📅 Scheduled Meeting Dates (Tap to Jump):</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll}>
              {scheduledDatesList.map(dateKey => {
                const count = dateMeetingCountMap[dateKey];
                const isSelected = dateKey === selectedDate;
                let label = dateKey;
                try {
                  label = format(new Date(dateKey + 'T00:00:00'), 'dd MMM (EEE)');
                } catch {}

                return (
                  <TouchableOpacity
                    key={dateKey}
                    style={[styles.dateChip, isSelected && styles.dateChipSelected]}
                    onPress={() => setSelectedDate(dateKey)}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.chipDot, isSelected && styles.chipDotSelected]} />
                    <Text style={[styles.dateChipText, isSelected && styles.dateChipTextSelected]}>
                      {dateKey === today ? '📍 Today: ' : ''}{label}
                    </Text>
                    <View style={[styles.chipCountBadge, isSelected && styles.chipCountBadgeSelected]}>
                      <Text style={[styles.chipCountText, isSelected && styles.chipCountTextSelected]}>
                        {count}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* ── 3. MEETINGS FOR SELECTED DATE ── */}
        <View style={styles.sectionHeaderRow}>
          <View>
            <Text style={styles.sectionTitle}>Meetings on Selected Date</Text>
            <Text style={styles.sectionDate}>{formattedSelectedDate}</Text>
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
              <Text style={styles.emptyAddBtnText}>+ Schedule Meeting for {formattedSelectedDate}</Text>
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
        <View style={[styles.sectionHeaderRow, { marginTop: 26 }]}>
          <Text style={styles.sectionTitle}>All Recorded Meetings ({meetingsList.length})</Text>
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
  headerTitle: { fontFamily: FontFamily.displayBlack, fontSize: 22, fontWeight: '900', color: '#1F0B10', letterSpacing: -0.5 },
  headerSub: { fontFamily: FontFamily.sansMedium, fontSize: 12, color: '#8A7277', fontWeight: '500', marginTop: 2 },
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
  addBtnText: { fontFamily: FontFamily.sansBold, color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  scroll: { flex: 1 },
  scrollContent: { padding: 16 },

  // Team Filter Bar
  teamFilterContainer: {
    marginBottom: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 14,
    borderWidth: 1.5,
    borderColor: '#EEDCE1',
    shadowColor: 'rgba(78, 5, 17, 0.05)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 2,
  },
  teamFilterHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  teamFilterTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  teamFilterHeading: {
    fontFamily: FontFamily.displayBold,
    fontSize: 13,
    fontWeight: '800',
    color: '#1F0B10',
    marginLeft: 6,
  },
  resetFilterBtn: {
    backgroundColor: '#FAF0F2',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  resetFilterBtnText: {
    fontFamily: FontFamily.sansBold,
    fontSize: 11,
    color: '#800E20',
    fontWeight: '700',
  },
  teamFilterScroll: {
    gap: 8,
    paddingRight: 10,
  },
  teamSelectChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FAF0F2',
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#EEDCE1',
  },
  teamSelectChipActive: {
    backgroundColor: '#800E20',
    borderColor: '#800E20',
  },
  teamSelectChipText: {
    fontFamily: FontFamily.sansSemiBold,
    fontSize: 12,
    fontWeight: '700',
    color: '#800E20',
  },
  teamSelectChipTextActive: {
    color: '#FFFFFF',
  },

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
  targetCardTitle: { fontFamily: FontFamily.sansBold, fontSize: 12, fontWeight: '700', color: '#8A7277' },
  targetCardValue: { fontFamily: FontFamily.displayBlack, fontSize: 28, fontWeight: '900', color: '#800E20', marginVertical: 4 },
  targetCardSub: { fontFamily: FontFamily.sansRegular, fontSize: 11, color: '#A0858C' },
  calendarCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 12,
    borderWidth: 1.5,
    borderColor: '#EEDCE1',
    marginBottom: 16,
    overflow: 'hidden',
  },
  chipsSection: {
    marginBottom: 18,
  },
  chipsSectionTitle: {
    fontFamily: FontFamily.sansBold,
    fontSize: 12,
    fontWeight: '800',
    color: '#800E20',
    marginBottom: 8,
    letterSpacing: 0.2,
  },
  chipsScroll: {
    flexDirection: 'row',
  },
  dateChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    marginRight: 8,
    borderWidth: 1.5,
    borderColor: '#EEDCE1',
    gap: 6,
  },
  dateChipSelected: {
    backgroundColor: '#800E20',
    borderColor: '#800E20',
  },
  chipDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#800E20',
  },
  chipDotSelected: {
    backgroundColor: '#FFFFFF',
  },
  dateChipText: {
    fontFamily: FontFamily.sansBold,
    fontSize: 12,
    fontWeight: '700',
    color: '#1F0B10',
  },
  dateChipTextSelected: {
    color: '#FFFFFF',
  },
  chipCountBadge: {
    backgroundColor: '#FBE8EC',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  chipCountBadgeSelected: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  chipCountText: {
    fontFamily: FontFamily.sansBold,
    fontSize: 10,
    fontWeight: '800',
    color: '#800E20',
  },
  chipCountTextSelected: {
    color: '#FFFFFF',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: { fontFamily: FontFamily.displayBold, fontSize: 17, fontWeight: '800', color: '#1F0B10', letterSpacing: -0.3 },
  sectionDate: { fontFamily: FontFamily.sansSemiBold, fontSize: 12, color: '#800E20', fontWeight: '600', marginTop: 2 },
  countBadge: {
    backgroundColor: '#FBE8EC',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  countBadgeText: { fontFamily: FontFamily.sansBold, fontSize: 12, fontWeight: '800', color: '#800E20' },
  refreshLink: { fontFamily: FontFamily.sansBold, fontSize: 13, fontWeight: '700', color: '#800E20' },
  list: { gap: 10 },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#EEDCE1',
  },
  emptyTitle: { fontFamily: FontFamily.displayBold, fontSize: 14, fontWeight: '800', color: '#1F0B10' },
  emptySub: { fontFamily: FontFamily.sansRegular, fontSize: 12, color: '#8A7277', marginTop: 4, textAlign: 'center' },
  emptyAddBtn: {
    backgroundColor: '#800E20',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginTop: 12,
  },
  emptyAddBtnText: { fontFamily: FontFamily.sansBold, color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
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
  name: { fontFamily: FontFamily.displayBold, fontSize: 16, fontWeight: '800', color: '#1F0B10', marginBottom: 6 },
  infoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  detail: { fontFamily: FontFamily.sansMedium, fontSize: 13, color: '#6B4E55' },
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
  te: { fontFamily: FontFamily.sansBold, fontSize: 11, fontWeight: '700', color: '#800E20' },
});

const badge = StyleSheet.create({
  container: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  text: { fontFamily: FontFamily.sansBold, fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
});
