import { Stack } from 'expo-router';
import { Loading } from '@/components/ui';
import { useAdminAuth } from '@/lib/adminAuth';
import { useColors } from '@/lib/theme';

// Espace protégé : sans session administrateur, seule la connexion est accessible.
// (L'application n'est qu'une interface : chaque action est revérifiée côté serveur.)
export default function AdminLayout() {
  const colors = useColors();
  const { isAdmin, ready } = useAdminAuth();
  if (!ready) return <Loading />;
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
      <Stack.Protected guard={isAdmin}>
        <Stack.Screen name="index" />
        <Stack.Screen name="sortie/[id]" />
        <Stack.Screen name="participants/[eventId]" />
        <Stack.Screen name="scanner/[eventId]" />
        <Stack.Screen name="parametres" />
      </Stack.Protected>
      <Stack.Protected guard={!isAdmin}>
        <Stack.Screen name="connexion" />
      </Stack.Protected>
    </Stack>
  );
}
