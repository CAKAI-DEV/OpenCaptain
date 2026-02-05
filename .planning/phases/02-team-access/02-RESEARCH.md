# Phase 2: Team & Access - Research

**Researched:** 2026-02-05
**Domain:** Team management, RBAC, invitation systems, hierarchical structures, visibility rules
**Confidence:** HIGH

## Summary

Phase 2 builds on Phase 1's authentication foundation to implement organizational team structures, role-based access control, and visibility rules. The research addresses: user invitations (email + shareable links), hierarchical roles with reporting structures, squad organization, and query-level visibility enforcement.

The standard approach for this domain combines:
- **Database schema:** Junction tables for project membership with role assignments, adjacency list for squad hierarchy (1-level nesting)
- **Authorization:** Application-level RBAC with Hono middleware (not PostgreSQL RLS for visibility, which adds complexity)
- **Invitations:** Hashed tokens in database with 7-day expiry, dual support for email and shareable links
- **Visibility:** Middleware-enforced scope filtering at query time, with explicit visibility grants stored in database

**Primary recommendation:** Use application-level authorization via Hono middleware rather than PostgreSQL RLS for visibility rules. RLS is powerful but harder to test and debug. Store visibility grants explicitly in a `visibility_grants` table. Use CASL for permission definition and checking in TypeScript.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Drizzle ORM | 0.30+ | Database queries/schema | Already in use from Phase 1, type-safe relations |
| CASL | 6.x | Authorization | Isomorphic, TypeScript-native, declarative permission rules |
| Resend | SDK | Invitation emails | Already in use from Phase 1, React Email support |
| nanoid | 5.x | Token generation | URL-safe, configurable length, secure random |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @casl/ability | 6.x | Core ability checking | Define and check permissions |
| React Email | latest | Email templates | Build invitation email templates |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| CASL | PostgreSQL RLS | RLS is database-level (harder to test), CASL is application-level (easier to debug) |
| CASL | Manual if/else | CASL provides declarative rules, better maintainability |
| Adjacency List | Closure Table | Closure better for deep hierarchies, but squads are max 1 level deep |
| nanoid | crypto.randomBytes | nanoid is URL-safe by default, better DX |

**Installation:**
```bash
bun add @casl/ability nanoid
bun add -d @types/nanoid
```

## Architecture Patterns

### Recommended Project Structure
```
src/features/
├── teams/
│   ├── __tests__/
│   ├── teams.routes.ts       # CRUD for squads
│   ├── teams.service.ts      # Squad business logic
│   └── teams.types.ts        # Squad types
├── roles/
│   ├── __tests__/
│   ├── roles.routes.ts       # Role management
│   ├── roles.service.ts      # Role assignment logic
│   └── roles.types.ts        # Role/permission types
├── invitations/
│   ├── __tests__/
│   ├── invitations.routes.ts # Invite endpoints
│   ├── invitations.service.ts# Invite/accept logic
│   ├── invitations.email.ts  # Email templates
│   └── invitations.types.ts  # Invitation types
└── visibility/
    ├── __tests__/
    ├── visibility.middleware.ts # Query scoping
    ├── visibility.service.ts    # Grant management
    └── visibility.types.ts      # Visibility types

src/shared/
├── db/schema/
│   ├── project-members.ts    # User-project-role junction
│   ├── squads.ts             # Squad definitions
│   ├── squad-members.ts      # User-squad membership
│   ├── invitations.ts        # Pending invitations
│   ├── invite-links.ts       # Shareable invite links
│   └── visibility-grants.ts  # Cross-squad access grants
└── lib/
    └── permissions/
        ├── abilities.ts      # CASL ability definitions
        ├── actions.ts        # Action constants
        └── subjects.ts       # Subject types
```

