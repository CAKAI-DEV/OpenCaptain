import { and, asc, desc, eq, sql } from 'drizzle-orm';
import { db, schema } from '../../shared/db';
import { conversationMessages, conversations } from '../../shared/db/schema';
import { memoryConsolidationQueue } from '../../shared/lib/queue';
import { listBlockers } from '../escalations/escalations.service';
import { chatCompletionForOrg } from '../llm';
import type { ChatMessage } from '../llm/llm.types';
import { retrieveMemories } from '../memory';
import { getProjectsByOrg } from '../projects/projects.service';
import { findSimilarDocuments } from '../rag';
import { getProjectMembers } from '../roles/roles.service';
import { listTasks } from '../tasks/tasks.service';
import {
  type AddMessageInput,
  CONSOLIDATION_THRESHOLD,
  type ConversationContext,
  type CreateConversationInput,
  type SendMessageResponse,
} from './conversations.types';

/**
 * Creates a new conversation.
 */
export async function createConversation(input: CreateConversationInput): Promise<string> {
  const result = await db
    .insert(conversations)
    .values({
      organizationId: input.organizationId,
      userId: input.userId,
      projectId: input.projectId,
      title: input.title,
      metadata: input.metadata,
    })
    .returning({ id: conversations.id });

  const conversation = result[0];
  if (!conversation) {
    throw new Error('Failed to create conversation');
  }

  return conversation.id;
}

/**
 * Adds a message to a conversation.
 */
export async function addMessage(input: AddMessageInput): Promise<string> {
  const result = await db
    .insert(conversationMessages)
    .values({
      conversationId: input.conversationId,
      role: input.role,
      content: input.content,
      metadata: input.metadata,
    })
    .returning({ id: conversationMessages.id });

  const message = result[0];
  if (!message) {
    throw new Error('Failed to add message');
  }

  return message.id;
}

/**
 * Retrieves messages for a conversation.
 */
export async function getMessages(conversationId: string, limit = 50) {
  return db
    .select()
    .from(conversationMessages)
    .where(eq(conversationMessages.conversationId, conversationId))
    .orderBy(asc(conversationMessages.createdAt))
    .limit(limit);
}

/**
 * Gets a conversation by ID with owner verification.
 */
export async function getConversation(conversationId: string, userId: string) {
  const conversation = await db.query.conversations.findFirst({
    where: eq(conversations.id, conversationId),
  });

  if (!conversation) {
    return null;
  }

  // Verify ownership
  if (conversation.userId !== userId) {
    return null;
  }

  return conversation;
}

/**
 * Builds live project context by fetching tasks, blockers, and team members.
 * Returns a markdown-formatted string for the system prompt.
 */
