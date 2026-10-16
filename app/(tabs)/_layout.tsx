import React, { useEffect, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, Platform } from 'react-native';
import { Tabs, router } from 'expo-router';
import { Colors } from '../../src/theme/colors';
import { Ionicons } from '@expo/vector-icons';
import { getSession } from '../../src/services/auth';

function TabIcon({ name, focused, label }: { name: any; focused: boolean; label: string }) {
  return (
    <View style={tabStyles.iconContainer}>
      <Ionicons 
        name={name} 
        size={24} 
        color={focused ? Colors.primary : Colors.textSecondary} 
        style={focused ? {
          textShadowColor: Colors.primary,
          textShadowOffset: { width: 0, height: 0 },
          textShadowRadius: 10,
        } : undefined}
      />
      <Text style={[tabStyles.label, focused && tabStyles.labelActive]}>
        {label}
      </Text>
    </View>
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
    height: Platform.OS === 'ios' ? 88 : 72,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    shadowColor: Colors.shadowMedium,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 10,
    paddingBottom: Platform.OS === 'ios' ? 24 : 10,
    paddingTop: 8,
  }
});

const tabStyles = StyleSheet.create({
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 4,
    fontWeight: '600',
  },
  labelActive: {
    color: Colors.primary,
    fontWeight: '700',
  }
});
