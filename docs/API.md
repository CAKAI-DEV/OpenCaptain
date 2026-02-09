# BlockBot API Documentation

BlockBot is an open-source, self-hosted project management agent with a building blocks architecture. Teams assemble workflows from reusable blocks (roles, deliverables, check-ins, escalations, visibility rules, integrations) and interact with an AI agent via WhatsApp/Telegram.

## Base URL

```
http://localhost:3000/api/v1
```

## Authentication

All API endpoints (except `/auth/*` and `/health`) require a valid JWT access token.

**Header:**
```
Authorization: Bearer <access_token>
```

## Error Format (RFC 7807)

All errors return Problem Details JSON:

```json
{
  "type": "https://blockbot.dev/errors/<domain>/<error-code>",
  "title": "Error Title",
  "status": 400,
  "detail": "Human-readable error description",
  "instance": "/api/v1/endpoint"
}
```

---

## Authentication

### Register
```http
POST /auth/register
```

Creates a new user and organization.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "min8chars",
  "orgName": "My Organization"
}
```

**Response (201):**
```json
{
  "user": { "id": "uuid", "email": "user@example.com", "orgId": "uuid" },
  "accessToken": "jwt...",
  "refreshToken": "jwt..."
}
```

### Login
```http
POST /auth/login
```

**Request:**
```json
{
  "email": "user@example.com",
  "password": "password"
}
```

**Response (200):**
```json
{
  "user": { "id": "uuid", "email": "user@example.com", "orgId": "uuid" },
  "accessToken": "jwt...",
  "refreshToken": "jwt..."
}
```

### Refresh Token
```http
POST /auth/refresh
```

**Request:**
```json
{
  "refreshToken": "jwt..."
}
```

**Response (200):**
```json
{
  "accessToken": "jwt...",
  "refreshToken": "jwt..."
}
```

### Logout
```http
POST /auth/logout
```
Requires authentication. Revokes all refresh tokens for the user.

### Magic Link - Request
```http
POST /auth/magic-link/request
```

**Request:**
```json
{
  "email": "user@example.com"
}
```

### Magic Link - Verify
```http
GET /auth/magic-link/verify?token=<token>
```

---

## Projects

### Create Project
```http
POST /projects
```

**Request:**
```json
{
  "name": "Project Name",
  "description": "Optional description"
}
```

**Response (201):** Project object

### List Projects
```http
GET /projects
```

Returns all projects in the user's organization.

### Get Project
```http
GET /projects/:id
```

---

## Teams (Squads)

BlockBot uses hierarchical squads (teams) within projects.

### Create Squad
```http
POST /squads
```

**Request:**
```json
{
  "projectId": "uuid",
  "name": "Squad Name",
  "parentSquadId": "uuid (optional)",
  "leadUserId": "uuid (optional)"
}
```

### Get Squad Hierarchy
```http
GET /projects/:projectId/squads
```

Returns nested squad structure for a project.

### Get Squad
```http
GET /squads/:id
```

### Update Squad
```http
PATCH /squads/:id
```

**Request:**
```json
{
  "name": "New Name",
  "leadUserId": "uuid or null"
}
```

### Delete Squad
```http
DELETE /squads/:id
```

### Add Squad Member
```http
POST /squads/:id/members
```

**Request:**
```json
{
  "userId": "uuid"
}
```

### Remove Squad Member
```http
DELETE /squads/:id/members/:userId
```

### List Squad Members
```http
GET /squads/:id/members
```

---

## Roles & Members

### Assign Role
```http
POST /projects/:projectId/members
```

**Request:**
```json
{
  "userId": "uuid",
  "role": "admin | pm | squad_lead | member",
  "reportsToUserId": "uuid (optional)"
}
```

### List Project Members
```http
GET /projects/:projectId/members
```

### Remove from Project
```http
DELETE /projects/:projectId/members/:userId
```

### Get User Roles
```http
GET /users/:userId/roles
```

Returns user's roles across all projects.

---

## Tasks

### Create Task
```http
POST /tasks
```

**Request:**
```json
{
  "projectId": "uuid",
  "squadId": "uuid (optional)",
  "parentTaskId": "uuid (optional - for subtasks)",
  "title": "Task title",
  "description": "Optional description",
  "priority": "low | medium | high | urgent",
  "assigneeId": "uuid (optional)",
  "dueDate": "2024-01-15T10:00:00Z (optional)",
  "customFieldValues": { "field_id": "value" }
}
```

### List Tasks
```http
GET /tasks?projectId=uuid&squadId=uuid&assigneeId=uuid&status=todo&parentTaskId=uuid&page=1&limit=20
```

### Get Task
```http
GET /tasks/:taskId
```

### Update Task
```http
PATCH /tasks/:taskId
```

**Request:**
```json
{
  "title": "New title",
  "description": "New description",
  "priority": "high",
  "status": "todo | in_progress | done",
  "assigneeId": "uuid or null",
  "dueDate": "2024-01-15T10:00:00Z or null",
  "squadId": "uuid or null",
  "customFieldValues": { "field_id": "value" }
}
```

### Delete Task
```http
DELETE /tasks/:taskId
```

---

## Deliverables

Deliverables are typed work items with custom fields and status workflows.

### Create Deliverable Type
```http
POST /deliverables/types
```

**Request:**
```json
{
  "projectId": "uuid",
  "name": "Blog Post",
  "description": "Content deliverable type",
  "icon": "file-text",
  "config": {
    "statuses": [
      { "id": "draft", "name": "Draft", "color": "#808080", "isFinal": false },
      { "id": "published", "name": "Published", "color": "#00FF00", "isFinal": true }
    ],
    "transitions": [
      { "from": "draft", "to": "published" }
    ],
    "fields": [
      { "id": "word_count", "name": "Word Count", "type": "number", "required": true }
    ]
  }
}
```

### Create from Preset
```http
POST /deliverables/types/from-preset
```

**Request:**
```json
{
  "projectId": "uuid",
  "preset": "blog_post | social_media | video | ..."
}
```

### List Deliverable Types
```http
GET /deliverables/types?projectId=uuid
```

### Get/Update/Delete Deliverable Type
```http
GET /deliverables/types/:typeId
PATCH /deliverables/types/:typeId
DELETE /deliverables/types/:typeId
```

### Create Deliverable
```http
POST /deliverables
```

**Request:**
```json
{
  "projectId": "uuid",
  "squadId": "uuid (optional)",
  "deliverableTypeId": "uuid",
  "title": "My Blog Post",
  "description": "Optional",
  "assigneeId": "uuid (optional)",
  "dueDate": "2024-01-15T10:00:00Z",
  "customFieldValues": { "word_count": 1500 }
}
```

### List Deliverables
```http
GET /deliverables?projectId=uuid&squadId=uuid&assigneeId=uuid&status=draft&deliverableTypeId=uuid
```

### Get/Update/Delete Deliverable
```http
GET /deliverables/:deliverableId
PATCH /deliverables/:deliverableId
DELETE /deliverables/:deliverableId
```

---

## Dependencies

Create dependencies between tasks and deliverables.

### Create Dependency
```http
POST /dependencies
```

**Request:**
```json
{
  "blocker": { "type": "task | deliverable", "id": "uuid" },
  "blocked": { "type": "task | deliverable", "id": "uuid" }
}
```

### Delete Dependency
```http
DELETE /dependencies/:dependencyId
```

### Get Dependencies
```http
GET /dependencies/for/:type/:itemId?direction=blocks|blocked_by
```

### Check if Blocked
```http
GET /dependencies/blocked/:type/:itemId
```

**Response:**
```json
{
  "data": {
    "blocked": true,
    "blockedBy": [{ "type": "task", "id": "uuid" }]
  }
}
```

---

## Custom Fields

### Create Custom Field
```http
POST /custom-fields
```

**Request:**
```json
{
  "projectId": "uuid",
  "name": "Story Points",
  "type": "text | number | date | select | multi_select | url | file | relation",
  "config": {
    "options": ["1", "2", "3", "5", "8"],
    "min": 1,
    "max": 100
  },
  "required": false,
  "appliesToTasks": true,
  "appliesToDeliverables": true
}
```

### List Custom Fields
```http
GET /custom-fields?projectId=uuid&target=task|deliverable
```

### Get/Update/Delete Custom Field
```http
GET /custom-fields/:fieldId
PATCH /custom-fields/:fieldId
DELETE /custom-fields/:fieldId
```

### Validate Field Values
```http
POST /custom-fields/validate
```

---

## Comments

### Create Comment
```http
POST /comments
```

**Request:**
```json
{
  "targetType": "task | deliverable",
  "targetId": "uuid",
  "content": "Comment text with @mentions"
}
```

### List Comments
```http
GET /comments?targetType=task&targetId=uuid&limit=50&offset=0
```

### Get/Delete Comment
```http
GET /comments/:id
DELETE /comments/:id
```

---

## Uploads

### Get Presigned Upload URL
```http
POST /uploads/presign
```

**Request:**
```json
{
  "filename": "document.pdf",
  "contentType": "application/pdf",
  "targetType": "task | deliverable",
  "targetId": "uuid"
}
```

**Response:**
```json
{
  "data": {
    "uploadUrl": "https://...",
    "attachmentId": "uuid",
    "expiresAt": "2024-01-15T10:00:00Z"
  }
}
```

### Confirm Upload
```http
POST /uploads/:attachmentId/confirm
```

### Get Download URL
```http
GET /uploads/:attachmentId/download
```

### Delete Attachment
```http
DELETE /uploads/:attachmentId
```

### List Attachments
```http
GET /uploads?targetType=task&targetId=uuid
```

---

## Metrics & Analytics

### Output Metrics
```http
GET /metrics/output?projectId=uuid&startDate=2024-01-01&endDate=2024-01-31&squadId=uuid
```

Returns completed tasks/deliverables grouped by day, person, and squad.

### Velocity
```http
GET /metrics/velocity?projectId=uuid&periodDays=7&numPeriods=4
```

Returns velocity over time periods (tasks completed per period).

### Burndown
```http
GET /metrics/burndown?projectId=uuid&startDate=2024-01-01&endDate=2024-01-15&squadId=uuid
```

Returns burndown chart data (remaining vs ideal).

### Personal Metrics
```http
GET /metrics/personal?projectId=uuid&startDate=2024-01-01&endDate=2024-01-31
```

Returns current user's metrics compared to project average.

---

## Check-ins

### List Templates
```http
GET /check-ins/templates
```

### Get Template
```http
GET /check-ins/templates/:templateId
```

### Create Check-in Block
```http
POST /projects/:projectId/check-in-blocks
```

**Request:**
```json
{
  "name": "Daily Standup",
  "templateId": "daily_standup",
  "cronExpression": "0 9 * * 1-5",
  "timezone": "Asia/Jakarta",
  "targetSquadId": "uuid (optional)",
  "enabled": true
}
```

### List/Get/Update/Delete Check-in Blocks
```http
GET /projects/:projectId/check-in-blocks
GET /projects/:projectId/check-in-blocks/:blockId
PATCH /projects/:projectId/check-in-blocks/:blockId
DELETE /projects/:projectId/check-in-blocks/:blockId
```

---

## Escalations

### Create Escalation Block
```http
POST /projects/:projectId/escalation-blocks
```

**Request:**
```json
{
  "name": "Blocker Escalation",
  "triggerType": "blocker_reported | deadline_approaching | no_response",
  "escalationChain": [
    { "roleOrUserId": "squad_lead", "waitHours": 2 },
    { "roleOrUserId": "pm", "waitHours": 4 }
  ],
  "enabled": true
}
```

### List/Get/Update/Delete Escalation Blocks
```http
GET /projects/:projectId/escalation-blocks
GET /projects/:projectId/escalation-blocks/:blockId
PATCH /projects/:projectId/escalation-blocks/:blockId
DELETE /projects/:projectId/escalation-blocks/:blockId
```

### Report Blocker
```http
POST /projects/:projectId/blockers
```

**Request:**
```json
{
  "taskId": "uuid (optional)",
  "description": "Blocked by external dependency",
  "severity": "low | medium | high | critical"
}
```

### List/Get Blockers
```http
GET /projects/:projectId/blockers?status=open
GET /projects/:projectId/blockers/:blockerId
```

### Resolve Blocker
```http
POST /projects/:projectId/blockers/:blockerId/resolve
```

**Request:**
```json
{
  "resolution": "How it was resolved"
}
```

### Get Active Escalations
```http
GET /projects/:projectId/escalations
GET /projects/:projectId/my-escalations
```

---

## Visibility

### Grant Visibility
```http
POST /visibility/grants
```

**Request:**
```json
{
  "granteeUserId": "uuid",
  "squadId": "uuid",
  "expiresAt": "2024-12-31T23:59:59Z (optional)"
}
```

### Revoke Visibility
```http
DELETE /visibility/grants
```

**Request:**
```json
{
  "granteeUserId": "uuid",
  "squadId": "uuid"
}
```

### Get User Visibility Grants
```http
GET /visibility/grants/:userId
```

### Get Current User Context
```http
GET /visibility/context
```

---

## Workflows

Visual workflow configuration (n8n-style blocks).

### Get Workflow
```http
GET /projects/:projectId/workflows
```

**Response:**
```json
{
  "data": {
    "workflow": { "id": "uuid", "name": "...", "createdAt": "...", "updatedAt": "..." },
    "nodes": [
      { "id": "node-1", "type": "checkIn", "position": { "x": 100, "y": 100 }, "data": {...} }
    ],
    "edges": [
      { "id": "edge-1", "source": "node-1", "target": "node-2" }
    ]
  }
}
```

### Save Workflow
```http
POST /projects/:projectId/workflows
```

**Request:**
```json
{
  "nodes": [...],
  "edges": [...]
}
```

---

## Invitations

### Create Email Invitation
```http
POST /invitations
```

**Request:**
```json
{
  "email": "new@example.com",
  "role": "member"
}
```

### Create Shareable Link
```http
POST /invitations/links
```

**Request:**
```json
{
  "role": "member"
}
```

### Accept Invitation
```http
POST /invitations/accept
```

**Request:**
```json
{
  "token": "invitation_token"
}
```

---

## Notifications

### List Notifications
```http
GET /notifications?unreadOnly=true&limit=50&offset=0
```

### Get Unread Count
```http
GET /notifications/unread-count
```

### Mark as Read
```http
PATCH /notifications/:id/read
```

### Mark All as Read
```http
POST /notifications/read-all
```

### Activity Feed
```http
GET /notifications/activity?limit=50&offset=0
GET /notifications/activity/project/:projectId?limit=50&offset=0
```

---

## Conversations (AI Chat)

### Create Conversation
```http
POST /conversations
```

**Request:**
```json
{
  "projectId": "uuid (optional)",
  "title": "Optional title"
}
```

### List Conversations
```http
GET /conversations?limit=20&offset=0
```

### Get Conversation
```http
GET /conversations/:id
```

### Send Message
```http
POST /conversations/:id/messages
```

**Request:**
```json
{
  "content": "What's the status of our sprint?"
}
```

**Response:**
```json
{
  "userMessage": { "id": "uuid", "role": "user", "content": "..." },
  "assistantMessage": { "id": "uuid", "role": "assistant", "content": "..." }
}
```

---

## Recaps

### Generate Recap
```http
POST /recaps/generate
```

**Request:**
```json
{
  "projectId": "uuid",
  "period": "daily | weekly | monthly"
}
```

### Preview Recap
```http
POST /recaps/preview
```

### Queue Recap for Delivery
```http
POST /recaps/queue
```

### Enable Recurring Recaps
```http
POST /recaps/projects/:projectId/enable-recurring
```

---

## Insights

### Get Insights
```http
GET /projects/:projectId/insights?startDate=2024-01-01&endDate=2024-01-31
```

Returns role-scoped insights (admin sees all, members see personal).

### Get Suggestions
```http
GET /projects/:projectId/insights/suggestions
```

Returns actionable AI-generated suggestions.

### Generate Insights (Admin)
```http
POST /projects/:projectId/insights/generate
```

---

## Linear Integration

### Configure Linear
```http
POST /projects/:projectId/integrations/linear
```

**Request:**
```json
{
  "apiKey": "lin_api_...",
  "teamId": "team_uuid",
  "statusMappings": [
    { "blockbotStatus": "todo", "linearStateId": "uuid", "linearStateName": "Backlog" }
  ]
}
```

### Get Integration Status
```http
GET /projects/:projectId/integrations/linear
```

### Disable Integration
```http
DELETE /projects/:projectId/integrations/linear
```

### Sync Task to Linear
```http
POST /tasks/:taskId/sync-linear
```

### Get Task Linear Status
```http
GET /tasks/:taskId/linear-status
```

---

## Coding Agent

Allows squad leads/admins/PMs to trigger AI coding fixes.

### Link GitHub Repository
```http
POST /projects/:projectId/repos
```

**Request:**
```json
{
  "owner": "github-username",
  "repo": "repo-name",
  "installationId": 12345
}
```

### List Linked Repos
```http
GET /projects/:projectId/repos
```

### Unlink Repository
```http
DELETE /projects/:projectId/repos/:repoId
```

### Request Coding Fix
```http
POST /tasks/:taskId/fix
```

**Request:**
```json
{
  "description": "Fix the null pointer exception in UserService.java line 45"
}
```

**Response (202):**
```json
{
  "data": {
    "requestId": "uuid",
    "status": "pending",
    "message": "Coding fix request queued for processing"
  }
}
```

### Get Fix Status
```http
GET /tasks/:taskId/fix
```

**Response:**
```json
{
  "data": {
    "hasRequest": true,
    "request": {
      "id": "uuid",
      "status": "pending | processing | completed | failed",
      "branchName": "fix/task-123",
      "prNumber": 456,
      "prUrl": "https://github.com/...",
      "errorMessage": null
    }
  }
}
```

---

## Health Check

```http
GET /health
```

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:00:00Z"
}
```

---

## Swagger UI

Interactive API documentation available at:
```
http://localhost:3000/docs
```

OpenAPI JSON spec:
```
http://localhost:3000/docs/openapi.json
```