### Pattern 1: Project Membership with Roles (Junction Table)
**What:** Users belong to projects with a specific role per project
**When to use:** Users can have different roles across different projects
**Example:**
```typescript
// src/shared/db/schema/project-members.ts
import { pgTable, uuid, varchar, timestamp, primaryKey } from 'drizzle-orm/pg-core';
import { users } from './users';
import { projects } from './projects';

export const projectMembers = pgTable('project_members', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  role: varchar('role', { length: 50 }).notNull(), // 'admin', 'pm', 'squad_lead', 'member'
  // Optional: override default reporting hierarchy
  reportsToUserId: uuid('reports_to_user_id').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  // One role per user per project
  uniqueUserProject: unique().on(table.projectId, table.userId),
}));
```

### Pattern 2: Squad Hierarchy (Adjacency List with 1-Level Limit)
**What:** Squads can have sub-squads but no deeper nesting
**When to use:** User decided max 1 level of sub-squad nesting
**Example:**
```typescript
// src/shared/db/schema/squads.ts
import { pgTable, uuid, varchar, timestamp, type AnyPgColumn } from 'drizzle-orm/pg-core';
import { projects } from './projects';

export const squads = pgTable('squads', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  // NULL for top-level squads, parent squad ID for sub-squads
  parentSquadId: uuid('parent_squad_id').references((): AnyPgColumn => squads.id, { onDelete: 'cascade' }),
  leadUserId: uuid('lead_user_id').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// Enforce 1-level limit in application code when creating sub-squads
// Check: if parent has a parent, reject creation
```

### Pattern 3: Invitation Tokens (Hashed Storage)
**What:** Store hashed invitation tokens, not plaintext
**When to use:** All invitation flows (email and shareable links)
**Example:**
```typescript
// src/shared/db/schema/invitations.ts
import { pgTable, uuid, varchar, timestamp, boolean } from 'drizzle-orm/pg-core';
import { organizations } from './organizations';

export const invitations = pgTable('invitations', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  email: varchar('email', { length: 255 }).notNull(),
  tokenHash: varchar('token_hash', { length: 255 }).notNull(),
  // Optional pre-assigned role
  role: varchar('role', { length: 50 }),
  invitedById: uuid('invited_by_id').references(() => users.id),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  acceptedAt: timestamp('accepted_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// Shareable invite links (reusable until expiry)
export const inviteLinks = pgTable('invite_links', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  tokenHash: varchar('token_hash', { length: 255 }).notNull().unique(),
  // Optional pre-assigned role for users joining via this link
  role: varchar('role', { length: 50 }),
  createdById: uuid('created_by_id').references(() => users.id),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(), // 7 days fixed
  usageCount: integer('usage_count').default(0).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
```

### Pattern 4: CASL Ability Definitions
**What:** Declarative permission rules with TypeScript type safety
**When to use:** All authorization checks
**Example:**
```typescript
// src/shared/lib/permissions/abilities.ts
import { AbilityBuilder, createMongoAbility, type MongoAbility } from '@casl/ability';

type Actions = 'create' | 'read' | 'update' | 'delete' | 'manage';
type Subjects = 'Project' | 'Squad' | 'User' | 'WorkItem' | 'all';

export type AppAbility = MongoAbility<[Actions, Subjects]>;

interface UserContext {
  id: string;
  orgId: string;
  projectRoles: Array<{ projectId: string; role: string }>;
  squadMemberships: Array<{ squadId: string; isLead: boolean }>;
  visibilityGrants: Array<{ squadId: string }>;
}

export function defineAbilitiesFor(user: UserContext): AppAbility {
  const { can, cannot, build } = new AbilityBuilder<AppAbility>(createMongoAbility);

  // Admin can do everything in their org
  const isAdmin = user.projectRoles.some(pr => pr.role === 'admin');
  if (isAdmin) {
    can('manage', 'all');
    return build();
  }

  // PM has project-wide visibility
  const pmProjects = user.projectRoles
    .filter(pr => pr.role === 'pm')
    .map(pr => pr.projectId);

  if (pmProjects.length > 0) {
    can('read', 'WorkItem', { projectId: { $in: pmProjects } });
    can('read', 'User', { projectId: { $in: pmProjects } });
  }

  // Squad leads see their squad + granted squads
  const leadSquads = user.squadMemberships
    .filter(sm => sm.isLead)
    .map(sm => sm.squadId);
  const grantedSquads = user.visibilityGrants.map(vg => vg.squadId);
  const visibleSquads = [...leadSquads, ...grantedSquads];

  if (visibleSquads.length > 0) {
    can('read', 'WorkItem', { squadId: { $in: visibleSquads } });
    can('read', 'User', { squadId: { $in: visibleSquads } });
  }

  // Members see only their own squad's work
  const memberSquads = user.squadMemberships.map(sm => sm.squadId);
  can('read', 'WorkItem', { squadId: { $in: memberSquads } });

  return build();
}
```

