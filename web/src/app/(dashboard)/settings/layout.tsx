import Link from 'next/link';
import { cn } from '@/lib/utils';

const settingsNav = [
  { name: 'Profile', href: '/settings' },
  { name: 'Organization', href: '/settings/organization' },
  { name: 'Team', href: '/settings/team' },
  { name: 'Notifications', href: '/settings/notifications' },
];

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 overflow-hidden -m-6">
      <aside className="w-64 border-r bg-card p-6">
        <h2 className="text-lg font-semibold mb-4">Settings</h2>
        <nav className="space-y-1">
          {settingsNav.map((item) => (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'block px-3 py-2 rounded-md text-sm font-medium transition-colors',
                'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              {item.name}
            </Link>
          ))}
        </nav>
      </aside>
      <main className="flex-1 overflow-y-auto p-6 bg-background">{children}</main>
    </div>
  );
}
