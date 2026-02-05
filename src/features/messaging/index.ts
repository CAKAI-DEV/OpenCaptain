/**
 * Messaging feature - Natural language processing for Telegram and WhatsApp.
 *
 * @module features/messaging
 */

// Context management
export { getAvailableProjects, getUserContext, switchProject } from './messaging.context';
// Intent detection
export { detectIntent } from './messaging.intents';

// Message processing
export { processMessage } from './messaging.service';

// Types
export type {
  Entities,
  Intent,
  IntentResult,
  MessageContext,
  ProcessedMessage,
} from './messaging.types';
