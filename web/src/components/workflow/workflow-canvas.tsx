'use client';

import {
  Background,
  BackgroundVariant,
  Controls,
  type Edge,
  type NodeTypes,
  type OnEdgesChange,
  type OnNodesChange,
  ReactFlow,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import type { WorkflowNode } from '@/lib/workflow/types';
import { CheckInNode, EscalationNode, RoleNode, VisibilityNode } from './nodes';

// CRITICAL: Define nodeTypes outside component to prevent re-render flickering
const nodeTypes: NodeTypes = {
  checkIn: CheckInNode,
  escalation: EscalationNode,
  role: RoleNode,
  visibility: VisibilityNode,
};

interface WorkflowCanvasProps {
  nodes: WorkflowNode[];
  edges: Edge[];
  onNodesChange: OnNodesChange<WorkflowNode>;
  onEdgesChange: OnEdgesChange;
  onNodeClick?: (nodeId: string) => void;
  onDrop?: (event: React.DragEvent) => void;
  onDragOver?: (event: React.DragEvent) => void;
}

export function WorkflowCanvas({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onNodeClick,
  onDrop,
  onDragOver,
}: WorkflowCanvasProps) {
  return (
    <div className="h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={(_, node) => onNodeClick?.(node.id)}
        onDrop={onDrop}
        onDragOver={onDragOver}
        nodeTypes={nodeTypes}
        fitView
        proOptions={{ hideAttribution: true }}
        className="bg-muted/30"
      >
        <Controls />
        <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
      </ReactFlow>
    </div>
  );
}