### Pattern 5: Visibility Middleware
**What:** Middleware that adds visibility filters to context
**When to use:** All routes that query scoped data
**Example:**
```typescript
// src/features/visibility/visibility.middleware.ts
import type { Context, Next } from 'hono';
import { defineAbilitiesFor, type AppAbility } from '../../shared/lib/permissions/abilities';
import { loadUserContext } from './visibility.service';

declare module 'hono' {
  interface ContextVariableMap {
    ability: AppAbility;
    visibleSquadIds: string[];
  }
}

export async function visibilityMiddleware(c: Context, next: Next) {
  const user = c.get('user'); // From auth middleware

  // Load full user context (roles, squads, grants)
  const userContext = await loadUserContext(user.sub, user.org);

  // Build CASL ability
  const ability = defineAbilitiesFor(userContext);
  c.set('ability', ability);

  // Pre-compute visible squad IDs for query filtering
  const visibleSquadIds = computeVisibleSquads(userContext);
  c.set('visibleSquadIds', visibleSquadIds);

  await next();
}
```

### Pattern 6: Predefined Roles with Tier System
**What:** Default roles with hierarchical tiers for reporting
**When to use:** Setting up initial role structure
**Example:**
```typescript
// src/shared/lib/permissions/roles.ts
export const PREDEFINED_ROLES = {
  admin: { tier: 0, name: 'Admin', capabilities: ['manage_org', 'manage_users', 'manage_projects'] },
  pm: { tier: 1, name: 'Project Manager', capabilities: ['manage_project', 'view_all', 'manage_squads'] },
  squad_lead: { tier: 2, name: 'Squad Lead', capabilities: ['manage_squad', 'view_squad'] },
  member: { tier: 3, name: 'Member', capabilities: ['view_own', 'update_own'] },
} as const;

// Default reporting: higher tier reports to lower tier
// But admin can override per person via reportsToUserId
export function getDefaultReportsTo(role: string, projectMembers: ProjectMember[]): string | null {
  const roleTier = PREDEFINED_ROLES[role]?.tier ?? 999;

  // Find lowest tier above this role
  const potentialManagers = projectMembers
    .filter(pm => (PREDEFINED_ROLES[pm.role]?.tier ?? 999) < roleTier)
    .sort((a, b) => (PREDEFINED_ROLES[b.role]?.tier ?? 0) - (PREDEFINED_ROLES[a.role]?.tier ?? 0));

  return potentialManagers[0]?.userId ?? null;
}
```

### Anti-Patterns to Avoid
- **Storing plaintext invite tokens:** Always hash tokens with Argon2 or SHA-256
- **Putting authorization in route handlers:** Use middleware for consistent enforcement
- **Using PostgreSQL RLS for complex visibility:** Application-level is easier to test/debug
- **Deep squad nesting:** User specified max 1 level; enforce in application code
- **Scattered permission checks:** Centralize in CASL ability definitions

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Permission definitions | Giant switch statements | CASL ability builder | Declarative, testable, type-safe |
| Token generation | Math.random | nanoid or crypto.randomBytes | Cryptographically secure |
| Email templates | Raw HTML strings | React Email | Component-based, maintainable |
| Hierarchy queries | Multiple queries in loop | Single query with adjacency list | Performance, atomicity |
| Role validation | String comparison everywhere | Zod enum + TypeScript | Type safety, validation |

**Key insight:** Authorization logic accumulates quickly. CASL's declarative approach prevents spaghetti code. Token security has subtle requirements (timing attacks, entropy) that libraries handle correctly.