async function buildLiveProjectContext(
  visibleProjectIds: string[],
  organizationId: string,
  _userId: string,
  projectId?: string
): Promise<string> {
  const parts: string[] = [];

  if (projectId && visibleProjectIds.includes(projectId)) {
    // Project-scoped chat: fetch detailed data for one project
    const [tasksResult, blockers, members, project] = await Promise.all([
      listTasks(projectId, {}, { page: 1, limit: 50 }),
      listBlockers(projectId, 'open'),
      getProjectMembers(projectId),
      db.query.projects.findFirst({ where: eq(schema.projects.id, projectId) }),
    ]);

    const tasks = tasksResult.data;
    const projectName = project?.name ?? 'Unknown Project';
    const todo = tasks.filter((t) => t.status === 'todo').length;
    const inProgress = tasks.filter((t) => t.status === 'in_progress').length;
    const done = tasks.filter((t) => t.status === 'done').length;

    parts.push(`## Current Project: ${projectName}`);
    parts.push(
      `### Tasks: ${todo} todo, ${inProgress} in_progress, ${done} done (${tasks.length} total)`
    );

    // Overdue tasks
    const now = new Date();
    const overdue = tasks.filter(
      (t) => t.dueDate && new Date(t.dueDate) < now && t.status !== 'done'
    );
    if (overdue.length > 0) {
      const overdueList = overdue.map((t) => {
        const dueDate = t.dueDate as Date;
        const daysOverdue = Math.ceil((now.getTime() - dueDate.getTime()) / 86400000);
        return `"${t.title}" (${daysOverdue} day${daysOverdue !== 1 ? 's' : ''} overdue)`;
      });
      parts.push(`Overdue: ${overdueList.join(', ')}`);
    }

    // Urgent tasks
    const urgent = tasks.filter((t) => t.priority === 'urgent' && t.status !== 'done');
    if (urgent.length > 0) {
      const urgentList = urgent.map((t) => `"${t.title}"`);
      parts.push(`Urgent: ${urgentList.join(', ')}`);
    }

    // Blockers
    if (blockers.length > 0) {
      parts.push(`### Active Blockers (${blockers.length})`);
      for (const b of blockers) {
        parts.push(`- "${b.description}"`);
      }
    }

    // Team
    if (members.length > 0) {
      const teamList = members.map((m) => `${m.user.email} (${m.role})`);
      parts.push(`### Team`);
      parts.push(teamList.join(', '));
    }
  } else {
    // Global chat: summary of all visible projects
    const allProjects = await getProjectsByOrg(organizationId);
    const visible = allProjects.filter((p) => visibleProjectIds.includes(p.id));
    const projectsToShow = visible.slice(0, 5);

    if (projectsToShow.length === 0) return '';

    parts.push('## Your Projects');

    for (const project of projectsToShow) {
      const [tasksResult, blockers, members] = await Promise.all([
        listTasks(project.id, {}, { page: 1, limit: 50 }),
        listBlockers(project.id, 'open'),
        getProjectMembers(project.id),
      ]);

      const tasks = tasksResult.data;
      const todo = tasks.filter((t) => t.status === 'todo').length;
      const inProgress = tasks.filter((t) => t.status === 'in_progress').length;
      const done = tasks.filter((t) => t.status === 'done').length;

      const now = new Date();
      const overdue = tasks.filter(
        (t) => t.dueDate && new Date(t.dueDate) < now && t.status !== 'done'
      );

      parts.push(`### ${project.name}`);
      parts.push(
        `Tasks: ${todo} todo, ${inProgress} in_progress, ${done} done (${tasks.length} total)`
      );
      if (overdue.length > 0) {
        const overdueList = overdue.map((t) => `"${t.title}"`);
        parts.push(`Overdue: ${overdueList.join(', ')}`);
      }
      if (blockers.length > 0) {
        parts.push(`Active blockers: ${blockers.length}`);
      }
      if (members.length > 0) {
        const teamList = members.map((m) => `${m.user.email} (${m.role})`);
        parts.push(`Team: ${teamList.join(', ')}`);
      }
    }
  }

  return parts.join('\n');
}

/**
 * Assembles context for a conversation by retrieving RAG documents and memories.
 *
 * CRITICAL: visibleProjectIds must come from user's visibility context for security.
 */
export async function getConversationContext(
  conversationId: string,
  query: string,
  organizationId: string,
  userId: string,
  visibleProjectIds: string[],
  projectId?: string
): Promise<ConversationContext> {
  // 1. Get recent messages from conversation
  const messages = await getMessages(conversationId, 20);
  const recentMessages: ChatMessage[] = messages.map((m) => ({
    role: m.role as 'user' | 'assistant' | 'system',
    content: m.content,
  }));

  // 2. Retrieve similar documents via RAG (respects visibility)
  const ragDocs = await findSimilarDocuments(query, visibleProjectIds, { limit: 5 });

  // 3. Retrieve relevant memories (hierarchical: org -> project -> user)
  const orgMemories = await retrieveMemories({
    organizationId,
    types: ['semantic', 'episodic'],
    limit: 5,
  });

  const projectMemories = projectId
    ? await retrieveMemories({
        organizationId,
        projectId,
        types: ['semantic', 'episodic'],
        limit: 5,
      })
    : [];

  const userMemories = await retrieveMemories({
    organizationId,
    userId,
    types: ['semantic', 'episodic'],
    limit: 5,
  });

  // Combine and dedupe memories
  const allMemories = [...orgMemories, ...projectMemories, ...userMemories];
  const uniqueMemories = allMemories.filter(
    (m, i, arr) => arr.findIndex((x) => x.id === m.id) === i
  );

  // 4. Assemble system message with context
  const systemParts = [
    'You are a helpful project management assistant. You have access to real-time project data including tasks, team members, blockers, and deadlines.',
    '',
  ];

  // 4a. Inject live project data
  const liveContext = await buildLiveProjectContext(
    visibleProjectIds,
    organizationId,
    userId,
    projectId
  );
  if (liveContext) {
    systemParts.push(liveContext, '');
  }

  if (ragDocs.length > 0) {
    systemParts.push('## Relevant Documents');
    for (const doc of ragDocs) {
      systemParts.push(`[${doc.sourceType}] ${doc.content}`);
    }
    systemParts.push('');
  }

  if (uniqueMemories.length > 0) {
    systemParts.push('## Memories');
    for (const mem of uniqueMemories) {
      systemParts.push(`[${mem.scope}/${mem.type}] ${mem.content}`);
    }
    systemParts.push('');
  }

  systemParts.push(
    '## Guidelines',
    '- Use the project data above to answer questions accurately with specific names, numbers, and dates',
    '- When asked about sprint status, tasks, or team workload, reference the actual data',
    '- If something is not in the provided data, say so specifically',
    '- For write operations, clearly describe what will be changed before proceeding'
  );

  return {
    systemMessage: systemParts.join('\n'),
    recentMessages,
    ragDocuments: ragDocs.map((d) => ({
      content: d.content,
      sourceType: d.sourceType,
      sourceId: d.sourceId,
      similarity: d.similarity,
    })),
    memories: uniqueMemories.map((m) => ({
      content: m.content,
      type: m.type,
      scope: m.scope,
    })),
  };
}

