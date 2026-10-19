import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, RefreshControl, Platform,
  Modal, FlatList,
} from 'react-native';
import { Calendar } from 'react-native-calendars';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Colors } from '../../src/theme/colors';
import { apiGetMeetings, apiGetUsers } from '../../src/services/api';
import { getUser, syncUserFromLiveList } from '../../src/services/auth';
import { currentMonthISO, formatPercent, normalizeDate } from '../../src/utils/helpers';
import { getUserDistrict, getMeetingDistrict, getAvailableDistricts } from '../../src/utils/district';
import { Meeting, User } from '../../src/types';
import { FontFamily } from '../../src/theme/typography';
import { Ionicons, MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import { format, parseISO } from 'date-fns';

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
  const isComp = status === 'COMPLETED';
  const isCanc = status === 'CANCELLED';
  const isResch = status === 'RESCHEDULED';
  return (
    <View style={[
      badge.container,
      isComp ? badge.containerCompleted : (isCanc ? badge.containerCancelled : (isResch ? badge.containerRescheduled : badge.containerUpcoming)),
    ]}>
      <Text style={[
        badge.text,
        isComp ? badge.textCompleted : (isCanc ? badge.textCancelled : (isResch ? badge.textRescheduled : badge.textUpcoming)),
      ]}>
        {isComp ? '✅ COMPLETED' : (isCanc ? '✕ CANCELLED' : (isResch ? '🔄 RESCHEDULED' : '⏳ UPCOMING'))}
      </Text>
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

  const isComp = meeting.status === 'COMPLETED';
  const isCanc = meeting.status === 'CANCELLED';

  return (
    <TouchableOpacity
      style={[
        cardStyles.card,
        isComp ? cardStyles.cardCompleted : (isCanc ? cardStyles.cardCancelled : cardStyles.cardUpcoming),
      ]}
      onPress={onPress}
      activeOpacity={0.88}
    >
      <View style={cardStyles.header}>
        <View style={[
          cardStyles.iconCircle,
          isComp ? cardStyles.iconCircleCompleted : (isCanc ? cardStyles.iconCircleCancelled : cardStyles.iconCircleUpcoming),
        ]}>
          <MaterialCommunityIcons
            name={isComp ? 'check-decagram' : (isCanc ? 'close-circle-outline' : 'calendar-clock')}
            size={24}
            color={isComp ? '#16A34A' : (isCanc ? '#6B7280' : '#7C3AED')}
          />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[cardStyles.name, isComp && cardStyles.nameCompleted]} numberOfLines={1}>
            {meeting.meeting_name || `${meeting.meeting_type} Meet`}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <MeetingTypeBadge type={meeting.meeting_type} />
            {meeting.location ? (
              <Text style={cardStyles.locationText} numberOfLines={1}>📍 {meeting.location}</Text>
            ) : null}
          </View>
        </View>
        <MeetingStatusBadge status={meeting.status} />
      </View>

      {/* Prominent Themed Date Banner */}
      <View style={[
        cardStyles.dateBanner,
        isComp ? cardStyles.dateBannerCompleted : (isCanc ? cardStyles.dateBannerCancelled : cardStyles.dateBannerUpcoming),
      ]}>
        <Ionicons
          name={isComp ? 'checkmark-circle' : 'calendar'}
          size={16}
          color={isComp ? '#15803D' : (isCanc ? '#6B7280' : '#7C3AED')}
          style={{ marginRight: 6 }}
        />
        <Text style={[
          cardStyles.dateBannerLabel,
          isComp ? cardStyles.dateBannerLabelCompleted : (isCanc ? cardStyles.dateBannerLabelCancelled : cardStyles.dateBannerLabelUpcoming),
        ]}>
          {isComp ? 'Conducted Date:' : (isCanc ? 'Cancelled Date:' : 'Scheduled Meeting:')}{' '}
          <Text style={[cardStyles.boldVal, isComp && { color: '#166534' }]}>{formattedDate}</Text>
        </Text>
      </View>

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
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {meeting.expense_amount ? (
            <View style={cardStyles.expenseTag}>
              <Text style={cardStyles.expenseTagText}>💰 ₹{meeting.expense_amount}</Text>
            </View>
          ) : null}
          {meeting.people_count ? (
            <Text style={cardStyles.detail}>👥 {meeting.people_count} attendees</Text>
          ) : null}
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function MeetingScreen() {
  const [user, setUser] = useState<User | null>(null);
  const [activeDistrict, setActiveDistrict] = useState<string>('Jajpur');
  const today = normalizeDate(new Date());
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthISO());
  const [showMonthModal, setShowMonthModal] = useState<boolean>(false);
  const [selectedDate, setSelectedDate] = useState(today);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'UPCOMING' | 'COMPLETED'>('ALL');

  useEffect(() => {
    getUser().then(u => {
      setUser(u);
      if (u) {
        const userDist = getUserDistrict(u);
        setActiveDistrict(userDist);
      }
    });
  }, []);

  const { data: usersList } = useQuery({
    queryKey: ['users'],
    queryFn: () => apiGetUsers(),
  });

  // Live profile & district sync when USERS sheet is updated
  useEffect(() => {
    if (usersList && usersList.length > 0) {
      syncUserFromLiveList(usersList).then(updated => {
        if (updated) {
          setUser(updated);
        }
      }).catch(() => {});
    }
  }, [usersList]);

  const { data: allMeetings, refetch: refetchMeetings } = useQuery({
    queryKey: ['meetings'],
    queryFn: () => apiGetMeetings(),
    refetchInterval: 12000,
    refetchIntervalInBackground: false,
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetchMeetings();
    setRefreshing(false);
  }, [refetchMeetings]);

  const availableDistricts = useMemo(() => {
    return getAvailableDistricts(usersList, []);
  }, [usersList]);

  // SCOPED MEETINGS BY DISTRICT AND USER ROLE:
  const scopedRawMeetings = useMemo(() => {
    const list = (allMeetings || []).filter(m => m && m.meeting_date);
    if (!activeDistrict || activeDistrict === 'ALL') return list;
    return list.filter(m => {
      const mDist = getMeetingDistrict(m, usersList);
      if (user?.role === 'TE') {
        const cleanName = (user.name || '').trim().toLowerCase();
        const isTeMatch = m.te && m.te.trim().toLowerCase() === cleanName;
        return isTeMatch || mDist.toLowerCase() === activeDistrict.toLowerCase();
      }
      return mDist.toLowerCase() === activeDistrict.toLowerCase();
    });
  }, [allMeetings, usersList, user, activeDistrict]);

  const rawMeetings = scopedRawMeetings;

  // Compute available months from meetings
  const availableMonths = useMemo(() => {
    const set = new Set<string>();
    set.add(currentMonthISO());
    rawMeetings.forEach(m => {
      if (!m || !m.meeting_date) return;
      const mStr = normalizeDate(m.meeting_date).substring(0, 7);
      if (mStr && mStr.length === 7) set.add(mStr);
    });
    return Array.from(set).sort().reverse();
  }, [rawMeetings]);

  const switchMonth = (direction: 'prev' | 'next') => {
    const currentIndex = availableMonths.indexOf(selectedMonth);
    if (direction === 'prev' && currentIndex < availableMonths.length - 1) {
      const nextMonth = availableMonths[currentIndex + 1];
      setSelectedMonth(nextMonth);
      setSelectedDate(nextMonth + '-01');
    } else if (direction === 'next' && currentIndex > 0) {
      const prevMonth = availableMonths[currentIndex - 1];
      setSelectedMonth(prevMonth);
      setSelectedDate(prevMonth === currentMonthISO() ? today : prevMonth + '-01');
    }
  };

  const formattedSelectedMonth = useMemo(() => {
    try {
      return format(parseISO(selectedMonth + '-01'), 'MMMM yyyy');
    } catch {
      return selectedMonth;
    }
  }, [selectedMonth]);

  // Filter meetings strictly by selectedMonth, sorted recent date first
  const monthMeetings = useMemo(() => {
    const list = rawMeetings.filter(m => normalizeDate(m.meeting_date).startsWith(selectedMonth));
    return [...list].sort((a, b) => {
      const dateA = normalizeDate(a.meeting_date);
      const dateB = normalizeDate(b.meeting_date);
      return dateB.localeCompare(dateA);
    });
  }, [rawMeetings, selectedMonth]);

  // Build marked dates for calendar & count map for selectedMonth
  const markedDates: Record<string, any> = {};
  const dateMeetingCountMap: Record<string, number> = {};

  monthMeetings.forEach(m => {
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

  const selectedMeetings = monthMeetings.filter(m =>
    normalizeDate(m.meeting_date) === selectedDate
  );

  const scheduledDatesList = Object.keys(dateMeetingCountMap).sort();

  const customerMeetingsCount = monthMeetings.filter(m => m.meeting_type === 'CUSTOMER').length;
  const contractorMeetingsCount = monthMeetings.filter(m => m.meeting_type === 'CONTRACTOR').length;
  const upcomingCount = monthMeetings.filter(m => m.status === 'PLANNED' || (m.status as any) === 'UPCOMING' || !m.status).length;
  const completedCount = monthMeetings.filter(m => m.status === 'COMPLETED').length;
  const totalExpense = monthMeetings.reduce((sum, m) => sum + (Number(m.expense_amount) || 0), 0);
  const totalPeopleAttended = monthMeetings.reduce((sum, m) => sum + (Number(m.people_count) || 0), 0);

  const displayedMonthMeetings = useMemo(() => {
    if (statusFilter === 'UPCOMING') {
      return monthMeetings.filter(m => m.status === 'PLANNED' || (m.status as any) === 'UPCOMING' || !m.status);
    }
    if (statusFilter === 'COMPLETED') {
      return monthMeetings.filter(m => m.status === 'COMPLETED');
    }
    return monthMeetings;
  }, [monthMeetings, statusFilter]);

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
            District {activeDistrict} • {user?.role === 'TE' ? (user.name || 'My Territory') : 'Consolidated Team'}
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

      {/* DISTRICT SELECTOR BAR (For All Users) */}
      {availableDistricts.length > 0 && (
        <View style={styles.districtBarContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.districtBarScroll}>
            <Text style={styles.districtBarLabel}>📍 DISTRICT:</Text>
            <TouchableOpacity
              style={[styles.districtChip, activeDistrict === 'ALL' && styles.districtChipActive]}
              onPress={() => setActiveDistrict('ALL')}
              activeOpacity={0.8}
            >
              <Text style={[styles.districtChipText, activeDistrict === 'ALL' && styles.districtChipTextActive]}>
                All Districts ({availableDistricts.length})
              </Text>
            </TouchableOpacity>
            {availableDistricts.map(dist => (
              <TouchableOpacity
                key={dist}
                style={[styles.districtChip, activeDistrict.toLowerCase() === dist.toLowerCase() && styles.districtChipActive]}
                onPress={() => setActiveDistrict(dist)}
                activeOpacity={0.8}
              >
                <Text style={[styles.districtChipText, activeDistrict.toLowerCase() === dist.toLowerCase() && styles.districtChipTextActive]}>
                  {dist}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#800E20" />}
      >
        {/* ── MONTH SELECTOR CAPSULE ── */}
        <View style={styles.monthSelectorBar}>
          <View>
            <Text style={styles.monthSelectorLabel}>PERFORMANCE PERIOD</Text>
            <Text style={styles.monthSelectorSub}>Showing meetings for single month</Text>
          </View>
          <View style={styles.monthControlsRow}>
            <TouchableOpacity onPress={() => switchMonth('prev')} style={styles.monthArrowBtn} activeOpacity={0.7}>
              <Ionicons name="chevron-back" size={16} color="#800E20" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.monthPillCapsule} onPress={() => setShowMonthModal(true)} activeOpacity={0.8}>
              <Ionicons name="calendar" size={13} color="#800E20" />
              <Text style={styles.monthPillCapsuleText}>{formattedSelectedMonth}</Text>
              <Ionicons name="chevron-down" size={12} color="#800E20" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => switchMonth('next')} style={styles.monthArrowBtn} activeOpacity={0.7}>
              <Ionicons name="chevron-forward" size={16} color="#800E20" />
            </TouchableOpacity>
          </View>
        </View>

        {/* ── 1. MONTHLY TARGET SUMMARY CARDS ── */}
        <View style={styles.targetsRow}>
          <TouchableOpacity
            style={[styles.targetCard, { backgroundColor: '#FAF5FF', borderColor: '#DDD6FE' }]}
            onPress={() => setStatusFilter(statusFilter === 'UPCOMING' ? 'ALL' : 'UPCOMING')}
            activeOpacity={0.8}
          >
            <Text style={[styles.targetCardTitle, { color: '#6D28D9' }]}>⏳ Upcoming</Text>
            <Text style={[styles.targetCardValue, { color: '#7C3AED' }]}>{upcomingCount}</Text>
            <Text style={styles.targetCardSub}>In {formattedSelectedMonth}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.targetCard, { backgroundColor: '#F0FDF4', borderColor: '#86EFAC' }]}
            onPress={() => setStatusFilter(statusFilter === 'COMPLETED' ? 'ALL' : 'COMPLETED')}
            activeOpacity={0.8}
          >
            <Text style={[styles.targetCardTitle, { color: '#15803D' }]}>✅ Completed</Text>
            <Text style={[styles.targetCardValue, { color: '#16A34A' }]}>{completedCount}</Text>
            <Text style={styles.targetCardSub}>In {formattedSelectedMonth}</Text>
          </TouchableOpacity>

          <View style={styles.targetCard}>
            <Text style={styles.targetCardTitle}>👥 Attendees</Text>
            <Text style={[styles.targetCardValue, { color: '#0284C7' }]}>{totalPeopleAttended}</Text>
            <Text style={[styles.targetCardSub, totalExpense > 0 && { color: '#16A34A', fontWeight: '700' }]}>
              {totalExpense > 0 ? `💰 ₹${totalExpense}` : 'Total joined'}
            </Text>
          </View>
        </View>

        {/* ── 2. CALENDAR ── */}
        <View style={styles.calendarCard}>
          <Calendar
            key={selectedMonth}
            current={selectedDate.startsWith(selectedMonth) ? selectedDate : `${selectedMonth}-01`}
            onDayPress={(day) => setSelectedDate(day.dateString)}
            onMonthChange={(month) => {
              const m = month.dateString.substring(0, 7);
              if (m !== selectedMonth) {
                setSelectedMonth(m);
                setSelectedDate(month.dateString);
              }
            }}
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

        {/* ── 3. QUICK DATE JUMP CHIPS (FOR SELECTED MONTH) ── */}
        {scheduledDatesList.length > 0 && (
          <View style={styles.chipsSection}>
            <Text style={styles.chipsSectionTitle}>📅 Scheduled Meeting Dates in {formattedSelectedMonth}:</Text>
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

        {/* ── 4. MEETINGS ON SELECTED DATE ── */}
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

        {/* ── 5. RECORDED MEETINGS FOR SELECTED MONTH (RECENT FIRST) ── */}
        <View style={[styles.sectionHeaderRow, { marginTop: 26 }]}>
          <View>
            <Text style={styles.sectionTitle}>Recorded Meetings ({displayedMonthMeetings.length})</Text>
            <Text style={styles.sectionSub}>Recent meetings in {formattedSelectedMonth}</Text>
          </View>
          <TouchableOpacity onPress={() => onRefresh()}>
            <Text style={styles.refreshLink}>Refresh ⟳</Text>
          </TouchableOpacity>
        </View>

        {/* Status Filter Tabs (All / Upcoming / Completed) */}
        <View style={styles.statusFilterRow}>
          <TouchableOpacity
            style={[styles.statusFilterBtn, statusFilter === 'ALL' && styles.statusFilterBtnActive]}
            onPress={() => setStatusFilter('ALL')}
            activeOpacity={0.8}
          >
            <Text style={[styles.statusFilterText, statusFilter === 'ALL' && styles.statusFilterTextActive]}>
              All ({monthMeetings.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.statusFilterBtn,
              statusFilter === 'UPCOMING'
                ? { backgroundColor: '#EDE9FE', borderColor: '#7C3AED' }
                : { backgroundColor: '#FAF5FF', borderColor: '#DDD6FE' }
            ]}
            onPress={() => setStatusFilter('UPCOMING')}
            activeOpacity={0.8}
          >
            <Text style={[
              styles.statusFilterText,
              { color: '#7C3AED' },
              statusFilter === 'UPCOMING' && { fontWeight: '700' }
            ]}>
              ⏳ Upcoming ({upcomingCount})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.statusFilterBtn,
              statusFilter === 'COMPLETED'
                ? { backgroundColor: '#DCFCE7', borderColor: '#16A34A' }
                : { backgroundColor: '#F0FDF4', borderColor: '#86EFAC' }
            ]}
            onPress={() => setStatusFilter('COMPLETED')}
            activeOpacity={0.8}
          >
            <Text style={[
              styles.statusFilterText,
              { color: '#15803D' },
              statusFilter === 'COMPLETED' && { fontWeight: '700' }
            ]}>
              ✅ Completed ({completedCount})
            </Text>
          </TouchableOpacity>
        </View>

        {displayedMonthMeetings.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>
              {statusFilter === 'ALL'
                ? `No Meetings in ${formattedSelectedMonth}`
                : `No ${statusFilter === 'UPCOMING' ? 'Upcoming' : 'Completed'} Meetings in ${formattedSelectedMonth}`}
            </Text>
            <Text style={styles.emptySub}>
              {statusFilter === 'ALL'
                ? 'No meetings recorded in Google Sheets for this month.'
                : `Try switching filter to see other meetings or schedule a new one.`}
            </Text>
          </View>
        ) : (
          <View style={styles.list}>
            {displayedMonthMeetings.map(m => (
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

      {/* ── MONTH PICKER MODAL ── */}
      <Modal visible={showMonthModal} transparent animationType="fade" onRequestClose={() => setShowMonthModal(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowMonthModal(false)}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Meeting Month</Text>
              <TouchableOpacity onPress={() => setShowMonthModal(false)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={20} color="#1F0B10" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={availableMonths}
              keyExtractor={(item) => item}
              renderItem={({ item }) => {
                const isSelected = item === selectedMonth;
                let monthLabel = item;
                try {
                  monthLabel = format(parseISO(item + '-01'), 'MMMM yyyy');
                } catch {}
                const isCurrent = item === currentMonthISO();
                return (
                  <TouchableOpacity
                    style={[styles.monthOptionRow, isSelected && styles.monthOptionSelected]}
                    onPress={() => {
                      setSelectedMonth(item);
                      setSelectedDate(item === currentMonthISO() ? today : item + '-01');
                      setShowMonthModal(false);
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <Ionicons
                        name={isSelected ? 'radio-button-on' : 'radio-button-off'}
                        size={18}
                        color={isSelected ? '#800E20' : '#8A7277'}
                      />
                      <Text style={[styles.monthOptionText, isSelected && styles.monthOptionTextSelected]}>
                        {monthLabel} {isCurrent ? '(Current)' : ''}
                      </Text>
                    </View>
                    {isSelected && <Ionicons name="checkmark" size={18} color="#800E20" />}
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        </TouchableOpacity>
      </Modal>
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
    paddingBottom: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F0E2E5',
  },
  headerTitle: { fontFamily: FontFamily.displayBlack, fontSize: 22, color: '#1F0B10', letterSpacing: -0.5 },
  headerSub: { fontFamily: FontFamily.sansMedium, fontSize: 12, color: '#8A7277', marginTop: 2 },
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
  addBtnText: { fontFamily: FontFamily.sansBold, color: '#FFFFFF', fontSize: 13, },
  scroll: { flex: 1 },
  scrollContent: { padding: 16 },

  // Month Selector Bar
  monthSelectorBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 14,
    borderWidth: 1.5,
    borderColor: '#EEDCE1',
    shadowColor: 'rgba(78, 5, 17, 0.04)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 2,
  },
  monthSelectorLabel: {
    fontFamily: FontFamily.sansBold,
    fontSize: 10,
    color: '#800E20',
    letterSpacing: 0.8,
  },
  monthSelectorSub: {
    fontFamily: FontFamily.sansRegular,
    fontSize: 11,
    color: '#8A7277',
    marginTop: 1,
  },
  monthControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  monthArrowBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FAF0F2',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#EEDCE1',
  },
  monthPillCapsule: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FAF0F2',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    gap: 5,
    borderWidth: 1,
    borderColor: '#EEDCE1',
  },
  monthPillCapsuleText: {
    fontFamily: FontFamily.sansBold,
    fontSize: 12,
    color: '#800E20',
  },

  // 1. Target Summary Cards
  targetsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  targetCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1.5,
    borderColor: '#EEDCE1',
    shadowColor: 'rgba(78, 5, 17, 0.04)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 2,
  },
  targetCardTitle: {
    fontFamily: FontFamily.sansSemiBold,
    fontSize: 11,
    color: '#8A7277',
  },
  targetCardValue: {
    fontFamily: FontFamily.displayBlack,
    fontSize: 22,
    color: '#800E20',
    marginVertical: 2,
  },
  targetCardSub: {
    fontFamily: FontFamily.sansRegular,
    fontSize: 10,
    color: '#8A7277',
  },

  // Calendar
  calendarCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 10,
    borderWidth: 1.5,
    borderColor: '#EEDCE1',
    marginBottom: 16,
    shadowColor: 'rgba(78, 5, 17, 0.04)',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 2,
    overflow: 'hidden',
  },

  // Chips Section
  chipsSection: { marginBottom: 16 },
  chipsSectionTitle: { fontFamily: FontFamily.displayBold, fontSize: 12, color: '#1F0B10', marginBottom: 8 },
  chipsScroll: { flexDirection: 'row' },
  dateChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginRight: 8,
    borderWidth: 1.5,
    borderColor: '#EEDCE1',
  },
  dateChipSelected: { backgroundColor: '#800E20', borderColor: '#800E20' },
  chipDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#800E20', marginRight: 6 },
  chipDotSelected: { backgroundColor: '#FFFFFF' },
  dateChipText: { fontFamily: FontFamily.sansSemiBold, fontSize: 12, color: '#1F0B10', marginRight: 6 },
  dateChipTextSelected: { color: '#FFFFFF' },
  chipCountBadge: { backgroundColor: '#FAF0F2', borderRadius: 10, paddingHorizontal: 6, paddingVertical: 1 },
  chipCountBadgeSelected: { backgroundColor: 'rgba(255, 255, 255, 0.25)' },
  chipCountText: { fontFamily: FontFamily.sansBold, fontSize: 10, color: '#800E20', },
  chipCountTextSelected: { color: '#FFFFFF' },

  // Sections
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontFamily: FontFamily.displayBold, fontSize: 15, color: '#1F0B10' },
  sectionSub: { fontFamily: FontFamily.sansRegular, fontSize: 11, color: '#8A7277', marginTop: 1 },
  sectionDate: { fontFamily: FontFamily.sansMedium, fontSize: 12, color: '#800E20', marginTop: 2, },
  countBadge: { backgroundColor: '#FAF0F2', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: '#EEDCE1' },
  countBadgeText: { fontFamily: FontFamily.sansBold, fontSize: 11, color: '#800E20', },
  refreshLink: { fontFamily: FontFamily.sansBold, fontSize: 12, color: '#800E20', },

  list: { gap: 12 },

  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#EEDCE1',
  },
  emptyTitle: { fontFamily: FontFamily.displayBold, fontSize: 15, color: '#1F0B10' },
  emptySub: { fontFamily: FontFamily.sansRegular, fontSize: 12, color: '#8A7277', marginTop: 4, textAlign: 'center' },
  emptyAddBtn: { marginTop: 14, backgroundColor: '#FAF0F2', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, borderWidth: 1, borderColor: '#EEDCE1' },
  emptyAddBtnText: { fontFamily: FontFamily.sansBold, fontSize: 12, color: '#800E20', },

  // Month Picker Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    maxHeight: '70%',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F0E2E5',
  },
  modalTitle: {
    fontFamily: FontFamily.displayBold,
    fontSize: 16,
    color: '#1F0B10',
  },
  modalCloseBtn: {
    padding: 4,
  },
  monthOptionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 6,
  },
  monthOptionSelected: {
    backgroundColor: '#FAF0F2',
  },
  monthOptionText: {
    fontFamily: FontFamily.sansMedium,
    fontSize: 14,
    color: '#1F0B10',
  },
  monthOptionTextSelected: {
    fontFamily: FontFamily.sansBold,
    color: '#800E20',
  },

  // District Selector Bar
  districtBarContainer: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    backgroundColor: '#FAF5F6',
    borderBottomWidth: 1,
    borderBottomColor: '#F5E6E8',
  },
  districtBarScroll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 2,
  },
  districtBarLabel: {
    fontFamily: FontFamily.sansBold,
    fontSize: 10,
    color: '#8A7277',
    letterSpacing: 0.5,
    marginRight: 4,
  },
  districtChip: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    shadowColor: 'rgba(0,0,0,0.03)',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 1,
    shadowRadius: 3,
    elevation: 1,
  },
  districtChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  districtChipText: {
    fontFamily: FontFamily.sansBold,
    fontSize: 11,
    color: '#4B5563',
  },
  districtChipTextActive: {
    color: '#FFFFFF',
  },

  // Status Filter Tabs
  statusFilterRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
    marginTop: 2,
  },
  statusFilterBtn: {
    flex: 1,
    paddingVertical: 9,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusFilterBtnActive: {
    backgroundColor: '#800E20',
    borderColor: '#800E20',
  },
  statusFilterText: {
    fontFamily: FontFamily.sansSemiBold,
    fontSize: 12,
    color: '#4B5563',
  },
  statusFilterTextActive: {
    color: '#FFFFFF',
    fontFamily: FontFamily.sansBold,
  },
});

