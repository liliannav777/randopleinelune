import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AdminAuthProvider } from '@/lib/adminAuth';
import { MyReservationsProvider } from '@/lib/myReservations';
import '@/lib/notifications';
import { colors } from '@/theme';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AdminAuthProvider>
        <MyReservationsProvider>
          <StatusBar style="light" />
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }} />
        </MyReservationsProvider>
      </AdminAuthProvider>
    </SafeAreaProvider>
  );
}
