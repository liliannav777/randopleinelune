import { useRouter } from 'expo-router';
import { EventCard } from '@/components/EventCard';
import { Banner, Body, Button, Empty, Header, Loading, Screen } from '@/components/ui';
import { listUpcomingEvents } from '@/lib/api';
import { useFocusData } from '@/lib/useAsync';

export default function HikeList() {
  const router = useRouter();
  const { data, error, loading, refreshing, refresh } = useFocusData(listUpcomingEvents);
  const count = data?.filter((e) => e.status === 'published').length ?? 0;

  return (
    <Screen header={<Header title="Randonnées" subtitle="Sorties à venir" seed="liste" />}
      refreshing={refreshing} onRefresh={refresh}>
      {error ? <Banner message={error.message} /> : null}
      {loading && !data ? <Loading /> : null}
      {data && data.length > 0 ? (
        <Body muted>{count} sortie{count > 1 ? 's' : ''} ouverte{count > 1 ? 's' : ''} à la réservation</Body>
      ) : null}
      {data?.length === 0 ? (
        <Empty title="Aucune sortie programmée" message="Les prochaines randonnées seront annoncées ici très bientôt."
          action={<Button variant="secondary" icon="images-outline" title="Voir la galerie" onPress={() => router.push('/galerie')} />} />
      ) : null}
      {data?.map((e) => <EventCard key={e.id} event={e} onPress={() => router.push(`/randonnees/${e.id}`)} />)}
    </Screen>
  );
}
