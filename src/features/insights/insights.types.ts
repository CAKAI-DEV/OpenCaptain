/**
 * Types for insights and proactive suggestions.
 *
 * Insights analyze metric trends to detect significant changes.
 * Suggestions provide actionable recommendations based on patterns.
 */

/** Types of insights that can be generated */
export type InsightType =
  | 'trend_drop' // Metric decreased significantly
  | 'trend_rise' // Metric increased significantly
  | 'blocker_pattern' // Recurring or stuck blockers
  | 'deadline_risk' // Tasks at risk of missing deadline
  | 'output_leader' // Top performer in a metric
  | 'velocity_change'; // Team velocity changed significantly

/** Scope for insights (role-based access) */
export type InsightScopeType = 'project' | 'squad' | 'personal';

/** Priority levels for suggestions */
export type SuggestionPriority = 'low' | 'medium' | 'high';

/** Types of suggestions */
export type SuggestionType =
  | 'task_focus' // Focus on specific tasks
  | 'blocker_resolution' // Address blockers
  | 'workload_balance' // Rebalance workload
  | 'deadline_alert' // Deadline approaching
  | 'velocity_improvement'; // Improve velocity

/**
 * An insight about a metric or pattern
 */
export interface Insight {
  /** Unique identifier */
  id: string;
  /** Type of insight */
  type: InsightType;
  /** Human-readable title */
  title: string;
  /** Detailed description with context */
  description: string;
  /** Name of the metric this insight relates to */
  metric: string;
  /** Percentage change (positive or negative) */
  percentChange: number;
  /** Time range this insight covers */
  timeRange: {
    start: Date;
    end: Date;
  };
  /** Scope of this insight */
  scopeType: InsightScopeType;
  /** ID of the scope (projectId, squadId, or userId) */
  scopeId: string;
  /** Confidence score (0-1) */
  confidence: number;
  /** When this insight was generated */
  createdAt: Date;
}

/**
 * A suggestion for action based on insights
 */
export interface Suggestion {
  /** Unique identifier */
  id: string;
  /** Type of suggestion */
  type: SuggestionType;
  /** Human-readable title */
  title: string;
  /** Detailed description */
  description: string;
  /** Recommended action to take */
  action: string;
  /** Priority level */
  priority: SuggestionPriority;
  /** Target user for this suggestion (null for team suggestions) */
  targetUserId: string | null;
  /** Confidence score (0-1) */
  confidence: number;
  /** Related insight IDs */
  relatedInsightIds: string[];
}

/**
 * Request parameters for generating insights
 */
export interface InsightsRequest {
  /** Project to analyze */
  projectId: string;
  /** Scope type for the analysis */
  scopeType: InsightScopeType;
  /** Scope ID (squadId for squad scope, userId for personal) */
  scopeId?: string;
  /** Time range for analysis */
  timeRange: {
    start: Date;
    end: Date;
  };
}

/**
 * Result of comparing two periods of metrics
 */
export interface TrendAnalysis {
  /** Name of the metric */
  metric: string;
  /** Current period value */
  currentValue: number;
  /** Previous period value */
  previousValue: number;
  /** Percentage change */
  percentChange: number;
  /** Whether the change is significant (>10%) */
  isSignificant: boolean;
  /** Whether it's an improvement or decline */
  trend: 'up' | 'down' | 'stable';
}

/**
 * Context for generating suggestions
 */
export interface SuggestionContext {
  /** Project ID */
  projectId: string;
  /** User ID */
  userId: string;
  /** User's role in the project */
  role: 'admin' | 'pm' | 'lead' | 'member';
  /** Recent insights for this scope */
  recentInsights: Insight[];
  /** Squad ID if user is a squad member */
  squadId?: string;
}