const cardStyles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#EEDCE1',
    shadowColor: 'rgba(78, 5, 17, 0.04)',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 2,
    marginBottom: 12,
  },
  cardCompleted: {
    backgroundColor: '#F0FDF4',
    borderColor: '#86EFAC',
    shadowColor: 'rgba(22, 163, 74, 0.12)',
  },
  cardUpcoming: {
    backgroundColor: '#FAF5FF',
    borderColor: '#DDD6FE',
    shadowColor: 'rgba(124, 58, 237, 0.1)',
  },
  cardCancelled: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  iconCircleCompleted: {
    backgroundColor: '#DCFCE7',
  },
  iconCircleUpcoming: {
    backgroundColor: '#EDE9FE',
  },
  iconCircleCancelled: {
    backgroundColor: '#F1F5F9',
  },
  name: {
    fontFamily: FontFamily.displayBold,
    fontSize: 16,
    color: '#1F0B10',
    marginBottom: 3,
  },
  nameCompleted: {
    color: '#14532D',
  },
  locationText: {
    fontFamily: FontFamily.sansMedium,
    fontSize: 11,
    color: '#6B7280',
  },
  dateBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    marginVertical: 8,
  },
  dateBannerCompleted: {
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: '#86EFAC',
  },
  dateBannerUpcoming: {
    backgroundColor: '#EDE9FE',
    borderWidth: 1,
    borderColor: '#C4B5FD',
  },
  dateBannerCancelled: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  dateBannerLabel: {
    fontFamily: FontFamily.sansMedium,
    fontSize: 12,
    flex: 1,
  },
  dateBannerLabelCompleted: {
    color: '#15803D',
  },
  dateBannerLabelUpcoming: {
    color: '#6D28D9',
  },
  dateBannerLabelCancelled: {
    color: '#64748B',
  },
  boldVal: {
    fontFamily: FontFamily.sansBold,
    fontWeight: '700',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
  },
  detail: {
    fontFamily: FontFamily.sansMedium,
    fontSize: 12,
    color: '#6B4E55',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F7EFF1',
  },
  teTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FAF0F2',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  te: {
    fontFamily: FontFamily.sansMedium,
    fontSize: 11,
    color: '#800E20',
  },
  expenseTag: {
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: '#86EFAC',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  expenseTagText: {
    fontFamily: FontFamily.sansBold,
    fontSize: 11,
    color: '#15803D',
  },
});

const badge = StyleSheet.create({
  container: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  containerCompleted: {
    backgroundColor: '#DCFCE7',
  },
  containerUpcoming: {
    backgroundColor: '#EDE9FE',
  },
  containerCancelled: {
    backgroundColor: '#F3F4F6',
  },
  containerRescheduled: {
    backgroundColor: '#FEF3C7',
  },
  text: {
    fontFamily: FontFamily.sansBold,
    fontSize: 10,
    letterSpacing: 0.3,
  },
  textCompleted: {
    color: '#15803D',
  },
  textUpcoming: {
    color: '#7C3AED',
  },
  textCancelled: {
    color: '#6B7280',
  },
  textRescheduled: {
    color: '#D97706',
  },
});