## Common Pitfalls

### Pitfall 1: Invitation Token Timing Attacks
**What goes wrong:** Attackers can distinguish valid vs invalid tokens by response time
**Why it happens:** Early return when token not found vs hash comparison
**How to avoid:** Always perform hash comparison, even for non-existent tokens (compare against dummy hash)
**Warning signs:** Different response times for valid vs invalid invitation tokens

### Pitfall 2: Unbounded Invite Link Usage
**What goes wrong:** Shareable links used indefinitely or by unlimited users
**Why it happens:** No expiry or usage tracking
**How to avoid:** User specified 7-day fixed expiry; track usage count
**Warning signs:** Same invite link appearing in logs months later

### Pitfall 3: Missing Cascade Deletes on Membership
**What goes wrong:** Orphaned membership records when user/project deleted
**Why it happens:** Foreign keys without onDelete cascade
**How to avoid:** Always specify `onDelete: 'cascade'` on membership FKs
**Warning signs:** Foreign key constraint violations, orphan records

### Pitfall 4: Visibility Bypass via Direct ID Access
**What goes wrong:** User accesses work item by guessing UUID
**Why it happens:** Authorization checks resource existence but not visibility
**How to avoid:** Every query must include visibility filter (squad scope)
**Warning signs:** Users seeing items from other squads in API responses

### Pitfall 5: Role-per-Project Confusion
**What goes wrong:** User's role in Project A applied to Project B
**Why it happens:** Caching role without project context
**How to avoid:** Always qualify role checks with projectId
**Warning signs:** Cross-project permission leaks in multi-project users

### Pitfall 6: Existing User Re-Invitation
**What goes wrong:** Existing user receives invitation, unclear what happens
**Why it happens:** No handling for "user already exists" case
**How to avoid:** Claude's discretion item - recommend: auto-add with notification email
**Warning signs:** Duplicate user records, confused users

## Code Examples

### Invitation Flow (Email + Link)
```typescript
// src/features/invitations/invitations.service.ts
import { nanoid } from 'nanoid';
import { hash } from '@node-rs/argon2';
import { eq, and, gt } from 'drizzle-orm';
import { db, schema } from '../../shared/db';
import { sendInvitationEmail } from './invitations.email';

const INVITE_EXPIRY_DAYS = 7;
const ARGON2_OPTIONS = { memoryCost: 65536, timeCost: 3, parallelism: 4 };

export async function createEmailInvitation(
  orgId: string,
  email: string,
  invitedById: string,
  role?: string
) {
  // Check if user already exists in org
  const existingUser = await db.query.users.findFirst({
    where: and(
      eq(schema.users.orgId, orgId),
      eq(schema.users.email, email)
    ),
  });

  if (existingUser) {
    // Auto-add to org (Claude's discretion recommendation)
    // Send notification email instead of invitation
    return { type: 'existing', userId: existingUser.id };
  }

  // Generate secure token
  const token = nanoid(32);
  const tokenHash = await hash(token, ARGON2_OPTIONS);
  const expiresAt = new Date(Date.now() + INVITE_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

  await db.insert(schema.invitations).values({
    orgId,
    email,
    tokenHash,
    role,
    invitedById,
    expiresAt,
  });

  // Send email with token
  await sendInvitationEmail(email, token, orgId);

  return { type: 'invited', email };
}

export async function createShareableLink(
  orgId: string,
  createdById: string,
  role?: string
) {
  const token = nanoid(32);
  const tokenHash = await hash(token, ARGON2_OPTIONS);
  const expiresAt = new Date(Date.now() + INVITE_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

  const [link] = await db.insert(schema.inviteLinks).values({
    orgId,
    tokenHash,
    role,
    createdById,
    expiresAt,
  }).returning();

  // Return URL with plaintext token (user stores in their app config)
  return {
    id: link.id,
    url: `${env.APP_BASE_URL}/join/${token}`,
    expiresAt,
  };
}
```

