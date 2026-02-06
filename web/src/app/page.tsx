import { cookies } from 'next/headers';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Button } from '@/components/ui/button';

export default async function Home() {
  const cookieStore = await cookies();
  const token = cookieStore.get('access_token');

  // Redirect logged-in users to dashboard
  if (token) {
    redirect('/projects');
  }

  // Landing page for logged-out users
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex flex-col items-center justify-center gap-8">
        <h1 className="text-4xl font-bold tracking-tight text-black dark:text-white">BlockBot</h1>
        <p className="text-lg text-zinc-600 dark:text-zinc-400">
          AI-powered project management for teams
        </p>
        <div className="flex gap-4">
          <Link href="/login">
            <Button variant="outline">Sign In</Button>
          </Link>
          <Link href="/register">
            <Button>Get Started</Button>
          </Link>
        </div>
      </main>
    </div>
  );
}
