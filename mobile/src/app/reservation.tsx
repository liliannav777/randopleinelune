// Lien profond reçu par e-mail : randopleinelune://reservation?token=...
// Ajoute la réservation à l'espace personnel de cet appareil.
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Banner, Button, Header, Loading, Screen } from '@/components/ui';
import { getReservations } from '@/lib/api';
import { toAppError } from '@/lib/errors';
import { useMyReservations } from '@/lib/myReservations';

export default function OpenReservationLink() {
  const { token } = useLocalSearchParams<{ token?: string }>();
  const router = useRouter();
  const { addToken, upsert } = useMyReservations();
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (!token) return;
    (async () => {
      try {
        const [r] = await getReservations([token]);
        if (!r) throw new Error();
        upsert(r);
        await addToken(token);
        router.replace(`/mes-reservations/${r.id}`);
      } catch (e) {
        const err = toAppError(e);
        setError(err.code === 'UNKNOWN' ? 'Réservation introuvable. Le lien est peut-être incomplet.' : err.message);
      }
    })();
  }, [token, addToken, upsert, router]);

  return (
    <Screen header={<Header title="Ma réservation" onBack={() => router.replace('/')} />}>
      {error || !token ? (
        <>
          <Banner message={error ?? 'Lien incomplet.'} />
          <Button title="Retour à l'accueil" onPress={() => router.replace('/')} />
        </>
      ) : <Loading />}
    </Screen>
  );
}
