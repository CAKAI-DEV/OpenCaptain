import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { Header } from '@/components/common/header';
import { Sidebar } from '@/components/common/sidebar';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const token = cookieStore.get('access_token');

  // Double-check auth (middleware should catch this first)
  if (!token) {
    redirect('/login');
  }

  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-6 bg-background">{children}</main>
      </div>
    </div>
  );
}
