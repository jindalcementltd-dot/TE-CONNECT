import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import { apiLogin } from './api';
import { AuthSession, User } from '../types';

const SESSION_KEY = 'teconnect_session';

export async function hashPassword(password: string): Promise<string> {
  const hash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    password
  );
  return hash;
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
  await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session));
  return result.data;
}

export async function getSession(): Promise<AuthSession | null> {
  try {
    const raw = await SecureStore.getItemAsync(SESSION_KEY);
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
  await SecureStore.deleteItemAsync(SESSION_KEY);
}

export async function isLoggedIn(): Promise<boolean> {
  const session = await getSession();
  return session !== null;
}
