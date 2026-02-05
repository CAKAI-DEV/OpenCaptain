import { relations } from 'drizzle-orm';
import { boolean, index, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { users } from './users';

export const userMessaging = pgTable(
  'user_messaging',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .unique()
      .references(() => users.id, { onDelete: 'cascade' }),

    // Telegram connection
    telegramChatId: varchar('telegram_chat_id', { length: 100 }),
    telegramUsername: varchar('telegram_username', { length: 100 }),
    telegramVerified: boolean('telegram_verified').default(false).notNull(),

    // WhatsApp connection
    whatsappPhone: varchar('whatsapp_phone', { length: 20 }),
    whatsappVerified: boolean('whatsapp_verified').default(false).notNull(),

    // Preferences
    messagingEnabled: boolean('messaging_enabled').default(true).notNull(),
    dailyCheckinEnabled: boolean('daily_checkin_enabled').default(false).notNull(),
    weeklyRecapEnabled: boolean('weekly_recap_enabled').default(false).notNull(),

    // Context tracking (no FK - may reference deleted project)
    lastProjectId: uuid('last_project_id'),

    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('user_messaging_telegram_chat_id_idx').on(table.telegramChatId),
    index('user_messaging_whatsapp_phone_idx').on(table.whatsappPhone),
  ]
);

export const userMessagingRelations = relations(userMessaging, ({ one }) => ({
  user: one(users, {
    fields: [userMessaging.userId],
    references: [users.id],
  }),
}));
