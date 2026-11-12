// Espace personnel sans compte : l'appareil conserve les jetons d'accès des
// réservations (stockage chiffré). Le lien reçu par e-mail permet de retrouver
// une réservation sur un autre appareil.
import * as SecureStore from 'expo-secure-store';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';
import { getReservations } from './api';
import type { Reservation } from './types';

const KEY = 'rpl.reservation_tokens';
const MAX_TOKENS = 40;

async function readTokens(): Promise<string[]> {
  try {
    const raw = Platform.OS === 'web' ? globalThis.localStorage?.getItem(KEY) : await SecureStore.getItemAsync(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((t) => typeof t === 'string') : [];
  } catch {
    return [];
  }
}

async function writeTokens(tokens: string[]): Promise<void> {
  const value = JSON.stringify(tokens.slice(-MAX_TOKENS));
  if (Platform.OS === 'web') globalThis.localStorage?.setItem(KEY, value);
  else await SecureStore.setItemAsync(KEY, value);
}

type Ctx = {
  reservations: Reservation[];
  loading: boolean;
  error: unknown;
  refresh: () => Promise<void>;
  addToken: (token: string) => Promise<void>;
  /** Met à jour une réservation localement (après création ou annulation). */
  upsert: (r: Reservation) => void;
  tokens: string[];
};

const MyReservationsContext = createContext<Ctx | null>(null);

export function MyReservationsProvider({ children }: { children: ReactNode }) {
  const [tokens, setTokens] = useState<string[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);

  const load = useCallback(async (list: string[]) => {
    setLoading(true);
    setError(null);
    try {
      setReservations(await getReservations(list));
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    readTokens().then((t) => {
      setTokens(t);
      return load(t);
    });
  }, [load]);

  const addToken = useCallback(async (token: string) => {
    const current = await readTokens();
    if (!current.includes(token)) {
      const next = [...current, token];
      await writeTokens(next);
      setTokens(next);
      await load(next);
    }
  }, [load]);

  const upsert = useCallback((r: Reservation) => {
    setReservations((prev) => {
      const others = prev.filter((x) => x.id !== r.id);
      return [...others, r].sort((a, b) => a.event.starts_at.localeCompare(b.event.starts_at));
    });
  }, []);

  const value = useMemo<Ctx>(() => ({
    reservations, loading, error, tokens, addToken, upsert, refresh: () => load(tokens),
  }), [reservations, loading, error, tokens, addToken, upsert, load]);

  return <MyReservationsContext.Provider value={value}>{children}</MyReservationsContext.Provider>;
}

export function useMyReservations(): Ctx {
  const ctx = useContext(MyReservationsContext);
  if (!ctx) throw new Error('useMyReservations hors MyReservationsProvider');
  return ctx;
}
