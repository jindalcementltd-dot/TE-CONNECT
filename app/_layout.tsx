import 'react-native-gesture-handler';
import React, { useState, useEffect } from 'react';
import { Stack } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Toast from 'react-native-toast-message';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator } from 'react-native';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import {
  Sen_400Regular,
  Sen_500Medium,
  Sen_600SemiBold,
  Sen_700Bold,
} from '@expo-google-fonts/sen';
import {
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
} from '@expo-google-fonts/poppins';

import { UndoProvider } from '../src/context/UndoContext';
import { getUser } from '../src/services/auth';
import { registerPushNotifications } from '../src/services/fcmPush';
import { setupAndroidNotificationChannel, requestAppNotificationPermission } from '../src/services/notifications';
import ErrorBoundary from '../components/ErrorBoundary';

SplashScreen.preventAutoHideAsync().catch(() => {});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 5 * 1000, // 5 seconds
      refetchOnWindowFocus: true,
      refetchOnMount: 'always',
    },
  },
});

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Sen_400Regular,
    Sen_500Medium,
    Sen_600SemiBold,
    Sen_700Bold,
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
  });

  const [forceReady, setForceReady] = useState(false);

  useEffect(() => {
    // Setup Android notification channel and ask permission
    setupAndroidNotificationChannel().catch(() => {});
    requestAppNotificationPermission().catch(() => {});

    // Failsafe timeout: After 1.2s, always let the app render even if fonts are delayed or offline
    const timer = setTimeout(() => {
      setForceReady(true);
    }, 1200);

    try {
      getUser().then(u => {
        registerPushNotifications(u).catch(() => {});
      }).catch(() => {});
    } catch {}

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (fontsLoaded || fontError || forceReady) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded, fontError, forceReady]);

  if (!fontsLoaded && !fontError && !forceReady) {
    return (
      <View style={{ flex: 1, backgroundColor: '#4A0611', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#E53935" />
      </View>
    );
  }

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <QueryClientProvider client={queryClient}>
          <UndoProvider>
            <StatusBar style="light" />
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="index" options={{ headerShown: false }} />
              <Stack.Screen name="(auth)" options={{ headerShown: false }} />
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="profile" options={{ headerShown: false }} />
              <Stack.Screen name="notifications" options={{ headerShown: false }} />
              <Stack.Screen name="slab/add" options={{ presentation: 'modal' }} />
              <Stack.Screen name="slab/[id]" options={{ presentation: 'modal' }} />
              <Stack.Screen name="sale/add" options={{ presentation: 'modal' }} />
              <Stack.Screen name="sale/scan" options={{ presentation: 'modal' }} />
              <Stack.Screen name="punch/add" options={{ presentation: 'modal' }} />
              <Stack.Screen name="meeting/add" options={{ presentation: 'modal' }} />
              <Stack.Screen name="meeting/[id]" options={{ presentation: 'modal' }} />
              <Stack.Screen name="dealer/[id]" />
              <Stack.Screen name="dealer/add" options={{ presentation: 'modal' }} />
              <Stack.Screen name="admin/index" />
              <Stack.Screen name="public/quick" options={{ headerShown: false }} />
              <Stack.Screen name="public/slab" options={{ headerShown: false }} />
              <Stack.Screen name="public/meeting" options={{ headerShown: false }} />
            </Stack>
            <Toast />
          </UndoProvider>
        </QueryClientProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
