'use client';

import { NotificationBell } from './notification-bell';
import { ProjectSelector } from './project-selector';
import { UserMenu } from './user-menu';

interface HeaderProps {
  userEmail?: string;
  projectId?: string;
}

export function Header({ userEmail, projectId }: HeaderProps) {
  return (
    <header className="h-14 border-b bg-card flex items-center justify-between px-6">
      <div className="flex items-center gap-4">{projectId && <ProjectSelector />}</div>
      <div className="flex items-center gap-2">
        <NotificationBell />
        <UserMenu userEmail={userEmail} />
      </div>
    </header>
  );
}
