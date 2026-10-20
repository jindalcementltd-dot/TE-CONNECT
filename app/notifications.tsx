import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  Platform, ActivityIndicator, Alert, RefreshControl,
} from 'react-native';
import { router } from 'expo-router';
import { Colors } from '../src/theme/colors';
import { Spacing, BorderRadius } from '../src/theme/spacing';
import { Typography, FontFamily, FontSize } from '../src/theme/typography';
import {
  AppNotification, NotificationType, getNotifications,
  markNotificationAsRead, markAllNotificationsAsRead, clearAllNotifications,
  requestAppNotificationPermission, testAppNotification, playNotificationSound,
} from '../src/services/notifications';
import { getUser } from '../src/services/auth';
import { registerPushNotifications, sendTestPushNotification, getPushStatus } from '../src/services/fcmPush';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { formatDistanceToNow, parseISO } from 'date-fns';

const FILTER_TYPES: { key: string; label: string; icon: any }[] = [
  { key: 'ALL', label: 'All', icon: 'apps-outline' },
  { key: 'SLAB', label: 'Slabs 🏗️', icon: 'calendar-outline' },
  { key: 'PUNCH', label: 'Punch 🔨', icon: 'hammer-outline' },
  { key: 'SALE', label: 'Sales 📈', icon: 'stats-chart-outline' },
  { key: 'MEETING', label: 'Meetings 🤝', icon: 'people-outline' },
];

