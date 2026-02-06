# Phase 8: Workflow Builder & Integrations - Research

**Researched:** 2026-02-06
**Domain:** Visual workflow editor, Linear integration, GitHub App, AI-powered task creation
**Confidence:** HIGH (verified with official documentation)

## Summary

Phase 8 requires implementing a visual workflow builder with React Flow, bidirectional Linear sync via GraphQL/webhooks, GitHub App integration for coding agent PR creation, and natural language task creation using LLM function calling.

The standard stack is well-established: React Flow v12 (`@xyflow/react`) for the visual editor with dagre for tree layouts, Linear's TypeScript SDK with webhooks for bidirectional sync, GitHub App with installation tokens for PR creation, and the existing OpenAI-compatible function calling pattern for intent detection.

The project already has a solid foundation with the existing `messaging.intents.ts` pattern that demonstrates LLM function calling for intent detection. This pattern can be extended for natural language task creation with confirmation flows.

**Primary recommendation:** Use React Flow v12 with dagre layout, Linear SDK with webhooks, GitHub App REST API, and extend existing intent detection for task creation.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @xyflow/react | 12.x | Visual workflow editor canvas | Industry standard, TypeScript, excellent docs |
| @dagrejs/dagre | 1.x | Tree/hierarchy auto-layout | Best-maintained dagre fork, simple API |
| @linear/sdk | 27.x | Linear API TypeScript client | Official SDK, strongly typed |
| @octokit/rest | 20.x | GitHub REST API client | Official SDK, well-maintained |
| @octokit/auth-app | 6.x | GitHub App authentication | Official auth library for Apps |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| jose | 5.x | JWT signing for GitHub App | Creating JWTs for installation tokens |
| openai | 6.x | LLM function calling | Already in project for intent detection |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| @dagrejs/dagre | elkjs | More powerful but complex, overkill for tree layout |
| @dagrejs/dagre | d3-hierarchy | Pure hierarchy, no edge routing |
| @octokit/rest | Raw fetch | Less type safety, more boilerplate |

**Installation:**
```bash
# Web (workflow editor)
cd web && npm install @xyflow/react @dagrejs/dagre

# API (integrations)
npm install @linear/sdk @octokit/rest @octokit/auth-app jose
```

## Architecture Patterns

### Recommended Project Structure
```
web/src/
├── components/
│   └── workflow/
│       ├── workflow-canvas.tsx      # Main React Flow canvas
│       ├── workflow-sidebar.tsx     # Block palette for drag-drop
│       ├── workflow-properties.tsx  # Properties panel
│       └── nodes/                   # Custom node types
│           ├── check-in-node.tsx
│           ├── escalation-node.tsx
│           ├── role-node.tsx
│           └── visibility-node.tsx
└── lib/
    └── workflow/
        ├── layout.ts                # Dagre layout utilities
        └── types.ts                 # TypeScript types

src/features/
├── integrations/
│   ├── linear/
│   │   ├── linear.client.ts        # LinearClient wrapper
│   │   ├── linear.webhooks.ts      # Webhook handler
│   │   ├── linear.sync.ts          # Bidirectional sync logic
│   │   └── linear.types.ts
│   └── github/
│       ├── github.app.ts           # GitHub App auth
│       ├── github.client.ts        # Octokit wrapper
│       └── github.types.ts
├── coding-agent/
│   ├── coding-agent.service.ts     # Agent orchestration
│   └── coding-agent.types.ts
└── workflows/
    ├── workflows.service.ts        # Workflow CRUD
    ├── workflows.schema.ts         # Drizzle schema
    └── workflows.types.ts
```

### Pattern 1: React Flow Custom Nodes
**What:** Create typed custom nodes for workflow blocks
**When to use:** Each block type (check-in, escalation, role, visibility)
**Example:**
```typescript
// Source: https://reactflow.dev/learn/customization/custom-nodes
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react';

type CheckInNodeData = {
  label: string;
  frequency: 'daily' | 'weekly';
  time: string;
  squadId?: string;
};

type CheckInNode = Node<CheckInNodeData, 'checkIn'>;

export function CheckInNode({ data, selected }: NodeProps<CheckInNode>) {
  return (
    <div className={cn('rounded border p-3', selected && 'ring-2 ring-blue-500')}>
      <Handle type="target" position={Position.Top} />
      <div className="font-medium">{data.label}</div>
      <div className="text-sm text-muted-foreground">
        {data.frequency} at {data.time}
      </div>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}

// Register node types outside component
const nodeTypes = {
  checkIn: CheckInNode,
  escalation: EscalationNode,
  role: RoleNode,
  visibility: VisibilityNode,
};
```

