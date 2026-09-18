import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Platform } from 'react-native';
import { Tabs, router } from 'expo-router';
import { Colors } from '../../src/theme/colors';
import { getSession } from '../../src/services/auth';
import { Ionicons } from '@expo/vector-icons';

function TabIcon({ name, focused, label }: { name: any; focused: boolean; label: string }) {
  return (
    <View style={tabStyles.iconContainer}>
      <Ionicons
        name={name}
        size={22}
        color={focused ? Colors.primary : Colors.textMuted}
      />
      <Text style={[tabStyles.label, focused && tabStyles.labelActive]}>{label}</Text>
    </View>
  );
}

function PlusTabIcon() {
  return (
    <View style={tabStyles.plusButton}>
      <Ionicons name="add" size={30} color={Colors.white} />
    </View>
  );
}

function FABModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={fabStyles.overlay} onPress={onClose} activeOpacity={1}>
        <View style={fabStyles.container}>
          <Text style={fabStyles.title}>What would you like to add?</Text>

          <TouchableOpacity
            style={fabStyles.option}
            onPress={() => { onClose(); router.push('/slab/add'); }}
          >
            <View style={[fabStyles.optionIcon, { backgroundColor: Colors.primaryLight }]}>
              <Text style={fabStyles.optionEmoji}>🏗️</Text>
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
              <Text style={fabStyles.optionEmoji}>📊</Text>
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
            <View style={[fabStyles.optionIcon, { backgroundColor: '#EDE9FE' }]}>
              <Text style={fabStyles.optionEmoji}>🤝</Text>
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
          tabBarActiveTintColor: Colors.primary,
          tabBarInactiveTintColor: Colors.textMuted,
          tabBarShowLabel: false,
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            tabBarIcon: ({ focused }) => <TabIcon name="home" focused={focused} label="Home" />,
          }}
        />
        <Tabs.Screen
          name="slab"
          options={{
            tabBarIcon: ({ focused }) => <TabIcon name="calendar" focused={focused} label="Slab" />,
          }}
        />
        <Tabs.Screen
          name="plus"
          options={{
            tabBarIcon: () => <PlusTabIcon />,
            tabBarButton: (props) => (
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
            tabBarIcon: ({ focused }) => <TabIcon name="bar-chart" focused={focused} label="Sales" />,
          }}
        />
        <Tabs.Screen
          name="meeting"
          options={{
            tabBarIcon: ({ focused }) => <TabIcon name="people" focused={focused} label="Meeting" />,
          }}
        />
      </Tabs>

      <FABModal visible={fabVisible} onClose={() => setFabVisible(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    height: Platform.OS === 'ios' ? 88 : 64,
    backgroundColor: Colors.white,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 12,
    paddingBottom: Platform.OS === 'ios' ? 20 : 4,
  },
  plusTab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -20,
  },
});

const tabStyles = StyleSheet.create({
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 4,
  },
  label: {
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 2,
    fontWeight: '500',
  },
  labelActive: {
    color: Colors.primary,
    fontWeight: '600',
  },
  plusButton: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
});

const fabStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    paddingBottom: Platform.OS === 'ios' ? 44 : 24,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 20,
    textAlign: 'center',
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  optionIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  optionEmoji: {
    fontSize: 22,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  optionSub: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  cancelBtn: {
    marginTop: 16,
    alignItems: 'center',
    paddingVertical: 12,
  },
  cancelText: {
    fontSize: 15,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
});
