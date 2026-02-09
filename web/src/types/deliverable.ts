export interface DeliverableTypeStatus {
  id: string;
  name: string;
  color: string;
  isFinal: boolean;
}

export interface DeliverableTypeTransition {
  from: string;
  to: string;
}

export interface DeliverableTypeField {
  id: string;
  name: string;
  type: 'text' | 'number' | 'date' | 'select' | 'url';
  required: boolean;
  options?: string[];
}

export interface DeliverableTypeConfig {
  statuses: DeliverableTypeStatus[];
  transitions: DeliverableTypeTransition[];
  fields: DeliverableTypeField[];
}

export interface DeliverableType {
  id: string;
  projectId: string;
  name: string;
  description: string | null;
  icon: string | null;
  config: DeliverableTypeConfig;
  createdAt: string;
  updatedAt: string;
}

export interface Deliverable {
  id: string;
  projectId: string;
  squadId: string | null;
  deliverableTypeId: string;
  title: string;
  description: string | null;
  status: string;
  assigneeId: string | null;
  createdById: string;
  dueDate: string | null;
  completedAt: string | null;
  customFieldValues: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDeliverableInput {
  projectId: string;
  squadId?: string;
  deliverableTypeId: string;
  title: string;
  description?: string;
  assigneeId?: string;
  dueDate?: string;
  customFieldValues?: Record<string, unknown>;
}
