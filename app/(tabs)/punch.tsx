import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  RefreshControl, Dimensions, Platform, TextInput, Modal, FlatList,
} from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Colors } from '../../src/theme/colors';
import { FontFamily } from '../../src/theme/typography';
import {
  apiGetSales, apiGetDealers, apiGetActiveTracker, apiGetSettings,
  apiGetContractors, apiGetUsers,
} from '../../src/services/api';
import { getUser } from '../../src/services/auth';
import {
  currentMonthISO, normalizeDate, formatMonthYear,
  simulateContractorPunchDistribution, formatNumber
} from '../../src/utils/helpers';

import {
  getUserDistrict, getDealerDistrict, getSaleDistrict, getTrackerDistrict, getAvailableDistricts,
} from '../../src/utils/district';
import { User, Dealer } from '../../src/types';
import { Ionicons, MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import { format, parseISO } from 'date-fns';

const { width } = Dimensions.get('window');

const PRESET_BAG_RATES = [50, 80, 90, 100, 120];

export default function PunchScreen() {
  const [user, setUser] = useState<User | null>(null);
  const [activeDistrict, setActiveDistrict] = useState<string>('Jajpur');
  const [refreshing, setRefreshing] = useState(false);

  // Month selection (defaults to current month)
  const [selectedMonth, setSelectedMonth] = useState<string>(() => currentMonthISO());
  const [showMonthModal, setShowMonthModal] = useState<boolean>(false);

  // Per-TE selection for Contractor Active Tracker box (defaults to logged-in TE)
  const [selectedTE, setSelectedTE] = useState<string>('');
  const [showTeModal, setShowTeModal] = useState<boolean>(false);

  // Simulator controls
  const [selectedBagRate, setSelectedBagRate] = useState<number>(100);
  const [customBagRateInput, setCustomBagRateInput] = useState<string>('');
  const [isCustomMode, setIsCustomMode] = useState<boolean>(false);

  // Dealer search filter
  const [dealerSearch, setDealerSearch] = useState<string>('');

  useEffect(() => {
    getUser().then(u => {
      setUser(u);
      if (u) {
        if (!selectedTE) {
          setSelectedTE(u.name);
        }
        const userDist = getUserDistrict(u);
        setActiveDistrict(userDist);
      }
    });
  }, []);

  const { data: settings } = useQuery({ queryKey: ['settings'], queryFn: apiGetSettings });
  const { data: usersList, refetch: refetchUsers } = useQuery({ queryKey: ['users'], queryFn: () => apiGetUsers() });
  const { data: allSales, refetch: refetchSales } = useQuery({ queryKey: ['sales'], queryFn: () => apiGetSales() });
  const { data: dealers, refetch: refetchDealers } = useQuery({ queryKey: ['dealers'], queryFn: () => apiGetDealers() });
  const { data: contractors, refetch: refetchContractors } = useQuery({ queryKey: ['contractors'], queryFn: () => apiGetContractors() });
  const { data: activeTrackers, refetch: refetchTrackers } = useQuery({ queryKey: ['activeTrackers'], queryFn: () => apiGetActiveTracker() });

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

  // SCOPED DEALERS:
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

  // SCOPED SALES:
  const scopedAllSales = useMemo(() => {
    const list = allSales || [];
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

  // SCOPED ACTIVE TRACKERS:
  const scopedActiveTrackers = useMemo(() => {
    const list = (activeTrackers || []).filter(Boolean);
    if (user?.role === 'TE') {
      const cleanName = (user.name || '').trim().toLowerCase();
      return list.filter(t => (t.te || '').trim().toLowerCase() === cleanName);
    }
    if (!activeDistrict || activeDistrict === 'ALL') return list;
    return list.filter(t => getTrackerDistrict(t, usersList).toLowerCase() === activeDistrict.toLowerCase());
  }, [activeTrackers, user, activeDistrict, usersList]);

  // Compute available months from sales and trackers
  const availableMonths = useMemo(() => {
    const set = new Set<string>();
    set.add(currentMonthISO());
    scopedAllSales.forEach(s => {
      if (!s || !s.sale_date) return;
      const m = normalizeDate(s.sale_date).substring(0, 7);
      if (m && m.length === 7) set.add(m);
    });
    scopedActiveTrackers.forEach(t => {
      if (!t) return;
      const mStr = normalizeDate(t.month || t.date).substring(0, 7);
      if (mStr && mStr.length === 7) set.add(mStr);
    });
    return Array.from(set).sort().reverse();
  }, [scopedAllSales, scopedActiveTrackers]);

  // Formatted Month Header string (e.g., "October 2026")
  const formattedSelectedMonth = useMemo(() => {
    try {
      return format(parseISO(selectedMonth + '-01'), 'MMMM yyyy');
    } catch {
      return selectedMonth;
    }
  }, [selectedMonth]);

  // Month navigation
  const switchMonth = (direction: 'prev' | 'next') => {
    const idx = availableMonths.indexOf(selectedMonth);
    if (idx === -1) return;
    if (direction === 'prev' && idx < availableMonths.length - 1) {
      setSelectedMonth(availableMonths[idx + 1]);
    } else if (direction === 'next' && idx > 0) {
      setSelectedMonth(availableMonths[idx - 1]);
    }
  };

  // Build unique team list for TE selection
  const teList = useMemo(() => {
    const set = new Set<string>();
    if (user?.name && user.name.trim()) set.add(user.name.trim());
    (usersList || []).forEach(u => {
      if (u.name && u.name.trim()) {
        if (user?.role === 'TE') {
          if (getUserDistrict(u).toLowerCase() === getUserDistrict(user).toLowerCase()) {
            set.add(u.name.trim());
          }
        } else if (!activeDistrict || activeDistrict === 'ALL' || getUserDistrict(u).toLowerCase() === activeDistrict.toLowerCase()) {
          set.add(u.name.trim());
        }
      }
    });
    return Array.from(set).filter(Boolean);
  }, [user, usersList, activeDistrict]);

  const effectiveTE = selectedTE || user?.name || (teList[0] || 'My Target');

  // ── 1. MONTHLY SALES (Shared across team in this district) ──
  const monthSales = useMemo(() => {
    return scopedAllSales.filter(s => normalizeDate(s.sale_date).startsWith(selectedMonth));
  }, [scopedAllSales, selectedMonth]);

  const totalSalesBags = monthSales.reduce((sum, s) => sum + (Number(s.quantity_bags) || 0), 0);
  const totalSalesMT = (totalSalesBags / 20).toFixed(2);
  const f2rBags = monthSales.filter(s => String(s.product).includes('F2R')).reduce((sum, s) => sum + (Number(s.quantity_bags) || 0), 0);
  const goldBags = monthSales.filter(s => String(s.product).includes('GOLD')).reduce((sum, s) => sum + (Number(s.quantity_bags) || 0), 0);
  const f2rMT = (f2rBags / 20).toFixed(2);
  const goldMT = (goldBags / 20).toFixed(2);

  // ── 2. TEAM 80% PUNCH TARGET (SHARED FOR ALL TEs in this district) ──
  // Month trackers for all TEs combined
  const allMonthTrackers = useMemo(() => {
    return scopedActiveTrackers.filter(t => normalizeDate(t.month || t.date).startsWith(selectedMonth));
  }, [scopedActiveTrackers, selectedMonth]);

  const totalTeamPunchedBags = allMonthTrackers.reduce((sum, t) => sum + (Number(t.punched_quantity_bags) || 0), 0);
  const target80Bags = Math.ceil(totalSalesBags * 0.8);
  const punchPercent = totalSalesBags > 0 ? (totalTeamPunchedBags / totalSalesBags) * 100 : 0;

  // Remaining bags to reach the 80% volume target
  const remainingTo80Target = Math.max(0, target80Bags - totalTeamPunchedBags);
  // Remaining total sales left unpunched (user's example: 100 sale - 20 punch = 80 remain; 10 more punch = 70 remain)
  const remainingSalesBags = Math.max(0, totalSalesBags - totalTeamPunchedBags);

  // Product-wise punch tracking (ACC F2R vs ACC GOLD)
  const totalF2RPunchedBags = allMonthTrackers.reduce((sum, t) => sum + (Number(t.f2r_punch_bags) || 0), 0);
  const totalGoldPunchedBags = allMonthTrackers.reduce((sum, t) => sum + (Number(t.gold_punch_bags) || 0), 0);

  // Fallback: If both f2r and gold punch are 0 but totalTeamPunchedBags > 0 (historical data), split by sales ratio
  const hasProductPunchData = totalF2RPunchedBags > 0 || totalGoldPunchedBags > 0;
  const f2rRatio = totalSalesBags > 0 ? (f2rBags / totalSalesBags) : 0.5;
  const effectiveF2RPunched = hasProductPunchData
    ? totalF2RPunchedBags
    : (totalSalesBags > 0 ? Math.round(totalTeamPunchedBags * f2rRatio) : 0);
  const effectiveGoldPunched = hasProductPunchData
    ? totalGoldPunchedBags
    : (totalTeamPunchedBags - effectiveF2RPunched);

  const target80F2R = Math.ceil(f2rBags * 0.8);
  const target80Gold = Math.ceil(goldBags * 0.8);

  const remainingF2R80 = Math.max(0, target80F2R - effectiveF2RPunched);
  const remainingGold80 = Math.max(0, target80Gold - effectiveGoldPunched);

  const remainingF2RSales = Math.max(0, f2rBags - effectiveF2RPunched);
  const remainingGoldSales = Math.max(0, goldBags - effectiveGoldPunched);

  const f2rPunchPct = target80F2R > 0 ? Math.min(100, Math.round((effectiveF2RPunched / target80F2R) * 100)) : 0;
  const goldPunchPct = target80Gold > 0 ? Math.min(100, Math.round((effectiveGoldPunched / target80Gold) * 100)) : 0;

  // ── 3. CONTRACTOR ACTIVE TRACKER (PER-TE / "ye sab ke alag alag hai bas ye wala box") ──
  const teTracker = useMemo(() => {
    const effLower = effectiveTE.toLowerCase().trim();
    return allMonthTrackers.find(t => String(t.te || '').toLowerCase().trim() === effLower);
  }, [allMonthTrackers, effectiveTE]);

  const teAssignedContractors = useMemo(() => {
    const effLower = effectiveTE.toLowerCase().trim();
    return (contractors || []).filter(c => String(c.assigned_te || '').toLowerCase().trim() === effLower);
  }, [contractors, effectiveTE]);

  // Total contractors for this TE: tracker total or count from contractors table
  const teTotalContractors = (teTracker && Number(teTracker.total_contractors) > 0)
    ? Number(teTracker.total_contractors)
    : (teAssignedContractors.length > 0 ? teAssignedContractors.length : 100);

  // Active contractors for this TE
  const teActiveContractors = (teTracker && Number(teTracker.active_contractors) > 0)
    ? Number(teTracker.active_contractors)
    : (teTracker && Number(teTracker.punched_quantity_bags) > 0 ? Math.ceil(Number(teTracker.punched_quantity_bags) / 100) : 0);

  const teActivePercent = teTotalContractors > 0
    ? Math.round((teActiveContractors / teTotalContractors) * 100)
    : 0;

  const teRequiredActive = Math.ceil(teTotalContractors * 0.4); // 40% company target
  const teContractorShortfall = Math.max(0, teRequiredActive - teActiveContractors);

  // ── 4. CONTRACTOR PUNCH SIMULATOR ──
  const effectiveBagRate = isCustomMode
    ? (Number(customBagRateInput) || 100)
    : selectedBagRate;

  const simulation = useMemo(() => {
    return simulateContractorPunchDistribution(
      totalSalesBags,
      teTotalContractors,
      effectiveBagRate
    );
  }, [totalSalesBags, teTotalContractors, effectiveBagRate]);

  // ── 5. DEALER SALES BREAKDOWN LIST WITH SAP CODE ──
  const dealerLookup = useMemo(() => {
    const map = new Map<string, Dealer>();
    scopedDealers.forEach(d => {
      if (d.dealer_id) map.set(d.dealer_id.toLowerCase().trim(), d);
      if (d.dealer_name) map.set(d.dealer_name.toLowerCase().trim(), d);
    });
    return map;
  }, [scopedDealers]);

  const dealerSalesList = useMemo(() => {
    const map: Record<string, {
      dealer_id: string;
      dealer_name: string;
      sap_code: string;
      area: string;
      assigned_te: string;
      total_bags: number;
      total_mt: number;
      f2r_bags: number;
      gold_bags: number;
    }> = {};

    monthSales.forEach(s => {
      const idKey = (s.dealer_id || '').toLowerCase().trim();
      const nameKey = (s.dealer_name || '').toLowerCase().trim();
      const key = idKey || nameKey;
      if (!key) return;

      if (!map[key]) {
        const dInfo = (idKey ? dealerLookup.get(idKey) : undefined) || (nameKey ? dealerLookup.get(nameKey) : undefined);
        map[key] = {
          dealer_id: s.dealer_id || dInfo?.dealer_id || key,
          dealer_name: s.dealer_name || dInfo?.dealer_name || 'Dealer Counter',
          sap_code: dInfo?.sap_code || '',
          area: dInfo?.area || (user?.role === 'TE' ? getUserDistrict(user) : activeDistrict),
          assigned_te: s.assigned_te || dInfo?.assigned_te || '',
          total_bags: 0,
          total_mt: 0,
          f2r_bags: 0,
          gold_bags: 0,
        };
      }

      const q = Number(s.quantity_bags) || 0;
      map[key].total_bags += q;
      map[key].total_mt = map[key].total_bags / 20;
      if (String(s.product).includes('F2R')) map[key].f2r_bags += q;
      if (String(s.product).includes('GOLD')) map[key].gold_bags += q;
    });

    return Object.values(map).sort((a, b) => b.total_bags - a.total_bags);
  }, [monthSales, dealerLookup, user, activeDistrict]);

  // Filtered dealers by search term (name, area, SAP code)
  const filteredDealers = useMemo(() => {
    if (!dealerSearch.trim()) return dealerSalesList;
    const q = dealerSearch.toLowerCase().trim();
    return dealerSalesList.filter(d =>
      (d.dealer_name || '').toLowerCase().includes(q) ||
      String(d.sap_code || '').toLowerCase().includes(q) ||
      (d.area || '').toLowerCase().includes(q) ||
      (d.assigned_te || '').toLowerCase().includes(q)
    );
  }, [dealerSalesList, dealerSearch]);

  return (
    <View style={styles.container}>
      {/* ── HEADER ── */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Contractor Punch</Text>
          <Text style={styles.headerSub}>
            District {user?.role === 'TE' ? getUserDistrict(user) : activeDistrict} • Team Performance & Allocation
          </Text>
        </View>

        {/* Month Selector Capsule */}
        <View style={styles.monthSelectorRow}>
          <TouchableOpacity onPress={() => switchMonth('prev')} style={styles.monthArrowBtn}>
            <Ionicons name="chevron-back" size={16} color="#800E20" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.monthPillCapsule}
            onPress={() => setShowMonthModal(true)}
            activeOpacity={0.8}
          >
            <Ionicons name="calendar-outline" size={13} color="#800E20" />
            <Text style={styles.monthPillCapsuleText}>{formattedSelectedMonth}</Text>
            <Ionicons name="chevron-down" size={12} color="#800E20" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => switchMonth('next')} style={styles.monthArrowBtn}>
            <Ionicons name="chevron-forward" size={16} color="#800E20" />
          </TouchableOpacity>
        </View>
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
        {/* ── 1. HERO CARD: TOTAL MONTH SALES + PRODUCT BREAKDOWN ── */}
        <View style={styles.heroCard}>
          <View style={styles.heroHeaderRow}>
            <View style={styles.heroTagBadge}>
              <MaterialCommunityIcons name="chart-bell-curve" size={14} color="#FFFFFF" />
              <Text style={styles.heroTagBadgeText}>TOTAL SALES · {formattedSelectedMonth.toUpperCase()}</Text>
            </View>
            <TouchableOpacity
              style={styles.quickAddPunchBtn}
              onPress={() => router.push('/punch/add')}
              activeOpacity={0.85}
            >
              <Ionicons name="flash" size={13} color="#800E20" />
              <Text style={styles.quickAddPunchBtnText}>Add Punch</Text>
            </TouchableOpacity>
          </View>

          {/* Big Number: MT and in brackets Bags */}
          <View style={styles.heroMainValueRow}>
            <Text style={styles.heroMainValueMT}>{totalSalesMT} <Text style={styles.heroMainUnit}>MT</Text></Text>
            <Text style={styles.heroMainValueBags}>({formatNumber(totalSalesBags)} Bags)</Text>
          </View>
          <Text style={styles.heroSubtext}>Total cement dispatch & billing recorded in Google Sheet</Text>

          <View style={styles.heroDivider} />

          {/* 2 Product Breakdown: ACC F2R and ACC GOLD in Bags */}
          <View style={styles.productsTwinRow}>
            {/* ACC F2R */}
            <View style={styles.productGlassCol}>
              <View style={styles.productHeaderRow}>
                <View style={[styles.productDot, { backgroundColor: '#EF4444' }]} />
                <Text style={styles.productTitle}>ACC F2R</Text>
              </View>
              <Text style={styles.productBagValue}>{formatNumber(f2rBags)} <Text style={styles.productBagUnit}>Bags</Text></Text>
              <Text style={styles.productMTValue}>{f2rMT} MT ({totalSalesBags > 0 ? Math.round((f2rBags / totalSalesBags) * 100) : 0}%)</Text>
            </View>

            <View style={styles.productDividerVert} />

            {/* ACC GOLD */}
            <View style={styles.productGlassCol}>
              <View style={styles.productHeaderRow}>
                <View style={[styles.productDot, { backgroundColor: '#F59E0B' }]} />
                <Text style={styles.productTitle}>ACC GOLD</Text>
              </View>
              <Text style={styles.productBagValue}>{formatNumber(goldBags)} <Text style={styles.productBagUnit}>Bags</Text></Text>
              <Text style={styles.productMTValue}>{goldMT} MT ({totalSalesBags > 0 ? Math.round((goldBags / totalSalesBags) * 100) : 0}%)</Text>
            </View>
          </View>
        </View>

        {/* ── 2. DUAL BOXES: TEAM 80% PUNCH & TE CONTRACTOR ACTIVE ── */}
        <View style={styles.dualBoxesContainer}>
          {/* BOX 1: TEAM 80% VOLUME TARGET (SHARED FOR ALL TEs / "ye sab ka same hoga") */}
          <View style={styles.twinTargetCard}>
            <View style={styles.cardTopBadgeRow}>
              <View style={styles.iconCircleDark}>
                <MaterialCommunityIcons name="cube-send" size={18} color="#800E20" />
              </View>
              <View style={styles.sharedPoolBadge}>
                <Text style={styles.sharedPoolBadgeText}>TEAM SHARED POOL</Text>
              </View>
            </View>

            <Text style={styles.cardTitle}>Team 80% Punch Target</Text>
            <Text style={styles.cardSub}>Common district pool for all TEs</Text>

            {/* Big Highlight: Remaining to Reach 80% / Remaining Sales to Punch */}
            <View style={styles.cardHighlightBox}>
              <Text style={styles.cardHighlightLabel}>REMAINING SALES TO PUNCH</Text>
              <Text style={styles.cardHighlightValue}>
                {formatNumber(remainingSalesBags)} <Text style={styles.cardHighlightUnit}>Bags</Text>
              </Text>
              <Text style={styles.cardHighlightSub}>
                {remainingTo80Target > 0 ? `Gap: ${formatNumber(remainingTo80Target)} bags to reach 80%` : '✅ 80% Volume Target Achieved!'}
              </Text>
            </View>

            {/* Progress Bar */}
            <View style={styles.progressBarTrack}>
              <View
                style={[
                  styles.progressBarFill,
                  {
                    width: `${Math.min(100, Math.round(punchPercent))}%`,
                    backgroundColor: punchPercent >= 80 ? '#15803D' : '#800E20',
                  },
                ]}
              />
            </View>

            {/* 3 Metrics Row */}
            <View style={styles.miniStatsRow}>
              <View style={styles.miniStatItem}>
                <Text style={styles.miniStatVal}>{formatNumber(totalSalesBags)}</Text>
                <Text style={styles.miniStatLbl}>Total Sale</Text>
              </View>
              <View style={styles.miniStatItem}>
                <Text style={styles.miniStatVal}>{formatNumber(target80Bags)}</Text>
                <Text style={styles.miniStatLbl}>80% Target</Text>
              </View>
              <View style={styles.miniStatItem}>
                <Text style={[styles.miniStatVal, { color: punchPercent >= 80 ? '#15803D' : '#800E20' }]}>
                  {formatNumber(totalTeamPunchedBags)}
                </Text>
                <Text style={styles.miniStatLbl}>Punched ({Math.round(punchPercent)}%)</Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.cardActionBtn}
              onPress={() => router.push('/punch/add')}
              activeOpacity={0.85}
            >
              <Ionicons name="flash-outline" size={14} color="#FFFFFF" style={{ marginRight: 4 }} />
              <Text style={styles.cardActionBtnText}>Record Punch in Sheet</Text>
            </TouchableOpacity>
          </View>

          {/* BOX 2: CONTRACTOR ACTIVE TRACKER (PER-TE / "ye sab ke alag alag hai bas ye wala box") */}
          <View style={styles.twinTargetCard}>
            <View style={styles.cardTopBadgeRow}>
              <View style={[styles.iconCircleDark, { backgroundColor: '#DCFCE7' }]}>
                <MaterialCommunityIcons name="account-hard-hat" size={18} color="#15803D" />
              </View>
              {/* TE Switcher Pill */}
              <TouchableOpacity
                style={styles.teSwitcherBtn}
                onPress={() => setShowTeModal(true)}
                activeOpacity={0.8}
              >
                <Feather name="user" size={11} color="#800E20" />
                <Text style={styles.teSwitcherBtnText}>
                  {effectiveTE === user?.name ? 'My Contractors' : effectiveTE}
                </Text>
                <Ionicons name="chevron-down" size={11} color="#800E20" />
              </TouchableOpacity>
            </View>

            <Text style={styles.cardTitle}>Contractor Active</Text>
            <Text style={styles.cardSub}>
              {effectiveTE === user?.name ? `${effectiveTE} (Me)` : effectiveTE}
            </Text>

            {/* Big Highlight: Active Contractors / Total */}
            <View style={[styles.cardHighlightBox, { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' }]}>
              <Text style={[styles.cardHighlightLabel, { color: '#166534' }]}>ACTIVE CONTRACTORS</Text>
              <Text style={[styles.cardHighlightValue, { color: '#15803D' }]}>
                {teActiveContractors} <Text style={{ fontSize: 18, color: '#6B7280', fontWeight: '600' }}>/ {teTotalContractors}</Text>
              </Text>
              <Text style={[styles.cardHighlightSub, { color: '#15803D' }]}>
                {teActivePercent}% Active (Company Min Target: 40%)
              </Text>
            </View>

            {/* Progress Bar */}
            <View style={styles.progressBarTrack}>
              <View
                style={[
                  styles.progressBarFill,
                  {
                    width: `${Math.min(100, teActivePercent)}%`,
                    backgroundColor: teActivePercent >= 40 ? '#15803D' : '#D97706',
                  },
                ]}
              />
            </View>

            {/* 3 Metrics Row */}
            <View style={styles.miniStatsRow}>
              <View style={styles.miniStatItem}>
                <Text style={styles.miniStatVal}>{teTotalContractors}</Text>
                <Text style={styles.miniStatLbl}>Assigned</Text>
              </View>
              <View style={styles.miniStatItem}>
                <Text style={[styles.miniStatVal, { color: '#15803D' }]}>{teActiveContractors}</Text>
                <Text style={styles.miniStatLbl}>Active ({teActivePercent}%)</Text>
              </View>
              <View style={styles.miniStatItem}>
                <Text style={[styles.miniStatVal, { color: teContractorShortfall > 0 ? '#D97706' : '#15803D' }]}>
                  {teContractorShortfall > 0 ? `${teContractorShortfall} Short` : 'Met ✓'}
                </Text>
                <Text style={styles.miniStatLbl}>40% Min Req</Text>
              </View>
            </View>

            {/* Synced with Home Page subtext */}
            <View style={styles.syncedHomeTag}>
              <Ionicons name="sync-outline" size={12} color="#15803D" />
              <Text style={styles.syncedHomeTagText}>Synced with Home Page Active % metric</Text>
            </View>
          </View>
        </View>

        {/* ── 3. CONTRACTOR PUNCH PLANNER & SIMULATOR ── */}
        <View style={styles.simulatorCard}>
          <View style={styles.simulatorHeader}>
            <View style={styles.simIconBox}>
              <MaterialCommunityIcons name="calculator-variant" size={22} color="#800E20" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.simTitle}>Contractor Punch Planner & Simulator</Text>
              <Text style={styles.simSub}>
                Calculate contractor distribution to achieve the 80% volume & 40% active target
              </Text>
            </View>
          </View>

          {/* Preset Buttons */}
          <View style={styles.presetSection}>
            <Text style={styles.presetLabel}>Select Bags Per Contractor:</Text>
            <View style={styles.presetButtonsRow}>
              {PRESET_BAG_RATES.map((rate) => {
                const isSelected = !isCustomMode && selectedBagRate === rate;
                return (
                  <TouchableOpacity
                    key={rate}
                    style={[styles.presetChip, isSelected && styles.presetChipActive]}
                    onPress={() => {
                      setIsCustomMode(false);
                      setSelectedBagRate(rate);
                    }}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.presetChipText, isSelected && styles.presetChipTextActive]}>
                      {rate} Bags
                    </Text>
                  </TouchableOpacity>
                );
              })}

              <TouchableOpacity
                style={[styles.presetChip, isCustomMode && styles.presetChipActive]}
                onPress={() => setIsCustomMode(true)}
                activeOpacity={0.8}
              >
                <Text style={[styles.presetChipText, isCustomMode && styles.presetChipTextActive]}>
                  Custom
                </Text>
              </TouchableOpacity>
            </View>

            {isCustomMode && (
              <View style={styles.customInputRow}>
                <Text style={styles.customInputLabel}>Enter Bags per Contractor:</Text>
                <TextInput
                  style={styles.customInput}
                  value={customBagRateInput}
                  onChangeText={setCustomBagRateInput}
                  placeholder="e.g. 75"
                  keyboardType="numeric"
                  placeholderTextColor="#A0858C"
                />
              </View>
            )}
          </View>

          {/* Live Simulator Calculation Box */}
          <View style={styles.simResultBox}>
            <View style={styles.simResultTop}>
              <View style={{ flex: 1 }}>
                <Text style={styles.simResultHeading}>
                  Simulation Result @ {simulation.bagRate} Bags/Contractor
                </Text>
                <Text style={styles.simResultSub}>
                  Total 80% Punch Target = <Text style={{ fontWeight: '800', color: '#800E20' }}>{formatNumber(simulation.punchTargetBags)} Bags</Text> ({totalSalesMT} MT Sales)
                </Text>
              </View>
              <View style={[
                styles.simStatusPill,
                simulation.isContractorTargetMet ? styles.simStatusPillSuccess : styles.simStatusPillWarn
              ]}>
                <Text style={[
                  styles.simStatusPillText,
                  simulation.isContractorTargetMet ? { color: '#15803D' } : { color: '#B45309' }
                ]}>
                  {simulation.isContractorTargetMet ? '✅ 40% Target MET' : `⚠️ ${simulation.contractorShortfall} Shortfall`}
                </Text>
              </View>
            </View>

            <View style={styles.simMetrics3Col}>
              <View style={styles.simMetricItem}>
                <Text style={styles.simMetricValue}>{simulation.activatedContractors}</Text>
                <Text style={styles.simMetricLabel}>Contractors Covered</Text>
              </View>

              <View style={styles.simMetricSeparator} />

              <View style={styles.simMetricItem}>
                <Text style={[
                  styles.simMetricValue,
                  { color: simulation.isContractorTargetMet ? '#15803D' : '#D97706' }
                ]}>
                  {simulation.activePercentAchieved}%
                </Text>
                <Text style={styles.simMetricLabel}>Active % Achieved</Text>
              </View>

              <View style={styles.simMetricSeparator} />

              <View style={styles.simMetricItem}>
                <Text style={styles.simMetricValue}>{simulation.minActiveContractorTarget}</Text>
                <Text style={styles.simMetricLabel}>40% Min Required</Text>
              </View>
            </View>

            {/* Distribution Breakdown Visual */}
            <View style={styles.distributionVisualBox}>
              <Text style={styles.distVisualTitle}>📋 Recommended Punch Allocation:</Text>

              {simulation.fullContractors > 0 ? (
                <View style={styles.distRow}>
                  <View style={styles.distBullet} />
                  <Text style={styles.distText}>
                    <Text style={{ fontWeight: '800', color: '#1F0B10' }}>{simulation.fullContractors} Contractors</Text> × {simulation.bagRate} Bags = <Text style={{ fontWeight: '800', color: '#800E20' }}>{formatNumber(simulation.fullContractors * simulation.bagRate)} Bags</Text>
                  </Text>
                </View>
              ) : null}

              {simulation.remainderBags > 0 ? (
                <View style={styles.distRow}>
                  <View style={[styles.distBullet, { backgroundColor: '#F59E0B' }]} />
                  <Text style={styles.distText}>
                    <Text style={{ fontWeight: '800', color: '#1F0B10' }}>1 Contractor</Text> × {simulation.remainderBags} Bags (Remainder Slot) = <Text style={{ fontWeight: '800', color: '#800E20' }}>{formatNumber(simulation.remainderBags)} Bags</Text>
                  </Text>
                </View>
              ) : null}

              <View style={styles.distTotalRow}>
                <Text style={styles.distTotalLabel}>Total Punch Target:</Text>
                <Text style={styles.distTotalVal}>{formatNumber(simulation.punchTargetBags)} Bags (80% of Sales)</Text>
              </View>
            </View>
          </View>
        </View>

        {/* ── 3.5. PRODUCT-WISE REMAINING BAGS TO PUNCH (F2R & GOLD) ── */}
        <View style={styles.productRemainingCard}>
          {/* Header */}
          <View style={styles.productRemainingHeader}>
            <View style={{ flex: 1 }}>
              <View style={styles.productRemainingBadge}>
                <MaterialCommunityIcons name="layers-triple" size={13} color="#800E20" />
                <Text style={styles.productRemainingBadgeText}>PRODUCT-WISE BALANCE</Text>
              </View>
              <Text style={styles.productRemainingTitle}>Remaining Bags to Punch</Text>
              <Text style={styles.productRemainingSub}>
                Bags needed to reach 80% volume target for ACC F2R & ACC GOLD
              </Text>
            </View>

            <TouchableOpacity
              style={styles.headerRecordPunchBtn}
              onPress={() => router.push('/punch/add')}
              activeOpacity={0.85}
            >
              <Ionicons name="flash" size={13} color="#FFFFFF" style={{ marginRight: 3 }} />
              <Text style={styles.headerRecordPunchBtnText}>Punch</Text>
            </TouchableOpacity>
          </View>

          {/* Twin Product Cards */}
          <View style={styles.productTwinCardsRow}>
            {/* 1. ACC F2R Card */}
            <View style={[styles.productBalanceBox, styles.productBalanceBoxF2R]}>
              <View style={styles.productBalanceTopRow}>
                <View style={styles.productPillRed}>
                  <View style={[styles.miniDot, { backgroundColor: '#EF4444' }]} />
                  <Text style={styles.productPillRedText}>ACC F2R</Text>
                </View>
                <Text style={styles.productBalanceTargetText}>80% Target</Text>
              </View>

              <Text style={styles.productRemainingLabel}>REMAINING TO 80%</Text>
              <Text style={[styles.productRemainingBagsNum, { color: '#991B1B' }]}>
                {formatNumber(remainingF2R80)} <Text style={styles.productRemainingBagsUnit}>Bags</Text>
              </Text>
              <Text style={styles.productRemainingMT}>
                {(remainingF2R80 / 20).toFixed(2)} MT · {remainingF2R80 === 0 ? 'Target Met ✓' : `${Math.max(0, 80 - f2rPunchPct)}% gap to 80%`}
              </Text>

              {/* Progress bar */}
              <View style={styles.productProgressTrack}>
                <View
                  style={[
                    styles.productProgressFill,
                    {
                      width: `${f2rPunchPct}%`,
                      backgroundColor: f2rPunchPct >= 80 ? '#15803D' : '#EF4444',
                    },
                  ]}
                />
              </View>

              {/* Stats breakdown */}
              <View style={styles.productMiniStatsCol}>
                <View style={styles.productStatLine}>
                  <Text style={styles.productStatKey}>Month Sales:</Text>
                  <Text style={styles.productStatVal}>{formatNumber(f2rBags)} Bags ({f2rMT} MT)</Text>
                </View>
                <View style={styles.productStatLine}>
                  <Text style={styles.productStatKey}>80% Target:</Text>
                  <Text style={styles.productStatVal}>{formatNumber(target80F2R)} Bags</Text>
                </View>
                <View style={styles.productStatLine}>
                  <Text style={styles.productStatKey}>Punched So Far:</Text>
                  <Text style={[styles.productStatVal, { color: '#991B1B', fontWeight: '800' }]}>
                    {formatNumber(effectiveF2RPunched)} Bags ({f2rPunchPct}%)
                  </Text>
                </View>
                <View style={[styles.productStatLine, styles.productStatLineHighlight]}>
                  <Text style={styles.productStatKeyBold}>Unpunched Sales:</Text>
                  <Text style={styles.productStatValBold}>{formatNumber(remainingF2RSales)} Bags</Text>
                </View>
              </View>
            </View>

            {/* 2. ACC GOLD Card */}
            <View style={[styles.productBalanceBox, styles.productBalanceBoxGold]}>
              <View style={styles.productBalanceTopRow}>
                <View style={styles.productPillGold}>
                  <View style={[styles.miniDot, { backgroundColor: '#F59E0B' }]} />
                  <Text style={styles.productPillGoldText}>ACC GOLD</Text>
                </View>
                <Text style={styles.productBalanceTargetTextGold}>80% Target</Text>
              </View>

              <Text style={styles.productRemainingLabelGold}>REMAINING TO 80%</Text>
              <Text style={[styles.productRemainingBagsNum, { color: '#92400E' }]}>
                {formatNumber(remainingGold80)} <Text style={styles.productRemainingBagsUnit}>Bags</Text>
              </Text>
              <Text style={styles.productRemainingMTGold}>
                {(remainingGold80 / 20).toFixed(2)} MT · {remainingGold80 === 0 ? 'Target Met ✓' : `${Math.max(0, 80 - goldPunchPct)}% gap to 80%`}
              </Text>

              {/* Progress bar */}
              <View style={styles.productProgressTrackGold}>
                <View
                  style={[
                    styles.productProgressFill,
                    {
                      width: `${goldPunchPct}%`,
                      backgroundColor: goldPunchPct >= 80 ? '#15803D' : '#F59E0B',
                    },
                  ]}
                />
              </View>

              {/* Stats breakdown */}
              <View style={styles.productMiniStatsCol}>
                <View style={styles.productStatLine}>
                  <Text style={styles.productStatKey}>Month Sales:</Text>
                  <Text style={styles.productStatVal}>{formatNumber(goldBags)} Bags ({goldMT} MT)</Text>
                </View>
                <View style={styles.productStatLine}>
                  <Text style={styles.productStatKey}>80% Target:</Text>
                  <Text style={styles.productStatVal}>{formatNumber(target80Gold)} Bags</Text>
                </View>
                <View style={styles.productStatLine}>
                  <Text style={styles.productStatKey}>Punched So Far:</Text>
                  <Text style={[styles.productStatVal, { color: '#92400E', fontWeight: '800' }]}>
                    {formatNumber(effectiveGoldPunched)} Bags ({goldPunchPct}%)
                  </Text>
                </View>
                <View style={[styles.productStatLine, styles.productStatLineHighlightGold]}>
                  <Text style={styles.productStatKeyBold}>Unpunched Sales:</Text>
                  <Text style={styles.productStatValBoldGold}>{formatNumber(remainingGoldSales)} Bags</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Bottom Action Strip */}
          <TouchableOpacity
            style={styles.productPunchActionBtn}
            onPress={() => router.push('/punch/add')}
            activeOpacity={0.85}
          >
            <Ionicons name="flash" size={15} color="#FFFFFF" style={{ marginRight: 6 }} />
            <Text style={styles.productPunchActionBtnText}>
              Record Punch (F2R: {formatNumber(remainingF2R80)} | Gold: {formatNumber(remainingGold80)} Remaining)
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── 4. DEALER SALES BREAKDOWN LIST WITH SAP CODE ── */}
        <View style={styles.dealerSectionContainer}>
          <View style={styles.sectionHeaderRow}>
            <View>
              <Text style={styles.sectionTitle}>Dealer Sales Breakdown</Text>
              <Text style={styles.sectionSubtitle}>
                Total sales & product split for {formattedSelectedMonth}
              </Text>
            </View>
            <View style={styles.dealerCountBadge}>
              <Text style={styles.dealerCountBadgeText}>
                {dealerSalesList.length} Active Counters
              </Text>
            </View>
          </View>

          {/* Search Bar (Dealer Name or SAP Code) */}
          <View style={styles.searchBarContainer}>
            <Ionicons name="search" size={18} color="#8A7277" style={{ marginRight: 8 }} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search dealer by name, area or SAP code..."
              placeholderTextColor="#A0858C"
              value={dealerSearch}
              onChangeText={setDealerSearch}
            />
            {dealerSearch.length > 0 && (
              <TouchableOpacity onPress={() => setDealerSearch('')}>
                <Ionicons name="close-circle" size={18} color="#8A7277" />
              </TouchableOpacity>
            )}
          </View>

          {/* Dealer Cards List */}
          {filteredDealers.length === 0 ? (
            <View style={styles.emptyDealerCard}>
              <MaterialCommunityIcons name="store-search-outline" size={40} color="#C9A3AA" />
              <Text style={styles.emptyDealerTitle}>No Dealer Sales Found</Text>
              <Text style={styles.emptyDealerSub}>
                {dealerSearch ? 'No counters match your search.' : `No dealer sales recorded for ${formattedSelectedMonth}.`}
              </Text>
            </View>
          ) : (
            filteredDealers.map((d, index) => {
              const maxBags = dealerSalesList[0]?.total_bags || 1;
              const fillPct = Math.min(100, (d.total_bags / maxBags) * 100);

              return (
                <TouchableOpacity
                  key={d.dealer_id || index}
                  style={styles.dealerCard}
                  onPress={() => router.push(`/dealer/${d.dealer_id}` as any)}
                  activeOpacity={0.8}
                >
                  {/* Top: Rank, Name, SAP Code badge */}
                  <View style={styles.dealerCardHeader}>
                    <View style={styles.dealerRankCircle}>
                      <Text style={styles.dealerRankText}>{index + 1}</Text>
                    </View>

                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text style={styles.dealerNameText} numberOfLines={1}>{d.dealer_name}</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                        <Ionicons name="location-outline" size={12} color="#8A7277" />
                        <Text style={styles.dealerAreaText}>{d.area || 'Jajpur Territory'}</Text>
                        {d.assigned_te ? (
                          <Text style={styles.dealerTeText}>· TE: {d.assigned_te}</Text>
                        ) : null}
                      </View>
                    </View>

                    {/* SAP Code Badge */}
                    <View style={styles.sapCodeBadge}>
                      <Text style={styles.sapCodeBadgeLabel}>SAP</Text>
                      <Text style={styles.sapCodeBadgeValue}>{d.sap_code ? d.sap_code : '—'}</Text>
                    </View>
                  </View>

                  {/* Middle: Total Volume & Product Split */}
                  <View style={styles.dealerVolumeRow}>
                    <View>
                      <Text style={styles.dealerTotalBags}>
                        {formatNumber(d.total_bags)} <Text style={styles.dealerTotalBagsUnit}>Bags</Text>
                      </Text>
                      <Text style={styles.dealerTotalMT}>{d.total_mt.toFixed(2)} MT Total</Text>
                    </View>

                    <View style={styles.dealerProductPillsRow}>
                      <View style={styles.dealerProductPillF2R}>
                        <View style={[styles.miniDot, { backgroundColor: '#EF4444' }]} />
                        <Text style={styles.dealerProductPillText}>F2R: {d.f2r_bags} Bags</Text>
                      </View>
                      <View style={styles.dealerProductPillGold}>
                        <View style={[styles.miniDot, { backgroundColor: '#F59E0B' }]} />
                        <Text style={styles.dealerProductPillText}>Gold: {d.gold_bags} Bags</Text>
                      </View>
                    </View>
                  </View>

                  {/* Volume Share Bar */}
                  <View style={styles.dealerShareTrack}>
                    <View style={[styles.dealerShareFill, { width: `${fillPct}%` }]} />
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </View>

        <View style={{ height: 80 }} />
      </ScrollView>

      {/* ── MONTH PICKER MODAL ── */}
      <Modal
        visible={showMonthModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowMonthModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowMonthModal(false)}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Month</Text>
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
                    style={[styles.modalOptionRow, isSelected && styles.modalOptionSelected]}
                    onPress={() => {
                      setSelectedMonth(item);
                      setShowMonthModal(false);
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <Ionicons
                        name={isSelected ? "radio-button-on" : "radio-button-off"}
                        size={18}
                        color={isSelected ? "#800E20" : "#A0858C"}
                      />
                      <Text style={[styles.modalOptionText, isSelected && styles.modalOptionTextSelected]}>
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

      {/* ── TE CONTRACTOR SELECTOR MODAL ── */}
      <Modal
        visible={showTeModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowTeModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowTeModal(false)}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select TE Contractor Pool</Text>
              <TouchableOpacity onPress={() => setShowTeModal(false)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={20} color="#1F0B10" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={teList}
              keyExtractor={(item) => item}
              renderItem={({ item }) => {
                const isSelected = effectiveTE === item;
                const isMe = item === user?.name;
                return (
                  <TouchableOpacity
                    style={[styles.modalOptionRow, isSelected && styles.modalOptionSelected]}
                    onPress={() => {
                      setSelectedTE(item);
                      setShowTeModal(false);
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <Ionicons
                        name={isSelected ? "radio-button-on" : "radio-button-off"}
                        size={18}
                        color={isSelected ? "#800E20" : "#A0858C"}
                      />
                      <Text style={[styles.modalOptionText, isSelected && styles.modalOptionTextSelected]}>
                        {item} {isMe ? '(My Contractors)' : ''}
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
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 56 : 38,
    paddingBottom: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F0E2E5',
  },
  headerTitle: {
    fontFamily: FontFamily.displayBlack,
    fontSize: 21,
    color: '#1F0B10',
    letterSpacing: -0.5,
  },
  headerSub: {
    fontFamily: FontFamily.sansMedium,
    fontSize: 11,
    color: '#8A7277',
    marginTop: 1,
  },
  monthSelectorRow: {
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
    paddingVertical: 6,
    borderRadius: 14,
    gap: 4,
    borderWidth: 1,
    borderColor: '#EEDCE1',
  },
  monthPillCapsuleText: {
    fontFamily: FontFamily.sansBold,
    fontSize: 11,
    color: '#800E20',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },

  // ── 1. HERO TOTAL MONTH SALES CARD ──
  heroCard: {
    backgroundColor: '#4A0611',
    borderRadius: 24,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#4A0611',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  heroHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  heroTagBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
  },
  heroTagBadgeText: {
    fontFamily: FontFamily.sansBold,
    fontSize: 10,
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  quickAddPunchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    gap: 3,
  },
  quickAddPunchBtnText: {
    fontFamily: FontFamily.sansBold,
    fontSize: 11,
    color: '#800E20',
  },
  heroMainValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    marginTop: 6,
  },
  heroMainValueMT: {
    fontFamily: FontFamily.displayBlack,
    fontSize: 34,
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  heroMainUnit: {
    fontFamily: FontFamily.displayBold,
    fontSize: 20,
    color: '#FCA5A5',
  },
  heroMainValueBags: {
    fontFamily: FontFamily.sansBold,
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.85)',
  },
  heroSubtext: {
    fontFamily: FontFamily.sansRegular,
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.75)',
    marginTop: 2,
  },
  heroDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    marginVertical: 14,
  },
  productsTwinRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  productGlassCol: {
    flex: 1,
  },
  productHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  productDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  productTitle: {
    fontFamily: FontFamily.sansBold,
    fontSize: 12,
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  productBagValue: {
    fontFamily: FontFamily.displayBold,
    fontSize: 18,
    color: '#FFFFFF',
  },
  productBagUnit: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
  },
  productMTValue: {
    fontFamily: FontFamily.sansRegular,
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.75)',
    marginTop: 1,
  },
  productDividerVert: {
    width: 1,
    height: 44,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    marginHorizontal: 12,
  },

  // ── 2. DUAL BOXES (TEAM 80% & CONTRACTOR ACTIVE) ──
  dualBoxesContainer: {
    gap: 14,
    marginBottom: 16,
  },
  twinTargetCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#EEDCE1',
    shadowColor: 'rgba(78, 5, 17, 0.05)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 10,
    elevation: 3,
  },
  cardTopBadgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  iconCircleDark: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FBE8EC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sharedPoolBadge: {
    backgroundColor: '#FAF0F2',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#F8B4BD',
  },
  sharedPoolBadgeText: {
    fontFamily: FontFamily.sansBold,
    fontSize: 10,
    color: '#800E20',
    letterSpacing: 0.5,
  },
  teSwitcherBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FAF0F2',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F8B4BD',
  },
  teSwitcherBtnText: {
    fontFamily: FontFamily.sansBold,
    fontSize: 11,
    color: '#800E20',
  },
  cardTitle: {
    fontFamily: FontFamily.displayBold,
    fontSize: 16,
    color: '#1F0B10',
  },
  cardSub: {
    fontFamily: FontFamily.sansRegular,
    fontSize: 11,
    color: '#8A7277',
    marginTop: 1,
    marginBottom: 10,
  },
  cardHighlightBox: {
    backgroundColor: '#FAF0F2',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#F8B4BD',
    marginBottom: 12,
  },
  cardHighlightLabel: {
    fontFamily: FontFamily.sansBold,
    fontSize: 10,
    color: '#800E20',
    letterSpacing: 0.5,
  },
  cardHighlightValue: {
    fontFamily: FontFamily.displayBlack,
    fontSize: 24,
    color: '#800E20',
    marginTop: 2,
  },
  cardHighlightUnit: {
    fontSize: 14,
    fontWeight: '700',
    color: '#8A7277',
  },
  cardHighlightSub: {
    fontFamily: FontFamily.sansMedium,
    fontSize: 11,
    color: '#6B4E55',
    marginTop: 2,
  },
  progressBarTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: '#F3E8EB',
    overflow: 'hidden',
    marginBottom: 12,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  miniStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#FBF8F9',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#F0E2E5',
  },
  miniStatItem: {
    flex: 1,
    alignItems: 'center',
  },
  miniStatVal: {
    fontFamily: FontFamily.displayBold,
    fontSize: 14,
    color: '#1F0B10',
  },
  miniStatLbl: {
    fontFamily: FontFamily.sansRegular,
    fontSize: 10,
    color: '#8A7277',
    marginTop: 2,
  },
  cardActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#800E20',
    paddingVertical: 10,
    borderRadius: 12,
    marginTop: 12,
    shadowColor: '#800E20',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  cardActionBtnText: {
    fontFamily: FontFamily.sansBold,
    fontSize: 12,
    color: '#FFFFFF',
  },
  syncedHomeTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 10,
    justifyContent: 'center',
  },
  syncedHomeTagText: {
    fontFamily: FontFamily.sansMedium,
    fontSize: 11,
    color: '#15803D',
  },

  // ── 3. SIMULATOR CARD ──
  simulatorCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: '#EEDCE1',
    shadowColor: 'rgba(78, 5, 17, 0.05)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 10,
    elevation: 3,
  },
  simulatorHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 14,
  },
  simIconBox: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: '#FBE8EC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  simTitle: {
    fontFamily: FontFamily.displayBold,
    fontSize: 15,
    color: '#1F0B10',
  },
  simSub: {
    fontFamily: FontFamily.sansRegular,
    fontSize: 11,
    color: '#8A7277',
    marginTop: 2,
  },
  presetSection: {
    marginBottom: 12,
  },
  presetLabel: {
    fontFamily: FontFamily.sansBold,
    fontSize: 12,
    color: '#1F0B10',
    marginBottom: 8,
  },
  presetButtonsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  presetChip: {
    backgroundColor: '#FAF0F2',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#EEDCE1',
  },
  presetChipActive: {
    backgroundColor: '#800E20',
    borderColor: '#800E20',
  },
  presetChipText: {
    fontFamily: FontFamily.sansBold,
    fontSize: 11,
    color: '#800E20',
  },
  presetChipTextActive: {
    color: '#FFFFFF',
  },
  customInputRow: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  customInputLabel: {
    fontFamily: FontFamily.sansMedium,
    fontSize: 12,
    color: '#6B4E55',
  },
  customInput: {
    width: 80,
    borderWidth: 1.5,
    borderColor: '#800E20',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontFamily: FontFamily.sansBold,
    fontSize: 13,
    color: '#800E20',
    backgroundColor: '#FFFFFF',
    textAlign: 'center',
  },
  simResultBox: {
    backgroundColor: '#FAF0F2',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#F8B4BD',
  },
  simResultTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  simResultHeading: {
    fontFamily: FontFamily.sansBold,
    fontSize: 13,
    color: '#1F0B10',
  },
  simResultSub: {
    fontFamily: FontFamily.sansRegular,
    fontSize: 11,
    color: '#6B4E55',
    marginTop: 2,
  },
  simStatusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  simStatusPillSuccess: {
    backgroundColor: '#DCFCE7',
  },
  simStatusPillWarn: {
    backgroundColor: '#FEF3C7',
  },
  simStatusPillText: {
    fontFamily: FontFamily.sansBold,
    fontSize: 10,
  },
  simMetrics3Col: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#EEDCE1',
  },
  simMetricItem: {
    flex: 1,
    alignItems: 'center',
  },
  simMetricValue: {
    fontFamily: FontFamily.displayBlack,
    fontSize: 16,
    color: '#1F0B10',
  },
  simMetricLabel: {
    fontFamily: FontFamily.sansRegular,
    fontSize: 10,
    color: '#8A7277',
    marginTop: 2,
    textAlign: 'center',
  },
  simMetricSeparator: {
    width: 1,
    height: '80%',
    backgroundColor: '#F0E2E5',
    alignSelf: 'center',
  },
  distributionVisualBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#EEDCE1',
  },
  distVisualTitle: {
    fontFamily: FontFamily.sansBold,
    fontSize: 11,
    color: '#1F0B10',
    marginBottom: 6,
  },
  distRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  distBullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#800E20',
    marginRight: 6,
  },
  distText: {
    fontFamily: FontFamily.sansRegular,
    fontSize: 11,
    color: '#4A3237',
  },
  distTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 6,
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: '#F0E2E5',
  },
  distTotalLabel: {
    fontFamily: FontFamily.sansBold,
    fontSize: 11,
    color: '#1F0B10',
  },
  distTotalVal: {
    fontFamily: FontFamily.sansBold,
    fontSize: 11,
    color: '#800E20',
  },

  // ── 3.5. PRODUCT-WISE REMAINING BAGS CARD ──
  productRemainingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: '#EEDCE1',
    shadowColor: 'rgba(78, 5, 17, 0.05)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 10,
    elevation: 3,
  },
  productRemainingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  productRemainingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FAF0F2',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginBottom: 4,
    borderWidth: 1,
    borderColor: '#F8B4BD',
  },
  productRemainingBadgeText: {
    fontFamily: FontFamily.sansBold,
    fontSize: 9,
    color: '#800E20',
    letterSpacing: 0.5,
  },
  productRemainingTitle: {
    fontFamily: FontFamily.displayBold,
    fontSize: 17,
    color: '#1F0B10',
  },
  productRemainingSub: {
    fontFamily: FontFamily.sansRegular,
    fontSize: 11,
    color: '#8A7277',
    marginTop: 2,
  },
  headerRecordPunchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#800E20',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  headerRecordPunchBtnText: {
    fontFamily: FontFamily.sansBold,
    fontSize: 11,
    color: '#FFFFFF',
  },
  productTwinCardsRow: {
    gap: 12,
  },
  productBalanceBox: {
    borderRadius: 16,
    padding: 14,
    borderWidth: 1.5,
  },
  productBalanceBoxF2R: {
    backgroundColor: '#FFF5F5',
    borderColor: '#FED7D7',
  },
  productBalanceBoxGold: {
    backgroundColor: '#FFFDF0',
    borderColor: '#FEEBC8',
  },
  productBalanceTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  productPillRed: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  productPillRedText: {
    fontFamily: FontFamily.sansBold,
    fontSize: 11,
    color: '#991B1B',
  },
  productPillGold: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  productPillGoldText: {
    fontFamily: FontFamily.sansBold,
    fontSize: 11,
    color: '#92400E',
  },
  productBalanceTargetText: {
    fontFamily: FontFamily.sansMedium,
    fontSize: 10,
    color: '#991B1B',
  },
  productBalanceTargetTextGold: {
    fontFamily: FontFamily.sansMedium,
    fontSize: 10,
    color: '#92400E',
  },
  productRemainingLabel: {
    fontFamily: FontFamily.sansBold,
    fontSize: 9,
    color: '#DC2626',
    letterSpacing: 0.5,
  },
  productRemainingLabelGold: {
    fontFamily: FontFamily.sansBold,
    fontSize: 9,
    color: '#D97706',
    letterSpacing: 0.5,
  },
  productRemainingBagsNum: {
    fontFamily: FontFamily.displayBlack,
    fontSize: 26,
    marginTop: 2,
    letterSpacing: -0.5,
  },
  productRemainingBagsUnit: {
    fontSize: 14,
    fontWeight: '700',
    color: '#6B7280',
  },
  productRemainingMT: {
    fontFamily: FontFamily.sansRegular,
    fontSize: 11,
    color: '#7F1D1D',
    marginTop: 1,
    marginBottom: 8,
  },
  productRemainingMTGold: {
    fontFamily: FontFamily.sansRegular,
    fontSize: 11,
    color: '#78350F',
    marginTop: 1,
    marginBottom: 8,
  },
  productProgressTrack: {
    height: 6,
    backgroundColor: '#FEE2E2',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 10,
  },
  productProgressTrackGold: {
    height: 6,
    backgroundColor: '#FEF3C7',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 10,
  },
  productProgressFill: {
    height: '100%',
    borderRadius: 3,
  },
  productMiniStatsCol: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
    gap: 4,
  },
  productStatLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 2,
  },
  productStatLineHighlight: {
    borderTopWidth: 1,
    borderTopColor: '#FEE2E2',
    paddingTop: 5,
    marginTop: 2,
  },
  productStatLineHighlightGold: {
    borderTopWidth: 1,
    borderTopColor: '#FEF3C7',
    paddingTop: 5,
    marginTop: 2,
  },
  productStatKey: {
    fontFamily: FontFamily.sansRegular,
    fontSize: 11,
    color: '#6B7280',
  },
  productStatVal: {
    fontFamily: FontFamily.sansBold,
    fontSize: 11,
    color: '#1F0B10',
  },
  productStatKeyBold: {
    fontFamily: FontFamily.sansBold,
    fontSize: 11,
    color: '#1F0B10',
  },
  productStatValBold: {
    fontFamily: FontFamily.displayBold,
    fontSize: 12,
    color: '#991B1B',
  },
  productStatValBoldGold: {
    fontFamily: FontFamily.displayBold,
    fontSize: 12,
    color: '#92400E',
  },
  productPunchActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#800E20',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginTop: 14,
    shadowColor: '#800E20',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  productPunchActionBtnText: {
    fontFamily: FontFamily.sansBold,
    fontSize: 12,
    color: '#FFFFFF',
  },

  // ── 4. DEALER SALES BREAKDOWN LIST ──
  dealerSectionContainer: {
    marginTop: 4,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 10,
  },
  sectionTitle: {
    fontFamily: FontFamily.displayBold,
    fontSize: 18,
    color: '#1F0B10',
  },
  sectionSubtitle: {
    fontFamily: FontFamily.sansRegular,
    fontSize: 11,
    color: '#8A7277',
    marginTop: 1,
  },
  dealerCountBadge: {
    backgroundColor: '#FAF0F2',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#F8B4BD',
  },
  dealerCountBadgeText: {
    fontFamily: FontFamily.sansBold,
    fontSize: 11,
    color: '#800E20',
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1.5,
    borderColor: '#EEDCE1',
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    fontFamily: FontFamily.sansRegular,
    fontSize: 13,
    color: '#1F0B10',
    padding: 0,
  },
  dealerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1.5,
    borderColor: '#EEDCE1',
    shadowColor: 'rgba(78, 5, 17, 0.04)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 2,
  },
  dealerCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  dealerRankCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FAF0F2',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#F8B4BD',
  },
  dealerRankText: {
    fontFamily: FontFamily.sansBold,
    fontSize: 12,
    color: '#800E20',
  },
  dealerNameText: {
    fontFamily: FontFamily.displayBold,
    fontSize: 15,
    color: '#1F0B10',
  },
  dealerAreaText: {
    fontFamily: FontFamily.sansRegular,
    fontSize: 11,
    color: '#8A7277',
  },
  dealerTeText: {
    fontFamily: FontFamily.sansMedium,
    fontSize: 11,
    color: '#800E20',
  },
  sapCodeBadge: {
    alignItems: 'flex-end',
    backgroundColor: '#FDE8EA',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#F8B4BD',
  },
  sapCodeBadgeLabel: {
    fontFamily: FontFamily.sansBold,
    fontSize: 8,
    color: '#800E20',
    letterSpacing: 0.5,
  },
  sapCodeBadgeValue: {
    fontFamily: FontFamily.displayBold,
    fontSize: 12,
    color: '#800E20',
  },
  dealerVolumeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  dealerTotalBags: {
    fontFamily: FontFamily.displayBlack,
    fontSize: 18,
    color: '#800E20',
  },
  dealerTotalBagsUnit: {
    fontSize: 12,
    fontWeight: '700',
    color: '#8A7277',
  },
  dealerTotalMT: {
    fontFamily: FontFamily.sansRegular,
    fontSize: 11,
    color: '#8A7277',
  },
  dealerProductPillsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  dealerProductPillF2R: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  dealerProductPillGold: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFBEB',
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  miniDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  dealerProductPillText: {
    fontFamily: FontFamily.sansBold,
    fontSize: 10,
    color: '#1F0B10',
  },
  dealerShareTrack: {
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#F3E8EB',
    overflow: 'hidden',
  },
  dealerShareFill: {
    height: '100%',
    borderRadius: 2.5,
    backgroundColor: '#800E20',
  },
  emptyDealerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#EEDCE1',
  },
  emptyDealerTitle: {
    fontFamily: FontFamily.displayBold,
    fontSize: 15,
    color: '#1F0B10',
    marginTop: 8,
  },
  emptyDealerSub: {
    fontFamily: FontFamily.sansRegular,
    fontSize: 12,
    color: '#8A7277',
    marginTop: 4,
    textAlign: 'center',
  },

  // ── MODAL STYLES ──
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    width: '100%',
    maxWidth: 360,
    borderRadius: 24,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    paddingBottom: 12,
  },
  modalTitle: {
    fontFamily: FontFamily.sansBold,
    fontSize: 16,
    color: '#1F0B10',
  },
  modalCloseBtn: {
    padding: 4,
  },
  modalOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 6,
  },
  modalOptionSelected: {
    backgroundColor: '#FDE8EA',
  },
  modalOptionText: {
    fontFamily: FontFamily.sansMedium,
    fontSize: 14,
    color: '#1F0B10',
  },
  modalOptionTextSelected: {
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
});
