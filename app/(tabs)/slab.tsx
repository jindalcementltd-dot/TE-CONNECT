import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  RefreshControl, ActivityIndicator, Platform,
} from 'react-native';
import { Calendar } from 'react-native-calendars';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Colors } from '../../src/theme/colors';
import { apiGetSlabs } from '../../src/services/api';
import { currentMonthISO } from '../../src/utils/helpers';
import { Slab } from '../../src/types';
import { Ionicons, MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import { format } from 'date-fns';

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

      {slab.customer_name ? (
        <View style={cardStyles.infoRow}>
          <Feather name="home" size={14} color="#8A7277" style={{ marginRight: 6 }} />
          <Text style={cardStyles.infoText}>Site: <Text style={cardStyles.boldVal}>{slab.customer_name}</Text></Text>
        </View>
      ) : null}

      <View style={cardStyles.infoRow}>
        <MaterialCommunityIcons name="package-variant" size={15} color="#8A7277" style={{ marginRight: 6 }} />
        <Text style={cardStyles.infoText}>Expected: <Text style={cardStyles.boldVal}>{slab.expected_cement || 'Not specified'}</Text></Text>
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
            <Ionicons name="location" size={12} color="#16A34A" style={{ marginRight: 4 }} />
            <Text style={cardStyles.gpsTagText}>GPS Logged</Text>
          </View>
        ) : null}
      </View>
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

  // Robust date normalization for markings
  const markedDates: Record<string, any> = {};
  (slabs || []).forEach(slab => {
    if (!slab.slab_date) return;
    const rawDate = String(slab.slab_date).trim();
    const dateKey = rawDate.length >= 10 ? rawDate.substring(0, 10) : rawDate;
    
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

  const selectedSlabs = (slabs || []).filter(s => {
    if (!s.slab_date) return false;
    const rawDate = String(s.slab_date).trim();
    const dateKey = rawDate.length >= 10 ? rawDate.substring(0, 10) : rawDate;
    return dateKey === selectedDate;
  });

  const formattedSelectedDate = selectedDate
    ? format(new Date(selectedDate), 'EEEE, dd MMMM yyyy')
    : '';

  return (
    <View style={styles.container}>
      {/* Top Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Slabs Calendar</Text>
          <Text style={styles.headerSub}>Team Jajpur Casting Schedule</Text>
        </View>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => router.push('/slab/add')}
          activeOpacity={0.85}
        >
          <Ionicons name="add" size={20} color="#FFFFFF" />
          <Text style={styles.addBtnText}>Add Slab</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#800E20" />}
      >
        {/* Calendar Card */}
        <View style={styles.calendarCard}>
          <Calendar
            current={selectedDate}
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
            <Text style={styles.emptyTitle}>No Slabs Scheduled on This Date</Text>
            <Text style={styles.emptySub}>
              Tap the button below to schedule a new casting for {formattedSelectedDate}.
            </Text>
            <TouchableOpacity
              style={styles.emptyAddBtn}
              onPress={() => router.push('/slab/add')}
              activeOpacity={0.85}
            >
              <Text style={styles.emptyAddBtnText}>+ Schedule Slab for This Date</Text>
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
        <View style={[styles.sectionHeaderRow, { marginTop: 24 }]}>
          <Text style={styles.sectionTitle}>All Slabs This Month ({slabs?.length || 0})</Text>
          <TouchableOpacity onPress={() => onRefresh()}>
            <Text style={styles.refreshLink}>Refresh ⟳</Text>
          </TouchableOpacity>
        </View>

        {(slabs || []).length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No Slabs in Google Sheet</Text>
            <Text style={styles.emptySub}>Add your first slab casting to see live calendar dots and records here.</Text>
          </View>
        ) : (
          <View style={styles.slabsList}>
            {(slabs || []).map(slab => (
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
    fontSize: 22,
    fontWeight: '900',
    color: '#1F0B10',
    letterSpacing: -0.5,
  },
  headerSub: {
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
    marginBottom: 20,
    overflow: 'hidden',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#1F0B10',
    letterSpacing: -0.3,
  },
  sectionDateText: {
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
    fontSize: 12,
    fontWeight: '800',
    color: '#800E20',
  },
  refreshLink: {
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
    fontSize: 15,
    fontWeight: '800',
    color: '#1F0B10',
    marginBottom: 4,
    textAlign: 'center',
  },
  emptySub: {
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
    fontSize: 16,
    fontWeight: '800',
    color: '#1F0B10',
  },
  contractor: {
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
    fontSize: 13,
    color: '#8A7277',
    fontWeight: '500',
  },
  boldVal: {
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
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});
