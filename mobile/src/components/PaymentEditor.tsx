import { useState } from 'react';
import { Text, View } from 'react-native';
import { adminRecordPayment } from '@/lib/api';
import { toAppError } from '@/lib/errors';
import { centsToInput, formatPrice, parseEuros } from '@/lib/format';
import type { PaymentMethod } from '@/lib/types';
import { spacing } from '@/theme';
import { Banner, Button, Chips, Field, useUiStyles } from './ui';

const METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'cash', label: 'Espèces' },
  { value: 'card', label: 'Carte' },
  { value: 'transfer', label: 'Virement' },
  { value: 'other', label: 'Autre' },
];

/** Enregistrement du paiement sur place (montant reçu, moyen de paiement). */
export function PaymentEditor({ reservationId, amountDue, amountPaid, onSaved }: {
  reservationId: string; amountDue: number; amountPaid: number; onSaved: () => void;
}) {
  const styles = useUiStyles();
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [amount, setAmount] = useState(centsToInput(amountPaid > 0 ? amountPaid : amountDue));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(cents: number) {
    setBusy(true);
    setError(null);
    try {
      await adminRecordPayment(reservationId, cents, cents > 0 ? method : null);
      onSaved();
    } catch (e) {
      setError(toAppError(e).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={{ gap: spacing.sm }}>
      <Text style={styles.fieldLabel}>Montant dû : {formatPrice(amountDue)}</Text>
      <Chips options={METHODS} value={method} onChange={setMethod} />
      <Field label="Montant reçu (€)" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
      {error ? <Banner message={error} /> : null}
      <Button title="Marquer comme payé" loading={busy} onPress={() => save(amountDue)} />
      <Button variant="secondary" title="Enregistrer le montant saisi" disabled={busy}
        onPress={() => {
          const cents = parseEuros(amount);
          if (cents == null) setError('Montant invalide.');
          else save(cents);
        }} />
      {amountPaid > 0 ? <Button variant="ghost" title="Remettre à « non réglé »" disabled={busy} onPress={() => save(0)} /> : null}
    </View>
  );
}
