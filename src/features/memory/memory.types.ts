export type MemoryType = 'working' | 'episodic' | 'semantic';
export type MemoryScope = 'organization' | 'project' | 'user';

export type StoreMemoryInput = {
  type: MemoryType;
  scope: MemoryScope;
  organizationId: string;
  projectId?: string;
  userId?: string;
  conversationId?: string;
  content: string;
  importance?: number;
  expiresAt?: Date;
};

export type RetrieveMemoriesInput = {
  organizationId: string;
  projectId?: string;
  userId?: string;
  types?: MemoryType[];
  limit?: number;
};

/**
 * Capacity limits per CONTEXT.md: "Keep up to N entries, oldest removed when limit reached"
 */
export const MEMORY_CAPACITY = {
  organization: 1000,
  project: 500,
  user: 100,
} as const;

/**
 * Number of recent messages to keep when consolidating a conversation.
 */
export const KEEP_RECENT_MESSAGES = 10;
