import type { dependencies } from '../../shared/db/schema/dependencies';

/**
 * A node in the dependency graph - can be a task or deliverable.
 */
export interface DependencyNode {
  type: 'task' | 'deliverable';
  id: string;
}

/**
 * Input for creating a dependency between two items.
 */
export interface CreateDependencyInput {
  blocker: DependencyNode;
  blocked: DependencyNode;
}

/**
 * Inferred type from the dependencies table.
 */
export type DependencyResult = typeof dependencies.$inferSelect;

/**
 * Dependency with resolved blocker/blocked item details.
 */
export interface DependencyWithDetails extends DependencyResult {
  blockerItem?: {
    id: string;
    title: string;
    type: 'task' | 'deliverable';
  };
  blockedItem?: {
    id: string;
    title: string;
    type: 'task' | 'deliverable';
  };
}

/**
 * Result of checking if an item is blocked.
 */
export interface BlockedStatus {
  blocked: boolean;
  blockedBy: DependencyNode[];
}
