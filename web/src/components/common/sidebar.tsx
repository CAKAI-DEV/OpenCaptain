'use client';

import {
  BarChart3,
  Bot,
  Clock,
  KanbanSquare,
  LayoutDashboard,
  Lightbulb,
  Link2,
  List,
  Package,
  Settings,
  Users,
  Workflow,
} from 'lucide-react';
import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

export function Sidebar() {
  const pathname = usePathname();
  const params = useParams();
  const projectId = params.projectId as string | undefined;

  const mainNav = projectId
    ? [
        { name: 'Overview', href: `/projects/${projectId}`, icon: LayoutDashboard },
        { name: 'Board', href: `/projects/${projectId}/board`, icon: KanbanSquare },
        { name: 'List', href: `/projects/${projectId}/list`, icon: List },
        { name: 'Deliverables', href: `/projects/${projectId}/deliverables`, icon: Package },
        { name: 'Analytics', href: `/projects/${projectId}/analytics`, icon: BarChart3 },
      ]
    : [{ name: 'Projects', href: '/projects', icon: LayoutDashboard }];

  const projectNav = projectId
    ? [
        { name: 'Team', href: `/projects/${projectId}/team`, icon: Users },
        { name: 'Workflows', href: `/projects/${projectId}/workflows`, icon: Workflow },
        { name: 'Check-ins', href: `/projects/${projectId}/checkins`, icon: Clock },
        { name: 'Insights', href: `/projects/${projectId}/insights`, icon: Lightbulb },
        { name: 'Integrations', href: `/projects/${projectId}/integrations`, icon: Link2 },
      ]
    : [];

  const globalNav = [{ name: 'AI Chat', href: '/chat', icon: Bot }];

  return (
    <aside className="w-64 border-r bg-card h-screen flex flex-col">
      <div className="p-6">
        <h1 className="text-xl font-bold">OpenCaptain</h1>
      </div>
      <nav className="flex-1 px-4 space-y-6 overflow-y-auto">
        {/* Main Navigation */}
        <div className="space-y-1">
          {mainNav.map((item) => {
            const isActive =
              item.href === `/projects/${projectId}`
                ? pathname === item.href
                : pathname.startsWith(item.href);
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
        </div>

        {/* Project Management */}
        {projectNav.length > 0 && (
          <div>
            <p className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Management
            </p>
            <div className="space-y-1">
              {projectNav.map((item) => {
                const isActive = pathname.startsWith(item.href);
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
            </div>
          </div>
        )}

        {/* Global */}
        <div>
          <p className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Tools
          </p>
          <div className="space-y-1">
            {globalNav.map((item) => {
              const isActive = pathname.startsWith(item.href);
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
          </div>
        </div>
      </nav>
      <div className="p-4 border-t">
        <Link
          href="/settings"
          className={cn(
            'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
            pathname.startsWith('/settings')
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
          )}
        >
          <Settings className="h-4 w-4" />
          Settings
        </Link>
      </div>
    </aside>
  );
}
