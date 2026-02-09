'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type {
  CheckInNodeData,
  EscalationNodeData,
  RoleNodeData,
  VisibilityNodeData,
  WorkflowNode,
  WorkflowNodeType,
} from '@/lib/workflow/types';

interface WorkflowPropertiesProps {
  selectedNode: WorkflowNode | null;
  onNodeUpdate: (nodeId: string, data: WorkflowNode['data']) => void;
}

export function WorkflowProperties({ selectedNode, onNodeUpdate }: WorkflowPropertiesProps) {
  if (!selectedNode) {
    return (
      <div className="w-80 border-l bg-card p-4">
        <h2 className="text-sm font-semibold mb-4">Properties</h2>
        <p className="text-sm text-muted-foreground">Select a node to edit its properties.</p>
      </div>
    );
  }

  const nodeType = selectedNode.type as WorkflowNodeType;

  return (
    <div className="w-80 border-l bg-card p-4 overflow-y-auto">
      <h2 className="text-sm font-semibold mb-4">Properties</h2>
      <div className="space-y-4">
        <div>
          <Label htmlFor="label">Label</Label>
          <Input
            id="label"
            value={selectedNode.data.label}
            onChange={(e) =>
              onNodeUpdate(selectedNode.id, { ...selectedNode.data, label: e.target.value })
            }
          />
        </div>

        {nodeType === 'checkIn' && (
          <CheckInProperties
            data={selectedNode.data as CheckInNodeData}
            onUpdate={(data) => onNodeUpdate(selectedNode.id, data)}
          />
        )}
        {nodeType === 'escalation' && (
          <EscalationProperties
            data={selectedNode.data as EscalationNodeData}
            onUpdate={(data) => onNodeUpdate(selectedNode.id, data)}
          />
        )}
        {nodeType === 'role' && (
          <RoleProperties
            data={selectedNode.data as RoleNodeData}
            onUpdate={(data) => onNodeUpdate(selectedNode.id, data)}
          />
        )}
        {nodeType === 'visibility' && (
          <VisibilityProperties
            data={selectedNode.data as VisibilityNodeData}
            onUpdate={(data) => onNodeUpdate(selectedNode.id, data)}
          />
        )}
      </div>
    </div>
  );
}

interface CheckInPropertiesProps {
  data: CheckInNodeData;
  onUpdate: (data: CheckInNodeData) => void;
}

function CheckInProperties({ data, onUpdate }: CheckInPropertiesProps) {
  return (
    <>
      <div>
        <Label htmlFor="frequency">Frequency</Label>
        <Select
          value={data.frequency}
          onValueChange={(value: 'daily' | 'weekly') => onUpdate({ ...data, frequency: value })}
        >
          <SelectTrigger id="frequency">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="daily">Daily</SelectItem>
            <SelectItem value="weekly">Weekly</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label htmlFor="time">Time</Label>
        <Input
          id="time"
          type="time"
          value={data.time}
          onChange={(e) => onUpdate({ ...data, time: e.target.value })}
        />
      </div>
      <div>
        <Label htmlFor="squad">Squad (optional)</Label>
        <Select
          value={data.squadId || ''}
          onValueChange={(value) =>
            onUpdate({
              ...data,
              squadId: value || undefined,
              squadName: value ? 'Squad' : undefined,
            })
          }
        >
          <SelectTrigger id="squad">
            <SelectValue placeholder="All squads" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All squads</SelectItem>
            {/* Squad options would be populated dynamically */}
          </SelectContent>
        </Select>
      </div>
    </>
  );
}

interface EscalationPropertiesProps {
  data: EscalationNodeData;
  onUpdate: (data: EscalationNodeData) => void;
}

function EscalationProperties({ data, onUpdate }: EscalationPropertiesProps) {
  return (
    <>
      <div>
        <Label htmlFor="triggerType">Trigger</Label>
        <Select
          value={data.triggerType}
          onValueChange={(value: EscalationNodeData['triggerType']) =>
            onUpdate({ ...data, triggerType: value })
          }
        >
          <SelectTrigger id="triggerType">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="missed_checkin">Missed Check-in</SelectItem>
            <SelectItem value="blocked_task">Blocked Task</SelectItem>
            <SelectItem value="overdue_task">Overdue Task</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>Escalation Steps</Label>
        <div className="mt-2 space-y-2">
          {(data.steps || []).length === 0 ? (
            <p className="text-xs text-muted-foreground">No steps configured.</p>
          ) : (
            (data.steps || []).map((step, index) => (
              <div key={step.id} className="text-xs p-2 rounded bg-muted">
                Step {index + 1}: {step.action} to {step.targetRole} after {step.delayMinutes}m
              </div>
            ))
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Step configuration will be available in a future update.
        </p>
      </div>
    </>
  );
}

interface RolePropertiesProps {
  data: RoleNodeData;
  onUpdate: (data: RoleNodeData) => void;
}

function RoleProperties({ data, onUpdate }: RolePropertiesProps) {
  const capabilities = ['create_task', 'assign_task', 'manage_members', 'configure_workflow'];

  return (
    <>
      <div>
        <Label htmlFor="roleName">Role Name</Label>
        <Input
          id="roleName"
          value={data.roleName}
          onChange={(e) => onUpdate({ ...data, roleName: e.target.value })}
          placeholder="e.g., Squad Lead"
        />
      </div>
      <div>
        <Label htmlFor="tier">Tier</Label>
        <Select
          value={String(data.tier)}
          onValueChange={(value) => onUpdate({ ...data, tier: Number(value) })}
        >
          <SelectTrigger id="tier">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1">Tier 1 (Highest)</SelectItem>
            <SelectItem value="2">Tier 2</SelectItem>
            <SelectItem value="3">Tier 3</SelectItem>
            <SelectItem value="4">Tier 4</SelectItem>
            <SelectItem value="5">Tier 5 (Lowest)</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>Capabilities</Label>
        <div className="mt-2 space-y-2">
          {capabilities.map((cap) => (
            <label key={cap} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={(data.capabilities || []).includes(cap)}
                onChange={(e) => {
                  const caps = data.capabilities || [];
                  const newCaps = e.target.checked ? [...caps, cap] : caps.filter((c) => c !== cap);
                  onUpdate({ ...data, capabilities: newCaps });
                }}
                className="rounded border-input"
              />
              <span className="capitalize">{cap.replace(/_/g, ' ')}</span>
            </label>
          ))}
        </div>
      </div>
    </>
  );
}

interface VisibilityPropertiesProps {
  data: VisibilityNodeData;
  onUpdate: (data: VisibilityNodeData) => void;
}

function VisibilityProperties({ data, onUpdate }: VisibilityPropertiesProps) {
  return (
    <>
      <div>
        <Label htmlFor="scope">Scope</Label>
        <Select
          value={data.scope}
          onValueChange={(value: VisibilityNodeData['scope']) =>
            onUpdate({ ...data, scope: value })
          }
        >
          <SelectTrigger id="scope">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="project">Project-wide</SelectItem>
            <SelectItem value="squad">Squad-only</SelectItem>
            <SelectItem value="custom">Custom</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {data.scope === 'custom' && (
        <div>
          <Label>Squad Grants</Label>
          <div className="mt-2 space-y-2">
            {(data.grants || []).length === 0 ? (
              <p className="text-xs text-muted-foreground">No grants configured.</p>
            ) : (
              (data.grants || []).map((grant) => (
                <div key={grant.id} className="text-xs p-2 rounded bg-muted">
                  {grant.squadName}
                </div>
              ))
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Grant configuration will be available in a future update.
          </p>
        </div>
      )}
    </>
  );
}
