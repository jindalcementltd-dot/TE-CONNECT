import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  RefreshControl, ActivityIndicator, Platform,
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
      { backgroundColor: isComp ? '#DCFCE7' : isCanc ? '#F3F4F6' : '#FBE8EC' }
    ]}>
      <Text style={[
        badgeStyles.text,
        { color: isComp ? '#15803D' : isCanc ? '#6B7280' : '#800E20' }
      ]}>
        {status || 'UPCOMING'}
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

  return (
    <TouchableOpacity style={cardStyles.card} onPress={onPress} activeOpacity={0.88}>
      <View style={cardStyles.header}>
        <View style={cardStyles.iconCircle}>
          <MaterialCommunityIcons name="office-building" size={24} color="#800E20" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={cardStyles.dealer}>{slab.dealer_name}</Text>
          <Text style={cardStyles.contractor}>
            👷 {slab.contractor_name || 'No contractor assigned'}
          </Text>
        </View>
        <SlabStatusBadge status={slab.status} />
      </View>

      <View style={cardStyles.divider} />

      {/* Date Row */}
      <View style={cardStyles.infoRow}>
        <Ionicons name="calendar-outline" size={14} color="#800E20" style={{ marginRight: 6 }} />
        <Text style={cardStyles.infoText}>Casting Date: <Text style={cardStyles.boldVal}>{formattedDate}</Text></Text>
      </View>

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
        <View style={cardStyles.remarkBox}>
          <Text style={cardStyles.remarkText}>{slab.remark}</Text>
        </View>
      ) : null}

      <View style={cardStyles.footerRow}>
        <View style={cardStyles.teTag}>
          <Feather name="user" size={12} color="#800E20" style={{ marginRight: 4 }} />
          <Text style={cardStyles.teTagText}>{slab.assigned_te || 'Team Jajpur'}</Text>
        </View>

        {(slab.latitude && slab.longitude) ? (
          <View style={cardStyles.gpsTag}>
            <Ionicons name="location" size={12} color="#15803D" style={{ marginRight: 4 }} />
            <Text style={cardStyles.gpsTagText}>GPS Logged</Text>
          </View>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

export default function SlabScreen() {
  const today = normalizeDate(new Date());
  const [selectedTE, setSelectedTE] = useState<string>('ALL');
  const [selectedDate, setSelectedDate] = useState(today);
  const [currentMonth, setCurrentMonth] = useState(currentMonthISO());
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

  // Unique team list
  const uniqueTeamList = useMemo(() => {
    const set = new Set<string>();
    (usersList || []).forEach(u => {
      if (u.name && u.name.trim()) set.add(u.name.trim());
    });
    (slabs || []).forEach(s => {
      if (s.assigned_te && s.assigned_te.trim()) set.add(s.assigned_te.trim());
    });
    return Array.from(set).filter(Boolean);
  }, [usersList, slabs]);

  const rawSlabs = useMemo(() => slabs || [], [slabs]);

  // Filter slabs by team member
  const allSlabs = useMemo(() => {
    if (selectedTE === 'ALL') return rawSlabs;
    return rawSlabs.filter(s => 
      String(s.assigned_te || s.created_by || '').toLowerCase() === selectedTE.toLowerCase()
    );
  }, [rawSlabs, selectedTE]);

  // Robust date normalization for markings
  const markedDates: Record<string, any> = {};
  const dateSlabCountMap: Record<string, number> = {};

  allSlabs.forEach(slab => {
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

  const selectedSlabs = allSlabs.filter(s => {
    return normalizeDate(s.slab_date) === selectedDate;
  });

  // List of distinct dates that have slabs scheduled
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
            {selectedTE === 'ALL' ? 'Team Jajpur • All Slabs' : `${selectedTE} • Scheduled Slabs`}
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

        {/* Calendar Card */}
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

        {/* Quick Date Jump Chips */}
        {scheduledDatesList.length > 0 && (
          <View style={styles.chipsSection}>
            <Text style={styles.chipsSectionTitle}>📅 Scheduled Slab Dates (Tap to Jump):</Text>
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

        {/* Selected Date Header */}
        <View style={styles.sectionHeaderRow}>
          <View>
            <Text style={styles.sectionTitle}>Slabs on Selected Date</Text>
            <Text style={styles.sectionDateText}>{formattedSelectedDate}</Text>
          </View>
          <View style={styles.countBadge}>
            <Text style={styles.countBadgeText}>{selectedSlabs.length} Slabs</Text>
          </View>
        </View>

        {/* Slabs List for Selected Date */}
        {selectedSlabs.length === 0 ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIconCircle}>
              <MaterialCommunityIcons name="calendar-blank" size={32} color="#800E20" />
            </View>
            <Text style={styles.emptyTitle}>No Slabs Scheduled for this date</Text>
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

        {/* Monthly All Slabs Overview */}
        <View style={[styles.sectionHeaderRow, { marginTop: 26 }]}>
          <Text style={styles.sectionTitle}>All Recorded Slabs ({allSlabs.length})</Text>
          <TouchableOpacity onPress={() => onRefresh()}>
            <Text style={styles.refreshLink}>Refresh ⟳</Text>
          </TouchableOpacity>
        </View>

        {allSlabs.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No Slabs in Google Sheet</Text>
            <Text style={styles.emptySub}>Add your first slab casting to see live calendar dots and records here.</Text>
          </View>
        ) : (
          <View style={styles.slabsList}>
            {allSlabs.map(slab => (
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
    paddingBottom: 16,
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

  calendarCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 12,
    borderWidth: 1.5,
    borderColor: '#EEDCE1',
    shadowColor: 'rgba(78, 5, 17, 0.08)',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 14,
    elevation: 4,
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
  sectionTitle: {
    fontFamily: FontFamily.displayBold,
    fontSize: 17,
    fontWeight: '800',
    color: '#1F0B10',
    letterSpacing: -0.3,
  },
  sectionDateText: {
    fontFamily: FontFamily.sansSemiBold,
    fontSize: 12,
    color: '#800E20',
    fontWeight: '600',
    marginTop: 2,
  },
  countBadge: {
    backgroundColor: '#FBE8EC',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E8D5DA',
  },
  countBadgeText: {
    fontFamily: FontFamily.sansBold,
    fontSize: 12,
    fontWeight: '800',
    color: '#800E20',
  },
  refreshLink: {
    fontFamily: FontFamily.sansBold,
    fontSize: 13,
    fontWeight: '700',
    color: '#800E20',
  },
  slabsList: {
    gap: 12,
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#EEDCE1',
    shadowColor: 'rgba(78, 5, 17, 0.04)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 8,
  },
  emptyIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FBE8EC',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyTitle: {
    fontFamily: FontFamily.displayBold,
    fontSize: 15,
    fontWeight: '800',
    color: '#1F0B10',
    marginBottom: 4,
    textAlign: 'center',
  },
  emptySub: {
    fontFamily: FontFamily.sansRegular,
    fontSize: 12,
    color: '#8A7277',
    textAlign: 'center',
    lineHeight: 18,
  },
  emptyAddBtn: {
    backgroundColor: '#800E20',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginTop: 14,
  },
  emptyAddBtnText: {
    fontFamily: FontFamily.sansBold,
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
});

const cardStyles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#EEDCE1',
    shadowColor: 'rgba(78, 5, 17, 0.06)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 10,
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: '#FBE8EC',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  dealer: {
    fontFamily: FontFamily.displayBold,
    fontSize: 16,
    fontWeight: '800',
    color: '#1F0B10',
  },
  contractor: {
    fontFamily: FontFamily.sansMedium,
    fontSize: 13,
    color: '#6B4E55',
    fontWeight: '600',
    marginTop: 2,
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
    fontFamily: FontFamily.sansMedium,
    fontSize: 13,
    color: '#8A7277',
    fontWeight: '500',
  },
  boldVal: {
    fontFamily: FontFamily.sansBold,
    fontWeight: '700',
    color: '#1F0B10',
  },
  remarkBox: {
    backgroundColor: '#FAF0F2',
    padding: 10,
    borderRadius: 10,
    marginTop: 4,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#F0D5DA',
  },
  remarkText: {
    fontFamily: FontFamily.sansRegular,
    fontSize: 12,
    color: '#6B4E55',
    fontWeight: '500',
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
  },
  teTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FBE8EC',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  teTagText: {
    fontFamily: FontFamily.sansBold,
    fontSize: 11,
    fontWeight: '700',
    color: '#800E20',
  },
  gpsTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  gpsTagText: {
    fontFamily: FontFamily.sansBold,
    fontSize: 11,
    fontWeight: '700',
    color: '#15803D',
  },
});

const badgeStyles = StyleSheet.create({
  container: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  text: {
    fontFamily: FontFamily.sansBold,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});
