import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  RefreshControl, ActivityIndicator, Dimensions, Platform, TextInput,
  Linking, Modal, FlatList,
} from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { Colors } from '../../src/theme/colors';
import {
  apiGetSales, apiGetDealers, apiGetActiveTracker, apiGetSettings, apiGetContractors, apiGetUsers,
} from '../../src/services/api';
import { getUser } from '../../src/services/auth';
import {
  bagsToMT, currentMonthISO, formatPercent,
  normalizeDate, formatDateShort, formatNumber
} from '../../src/utils/helpers';

import {
  getUserDistrict, getDealerDistrict, getSaleDistrict, getAvailableDistricts,
} from '../../src/utils/district';
import { Sale, Dealer, User } from '../../src/types';
import { FontFamily } from '../../src/theme/typography';
import { Ionicons, MaterialCommunityIcons, Feather } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

export default function SalesScreen() {
  const [user, setUser] = useState<User | null>(null);
  const [activeDistrict, setActiveDistrict] = useState<string>('Jajpur');
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'SALES' | 'DEALERS'>('SALES');
  const [filter, setFilter] = useState<'ALL' | 'TODAY'>('ALL');
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthISO());
  const [showMonthModal, setShowMonthModal] = useState<boolean>(false);
  const [dealerSearchQuery, setDealerSearchQuery] = useState<string>('');
  const [selectedDealerForModal, setSelectedDealerForModal] = useState<Dealer | null>(null);

  useEffect(() => {
    getUser().then(u => {
      setUser(u);
      if (u) {
        const userDist = getUserDistrict(u);
        setActiveDistrict(userDist);
      }
    });
  }, []);

  const today = normalizeDate(new Date());

  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: apiGetSettings,
  });

  const { data: usersList, refetch: refetchUsers } = useQuery({
    queryKey: ['users'],
    queryFn: () => apiGetUsers(),
  });

  const { data: allSales, refetch: refetchSales } = useQuery({
    queryKey: ['sales'],
    queryFn: () => apiGetSales(),
  });

  const { data: dealers, refetch: refetchDealers } = useQuery({
    queryKey: ['dealers'],
    queryFn: () => apiGetDealers(),
  });

  const { data: contractors, refetch: refetchContractors } = useQuery({
    queryKey: ['contractors'],
    queryFn: () => apiGetContractors(),
  });

  const { data: activeTrackers, refetch: refetchTrackers } = useQuery({
    queryKey: ['activeTrackers'],
    queryFn: () => apiGetActiveTracker(),
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      refetchUsers(),
      refetchSales(),
      refetchDealers(),
      refetchContractors(),
      refetchTrackers(),
    ]);
    setRefreshing(false);
  }, [refetchUsers, refetchSales, refetchDealers, refetchContractors, refetchTrackers]);

  const availableDistricts = useMemo(() => {
    return getAvailableDistricts(usersList, dealers);
  }, [usersList, dealers]);

  // SCOPED DEALERS FILTERED BY DISTRICT AND USER ROLE:
  const scopedDealers = useMemo(() => {
    const list = dealers || [];
    if (user?.role === 'TE') {
      const userDist = getUserDistrict(user);
      const cleanName = (user.name || '').trim().toLowerCase();
      return list.filter(d => {
        const dDist = getDealerDistrict(d, usersList);
        const isTeMatch = d.assigned_te && d.assigned_te.trim().toLowerCase() === cleanName;
        return isTeMatch || dDist.toLowerCase() === userDist.toLowerCase();
      });
    }
    if (!activeDistrict || activeDistrict === 'ALL') return list;
    return list.filter(d => getDealerDistrict(d, usersList).toLowerCase() === activeDistrict.toLowerCase());
  }, [dealers, usersList, user, activeDistrict]);

  // SCOPED SALES FILTERED BY DISTRICT AND USER ROLE:
  const scopedAllSales = useMemo(() => {
    const list = (allSales || []).filter(s => s && s.sale_date);
    if (user?.role === 'TE') {
      const userDist = getUserDistrict(user);
      const cleanName = (user.name || '').trim().toLowerCase();
      return list.filter(s => {
        const sDist = getSaleDistrict(s, dealers, usersList);
        const isTeMatch = s.assigned_te && s.assigned_te.trim().toLowerCase() === cleanName;
        return isTeMatch || sDist.toLowerCase() === userDist.toLowerCase();
      });
    }
    if (!activeDistrict || activeDistrict === 'ALL') return list;
    return list.filter(s => getSaleDistrict(s, dealers, usersList).toLowerCase() === activeDistrict.toLowerCase());
  }, [allSales, dealers, usersList, user, activeDistrict]);

  // Compute available months from sales data
  const availableMonths = useMemo(() => {
    const set = new Set<string>();
    set.add(currentMonthISO());
    scopedAllSales.forEach(s => {
      if (!s || !s.sale_date) return;
      const m = normalizeDate(s.sale_date).substring(0, 7);
      if (m && m.length === 7) set.add(m);
    });
    (activeTrackers || []).forEach(t => {
      if (!t) return;
      const m = normalizeDate(t.month || t.date).substring(0, 7);
      if (m && m.length === 7) set.add(m);
    });
    return Array.from(set).sort().reverse();
  }, [scopedAllSales, activeTrackers]);

  const switchMonth = (direction: 'prev' | 'next') => {
    const currentIndex = availableMonths.indexOf(selectedMonth);
    if (direction === 'prev' && currentIndex < availableMonths.length - 1) {
      setSelectedMonth(availableMonths[currentIndex + 1]);
    } else if (direction === 'next' && currentIndex > 0) {
      setSelectedMonth(availableMonths[currentIndex - 1]);
    }
  };

  const formattedSelectedMonth = useMemo(() => {
    try {
      return format(parseISO(selectedMonth + '-01'), 'MMMM yyyy');
    } catch {
      return selectedMonth;
    }
  }, [selectedMonth]);

  // Unified sales filtered by selectedMonth and scoped by district
  const monthSales = useMemo(() => {
    return scopedAllSales.filter(s => normalizeDate(s.sale_date).startsWith(selectedMonth));
  }, [scopedAllSales, selectedMonth]);

  // Filter sales (All vs Today) within selected month, sorted newest date first!
  const filteredSales = useMemo(() => {
    let list = monthSales;
    if (filter === 'TODAY') {
      list = list.filter(s => normalizeDate(s.sale_date) === today);
    }
    // Sort descending: recent transactions at the top!
    return [...list].sort((a, b) => {
      const dateA = normalizeDate(a.sale_date);
      const dateB = normalizeDate(b.sale_date);
      return dateB.localeCompare(dateA);
    });
  }, [monthSales, filter, today]);

  // Volume metrics for selected month
  const totalBags = monthSales.reduce((sum, s) => sum + (Number(s.quantity_bags) || 0), 0);
  const totalMT = (totalBags / 20).toFixed(1);
  const f2rBags = monthSales.filter(s => String(s.product).includes('F2R')).reduce((sum, s) => sum + Number(s.quantity_bags || 0), 0);
  const goldBags = monthSales.filter(s => String(s.product).includes('GOLD')).reduce((sum, s) => sum + Number(s.quantity_bags || 0), 0);

  // Dealer Leaderboard for selected month
  const rankedDealers = useMemo(() => {
    const dealerMap: Record<string, { dealer_id: string; dealer_name: string; area: string; address?: string; phone?: string; total_bags: number; f2r: number; gold: number }> = {};

    scopedDealers.forEach(d => {
      dealerMap[d.dealer_id] = {
        dealer_id: d.dealer_id,
        dealer_name: d.dealer_name,
        area: d.area || (user?.role === 'TE' ? getUserDistrict(user) : activeDistrict),
        address: d.address || '',
        phone: d.phone || '',
        total_bags: 0,
        f2r: 0,
        gold: 0,
      };
    });

    monthSales.forEach(s => {
      const did = s.dealer_id || s.dealer_name;
      if (!dealerMap[did]) {
        dealerMap[did] = {
          dealer_id: did,
          dealer_name: s.dealer_name,
          area: user?.role === 'TE' ? getUserDistrict(user) : activeDistrict,
          address: '',
          phone: '',
          total_bags: 0,
          f2r: 0,
          gold: 0,
        };
      }
      const q = Number(s.quantity_bags) || 0;
      dealerMap[did].total_bags += q;
      if (String(s.product).includes('F2R')) dealerMap[did].f2r += q;
      if (String(s.product).includes('GOLD')) dealerMap[did].gold += q;
    });

    return Object.values(dealerMap)
      .filter(d => d.total_bags > 0)
      .sort((a, b) => b.total_bags - a.total_bags);
  }, [scopedDealers, monthSales, user, activeDistrict]);

  // Monthly sales lookup by dealer
  const dealerMonthSalesMap = useMemo(() => {
    const map: Record<string, number> = {};
    monthSales.forEach(s => {
      const did = s.dealer_id || s.dealer_name;
      map[did] = (map[did] || 0) + (Number(s.quantity_bags) || 0);
    });
    return map;
  }, [monthSales]);

  // Filtered dealers for Dealers Directory search
  const filteredDealers = useMemo(() => {
    const list = scopedDealers;
    if (!dealerSearchQuery.trim()) return list;
    const q = dealerSearchQuery.trim().toLowerCase();
    return list.filter(d =>
      (d.dealer_name && d.dealer_name.toLowerCase().includes(q)) ||
      (d.owner_name && d.owner_name.toLowerCase().includes(q)) ||
      (d.area && d.area.toLowerCase().includes(q)) ||
      (d.address && d.address.toLowerCase().includes(q)) ||
      (d.phone && d.phone.toLowerCase().includes(q))
    );
  }, [scopedDealers, dealerSearchQuery]);

  // Open Google Maps Directions
  const openDirections = (dealer: Dealer) => {
    if (dealer.latitude && dealer.longitude) {
      const url = `https://www.google.com/maps/dir/?api=1&destination=${dealer.latitude},${dealer.longitude}`;
      Linking.openURL(url).catch(() => {
        Linking.openURL(`geo:${dealer.latitude},${dealer.longitude}?q=${dealer.latitude},${dealer.longitude}`);
      });
      return;
    }
    if (dealer.address && (dealer.address.startsWith('http://') || dealer.address.startsWith('https://'))) {
      Linking.openURL(dealer.address);
      return;
    }
    const query = encodeURIComponent([dealer.dealer_name, dealer.address, dealer.area, user?.role === 'TE' ? getUserDistrict(user) : activeDistrict].filter(Boolean).join(', '));
    const url = `https://www.google.com/maps/dir/?api=1&destination=${query}`;
    Linking.openURL(url);
  };

  // Direct Phone Call
  const openCall = (phone?: string) => {
    if (!phone) {
      alert('No phone number recorded for this dealer.');
      return;
    }
    Linking.openURL(`tel:${phone.replace(/[^0-9+]/g, '')}`);
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>
            {activeTab === 'SALES' ? 'Sales Command' : 'Dealer Directory'}
          </Text>
          <Text style={styles.headerSub}>
            District {user?.role === 'TE' ? getUserDistrict(user) : activeDistrict} • {user?.role === 'TE' ? (user.name || 'My Territory') : 'Consolidated Team'}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          {activeTab === 'SALES' && (
            <TouchableOpacity
              style={styles.headerScanBtn}
              onPress={() => router.push('/sale/scan')}
              activeOpacity={0.85}
            >
              <Ionicons name="camera" size={17} color="#800E20" />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.headerActionBtn}
            onPress={() => router.push(activeTab === 'SALES' ? '/sale/add' : '/dealer/add')}
            activeOpacity={0.85}
          >
            <Ionicons name="add" size={18} color="#FFFFFF" />
            <Text style={styles.headerActionBtnText}>
              {activeTab === 'SALES' ? 'Add Sale' : 'Add Dealer'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── TOP VIEW TOGGLE: SALES vs DEALERS ── */}
      <View style={styles.viewModeContainer}>
        <TouchableOpacity
          style={[styles.viewModeTab, activeTab === 'SALES' && styles.viewModeTabActive]}
          onPress={() => setActiveTab('SALES')}
          activeOpacity={0.8}
        >
          <MaterialCommunityIcons
            name="chart-box"
            size={17}
            color={activeTab === 'SALES' ? '#FFFFFF' : '#800E20'}
          />
          <Text style={[styles.viewModeTabText, activeTab === 'SALES' && styles.viewModeTabTextActive]}>
            Sales Command
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.viewModeTab, activeTab === 'DEALERS' && styles.viewModeTabActive]}
          onPress={() => setActiveTab('DEALERS')}
          activeOpacity={0.8}
        >
          <Ionicons
            name="storefront"
            size={16}
            color={activeTab === 'DEALERS' ? '#FFFFFF' : '#800E20'}
          />
          <Text style={[styles.viewModeTabText, activeTab === 'DEALERS' && styles.viewModeTabTextActive]}>
            Dealers Directory ({scopedDealers.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* DISTRICT SELECTOR BAR (For Admins / Managers) */}
      {user?.role !== 'TE' && availableDistricts.length > 0 && (
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
        {activeTab === 'SALES' ? (
          <>
            {/* ── MONTH SELECTOR CAPSULE ── */}
            <View style={styles.monthSelectorBar}>
              <View>
                <Text style={styles.monthSelectorLabel}>PERFORMANCE PERIOD</Text>
                <Text style={styles.monthSelectorSub}>Showing sales for single month</Text>
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

            {/* ── 1. WINE GLASS HERO CARD ── */}
            <View style={styles.heroCard}>
              <View style={styles.heroTop}>
                <View>
                  <Text style={styles.heroLabel}>TOTAL SALES VOLUME ({formattedSelectedMonth.toUpperCase()})</Text>
                  <Text style={styles.heroValueMT}>{totalMT} <Text style={styles.heroUnit}>MT</Text></Text>
                  <Text style={styles.heroBagsSub}>{formatNumber(totalBags)} Total Bags Logged in Sheet</Text>
                </View>
                <View style={styles.heroBadgeIcon}>
                  <MaterialCommunityIcons name="chart-box" size={32} color="#FFFFFF" />
                </View>
              </View>

              <View style={styles.heroDivider} />

              {/* Product Breakdown Badges */}
              <View style={styles.productRow}>
                <View style={styles.productGlassPill}>
                  <View style={[styles.productDot, { backgroundColor: '#E53935' }]} />
                  <View>
                    <Text style={styles.productLabel}>ACC F2R</Text>
                    <Text style={styles.productValue}>{f2rBags} bags ({(f2rBags / 20).toFixed(1)} MT)</Text>
                  </View>
                </View>

                <View style={styles.productGlassPill}>
                  <View style={[styles.productDot, { backgroundColor: '#F59E0B' }]} />
                  <View>
                    <Text style={styles.productLabel}>ACC GOLD</Text>
                    <Text style={styles.productValue}>{goldBags} bags ({(goldBags / 20).toFixed(1)} MT)</Text>
                  </View>
                </View>
              </View>
            </View>

            {/* ── 2. FILTER TABS (ALL vs TODAY) ── */}
            <View style={styles.filterTabsRow}>
              <TouchableOpacity
                style={[styles.filterTab, filter === 'ALL' && styles.filterTabActive]}
                onPress={() => setFilter('ALL')}
              >
                <Text style={[styles.filterTabText, filter === 'ALL' && styles.filterTabTextActive]}>
                  {formattedSelectedMonth} Sales ({monthSales.length})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.filterTab, filter === 'TODAY' && styles.filterTabActive]}
                onPress={() => setFilter('TODAY')}
              >
                <Text style={[styles.filterTabText, filter === 'TODAY' && styles.filterTabTextActive]}>
                  Today's Sales
                </Text>
              </TouchableOpacity>
            </View>

            {/* ── 3. DEALER LEADERBOARD FOR SELECTED MONTH ── */}
            <View style={styles.sectionHeaderRow}>
              <View>
                <Text style={styles.sectionHeaderTitle}>Dealer Leaderboard</Text>
                <Text style={styles.sectionHeaderSub}>Ranking for {formattedSelectedMonth}</Text>
              </View>
              <Text style={styles.sectionHeaderCount}>{rankedDealers.length} Active</Text>
            </View>

            {rankedDealers.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>No Dealer Sales for {formattedSelectedMonth}</Text>
                <Text style={styles.emptySub}>Add a sale to see dealer sales leaderboard ranking here.</Text>
              </View>
            ) : (
              <View style={styles.leaderboardContainer}>
                {rankedDealers.map((d, idx) => (
                  <View key={d.dealer_id} style={[styles.dealerRow, idx === rankedDealers.length - 1 && { borderBottomWidth: 0 }]}>
                    <View style={[styles.rankBadge, idx === 0 ? styles.rankGold : idx === 1 ? styles.rankSilver : styles.rankBronze]}>
                      <Text style={styles.rankBadgeText}>{idx + 1}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.dealerName}>{d.dealer_name}</Text>
                      <Text style={styles.dealerArea}>{d.area} • F2R: {d.f2r} | Gold: {d.gold}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={styles.dealerMT}>{(d.total_bags / 20).toFixed(1)} MT</Text>
                      <Text style={styles.dealerBags}>{d.total_bags} bags</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* ── 4. RECENT SALES LOG (SORTED BY DATE DESCENDING) ── */}
            <View style={[styles.sectionHeaderRow, { marginTop: 24 }]}>
              <View>
                <Text style={styles.sectionHeaderTitle}>Sales Log ({filteredSales.length})</Text>
                <Text style={styles.sectionHeaderSub}>Recent transactions appear first</Text>
              </View>
              <TouchableOpacity onPress={() => onRefresh()}>
                <Text style={styles.refreshLink}>Refresh ⟳</Text>
              </TouchableOpacity>
            </View>

            {filteredSales.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>No Sales Entries in {formattedSelectedMonth}</Text>
                <Text style={styles.emptySub}>Tap '+ Add Sale' above to record a new sale in Google Sheets.</Text>
              </View>
            ) : (
              <View style={styles.salesList}>
                {filteredSales.map((sale) => (
                  <View key={sale.sale_id} style={styles.saleTransactionCard}>
                    <View style={styles.saleIconBox}>
                      <MaterialCommunityIcons name="package-variant-closed" size={22} color="#800E20" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.saleDealer}>{sale.dealer_name}</Text>
                      <Text style={styles.saleProduct}>{sale.product} • Logged by {sale.created_by || sale.assigned_te || 'Admin'}</Text>
                      <Text style={styles.saleDateText}>📅 {normalizeDate(sale.sale_date)}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={styles.saleQuantity}>{sale.quantity_bags} Bags</Text>
                      <Text style={styles.saleMT}>{(Number(sale.quantity_bags) / 20).toFixed(1)} MT</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </>
        ) : (
          /* ── DEALERS DIRECTORY VIEW ── */
          <>
            {/* Search Bar */}
            <View style={styles.searchBarContainer}>
              <Ionicons name="search" size={18} color="#8A7277" style={{ marginRight: 8 }} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search dealer by name, owner, area, phone..."
                placeholderTextColor="#A89498"
                value={dealerSearchQuery}
                onChangeText={setDealerSearchQuery}
                clearButtonMode="while-editing"
              />
              {dealerSearchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setDealerSearchQuery('')} style={{ padding: 4 }}>
                  <Ionicons name="close-circle" size={18} color="#8A7277" />
                </TouchableOpacity>
              )}
            </View>

            {/* Directory Summary Banner */}
            <View style={styles.directoryHeaderRow}>
              <View>
                <Text style={styles.directoryCountText}>
                  {filteredDealers.length} {filteredDealers.length === 1 ? 'Dealer Counter' : 'Dealer Counters'}
                </Text>
                <Text style={styles.directorySubText}>Tap counter for details or tap Directions to navigate</Text>
              </View>
              <TouchableOpacity
                style={styles.addDealerSmallBtn}
                onPress={() => router.push('/dealer/add')}
                activeOpacity={0.8}
              >
                <Ionicons name="add" size={16} color="#800E20" />
                <Text style={styles.addDealerSmallBtnText}>New Dealer</Text>
              </TouchableOpacity>
            </View>

            {filteredDealers.length === 0 ? (
              <View style={styles.emptyCard}>
                <Ionicons name="storefront-outline" size={42} color="#800E20" style={{ marginBottom: 8 }} />
                <Text style={styles.emptyTitle}>No Dealers Found</Text>
                <Text style={styles.emptySub}>No counter matched your search query. Tap 'New Dealer' to add one.</Text>
              </View>
            ) : (
              <View style={styles.dealersListContainer}>
                {filteredDealers.map((dealer) => {
                  const bagsThisMonth = dealerMonthSalesMap[dealer.dealer_id] || 0;
                  const mtThisMonth = (bagsThisMonth / 20).toFixed(1);

                  return (
                    <View key={dealer.dealer_id} style={styles.dealerDirectoryCard}>
                      <TouchableOpacity
                        activeOpacity={0.85}
                        onPress={() => setSelectedDealerForModal(dealer)}
                      >
                        <View style={styles.dealerCardTop}>
                          <View style={styles.dealerCardIconWrap}>
                            <Ionicons name="storefront-outline" size={24} color="#800E20" />
                          </View>
                          <View style={{ flex: 1, marginLeft: 12 }}>
                            <View style={styles.dealerTitleRow}>
                              <Text style={styles.dealerFirmName}>{dealer.dealer_name}</Text>
                              <View style={[styles.statusBadgePill, dealer.active ? styles.statusBadgeActive : styles.statusBadgeInactive]}>
                                <Text style={[styles.statusBadgePillText, dealer.active ? styles.statusTextActive : styles.statusTextInactive]}>
                                  {dealer.active ? 'Active' : 'Inactive'}
                                </Text>
                              </View>
                            </View>

                            {dealer.owner_name ? (
                              <View style={styles.dealerMetaRow}>
                                <Ionicons name="person-outline" size={13} color="#8A7277" />
                                <Text style={styles.dealerMetaText}>{dealer.owner_name}</Text>
                              </View>
                            ) : null}

                            <View style={styles.dealerMetaRow}>
                              <Ionicons name="location-outline" size={13} color="#8A7277" />
                              <Text style={styles.dealerMetaText}>
                                {dealer.area || 'Jajpur'}{dealer.address ? ` • ${dealer.address}` : ''}
                              </Text>
                            </View>

                            {dealer.assigned_te ? (
                              <View style={styles.dealerMetaRow}>
                                <MaterialCommunityIcons name="badge-account-horizontal-outline" size={13} color="#8A7277" />
                                <Text style={styles.dealerMetaText}>TE: {dealer.assigned_te}</Text>
                              </View>
                            ) : null}
                          </View>
                        </View>

                        {/* Month Volume Bar */}
                        <View style={styles.dealerSalesPillRow}>
                          <View style={styles.dealerSalesPill}>
                            <Text style={styles.dealerSalesPillLabel}>{formattedSelectedMonth} Sales:</Text>
                            <Text style={styles.dealerSalesPillVal}>
                              {formatNumber(bagsThisMonth)} Bags ({mtThisMonth} MT)
                            </Text>
                          </View>
                        </View>
                      </TouchableOpacity>

                      {/* Action Buttons: Call & Directions & QR */}
                      <View style={styles.dealerActionsRow}>
                        <TouchableOpacity
                          style={styles.dealerActionBtnOutline}
                          onPress={() => openCall(dealer.phone)}
                          activeOpacity={0.8}
                        >
                          <Ionicons name="call" size={15} color="#800E20" />
                          <Text style={styles.dealerActionBtnOutlineText} numberOfLines={1}>
                            {dealer.phone ? dealer.phone : 'Call'}
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={styles.dealerActionBtnFill}
                          onPress={() => openDirections(dealer)}
                          activeOpacity={0.8}
                        >
                          <MaterialCommunityIcons name="navigation-variant" size={16} color="#FFFFFF" />
                          <Text style={styles.dealerActionBtnFillText}>Directions</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={styles.dealerActionIconBtn}
                          onPress={() => router.push(`/dealer/${dealer.dealer_id}` as any)}
                          activeOpacity={0.8}
                        >
                          <MaterialCommunityIcons name="qrcode-scan" size={18} color="#800E20" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </>
        )}

        <View style={{ height: 60 }} />
      </ScrollView>

      {/* ── MONTH PICKER MODAL ── */}
      <Modal visible={showMonthModal} transparent animationType="fade" onRequestClose={() => setShowMonthModal(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowMonthModal(false)}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Sales Month</Text>
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

      {/* ── DEALER DETAILS POPUP MODAL ── */}
      <Modal
        visible={!!selectedDealerForModal}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedDealerForModal(null)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setSelectedDealerForModal(null)}
        >
          <View style={styles.dealerDetailModalCard}>
            {selectedDealerForModal && (
              <>
                <View style={styles.modalDetailHeader}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                    <View style={styles.dealerModalIconWrap}>
                      <Ionicons name="storefront" size={24} color="#800E20" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.dealerModalFirmName}>{selectedDealerForModal.dealer_name}</Text>
                      <Text style={styles.dealerModalSub}>{selectedDealerForModal.area || 'Jajpur Territory'}</Text>
                    </View>
                  </View>
                  <TouchableOpacity onPress={() => setSelectedDealerForModal(null)} style={styles.modalCloseBtn}>
                    <Ionicons name="close" size={22} color="#1F0B10" />
                  </TouchableOpacity>
                </View>

                <View style={styles.modalDivider} />

                <ScrollView style={{ maxHeight: 380 }} showsVerticalScrollIndicator={false}>
                  {/* Info Rows */}
                  <View style={styles.modalInfoRow}>
                    <Ionicons name="person-circle-outline" size={20} color="#800E20" />
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text style={styles.modalInfoLabel}>Owner Name</Text>
                      <Text style={styles.modalInfoVal}>{selectedDealerForModal.owner_name || 'Not recorded'}</Text>
                    </View>
                  </View>

                  <View style={styles.modalInfoRow}>
                    <Ionicons name="call-outline" size={20} color="#800E20" />
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text style={styles.modalInfoLabel}>Contact Phone</Text>
                      <Text style={styles.modalInfoVal}>{selectedDealerForModal.phone || 'No phone'}</Text>
                    </View>
                    {selectedDealerForModal.phone ? (
                      <TouchableOpacity
                        style={styles.modalMiniBtn}
                        onPress={() => openCall(selectedDealerForModal.phone)}
                      >
                        <Ionicons name="call" size={14} color="#FFFFFF" />
                        <Text style={styles.modalMiniBtnText}>Call</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>

                  <View style={styles.modalInfoRow}>
                    <Ionicons name="location-outline" size={20} color="#800E20" />
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text style={styles.modalInfoLabel}>Address & Location</Text>
                      <Text style={styles.modalInfoVal}>
                        {[selectedDealerForModal.address, selectedDealerForModal.area, 'Jajpur'].filter(Boolean).join(', ')}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.modalInfoRow}>
                    <MaterialCommunityIcons name="badge-account-horizontal-outline" size={20} color="#800E20" />
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text style={styles.modalInfoLabel}>Assigned TE</Text>
                      <Text style={styles.modalInfoVal}>{selectedDealerForModal.assigned_te || 'Team Jajpur'}</Text>
                    </View>
                  </View>

                  <View style={styles.modalInfoRow}>
                    <MaterialCommunityIcons name="package-variant-closed" size={20} color="#800E20" />
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text style={styles.modalInfoLabel}>{formattedSelectedMonth} Total Sales</Text>
                      <Text style={[styles.modalInfoVal, { color: '#800E20', fontWeight: '800' }]}>
                        {dealerMonthSalesMap[selectedDealerForModal.dealer_id] || 0} Bags ({((dealerMonthSalesMap[selectedDealerForModal.dealer_id] || 0) / 20).toFixed(1)} MT)
                      </Text>
                    </View>
                  </View>
                </ScrollView>

                {/* Bottom Modal Actions */}
                <View style={styles.modalBottomActions}>
                  <TouchableOpacity
                    style={styles.modalPrimaryBtn}
                    onPress={() => {
                      openDirections(selectedDealerForModal);
                    }}
                    activeOpacity={0.85}
                  >
                    <MaterialCommunityIcons name="navigation-variant" size={18} color="#FFFFFF" />
                    <Text style={styles.modalPrimaryBtnText}>Get Directions in Google Maps</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.modalSecondaryBtn}
                    onPress={() => {
                      const id = selectedDealerForModal.dealer_id;
                      setSelectedDealerForModal(null);
                      router.push(`/dealer/${id}` as any);
                    }}
                    activeOpacity={0.85}
                  >
                    <MaterialCommunityIcons name="qrcode-scan" size={18} color="#800E20" />
                    <Text style={styles.modalSecondaryBtnText}>View QR Code & Public Link</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
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
    color: '#1F0B10',
    letterSpacing: -0.5,
  },
  headerSub: {
    fontFamily: FontFamily.sansMedium,
    fontSize: 12,
    color: '#8A7277',
    marginTop: 2,
  },
  headerScanBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#FAF0F2',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#F8B4BD',
  },
  headerActionBtn: {
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
  headerActionBtnText: {
    fontFamily: FontFamily.sansBold,
    color: '#FFFFFF',
    fontSize: 13,
  },

  // View Mode Switcher
  viewModeContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F0E2E5',
  },
  viewModeTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: 12,
    backgroundColor: '#FAF0F2',
    borderWidth: 1,
    borderColor: '#EEDCE1',
  },
  viewModeTabActive: {
    backgroundColor: '#800E20',
    borderColor: '#800E20',
  },
  viewModeTabText: {
    fontFamily: FontFamily.sansSemiBold,
    fontSize: 12,
    color: '#800E20',
  },
  viewModeTabTextActive: {
    color: '#FFFFFF',
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

  // Hero Card
  heroCard: {
    backgroundColor: '#4A0611',
    borderRadius: 24,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#4A0611',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  heroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heroLabel: {
    fontFamily: FontFamily.sansBold,
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.7)',
    letterSpacing: 1,
  },
  heroValueMT: {
    fontFamily: FontFamily.displayBlack,
    fontSize: 32,
    color: '#FFFFFF',
    marginTop: 2,
  },
  heroUnit: {
    fontFamily: FontFamily.displayBold,
    fontSize: 18,
    color: '#E53935',
  },
  heroBagsSub: {
    fontFamily: FontFamily.sansMedium,
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 2,
  },
  heroBadgeIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  heroDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    marginVertical: 14,
  },
  productRow: {
    flexDirection: 'row',
    gap: 10,
  },
  productGlassPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  productDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  productLabel: {
    fontFamily: FontFamily.sansBold,
    fontSize: 11,
    color: '#FFFFFF',
  },
  productValue: {
    fontFamily: FontFamily.sansMedium,
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.85)',
  },

  // Filter Tabs
  filterTabsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 18,
  },
  filterTab: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#EEDCE1',
  },
  filterTabActive: {
    backgroundColor: '#800E20',
    borderColor: '#800E20',
  },
  filterTabText: {
    fontFamily: FontFamily.sansSemiBold,
    fontSize: 12,
    color: '#800E20',
  },
  filterTabTextActive: {
    color: '#FFFFFF',
  },

  // Sections
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionHeaderTitle: {
    fontFamily: FontFamily.displayBold,
    fontSize: 16,
    color: '#1F0B10',
  },
  sectionHeaderSub: {
    fontFamily: FontFamily.sansRegular,
    fontSize: 11,
    color: '#8A7277',
    marginTop: 1,
  },
  sectionHeaderCount: {
    fontFamily: FontFamily.sansBold,
    fontSize: 12,
    color: '#800E20',
  },
  refreshLink: {
    fontFamily: FontFamily.sansBold,
    fontSize: 12,
    color: '#800E20',
  },

  // Leaderboard
  leaderboardContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 14,
    borderWidth: 1.5,
    borderColor: '#EEDCE1',
    shadowColor: 'rgba(78, 5, 17, 0.04)',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 2,
    marginBottom: 6,
  },
  dealerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: '#F7EFF1',
  },
  rankBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  rankGold: { backgroundColor: '#FBBF24' },
  rankSilver: { backgroundColor: '#CBD5E1' },
  rankBronze: { backgroundColor: '#FDBA74' },
  rankBadgeText: {
    fontFamily: FontFamily.displayBlack,
    fontSize: 13,
    color: '#1F0B10',
  },
  dealerName: {
    fontFamily: FontFamily.displayBold,
    fontSize: 14,
    color: '#1F0B10',
  },
  dealerArea: {
    fontFamily: FontFamily.sansMedium,
    fontSize: 11,
    color: '#8A7277',
    marginTop: 2,
  },
  dealerMT: {
    fontFamily: FontFamily.displayBold,
    fontSize: 14,
    color: '#800E20',
  },
  dealerBags: {
    fontFamily: FontFamily.sansRegular,
    fontSize: 10,
    color: '#8A7277',
  },

  // Sales List
  salesList: {
    gap: 10,
  },
  saleTransactionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#EEDCE1',
    shadowColor: 'rgba(78, 5, 17, 0.04)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 2,
  },
  saleIconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#FBE8EC',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  saleDealer: {
    fontFamily: FontFamily.displayBold,
    fontSize: 14,
    color: '#1F0B10',
  },
  saleProduct: {
    fontFamily: FontFamily.sansMedium,
    fontSize: 12,
    color: '#6B4E55',
    marginTop: 2,
  },
  saleDateText: {
    fontFamily: FontFamily.sansMedium,
    fontSize: 11,
    color: '#800E20',
    marginTop: 2,
  },
  saleQuantity: {
    fontFamily: FontFamily.displayBlack,
    fontSize: 15,
    color: '#800E20',
  },
  saleMT: {
    fontFamily: FontFamily.sansSemiBold,
    fontSize: 11,
    color: '#8A7277',
  },

  // Dealers Directory
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1.5,
    borderColor: '#EEDCE1',
    marginBottom: 14,
  },
  searchInput: {
    flex: 1,
    fontFamily: FontFamily.sansMedium,
    fontSize: 13,
    color: '#1F0B10',
    padding: 0,
  },
  directoryHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  directoryCountText: {
    fontFamily: FontFamily.displayBold,
    fontSize: 15,
    color: '#1F0B10',
  },
  directorySubText: {
    fontFamily: FontFamily.sansRegular,
    fontSize: 11,
    color: '#8A7277',
    marginTop: 1,
  },
  addDealerSmallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FAF0F2',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#EEDCE1',
  },
  addDealerSmallBtnText: {
    fontFamily: FontFamily.sansBold,
    fontSize: 11,
    color: '#800E20',
  },
  dealersListContainer: {
    gap: 12,
  },
  dealerDirectoryCard: {
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
  },
  dealerCardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  dealerCardIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#FAF0F2',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#EEDCE1',
  },
  dealerTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  dealerFirmName: {
    fontFamily: FontFamily.displayBold,
    fontSize: 15,
    color: '#1F0B10',
    flex: 1,
  },
  statusBadgePill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    marginLeft: 6,
  },
  statusBadgeActive: { backgroundColor: '#DCFCE7' },
  statusBadgeInactive: { backgroundColor: '#F1F5F9' },
  statusBadgePillText: {
    fontFamily: FontFamily.sansBold,
    fontSize: 10,
  },
  statusTextActive: { color: '#16A34A' },
  statusTextInactive: { color: '#64748B' },
  dealerMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 3,
  },
  dealerMetaText: {
    fontFamily: FontFamily.sansMedium,
    fontSize: 12,
    color: '#6B4E55',
    flex: 1,
  },
  dealerSalesPillRow: {
    marginTop: 10,
    marginBottom: 10,
  },
  dealerSalesPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FAF0F2',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#F2DFE4',
  },
  dealerSalesPillLabel: {
    fontFamily: FontFamily.sansMedium,
    fontSize: 11,
    color: '#8A7277',
  },
  dealerSalesPillVal: {
    fontFamily: FontFamily.sansBold,
    fontSize: 11,
    color: '#800E20',
  },
  dealerActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F7EFF1',
  },
  dealerActionBtnOutline: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#800E20',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  dealerActionBtnOutlineText: {
    fontFamily: FontFamily.sansBold,
    fontSize: 12,
    color: '#800E20',
  },
  dealerActionBtnFill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#800E20',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  dealerActionBtnFillText: {
    fontFamily: FontFamily.sansBold,
    fontSize: 12,
    color: '#FFFFFF',
  },
  dealerActionIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#FAF0F2',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#EEDCE1',
  },

  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#EEDCE1',
  },
  emptyTitle: {
    fontFamily: FontFamily.displayBold,
    fontSize: 15,
    color: '#1F0B10',
  },
  emptySub: {
    fontFamily: FontFamily.sansRegular,
    fontSize: 12,
    color: '#8A7277',
    marginTop: 4,
    textAlign: 'center',
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

  // Dealer Details Modal
  dealerDetailModalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 26,
    padding: 22,
    maxHeight: '85%',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 24,
    elevation: 12,
  },
  modalDetailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dealerModalIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: '#FAF0F2',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#EEDCE1',
  },
  dealerModalFirmName: {
    fontFamily: FontFamily.displayBold,
    fontSize: 16,
    color: '#1F0B10',
  },
  dealerModalSub: {
    fontFamily: FontFamily.sansMedium,
    fontSize: 12,
    color: '#8A7277',
    marginTop: 2,
  },
  modalDivider: {
    height: 1,
    backgroundColor: '#F0E2E5',
    marginVertical: 14,
  },
  modalInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F7EFF1',
  },
  modalInfoLabel: {
    fontFamily: FontFamily.sansMedium,
    fontSize: 11,
    color: '#8A7277',
  },
  modalInfoVal: {
    fontFamily: FontFamily.sansSemiBold,
    fontSize: 13,
    color: '#1F0B10',
    marginTop: 1,
  },
  modalMiniBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#800E20',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  modalMiniBtnText: {
    fontFamily: FontFamily.sansBold,
    fontSize: 11,
    color: '#FFFFFF',
  },
  modalBottomActions: {
    marginTop: 16,
    gap: 10,
  },
  modalPrimaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#800E20',
    borderRadius: 14,
    paddingVertical: 13,
    shadowColor: '#800E20',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  modalPrimaryBtnText: {
    fontFamily: FontFamily.sansBold,
    fontSize: 13,
    color: '#FFFFFF',
  },
  modalSecondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FAF0F2',
    borderRadius: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#EEDCE1',
  },
  modalSecondaryBtnText: {
    fontFamily: FontFamily.sansBold,
    fontSize: 13,
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
});
