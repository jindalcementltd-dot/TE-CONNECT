import React, { useState } from 'react';
import { View, TouchableOpacity, Text, Modal, StyleSheet, Platform, Animated } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Colors } from '../src/theme/colors';

export default function FloatingActionMenu({ scrollY }: { scrollY?: Animated.Value }) {
  const [visible, setVisible] = useState(false);

  return (
    <>
      <View style={fabStyles.wrapper}>
        <TouchableOpacity
          style={fabStyles.fab}
          onPress={() => setVisible(true)}
          activeOpacity={0.85}
        >
          <Ionicons name="add" size={36} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <Modal transparent visible={visible} animationType="fade" onRequestClose={() => setVisible(false)}>
        <TouchableOpacity style={fabStyles.overlay} onPress={() => setVisible(false)} activeOpacity={1}>
          <View style={fabStyles.container}>
            <Text style={fabStyles.title}>Quick Actions</Text>
            
            <TouchableOpacity
              style={fabStyles.option}
              onPress={() => { setVisible(false); router.push('/dealer/add'); }}
            >
              <View style={[fabStyles.optionIcon, { backgroundColor: Colors.infoLight }]}>
                <Ionicons name="storefront" size={24} color={Colors.info} />
              </View>
              <View>
                <Text style={fabStyles.optionTitle}>Add Dealer</Text>
                <Text style={fabStyles.optionSub}>Register a new dealer</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={fabStyles.option}
              onPress={() => { setVisible(false); router.push('/slab/add'); }}
            >
              <View style={[fabStyles.optionIcon, { backgroundColor: Colors.primaryLight }]}>
                <MaterialCommunityIcons name="office-building" size={24} color={Colors.primary} />
              </View>
              <View>
                <Text style={fabStyles.optionTitle}>Add Slab</Text>
                <Text style={fabStyles.optionSub}>Schedule a slab casting</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={fabStyles.option}
              onPress={() => { setVisible(false); router.push('/sale/add'); }}
            >
              <View style={[fabStyles.optionIcon, { backgroundColor: Colors.warningLight }]}>
                <MaterialCommunityIcons name="package-variant-closed" size={24} color={Colors.warning} />
              </View>
              <View>
                <Text style={fabStyles.optionTitle}>Add Sale</Text>
                <Text style={fabStyles.optionSub}>Record dealer sales entry</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={fabStyles.option}
              onPress={() => { setVisible(false); router.push('/meeting/add'); }}
            >
              <View style={[fabStyles.optionIcon, { backgroundColor: Colors.primaryLight }]}>
                <Ionicons name="people" size={24} color={Colors.primary} />
              </View>
              <View>
                <Text style={fabStyles.optionTitle}>Add Meeting</Text>
                <Text style={fabStyles.optionSub}>Plan or record a meeting</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={fabStyles.cancelBtn} onPress={() => setVisible(false)}>
              <Text style={fabStyles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const fabStyles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    zIndex: 999,
  },
  fab: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 12,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  overlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 24,
    paddingBottom: Platform.OS === 'ios' ? 44 : 24,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 20,
    textAlign: 'center',
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  optionIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  optionSub: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  cancelBtn: {
    marginTop: 20,
    alignItems: 'center',
    paddingVertical: 14,
    backgroundColor: Colors.background,
    borderRadius: 16,
  },
  cancelText: {
    fontSize: 16,
    color: Colors.primary,
    fontWeight: '600',
  },
});