/**
 * Sends a user message and gets an AI response.
 * This is the main entry point that wires context assembly + LLM.
 */
export async function sendMessage(
  conversationId: string,
  userMessage: string,
  organizationId: string,
  userId: string,
  visibleProjectIds: string[],
  projectId?: string
): Promise<SendMessageResponse> {
  // 1. Store user message
  await addMessage({
    conversationId,
    role: 'user',
    content: userMessage,
  });

  // 2. Assemble context
  const context = await getConversationContext(
    conversationId,
    userMessage,
    organizationId,
    userId,
    visibleProjectIds,
    projectId
  );

  // 3. Build messages for LLM
  const llmMessages: ChatMessage[] = [
    { role: 'system', content: context.systemMessage },
    ...context.recentMessages,
    { role: 'user', content: userMessage },
  ];

  // 4. Call LLM with org's model preference
  const result = await chatCompletionForOrg(organizationId, llmMessages);

  // 5. Store assistant response
  const messageId = await addMessage({
    conversationId,
    role: 'assistant',
    content: result.content,
  });

  // 6. Check if consolidation needed
  await checkAndTriggerConsolidation(conversationId, organizationId, projectId, userId);

  // 7. Get the stored message for response
  const storedMessage = await db.query.conversationMessages.findFirst({
    where: eq(conversationMessages.id, messageId),
  });

  return {
    message: {
      id: messageId,
      role: 'assistant',
      content: result.content,
      createdAt: storedMessage?.createdAt ?? new Date(),
    },
    context: {
      ragDocumentsUsed: context.ragDocuments.length,
      memoriesUsed: context.memories.length,
    },
    usage: result.usage,
  };
}

/**
 * Checks message count and triggers consolidation if threshold exceeded.
 */
async function checkAndTriggerConsolidation(
  conversationId: string,
  organizationId: string,
  projectId: string | undefined,
  userId: string
): Promise<void> {
  const countResult = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(conversationMessages)
    .where(eq(conversationMessages.conversationId, conversationId));

  const count = countResult[0]?.count ?? 0;

  if (count >= CONSOLIDATION_THRESHOLD) {
    await memoryConsolidationQueue.add(
      `consolidate-${conversationId}`,
      {
        conversationId,
        organizationId,
        projectId,
        userId,
      },
      {
        // Dedup: don't queue if already pending
        jobId: `consolidate-${conversationId}`,
      }
    );
  }
}

/**
 * Lists conversations for a user within their organization.
 */
export async function listConversations(
  userId: string,
  organizationId: string,
  limit = 20,
  offset = 0
) {
  return db
    .select({
      id: conversations.id,
      title: conversations.title,
      projectId: conversations.projectId,
      createdAt: conversations.createdAt,
      updatedAt: conversations.updatedAt,
    })
    .from(conversations)
    .where(and(eq(conversations.userId, userId), eq(conversations.organizationId, organizationId)))
    .orderBy(desc(conversations.updatedAt))
    .limit(limit)
    .offset(offset);
}
