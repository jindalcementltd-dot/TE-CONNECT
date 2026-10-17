import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  RefreshControl, ActivityIndicator, Platform, Modal, FlatList,
} from 'react-native';
import { Calendar } from 'react-native-calendars';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Colors } from '../../src/theme/colors';
import { apiGetSlabs, apiGetUsers } from '../../src/services/api';
import { currentMonthISO, normalizeDate } from '../../src/utils/helpers';
import { Slab } from '../../src/types';
import { FontFamily } from '../../src/theme/typography';
import { Ionicons, MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import { format, parseISO } from 'date-fns';

function SlabStatusBadge({ status }: { status: Slab['status'] }) {
  const isComp = status === 'COMPLETED';
  const isCanc = status === 'CANCELLED';
  return (
    <View style={[
      badgeStyles.container,
      isComp ? badgeStyles.containerCompleted : (isCanc ? badgeStyles.containerCancelled : badgeStyles.containerUpcoming),
    ]}>
      <Text style={[
        badgeStyles.text,
        isComp ? badgeStyles.textCompleted : (isCanc ? badgeStyles.textCancelled : badgeStyles.textUpcoming),
      ]}>
        {isComp ? '✅ COMPLETED' : isCanc ? '✕ CANCELLED' : '⏳ UPCOMING'}
      </Text>
    </View>
  );
}

function SlabCard({ slab, onPress }: { slab: Slab; onPress: () => void }) {
  const normDate = normalizeDate(slab.slab_date);
  let formattedDate = normDate;
  try {
    if (normDate) {
      formattedDate = format(new Date(normDate + 'T00:00:00'), 'EEE, dd MMM yyyy');
    }
  } catch {}

  const isComp = slab.status === 'COMPLETED';
  const isCanc = slab.status === 'CANCELLED';

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
            name={isComp ? 'check-decagram' : (isCanc ? 'close-circle-outline' : 'clock-alert-outline')}
            size={24}
            color={isComp ? '#16A34A' : (isCanc ? '#6B7280' : '#C91F2B')}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[cardStyles.dealer, isComp && cardStyles.dealerCompleted]}>{slab.dealer_name}</Text>
          <Text style={cardStyles.contractor}>
            👷 {slab.contractor_name || 'No contractor assigned'}
          </Text>
        </View>
        <SlabStatusBadge status={slab.status} />
      </View>

      {/* Prominent Themed Date Banner */}
      <View style={[
        cardStyles.dateBanner,
        isComp ? cardStyles.dateBannerCompleted : (isCanc ? cardStyles.dateBannerCancelled : cardStyles.dateBannerUpcoming),
      ]}>
        <Ionicons
          name={isComp ? 'checkmark-circle' : 'calendar'}
          size={16}
          color={isComp ? '#15803D' : (isCanc ? '#6B7280' : '#C91F2B')}
          style={{ marginRight: 6 }}
        />
        <Text style={[
          cardStyles.dateBannerLabel,
          isComp ? cardStyles.dateBannerLabelCompleted : (isCanc ? cardStyles.dateBannerLabelCancelled : cardStyles.dateBannerLabelUpcoming),
        ]}>
          {isComp ? 'Casting Completed:' : (isCanc ? 'Cancelled Date:' : 'Scheduled Casting:')}{' '}
          <Text style={[cardStyles.boldVal, isComp && { color: '#166534' }]}>{formattedDate}</Text>
        </Text>
      </View>

      <View style={cardStyles.divider} />

      {slab.customer_name ? (
        <View style={cardStyles.infoRow}>
          <Feather name="home" size={14} color="#8A7277" style={{ marginRight: 6 }} />
          <Text style={cardStyles.infoText}>Site: <Text style={cardStyles.boldVal}>{slab.customer_name}</Text></Text>
        </View>
      ) : null}

      <View style={cardStyles.infoRow}>
        <MaterialCommunityIcons name="package-variant" size={15} color="#8A7277" style={{ marginRight: 6 }} />
        <Text style={cardStyles.infoText}>Expected Cement: <Text style={cardStyles.boldVal}>{slab.expected_cement ? `${slab.expected_cement} Bags` : 'Not specified'}</Text></Text>
      </View>

      {slab.remark ? (
        <View style={[cardStyles.remarkBox, isComp && cardStyles.remarkBoxCompleted]}>
          <Text style={[cardStyles.remarkText, isComp && cardStyles.remarkTextCompleted]}>{slab.remark}</Text>
        </View>
      ) : null}

      <View style={cardStyles.footerRow}>
        <View style={[cardStyles.teTag, isComp && cardStyles.teTagCompleted]}>
          <Feather name="user" size={12} color={isComp ? '#15803D' : '#800E20'} style={{ marginRight: 4 }} />
          <Text style={[cardStyles.teTagText, isComp && { color: '#15803D' }]}>
            {slab.assigned_te || 'Team Jajpur'}
          </Text>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          {(slab.latitude && slab.longitude) ? (
            <View style={cardStyles.gpsTag}>
              <Ionicons name="location" size={12} color="#15803D" style={{ marginRight: 4 }} />
              <Text style={cardStyles.gpsTagText}>GPS Logged</Text>
            </View>
          ) : null}

          {!isComp && (
            <View style={cardStyles.actionHintBadge}>
              <Text style={cardStyles.actionHintText}>Open →</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function SlabScreen() {
  const today = normalizeDate(new Date());
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthISO());
  const [showMonthModal, setShowMonthModal] = useState<boolean>(false);
  const [selectedDate, setSelectedDate] = useState(today);
  const [refreshing, setRefreshing] = useState(false);

  const { data: usersList } = useQuery({
    queryKey: ['users'],
    queryFn: () => apiGetUsers(),
  });

  const { data: slabs, isLoading, refetch } = useQuery({
    queryKey: ['slabs'],
    queryFn: () => apiGetSlabs(),
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const rawSlabs = useMemo(() => slabs || [], [slabs]);

  // Compute available months from all slab dates
  const availableMonths = useMemo(() => {
    const set = new Set<string>();
    set.add(currentMonthISO());
    rawSlabs.forEach(s => {
      const m = normalizeDate(s.slab_date).substring(0, 7);
      if (m && m.length === 7) set.add(m);
    });
    return Array.from(set).sort().reverse();
  }, [rawSlabs]);

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

  // Slabs filtered strictly by selectedMonth & sorted recent date first
  const monthSlabs = useMemo(() => {
    const list = rawSlabs.filter(s => normalizeDate(s.slab_date).startsWith(selectedMonth));
    return [...list].sort((a, b) => {
      const dateA = normalizeDate(a.slab_date);
      const dateB = normalizeDate(b.slab_date);
      return dateB.localeCompare(dateA);
    });
  }, [rawSlabs, selectedMonth]);

  // Summary counts for selectedMonth
  const completedCount = useMemo(() => monthSlabs.filter(s => s.status === 'COMPLETED').length, [monthSlabs]);
  const upcomingCount = useMemo(() => monthSlabs.filter(s => s.status !== 'COMPLETED' && s.status !== 'CANCELLED').length, [monthSlabs]);

  // Filter selection (ALL, UPCOMING, COMPLETED)
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'UPCOMING' | 'COMPLETED'>('ALL');

  const displayedMonthSlabs = useMemo(() => {
    if (statusFilter === 'UPCOMING') return monthSlabs.filter(s => s.status !== 'COMPLETED' && s.status !== 'CANCELLED');
    if (statusFilter === 'COMPLETED') return monthSlabs.filter(s => s.status === 'COMPLETED');
    return monthSlabs;
  }, [monthSlabs, statusFilter]);

  // Build marked dates for calendar & count map for selectedMonth
  const markedDates: Record<string, any> = {};
  const dateSlabCountMap: Record<string, number> = {};

  monthSlabs.forEach(slab => {
    if (!slab.slab_date) return;
    const dateKey = normalizeDate(slab.slab_date);
    if (!dateKey) return;

    dateSlabCountMap[dateKey] = (dateSlabCountMap[dateKey] || 0) + 1;
    markedDates[dateKey] = {
      marked: true,
      dotColor: '#800E20',
      activeOpacity: 0.8,
    };
  });

  // Highlight selected date
  const isSelectedDateMarked = !!markedDates[selectedDate];
  markedDates[selectedDate] = {
    ...markedDates[selectedDate],
    selected: true,
    selectedColor: '#800E20',
    selectedTextColor: '#FFFFFF',
    marked: isSelectedDateMarked,
    dotColor: '#FFFFFF',
  };

  const selectedSlabs = monthSlabs.filter(s => {
    return normalizeDate(s.slab_date) === selectedDate;
  });

  // List of distinct dates that have slabs scheduled in selectedMonth
  const scheduledDatesList = Object.keys(dateSlabCountMap).sort();

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
          <Text style={styles.headerTitle}>Slab Castings</Text>
          <Text style={styles.headerSub}>
            District Jajpur • Consolidated Team
          </Text>
        </View>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => router.push('/slab/add')}
          activeOpacity={0.85}
        >
          <Ionicons name="add" size={20} color="#FFFFFF" />
          <Text style={styles.addBtnText}>Schedule</Text>
        </TouchableOpacity>
      </View>

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
            <Text style={styles.monthSelectorSub}>Showing slabs for single month</Text>
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
          <View style={styles.targetCard}>
            <Text style={styles.targetCardTitle}>Total Slabs</Text>
            <Text style={styles.targetCardValue}>{monthSlabs.length}</Text>
            <Text style={styles.targetCardSub}>In {formattedSelectedMonth}</Text>
          </View>

          <View style={styles.targetCard}>
            <Text style={styles.targetCardTitle}>Completed</Text>
            <Text style={[styles.targetCardValue, { color: '#16A34A' }]}>{completedCount}</Text>
            <Text style={styles.targetCardSub}>Castings Done</Text>
          </View>

          <View style={styles.targetCard}>
            <Text style={styles.targetCardTitle}>Upcoming</Text>
            <Text style={[styles.targetCardValue, { color: '#800E20' }]}>{upcomingCount}</Text>
            <Text style={styles.targetCardSub}>Pending Castings</Text>
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
              todayButtonFontWeight: '800',
              dayTextColor: '#1F0B10',
              textDisabledColor: '#D1C2C5',
              dotColor: '#800E20',
              selectedDotColor: '#FFFFFF',
              arrowColor: '#800E20',
              monthTextColor: '#1F0B10',
              textDayFontWeight: '600',
              textMonthFontWeight: '800',
              textDayHeaderFontWeight: '700',
              textDayFontSize: 15,
              textMonthFontSize: 17,
              textDayHeaderFontSize: 12,
            }}
          />
        </View>

        {/* ── 3. QUICK DATE JUMP CHIPS (FOR SELECTED MONTH) ── */}
        {scheduledDatesList.length > 0 && (
          <View style={styles.chipsSection}>
            <Text style={styles.chipsSectionTitle}>📅 Scheduled Slab Dates in {formattedSelectedMonth}:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll}>
              {scheduledDatesList.map(dateKey => {
                const count = dateSlabCountMap[dateKey];
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

        {/* ── 4. SLABS ON SELECTED DATE ── */}
        <View style={styles.sectionHeaderRow}>
          <View>
            <Text style={styles.sectionTitle}>Slabs on Selected Date</Text>
            <Text style={styles.sectionDateText}>{formattedSelectedDate}</Text>
          </View>
          <View style={styles.countBadge}>
            <Text style={styles.countBadgeText}>{selectedSlabs.length} Slabs</Text>
          </View>
        </View>

        {selectedSlabs.length === 0 ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIconCircle}>
              <MaterialCommunityIcons name="calendar-blank" size={32} color="#800E20" />
            </View>
            <Text style={styles.emptyTitle}>No Slabs Scheduled on this date</Text>
            <Text style={styles.emptySub}>
              Tap below or select one of the highlighted dates in the calendar.
            </Text>
            <TouchableOpacity
              style={styles.emptyAddBtn}
              onPress={() => router.push('/slab/add')}
              activeOpacity={0.85}
            >
              <Text style={styles.emptyAddBtnText}>+ Schedule Slab for {formattedSelectedDate}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.slabsList}>
            {selectedSlabs.map(slab => (
              <SlabCard
                key={slab.slab_id}
                slab={slab}
                onPress={() => router.push(`/slab/${slab.slab_id}` as any)}
              />
            ))}
          </View>
        )}

        {/* ── 5. RECORDED SLABS FOR SELECTED MONTH (RECENT FIRST) ── */}
        <View style={[styles.sectionHeaderRow, { marginTop: 26 }]}>
          <View>
            <Text style={styles.sectionTitle}>Recorded Slabs for {formattedSelectedMonth} ({monthSlabs.length})</Text>
            <Text style={styles.sectionSub}>Recent castings appear first</Text>
          </View>
          <TouchableOpacity onPress={() => onRefresh()}>
            <Text style={styles.refreshLink}>Refresh ⟳</Text>
          </TouchableOpacity>
        </View>

        {/* Status Filter Tabs (ALL / UPCOMING / COMPLETED) */}
        <View style={styles.statusFilterBar}>
          <TouchableOpacity
            style={[styles.filterTab, statusFilter === 'ALL' && styles.filterTabActive]}
            onPress={() => setStatusFilter('ALL')}
            activeOpacity={0.8}
          >
            <Text style={[styles.filterTabText, statusFilter === 'ALL' && styles.filterTabTextActive]}>
              All ({monthSlabs.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterTab, styles.filterTabUpcoming, statusFilter === 'UPCOMING' && styles.filterTabUpcomingActive]}
            onPress={() => setStatusFilter('UPCOMING')}
            activeOpacity={0.8}
          >
            <Text style={[styles.filterTabText, styles.filterTabUpcomingText, statusFilter === 'UPCOMING' && styles.filterTabUpcomingTextActive]}>
              ⏳ Upcoming ({upcomingCount})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterTab, styles.filterTabCompleted, statusFilter === 'COMPLETED' && styles.filterTabCompletedActive]}
            onPress={() => setStatusFilter('COMPLETED')}
            activeOpacity={0.8}
          >
            <Text style={[styles.filterTabText, styles.filterTabCompletedText, statusFilter === 'COMPLETED' && styles.filterTabCompletedTextActive]}>
              ✅ Completed ({completedCount})
            </Text>
          </TouchableOpacity>
        </View>

        {displayedMonthSlabs.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>
              {statusFilter === 'UPCOMING' ? 'No Upcoming Slabs' : (statusFilter === 'COMPLETED' ? 'No Completed Slabs' : `No Slabs in ${formattedSelectedMonth}`)}
            </Text>
            <Text style={styles.emptySub}>
              {statusFilter === 'UPCOMING'
                ? 'All scheduled slabs for this period have been attended or completed.'
                : (statusFilter === 'COMPLETED' ? 'No completed slab castings recorded for this selection.' : 'No slab castings recorded in Google Sheet for this month.')}
            </Text>
          </View>
        ) : (
          <View style={styles.slabsList}>
            {displayedMonthSlabs.map(slab => (
              <SlabCard
                key={slab.slab_id}
                slab={slab}
                onPress={() => router.push(`/slab/${slab.slab_id}` as any)}
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
              <Text style={styles.modalTitle}>Select Slab Month</Text>
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
  container: {
    flex: 1,
    backgroundColor: '#F9F5F6',
  },
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
  headerTitle: {
    fontFamily: FontFamily.displayBlack,
    fontSize: 22,
    fontWeight: '900',
    color: '#1F0B10',
    letterSpacing: -0.5,
  },
  headerSub: {
    fontFamily: FontFamily.sansMedium,
    fontSize: 12,
    color: '#8A7277',
    fontWeight: '500',
    marginTop: 2,
  },
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
  addBtnText: {
    fontFamily: FontFamily.sansBold,
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },

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
    fontWeight: '800',
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
    fontWeight: '700',
    color: '#800E20',
  },

  // Target Summary Cards
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
    fontWeight: '700',
  },
  targetCardValue: {
    fontFamily: FontFamily.displayBlack,
    fontSize: 22,
    fontWeight: '900',
    color: '#1F0B10',
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
  chipsSection: {
    marginBottom: 16,
  },
  chipsSectionTitle: {
    fontFamily: FontFamily.displayBold,
    fontSize: 12,
    fontWeight: '800',
    color: '#1F0B10',
    marginBottom: 8,
  },
  chipsScroll: {
    flexDirection: 'row',
  },
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
  dateChipSelected: {
    backgroundColor: '#800E20',
    borderColor: '#800E20',
  },
  chipDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#800E20',
    marginRight: 6,
  },
  chipDotSelected: {
    backgroundColor: '#FFFFFF',
  },
  dateChipText: {
    fontFamily: FontFamily.sansSemiBold,
    fontSize: 12,
    color: '#1F0B10',
    fontWeight: '700',
    marginRight: 6,
  },
  dateChipTextSelected: {
    color: '#FFFFFF',
  },
  chipCountBadge: {
    backgroundColor: '#FAF0F2',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  chipCountBadgeSelected: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  chipCountText: {
    fontFamily: FontFamily.sansBold,
    fontSize: 10,
    color: '#800E20',
    fontWeight: '800',
  },
  chipCountTextSelected: {
    color: '#FFFFFF',
  },

  // Section Header
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontFamily: FontFamily.displayBold,
    fontSize: 15,
    fontWeight: '800',
    color: '#1F0B10',
  },
  sectionSub: {
    fontFamily: FontFamily.sansRegular,
    fontSize: 11,
    color: '#8A7277',
    marginTop: 1,
  },
  sectionDateText: {
    fontFamily: FontFamily.sansMedium,
    fontSize: 12,
    color: '#800E20',
    marginTop: 2,
    fontWeight: '600',
  },
  countBadge: {
    backgroundColor: '#FAF0F2',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#EEDCE1',
  },
  countBadgeText: {
    fontFamily: FontFamily.sansBold,
    fontSize: 11,
    color: '#800E20',
    fontWeight: '700',
  },
  refreshLink: {
    fontFamily: FontFamily.sansBold,
    fontSize: 12,
    color: '#800E20',
    fontWeight: '700',
  },

  slabsList: {
    gap: 12,
  },

  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#EEDCE1',
  },
  emptyIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#FAF0F2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  emptyTitle: {
    fontFamily: FontFamily.displayBold,
    fontSize: 15,
    fontWeight: '800',
    color: '#1F0B10',
  },
  emptySub: {
    fontFamily: FontFamily.sansRegular,
    fontSize: 12,
    color: '#8A7277',
    marginTop: 4,
    textAlign: 'center',
  },
  emptyAddBtn: {
    marginTop: 14,
    backgroundColor: '#FAF0F2',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#EEDCE1',
  },
  emptyAddBtnText: {
    fontFamily: FontFamily.sansBold,
    fontSize: 12,
    color: '#800E20',
    fontWeight: '700',
  },

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
    fontWeight: '800',
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
    fontWeight: '700',
  },

  // Status Filter Bar
  statusFilterBar: {
    flexDirection: 'row',
    gap: 8,
    marginVertical: 12,
  },
  filterTab: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingVertical: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterTabActive: {
    backgroundColor: '#800E20',
    borderColor: '#800E20',
  },
  filterTabText: {
    fontFamily: FontFamily.sansBold,
    fontSize: 12,
    fontWeight: '700',
    color: '#4B5563',
  },
  filterTabTextActive: {
    color: '#FFFFFF',
  },
  filterTabUpcoming: {
    borderColor: '#FECACA',
    backgroundColor: '#FFF7F7',
  },
  filterTabUpcomingActive: {
    backgroundColor: '#C91F2B',
    borderColor: '#C91F2B',
  },
  filterTabUpcomingText: {
    color: '#991B1B',
  },
  filterTabUpcomingTextActive: {
    color: '#FFFFFF',
  },
  filterTabCompleted: {
    borderColor: '#BBF7D0',
    backgroundColor: '#F7FEFA',
  },
  filterTabCompletedActive: {
    backgroundColor: '#16A34A',
    borderColor: '#16A34A',
  },
  filterTabCompletedText: {
    color: '#166534',
  },
  filterTabCompletedTextActive: {
    color: '#FFFFFF',
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
  cardUpcoming: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#FCA5A5',
    borderLeftWidth: 5,
    borderLeftColor: '#C91F2B',
    shadowColor: 'rgba(201, 31, 43, 0.08)',
  },
  cardCompleted: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1.5,
    borderColor: '#86EFAC',
    borderLeftWidth: 5,
    borderLeftColor: '#16A34A',
    shadowColor: 'rgba(22, 163, 74, 0.08)',
  },
  cardCancelled: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderLeftWidth: 5,
    borderLeftColor: '#9CA3AF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#FAF0F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircleUpcoming: {
    backgroundColor: '#FEE2E2',
  },
  iconCircleCompleted: {
    backgroundColor: '#DCFCE7',
  },
  iconCircleCancelled: {
    backgroundColor: '#F3F4F6',
  },
  dealer: {
    fontFamily: FontFamily.displayBold,
    fontSize: 15,
    fontWeight: '800',
    color: '#1F0B10',
  },
  dealerCompleted: {
    color: '#14532D',
  },
  contractor: {
    fontFamily: FontFamily.sansMedium,
    fontSize: 12,
    color: '#6B4E55',
    marginTop: 2,
  },
  dateBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
    marginTop: 10,
  },
  dateBannerUpcoming: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  dateBannerCompleted: {
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  dateBannerCancelled: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  dateBannerLabel: {
    fontFamily: FontFamily.sansSemiBold,
    fontSize: 12,
  },
  dateBannerLabelUpcoming: {
    color: '#991B1B',
  },
  dateBannerLabelCompleted: {
    color: '#166534',
  },
  dateBannerLabelCancelled: {
    color: '#4B5563',
  },
  divider: {
    height: 1,
    backgroundColor: '#F7EFF1',
    marginVertical: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  infoText: {
    fontFamily: FontFamily.sansRegular,
    fontSize: 12,
    color: '#8A7277',
  },
  boldVal: {
    fontFamily: FontFamily.sansBold,
    fontWeight: '700',
    color: '#1F0B10',
  },
  remarkBox: {
    backgroundColor: '#FAF0F2',
    borderRadius: 10,
    padding: 10,
    marginVertical: 8,
  },
  remarkBoxCompleted: {
    backgroundColor: '#DCFCE7',
  },
  remarkText: {
    fontFamily: FontFamily.sansMedium,
    fontSize: 11,
    color: '#6B4E55',
    fontStyle: 'italic',
  },
  remarkTextCompleted: {
    color: '#166534',
  },
  footerRow: {
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
  teTagCompleted: {
    backgroundColor: '#DCFCE7',
  },
  teTagText: {
    fontFamily: FontFamily.sansMedium,
    fontSize: 11,
    color: '#800E20',
  },
  gpsTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  gpsTagText: {
    fontFamily: FontFamily.sansBold,
    fontSize: 11,
    color: '#15803D',
    fontWeight: '700',
  },
  actionHintBadge: {
    backgroundColor: '#FDE8EA',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FECDD3',
  },
  actionHintText: {
    fontFamily: FontFamily.sansBold,
    fontSize: 11,
    color: '#C91F2B',
    fontWeight: '800',
  },
});

const badgeStyles = StyleSheet.create({
  container: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  containerUpcoming: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  containerCompleted: {
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: '#86EFAC',
  },
  containerCancelled: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  text: {
    fontFamily: FontFamily.sansBold,
    fontSize: 10,
    fontWeight: '800',
  },
  textUpcoming: {
    color: '#C91F2B',
  },
  textCompleted: {
    color: '#15803D',
  },
  textCancelled: {
    color: '#6B7280',
  },
});
