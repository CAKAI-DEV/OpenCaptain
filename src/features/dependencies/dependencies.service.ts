import { and, eq } from 'drizzle-orm';
import { db, schema } from '../../shared/db';
import { ApiError } from '../../shared/middleware/error-handler';
import type {
  BlockedStatus,
  CreateDependencyInput,
  DependencyNode,
  DependencyResult,
  DependencyWithDetails,
} from './dependencies.types';

/**
 * DFS-based cycle detection for dependency graph.
 * Returns true if adding edge from->to would create a cycle.
 *
 * Algorithm: If we add "blocker -> blocked", we need to check if
 * following the dependency chain from "blocked" could eventually
 * lead back to "blocker".
 */
export async function wouldCreateCycle(
  blocker: DependencyNode,
  blocked: DependencyNode
): Promise<boolean> {
  // Self-reference is an immediate cycle
  if (blocker.type === blocked.type && blocker.id === blocked.id) {
    return true;
  }

  // DFS from "blocked" to see if we can reach "blocker"
  const visited = new Set<string>();
  const stack: DependencyNode[] = [blocked];

  while (stack.length > 0) {
    const current = stack.pop()!;
    const key = `${current.type}:${current.id}`;

    if (visited.has(key)) continue;
    visited.add(key);

    // Get all items that this node blocks (outgoing edges)
    // If current blocks something, we follow that chain
    const outgoing = await db.query.dependencies.findMany({
      where: and(
        eq(schema.dependencies.blockerType, current.type),
        eq(schema.dependencies.blockerId, current.id)
      ),
    });

    for (const dep of outgoing) {
      // If we reach "blocker", adding the edge would create a cycle
      if (dep.blockedType === blocker.type && dep.blockedId === blocker.id) {
        return true;
      }
      stack.push({ type: dep.blockedType as 'task' | 'deliverable', id: dep.blockedId });
    }
  }

  return false;
}

/**
 * Creates a dependency after validating no cycle would be created.
 */
export async function createDependency(
  input: CreateDependencyInput,
  createdById: string
): Promise<DependencyResult> {
  const { blocker, blocked } = input;

  // Check for cycle
  if (await wouldCreateCycle(blocker, blocked)) {
    throw new ApiError(
      400,
      'dependencies/cycle-detected',
      'Circular Dependency Detected',
      'Adding this dependency would create a circular reference'
    );
  }

  const [dependency] = await db
    .insert(schema.dependencies)
    .values({
      blockerType: blocker.type,
      blockerId: blocker.id,
      blockedType: blocked.type,
      blockedId: blocked.id,
      createdById,
    })
    .returning();

  if (!dependency) {
    throw new Error('Failed to create dependency');
  }

  return dependency;
}

/**
 * Delete a single dependency by ID.
 */
export async function deleteDependency(dependencyId: string): Promise<void> {
  const existing = await db.query.dependencies.findFirst({
    where: eq(schema.dependencies.id, dependencyId),
  });

  if (!existing) {
    throw new ApiError(
      404,
      'dependencies/not-found',
      'Dependency Not Found',
      'The requested dependency does not exist'
    );
  }

  await db.delete(schema.dependencies).where(eq(schema.dependencies.id, dependencyId));
}

/**
 * Get a single dependency by ID.
 */
export async function getDependency(dependencyId: string): Promise<DependencyResult | null> {
  const dependency = await db.query.dependencies.findFirst({
    where: eq(schema.dependencies.id, dependencyId),
  });
  return dependency ?? null;
}

/**
 * Get dependencies for an item.
 * @param node The item to get dependencies for
 * @param direction 'blocks' = items this node blocks (node is blocker),
 *                  'blocked_by' = items blocking this node (node is blocked)
 */
