import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { hashPassword } from './features/auth/auth.service';
import { PRESET_TEMPLATES } from './features/deliverables/deliverable-presets';
import { db, pgClient, schema } from './shared/db';

const PASSWORD = 'password123';

async function seed() {
  console.log('🌱 Seeding database...\n');

  // Idempotency check
  const existing = await db
    .select()
    .from(schema.organizations)
    .where(eq(schema.organizations.name, 'Acme Corp'))
    .limit(1);

  if (existing.length > 0) {
    console.log('Seed data already exists (found "Acme Corp"). Skipping.');
    await pgClient.end();
    return;
  }

  const passwordHash = await hashPassword(PASSWORD);
  const now = new Date();
  const daysAgo = (n: number) => new Date(now.getTime() - n * 86400000);
  const daysFromNow = (n: number) => new Date(now.getTime() + n * 86400000);

  // ──────────────────────────────────────────────────
  // 1. Organization
  // ──────────────────────────────────────────────────
  console.log('Creating organization...');
  const [org] = await db.insert(schema.organizations).values({ name: 'Acme Corp' }).returning();
  if (!org) throw new Error('Failed to create organization');

  // ──────────────────────────────────────────────────
  // 2. Users
  // ──────────────────────────────────────────────────
  console.log('Creating users...');
  const users = await db
    .insert(schema.users)
    .values([
      { email: 'admin@acme.dev', orgId: org.id, passwordHash, emailVerified: true },
      { email: 'pm@acme.dev', orgId: org.id, passwordHash, emailVerified: true },
      { email: 'lead@acme.dev', orgId: org.id, passwordHash, emailVerified: true },
      { email: 'dev1@acme.dev', orgId: org.id, passwordHash, emailVerified: true },
      { email: 'dev2@acme.dev', orgId: org.id, passwordHash, emailVerified: true },
    ])
    .returning();
  const [admin, pm, lead, dev1, dev2] = users as [
    (typeof users)[0],
    (typeof users)[0],
    (typeof users)[0],
    (typeof users)[0],
    (typeof users)[0],
  ];
  console.log(`  Created ${users.length} users`);

  // ──────────────────────────────────────────────────
  // 3. Project
  // ──────────────────────────────────────────────────
  console.log('Creating project...');
  const [project] = await db
    .insert(schema.projects)
    .values({
      orgId: org.id,
      name: 'BlockBot v2',
      description: 'Next-generation project management agent with AI-powered workflows',
    })
    .returning();
  if (!project) throw new Error('Failed to create project');

  // ──────────────────────────────────────────────────
  // 4. Project Members
  // ──────────────────────────────────────────────────
  console.log('Creating project members...');
  await db.insert(schema.projectMembers).values([
    { projectId: project.id, userId: admin.id, role: 'admin' },
    { projectId: project.id, userId: pm.id, role: 'pm', reportsToUserId: admin.id },
    { projectId: project.id, userId: lead.id, role: 'squad_lead', reportsToUserId: pm.id },
    { projectId: project.id, userId: dev1.id, role: 'member', reportsToUserId: lead.id },
    { projectId: project.id, userId: dev2.id, role: 'member', reportsToUserId: lead.id },
  ]);

  // ──────────────────────────────────────────────────
  // 5. Squads
  // ──────────────────────────────────────────────────
  console.log('Creating squads...');
  const [frontend] = await db
    .insert(schema.squads)
    .values({ projectId: project.id, name: 'Frontend', leadUserId: lead.id })
    .returning();
  if (!frontend) throw new Error('Failed to create frontend squad');

  const [backendSquad] = await db
    .insert(schema.squads)
    .values({ projectId: project.id, name: 'Backend', leadUserId: pm.id })
    .returning();
  if (!backendSquad) throw new Error('Failed to create backend squad');

  const [designSquad] = await db
    .insert(schema.squads)
    .values({
      projectId: project.id,
      name: 'Design',
      leadUserId: dev2.id,
      parentSquadId: frontend.id,
    })
    .returning();
  if (!designSquad) throw new Error('Failed to create design squad');

  // ──────────────────────────────────────────────────
  // 6. Squad Members
  // ──────────────────────────────────────────────────
  console.log('Creating squad members...');
  await db.insert(schema.squadMembers).values([
    { squadId: frontend.id, userId: lead.id },
    { squadId: frontend.id, userId: dev1.id },
    { squadId: frontend.id, userId: dev2.id },
    { squadId: backendSquad.id, userId: pm.id },
    { squadId: backendSquad.id, userId: dev1.id },
    { squadId: designSquad.id, userId: dev2.id },
  ]);

  // ──────────────────────────────────────────────────
  // 7. Tasks
  // ──────────────────────────────────────────────────
  console.log('Creating tasks...');
  type Priority = 'low' | 'medium' | 'high' | 'urgent';
  type Status = 'todo' | 'in_progress' | 'done';
  const t = (v: {
    projectId: string;
    squadId: string | null;
    title: string;
    description: string;
    priority: Priority;
    status: Status;
    assigneeId: string | null;
    createdById: string;
    dueDate?: Date;
    completedAt?: Date;
  }) => v;

  const createdTasks = await db
    .insert(schema.tasks)
    .values([
      t({
        projectId: project.id,
        squadId: frontend.id,
        title: 'Implement kanban board drag-and-drop',
        description: 'Add drag-and-drop reordering for tasks on the kanban board using dnd-kit',
        priority: 'high',
        status: 'in_progress',
        assigneeId: dev1.id,
        createdById: pm.id,
        dueDate: daysFromNow(3),
      }),
      t({
        projectId: project.id,
        squadId: frontend.id,
        title: 'Fix dark mode color contrast issues',
        description: 'Several text elements have low contrast in dark mode. Audit and fix.',
        priority: 'medium',
        status: 'todo',
        assigneeId: dev2.id,
        createdById: lead.id,
        dueDate: daysFromNow(7),
      }),
      t({
        projectId: project.id,
        squadId: backendSquad.id,
        title: 'Add rate limiting to chat endpoint',
        description:
          'Implement token-bucket rate limiting for the AI chat endpoint to prevent abuse',
        priority: 'urgent',
        status: 'in_progress',
        assigneeId: pm.id,
        createdById: admin.id,
        dueDate: daysFromNow(1),
      }),
      t({
        projectId: project.id,
        squadId: backendSquad.id,
        title: 'Set up database backup cron job',
        description: 'Configure automated daily pg_dump backups to S3',
        priority: 'high',
        status: 'todo',
        assigneeId: dev1.id,
        createdById: pm.id,
        dueDate: daysFromNow(5),
      }),
      t({
        projectId: project.id,
        squadId: frontend.id,
        title: 'Build notification preferences UI',
        description: 'Create settings page where users can toggle notification channels and types',
        priority: 'medium',
        status: 'todo',
        assigneeId: null,
        createdById: pm.id,
        dueDate: daysFromNow(14),
      }),
      t({
        projectId: project.id,
        squadId: designSquad.id,
        title: 'Design onboarding flow mockups',
        description: 'Create Figma mockups for the new user onboarding experience',
        priority: 'high',
        status: 'done',
        assigneeId: dev2.id,
        createdById: pm.id,
        completedAt: daysAgo(2),
      }),
      t({
        projectId: project.id,
        squadId: backendSquad.id,
        title: 'Migrate to Argon2id for password hashing',
        description: 'Replace bcrypt with Argon2id across all auth flows',
        priority: 'medium',
        status: 'done',
        assigneeId: pm.id,
        createdById: admin.id,
        completedAt: daysAgo(5),
      }),
      t({
        projectId: project.id,
        squadId: frontend.id,
        title: 'Add real-time task status updates via WebSocket',
        description:
          'Implement WebSocket connection so board updates in real-time when tasks change',
        priority: 'low',
        status: 'todo',
        assigneeId: dev1.id,
        createdById: lead.id,
        dueDate: daysFromNow(21),
      }),
      t({
        projectId: project.id,
        squadId: null,
        title: 'Write API documentation for v2 endpoints',
        description: 'Document all new v2 API endpoints with request/response examples in OpenAPI',
        priority: 'low',
        status: 'in_progress',
        assigneeId: admin.id,
        createdById: admin.id,
        dueDate: daysAgo(1),
      }),
      t({
        projectId: project.id,
        squadId: frontend.id,
        title: 'Implement file upload for task attachments',
        description: 'Add drag-and-drop file upload to task detail view with S3 presigned URLs',
        priority: 'medium',
        status: 'todo',
        assigneeId: lead.id,
        createdById: pm.id,
        dueDate: daysAgo(3),
      }),
    ])
    .returning();
  console.log(`  Created ${createdTasks.length} tasks`);

  // ──────────────────────────────────────────────────
  // 8. Workflow
  // ──────────────────────────────────────────────────
  console.log('Creating workflow...');
  const checkInNodeId = randomUUID();
  const escalationNodeId = randomUUID();
  const roleNodeId = randomUUID();
  const visibilityNodeId = randomUUID();

  await db.insert(schema.workflows).values({
    projectId: project.id,
    name: 'BlockBot v2 Workflow',
    nodes: [
      {
        id: checkInNodeId,
        type: 'checkIn',
        position: { x: 100, y: 150 },
        data: { label: 'Daily Standup', frequency: 'daily', time: '09:00' },
      },
      {
        id: escalationNodeId,
        type: 'escalation',
        position: { x: 400, y: 150 },
        data: { label: 'Blocker Escalation', triggerType: 'blocked_task', steps: [] },
      },
      {
        id: roleNodeId,
        type: 'role',
        position: { x: 250, y: 350 },
        data: {
          label: 'Squad Lead Review',
          roleName: 'squad_lead',
          tier: 3,
          capabilities: ['assign_task'],
        },
      },
      {
        id: visibilityNodeId,
        type: 'visibility',
        position: { x: 550, y: 350 },
        data: { label: 'PM Dashboard', scope: 'project', grants: [] },
      },
    ],
    edges: [
      { id: `e-${randomUUID()}`, source: checkInNodeId, target: roleNodeId, type: 'default' },
      {
        id: `e-${randomUUID()}`,
        source: roleNodeId,
        target: escalationNodeId,
        type: 'default',
      },
      {
        id: `e-${randomUUID()}`,
        source: escalationNodeId,
        target: visibilityNodeId,
        type: 'default',
      },
    ],
  });

  // ──────────────────────────────────────────────────
  // 9. Check-in Blocks
  // ──────────────────────────────────────────────────
  console.log('Creating check-in blocks...');
  await db.insert(schema.checkInBlocks).values([
    {
      projectId: project.id,
      createdById: pm.id,
      name: 'Daily Team Standup',
      description: 'Morning check-in for all team members',
      cronPattern: '0 9 * * 1-5',
      timezone: 'America/New_York',
      templateId: 'daily_standup',
      questions: [
        {
          id: randomUUID(),
          text: 'What did you accomplish yesterday?',
          type: 'text',
          required: true,
        },
        { id: randomUUID(), text: 'What are you working on today?', type: 'text', required: true },
        { id: randomUUID(), text: 'Any blockers or concerns?', type: 'text', required: false },
      ],
      targetType: 'all',
      enabled: true,
    },
    {
      projectId: project.id,
      createdById: pm.id,
      name: 'Output Tracker',
      description: 'Track daily output count for all developers',
      cronPattern: '0 17 * * 1-5',
      timezone: 'America/New_York',
      templateId: 'output_count',
      questions: [
        {
          id: randomUUID(),
          text: 'How many items did you complete today?',
          type: 'number',
          required: true,
        },
        { id: randomUUID(), text: 'Are you blocked on anything?', type: 'boolean', required: true },
        {
          id: randomUUID(),
          text: 'If blocked, describe the issue:',
          type: 'text',
          required: false,
        },
      ],
      targetType: 'role',
      targetRole: 'member',
      enabled: true,
    },
    {
      projectId: project.id,
      createdById: admin.id,
      name: 'Weekly Forecast',
      description: 'Friday afternoon recap and next week planning',
      cronPattern: '0 16 * * 5',
      timezone: 'America/New_York',
      templateId: 'weekly_forecast',
      questions: [
        { id: randomUUID(), text: 'Key accomplishments this week:', type: 'text', required: true },
        { id: randomUUID(), text: 'Goals for next week:', type: 'text', required: true },
        { id: randomUUID(), text: 'Expected deliverable count:', type: 'number', required: false },
        { id: randomUUID(), text: 'Risks or concerns:', type: 'text', required: false },
      ],
      targetType: 'all',
      enabled: true,
    },
  ]);
  console.log('  Created 3 check-in blocks');

  // ──────────────────────────────────────────────────
  // 10. Escalation Blocks
  // ──────────────────────────────────────────────────
  console.log('Creating escalation blocks...');
  await db.insert(schema.escalationBlocks).values([
    {
      projectId: project.id,
      createdById: admin.id,
      name: 'Critical Blocker Escalation',
      description: 'Escalate unresolved blockers through management chain',
      triggerType: 'blocker_reported',
      escalationSteps: [
        {
          delayMinutes: 0,
          routeType: 'reports_to',
          message: 'Team member is blocked. Please assist.',
        },
        {
          delayMinutes: 240,
          routeType: 'role',
          routeRole: 'pm',
          message: 'Blocker unresolved for 4 hours. PM attention needed.',
        },
        {
          delayMinutes: 1440,
          routeType: 'role',
          routeRole: 'admin',
          message: 'Critical blocker unresolved for 24 hours!',
        },
      ],
      targetType: 'all',
      enabled: true,
    },
    {
      projectId: project.id,
      createdById: pm.id,
      name: 'Deadline Risk Warning',
      description: 'Notify when tasks are approaching due date',
      triggerType: 'deadline_risk',
      deadlineWarningDays: 3,
      escalationSteps: [
        {
          delayMinutes: 0,
          routeType: 'reports_to',
          message: 'Task deadline approaching in 3 days.',
        },
        {
          delayMinutes: 1440,
          routeType: 'role',
          routeRole: 'pm',
          message: 'Task deadline is tomorrow and may be at risk.',
        },
      ],
      targetType: 'all',
      enabled: true,
    },
    {
      projectId: project.id,
      createdById: admin.id,
      name: 'Low Output Alert',
      description: 'Alert when team member output falls below threshold',
      triggerType: 'output_below_threshold',
      outputThreshold: 3,
      outputPeriodDays: 7,
      escalationSteps: [
        {
          delayMinutes: 0,
          routeType: 'role',
          routeRole: 'squad_lead',
          message: 'Team member completed fewer than 3 tasks this week.',
        },
        {
          delayMinutes: 2880,
          routeType: 'role',
          routeRole: 'pm',
          message: 'Low output persists for 2+ days. PM review needed.',
        },
      ],
      targetType: 'all',
      enabled: true,
    },
  ]);
  console.log('  Created 3 escalation blocks');

  // ──────────────────────────────────────────────────
  // 11. Deliverable Types (from presets)
  // ──────────────────────────────────────────────────
  console.log('Creating deliverable types...');
  const presetEntries: { key: string; name: string; icon: string }[] = [
    { key: 'bug', name: 'Bug', icon: '🐛' },
    { key: 'feature', name: 'Feature', icon: '✨' },
    { key: 'design', name: 'Design', icon: '🎨' },
  ];

  const deliverableTypes: { id: string; key: string }[] = [];
  for (const entry of presetEntries) {
    const config = PRESET_TEMPLATES[entry.key];
    if (!config) continue;
    const [dt] = await db
      .insert(schema.deliverableTypes)
      .values({
        projectId: project.id,
        name: entry.name,
        icon: entry.icon,
        config,
        isPreset: true,
      })
      .returning();
    if (dt) deliverableTypes.push({ id: dt.id, key: entry.key });
  }
  console.log(`  Created ${deliverableTypes.length} deliverable types`);

  const bugTypeId = deliverableTypes.find((d) => d.key === 'bug')?.id;
  const featureTypeId = deliverableTypes.find((d) => d.key === 'feature')?.id;
  const designTypeId = deliverableTypes.find((d) => d.key === 'design')?.id;

  // ──────────────────────────────────────────────────
  // 12. Deliverables
  // ──────────────────────────────────────────────────
  console.log('Creating deliverables...');
  const deliverables = [];

  if (bugTypeId) {
    deliverables.push(
      {
        projectId: project.id,
        squadId: frontend.id,
        deliverableTypeId: bugTypeId,
        title: 'Login page crashes on Safari 17',
        description: 'Users on Safari 17 see a blank white screen after submitting credentials',
        status: 'in_progress',
        assigneeId: dev1.id,
        createdById: pm.id,
        dueDate: daysFromNow(2),
        customFieldValues: { severity: 'critical', environment: 'production' },
      },
      {
        projectId: project.id,
        squadId: backendSquad.id,
        deliverableTypeId: bugTypeId,
        title: 'Rate limiter returns 500 instead of 429',
        description:
          'When rate limit is exceeded, the API returns 500 Internal Server Error instead of 429 Too Many Requests',
        status: 'open',
        assigneeId: pm.id,
        createdById: admin.id,
        dueDate: daysFromNow(5),
        customFieldValues: { severity: 'major', environment: 'staging' },
      },
      {
        projectId: project.id,
        squadId: frontend.id,
        deliverableTypeId: bugTypeId,
        title: 'Dark mode toggle persists incorrectly',
        description: 'Theme reverts to light mode on page refresh in some browsers',
        status: 'resolved',
        assigneeId: dev2.id,
        createdById: lead.id,
        completedAt: daysAgo(1),
        customFieldValues: { severity: 'minor', environment: 'production' },
      }
    );
  }

  if (featureTypeId) {
    deliverables.push(
      {
        projectId: project.id,
        squadId: frontend.id,
        deliverableTypeId: featureTypeId,
        title: 'AI Chat Interface',
        description: 'Build the conversational AI chat interface for project management queries',
        status: 'development',
        assigneeId: dev1.id,
        createdById: pm.id,
        dueDate: daysFromNow(10),
        customFieldValues: { story_points: 8 },
      },
      {
        projectId: project.id,
        squadId: backendSquad.id,
        deliverableTypeId: featureTypeId,
        title: 'WhatsApp Integration',
        description: 'Enable users to interact with BlockBot via WhatsApp messages',
        status: 'spec',
        assigneeId: pm.id,
        createdById: admin.id,
        dueDate: daysFromNow(21),
        customFieldValues: { story_points: 13 },
      },
      {
        projectId: project.id,
        squadId: null,
        deliverableTypeId: featureTypeId,
        title: 'Automated Weekly Recap Email',
        description: 'Generate and send automated weekly recap emails to all team members',
        status: 'done',
        assigneeId: pm.id,
        createdById: admin.id,
        completedAt: daysAgo(3),
        customFieldValues: { story_points: 5 },
      }
    );
  }

  if (designTypeId) {
    deliverables.push(
      {
        projectId: project.id,
        squadId: designSquad.id,
        deliverableTypeId: designTypeId,
        title: 'Dashboard Redesign',
        description: 'Redesign the main dashboard with new data visualization components',
        status: 'refinement',
        assigneeId: dev2.id,
        createdById: pm.id,
        dueDate: daysFromNow(7),
        customFieldValues: { design_type: 'UI/UX', figma_url: 'https://figma.com/file/example' },
      },
      {
        projectId: project.id,
        squadId: designSquad.id,
        deliverableTypeId: designTypeId,
        title: 'Mobile App Icon Set',
        description: 'Create icon set for the upcoming mobile app',
        status: 'approved',
        assigneeId: dev2.id,
        createdById: lead.id,
        completedAt: daysAgo(4),
        customFieldValues: { design_type: 'Graphic' },
      }
    );
  }

  if (deliverables.length > 0) {
    await db.insert(schema.deliverables).values(deliverables);
  }
  console.log(`  Created ${deliverables.length} deliverables`);

  // ──────────────────────────────────────────────────
  // 13. Comments on tasks
  // ──────────────────────────────────────────────────
  console.log('Creating comments...');
  const task0 = createdTasks[0];
  const task2 = createdTasks[2];
  const task8 = createdTasks[8];

  const commentValues = [];
  if (task0) {
    commentValues.push(
      {
        projectId: project.id,
        targetType: 'task',
        targetId: task0.id,
        content:
          "I've started on this. Using @dnd-kit/core for the drag logic. Should have a prototype by EOD.",
        authorId: dev1.id,
        mentions: [] as string[],
      },
      {
        projectId: project.id,
        targetType: 'task',
        targetId: task0.id,
        content: 'Make sure we handle the mobile touch events too. Check how Trello does it.',
        authorId: lead.id,
        mentions: [dev1.id],
      }
    );
  }
  if (task2) {
    commentValues.push({
      projectId: project.id,
      targetType: 'task',
      targetId: task2.id,
      content:
        'Using Redis token-bucket. Set to 60 requests/min per user. Let me know if we need different limits.',
      authorId: pm.id,
      mentions: [admin.id],
    });
  }
  if (task8) {
    commentValues.push({
      projectId: project.id,
      targetType: 'task',
      targetId: task8.id,
      content: 'This is overdue. Can we prioritize it this week?',
      authorId: pm.id,
      mentions: [admin.id],
    });
  }

  if (commentValues.length > 0) {
    await db.insert(schema.comments).values(commentValues);
  }
  console.log(`  Created ${commentValues.length} comments`);

  // ──────────────────────────────────────────────────
  // 14. Custom Fields
  // ──────────────────────────────────────────────────
  console.log('Creating custom fields...');
  await db.insert(schema.customFields).values([
    {
      projectId: project.id,
      name: 'Sprint',
      type: 'select',
      config: { options: ['Sprint 1', 'Sprint 2', 'Sprint 3', 'Backlog'] },
      required: false,
      appliesToTasks: true,
      appliesToDeliverables: false,
    },
    {
      projectId: project.id,
      name: 'Effort Estimate',
      type: 'number',
      config: { min: 1, max: 21 },
      required: false,
      appliesToTasks: true,
      appliesToDeliverables: true,
    },
    {
      projectId: project.id,
      name: 'Release Version',
      type: 'text',
      config: {},
      required: false,
      appliesToTasks: false,
      appliesToDeliverables: true,
    },
  ]);
  console.log('  Created 3 custom fields');

  // ──────────────────────────────────────────────────
  // 15. Blockers
  // ──────────────────────────────────────────────────
  console.log('Creating blockers...');
  await db.insert(schema.blockers).values([
    {
      projectId: project.id,
      reportedById: dev1.id,
      taskId: task0?.id,
      description: 'Need design specs for the drag handle component. Waiting on Design squad.',
      status: 'open',
    },
    {
      projectId: project.id,
      reportedById: pm.id,
      taskId: task2?.id,
      description:
        'Redis connection pool maxing out under load testing. Need to tune configuration.',
      status: 'in_progress',
    },
    {
      projectId: project.id,
      reportedById: dev2.id,
      description: 'Figma license expired. Cannot access design files until renewed.',
      status: 'resolved',
      resolvedById: admin.id,
      resolutionNote: 'License renewed for the team.',
      resolvedAt: daysAgo(1),
    },
  ]);
  console.log('  Created 3 blockers');

  // ──────────────────────────────────────────────────
  // 16. Notifications
  // ──────────────────────────────────────────────────
  console.log('Creating notifications...');
  if (task0 && task2) {
    await db.insert(schema.notifications).values([
      {
        userId: dev1.id,
        type: 'assignment',
        actorId: pm.id,
        targetType: 'task',
        targetId: task0.id,
        projectId: project.id,
        read: false,
      },
      {
        userId: pm.id,
        type: 'comment',
        actorId: dev1.id,
        targetType: 'task',
        targetId: task0.id,
        projectId: project.id,
        read: true,
      },
      {
        userId: admin.id,
        type: 'mention',
        actorId: pm.id,
        targetType: 'task',
        targetId: task2.id,
        projectId: project.id,
        read: false,
      },
      {
        userId: lead.id,
        type: 'due_soon',
        targetType: 'task',
        targetId: createdTasks[9]?.id ?? task0.id,
        projectId: project.id,
        read: false,
      },
      {
        userId: dev2.id,
        type: 'status_change',
        actorId: lead.id,
        targetType: 'task',
        targetId: createdTasks[1]?.id ?? task0.id,
        projectId: project.id,
        read: false,
      },
    ]);
    console.log('  Created 5 notifications');
  }

  // ──────────────────────────────────────────────────
  // 17. Dependencies
  // ──────────────────────────────────────────────────
  console.log('Creating dependencies...');
  const task3 = createdTasks[3];
  const task7 = createdTasks[7];
  if (task0 && task3 && task7) {
    await db.insert(schema.dependencies).values([
      {
        blockerType: 'task',
        blockerId: task0.id,
        blockedType: 'task',
        blockedId: task7.id,
        createdById: lead.id,
      },
      {
        blockerType: 'task',
        blockerId: task2?.id ?? task0.id,
        blockedType: 'task',
        blockedId: task3.id,
        createdById: pm.id,
      },
    ]);
    console.log('  Created 2 dependencies');
  }

  // ──────────────────────────────────────────────────
  // Done
  // ──────────────────────────────────────────────────
  console.log('\n✅ Seed complete!\n');
  console.log('Accounts (all passwords: password123):');
  console.log('  admin@acme.dev  — Organization admin');
  console.log('  pm@acme.dev     — Project manager');
  console.log('  lead@acme.dev   — Squad lead');
  console.log('  dev1@acme.dev   — Developer / member');
  console.log('  dev2@acme.dev   — Developer / member');
  console.log(`\nProject: "${project.name}" (${project.id})`);

  await pgClient.end();
}

seed().catch((err) => {
  console.error('❌ Seed failed:', err);
  pgClient.end();
  process.exit(1);
});
