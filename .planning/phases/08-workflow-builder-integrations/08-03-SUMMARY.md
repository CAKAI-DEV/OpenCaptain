---
phase: 08-workflow-builder-integrations
plan: 03
subsystem: ai-intelligence
tags: [insights, suggestions, llm, metrics, proactive-messaging]

dependency-graph:
  requires: ['08-02']
  provides: ['insights-service', 'suggestions-api', 'trend-analysis']
  affects: ['08-04', '08-05']

tech-stack:
  added: []
  patterns:
    - "LLM-powered insight generation with fallback"
    - "Role-based scope filtering (admin/PM=project, lead=squad, member=personal)"
    - "Trend analysis with >10% significance threshold"
    - "Proactive suggestions integration"

key-files:
  created:
    - src/features/insights/insights.types.ts
    - src/features/insights/insights.service.ts
    - src/features/insights/insights.routes.ts
    - src/features/insights/index.ts
  modified:
    - src/features/messaging/messaging.proactive.ts
    - src/index.ts

decisions:
  - id: "08-03-01"
    decision: "10% threshold for significant metric changes"
    rationale: "Avoids noise from minor fluctuations while catching meaningful trends"
  - id: "08-03-02"
    decision: "gpt-4o-mini for insight text generation with fallback"
    rationale: "Speed/cost optimized for real-time insight generation, fallback ensures reliability"
  - id: "08-03-03"
    decision: "Stuck blockers threshold at 2+ days"
    rationale: "Blockers active for 2+ days warrant attention and proactive notification"

metrics:
  duration: "5 min"
  completed: "2026-02-06"
---

# Phase 8 Plan 03: Smart Insights & Proactive Suggestions Summary

LLM-powered insights analyzing metrics trends with role-scoped visibility and proactive suggestion delivery.

## What Was Built

### Task 1: Insights Types and Service (4c83dc2)

Created the insights feature module with:

**Types (`insights.types.ts`):**
- `InsightType`: trend_drop, trend_rise, blocker_pattern, deadline_risk, output_leader, velocity_change
- `Insight` interface: id, type, title, description, metric, percentChange, timeRange, scopeType, scopeId, confidence
- `Suggestion` interface: id, type, title, description, action, priority, targetUserId, confidence
- `SuggestionContext`: context for generating suggestions based on user role and insights

**Service (`insights.service.ts`):**
- `analyzeMetricTrend()`: Compares current vs previous period with 10% significance threshold
- `generateInsights()`: Fetches metrics, detects trends, generates human-readable descriptions via LLM
- `generateSuggestions()`: Creates actionable recommendations using LLM function calling
- `analyzeBlockerPatterns()`: Detects stuck blockers (2+ days unresolved)
- `analyzeDeadlineRisks()`: Identifies tasks due within 3 days
- `getUserProjectRole()`: Determines user's role (admin/pm/lead/member) for scope filtering
- `getInsightsForRole()`: Returns appropriate scope based on role

### Task 2: Routes and Messaging Integration (c5036d4)

**Routes (`insights.routes.ts`):**
- `GET /api/v1/projects/:projectId/insights` - Role-scoped insights
- `GET /api/v1/projects/:projectId/insights/suggestions` - User suggestions
- `POST /api/v1/projects/:projectId/insights/generate` - Manual trigger (admin/PM only)

**Messaging Integration (`messaging.proactive.ts`):**
- Enhanced `generateDailyCheckin()` with top suggestion
- Enhanced `generateWeeklyRecap()` with key insights
- Added `generateInsightAlert()` for significant change notifications
- Added `getAlertWorthyInsights()` for >20% change detection

## Key Implementation Details

### Trend Analysis
```typescript
// Significance threshold: >10% change
const SIGNIFICANCE_THRESHOLD = 0.1;

// Trend detection compares current vs previous period
const trend = analyzeMetricTrend(currentValue, previousValue, metricName);
if (trend.isSignificant) {
  // Generate insight with LLM description
}
```

### Role-Based Scoping
```typescript
// Admin/PM see all project insights
// Squad lead sees squad insights
// Member sees personal insights only
switch (role) {
  case 'admin':
  case 'pm':
    return { scopeType: 'project', scopeId: projectId };
  case 'lead':
    return { scopeType: 'squad', scopeId: squadId };
  default:
    return { scopeType: 'personal', scopeId: userId };
}
```

### Example Insight Messages
- "Instagram output dropped 30% this week (4 posts vs 6 last week)"
- "Velocity up 20%! Team completed 15 tasks vs 12 last week"
- "3 blockers stuck for 2+ days need attention"

## Deviations from Plan

None - plan executed exactly as written.

## Verification Results

- `bun run typecheck` - Passed
- `bun run lint` - Passed
- Insights routes mounted at /api/v1/projects/:projectId/insights
- Daily check-ins include top suggestion when available
- Weekly recaps include key insights summary

## Files Changed

| File | Change |
|------|--------|
| src/features/insights/insights.types.ts | Created - Type definitions |
| src/features/insights/insights.service.ts | Created - Core logic |
| src/features/insights/insights.routes.ts | Created - API endpoints |
| src/features/insights/index.ts | Created - Module exports |
| src/features/messaging/messaging.proactive.ts | Modified - Added insights |
| src/index.ts | Modified - Mount routes |

## Next Phase Readiness

Ready for 08-04 (Natural Language Task Creation):
- Insights service provides context for NL parsing
- Suggestion patterns demonstrate LLM function calling
- No blockers or concerns
