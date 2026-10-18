import React, { useEffect, useState } from 'react';
import { Redirect } from 'expo-router';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { getSession } from '../src/services/auth';

export default function Index() {
  const [targetRoute, setTargetRoute] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    getSession().then(session => {
      if (!isMounted) return;
      if (session && session.user) {
        setTargetRoute('/(tabs)');
      } else {
        setTargetRoute('/(auth)/login');
      }
    }).catch(() => {
      if (isMounted) setTargetRoute('/(auth)/login');
    });

    return () => {
      isMounted = false;
    };
  }, []);

  if (!targetRoute) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#E53935" />
      </View>
    );
  }

  return <Redirect href={targetRoute as any} />;
}


const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: '#4A0611',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