export async function getDependenciesFor(
  node: DependencyNode,
  direction: 'blocks' | 'blocked_by'
): Promise<DependencyWithDetails[]> {
  let deps: DependencyResult[];

  if (direction === 'blocks') {
    // Items this node blocks (node is the blocker)
    deps = await db.query.dependencies.findMany({
      where: and(
        eq(schema.dependencies.blockerType, node.type),
        eq(schema.dependencies.blockerId, node.id)
      ),
    });
  } else {
    // Items blocking this node (node is the blocked)
    deps = await db.query.dependencies.findMany({
      where: and(
        eq(schema.dependencies.blockedType, node.type),
        eq(schema.dependencies.blockedId, node.id)
      ),
    });
  }

  // Fetch item details for each dependency
  const result: DependencyWithDetails[] = [];
  for (const dep of deps) {
    const enhanced: DependencyWithDetails = { ...dep };

    // Fetch blocker item details
    if (dep.blockerType === 'task') {
      const task = await db.query.tasks.findFirst({
        where: eq(schema.tasks.id, dep.blockerId),
      });
      if (task) {
        enhanced.blockerItem = { id: task.id, title: task.title, type: 'task' };
      }
    } else if (dep.blockerType === 'deliverable') {
      const deliverable = await db.query.deliverables.findFirst({
        where: eq(schema.deliverables.id, dep.blockerId),
      });
      if (deliverable) {
        enhanced.blockerItem = {
          id: deliverable.id,
          title: deliverable.title,
          type: 'deliverable',
        };
      }
    }

    // Fetch blocked item details
    if (dep.blockedType === 'task') {
      const task = await db.query.tasks.findFirst({
        where: eq(schema.tasks.id, dep.blockedId),
      });
      if (task) {
        enhanced.blockedItem = { id: task.id, title: task.title, type: 'task' };
      }
    } else if (dep.blockedType === 'deliverable') {
      const deliverable = await db.query.deliverables.findFirst({
        where: eq(schema.deliverables.id, dep.blockedId),
      });
      if (deliverable) {
        enhanced.blockedItem = {
          id: deliverable.id,
          title: deliverable.title,
          type: 'deliverable',
        };
      }
    }

    result.push(enhanced);
  }

  return result;
}

/**
 * Check if an item is blocked by any incomplete items.
 * "Incomplete" means:
 * - Task: status != 'done'
 * - Deliverable: status is not marked as isFinal in its type config
 */
export async function isBlocked(node: DependencyNode): Promise<BlockedStatus> {
  // Get all items blocking this node
  const blocking = await db.query.dependencies.findMany({
    where: and(
      eq(schema.dependencies.blockedType, node.type),
      eq(schema.dependencies.blockedId, node.id)
    ),
  });

  const incompleteBlockers: DependencyNode[] = [];

  for (const dep of blocking) {
    let isIncomplete = false;

    if (dep.blockerType === 'task') {
      const task = await db.query.tasks.findFirst({
        where: eq(schema.tasks.id, dep.blockerId),
      });
      if (task && task.status !== 'done') {
        isIncomplete = true;
      }
    } else if (dep.blockerType === 'deliverable') {
      const deliverable = await db.query.deliverables.findFirst({
        where: eq(schema.deliverables.id, dep.blockerId),
      });
      if (deliverable) {
        // Check if status is final by looking up the deliverable type config
        const deliverableType = await db.query.deliverableTypes.findFirst({
          where: eq(schema.deliverableTypes.id, deliverable.deliverableTypeId),
        });
        if (deliverableType) {
          const config = deliverableType.config as {
            statuses: Array<{ id: string; isFinal: boolean }>;
          };
          const statusConfig = config.statuses.find((s) => s.id === deliverable.status);
          if (!statusConfig?.isFinal) {
            isIncomplete = true;
          }
        }
      }
    }

    if (isIncomplete) {
      incompleteBlockers.push({
        type: dep.blockerType as 'task' | 'deliverable',
        id: dep.blockerId,
      });
    }
  }

  return {
    blocked: incompleteBlockers.length > 0,
    blockedBy: incompleteBlockers,
  };
}

/**
 * Delete all dependencies where the specified item is involved (as blocker or blocked).
 * Used for cleanup when a task or deliverable is deleted.
 */
export async function deleteAllDependenciesFor(node: DependencyNode): Promise<number> {
  // Delete where node is blocker
  const result1 = await db
    .delete(schema.dependencies)
    .where(
      and(
        eq(schema.dependencies.blockerType, node.type),
        eq(schema.dependencies.blockerId, node.id)
      )
    )
    .returning();

  // Delete where node is blocked
  const result2 = await db
    .delete(schema.dependencies)
    .where(
      and(
        eq(schema.dependencies.blockedType, node.type),
        eq(schema.dependencies.blockedId, node.id)
      )
    )
    .returning();

  return result1.length + result2.length;
}