### Pattern 2: Dagre Tree Layout
**What:** Auto-position nodes in tree hierarchy
**When to use:** When workflow is saved or modified
**Example:**
```typescript
// Source: https://reactflow.dev/examples/layout/dagre
import dagre from '@dagrejs/dagre';
import type { Node, Edge } from '@xyflow/react';

const NODE_WIDTH = 200;
const NODE_HEIGHT = 80;

export function getLayoutedElements(
  nodes: Node[],
  edges: Edge[],
  direction: 'TB' | 'LR' = 'TB'
): { nodes: Node[]; edges: Edge[] } {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({ rankdir: direction });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    return {
      ...node,
      position: {
        x: nodeWithPosition.x - NODE_WIDTH / 2,
        y: nodeWithPosition.y - NODE_HEIGHT / 2,
      },
    };
  });

  return { nodes: layoutedNodes, edges };
}
```

### Pattern 3: Drag and Drop from Sidebar
**What:** Add new nodes by dragging from palette
**When to use:** Visual editor block palette
**Example:**
```typescript
// Source: https://reactflow.dev/examples/interaction/drag-and-drop
import { useReactFlow, type XYPosition } from '@xyflow/react';
import { useCallback, useState } from 'react';

export function useDragToCanvas() {
  const { screenToFlowPosition, setNodes } = useReactFlow();
  const [isDragging, setIsDragging] = useState(false);
  const [nodeType, setNodeType] = useState<string | null>(null);

  const onDragStart = useCallback(
    (event: React.PointerEvent, type: string) => {
      event.preventDefault();
      (event.target as HTMLElement).setPointerCapture(event.pointerId);
      setIsDragging(true);
      setNodeType(type);
    },
    []
  );

  const onDragEnd = useCallback(
    (event: PointerEvent) => {
      setIsDragging(false);
      if (!nodeType) return;

      const target = document.elementFromPoint(event.clientX, event.clientY);
      if (!target?.closest('.react-flow')) return;

      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const newNode = {
        id: `${nodeType}-${Date.now()}`,
        type: nodeType,
        position,
        data: { label: `New ${nodeType}` },
      };

      setNodes((nodes) => [...nodes, newNode]);
      setNodeType(null);
    },
    [nodeType, screenToFlowPosition, setNodes]
  );

  return { onDragStart, onDragEnd, isDragging };
}
```

### Pattern 4: Linear Webhook Handler
**What:** Process Linear webhooks for bidirectional sync
**When to use:** Real-time updates from Linear
**Example:**
```typescript
// Source: https://linear.app/developers/webhooks
import { createHmac, timingSafeEqual } from 'crypto';
import type { Context } from 'hono';

interface LinearWebhookPayload {
  action: 'create' | 'update' | 'remove';
  type: string;
  data: Record<string, unknown>;
  updatedFrom?: Record<string, unknown>;
  webhookTimestamp: number;
  webhookId: string;
  organizationId: string;
}

export async function verifyLinearWebhook(
  body: string,
  signature: string,
  secret: string
): Promise<boolean> {
  const hmac = createHmac('sha256', secret);
  hmac.update(body);
  const digest = hmac.digest('hex');

  return timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(digest)
  );
}

export async function handleLinearWebhook(
  c: Context,
  payload: LinearWebhookPayload
) {
  const { action, type, data, updatedFrom } = payload;

  if (type !== 'Issue') return;

  switch (action) {
    case 'create':
      // Check if issue exists in our system
      // If not created by us, sync to local
      break;
    case 'update':
      // Last-write-wins: compare timestamps
      // updatedFrom shows previous values
      break;
    case 'remove':
      // Mark local task as deleted/archived
      break;
  }
}
```

