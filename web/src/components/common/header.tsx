'use client';

import { UserMenu } from './user-menu';

interface HeaderProps {
  userEmail?: string;
  projectId?: string;
}

export function Header({ userEmail, projectId }: HeaderProps) {
  return (
    <header className="h-14 border-b bg-card flex items-center justify-between px-6">
      <div className="flex items-center gap-4">
        {/* Project selector will be added here when on project routes */}
        {projectId && <span className="text-sm text-muted-foreground">Project context active</span>}
      </div>
      <div className="flex items-center gap-4">
        <UserMenu userEmail={userEmail} />
      </div>
    </header>
  );
}
