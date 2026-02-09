import type { Edge, Node } from '@xyflow/react';

const NODE_WIDTH = 200;
const NODE_HEIGHT = 80;

/**
 * Apply dagre tree layout to nodes and edges
 * @param nodes - React Flow nodes
 * @param edges - React Flow edges
 * @param direction - Layout direction: 'TB' (top-bottom) or 'LR' (left-right)
 * @returns Repositioned nodes and edges
 */
export async function getLayoutedElements<N extends Node>(
  nodes: N[],
  edges: Edge[],
  direction: 'TB' | 'LR' = 'TB'
): Promise<{ nodes: N[]; edges: Edge[] }> {
  if (nodes.length === 0) {
    return { nodes, edges };
  }

  // Dynamic import to avoid Turbopack CJS require issues
  const dagre = (await import('@dagrejs/dagre')).default;

  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({ rankdir: direction, nodesep: 50, ranksep: 80 });

  // Add nodes to dagre graph
  for (const node of nodes) {
    dagreGraph.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  }

  // Add edges to dagre graph
  for (const edge of edges) {
    dagreGraph.setEdge(edge.source, edge.target);
  }

  // Run layout algorithm
  dagre.layout(dagreGraph);

  // Update node positions from dagre
  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    return {
      ...node,
      position: {
        x: nodeWithPosition.x - NODE_WIDTH / 2,
        y: nodeWithPosition.y - NODE_HEIGHT / 2,
      },
    };
  });

  return { nodes: layoutedNodes, edges };
}

export { NODE_WIDTH, NODE_HEIGHT };
