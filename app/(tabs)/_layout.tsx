import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Platform } from 'react-native';
import { Tabs, router } from 'expo-router';
import { Colors } from '../../src/theme/colors';
import { getSession } from '../../src/services/auth';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

function TabIcon({ name, focused, label }: { name: any; focused: boolean; label: string }) {
  return (
    <View style={tabStyles.iconContainer}>
      <Ionicons
        name={name}
        size={22}
        color={focused ? '#800E20' : '#8A7277'}
      />
      <Text style={[tabStyles.label, focused && tabStyles.labelActive]}>{label}</Text>
    </View>
  );
}

function PlusTabIcon() {
  return (
    <View style={tabStyles.plusButton}>
      <Ionicons name="add" size={32} color="#FFFFFF" />
    </View>
  );
}

function FABModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={fabStyles.overlay} onPress={onClose} activeOpacity={1}>
        <View style={fabStyles.container}>
          <Text style={fabStyles.title}>Quick Actions</Text>

          <TouchableOpacity
            style={fabStyles.option}
            onPress={() => { onClose(); router.push('/slab/add'); }}
          >
            <View style={[fabStyles.optionIcon, { backgroundColor: '#FBE8EC' }]}>
              <MaterialCommunityIcons name="office-building" size={24} color="#800E20" />
            </View>
            <View>
              <Text style={fabStyles.optionTitle}>Add Slab</Text>
              <Text style={fabStyles.optionSub}>Schedule a slab casting</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={fabStyles.option}
            onPress={() => { onClose(); router.push('/sale/add'); }}
          >
            <View style={[fabStyles.optionIcon, { backgroundColor: '#FEF3C7' }]}>
              <MaterialCommunityIcons name="package-variant-closed" size={24} color="#D97706" />
            </View>
            <View>
              <Text style={fabStyles.optionTitle}>Add Sale</Text>
              <Text style={fabStyles.optionSub}>Record dealer sales entry</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={fabStyles.option}
            onPress={() => { onClose(); router.push('/meeting/add'); }}
          >
            <View style={[fabStyles.optionIcon, { backgroundColor: '#FBE8EC' }]}>
              <Ionicons name="people" size={24} color="#800E20" />
            </View>
            <View>
              <Text style={fabStyles.optionTitle}>Add Meeting</Text>
              <Text style={fabStyles.optionSub}>Plan or record a meeting</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={fabStyles.cancelBtn} onPress={onClose}>
            <Text style={fabStyles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

export default function TabsLayout() {
  const [fabVisible, setFabVisible] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const session = await getSession();
    if (!session) {
      router.replace('/(auth)/login');
    } else {
      setAuthChecked(true);
    }
  };

  if (!authChecked) return null;

  return (
    <>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: styles.tabBar,
          tabBarActiveTintColor: '#800E20',
          tabBarInactiveTintColor: '#8A7277',
          tabBarShowLabel: false,
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            tabBarIcon: ({ focused }) => (
              <TabIcon name={focused ? "home" : "home-outline"} focused={focused} label="Home" />
            ),
          }}
        />
        <Tabs.Screen
          name="slab"
          options={{
            tabBarIcon: ({ focused }) => (
              <TabIcon name={focused ? "calendar" : "calendar-outline"} focused={focused} label="Slab" />
            ),
          }}
        />
        <Tabs.Screen
          name="plus"
          options={{
            tabBarIcon: () => <PlusTabIcon />,
            tabBarButton: () => (
              <TouchableOpacity
                style={styles.plusTab}
                onPress={() => setFabVisible(true)}
                activeOpacity={0.9}
              >
                <PlusTabIcon />
              </TouchableOpacity>
            ),
          }}
          listeners={{ tabPress: (e) => { e.preventDefault(); setFabVisible(true); } }}
        />
        <Tabs.Screen
          name="sales"
          options={{
            tabBarIcon: ({ focused }) => (
              <TabIcon name={focused ? "stats-chart" : "stats-chart-outline"} focused={focused} label="Sales" />
            ),
          }}
        />
        <Tabs.Screen
          name="meeting"
          options={{
            tabBarIcon: ({ focused }) => (
              <TabIcon name={focused ? "people" : "people-outline"} focused={focused} label="Meeting" />
            ),
          }}
        />
      </Tabs>

      <FABModal visible={fabVisible} onClose={() => setFabVisible(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    height: Platform.OS === 'ios' ? 88 : 68,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F0E2E5',
    shadowColor: 'rgba(78, 5, 17, 0.1)',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 10,
    paddingBottom: Platform.OS === 'ios' ? 24 : 8,
    paddingTop: 6,
  },
  plusTab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -24,
  },
});

const tabStyles = StyleSheet.create({
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 10,
    color: '#8A7277',
    marginTop: 2,
    fontWeight: '600',
  },
  labelActive: {
    color: '#800E20',
    fontWeight: '800',
  },
  plusButton: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#800E20',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#800E20',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 10,
    elevation: 10,
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
});

const fabStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(31, 11, 16, 0.65)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    paddingBottom: Platform.OS === 'ios' ? 44 : 24,
    borderWidth: 1,
    borderColor: '#F0E2E5',
  },
  title: {
    fontSize: 17,
    fontWeight: '800',
    color: '#1F0B10',
    marginBottom: 18,
    textAlign: 'center',
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F7EFF1',
  },
  optionIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  optionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1F0B10',
  },
  optionSub: {
    fontSize: 12,
    color: '#8A7277',
    marginTop: 2,
  },
  cancelBtn: {
    marginTop: 18,
    alignItems: 'center',
    paddingVertical: 12,
  },
  cancelText: {
    fontSize: 15,
    color: '#800E20',
    fontWeight: '700',
  },
});
