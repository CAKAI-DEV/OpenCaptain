'use client';

import { Loader2 } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';

function MagicLinkVerifier() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    async function verifyToken() {
      if (!token) {
        setStatus('error');
        setErrorMessage('No token provided. Please check your magic link.');
        return;
      }

      try {
        const response = await fetch(
          `/api/auth/magic-link/verify?token=${encodeURIComponent(token)}`
        );

        if (response.ok) {
          setStatus('success');
          // Redirect to dashboard after short delay
          setTimeout(() => {
            router.push('/');
            router.refresh();
          }, 1500);
        } else {
          const data = await response.json();
          setStatus('error');
          setErrorMessage(data.detail || 'This magic link is invalid or has expired.');
        }
      } catch {
        setStatus('error');
        setErrorMessage('An error occurred. Please try again.');
      }
    }

    verifyToken();
  }, [token, router]);

  return (
    <div className="space-y-6 text-center">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">Magic Link</h1>
      </div>

      {status === 'loading' && (
        <div className="flex flex-col items-center gap-4 py-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Verifying your magic link...</p>
        </div>
      )}

      {status === 'success' && (
        <div className="rounded-lg border bg-green-50 p-6 dark:bg-green-950/20">
          <h2 className="text-lg font-semibold text-green-600 dark:text-green-400">
            Successfully signed in!
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">Redirecting you to the dashboard...</p>
        </div>
      )}

      {status === 'error' && (
        <div className="space-y-4">
          <div className="rounded-lg border bg-destructive/10 p-6">
            <h2 className="text-lg font-semibold text-destructive">Verification Failed</h2>
            <p className="mt-2 text-sm text-muted-foreground">{errorMessage}</p>
          </div>
          <Button onClick={() => router.push('/login')}>Back to Login</Button>
        </div>
      )}
    </div>
  );
}

export default function MagicLinkPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col items-center gap-4 py-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      }
    >
      <MagicLinkVerifier />
    </Suspense>
  );
}
