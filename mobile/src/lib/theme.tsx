// Thème clair / sombre : suit le réglage du téléphone, ou un choix forcé
// (mémorisé sur l'appareil).
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SystemUI from 'expo-system-ui';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { darkColors, lightColors, shadow as baseShadow, type Colors } from '@/theme';

export type ThemePreference = 'system' | 'light' | 'dark';
const KEY = 'rpl.theme';

type Ctx = {
  colors: Colors;
  scheme: 'light' | 'dark';
  preference: ThemePreference;
  setPreference: (p: ThemePreference) => void;
};

const ThemeContext = createContext<Ctx>({
  colors: lightColors, scheme: 'light', preference: 'system', setPreference: () => undefined,
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [preference, setPref] = useState<ThemePreference>('system');

  useEffect(() => {
    AsyncStorage.getItem(KEY).then((v) => {
      if (v === 'light' || v === 'dark' || v === 'system') setPref(v);
    }).catch(() => undefined);
  }, []);

  const setPreference = useCallback((p: ThemePreference) => {
    setPref(p);
    AsyncStorage.setItem(KEY, p).catch(() => undefined);
  }, []);

  const scheme: 'light' | 'dark' = preference === 'system' ? (system === 'dark' ? 'dark' : 'light') : preference;
  const colors = scheme === 'dark' ? darkColors : lightColors;

  useEffect(() => {
    SystemUI.setBackgroundColorAsync(colors.background).catch(() => undefined);
  }, [colors.background]);

  const value = useMemo(() => ({ colors, scheme, preference, setPreference }), [colors, scheme, preference, setPreference]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Ctx {
  return useContext(ThemeContext);
}

export function useColors(): Colors {
  return useContext(ThemeContext).colors;
}

const cache = new WeakMap<object, Map<Colors, unknown>>();

/** Styles dépendant de la palette, recalculés uniquement au changement de thème. */
export function useStyles<T>(factory: (c: Colors) => T): T {
  const colors = useColors();
  let byColors = cache.get(factory);
  if (!byColors) {
    byColors = new Map();
    cache.set(factory, byColors);
  }
  if (!byColors.has(colors)) byColors.set(colors, factory(colors));
  return byColors.get(colors) as T;
}

/** Ombre adaptée au thème. */
export function useShadow() {
  const colors = useColors();
  return useCallback((level: 1 | 2 | 3 = 1) => baseShadow(level, colors.shadow), [colors.shadow]);
}
