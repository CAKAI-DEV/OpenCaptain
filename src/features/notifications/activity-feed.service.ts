import { sql } from 'drizzle-orm';
import { db } from '../../shared/db';

export interface ActivityFeedItem {
  id: string;
  type: string;
  actorId: string | null;
  actorEmail: string | null;
  targetType: string;
  targetId: string;
  targetTitle: string | null;
  projectId: string;
  projectName: string | null;
  createdAt: Date;
}

interface ActivityRow {
  id: string;
  type: string;
  actor_id: string | null;
  actor_email: string | null;
  target_type: string;
  target_id: string;
  target_title: string | null;
  project_id: string;
  project_name: string | null;
  created_at: Date;
}

function mapRowToFeedItem(r: ActivityRow): ActivityFeedItem {
  return {
    id: r.id,
    type: r.type,
    actorId: r.actor_id,
    actorEmail: r.actor_email,
    targetType: r.target_type,
    targetId: r.target_id,
    targetTitle: r.target_title,
    projectId: r.project_id,
    projectName: r.project_name,
    createdAt: r.created_at,
  };
}

/**
 * Get activity feed for a specific project
 */
export async function getActivityFeed(
  projectId: string,
  limit = 50,
  offset = 0
): Promise<ActivityFeedItem[]> {
  const result = await db.execute(sql`
    SELECT
      n.id,
      n.type,
      n.actor_id,
      u.email as actor_email,
      n.target_type,
      n.target_id,
      COALESCE(t.title, d.title) as target_title,
      n.project_id,
      p.name as project_name,
      n.created_at
    FROM notifications n
    LEFT JOIN users u ON n.actor_id = u.id
    LEFT JOIN tasks t ON n.target_type = 'task' AND n.target_id = t.id
    LEFT JOIN deliverables d ON n.target_type = 'deliverable' AND n.target_id = d.id
    LEFT JOIN projects p ON n.project_id = p.id
    WHERE n.project_id = ${projectId}
    ORDER BY n.created_at DESC
    LIMIT ${limit}
    OFFSET ${offset}
  `);

  return (result as unknown as ActivityRow[]).map(mapRowToFeedItem);
}

/**
 * Get recent activity across all visible projects for a user
 */
export async function getUserActivityFeed(
  visibleProjectIds: string[],
  limit = 50,
  offset = 0
): Promise<ActivityFeedItem[]> {
  if (visibleProjectIds.length === 0) {
    return [];
  }

  const projectList = visibleProjectIds.map((id) => `'${id}'`).join(',');

  const result = await db.execute(sql`
    SELECT
      n.id,
      n.type,
      n.actor_id,
      u.email as actor_email,
      n.target_type,
      n.target_id,
      COALESCE(t.title, d.title) as target_title,
      n.project_id,
      p.name as project_name,
      n.created_at
    FROM notifications n
    LEFT JOIN users u ON n.actor_id = u.id
    LEFT JOIN tasks t ON n.target_type = 'task' AND n.target_id = t.id
    LEFT JOIN deliverables d ON n.target_type = 'deliverable' AND n.target_id = d.id
    LEFT JOIN projects p ON n.project_id = p.id
    WHERE n.project_id IN (${sql.raw(projectList)})
    ORDER BY n.created_at DESC
    LIMIT ${limit}
    OFFSET ${offset}
  `);

  return (result as unknown as ActivityRow[]).map(mapRowToFeedItem);
}
