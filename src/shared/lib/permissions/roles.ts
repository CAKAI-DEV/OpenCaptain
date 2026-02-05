export const CAPABILITIES = {
  manage_org: 'Manage organization settings and users',
  manage_users: 'Invite and remove users',
  manage_projects: 'Create and configure projects',
  manage_project: 'Manage a specific project',
  manage_squads: 'Create and configure squads',
  manage_squad: 'Manage own squad members',
  view_all: 'View all project data',
  view_squad: 'View own squad data',
  view_own: 'View own work items',
  grant_visibility: 'Grant cross-squad visibility',
  assign_work: 'Assign work to squad members',
  update_own_work: 'Update own work items',
} as const;

export type Capability = keyof typeof CAPABILITIES;

export const PREDEFINED_ROLES = {
  admin: {
    tier: 0,
    name: 'Admin',
    capabilities: ['manage_org', 'manage_users', 'manage_projects', 'view_all'] as Capability[],
  },
  pm: {
    tier: 1,
    name: 'Project Manager',
    capabilities: [
      'manage_project',
      'manage_squads',
      'view_all',
      'grant_visibility',
    ] as Capability[],
  },
  squad_lead: {
    tier: 2,
    name: 'Squad Lead',
    capabilities: ['manage_squad', 'view_squad', 'assign_work'] as Capability[],
  },
  member: {
    tier: 3,
    name: 'Member',
    capabilities: ['view_own', 'update_own_work'] as Capability[],
  },
} as const;

export type RoleId = keyof typeof PREDEFINED_ROLES;

export function getRoleTier(role: string): number {
  return PREDEFINED_ROLES[role as RoleId]?.tier ?? 999;
}

export function hasCapability(role: string, capability: string): boolean {
  const roleDef = PREDEFINED_ROLES[role as RoleId];
  return roleDef?.capabilities.includes(capability as Capability) ?? false;
}

export function isValidRole(role: string): role is RoleId {
  return role in PREDEFINED_ROLES;
}
