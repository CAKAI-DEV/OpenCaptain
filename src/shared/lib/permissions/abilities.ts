import { AbilityBuilder, PureAbility, type SubjectRawRule } from '@casl/ability';

type Actions = 'create' | 'read' | 'update' | 'delete' | 'manage';
type Subjects = 'Project' | 'Squad' | 'User' | 'WorkItem' | 'all';

// Using PureAbility with generic conditions for flexibility
export type AppAbility = PureAbility<[Actions, Subjects], { [key: string]: unknown }>;

export interface UserContext {
  id: string;
  orgId: string;
  projectRoles: Array<{ projectId: string; role: string }>;
  squadMemberships: Array<{ squadId: string; isLead: boolean }>;
  visibilityGrants: Array<{ squadId: string }>;
  restrictedToSquad: boolean; // From user settings
}

type AppRawRule = SubjectRawRule<Actions, Subjects, { [key: string]: unknown }>;

export function defineAbilitiesFor(user: UserContext): AppAbility {
  const rules: AppRawRule[] = [];

  // Org admin can do everything
  const isOrgAdmin = user.projectRoles.some((pr) => pr.role === 'admin');
  if (isOrgAdmin) {
    rules.push({ action: 'manage', subject: 'all' });
    return new PureAbility<[Actions, Subjects], { [key: string]: unknown }>(rules);
  }

  // PM has project-wide visibility (per VISB-04)
  const pmProjects = user.projectRoles.filter((pr) => pr.role === 'pm').map((pr) => pr.projectId);

  if (pmProjects.length > 0) {
    rules.push({
      action: 'read',
      subject: 'WorkItem',
      conditions: { projectId: { $in: pmProjects } },
    });
    rules.push({ action: 'read', subject: 'User', conditions: { projectId: { $in: pmProjects } } });
    rules.push({
      action: 'read',
      subject: 'Squad',
      conditions: { projectId: { $in: pmProjects } },
    });
  }

  // If not restricted to squad, user sees full project (default per CONTEXT)
  if (!user.restrictedToSquad) {
    const allProjects = user.projectRoles.map((pr) => pr.projectId);
    if (allProjects.length > 0) {
      rules.push({
        action: 'read',
        subject: 'WorkItem',
        conditions: { projectId: { $in: allProjects } },
      });
      rules.push({
        action: 'read',
        subject: 'User',
        conditions: { projectId: { $in: allProjects } },
      });
      rules.push({
        action: 'read',
        subject: 'Squad',
        conditions: { projectId: { $in: allProjects } },
      });
    }
  } else {
    // Restricted: Only see own squads + granted squads
    const leadSquads = user.squadMemberships.filter((sm) => sm.isLead).map((sm) => sm.squadId);
    const memberSquads = user.squadMemberships.map((sm) => sm.squadId);
    const grantedSquads = user.visibilityGrants.map((vg) => vg.squadId);
    const visibleSquads = [...new Set([...leadSquads, ...memberSquads, ...grantedSquads])];

    if (visibleSquads.length > 0) {
      rules.push({
        action: 'read',
        subject: 'WorkItem',
        conditions: { squadId: { $in: visibleSquads } },
      });
    }
    // User names remain visible per CONTEXT decision
    const allProjects = user.projectRoles.map((pr) => pr.projectId);
    if (allProjects.length > 0) {
      rules.push({
        action: 'read',
        subject: 'User',
        conditions: { projectId: { $in: allProjects } },
      });
    }
  }

  // Squad leads can manage their squad members
  const leadSquadIds = user.squadMemberships.filter((sm) => sm.isLead).map((sm) => sm.squadId);
  if (leadSquadIds.length > 0) {
    rules.push({ action: 'update', subject: 'Squad', conditions: { id: { $in: leadSquadIds } } });
  }

  return new PureAbility<[Actions, Subjects], { [key: string]: unknown }>(rules);
}