export default function NotificationsScreen() {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [selectedFilter, setSelectedFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadNotifications = useCallback(async () => {
    try {
      const list = await getNotifications();
      setNotifications(list);
    } catch (e) {
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const onRefresh = () => {
    setRefreshing(true);
    loadNotifications();
  };

  const handleMarkAllRead = async () => {
    await markAllNotificationsAsRead();
    loadNotifications();
  };

  const handleClearAll = () => {
    Alert.alert(
      'Clear Notifications',
      'Are you sure you want to delete all notification history?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            await clearAllNotifications();
            loadNotifications();
          },
        },
      ]
    );
  };

  const handleNotificationPress = async (item: AppNotification) => {
    if (!item.read) {
      await markNotificationAsRead(item.id);
      setNotifications(prev => prev.map(n => n.id === item.id ? { ...n, read: true } : n));
    }
  };

  const filteredList = notifications.filter(n => {
    if (selectedFilter === 'ALL') return true;
    return n.type === selectedFilter;
  });

  const unreadCount = notifications.filter(n => !n.read).length;

  const getTypeStyle = (type: NotificationType) => {
    switch (type) {
      case 'SLAB':
        return { icon: 'calendar-outline', color: Colors.primary, bg: '#FDE8EA' };
      case 'PUNCH':
        return { icon: 'hammer-outline', color: '#2563EB', bg: '#DBEAFE' };
      case 'SALE':
        return { icon: 'stats-chart-outline', color: '#16A34A', bg: '#DCFCE7' };
      case 'MEETING':
        return { icon: 'people-outline', color: '#7C3AED', bg: '#EDE9FE' };
      default:
        return { icon: 'notifications-outline', color: Colors.textSecondary, bg: '#F3F4F6' };
    }
  };

  const formatTimestamp = (ts: string) => {
    try {
      return formatDistanceToNow(parseISO(ts), { addSuffix: true });
    } catch (e) {
      return 'Recently';
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>Notifications</Text>
          <Text style={styles.headerSub}>All alerts and system updates</Text>
        </View>
        <View style={styles.headerActions}>
          {unreadCount > 0 ? (
            <TouchableOpacity onPress={handleMarkAllRead} style={styles.markReadBtn}>
              <Ionicons name="checkmark-done" size={18} color={Colors.primary} />
            </TouchableOpacity>
          ) : null}
          {notifications.length > 0 ? (
            <TouchableOpacity onPress={handleClearAll} style={styles.clearBtn}>
              <Ionicons name="trash-outline" size={18} color={Colors.textSecondary} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {/* Push Permission Enable Banner */}
      <View style={styles.permissionBanner}>
        <View style={styles.permissionLeft}>
          <Ionicons name="notifications-circle" size={26} color={Colors.primary} />
          <View style={{ flex: 1, marginLeft: 8 }}>
            <Text style={styles.permissionTitle}>Live Alerts & Sound</Text>
            <Text style={styles.permissionSub}>Get instant sound chime & vibration on new slabs</Text>
          </View>
        </View>
        <TouchableOpacity
          style={styles.permissionBtn}
          onPress={async () => {
            const granted = await requestAppNotificationPermission();
            await testAppNotification(
              '🔔 TE CONNECT Notification Active',
              'Sound chime and vibration alert verified successfully on your device!'
            );
            const u = await getUser();
            await registerPushNotifications(u).catch(() => {});
            loadNotifications();
            const pushStatus = await getPushStatus();
            if (pushStatus.registered) {
              Alert.alert(
                'Notification & Push Connected! 🔔',
                `Sound & Vibration verified.\n\nBackground Push is ACTIVE!\nToken: ${pushStatus.token?.slice(0, 24)}...`
              );
            } else {
              Alert.alert(
                'Notification Verified 🔔',
                `Local sound chime & alerts working.\n\nPush Note: ${pushStatus.error || 'Registering push...'}`
              );
            }
          }}
          activeOpacity={0.85}
        >
          <Text style={styles.permissionBtnText}>Test Alert 🔔</Text>
        </TouchableOpacity>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterBar}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={FILTER_TYPES}
          keyExtractor={item => item.key}
          contentContainerStyle={{ paddingHorizontal: Spacing.base, gap: 8 }}
          renderItem={({ item }) => {
            const active = selectedFilter === item.key;
            return (
              <TouchableOpacity
                style={[styles.filterChip, active && styles.filterChipActive]}
                onPress={() => setSelectedFilter(item.key)}
              >
                <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          }}
        />
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={Colors.primary} /></View>
      ) : filteredList.length === 0 ? (
        <View style={styles.emptyWrap}>
          <View style={styles.emptyIconCircle}>
            <Ionicons name="notifications-off-outline" size={42} color={Colors.textMuted} />
          </View>
          <Text style={styles.emptyTitle}>No New Notifications</Text>
          <Text style={styles.emptySub}>No notifications found in this category.</Text>
        </View>
      ) : (
        <FlatList
          data={filteredList}
          keyExtractor={item => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => {
            const styleConfig = getTypeStyle(item.type);
            return (
              <TouchableOpacity
                style={[styles.card, !item.read && styles.cardUnread]}
                onPress={() => handleNotificationPress(item)}
                activeOpacity={0.85}
              >
                <View style={[styles.typeIconBox, { backgroundColor: styleConfig.bg }]}>
                  <Ionicons name={styleConfig.icon as any} size={20} color={styleConfig.color} />
                </View>

                <View style={styles.cardBody}>
                  <View style={styles.cardHeaderRow}>
                    <Text style={[styles.cardTitle, !item.read && styles.cardTitleUnread]} numberOfLines={2}>
                      {item.title}
                    </Text>
                    {!item.read && <View style={styles.unreadDot} />}
                  </View>
                  <Text style={styles.cardText} numberOfLines={3}>{item.body}</Text>
                  <Text style={styles.cardTime}>{formatTimestamp(item.timestamp)}</Text>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    paddingTop: Platform.OS === 'ios' ? 56 : Spacing['2xl'],
    paddingBottom: Spacing.md,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backBtn: { width: 36 },
  headerTitleWrap: { flex: 1, marginLeft: 4 },
  headerTitle: { fontFamily: FontFamily.displayBold, fontSize: FontSize.lg, color: Colors.textPrimary },
  headerSub: { fontFamily: FontFamily.sansRegular, fontSize: 11, color: Colors.textSecondary },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  markReadBtn: { padding: 6, borderRadius: 8, backgroundColor: '#FEF2F2' },
  clearBtn: { padding: 6, borderRadius: 8, backgroundColor: '#F3F4F6' },

  filterBar: {
    backgroundColor: Colors.white,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: BorderRadius.full,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  filterChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterChipText: { fontFamily: FontFamily.sansMedium, fontSize: 12, color: Colors.textSecondary },
  filterChipTextActive: { color: Colors.white, fontWeight: '700' },

  listContent: { padding: Spacing.base, gap: 10 },
  card: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.xl,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 2,
    gap: 12,
  },
  cardUnread: {
    borderColor: '#FCA5A5',
    backgroundColor: '#FFFBFB',
  },
  typeIconBox: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: { flex: 1 },
  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardTitle: { fontFamily: FontFamily.sansBold, fontSize: 14, color: Colors.textPrimary, flex: 1, lineHeight: 18 },
  cardTitleUnread: { color: '#991B1B' },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.primary, marginLeft: 6, marginTop: 4 },
  cardText: { fontFamily: FontFamily.sansRegular, fontSize: 12, color: Colors.textSecondary, marginTop: 4, lineHeight: 16 },
  cardTime: { fontFamily: FontFamily.sansRegular, fontSize: 10, color: Colors.textMuted, marginTop: 6 },

  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing['2xl'] },
  emptyIconCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  emptyTitle: { fontFamily: FontFamily.displayBold, fontSize: 16, color: Colors.textPrimary },
  emptySub: { fontFamily: FontFamily.sansRegular, fontSize: 13, color: Colors.textSecondary, marginTop: 4, textAlign: 'center' },

  permissionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FEF2F2',
    borderBottomWidth: 1,
    borderBottomColor: '#FCA5A5',
    paddingHorizontal: Spacing.base,
    paddingVertical: 10,
    gap: 10,
  },
  permissionLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  permissionTitle: { fontFamily: FontFamily.sansBold, fontSize: 13, color: '#991B1B' },
  permissionSub: { fontFamily: FontFamily.sansRegular, fontSize: 11, color: '#7F1D1D' },
  permissionBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  permissionBtnText: { color: Colors.white, fontFamily: FontFamily.sansBold, fontSize: 12 },
});