### Pattern 5: Linear SDK Issue Operations
**What:** Create/update issues via Linear SDK
**When to use:** Syncing BlockBot tasks to Linear
**Example:**
```typescript
// Source: https://linear.app/developers/sdk
import { LinearClient } from '@linear/sdk';

export function createLinearClient(apiKey: string): LinearClient {
  return new LinearClient({ apiKey });
}

export async function createLinearIssue(
  client: LinearClient,
  params: {
    teamId: string;
    title: string;
    description?: string;
    assigneeId?: string;
    stateId?: string;
    priority?: number;
  }
) {
  const result = await client.createIssue({
    teamId: params.teamId,
    title: params.title,
    description: params.description,
    assigneeId: params.assigneeId,
    stateId: params.stateId,
    priority: params.priority,
  });

  if (!result.success) {
    throw new Error('Failed to create Linear issue');
  }

  const issue = await result.issue;
  return {
    id: issue?.id,
    identifier: issue?.identifier,
    url: issue?.url,
  };
}

export async function updateLinearIssue(
  client: LinearClient,
  issueId: string,
  updates: {
    title?: string;
    description?: string;
    stateId?: string;
    assigneeId?: string;
  }
) {
  const result = await client.updateIssue(issueId, updates);
  return result.success;
}
```

### Pattern 6: GitHub App Authentication
**What:** Generate installation access tokens for PR creation
**When to use:** Coding agent needs repo access
**Example:**
```typescript
// Source: https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app
import { createAppAuth } from '@octokit/auth-app';
import { Octokit } from '@octokit/rest';
import * as jose from 'jose';

interface GitHubAppConfig {
  appId: string;
  privateKey: string;
  installationId: number;
}

export async function createGitHubAppClient(config: GitHubAppConfig) {
  const auth = createAppAuth({
    appId: config.appId,
    privateKey: config.privateKey,
    installationId: config.installationId,
  });

  const { token } = await auth({ type: 'installation' });

  return new Octokit({ auth: token });
}

export async function createPullRequest(
  octokit: Octokit,
  params: {
    owner: string;
    repo: string;
    title: string;
    body: string;
    head: string;  // Branch with changes
    base: string;  // Target branch (e.g., 'main')
    draft?: boolean;
  }
) {
  const { data } = await octokit.pulls.create({
    owner: params.owner,
    repo: params.repo,
    title: params.title,
    body: params.body,
    head: params.head,
    base: params.base,
    draft: params.draft ?? true,
  });

  return {
    number: data.number,
    url: data.html_url,
    state: data.state,
  };
}
```

### Pattern 7: Claude Agent SDK for Coding Agent
**What:** Spawn coding agent to create PRs
**When to use:** Lead authorizes bug fix
**Example:**
```typescript
// Source: https://platform.claude.com/docs/en/agent-sdk/overview
import { query, ClaudeAgentOptions } from '@anthropic-ai/claude-agent-sdk';

interface CodingAgentInput {
  taskDescription: string;
  repoPath: string;
  branchName: string;
}

export async function runCodingAgent(input: CodingAgentInput): Promise<string> {
  let result = '';

  for await (const message of query({
    prompt: `Fix the following issue and commit your changes:

Task: ${input.taskDescription}

Work in: ${input.repoPath}
Create branch: ${input.branchName}

After fixing:
1. Stage your changes
2. Commit with a descriptive message
3. Report what you changed`,
    options: {
      cwd: input.repoPath,
      allowedTools: ['Read', 'Edit', 'Write', 'Bash', 'Glob', 'Grep'],
      permissionMode: 'acceptEdits',
    } as ClaudeAgentOptions,
  })) {
    if ('result' in message) {
      result = message.result;
    }
  }

  return result;
}
```

### Pattern 8: Natural Language Task Creation
**What:** Detect task creation intent and extract fields
**When to use:** User sends message that might be a task request
**Example:**
```typescript
// Source: Existing pattern from messaging.intents.ts
const CREATE_TASK_FUNCTION = {
  name: 'create_task_from_message',
  description: 'Extract task details from natural language',
  parameters: {
    type: 'object',
    properties: {
      isTaskCreation: {
        type: 'boolean',
        description: 'Whether user wants to create a task',
      },
      title: {
        type: 'string',
        description: 'Extracted task title',
      },
      description: {
        type: 'string',
        description: 'Task description or context',
      },
      assigneeHint: {
        type: 'string',
        description: 'Person name if mentioned',
      },
      dueDate: {
        type: 'string',
        description: 'Due date hint (e.g., "tomorrow", "next week")',
      },
      priority: {
        type: 'string',
        enum: ['low', 'medium', 'high', 'urgent'],
      },
      confidence: {
        type: 'number',
        description: 'Confidence score 0-1',
      },
    },
    required: ['isTaskCreation', 'confidence'],
  },
};

export async function extractTaskFromMessage(
  message: string
): Promise<TaskExtractionResult> {
  const client = createLLMClient();

  const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: `Extract task creation intent from user messages.
