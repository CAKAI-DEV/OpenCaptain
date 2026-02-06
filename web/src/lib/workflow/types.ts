import type { Node } from '@xyflow/react';

// Node types for the workflow editor
export type WorkflowNodeType = 'checkIn' | 'escalation' | 'role' | 'visibility';

// Check-in node data
export type CheckInNodeData = {
  label: string;
  frequency: 'daily' | 'weekly';
  time: string;
  squadId?: string;
  squadName?: string;
  [key: string]: unknown;
};

// Escalation node data
export type EscalationNodeData = {
  label: string;
  triggerType: 'missed_checkin' | 'blocked_task' | 'overdue_task';
  steps: EscalationStep[];
  [key: string]: unknown;
};

export interface EscalationStep {
  id: string;
  action: 'notify' | 'escalate';
  targetRole: string;
  delayMinutes: number;
}

// Role node data
export type RoleNodeData = {
  label: string;
  roleName: string;
  tier: number;
  capabilities: string[];
  [key: string]: unknown;
};

// Visibility node data
export type VisibilityNodeData = {
  label: string;
  scope: 'project' | 'squad' | 'custom';
  grants: VisibilityGrant[];
  [key: string]: unknown;
};

export interface VisibilityGrant {
  id: string;
  squadId: string;
  squadName: string;
}

// Union type for all node data
export type WorkflowNodeData =
  | CheckInNodeData
  | EscalationNodeData
  | RoleNodeData
  | VisibilityNodeData;

// Typed node types for React Flow
export type CheckInNode = Node<CheckInNodeData, 'checkIn'>;
export type EscalationNode = Node<EscalationNodeData, 'escalation'>;
export type RoleNode = Node<RoleNodeData, 'role'>;
export type VisibilityNode = Node<VisibilityNodeData, 'visibility'>;

// Union of all workflow nodes (strict typing)
export type WorkflowNodeStrict = CheckInNode | EscalationNode | RoleNode | VisibilityNode;

// Flexible workflow node type for state management
// Uses union data type to avoid discriminated union issues with React state
export type WorkflowNode = Node<WorkflowNodeData, WorkflowNodeType>;

// Default data factories
export function createCheckInNodeData(): CheckInNodeData {
  return {
    label: 'Check-in',
    frequency: 'daily',
    time: '09:00',
  };
}

export function createEscalationNodeData(): EscalationNodeData {
  return {
    label: 'Escalation',
    triggerType: 'missed_checkin',
    steps: [],
  };
}

export function createRoleNodeData(): RoleNodeData {
  return {
    label: 'Role',
    roleName: '',
    tier: 1,
    capabilities: [],
  };
}

export function createVisibilityNodeData(): VisibilityNodeData {
  return {
    label: 'Visibility',
    scope: 'project',
    grants: [],
  };
}

export function createNodeData(type: WorkflowNodeType): WorkflowNodeData {
  switch (type) {
    case 'checkIn':
      return createCheckInNodeData();
    case 'escalation':
      return createEscalationNodeData();
    case 'role':
      return createRoleNodeData();
    case 'visibility':
      return createVisibilityNodeData();
  }
}
