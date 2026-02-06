import Link from 'next/link';
import { LoginForm } from './login-form';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; registered?: string }>;
}) {
  const params = await searchParams;
  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <h1 className="text-3xl font-bold">Welcome back</h1>
        <p className="text-muted-foreground">Sign in to your BlockBot account</p>
      </div>
      {params.registered && (
        <div className="rounded-md bg-green-500/10 p-3 text-center">
          <p className="text-sm text-green-600">Account created! Please sign in.</p>
        </div>
      )}
      <LoginForm callbackUrl={params.callbackUrl} />
      <p className="text-center text-sm text-muted-foreground">
        Don&apos;t have an account?{' '}
        <Link
          href="/register"
          className="font-medium underline underline-offset-4 hover:text-primary"
        >
          Sign up
        </Link>
      </p>
    </div>
  );
}