Examples:
- "Create a task to review the PR" -> task creation
- "We need to fix the login bug by Friday" -> task creation
- "What's the status?" -> not task creation`,
      },
      { role: 'user', content: message },
    ],
    tools: [{ type: 'function', function: CREATE_TASK_FUNCTION }],
    tool_choice: { type: 'function', function: { name: 'create_task_from_message' } },
  });

  // Parse and return...
}
```

### Anti-Patterns to Avoid
- **Storing React Flow state in URL**: State can be large; use server persistence instead
- **Polling Linear for changes**: Use webhooks for real-time sync, not polling
- **Storing GitHub tokens long-term**: Installation tokens expire in 1 hour; generate fresh
- **Auto-creating tasks without confirmation**: Always show user what will be created
- **Syncing all Linear fields**: Keep sync surface minimal to avoid complexity

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Node layout | Manual positioning | dagre | Edge cases with overlapping, hierarchy |
| Drag-drop | Raw DOM events | React Flow's built-in + pointer events | Touch support, edge cases |
| Linear auth | Raw OAuth | @linear/sdk | Token refresh, error handling |
| GitHub JWT | Manual signing | @octokit/auth-app | Key format handling, expiry |
| Webhook verification | Manual HMAC | Library helpers | Timing attacks, encoding |
| Tree persistence | Custom format | JSON with node/edge arrays | React Flow imports natively |

**Key insight:** Integration libraries handle edge cases around auth token expiry, rate limiting, and retry logic that are tedious to implement correctly.

## Common Pitfalls

### Pitfall 1: React Flow nodeTypes Re-creation
**What goes wrong:** Nodes flicker or lose state on every render
**Why it happens:** nodeTypes object is recreated, causing React Flow to unmount/remount
**How to avoid:** Define nodeTypes outside component or useMemo with empty deps
**Warning signs:** Nodes flash or inputs lose focus

### Pitfall 2: Linear Webhook Race Conditions
**What goes wrong:** Duplicate issues or lost updates during bidirectional sync
**Why it happens:** Webhook arrives while local update is in flight
**How to avoid:** Store sync metadata (linearIssueId, lastSyncedAt) on tasks; use idempotency keys
**Warning signs:** Duplicate tasks appearing, changes reverting

### Pitfall 3: GitHub Installation Token Expiry
**What goes wrong:** API calls fail with 401 after ~1 hour
**Why it happens:** Installation tokens expire, cached token used
**How to avoid:** Generate fresh token per operation or implement token refresh
**Warning signs:** Operations work initially then fail

### Pitfall 4: Dagre Layout Not Updating
**What goes wrong:** New nodes appear at wrong positions
**Why it happens:** Dagre example is static; doesn't recalculate on changes
**How to avoid:** Call layout function in useEffect when nodes/edges change
**Warning signs:** Nodes pile up in one corner

### Pitfall 5: LLM Task Extraction Hallucinations
**What goes wrong:** Tasks created with fabricated details
**Why it happens:** LLM invents missing fields instead of leaving empty
**How to avoid:** Require confirmation UI; don't auto-create; use confidence threshold
**Warning signs:** Tasks with suspiciously complete details from vague messages

## Code Examples

Verified patterns from official sources:

### Workflow Canvas Setup
```typescript
// Source: https://reactflow.dev
import {
  ReactFlow,
  Controls,
  Background,
  type Node,
  type Edge,
  type OnNodesChange,
  type OnEdgesChange,
  applyNodeChanges,
  applyEdgeChanges,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useCallback, useState } from 'react';

// Define outside component
const nodeTypes = {
  checkIn: CheckInNode,
  escalation: EscalationNode,
  role: RoleNode,
  visibility: VisibilityNode,
};

type WorkflowNode = Node<CheckInNodeData | EscalationNodeData, string>;

export function WorkflowCanvas({ initialNodes, initialEdges }: Props) {
  const [nodes, setNodes] = useState<WorkflowNode[]>(initialNodes);
  const [edges, setEdges] = useState<Edge[]>(initialEdges);

  const onNodesChange: OnNodesChange<WorkflowNode> = useCallback(
    (changes) => setNodes((nds) => applyNodeChanges(changes, nds)),
    []
  );

  const onEdgesChange: OnEdgesChange = useCallback(
    (changes) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    []
  );

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      nodeTypes={nodeTypes}
      fitView
    >
      <Controls />
      <Background />
    </ReactFlow>
  );
}
```

