import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, Platform } from 'react-native';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function PublicQuickPage() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.brandRow}>
          <Text style={styles.appNameTE}>TE </Text>
          <Text style={styles.appNameCONNECT}>CONNECT</Text>
        </View>
        <Text style={styles.title}>Quick Public Submission</Text>
        <Text style={styles.sub}>Select an entry type to submit directly to Team Jajpur</Text>
      </View>

      <View style={styles.buttons}>
        <TouchableOpacity
          style={styles.bigBtn}
          onPress={() => router.push('/public/slab')}
          activeOpacity={0.85}
        >
          <View style={[styles.btnIconCircle, { backgroundColor: '#FBE8EC' }]}>
            <MaterialCommunityIcons name="office-building" size={32} color="#800E20" />
          </View>
          <Text style={styles.bigBtnTitle}>Schedule Slab Casting</Text>
          <Text style={styles.bigBtnSub}>Submit date, dealer, and site details</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.bigBtn}
          onPress={() => router.push('/public/meeting')}
          activeOpacity={0.85}
        >
          <View style={[styles.btnIconCircle, { backgroundColor: '#FFEDD5' }]}>
            <MaterialCommunityIcons name="account-group" size={32} color="#C2410C" />
          </View>
          <Text style={styles.bigBtnTitle}>Report Field Meeting</Text>
          <Text style={styles.bigBtnSub}>Customer or contractor meet submission</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.footer}>Encrypted & Synced directly to ACC Team Jajpur Google Sheet</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9F5F6',
    paddingHorizontal: 20,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 36,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  appNameTE: {
    fontSize: 26,
    fontWeight: '900',
    color: '#1F0B10',
    letterSpacing: 1,
  },
  appNameCONNECT: {
    fontSize: 26,
    fontWeight: '900',
    color: '#800E20',
    letterSpacing: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1F0B10',
    marginTop: 4,
  },
  sub: {
    fontSize: 13,
    color: '#8A7277',
    marginTop: 4,
    textAlign: 'center',
  },
  buttons: {
    gap: 16,
  },
  bigBtn: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: '#EEDCE1',
    padding: 24,
    alignItems: 'center',
    shadowColor: 'rgba(78, 5, 17, 0.08)',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 14,
    elevation: 4,
  },
  btnIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  bigBtnTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1F0B10',
    marginBottom: 4,
  },
  bigBtnSub: {
    fontSize: 13,
    color: '#8A7277',
    textAlign: 'center',
  },
  footer: {
    textAlign: 'center',
    marginTop: 40,
    fontSize: 11,
    color: '#A0858C',
    fontWeight: '600',
  },
});

