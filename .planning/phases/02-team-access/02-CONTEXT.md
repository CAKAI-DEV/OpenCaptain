# Phase 2: Team & Access - Context

**Gathered:** 2026-02-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Admins can create organizations, invite users, assign roles, and configure visibility. This phase delivers user management, role hierarchies, squad structures, and visibility rule enforcement. The AI agent and messaging interfaces are separate phases.

</domain>

<decisions>
## Implementation Decisions

### Invitation Flow
- Both email invitations AND shareable invite links supported
- Invite links expire after 7 days (fixed, not configurable)
- Admin can optionally pre-assign a role when sending invitation
- User joins without role if not pre-assigned, admin assigns later

### Role & Hierarchy Design
- Predefined roles (Admin, PM, Squad Lead, Member) + custom roles can be added
- Reporting hierarchy: default from role tier, but admin can override per person
- Users can hold different roles across different projects (PM on A, Squad Lead on B)
- One role per project per user

### Squad Membership
- Users can belong to any number of squads simultaneously
- Only admins can create squads
- One level of sub-squad nesting allowed (squads can have sub-squads, no deeper)

### Visibility Rules
- Default visibility: entire project (everyone sees everything in their project)
- Admins can restrict specific users or roles to squad-scoped visibility
- When restricted: work items + analytics hidden, but user names remain visible

### Claude's Discretion
- Handling of existing users receiving invites (auto-add vs prompt)
- Permission model design for predefined roles
- Squad lead assignment mechanism
- Cross-squad visibility grant mechanism

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches for the items left to Claude's discretion.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 02-team-access*
*Context gathered: 2026-02-05*