### Linear Bidirectional Sync Service
```typescript
// Source: https://linear.app/developers
interface SyncMetadata {
  linearIssueId?: string;
  linearTeamId?: string;
  lastSyncedAt?: Date;
  syncDirection: 'to_linear' | 'from_linear' | 'bidirectional';
}

export async function syncTaskToLinear(
  task: Task,
  linearClient: LinearClient,
  teamId: string
): Promise<SyncMetadata> {
  if (task.metadata?.linearIssueId) {
    // Update existing
    await updateLinearIssue(linearClient, task.metadata.linearIssueId, {
      title: task.title,
      description: task.description,
      stateId: mapStatusToLinearState(task.status),
    });
  } else {
    // Create new
    const issue = await createLinearIssue(linearClient, {
      teamId,
      title: task.title,
      description: task.description,
    });

    // Store Linear ID on task
    await updateTaskMetadata(task.id, {
      linearIssueId: issue.id,
      linearTeamId: teamId,
      lastSyncedAt: new Date(),
    });
  }

  return { linearIssueId: task.metadata?.linearIssueId, lastSyncedAt: new Date() };
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| reactflow (v11) | @xyflow/react (v12) | 2024 | New package name, breaking changes |
| Linear REST API | Linear GraphQL | Deprecated | GraphQL is the only supported API |
| GitHub PAT | GitHub App | 2023+ | Fine-grained permissions, better security |
| gpt-4 for intent | gpt-4o-mini | 2024 | 10x cheaper, similar accuracy |

**Deprecated/outdated:**
- `reactflow` package: Use `@xyflow/react` instead
- Linear REST endpoints: Use GraphQL API only
- GitHub classic PATs for apps: Use GitHub Apps with installation tokens

## Open Questions

Things that couldn't be fully resolved:

1. **Claude Agent SDK subprocess vs API**
   - What we know: SDK supports Python and TypeScript; can spawn subagents
   - What's unclear: Exact pricing model for programmatic usage
   - Recommendation: Use SDK API approach; configure allowed tools carefully

2. **Linear rate limits for webhook registration**
   - What we know: API is rate-limited
   - What's unclear: Specific limits for webhook operations
   - Recommendation: Cache webhook registrations; batch updates

3. **GitHub App installation UX**
   - What we know: Users install app via GitHub UI
   - What's unclear: Best flow for multi-repo access
   - Recommendation: Start with single-repo linking; expand later

## Sources

### Primary (HIGH confidence)
- [React Flow Documentation](https://reactflow.dev) - Custom nodes, TypeScript, drag-drop
- [Linear Developer Documentation](https://linear.app/developers) - SDK, webhooks, GraphQL
- [GitHub Apps Documentation](https://docs.github.com/en/apps) - Authentication, permissions
- [Claude Agent SDK](https://platform.claude.com/docs/en/agent-sdk/overview) - Agent spawning

### Secondary (MEDIUM confidence)
- [dagre.js GitHub](https://github.com/dagrejs/dagre) - Layout algorithm usage
- [Octokit Documentation](https://github.com/octokit) - GitHub API client

### Tertiary (LOW confidence)
- WebSearch results for best practices (patterns verified with official docs)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Official documentation verified
- Architecture: HIGH - Based on official examples and project patterns
- React Flow patterns: HIGH - From official docs and examples
- Linear integration: HIGH - Official SDK and webhook docs
- GitHub App auth: HIGH - Official GitHub documentation
- Claude Agent SDK: MEDIUM - New SDK, docs verified but limited examples
- Pitfalls: MEDIUM - Combination of official warnings and community patterns

**Research date:** 2026-02-06
**Valid until:** 2026-03-06 (30 days - stable technologies)
