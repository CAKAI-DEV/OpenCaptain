'use client';

import { useParams } from 'next/navigation';
import { NotificationBell } from './notification-bell';
import { ProjectSelector } from './project-selector';
import { UserMenu } from './user-menu';

export function Header() {
  const params = useParams();
  const projectId = params.projectId as string | undefined;

  return (
    <header className="h-14 border-b bg-card flex items-center justify-between px-6">
      <div className="flex items-center gap-4">{projectId && <ProjectSelector />}</div>
      <div className="flex items-center gap-2">
        <NotificationBell />
        <UserMenu />
      </div>
    </header>
  );
}
