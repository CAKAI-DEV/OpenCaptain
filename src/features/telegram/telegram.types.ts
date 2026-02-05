import type { Context, SessionFlavor } from 'grammy';

export interface SessionData {
  currentProjectId: string | null;
  conversationId: string | null;
  lastActivity: number;
}

export type BotContext = Context & SessionFlavor<SessionData>;