### Accept Invitation
```typescript
export async function acceptInvitation(token: string, userId: string) {
  // Find all non-expired invitations and check hash
  const invitations = await db.query.invitations.findMany({
    where: and(
      gt(schema.invitations.expiresAt, new Date()),
      isNull(schema.invitations.acceptedAt)
    ),
  });

  for (const inv of invitations) {
    if (await verifyHash(inv.tokenHash, token)) {
      // Mark as accepted
      await db.update(schema.invitations)
        .set({ acceptedAt: new Date() })
        .where(eq(schema.invitations.id, inv.id));

      // Add user to organization
      await db.update(schema.users)
        .set({ orgId: inv.orgId })
        .where(eq(schema.users.id, userId));

      // Assign pre-set role if specified
      if (inv.role) {
        // Add to default project with role
        // (project assignment logic here)
      }

      return { success: true, orgId: inv.orgId };
    }
  }

  // Always check timing - compare against dummy to prevent timing attacks
  await verifyHash('$argon2id$v=19$m=65536,t=3,p=4$dummy', token);
  return { success: false, error: 'Invalid or expired invitation' };
}
```

### Squad Service with Nesting Limit
```typescript
// src/features/teams/teams.service.ts
import { eq, isNull } from 'drizzle-orm';
import { db, schema } from '../../shared/db';
import { ApiError } from '../../shared/middleware/error-handler';

export async function createSquad(
  projectId: string,
  name: string,
  parentSquadId?: string,
  leadUserId?: string
) {
  // Enforce 1-level nesting limit
  if (parentSquadId) {
    const parent = await db.query.squads.findFirst({
      where: eq(schema.squads.id, parentSquadId),
    });

    if (!parent) {
      throw new ApiError(404, 'squads/parent-not-found', 'Parent Squad Not Found');
    }

    if (parent.parentSquadId !== null) {
      throw new ApiError(
        400,
        'squads/nesting-limit',
        'Squad Nesting Limit Exceeded',
        'Squads can only be nested one level deep'
      );
    }
  }

  const [squad] = await db.insert(schema.squads).values({
    projectId,
    name,
    parentSquadId,
    leadUserId,
  }).returning();

  return squad;
}

export async function getSquadHierarchy(projectId: string) {
  // Single query for all squads in project
  const allSquads = await db.query.squads.findMany({
    where: eq(schema.squads.projectId, projectId),
    with: {
      lead: true,
      members: { with: { user: true } },
    },
  });

  // Build hierarchy in memory (fast for 1-level)
  const topLevel = allSquads.filter(s => s.parentSquadId === null);
  return topLevel.map(squad => ({
    ...squad,
    subSquads: allSquads.filter(s => s.parentSquadId === squad.id),
  }));
}
```

