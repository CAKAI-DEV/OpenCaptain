import { integer, pgEnum, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { projects } from './projects';
import { tasks } from './tasks';
import { users } from './users';

/**
 * Status of a coding request.
 */
export const codingRequestStatusEnum = pgEnum('coding_request_status', [
  'pending',
  'in_progress',
  'completed',
  'failed',
]);

/**
 * Linked GitHub repositories for projects.
 * Admin links repos to enable coding agent access.
 */
export const linkedRepos = pgTable('linked_repos', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),

  // Repository identification
  owner: varchar('owner', { length: 255 }).notNull(),
  repo: varchar('repo', { length: 255 }).notNull(),

  // GitHub App installation ID for this repo
  installationId: integer('installation_id').notNull(),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

/**
 * Coding fix requests.
 * Tracks coding agent jobs from request to PR creation.
 */
export const codingRequests = pgTable('coding_requests', {
  id: uuid('id').primaryKey().defaultRandom(),

  // Link to task being fixed
  taskId: uuid('task_id')
    .notNull()
    .references(() => tasks.id, { onDelete: 'cascade' }),

  // Link to repo being modified
  linkedRepoId: uuid('linked_repo_id')
    .notNull()
    .references(() => linkedRepos.id, { onDelete: 'cascade' }),

  // User who authorized the fix (must be lead/admin/pm)
  authorizedById: uuid('authorized_by_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),

  // Request details
  description: text('description').notNull(),
  status: codingRequestStatusEnum('status').notNull().default('pending'),

  // Git/PR tracking
  branchName: varchar('branch_name', { length: 255 }),
  prNumber: integer('pr_number'),
  prUrl: varchar('pr_url', { length: 500 }),

  // Error tracking
  errorMessage: text('error_message'),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
