import React, { useEffect, useState, useRef } from 'react';
import { View, StyleSheet, Text, Platform, Animated } from 'react-native';
import { Tabs, router } from 'expo-router';
import { Colors } from '../../src/theme/colors';
import { Ionicons } from '@expo/vector-icons';
import { getSession } from '../../src/services/auth';

function TabIcon({ name, focused, label }: { name: any; focused: boolean; label: string }) {
  const scaleAnim = useRef(new Animated.Value(focused ? 1.05 : 1)).current;
  const pillOpacity = useRef(new Animated.Value(focused ? 1 : 0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: focused ? 1.06 : 1,
        friction: 7,
        tension: 120,
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.timing(pillOpacity, {
        toValue: focused ? 1 : 0,
        duration: 180,
        useNativeDriver: Platform.OS !== 'web',
      }),
    ]).start();
  }, [focused]);

  return (
    <Animated.View style={[tabStyles.iconContainer, { transform: [{ scale: scaleAnim }] }]}>
      <View style={tabStyles.iconWrapper}>
        <Animated.View style={[tabStyles.activePill, { opacity: pillOpacity }]} />
        <Ionicons 
          name={name} 
          size={22} 
          color={focused ? Colors.primary : '#64748B'} 
        />
      </View>
      <Text style={[tabStyles.label, focused && tabStyles.labelActive]}>
        {label}
      </Text>
    </Animated.View>
  );
}

export default function TabsLayout() {
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
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textSecondary,
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
        name="sales"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon name={focused ? "stats-chart" : "stats-chart-outline"} focused={focused} label="Sales" />
          ),
        }}
      />
      <Tabs.Screen
        name="punch"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon name={focused ? "hammer" : "hammer-outline"} focused={focused} label="Punch" />
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
  );
}

const styles = StyleSheet.create({
  tabBar: {
    height: Platform.OS === 'ios' ? 84 : 68,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 12,
    paddingBottom: Platform.OS === 'ios' ? 22 : 8,
    paddingTop: 6,
  }
});

const tabStyles = StyleSheet.create({
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 64,
  },
  iconWrapper: {
    width: 44,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  activePill: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#FDE8EA',
    borderRadius: 15,
  },
  label: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 2,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  labelActive: {
    color: Colors.primary,
    fontWeight: '800',
  }
});
