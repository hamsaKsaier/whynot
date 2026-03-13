import dagre from '@dagrejs/dagre';
import type { Node, Edge } from 'reactflow';

/** Dimensions dagre uses to allocate space for each node type */
const NODE_DIMENSIONS: Record<string, { width: number; height: number }> = {
  project: { width: 280, height: 100 },
  folder: { width: 240, height: 80 },
  userStory: { width: 260, height: 120 },
  testSuite: { width: 240, height: 85 },
  testCase: { width: 260, height: 105 },
  testStep: { width: 220, height: 70 },
};

const DEFAULT_DIMS = { width: 220, height: 80 };

export interface DagreLayoutOptions {
  rankdir?: 'TB' | 'BT' | 'LR' | 'RL';
  nodesep?: number;
  ranksep?: number;
  marginx?: number;
  marginy?: number;
}

/**
 * Applies dagre hierarchical layout to a set of ReactFlow nodes and edges.
 * Returns new arrays with updated positions (does not mutate originals).
 */
export function applyDagreLayout(
  nodes: Node[],
  edges: Edge[],
  options?: DagreLayoutOptions,
): { nodes: Node[]; edges: Edge[] } {
  if (nodes.length === 0) return { nodes: [], edges };

  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));

  g.setGraph({
    rankdir: options?.rankdir ?? 'TB',
    nodesep: options?.nodesep ?? 80,
    ranksep: options?.ranksep ?? 100,
    marginx: options?.marginx ?? 40,
    marginy: options?.marginy ?? 40,
  });

  // Register nodes with their expected dimensions
  for (const node of nodes) {
    const dims = NODE_DIMENSIONS[node.type ?? ''] ?? DEFAULT_DIMS;
    g.setNode(node.id, { width: dims.width, height: dims.height });
  }

  // Register edges
  for (const edge of edges) {
    g.setEdge(edge.source, edge.target);
  }

  dagre.layout(g);

  // Dagre gives center coordinates; ReactFlow uses top-left
  const layoutedNodes = nodes.map((node) => {
    const pos = g.node(node.id);
    const dims = NODE_DIMENSIONS[node.type ?? ''] ?? DEFAULT_DIMS;
    return {
      ...node,
      position: {
        x: pos.x - dims.width / 2,
        y: pos.y - dims.height / 2,
      },
    };
  });

  return { nodes: layoutedNodes, edges };
}
