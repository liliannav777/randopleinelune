import { useRouter } from 'expo-router';
import { EventCard } from '@/components/EventCard';
import { Banner, Button, Empty, Header, Loading, Screen } from '@/components/ui';
import { listUpcomingEvents } from '@/lib/api';
import { useFocusData } from '@/lib/useAsync';

export default function HikeList() {
  const router = useRouter();
  const { data, error, loading, refreshing, refresh } = useFocusData(listUpcomingEvents);

  return (
    <Screen header={<Header title="Randonnées" subtitle="Sorties à venir" onBack={() => router.back()} />}
      refreshing={refreshing} onRefresh={refresh}>
      {error ? <Banner message={error.message} /> : null}
      {loading && !data ? <Loading /> : null}
      {data?.length === 0 ? (
        <Empty title="Aucune sortie programmée" message="Les prochaines randonnées seront annoncées ici très bientôt."
          action={<Button variant="secondary" title="Voir la galerie" onPress={() => router.push('/galerie')} />} />
      ) : null}
      {data?.map((e) => <EventCard key={e.id} event={e} onPress={() => router.push(`/randonnees/${e.id}`)} />)}
    </Screen>
  );
}
