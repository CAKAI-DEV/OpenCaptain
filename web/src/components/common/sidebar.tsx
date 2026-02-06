'use client';

import { BarChart3, KanbanSquare, LayoutDashboard, List, Settings, Workflow } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

interface SidebarProps {
  projectId?: string;
}

export function Sidebar({ projectId }: SidebarProps) {
  const pathname = usePathname();

  const navigation = projectId
    ? [
        { name: 'Overview', href: `/projects/${projectId}`, icon: LayoutDashboard },
        { name: 'Board', href: `/projects/${projectId}/board`, icon: KanbanSquare },
        { name: 'List', href: `/projects/${projectId}/list`, icon: List },
        { name: 'Analytics', href: `/projects/${projectId}/analytics`, icon: BarChart3 },
        { name: 'Workflows', href: `/projects/${projectId}/workflows`, icon: Workflow },
      ]
    : [{ name: 'Dashboard', href: '/', icon: LayoutDashboard }];

  return (
    <aside className="w-64 border-r bg-card h-screen flex flex-col">
      <div className="p-6">
        <h1 className="text-xl font-bold">BlockBot</h1>
      </div>
      <nav className="flex-1 px-4 space-y-1">
        {navigation.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.name}
            </Link>
          );
        })}
      </nav>
      <div className="p-4 border-t">
        <Link
          href="/settings"
          className="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <Settings className="h-4 w-4" />
          Settings
        </Link>
      </div>
    </aside>
  );
}
