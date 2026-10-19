import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  RefreshControl, Dimensions, Platform, Image, Modal, FlatList, Animated, ActivityIndicator,
  TextInput, KeyboardAvoidingView,
} from 'react-native';
import { router, Link } from 'expo-router';
import FloatingActionMenu from '../../components/FloatingActionMenu';
import { useQuery } from '@tanstack/react-query';
import Toast from 'react-native-toast-message';
import {
  apiGetSettings, apiGetSales, apiGetDealers, apiGetActiveTracker, 
  apiGetContractors, apiGetUsers, apiGetSlabs, apiGetMeetings,
  apiUpdateSlab, apiUpdateMeeting
} from '../../src/services/api';
import { getUser, syncUserFromLiveList } from '../../src/services/auth';
import {
  getGreeting, normalizeDate, currentMonthISO, formatDateShort, formatMonthYear, formatNumber
} from '../../src/utils/helpers';

import {
  getUserDistrict, getDealerDistrict, getSlabDistrict, getSaleDistrict,
  getMeetingDistrict, getTrackerDistrict, getAvailableDistricts, normalizeDistrictName
} from '../../src/utils/district';
import { User, DealerSalesSummary, Slab, Meeting } from '../../src/types';
import { FontFamily } from '../../src/theme/typography';
import { Ionicons, MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import { format, parseISO } from 'date-fns';
import { Colors } from '../../src/theme/colors';
import { getUnreadNotificationsCount, checkAndNotifyNewSlabs, checkAndNotifyNewMeetings } from '../../src/services/notifications';

const { width } = Dimensions.get('window');

export default function HomeScreen() {
  const [user, setUser] = useState<User | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const today = normalizeDate(new Date());
  
  // Interactive month selection (defaults to current month)
  const [selectedMonth, setSelectedMonth] = useState<string>(() => currentMonthISO());
  const [showMonthModal, setShowMonthModal] = useState(false);

  // District Filter State (defaults to user's district; if Admin, can toggle)
  const [activeDistrict, setActiveDistrict] = useState<string>('Jajpur');
  const [showDistrictModal, setShowDistrictModal] = useState<boolean>(false);

  // Target TE Selection State (defaults to logged-in user)
  const [targetTE, setTargetTE] = useState<string>('');
  const [showTargetTeModal, setShowTargetTeModal] = useState<boolean>(false);

  // Meeting Attendance & Target Credit Modal State
  const [meetingToAttend, setMeetingToAttend] = useState<Meeting | null>(null);
  const [attendCreditTE, setAttendCreditTE] = useState<string>('');
  const [attendPeopleCount, setAttendPeopleCount] = useState<string>('');
  const [attendExpense, setAttendExpense] = useState<string>('');
  const [attendOutcome, setAttendOutcome] = useState<string>('');
  const [isSubmittingAttendance, setIsSubmittingAttendance] = useState<boolean>(false);

  // Scroll animation for FAB
  const scrollY = useRef(new Animated.Value(0)).current;

  // Unread notifications state
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);

  useEffect(() => {
    getUser().then(u => {
      setUser(u);
      if (u) {
        if (!targetTE) {
          setTargetTE(u.name);
        }
        const userDist = getUserDistrict(u);
        setActiveDistrict(userDist);
      }
    });
    getUnreadNotificationsCount().then(setUnreadNotifCount);
  }, []);

  const firstName = useMemo(() => {
    if (!user?.name) return 'Rehan';
    return user.name.trim().split(' ')[0];
  }, [user]);


  const { data: settings } = useQuery({ queryKey: ['settings'], queryFn: () => apiGetSettings() });
  const { data: usersList, refetch: refetchUsers } = useQuery({ queryKey: ['users'], queryFn: () => apiGetUsers() });

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
  const { data: allSales, refetch: refetchSales } = useQuery({ queryKey: ['sales'], queryFn: () => apiGetSales() });
  const { data: dealers, refetch: refetchDealers } = useQuery({ queryKey: ['dealers'], queryFn: () => apiGetDealers() });
  const { data: contractors, refetch: refetchContractors } = useQuery({ queryKey: ['contractors'], queryFn: () => apiGetContractors() });
  const { data: activeTrackers, refetch: refetchActive } = useQuery({ queryKey: ['activeTrackers'], queryFn: () => apiGetActiveTracker() });
  const { data: allSlabs, refetch: refetchSlabs } = useQuery({ 
    queryKey: ['slabs'], 
    queryFn: () => apiGetSlabs(),
    refetchInterval: 12000, // Poll every 12s in background while app is active
    refetchIntervalInBackground: false,
  });

  const { data: allMeetings, refetch: refetchMeetings } = useQuery({ 
    queryKey: ['meetings'], 
    queryFn: () => apiGetMeetings(),
    refetchInterval: 12000, // Poll every 12s in background so all phones get instant updates
    refetchIntervalInBackground: false,
  });

  useEffect(() => {
    if (allSlabs && allSlabs.length > 0) {
      try {
        checkAndNotifyNewSlabs(allSlabs, user).then(() => {
          getUnreadNotificationsCount().then(setUnreadNotifCount).catch(() => {});
        }).catch(() => {});
      } catch {}
    }
  }, [allSlabs, user]);

  useEffect(() => {
    if (allMeetings && allMeetings.length > 0) {
      try {
        checkAndNotifyNewMeetings(allMeetings, user).then(() => {
          getUnreadNotificationsCount().then(setUnreadNotifCount).catch(() => {});
        }).catch(() => {});
      } catch {}
    }
  }, [allMeetings, user]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      refetchUsers(), refetchSales(), refetchDealers(), refetchContractors(),
      refetchActive(), refetchSlabs(), refetchMeetings()
    ]);
    setRefreshing(false);
  }, [refetchUsers, refetchSales, refetchDealers, refetchContractors, refetchActive, refetchSlabs, refetchMeetings]);

  const territorySetting = settings?.find(s => s.setting === 'territory')?.value || user?.territory || 'Jajpur';

  // Compute available months from all data to populate month selector
  const availableMonths = useMemo(() => {
    const set = new Set<string>();
    set.add(currentMonthISO());
    (allSales || []).forEach(s => {
      if (!s || !s.sale_date) return;
      const m = normalizeDate(s.sale_date).substring(0, 7);
      if (m && m.length === 7) set.add(m);
    });
    (allSlabs || []).forEach(s => {
      if (!s || !s.slab_date) return;
      const m = normalizeDate(s.slab_date).substring(0, 7);
      if (m && m.length === 7) set.add(m);
    });
    (allMeetings || []).forEach(m => {
      if (!m || !m.meeting_date) return;
      const mStr = normalizeDate(m.meeting_date).substring(0, 7);
      if (mStr && mStr.length === 7) set.add(mStr);
    });
    (activeTrackers || []).forEach(t => {
      if (!t) return;
      const mStr = normalizeDate(t.month || t.date).substring(0, 7);
      if (mStr && mStr.length === 7) set.add(mStr);
    });
    return Array.from(set).sort().reverse();
  }, [allSales, allSlabs, allMeetings, activeTrackers]);

  const availableDistricts = useMemo(() => {
    return getAvailableDistricts(usersList, dealers);
  }, [usersList, dealers]);

  // SCOPED DEALERS FILTERED BY DISTRICT AND USER ROLE:
  const scopedDealers = useMemo(() => {
    const list = (dealers || []).filter(d => d && d.dealer_id);
    if (!activeDistrict || activeDistrict === 'ALL') return list;
    return list.filter(d => {
      const dDist = getDealerDistrict(d, usersList);
      if (user?.role === 'TE') {
        const cleanName = (user.name || '').trim().toLowerCase();
        const isTeMatch = d.assigned_te && d.assigned_te.trim().toLowerCase() === cleanName;
        return isTeMatch || dDist.toLowerCase() === activeDistrict.toLowerCase();
      }
      return dDist.toLowerCase() === activeDistrict.toLowerCase();
    });
  }, [dealers, usersList, user, activeDistrict]);

  // MONTHLY DATA FILTERED BY selectedMonth AND DISTRICT
  const allSlabsList = useMemo(() => {
    const list = (allSlabs || []).filter(s => s && s.slab_date && normalizeDate(s.slab_date).startsWith(selectedMonth));
    if (!activeDistrict || activeDistrict === 'ALL') return list;
    return list.filter(s => {
      const sDist = getSlabDistrict(s, dealers, usersList);
      if (user?.role === 'TE') {
        const cleanName = (user.name || '').trim().toLowerCase();
        const isTeMatch = s.assigned_te && s.assigned_te.trim().toLowerCase() === cleanName;
        return isTeMatch || sDist.toLowerCase() === activeDistrict.toLowerCase();
      }
      return sDist.toLowerCase() === activeDistrict.toLowerCase();
    });
  }, [allSlabs, selectedMonth, dealers, usersList, user, activeDistrict]);

  const allMeetingsList = useMemo(() => {
    const list = (allMeetings || []).filter(m => m && m.meeting_date && normalizeDate(m.meeting_date).startsWith(selectedMonth));
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
  }, [allMeetings, selectedMonth, usersList, user, activeDistrict]);

  const allSalesList = useMemo(() => {
    const list = (allSales || []).filter(s => s && s.sale_date && normalizeDate(s.sale_date).startsWith(selectedMonth));
    if (!activeDistrict || activeDistrict === 'ALL') return list;
    return list.filter(s => {
      const sDist = getSaleDistrict(s, dealers, usersList);
      if (user?.role === 'TE') {
        const cleanName = (user.name || '').trim().toLowerCase();
        const isTeMatch = s.assigned_te && s.assigned_te.trim().toLowerCase() === cleanName;
        return isTeMatch || sDist.toLowerCase() === activeDistrict.toLowerCase();
      }
      return sDist.toLowerCase() === activeDistrict.toLowerCase();
    });
  }, [allSales, selectedMonth, dealers, usersList, user, activeDistrict]);

  const filteredActiveTrackers = useMemo(() => {
    const list = (activeTrackers || []).filter(Boolean);
    const thisMonthTrackers = list.filter(t => t && normalizeDate(t.month || t.date).startsWith(selectedMonth));
    if (user?.role === 'TE') {
      const cleanName = (user.name || '').trim().toLowerCase();
      return thisMonthTrackers.filter(t => (t.te || '').trim().toLowerCase() === cleanName);
    }
    if (targetTE && targetTE !== 'ALL') {
      const teFiltered = thisMonthTrackers.filter(t => String(t.te || '').toLowerCase() === targetTE.trim().toLowerCase());
      if (teFiltered.length > 0) return teFiltered;
    }
    if (!activeDistrict || activeDistrict === 'ALL') return thisMonthTrackers;
    return thisMonthTrackers.filter(t => getTrackerDistrict(t, usersList).toLowerCase() === activeDistrict.toLowerCase());
  }, [activeTrackers, user, targetTE, selectedMonth, activeDistrict, usersList]);

  // Totals for Monthly Performance
  const totalSalesBags = allSalesList.reduce((sum, s) => sum + (Number(s.quantity_bags) || 0), 0);
  const totalSalesMT = (totalSalesBags / 20).toFixed(1);
  const totalPunchBags = filteredActiveTrackers.reduce((sum, t) => sum + (Number(t.punched_quantity_bags) || 0), 0);
  
  const sheetTotalContractors = filteredActiveTrackers.reduce((max, t) => Math.max(max, Number(t.total_contractors) || 0), 0);
  const totalContractorsCount = sheetTotalContractors > 0 ? sheetTotalContractors : Math.max((contractors || []).length, 10);
  
  const sheetActiveContractors = filteredActiveTrackers.reduce((sum, t) => sum + (Number(t.active_contractors) || 0), 0);
  const activeContractorsCount = sheetActiveContractors > 0 ? sheetActiveContractors : (totalPunchBags > 0 ? Math.ceil(totalPunchBags / 100) : 0);
  const activePercent = totalContractorsCount > 0 ? (activeContractorsCount / totalContractorsCount) * 100 : 0;

  const monthCompletedSlabs = allSlabsList.filter(s => s.status === 'COMPLETED').length;
  const monthCompletedMeetings = allMeetingsList.filter(m => m.status === 'COMPLETED').length;

  // Active TE list for meeting target & attendance assignment
  const teList = useMemo(() => {
    const set = new Set<string>();
    if (user?.name && user.name.trim()) set.add(user.name.trim());
    (usersList || []).forEach(u => {
      if (u.name && u.name.trim()) {
        if (user?.role === 'TE') {
          if (getUserDistrict(u).toLowerCase() === getUserDistrict(user).toLowerCase()) {
            set.add(u.name.trim());
          }
        } else if (activeDistrict && activeDistrict !== 'ALL') {
          if (getUserDistrict(u).toLowerCase() === activeDistrict.toLowerCase()) {
            set.add(u.name.trim());
          }
        } else {
          set.add(u.name.trim());
        }
      }
    });
    return Array.from(set).filter(Boolean);
  }, [usersList, user, activeDistrict]);

  const effectiveTargetTE = targetTE || user?.name || (teList[0] || '');

  // Target meetings filtered by selected TE
  const targetedMeetings = useMemo(() => {
    if (effectiveTargetTE === 'ALL') return allMeetingsList;
    return allMeetingsList.filter(m => 
      String(m.te || '').toLowerCase() === effectiveTargetTE.toLowerCase()
    );
  }, [allMeetingsList, effectiveTargetTE]);

  const contractorPeopleCount = targetedMeetings
    .filter(m => m.meeting_type === 'CONTRACTOR' && m.status === 'COMPLETED')
    .reduce((sum, m) => sum + (Number(m.people_count) || 0), 0);
    
  const ihbPeopleCount = targetedMeetings
    .filter(m => m.meeting_type === 'CUSTOMER' && m.status === 'COMPLETED')
    .reduce((sum, m) => sum + (Number(m.people_count) || 0), 0);

  // UPCOMING vs RECENT SLABS (SCOPED BY DISTRICT / TE)
  const upcomingSlabsList = useMemo(() => {
    const list = (allSlabs || []).filter(s => s && s.slab_date);
    const scoped = list.filter(s => {
      if (user?.role === 'TE') {
        const userDist = getUserDistrict(user);
        const cleanName = (user.name || '').trim().toLowerCase();
        const sDist = getSlabDistrict(s, dealers, usersList);
        const isTeMatch = s.assigned_te && s.assigned_te.trim().toLowerCase() === cleanName;
        return isTeMatch || sDist.toLowerCase() === userDist.toLowerCase();
      }
      if (!activeDistrict || activeDistrict === 'ALL') return true;
      return getSlabDistrict(s, dealers, usersList).toLowerCase() === activeDistrict.toLowerCase();
    });
    const upcoming = scoped.filter(s => s.status === 'UPCOMING' || normalizeDate(s.slab_date) >= today);
    return upcoming.sort((a, b) => normalizeDate(a.slab_date).localeCompare(normalizeDate(b.slab_date)));
  }, [allSlabs, today, user, activeDistrict, dealers, usersList]);

  // Display upcoming slabs if available; otherwise show recent slabs from the sheet
  const displaySlabs = useMemo(() => {
    if (upcomingSlabsList.length > 0) return upcomingSlabsList.slice(0, 3);
    const list = (allSlabs || []).filter(s => s && s.slab_date);
    const scoped = list.filter(s => {
      if (user?.role === 'TE') {
        const userDist = getUserDistrict(user);
        const cleanName = (user.name || '').trim().toLowerCase();
        const sDist = getSlabDistrict(s, dealers, usersList);
        const isTeMatch = s.assigned_te && s.assigned_te.trim().toLowerCase() === cleanName;
        return isTeMatch || sDist.toLowerCase() === userDist.toLowerCase();
      }
      if (!activeDistrict || activeDistrict === 'ALL') return true;
      return getSlabDistrict(s, dealers, usersList).toLowerCase() === activeDistrict.toLowerCase();
    });
    return scoped.slice(-3).reverse();
  }, [upcomingSlabsList, allSlabs, user, activeDistrict, dealers, usersList]);

  // UPCOMING vs RECENT EVENTS (SCOPED BY DISTRICT / TE)
  const upcomingMeetingsList = useMemo(() => {
    const list = (allMeetings || []).filter(m => m && m.meeting_date);
    const scoped = list.filter(m => {
      if (user?.role === 'TE') {
        const userDist = getUserDistrict(user);
        const cleanName = (user.name || '').trim().toLowerCase();
        const mDist = getMeetingDistrict(m, usersList);
        const isTeMatch = m.te && m.te.trim().toLowerCase() === cleanName;
        return isTeMatch || mDist.toLowerCase() === userDist.toLowerCase();
      }
      if (!activeDistrict || activeDistrict === 'ALL') return true;
      return getMeetingDistrict(m, usersList).toLowerCase() === activeDistrict.toLowerCase();
    });
    const upcoming = scoped.filter(m => m.status === 'PLANNED' || normalizeDate(m.meeting_date) >= today);
    return upcoming.sort((a, b) => normalizeDate(a.meeting_date).localeCompare(normalizeDate(b.meeting_date)));
  }, [allMeetings, today, user, activeDistrict, usersList]);

  // Display upcoming meetings if available; otherwise show recent meetings from sheet
  const displayMeetings = useMemo(() => {
    if (upcomingMeetingsList.length > 0) return upcomingMeetingsList.slice(0, 3);
    const list = (allMeetings || []).filter(m => m && m.meeting_date);
    const scoped = list.filter(m => {
      if (user?.role === 'TE') {
        const userDist = getUserDistrict(user);
        const cleanName = (user.name || '').trim().toLowerCase();
        const mDist = getMeetingDistrict(m, usersList);
        const isTeMatch = m.te && m.te.trim().toLowerCase() === cleanName;
        return isTeMatch || mDist.toLowerCase() === userDist.toLowerCase();
      }
      if (!activeDistrict || activeDistrict === 'ALL') return true;
      return getMeetingDistrict(m, usersList).toLowerCase() === activeDistrict.toLowerCase();
    });
    return scoped.slice(-3).reverse();
  }, [upcomingMeetingsList, allMeetings, user, activeDistrict, usersList]);

  // ── TODAY'S PENDING TASKS (FOR ACTION REQUIRED REMINDER) ──
  const [updatingTaskId, setUpdatingTaskId] = useState<string | null>(null);

  // Slabs scheduled for today or past due that are still UPCOMING
  const pendingSlabs = useMemo(() => {
    return (allSlabs || []).filter(s => {
      if (!s || !s.slab_date) return false;
      if (user?.role === 'TE') {
        const userDist = getUserDistrict(user);
        const cleanName = (user.name || '').trim().toLowerCase();
        const sDist = getSlabDistrict(s, dealers, usersList);
        const isTeMatch = s.assigned_te && s.assigned_te.trim().toLowerCase() === cleanName;
        if (!isTeMatch && sDist.toLowerCase() !== userDist.toLowerCase()) return false;
      } else if (activeDistrict && activeDistrict !== 'ALL') {
        if (getSlabDistrict(s, dealers, usersList).toLowerCase() !== activeDistrict.toLowerCase()) return false;
      }
      const slabDate = normalizeDate(s.slab_date);
      return s.status === 'UPCOMING' && slabDate <= today;
    });
  }, [allSlabs, today, user, activeDistrict, dealers, usersList]);

  // Meetings scheduled for today or past due that are still PLANNED
  const pendingMeetings = useMemo(() => {
    return (allMeetings || []).filter(m => {
      if (!m || !m.meeting_date) return false;
      if (user?.role === 'TE') {
        const userDist = getUserDistrict(user);
        const cleanName = (user.name || '').trim().toLowerCase();
        const mDist = getMeetingDistrict(m, usersList);
        const isTeMatch = m.te && m.te.trim().toLowerCase() === cleanName;
        if (!isTeMatch && mDist.toLowerCase() !== userDist.toLowerCase()) return false;
      } else if (activeDistrict && activeDistrict !== 'ALL') {
        if (getMeetingDistrict(m, usersList).toLowerCase() !== activeDistrict.toLowerCase()) return false;
      }
      const mDate = normalizeDate(m.meeting_date);
      return m.status === 'PLANNED' && mDate <= today;
    });
  }, [allMeetings, today, user, activeDistrict, usersList]);

  const pendingTasksTotal = pendingSlabs.length + pendingMeetings.length;

  const markSlabAttended = async (slab: Slab) => {
    try {
      setUpdatingTaskId(slab.slab_id);
      await apiUpdateSlab(slab.slab_id, { status: 'COMPLETED', updated_by: user?.name || '' });
      await refetchSlabs();
      Toast.show({
        type: 'success',
        text1: 'Slab Completed! ✅',
        text2: `${slab.dealer_name} marked as COMPLETED. Alert cleared.`,
        position: 'top',
      });
    } catch (err: any) {
      Toast.show({ type: 'error', text1: 'Error', text2: err.message || 'Failed to update slab' });
    } finally {
      setUpdatingTaskId(null);
    }
  };

  const openAttendModal = (meeting: Meeting) => {
    setMeetingToAttend(meeting);
    setAttendCreditTE(user?.name || meeting.te || (teList[0] || ''));
    setAttendPeopleCount(meeting.people_count ? String(meeting.people_count) : '');
    setAttendExpense(meeting.expense_amount ? String(meeting.expense_amount) : '');
    setAttendOutcome(meeting.outcome || '');
  };

  const confirmMeetingAttendance = async () => {
    if (!meetingToAttend) return;
    setIsSubmittingAttendance(true);
    const count = Number(attendPeopleCount) || (meetingToAttend.people_count ? Number(meetingToAttend.people_count) : 0);
    const expense = Number(attendExpense) || 0;
    const creditedTo = attendCreditTE || user?.name || meetingToAttend.te || 'Team Jajpur';

    try {
      await apiUpdateMeeting(meetingToAttend.meeting_id, {
        status: 'COMPLETED',
        te: creditedTo,
        people_count: count > 0 ? count : undefined,
        expense_amount: expense > 0 ? expense : undefined,
        outcome: attendOutcome.trim() || undefined,
        updated_by: user?.name || creditedTo,
      });
      await refetchMeetings();
      Toast.show({
        type: 'success',
        text1: 'Meeting Attended! 🎉',
        text2: `${count > 0 ? `${count} attendees` : 'Meeting'} credited to ${creditedTo}!${expense > 0 ? ` (₹${expense} Expense)` : ''}`,
        position: 'top',
        visibilityTime: 3500,
      });
      setMeetingToAttend(null);
    } catch (err: any) {
      Toast.show({
        type: 'error',
        text1: 'Update Failed',
        text2: err.message || 'Could not update meeting attendance',
        position: 'top',
      });
    } finally {
      setIsSubmittingAttendance(false);
    }
  };

  // Top Dealers computed from allSalesList for selectedMonth
  const computedTopDealers = useMemo(() => {
    const dealerMap: Record<string, { dealer_id: string; dealer_name: string; area: string; total_bags: number }> = {};
    scopedDealers.forEach(d => {
      if (!d || !d.dealer_id) return;
      dealerMap[d.dealer_id] = {
        dealer_id: d.dealer_id,
        dealer_name: d.dealer_name || 'Dealer',
        area: d.area || activeDistrict,
        total_bags: 0,
      };
    });

    allSalesList.forEach(s => {
      if (!s) return;
      const did = s.dealer_id || s.dealer_name || 'unknown';
      if (!dealerMap[did]) {
        dealerMap[did] = {
          dealer_id: did,
          dealer_name: s.dealer_name || 'Dealer',
          area: activeDistrict,
          total_bags: 0,
        };
      }
      dealerMap[did].total_bags += Number(s.quantity_bags) || 0;
    });

    return Object.values(dealerMap).sort((a, b) => b.total_bags - a.total_bags);
  }, [scopedDealers, allSalesList, activeDistrict]);

  const formatUpcomingDate = (dateStr: string) => {
    try {
      const norm = normalizeDate(dateStr);
      if (!norm) return { day: '??', month: '???' };
      const d = parseISO(norm);
      return { day: format(d, 'dd'), month: format(d, 'MMM').toUpperCase() };
    } catch {
      return { day: '??', month: '???' };
    }
  };

  // Quick month switcher helper
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

  return (
    <View style={styles.container}>
      {/* Background styling for glassmorphism */}
      <View style={[StyleSheet.absoluteFillObject, { backgroundColor: '#EFF2F7' }]} />
      <View style={styles.blob1} />
      <View style={styles.blob2} />

      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {/* HEADER */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.appLogoWrap}>
              <Image 
                source={require('../../assets/images/app-logo.jpg')} 
                style={styles.headerAppLogo} 
                resizeMode="contain" 
              />
            </View>
            <View style={styles.headerTextWrap}>
              <Text style={styles.greeting}>{getGreeting()},</Text>
              <Text style={styles.userName} numberOfLines={1}>{firstName}</Text>
              <TouchableOpacity
                style={styles.territoryRow}
                onPress={() => setShowDistrictModal(true)}
                activeOpacity={0.7}
              >
                <Ionicons name="location-sharp" size={11} color={Colors.primary} style={{ marginRight: 2 }} />
                <Text style={styles.territoryText} numberOfLines={1}>
                  District {activeDistrict}
                </Text>
                <Ionicons name="chevron-down" size={10} color={Colors.primary} style={{ marginLeft: 3 }} />
              </TouchableOpacity>
            </View>
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity style={styles.iconCircle} onPress={() => router.push('/notifications')} activeOpacity={0.8}>
              <Ionicons name="notifications-outline" size={20} color={Colors.textPrimary} />
              {unreadNotifCount > 0 ? (
                <View style={styles.badge}><Text style={styles.badgeText}>{unreadNotifCount}</Text></View>
              ) : null}
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconCircle} onPress={() => router.push('/profile')} activeOpacity={0.8}>
              <Ionicons name="person-outline" size={19} color={Colors.textPrimary} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.datePill} onPress={() => setShowMonthModal(true)} activeOpacity={0.8}>
              <Ionicons name="calendar-outline" size={13} color={Colors.primary} />
              <Text style={styles.datePillText}>{formatDateShort(today)}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* HERO BANNER */}
        <View style={styles.heroBannerContainer}>
          <Image 
            source={require('../../assets/images/hero-banner.png')} 
            resizeMode="contain"
            style={styles.heroImage}
          />
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
                  All Districts
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

        {/* ── TODAY'S SCHEDULE & ACTION REMINDER BANNER ── */}
        {pendingTasksTotal > 0 ? (
          <View style={styles.reminderContainer}>
            <View style={styles.reminderHeader}>
              <View style={styles.reminderTitleWrap}>
                <View style={styles.alertPulseDot} />
                <Text style={styles.reminderTitle}>Action Required Today ({pendingTasksTotal})</Text>
              </View>
              <View style={styles.reminderBadge}>
                <Text style={styles.reminderBadgeText}>ATTENDANCE DUE</Text>
              </View>
            </View>
            <Text style={styles.reminderSubText}>
              Attend today's scheduled activities below. Completing will turn off this alert:
            </Text>

            {pendingSlabs.map((slab) => (
              <View key={slab.slab_id} style={styles.reminderCard}>
                <View style={[styles.reminderIconCircle, { backgroundColor: '#FDE8EA' }]}>
                  <MaterialCommunityIcons name="office-building" size={20} color={Colors.primary} />
                </View>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={styles.reminderItemType}>SLAB CASTING</Text>
                    <Text style={styles.reminderDateTag}>{formatDateShort(slab.slab_date)}</Text>
                  </View>
                  <Text style={styles.reminderItemName}>{slab.dealer_name}</Text>
                  <Text style={styles.reminderItemDetail}>
                    👷 {slab.contractor_name || 'No contractor'} • {slab.expected_cement ? `${slab.expected_cement} Bags` : 'Casting today'}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.doneActionBtn}
                  onPress={() => markSlabAttended(slab)}
                  disabled={updatingTaskId === slab.slab_id}
                  activeOpacity={0.8}
                >
                  {updatingTaskId === slab.slab_id ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.doneActionBtnText}>Attend ✓</Text>
                  )}
                </TouchableOpacity>
              </View>
            ))}

            {pendingMeetings.map((meeting) => (
              <View key={meeting.meeting_id} style={styles.reminderCard}>
                <View style={[styles.reminderIconCircle, { backgroundColor: '#EDE9FE' }]}>
                  <Ionicons name="people" size={20} color="#7C3AED" />
                </View>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={[styles.reminderItemType, { color: '#7C3AED' }]}>{meeting.meeting_type} MEET</Text>
                    <Text style={styles.reminderDateTag}>{formatDateShort(meeting.meeting_date)}</Text>
                  </View>
                  <Text style={styles.reminderItemName}>{meeting.meeting_name || `${meeting.meeting_type} Meeting`}</Text>
                  <Text style={styles.reminderItemDetail}>
                    📍 {meeting.location || 'Jajpur'}{meeting.people_count ? ` • ${meeting.people_count} People` : ''}
                  </Text>
                </View>
                <TouchableOpacity
                  style={[styles.doneActionBtn, { backgroundColor: '#7C3AED' }]}
                  onPress={() => openAttendModal(meeting)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.doneActionBtnText}>Attend ✓</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.allClearPill}>
            <Ionicons name="checkmark-circle" size={16} color="#16A34A" />
            <Text style={styles.allClearText}>All today's tasks completed. No pending attendance!</Text>
          </View>
        )}

        {/* QUICK ACTIONS */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
        </View>
        <View style={styles.quickActionsContainer}>
          <TouchableOpacity style={styles.qaItemIcon} onPress={() => router.push('/slab/add')}>
            <View style={[styles.qaCircle, { backgroundColor: '#FDE8EA' }]}>
              <MaterialCommunityIcons name="office-building" size={28} color={Colors.primary} />
            </View>
            <Text style={styles.qaLabelText}>Slab</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.qaItemIcon} onPress={() => router.push('/sale/add')}>
            <View style={[styles.qaCircle, { backgroundColor: '#E0F2FE' }]}>
              <MaterialCommunityIcons name="package-variant-closed" size={28} color={Colors.info} />
            </View>
            <Text style={styles.qaLabelText}>Sale</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.qaItemIcon} onPress={() => router.push('/meeting/add')}>
            <View style={[styles.qaCircle, { backgroundColor: '#DCFCE7' }]}>
              <Ionicons name="people" size={28} color={Colors.success} />
            </View>
            <Text style={styles.qaLabelText}>Meeting</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.qaItemIcon} onPress={() => router.push('/dealer/add')}>
            <View style={[styles.qaCircle, { backgroundColor: '#FEF3C7' }]}>
              <Ionicons name="storefront" size={28} color={Colors.warning} />
            </View>
            <Text style={styles.qaLabelText}>Dealer</Text>
          </TouchableOpacity>
        </View>

        {/* MONTHLY PERFORMANCE (POORA MAHINE KA PERFORMANCE) */}
        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>Monthly Performance</Text>
            <Text style={styles.sectionSubtitle}>Complete month totals & metrics</Text>
          </View>
          <View style={styles.monthSelectorRow}>
            <TouchableOpacity onPress={() => switchMonth('prev')} style={styles.monthArrowBtn}>
              <Ionicons name="chevron-back" size={16} color={Colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.monthPillCapsule} onPress={() => setShowMonthModal(true)} activeOpacity={0.8}>
              <Ionicons name="calendar" size={13} color={Colors.primary} />
              <Text style={styles.monthPillCapsuleText}>{formattedSelectedMonth}</Text>
              <Ionicons name="chevron-down" size={12} color={Colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => switchMonth('next')} style={styles.monthArrowBtn}>
              <Ionicons name="chevron-forward" size={16} color={Colors.primary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* 4 ULTRA-COMPACT KPI BOXES */}
        <View style={styles.kpiGrid}>
          {/* Box 1: Total Slabs in Month */}
          <View style={styles.kpiCard}>
            <View style={styles.kpiHeaderRow}>
              <View style={[styles.kpiIconWrap, { backgroundColor: Colors.primaryLight }]}>
                <MaterialCommunityIcons name="office-building" size={20} color={Colors.primary} />
              </View>
              <View style={styles.trendBadge}>
                <Text style={styles.kpiTrend}>{monthCompletedSlabs} Done</Text>
              </View>
            </View>
            <Text style={styles.kpiValue}>{allSlabsList.length}</Text>
            <Text style={styles.kpiLabel}>Total Slabs</Text>
          </View>

          {/* Box 2: Total Sales in Month */}
          <View style={styles.kpiCard}>
            <View style={styles.kpiHeaderRow}>
              <View style={[styles.kpiIconWrap, { backgroundColor: Colors.infoLight }]}>
                <MaterialCommunityIcons name="chart-bar" size={20} color={Colors.info} />
              </View>
              <View style={[styles.trendBadge, { backgroundColor: '#E0F2FE' }]}>
                <Text style={[styles.kpiTrend, { color: Colors.info }]}>{totalSalesMT} MT</Text>
              </View>
            </View>
            <Text style={styles.kpiValue}>{formatNumber(totalSalesBags)}</Text>
            <Text style={styles.kpiLabel}>Sales (Bags)</Text>
          </View>

          {/* Box 3: Active % in Month */}
          <View style={styles.kpiCard}>
            <View style={styles.kpiHeaderRow}>
              <View style={[styles.kpiIconWrap, { backgroundColor: Colors.successLight }]}>
                <Ionicons name="flash" size={20} color={Colors.success} />
              </View>
              <View style={[styles.trendBadge, { backgroundColor: '#DCFCE7' }]}>
                <Text style={[styles.kpiTrend, { color: Colors.success }]}>{activeContractorsCount}/{totalContractorsCount}</Text>
              </View>
            </View>
            <Text style={styles.kpiValue}>{Math.round(activePercent)}%</Text>
            <Text style={styles.kpiLabel}>Active %</Text>
          </View>

          {/* Box 4: Total Meetings in Month */}
          <View style={styles.kpiCard}>
            <View style={styles.kpiHeaderRow}>
              <View style={[styles.kpiIconWrap, { backgroundColor: Colors.warningLight }]}>
                <Ionicons name="people" size={20} color={Colors.warning} />
              </View>
              <View style={[styles.trendBadge, { backgroundColor: '#FEF3C7' }]}>
                <Text style={[styles.kpiTrend, { color: Colors.warning }]}>{monthCompletedMeetings} Done</Text>
              </View>
            </View>
            <Text style={styles.kpiValue}>{allMeetingsList.length}</Text>
            <Text style={styles.kpiLabel}>Total Meetings</Text>
          </View>
        </View>

        {/* MONTHLY TARGETS (4 Boxes) */}
        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>Monthly Targets</Text>
            <Text style={styles.sectionSubtitle}>
              Target for {effectiveTargetTE === 'ALL' ? 'All Team' : (effectiveTargetTE === user?.name ? `${effectiveTargetTE} (Me)` : effectiveTargetTE)}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <TouchableOpacity
              style={styles.teTargetSwitcherBtn}
              onPress={() => setShowTargetTeModal(true)}
              activeOpacity={0.8}
            >
              <Feather name="user-check" size={13} color="#800E20" />
              <Text style={styles.teTargetSwitcherBtnText}>
                {effectiveTargetTE === 'ALL' ? 'All Team' : (effectiveTargetTE === user?.name ? 'My Target' : effectiveTargetTE)}
              </Text>
              <Ionicons name="chevron-down" size={11} color="#800E20" />
            </TouchableOpacity>
            <Text style={styles.monthSelectorText}>{formattedSelectedMonth}</Text>
          </View>
        </View>
        
        <View style={styles.targetGrid}>
          {/* Box 1: Sales Target */}
          <View style={styles.targetBox}>
            <Text style={styles.targetBoxLabel}>Sales (Bags)</Text>
            <Text style={styles.targetBoxValue}>{formatNumber(totalSalesBags)}</Text>

            <View style={styles.targetLineBg}>
              <View style={[styles.targetLineFill, { width: `${Math.min(100, (totalSalesBags / 10000) * 100)}%`, backgroundColor: Colors.primary }]} />
            </View>
            <Text style={styles.targetSubText}>{totalSalesMT} MT achieved</Text>
          </View>

          {/* Box 2: Contractor Activation */}
          <View style={styles.targetBox}>
            <Text style={styles.targetBoxLabel}>Active / Punch</Text>
            <Text style={styles.targetBoxValue}>{activeContractorsCount} <Text style={{ fontSize: 16, color: Colors.textMuted }}>/ {totalContractorsCount}</Text></Text>
            <View style={styles.targetLineBg}>
              <View style={[styles.targetLineFill, { width: `${Math.min(100, totalContractorsCount > 0 ? (activeContractorsCount / totalContractorsCount) * 100 : 0)}%`, backgroundColor: Colors.success }]} />
            </View>
            <Text style={styles.targetSubText}>Min 45% Target ({Math.round(activePercent)}%)</Text>
          </View>

          {/* Box 3: Contractor Meets */}
          <View style={styles.targetBox}>
            <Text style={styles.targetBoxLabel}>
              Contractor Meet ({effectiveTargetTE === 'ALL' ? 'Team' : (effectiveTargetTE === user?.name ? 'My' : effectiveTargetTE)})
            </Text>
            <Text style={styles.targetBoxValue}>{contractorPeopleCount} <Text style={{ fontSize: 16, color: Colors.textMuted }}>/ 100</Text></Text>
            <View style={styles.targetLineBg}>
              <View style={[styles.targetLineFill, { width: `${Math.min(100, (contractorPeopleCount / 100) * 100)}%`, backgroundColor: '#EA580C' }]} />
            </View>
            <Text style={styles.targetSubText}>Target 100 Contractors ({Math.min(100, Math.round((contractorPeopleCount / 100) * 100))}%)</Text>
          </View>

          {/* Box 4: IHB Meets */}
          <View style={styles.targetBox}>
            <Text style={styles.targetBoxLabel}>
              IHB Meet ({effectiveTargetTE === 'ALL' ? 'Team' : (effectiveTargetTE === user?.name ? 'My' : effectiveTargetTE)})
            </Text>
            <Text style={styles.targetBoxValue}>{ihbPeopleCount} <Text style={{ fontSize: 16, color: Colors.textMuted }}>/ 50</Text></Text>
            <View style={styles.targetLineBg}>
              <View style={[styles.targetLineFill, { width: `${Math.min(100, (ihbPeopleCount / 50) * 100)}%`, backgroundColor: '#7C3AED' }]} />
            </View>
            <Text style={styles.targetSubText}>Target 50 IHB ({Math.min(100, Math.round((ihbPeopleCount / 50) * 100))}%)</Text>
          </View>
        </View>

        {/* UPCOMING / RECENT SLABS */}
        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>
              {upcomingSlabsList.length > 0 ? 'Upcoming Slabs' : 'Recent Slabs'}
            </Text>
            <Text style={styles.sectionSubtitle}>
              {upcomingSlabsList.length > 0 ? 'Scheduled for casting' : 'Latest slabs from sheet'}
            </Text>
          </View>
          <TouchableOpacity onPress={() => router.push('/(tabs)/slab')}>
            <Text style={styles.viewAll}>View All</Text>
          </TouchableOpacity>
        </View>

        {displaySlabs.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No slabs found in sheet.</Text>
          </View>
        ) : (
          displaySlabs.map((slab, slabIdx) => {
            const { day, month } = formatUpcomingDate(slab.slab_date);
            const isCompleted = slab.status === 'COMPLETED';
            return (
              <Link href={`/slab/${slab.slab_id}` as any} asChild key={slab.slab_id || `slab_${slabIdx}`}>
                <TouchableOpacity activeOpacity={0.7}>
                  <View style={styles.glassListRow}>
                    <View style={styles.dateBox}>
                      <Text style={styles.dateDay}>{day}</Text>
                      <Text style={styles.dateMonth}>{month}</Text>
                    </View>
                    <View style={styles.listIconCircle}>
                      <MaterialCommunityIcons name="office-building" size={24} color={Colors.primary} />
                    </View>
                    <View style={styles.listInfo}>
                      <Text style={styles.listTitle}>{slab.dealer_name}</Text>
                      <Text style={styles.listSub}>{slab.contractor_name || slab.customer_name || 'Jajpur Site'}</Text>
                    </View>
                    <View style={[styles.countPill, isCompleted && { backgroundColor: '#DCFCE7' }]}>
                      <Text style={[styles.countPillText, isCompleted && { color: '#16A34A' }]}>
                        {slab.status || '1 Slab'}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              </Link>
            );
          })
        )}

        {/* UPCOMING / RECENT EVENTS */}
        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>
              {upcomingMeetingsList.length > 0 ? 'Upcoming Events' : 'Recent Events'}
            </Text>
            <Text style={styles.sectionSubtitle}>
              {upcomingMeetingsList.length > 0 ? 'Scheduled meetings & meets' : 'Latest events from sheet'}
            </Text>
          </View>
          <TouchableOpacity onPress={() => router.push('/(tabs)/meeting')}>
            <Text style={styles.viewAll}>View All</Text>
          </TouchableOpacity>
        </View>

        {displayMeetings.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No events found in sheet.</Text>
          </View>
        ) : (
          displayMeetings.map((meeting, meetIdx) => {
            const { day, month } = formatUpcomingDate(meeting.meeting_date);
            const isCompleted = meeting.status === 'COMPLETED';
            return (
              <Link href={`/meeting/${meeting.meeting_id}` as any} asChild key={meeting.meeting_id || `meeting_${meetIdx}`}>
                <TouchableOpacity activeOpacity={0.7}>
                  <View style={[
                    styles.glassListRow,
                    isCompleted
                      ? { backgroundColor: 'rgba(240, 253, 244, 0.75)', borderWidth: 1.5, borderColor: '#86EFAC' }
                      : { backgroundColor: 'rgba(250, 245, 255, 0.85)', borderWidth: 1.5, borderColor: '#DDD6FE' }
                  ]}>
                    <View style={[
                      styles.dateBox,
                      isCompleted ? { backgroundColor: '#DCFCE7' } : { backgroundColor: '#EDE9FE' }
                    ]}>
                      <Text style={[styles.dateDay, isCompleted ? { color: '#16A34A' } : { color: '#7C3AED' }]}>{day}</Text>
                      <Text style={[styles.dateMonth, isCompleted ? { color: '#15803D' } : { color: '#6D28D9' }]}>{month}</Text>
                    </View>
                    <View style={[
                      styles.listIconCircle,
                      isCompleted ? { backgroundColor: '#DCFCE7' } : { backgroundColor: '#EDE9FE' }
                    ]}>
                      <Ionicons
                        name={isCompleted ? "checkmark-circle" : "people"}
                        size={22}
                        color={isCompleted ? "#16A34A" : "#7C3AED"}
                      />
                    </View>
                    <View style={styles.listInfo}>
                      <Text style={[styles.listTitle, isCompleted && { color: '#14532D' }]}>
                        {meeting.meeting_name || `${meeting.meeting_type} Meet`}
                      </Text>
                      <Text style={styles.listSub}>
                        {meeting.location || 'Jajpur'}
                        {meeting.people_count ? ` · 👥 ${meeting.people_count}` : ''}
                        {meeting.expense_amount ? ` · 💰 ₹${meeting.expense_amount}` : ''}
                      </Text>
                    </View>
                    <View style={[
                      styles.countPill,
                      isCompleted ? { backgroundColor: '#DCFCE7' } : { backgroundColor: '#EDE9FE' }
                    ]}>
                      <Text style={[
                        styles.countPillText,
                        isCompleted ? { color: '#15803D' } : { color: '#7C3AED' }
                      ]}>
                        {isCompleted ? '✅ COMPLETED' : (meeting.status || '⏳ UPCOMING')}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              </Link>
            );
          })
        )}

        {/* TOP DEALERS BY SALES (MTD) */}
        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>Top Dealers by Sales</Text>
            <Text style={styles.sectionSubtitle}>{formattedSelectedMonth}</Text>
          </View>
          <TouchableOpacity onPress={() => router.push('/(tabs)/sales')}>
            <Text style={styles.viewAll}>View All</Text>
          </TouchableOpacity>
        </View>
        
        <View style={styles.largeCard}>
          {computedTopDealers.length === 0 || computedTopDealers.every(d => d.total_bags === 0) ? (
            <Text style={styles.emptyText}>No dealer sales recorded for {formattedSelectedMonth}.</Text>
          ) : (
            computedTopDealers.filter(d => d.total_bags > 0).slice(0, 3).map((dealer, index) => {
              const maxBags = computedTopDealers[0].total_bags || 1;
              const fillWidth = maxBags > 0 ? (dealer.total_bags / maxBags) * 100 : 0;
              return (
                <View key={dealer.dealer_id || `dealer_${index}`} style={[styles.dealerRow, index < 2 && { borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.05)' }]}>
                  <View style={styles.rankCircle}>
                    <Text style={styles.rankText}>{index + 1}</Text>
                  </View>
                  <View style={styles.dealerInfo}>
                    <Text style={styles.dealerName}>{dealer.dealer_name}</Text>
                    <Text style={styles.dealerArea}>{dealer.area || 'Jajpur'}</Text>
                    <View style={styles.dealerLineBg}>
                      <View style={[styles.dealerLineFill, { width: `${fillWidth}%` }]} />
                    </View>
                  </View>
                  <View style={styles.dealerSalesWrap}>
                    <Text style={styles.dealerSalesValue}>{formatNumber(dealer.total_bags || 0)}</Text>
                    <Text style={styles.dealerSalesSub}>{((Number(dealer.total_bags) || 0) / 20).toFixed(1)} MT</Text>
                  </View>

                </View>
              );
            })
          )}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Floating Action Menu */}
      <FloatingActionMenu />

      {/* MONTH PICKER MODAL */}
      <Modal visible={showMonthModal} transparent animationType="fade" onRequestClose={() => setShowMonthModal(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowMonthModal(false)}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Performance Month</Text>
              <TouchableOpacity onPress={() => setShowMonthModal(false)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={20} color={Colors.textPrimary} />
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
                        name={isSelected ? "radio-button-on" : "radio-button-off"} 
                        size={18} 
                        color={isSelected ? Colors.primary : Colors.textMuted} 
                      />
                      <Text style={[styles.monthOptionText, isSelected && styles.monthOptionTextSelected]}>
                        {monthLabel} {isCurrent ? '(Current)' : ''}
                      </Text>
                    </View>
                    {isSelected && (
                      <Ionicons name="checkmark" size={18} color={Colors.primary} />
                    )}
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── DISTRICT PICKER MODAL ── */}
      <Modal
        visible={showDistrictModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDistrictModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowDistrictModal(false)}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Territory / District</Text>
              <TouchableOpacity onPress={() => setShowDistrictModal(false)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={20} color={Colors.textPrimary} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={['ALL', ...availableDistricts]}
              keyExtractor={(item) => item}
              renderItem={({ item }) => {
                const isSelected = item === 'ALL' ? activeDistrict === 'ALL' : activeDistrict.toLowerCase() === item.toLowerCase();
                const label = item === 'ALL' ? 'All Districts (Full Team)' : `District ${item}`;

                return (
                  <TouchableOpacity
                    style={[styles.monthOptionRow, isSelected && styles.monthOptionSelected]}
                    onPress={() => {
                      setActiveDistrict(item);
                      setShowDistrictModal(false);
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <Ionicons
                        name={isSelected ? "radio-button-on" : "radio-button-off"}
                        size={18}
                        color={isSelected ? Colors.primary : Colors.textMuted}
                      />
                      <Text style={[styles.monthOptionText, isSelected && styles.monthOptionTextSelected]}>
                        {label}
                      </Text>
                    </View>
                    {isSelected && <Ionicons name="checkmark" size={18} color={Colors.primary} />}
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── TE TARGET SWITCHER MODAL ── */}
      <Modal
        visible={showTargetTeModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowTargetTeModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowTargetTeModal(false)}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select TE for Monthly Target</Text>
              <TouchableOpacity onPress={() => setShowTargetTeModal(false)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={20} color={Colors.textPrimary} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={['ALL', ...teList]}
              keyExtractor={(item) => item}
              renderItem={({ item }) => {
                const isSelected = effectiveTargetTE === item;
                const isMe = item === user?.name;
                const label = item === 'ALL'
                  ? 'All Team Consolidated'
                  : (isMe ? `${item} (My Target)` : item);

                return (
                  <TouchableOpacity
                    style={[styles.monthOptionRow, isSelected && styles.monthOptionSelected]}
                    onPress={() => {
                      setTargetTE(item);
                      setShowTargetTeModal(false);
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <Ionicons
                        name={isSelected ? "radio-button-on" : "radio-button-off"}
                        size={18}
                        color={isSelected ? Colors.primary : Colors.textMuted}
                      />
                      <Text style={[styles.monthOptionText, isSelected && styles.monthOptionTextSelected]}>
                        {label}
                      </Text>
                    </View>
                    {isSelected && <Ionicons name="checkmark" size={18} color={Colors.primary} />}
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── ATTEND MEETING & TARGET CREDIT MODAL ── */}
      <Modal
        visible={!!meetingToAttend}
        transparent
        animationType="slide"
        onRequestClose={() => { if (!isSubmittingAttendance) setMeetingToAttend(null); }}
      >
        <KeyboardAvoidingView
          style={styles.attendModalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.attendModalCard}>
            {meetingToAttend && (
              <>
                {/* Header */}
                <View style={styles.attendModalHeader}>
                  <View style={{ flex: 1 }}>
                    <View style={styles.attendBadgeRow}>
                      <View style={[styles.attendTypeBadge, { backgroundColor: meetingToAttend.meeting_type === 'CUSTOMER' ? '#FBE8EC' : '#FFEDD5' }]}>
                        <Text style={[styles.attendTypeBadgeText, { color: meetingToAttend.meeting_type === 'CUSTOMER' ? '#800E20' : '#C2410C' }]}>
                          {meetingToAttend.meeting_type} MEET
                        </Text>
                      </View>
                      <Text style={styles.attendDateTag}>{formatDateShort(meetingToAttend.meeting_date)}</Text>
                    </View>
                    <Text style={styles.attendModalTitle}>
                      {meetingToAttend.meeting_name || `${meetingToAttend.meeting_type} Meeting`}
                    </Text>
                    {meetingToAttend.location ? (
                      <Text style={styles.attendModalLocation}>📍 {meetingToAttend.location}</Text>
                    ) : null}
                  </View>
                  <TouchableOpacity
                    onPress={() => setMeetingToAttend(null)}
                    disabled={isSubmittingAttendance}
                    style={styles.modalCloseBtn}
                  >
                    <Ionicons name="close" size={22} color={Colors.textPrimary} />
                  </TouchableOpacity>
                </View>

                <View style={styles.modalDivider} />

                <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 360 }}>
                  {/* 1. Who Attended / Credit Target To */}
                  <View style={styles.attendFieldGroup}>
                    <Text style={styles.attendFieldLabel}>
                      Kisne Attend Kiya? (Target Credit To) <Text style={{ color: '#800E20' }}>*</Text>
                    </Text>
                    <Text style={styles.attendFieldSubtext}>
                      Is meeting ka target is TE ke account me judega (Target: 100 Contractor / 50 IHB):
                    </Text>
                    <View style={styles.teChipsContainer}>
                      {teList.map((teName) => {
                        const isSelected = attendCreditTE === teName;
                        const isMe = teName === user?.name;
                        return (
                          <TouchableOpacity
                            key={teName}
                            style={[styles.teAttendChip, isSelected && styles.teAttendChipActive]}
                            onPress={() => setAttendCreditTE(teName)}
                            activeOpacity={0.8}
                          >
                            <Feather
                              name="user"
                              size={13}
                              color={isSelected ? '#FFFFFF' : '#800E20'}
                              style={{ marginRight: 4 }}
                            />
                            <Text style={[styles.teAttendChipText, isSelected && styles.teAttendChipTextActive]}>
                              {teName} {isMe ? '(Me)' : ''}
                            </Text>
                            {isSelected && (
                              <Ionicons name="checkmark" size={14} color="#FFFFFF" style={{ marginLeft: 4 }} />
                            )}
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>

                  {/* 2. Number of Attendees */}
                  <View style={styles.attendFieldGroup}>
                    <Text style={styles.attendFieldLabel}>
                      Kitne Log Aaye? (Attendees Count) <Text style={{ color: '#800E20' }}>*</Text>
                    </Text>
                    <Text style={styles.attendFieldSubtext}>
                      Ye attendees count {attendCreditTE || 'TE'} ke target me add hoga:
                    </Text>
                    <TextInput
                      style={styles.attendInput}
                      keyboardType="numeric"
                      placeholder="e.g. 25"
                      placeholderTextColor={Colors.textMuted}
                      value={attendPeopleCount}
                      onChangeText={setAttendPeopleCount}
                    />
                    <View style={styles.quickCountRow}>
                      {[10, 25, 50, 100].map((num) => (
                        <TouchableOpacity
                          key={num}
                          style={styles.quickCountBtn}
                          onPress={() => setAttendPeopleCount(String(num))}
                          activeOpacity={0.8}
                        >
                          <Text style={styles.quickCountBtnText}>+{num}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  {/* 3. Meeting Expense (Kharch) */}
                  <View style={styles.attendFieldGroup}>
                    <Text style={styles.attendFieldLabel}>
                      Meeting Expense (₹) / ଖର୍ଚ୍ଚ ଟଙ୍କା
                    </Text>
                    <Text style={styles.attendFieldSubtext}>
                      Chai, nasta ya meeting par kitna kharcha hua (Optional):
                    </Text>
                    <TextInput
                      style={styles.attendInput}
                      keyboardType="numeric"
                      placeholder="e.g. ₹500"
                      placeholderTextColor={Colors.textMuted}
                      value={attendExpense}
                      onChangeText={setAttendExpense}
                    />
                    <View style={styles.quickCountRow}>
                      {[200, 500, 1000, 1500].map((amt) => (
                        <TouchableOpacity
                          key={amt}
                          style={[styles.quickCountBtn, { backgroundColor: '#DCFCE7', borderColor: '#86EFAC' }]}
                          onPress={() => setAttendExpense(String(amt))}
                          activeOpacity={0.8}
                        >
                          <Text style={[styles.quickCountBtnText, { color: '#15803D' }]}>+₹{amt}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  {/* 4. Meeting Outcome / Notes */}
                  <View style={styles.attendFieldGroup}>
                    <Text style={styles.attendFieldLabel}>Meeting Outcome / Remark (Optional)</Text>
                    <TextInput
                      style={[styles.attendInput, { height: 60, textAlignVertical: 'top' }]}
                      multiline
                      placeholder="Key discussion points, feedback, etc."
                      placeholderTextColor={Colors.textMuted}
                      value={attendOutcome}
                      onChangeText={setAttendOutcome}
                    />
                  </View>
                </ScrollView>

                {/* Action Buttons */}
                <View style={styles.attendModalActions}>
                  <TouchableOpacity
                    style={styles.attendCancelBtn}
                    onPress={() => setMeetingToAttend(null)}
                    disabled={isSubmittingAttendance}
                  >
                    <Text style={styles.attendCancelBtnText}>Cancel</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.attendConfirmBtn}
                    onPress={confirmMeetingAttendance}
                    disabled={isSubmittingAttendance}
                    activeOpacity={0.85}
                  >
                    {isSubmittingAttendance ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Text style={styles.attendConfirmBtnText}>
                        Confirm & Credit to {attendCreditTE ? attendCreditTE.split(' ')[0] : 'TE'} ✓
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#EFF2F7',
    overflow: 'hidden',
    width: '100%',
    maxWidth: '100%',
  },
  
  blob1: { position: 'absolute', top: -100, right: -50, width: 300, height: 300, borderRadius: 150, backgroundColor: 'rgba(253, 232, 234, 0.4)' },
  blob2: { position: 'absolute', top: 300, left: -100, width: 250, height: 250, borderRadius: 125, backgroundColor: 'rgba(224, 242, 254, 0.35)' },

  scroll: { flex: 1, width: '100%' },
  scrollContent: { paddingHorizontal: 14, paddingBottom: 100, paddingTop: Platform.OS === 'ios' ? 56 : 38 },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, width: '100%' },
  headerLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, minWidth: 0 },
  appLogoWrap: {
    width: 46,
    height: 46,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    marginRight: 10,
    padding: 3,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 5,
    elevation: 3,
  },
  headerAppLogo: { width: '100%', height: '100%' },
  headerTextWrap: { flex: 1, minWidth: 0 },
  greeting: { fontFamily: FontFamily.sansMedium, fontSize: 12, color: '#6B7280' },
  userName: { fontFamily: FontFamily.displayBlack, fontSize: 21, color: '#172033', letterSpacing: -0.4, marginTop: -2 },
  territoryRow: { flexDirection: 'row', alignItems: 'center', marginTop: 1 },
  territoryText: { fontFamily: FontFamily.sansMedium, fontSize: 11, color: '#6B7280' },
  
  datePill: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', paddingHorizontal: 8, paddingVertical: 6, borderRadius: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 1, gap: 4 },
  datePillText: { fontFamily: FontFamily.sansBold, fontSize: 11, color: '#172033' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 5, flexShrink: 0 },
  iconCircle: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#EFF2F7' },
  badge: { position: 'absolute', top: -2, right: -2, backgroundColor: Colors.primary, width: 14, height: 14, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontSize: 8, color: Colors.white, fontFamily: FontFamily.sansBold },
  
  heroBannerContainer: { width: '100%', aspectRatio: 2.3, marginBottom: 14, borderRadius: 20, overflow: 'hidden' },
  heroImage: { width: '100%', height: '100%' },

  // District Selector Bar
  districtBarContainer: {
    marginBottom: 16,
    width: '100%',
  },
  districtBarScroll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
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
  
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 14, marginTop: 12 },
  sectionTitle: { fontFamily: FontFamily.displayBold, fontSize: 20, color: Colors.textPrimary },
  sectionSubtitle: { fontFamily: FontFamily.sansMedium, fontSize: 11, color: Colors.textSecondary, marginTop: 2 },
  monthSelectorText: { fontFamily: FontFamily.sansBold, fontSize: 13, color: Colors.primary },
  viewAll: { fontFamily: FontFamily.sansBold, fontSize: 13, color: Colors.primary },

  monthSelectorRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  monthArrowBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', elevation: 1 },
  monthPillCapsule: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14, gap: 5, elevation: 1 },
  monthPillCapsuleText: { fontFamily: FontFamily.sansBold, fontSize: 12, color: Colors.primary },

  // TODAY'S REMINDER / ALERT STYLES
  reminderContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1.5,
    borderColor: '#FCA5A5',
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 4,
  },
  reminderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  reminderTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  alertPulseDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#DC2626',
  },
  reminderTitle: {
    fontFamily: FontFamily.displayBold,
    fontSize: 15,
    color: '#991B1B',
    letterSpacing: -0.3,
  },
  reminderBadge: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  reminderBadgeText: {
    fontFamily: FontFamily.sansBold,
    fontSize: 10,
    color: '#DC2626',
  },
  reminderSubText: {
    fontFamily: FontFamily.sansRegular,
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 12,
  },
  reminderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  reminderIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reminderItemType: {
    fontFamily: FontFamily.sansBold,
    fontSize: 10,
    color: Colors.primary,
    letterSpacing: 0.5,
  },
  reminderDateTag: {
    fontFamily: FontFamily.sansMedium,
    fontSize: 10,
    color: '#9CA3AF',
  },
  reminderItemName: {
    fontFamily: FontFamily.displayBold,
    fontSize: 14,
    color: '#1F2937',
    marginTop: 1,
  },
  reminderItemDetail: {
    fontFamily: FontFamily.sansRegular,
    fontSize: 11,
    color: '#4B5563',
    marginTop: 2,
  },
  doneActionBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 70,
  },
  doneActionBtnText: {
    fontFamily: FontFamily.sansBold,
    fontSize: 12,
    color: '#FFFFFF',
  },
  allClearPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  allClearText: {
    fontFamily: FontFamily.sansMedium,
    fontSize: 12,
    color: '#15803D',
  },

  quickActionsContainer: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 20, paddingHorizontal: 10 },
  qaItemIcon: { alignItems: 'center', justifyContent: 'center' },
  qaCircle: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center', marginBottom: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 6, elevation: 3 },
  qaLabelText: { fontFamily: FontFamily.sansBold, fontSize: 13, color: Colors.textPrimary },

  // ULTRA-COMPACT KPI CARDS
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 12 },
  kpiCard: { width: '48%', backgroundColor: 'rgba(255,255,255,0.7)', borderRadius: 14, padding: 10, paddingVertical: 10, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.9)', overflow: 'hidden' },
  kpiHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  kpiIconWrap: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  trendBadge: { backgroundColor: '#FDE8EA', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  kpiTrend: { fontFamily: FontFamily.sansBold, fontSize: 11, color: Colors.primary },
  kpiValue: { fontFamily: FontFamily.displayBold, fontSize: 26, color: Colors.textPrimary, letterSpacing: -0.5 },
  kpiLabel: { fontFamily: FontFamily.sansMedium, fontSize: 12, color: Colors.textSecondary },

  targetGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 24 },
  targetBox: { width: '48%', backgroundColor: 'rgba(255,255,255,0.6)', borderRadius: 20, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.8)', overflow: 'hidden' },
  targetBoxLabel: { fontFamily: FontFamily.sansMedium, fontSize: 12, color: Colors.textSecondary, marginBottom: 4 },
  targetBoxValue: { fontFamily: FontFamily.displayBold, fontSize: 22, color: Colors.textPrimary, marginBottom: 8, letterSpacing: -0.5 },
  targetLineBg: { height: 6, backgroundColor: 'rgba(0,0,0,0.05)', borderRadius: 3, overflow: 'hidden', marginBottom: 6 },
  targetLineFill: { height: '100%', borderRadius: 3 },
  targetSubText: { fontFamily: FontFamily.sansMedium, fontSize: 11, color: Colors.textSecondary },

  largeCard: { backgroundColor: 'rgba(255,255,255,0.6)', borderRadius: 24, padding: 20, marginBottom: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.8)', overflow: 'hidden' },

  emptyText: { fontFamily: FontFamily.sansMedium, fontSize: 14, color: Colors.textSecondary, textAlign: 'center', padding: 20 },
  emptyCard: { backgroundColor: 'rgba(255,255,255,0.6)', borderRadius: 20, padding: 24, alignItems: 'center', justifyContent: 'center', marginBottom: 24 },

  glassListRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.6)', borderRadius: 20, padding: 12, marginBottom: 12 },
  dateBox: { width: 52, height: 52, backgroundColor: '#FFFFFF', borderRadius: 16, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  dateDay: { fontFamily: FontFamily.displayBold, fontSize: 18, color: Colors.primary },
  dateMonth: { fontFamily: FontFamily.sansBold, fontSize: 11, color: Colors.textSecondary, textTransform: 'uppercase' },

  listIconCircle: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.7)', alignItems: 'center', justifyContent: 'center', marginLeft: 10 },
  listInfo: { flex: 1, marginLeft: 12 },
  listTitle: { fontFamily: FontFamily.sansBold, fontSize: 15, color: Colors.textPrimary },
  listSub: { fontFamily: FontFamily.sansMedium, fontSize: 12, color: Colors.textSecondary },
  countPill: { backgroundColor: Colors.primaryLight, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  countPillText: { fontFamily: FontFamily.sansBold, fontSize: 11, color: Colors.primary },

  dealerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  rankCircle: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2, marginRight: 12 },
  rankText: { fontFamily: FontFamily.sansBold, fontSize: 13, color: Colors.textSecondary },
  dealerInfo: { flex: 1 },
  dealerName: { fontFamily: FontFamily.sansBold, fontSize: 15, color: Colors.textPrimary, marginBottom: 2 },
  dealerArea: { fontFamily: FontFamily.sansMedium, fontSize: 12, color: Colors.textSecondary },
  dealerLineBg: { height: 6, backgroundColor: 'rgba(0,0,0,0.05)', borderRadius: 3, overflow: 'hidden', marginTop: 6 },
  dealerLineFill: { height: '100%', borderRadius: 3, backgroundColor: Colors.primary },
  dealerSalesWrap: { alignItems: 'flex-end', marginLeft: 12 },
  dealerSalesValue: { fontFamily: FontFamily.displayBold, fontSize: 17, color: Colors.primary, letterSpacing: -0.5 },
  dealerSalesSub: { fontFamily: FontFamily.sansMedium, fontSize: 11, color: Colors.textSecondary },

  // MODAL STYLES
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalContent: { backgroundColor: '#FFFFFF', width: '100%', maxWidth: 360, borderRadius: 24, padding: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.15, shadowRadius: 20, elevation: 10 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, borderBottomWidth: 1, borderBottomColor: '#F3F4F6', paddingBottom: 12 },
  modalTitle: { fontFamily: FontFamily.sansBold, fontSize: 16, color: Colors.textPrimary },
  modalCloseBtn: { padding: 4 },
  monthOptionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, paddingHorizontal: 12, borderRadius: 12, marginBottom: 6 },
  monthOptionSelected: { backgroundColor: '#FDE8EA' },
  monthOptionText: { fontFamily: FontFamily.sansMedium, fontSize: 14, color: Colors.textPrimary },
  monthOptionTextSelected: { fontFamily: FontFamily.sansBold, color: Colors.primary },

  // TE Target Switcher Pill
  teTargetSwitcherBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FDE8EA',
    borderWidth: 1,
    borderColor: '#F8B4BD',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
  },
  teTargetSwitcherBtnText: {
    fontFamily: FontFamily.sansBold,
    fontSize: 12,
    color: '#800E20',
  },

  // Attend Meeting Modal Styles
  attendModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  attendModalCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 20,
  },
  attendModalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  attendBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  attendTypeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  attendTypeBadgeText: {
    fontFamily: FontFamily.sansBold,
    fontSize: 10,
    letterSpacing: 0.5,
  },
  attendDateTag: {
    fontFamily: FontFamily.sansMedium,
    fontSize: 11,
    color: '#6B7280',
  },
  attendModalTitle: {
    fontFamily: FontFamily.displayBold,
    fontSize: 18,
    color: '#111827',
  },
  attendModalLocation: {
    fontFamily: FontFamily.sansMedium,
    fontSize: 12,
    color: '#4B5563',
    marginTop: 3,
  },
  modalDivider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginBottom: 16,
  },
  attendFieldGroup: {
    marginBottom: 16,
  },
  attendFieldLabel: {
    fontFamily: FontFamily.sansBold,
    fontSize: 13,
    color: '#1F2937',
    marginBottom: 4,
  },
  attendFieldSubtext: {
    fontFamily: FontFamily.sansRegular,
    fontSize: 11,
    color: '#6B7280',
    marginBottom: 8,
  },
  teChipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  teAttendChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#F9FAFB',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
  },
  teAttendChipActive: {
    backgroundColor: '#800E20',
    borderColor: '#800E20',
  },
  teAttendChipText: {
    fontFamily: FontFamily.sansBold,
    fontSize: 12,
    color: '#374151',
  },
  teAttendChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  attendInput: {
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: '#111827',
    backgroundColor: '#FFFFFF',
    fontFamily: FontFamily.sansRegular,
  },
  quickCountRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  quickCountBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#FDE8EA',
    borderWidth: 1,
    borderColor: '#F8B4BD',
  },
  quickCountBtnText: {
    fontFamily: FontFamily.sansBold,
    fontSize: 12,
    color: '#800E20',
  },
  attendModalActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 16,
  },
  attendCancelBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 14,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  attendCancelBtnText: {
    fontFamily: FontFamily.sansMedium,
    fontSize: 14,
    color: '#4B5563',
  },
  attendConfirmBtn: {
    flex: 2,
    paddingVertical: 13,
    borderRadius: 14,
    backgroundColor: '#800E20',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#800E20',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  attendConfirmBtnText: {
    fontFamily: FontFamily.sansBold,
    fontSize: 14,
    color: '#FFFFFF',
  },
});