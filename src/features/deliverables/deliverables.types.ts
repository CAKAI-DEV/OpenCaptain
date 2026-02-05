import type { deliverables, deliverableTypes } from '../../shared/db/schema';
import type { DeliverableTypeConfig } from '../../shared/db/schema/deliverable-types';

// Deliverable Type input types
export interface CreateDeliverableTypeInput {
  projectId: string;
  name: string;
  description?: string;
  icon?: string;
  config: DeliverableTypeConfig;
}

export interface UpdateDeliverableTypeInput {
  name?: string;
  description?: string;
  icon?: string;
  config?: DeliverableTypeConfig;
}

// Deliverable input types
export interface CreateDeliverableInput {
  projectId: string;
  squadId?: string;
  deliverableTypeId: string;
  title: string;
  description?: string;
  assigneeId?: string;
  dueDate?: Date;
  customFieldValues?: Record<string, unknown>;
}

export interface UpdateDeliverableInput {
  squadId?: string | null;
  title?: string;
  description?: string | null;
  status?: string;
  assigneeId?: string | null;
  dueDate?: Date | null;
  customFieldValues?: Record<string, unknown>;
}

// Result types (inferred from schema)
export type DeliverableTypeResult = typeof deliverableTypes.$inferSelect;
export type DeliverableResult = typeof deliverables.$inferSelect;

// List filter types
export interface ListDeliverablesFilters {
  squadId?: string;
  assigneeId?: string;
  status?: string;
  deliverableTypeId?: string;
}
