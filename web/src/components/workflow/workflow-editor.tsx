'use client';

import {
  applyEdgeChanges,
  applyNodeChanges,
  type Edge,
  type OnEdgesChange,
  type OnNodesChange,
  ReactFlowProvider,
  useReactFlow,
} from '@xyflow/react';
import { Save } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { getLayoutedElements } from '@/lib/workflow/layout';
import { createNodeData, type WorkflowNode, type WorkflowNodeType } from '@/lib/workflow/types';
import { WorkflowCanvas } from './workflow-canvas';
import { WorkflowProperties } from './workflow-properties';
import { WorkflowSidebar } from './workflow-sidebar';

interface WorkflowEditorContentProps {
  initialNodes?: WorkflowNode[];
  initialEdges?: Edge[];
  onSave?: (nodes: WorkflowNode[], edges: Edge[]) => void;
}

function WorkflowEditorContent({
  initialNodes = [],
  initialEdges = [],
  onSave,
}: WorkflowEditorContentProps) {
  const [nodes, setNodes] = useState<WorkflowNode[]>(initialNodes);
  const [edges, setEdges] = useState<Edge[]>(initialEdges);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const { screenToFlowPosition } = useReactFlow();
  const edgesRef = useRef(edges);

  // Keep ref in sync with edges state (in effect, not during render)
  useEffect(() => {
    edgesRef.current = edges;
  }, [edges]);

  const onNodesChange: OnNodesChange<WorkflowNode> = useCallback(
    (changes) => setNodes((nds) => applyNodeChanges(changes, nds)),
    []
  );

  const onEdgesChange: OnEdgesChange = useCallback(
    (changes) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    []
  );

  const handleNodeClick = useCallback((nodeId: string) => {
    setSelectedNodeId(nodeId);
  }, []);

  const handleNodeUpdate = useCallback((nodeId: string, data: WorkflowNode['data']) => {
    setNodes((nds) => nds.map((n) => (n.id === nodeId ? ({ ...n, data } as WorkflowNode) : n)));
  }, []);

  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const handleDrop = useCallback(
    async (event: React.DragEvent) => {
      event.preventDefault();

      const nodeType = event.dataTransfer.getData('application/reactflow') as WorkflowNodeType;
      if (!nodeType) return;

      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const newNode: WorkflowNode = {
        id: `${nodeType}-${Date.now()}`,
        type: nodeType,
        position,
        data: createNodeData(nodeType),
      };

      const updated = [...nodes, newNode];
      const { nodes: layoutedNodes } = await getLayoutedElements(updated, edgesRef.current);
      setNodes(layoutedNodes);
    },
    [screenToFlowPosition, nodes]
  );

  const handleSave = useCallback(() => {
    if (onSave) {
      onSave(nodes, edges);
    } else {
      // Default behavior: log to console
      console.log('Workflow saved:', { nodes, edges });
    }
  }, [nodes, edges, onSave]);

  const selectedNode = nodes.find((n) => n.id === selectedNodeId) || null;

  return (
    <div className="flex h-full">
      <WorkflowSidebar />
      <div className="flex-1 flex flex-col">
        <div className="flex items-center justify-between p-4 border-b">
          <h1 className="text-lg font-semibold">Workflow Editor</h1>
          <Button onClick={handleSave} size="sm">
            <Save className="h-4 w-4 mr-2" />
            Save
          </Button>
        </div>
        <div className="flex-1">
          <WorkflowCanvas
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={handleNodeClick}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
          />
        </div>
      </div>
      <WorkflowProperties selectedNode={selectedNode} onNodeUpdate={handleNodeUpdate} />
    </div>
  );
}

interface WorkflowEditorProps {
  initialNodes?: WorkflowNode[];
  initialEdges?: Edge[];
  onSave?: (nodes: WorkflowNode[], edges: Edge[]) => void;
}

export function WorkflowEditor({ initialNodes, initialEdges, onSave }: WorkflowEditorProps) {
  return (
    <ReactFlowProvider>
      <WorkflowEditorContent
        initialNodes={initialNodes}
        initialEdges={initialEdges}
        onSave={onSave}
      />
    </ReactFlowProvider>
  );
}
