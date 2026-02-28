import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { parseCents } from '@/lib/cents';

interface InvoiceFormProps {
  onSubmit: (data: {
    amountCents: number;
    currency: string;
    eurEquivalentCents: number;
  }) => void;
}

export function InvoiceForm({ onSubmit }: InvoiceFormProps) {
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('');
  const [eurEquivalent, setEurEquivalent] = useState('');

  const [errors, setErrors] = useState({
    amount: false,
    currency: false,
    eurEquivalent: false,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const newErrors = {
      amount: amount.trim() === '',
      currency: currency.trim() === '',
      eurEquivalent: eurEquivalent.trim() === '',
    };
    setErrors(newErrors);

    if (newErrors.amount || newErrors.currency || newErrors.eurEquivalent) {
      return;
    }

    const amountCents = parseCents(amount);
    const eurEquivalentCents = parseCents(eurEquivalent);

    onSubmit({
      amountCents,
      currency: currency.trim(),
      eurEquivalentCents,
    });

    setAmount('');
    setCurrency('');
    setEurEquivalent('');
    setErrors({ amount: false, currency: false, eurEquivalent: false });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-1.5">
        <label htmlFor="amount" className="block text-sm font-medium text-foreground">
          Invoice Amount
        </label>
        <Input
          id="amount"
          type="text"
          placeholder="2000.00"
          value={amount}
          onChange={e => setAmount(e.target.value)}
          aria-invalid={errors.amount}
        />
        {errors.amount && (
          <p className="text-sm text-destructive">Invoice amount is required.</p>
        )}
      </div>

      <div className="space-y-1.5">
        <label htmlFor="currency" className="block text-sm font-medium text-foreground">
          Currency
        </label>
        <Input
          id="currency"
          type="text"
          placeholder="EUR"
          value={currency}
          onChange={e => setCurrency(e.target.value)}
          aria-invalid={errors.currency}
        />
        {errors.currency && (
          <p className="text-sm text-destructive">Currency is required.</p>
        )}
      </div>

      <div className="space-y-1.5">
        <label htmlFor="eurEquivalent" className="block text-sm font-medium text-foreground">
          EUR Equivalent
        </label>
        <Input
          id="eurEquivalent"
          type="text"
          placeholder="2000.00"
          value={eurEquivalent}
          onChange={e => setEurEquivalent(e.target.value)}
          aria-invalid={errors.eurEquivalent}
        />
        {errors.eurEquivalent && (
          <p className="text-sm text-destructive">EUR equivalent is required.</p>
        )}
      </div>

      <Button type="submit" className="w-full">
        Calculate Allocation
      </Button>
    </form>
  );
}
