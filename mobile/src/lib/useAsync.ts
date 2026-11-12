import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toAppError, type AppError } from './errors';

/**
 * Charge des données à chaque affichage de l'écran, avec rafraîchissement manuel.
 * `deps` : valeurs dont dépend le chargement (identifiant, filtre…).
 */
export function useFocusData<T>(loader: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<AppError | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const loaderRef = useRef(loader);
  useEffect(() => { loaderRef.current = loader; });
  const key = JSON.stringify(deps);

  const run = useCallback(async (isRefresh: boolean) => {
    if (isRefresh) setRefreshing(true);
    try {
      setData(await loaderRef.current());
      setError(null);
    } catch (e) {
      setError(toAppError(e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useFocusEffect(useCallback(() => { run(false); }, [run, key]));

  return { data, error, loading, refreshing, refresh: () => run(true), setData };
}
