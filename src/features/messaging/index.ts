/**
 * Messaging feature - Natural language processing for Telegram and WhatsApp.
 *
 * @module features/messaging
 */

// Context management
export { getAvailableProjects, getUserContext, switchProject } from './messaging.context';
// Intent detection
export { detectIntent } from './messaging.intents';

// Proactive messaging
export {
  generateDailyCheckin,
  generateOverdueAlert,
  generateWeeklyRecap,
  getOverdueTasks,
  getUpcomingTasks,
} from './messaging.proactive';
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
export {
  proactiveMessagingQueue,
  proactiveMessagingWorker,
  queueOverdueAlert,
  scheduleAllProactiveMessages,
} from './messaging.worker';
