import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import { apiLogin } from './api';
import { AuthSession, User } from '../types';

const SESSION_KEY = 'teconnect_session';

async function setStorageItem(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    await AsyncStorage.setItem(key, value);
  } else {
    try {
      await SecureStore.setItemAsync(key, value);
    } catch {
      await AsyncStorage.setItem(key, value);
    }
  }
}

async function getStorageItem(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    return AsyncStorage.getItem(key);
  } else {
    try {
      return await SecureStore.getItemAsync(key);
    } catch {
      return AsyncStorage.getItem(key);
    }
  }
}

async function removeStorageItem(key: string): Promise<void> {
  if (Platform.OS === 'web') {
    await AsyncStorage.removeItem(key);
  } else {
    try {
      await SecureStore.deleteItemAsync(key);
    } catch {
      await AsyncStorage.removeItem(key);
    }
  }
}

export async function hashPassword(password: string): Promise<string> {
  try {
    const hash = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      password
    );
    return hash;
  } catch (e) {
    // Basic fallback if crypto fails
    return password;
  }
}

export async function login(login_id: string, password: string): Promise<{ user: User; token: string }> {
  const hashed = await hashPassword(password);
  const result = await apiLogin(login_id, hashed);
  if (!result.success || !result.data) {
    throw new Error(result.message || 'Login failed');
  }
  const session: AuthSession = {
    user: result.data.user,
    token: result.data.token,
    loggedInAt: new Date().toISOString(),
  };
  await setStorageItem(SESSION_KEY, JSON.stringify(session));
  return result.data;
}

export async function getSession(): Promise<AuthSession | null> {
  try {
    const raw = await getStorageItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AuthSession;
  } catch {
    return null;
  }
}

export async function getUser(): Promise<User | null> {
  const session = await getSession();
  return session?.user ?? null;
}

export async function logout(): Promise<void> {
  await removeStorageItem(SESSION_KEY);
}

export async function isLoggedIn(): Promise<boolean> {
  const session = await getSession();
  return session !== null;
}
