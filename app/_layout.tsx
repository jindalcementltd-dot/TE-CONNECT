import React from 'react';
import { Stack } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Toast from 'react-native-toast-message';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';

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
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="slab/add" options={{ presentation: 'modal' }} />
          <Stack.Screen name="slab/[id]" options={{ presentation: 'modal' }} />
          <Stack.Screen name="sale/add" options={{ presentation: 'modal' }} />
          <Stack.Screen name="meeting/add" options={{ presentation: 'modal' }} />
          <Stack.Screen name="meeting/[id]" options={{ presentation: 'modal' }} />
          <Stack.Screen name="dealer/[id]" />
          <Stack.Screen name="admin/index" />
          <Stack.Screen name="public/quick" options={{ headerShown: false }} />
          <Stack.Screen name="public/slab" options={{ headerShown: false }} />
          <Stack.Screen name="public/meeting" options={{ headerShown: false }} />
        </Stack>
        <Toast />
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
