import { useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform } from 'react-native';
import { Banner, Body, Button, Field, Header, Screen } from '@/components/ui';
import { useAdminAuth } from '@/lib/adminAuth';

type Mode = 'login' | 'forgot' | 'reset';

export default function AdminLogin() {
  const router = useRouter();
  const { signIn, resetPassword, completePasswordReset } = useAdminAuth();
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [message, setMessage] = useState<{ text: string; tone: 'danger' | 'success' } | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setMessage(null);
    try {
      await fn();
    } catch (e) {
      setMessage({ text: (e as Error).message, tone: 'danger' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen header={<Header title="Administration" subtitle="Espace organisateur" onBack={() => router.replace('/')} />}>
        {message ? <Banner message={message.text} tone={message.tone} /> : null}
        <Field label="Adresse e-mail" value={email} onChangeText={setEmail} keyboardType="email-address"
          autoCapitalize="none" autoComplete="email" textContentType="username" />

        {mode === 'login' ? (
          <>
            <Field label="Mot de passe" value={password} onChangeText={setPassword} secureTextEntry
              autoComplete="current-password" textContentType="password" onSubmitEditing={() => run(() => signIn(email, password))} />
            <Button title="Se connecter" loading={busy} disabled={!email || !password}
              onPress={() => run(() => signIn(email, password))} />
            <Button variant="ghost" title="Mot de passe oublié ?" onPress={() => { setMode('forgot'); setMessage(null); }} />
          </>
        ) : null}

        {mode === 'forgot' ? (
          <>
            <Body muted>Un code de récupération sera envoyé à cette adresse si elle correspond à un compte administrateur.</Body>
            <Button title="Recevoir un code" loading={busy} disabled={!email}
              onPress={() => run(async () => {
                await resetPassword(email);
                setMode('reset');
                setMessage({ text: 'Code envoyé. Consultez votre boîte e-mail.', tone: 'success' });
              })} />
            <Button variant="ghost" title="Retour à la connexion" onPress={() => setMode('login')} />
          </>
        ) : null}

        {mode === 'reset' ? (
          <>
            <Field label="Code reçu par e-mail" value={code} onChangeText={setCode} keyboardType="number-pad"
              autoComplete="one-time-code" textContentType="oneTimeCode" />
            <Field label="Nouveau mot de passe" value={password} onChangeText={setPassword} secureTextEntry
              autoComplete="new-password" textContentType="newPassword" hint="12 caractères minimum." />
            <Button title="Enregistrer le mot de passe" loading={busy} disabled={!code || !password}
              onPress={() => run(async () => {
                await completePasswordReset(email, code, password);
                setMode('login');
                setMessage({ text: 'Mot de passe modifié.', tone: 'success' });
              })} />
          </>
        ) : null}
      </Screen>
    </KeyboardAvoidingView>
  );
}