### Visibility-Scoped Query
```typescript
// src/features/work-items/work-items.service.ts
import { inArray, and, eq } from 'drizzle-orm';
import { db, schema } from '../../shared/db';

export async function getWorkItems(
  projectId: string,
  visibleSquadIds: string[]
) {
  // Always filter by visible squads - no bypass
  return db.query.workItems.findMany({
    where: and(
      eq(schema.workItems.projectId, projectId),
      inArray(schema.workItems.squadId, visibleSquadIds)
    ),
    with: {
      assignee: true,
      squad: true,
    },
  });
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| String-based roles | CASL/typed permissions | 2022+ | Type-safe authorization |
| Single global role | Project-scoped roles | SaaS standard | Users need different access per context |
| UUID invite tokens | nanoid (URL-safe) | 2020+ | Better UX in URLs |
| Plaintext token storage | Hashed tokens | Security best practice | Prevents token theft from DB breach |
| Nested set for hierarchy | Adjacency list + app logic | Modern preference | Simpler, good enough for shallow trees |

**Deprecated/outdated:**
- **Closure tables for shallow hierarchies:** Overkill for 1-level nesting
- **Global roles:** Most apps need context-specific permissions
- **Cookie-only invites:** Shareable links are expected feature

## Discretionary Recommendations

Based on research, recommendations for Claude's discretion items:

### Existing Users Receiving Invites
**Recommendation:** Auto-add to organization with notification email
**Rationale:**
- User already verified their email
- Sending another invite creates friction
- Send notification: "You've been added to [Org] by [Inviter]"
- If role pre-assigned, apply immediately

### Permission Model for Predefined Roles
**Recommendation:** Use tiered capability model
```typescript
const CAPABILITIES = {
  admin: ['manage_org', 'manage_users', 'manage_projects', 'view_all'],
  pm: ['manage_project', 'manage_squads', 'view_all', 'grant_visibility'],
  squad_lead: ['manage_squad', 'view_squad', 'assign_work'],
  member: ['view_own', 'update_own_work'],
};
```
**Rationale:** Clear capability boundaries, easy to extend with custom roles

### Squad Lead Assignment Mechanism
**Recommendation:** Field on squad table + automatic project_member role update
**Rationale:**
- `squads.lead_user_id` is single source of truth
- When set, ensure user has at least `squad_lead` role in project
- Squad can have no lead (lead_user_id = NULL)

### Cross-Squad Visibility Grant Mechanism
**Recommendation:** Explicit `visibility_grants` table
```typescript
export const visibilityGrants = pgTable('visibility_grants', {
  id: uuid('id').primaryKey().defaultRandom(),
  granteeUserId: uuid('grantee_user_id').notNull().references(() => users.id),
  squadId: uuid('squad_id').notNull().references(() => squads.id),
  grantedById: uuid('granted_by_id').references(() => users.id),
  expiresAt: timestamp('expires_at', { withTimezone: true }), // NULL = permanent
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
```
**Rationale:**
- Explicit grants are auditable
- Optional expiry supports temporary access
- Tracks who granted access

## Open Questions

1. **Custom Roles Storage**
   - What we know: Predefined roles + custom roles can be added
   - What's unclear: Where custom role definitions stored (per-org? per-project?)
   - Recommendation: Store in `custom_roles` table scoped to organization, can be assigned at project level

2. **User Names Visibility When Restricted**
   - What we know: User decided restricted users see names but not work items
   - What's unclear: Which user attributes are visible (just name? avatar? email?)
   - Recommendation: Name + avatar visible, email hidden for privacy

3. **Invitation Rate Limiting**
   - What we know: Need to prevent abuse
   - What's unclear: What limits are appropriate
   - Recommendation: 100 invitations per org per day, 10 per user per hour

## Sources

### Primary (HIGH confidence)
- [Drizzle ORM RLS Documentation](https://orm.drizzle.team/docs/rls) - pgPolicy and pgRole patterns
- [CASL GitHub](https://github.com/stalniy/casl) - Authorization library docs
- [Neon RLS + Drizzle Blog](https://neon.com/blog/modelling-authorization-for-a-social-network-with-postgres-rls-and-drizzle-orm) - Real-world patterns
- [Auth0 Token Best Practices](https://auth0.com/docs/secure/tokens/token-best-practices) - Token security

### Secondary (MEDIUM confidence)
- [Better Auth Organization Plugin](https://www.better-auth.com/docs/plugins/organization) - Schema patterns for members/invitations
- [PostgreSQL Hierarchy Models](https://dev.to/dowerdev/implementing-hierarchical-data-structures-in-postgresql-ltree-vs-adjacency-list-vs-closure-table-2jpb) - Adjacency list vs closure table
- [System Design: Inviting Users](https://medium.com/@itayeylon/system-design-inviting-users-to-a-group-98b1e0967b06) - Invitation architecture
- [RBAC vs ABAC](https://www.splunk.com/en_us/blog/learn/rbac-vs-abac.html) - Access control comparison

### Tertiary (LOW confidence)
- [Hono Authorization Discussion](https://github.com/orgs/honojs/discussions/2452) - Middleware patterns (community)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - CASL is established, Drizzle patterns verified via official docs
- Database schema: HIGH - Patterns from multiple production systems (Better Auth, Neon examples)
- Authorization patterns: MEDIUM - Application-level chosen over RLS (opinionated but justified)
- Pitfalls: MEDIUM - Gathered from security best practices and community patterns

**Research date:** 2026-02-05
**Valid until:** 2026-03-05 (30 days - domain is stable)
