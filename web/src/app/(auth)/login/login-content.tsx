'use client';

import { useState } from 'react';
import { LoginForm } from './login-form';

const SEED_ACCOUNTS = [
  { email: 'admin@acme.dev', label: 'Admin', role: 'Organization admin' },
  { email: 'pm@acme.dev', label: 'PM', role: 'Project manager' },
  { email: 'lead@acme.dev', label: 'Lead', role: 'Squad lead' },
  { email: 'dev1@acme.dev', label: 'Dev 1', role: 'Developer' },
  { email: 'dev2@acme.dev', label: 'Dev 2', role: 'Developer' },
];

interface LoginContentProps {
  callbackUrl?: string;
}

export function LoginContent({ callbackUrl }: LoginContentProps) {
  const [quickEmail, setQuickEmail] = useState<string>();

  return (
    <>
      <LoginForm callbackUrl={callbackUrl} quickEmail={quickEmail} />

      {/* Quick Login */}
      <div className="space-y-3">
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">Quick Login</span>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {SEED_ACCOUNTS.map((account) => (
            <button
              key={account.email}
              type="button"
              onClick={() => setQuickEmail(account.email)}
              className="rounded-lg border px-3 py-2 text-left text-sm transition-colors hover:bg-muted"
            >
              <div className="font-medium">{account.label}</div>
              <div className="text-xs text-muted-foreground">{account.role}</div>
            </button>
          ))}
        </div>
        <p className="text-center text-xs text-muted-foreground">
          Requires seed data. Run <code className="rounded bg-muted px-1">bun run db:seed</code>
        </p>
      </div>
    </>
  );
}
