import type { Session } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { isAdmin } from './api';
import { supabase } from './supabase';

type Ctx = {
  session: Session | null;
  isAdmin: boolean;
  ready: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  /** Envoie un code de récupération à 6 chiffres par e-mail. */
  resetPassword: (email: string) => Promise<void>;
  /** Vérifie le code reçu puis enregistre le nouveau mot de passe. */
  completePasswordReset: (email: string, code: string, newPassword: string) => Promise<void>;
};

const AdminAuthContext = createContext<Ctx | null>(null);

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [admin, setAdmin] = useState(false);
  const [ready, setReady] = useState(false);

  const evaluate = useCallback(async (s: Session | null) => {
    setSession(s);
    if (!s) {
      setAdmin(false);
      setReady(true);
      return;
    }
    try {
      // Le rôle est vérifié côté serveur ; l'application ne fait qu'adapter l'affichage.
      setAdmin(await isAdmin());
    } catch {
      setAdmin(false);
    }
    setReady(true);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => evaluate(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      // Ne pas appeler Supabase de façon synchrone dans ce callback.
      setTimeout(() => evaluate(s), 0);
    });
    return () => sub.subscription.unsubscribe();
  }, [evaluate]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) throw new Error('Identifiants incorrects.');
    const ok = await isAdmin().catch(() => false);
    if (!ok) {
      await supabase.auth.signOut();
      throw new Error("Ce compte n'a pas accès à l'administration.");
    }
    await evaluate(data.session);
  }, [evaluate]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
    if (error) throw new Error("L'e-mail de réinitialisation n'a pas pu être envoyé.");
  }, []);

  const completePasswordReset = useCallback(async (email: string, code: string, newPassword: string) => {
    if (newPassword.length < 12) throw new Error('Le mot de passe doit contenir au moins 12 caractères.');
    const { error } = await supabase.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'recovery' });
    if (error) throw new Error('Code invalide ou expiré.');
    const { error: upd } = await supabase.auth.updateUser({ password: newPassword });
    if (upd) throw new Error("Le mot de passe n'a pas pu être modifié.");
  }, []);

  const value = useMemo(() => ({ session, isAdmin: admin, ready, signIn, signOut, resetPassword, completePasswordReset }),
    [session, admin, ready, signIn, signOut, resetPassword, completePasswordReset]);
  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>;
}

export function useAdminAuth(): Ctx {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) throw new Error('useAdminAuth hors AdminAuthProvider');
  return ctx;
}
