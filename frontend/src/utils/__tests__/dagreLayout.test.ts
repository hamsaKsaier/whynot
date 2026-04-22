import { describe, it, expect, vi } from 'vitest';

// Mock dagre before importing the module
vi.mock('@dagrejs/dagre', () => {
  const nodes = new Map<string, any>();
  const edges: Array<{ source: string; target: string }> = [];

  return {
    default: {
      graphlib: {
        Graph: vi.fn().mockImplementation(() => ({
          setDefaultEdgeLabel: vi.fn(),
          setGraph: vi.fn(),
          setNode: vi.fn((id: string, data: any) => {
            nodes.set(id, { ...data, x: 100, y: 100 });
          }),
          setEdge: vi.fn((source: string, target: string) => {
            edges.push({ source, target });
          }),
          node: vi.fn((id: string) => ({
            x: 150,
            y: 200,
          })),
        })),
      },
      layout: vi.fn(),
    },
  };
});

import { applyDagreLayout } from '../dagreLayout';
import type { Node, Edge } from 'reactflow';

describe('applyDagreLayout', () => {
  it('returns empty nodes for empty input', () => {
    const result = applyDagreLayout([], []);
    expect(result.nodes).toEqual([]);
    expect(result.edges).toEqual([]);
  });

  it('returns positioned nodes', () => {
    const nodes: Node[] = [
      { id: '1', type: 'project', position: { x: 0, y: 0 }, data: {} },
      { id: '2', type: 'folder', position: { x: 0, y: 0 }, data: {} },
    ];
    const edges: Edge[] = [
      { id: 'e1-2', source: '1', target: '2' },
    ];

    const result = applyDagreLayout(nodes, edges);

    expect(result.nodes).toHaveLength(2);
    expect(result.edges).toHaveLength(1);
    // Nodes should have updated positions
    result.nodes.forEach((node) => {
      expect(node.position).toBeDefined();
      expect(typeof node.position.x).toBe('number');
      expect(typeof node.position.y).toBe('number');
    });
  });

  it('preserves original node data', () => {
    const nodes: Node[] = [
      { id: '1', type: 'testCase', position: { x: 0, y: 0 }, data: { label: 'Test' } },
    ];

    const result = applyDagreLayout(nodes, []);
    expect(result.nodes[0].data).toEqual({ label: 'Test' });
    expect(result.nodes[0].id).toBe('1');
    expect(result.nodes[0].type).toBe('testCase');
  });

  it('passes through edges unchanged', () => {
    const nodes: Node[] = [
      { id: '1', position: { x: 0, y: 0 }, data: {} },
      { id: '2', position: { x: 0, y: 0 }, data: {} },
    ];
    const edges: Edge[] = [
      { id: 'e1-2', source: '1', target: '2' },
    ];

    const result = applyDagreLayout(nodes, edges);
    expect(result.edges).toBe(edges);
  });

  it('accepts layout options', () => {
    const nodes: Node[] = [
      { id: '1', position: { x: 0, y: 0 }, data: {} },
    ];

    const result = applyDagreLayout(nodes, [], {
      rankdir: 'LR',
      nodesep: 100,
      ranksep: 120,
      marginx: 50,
      marginy: 50,
    });

    expect(result.nodes).toHaveLength(1);
  });

  it('handles nodes with unknown types using default dimensions', () => {
    const nodes: Node[] = [
      { id: '1', type: 'unknownType', position: { x: 0, y: 0 }, data: {} },
    ];

    const result = applyDagreLayout(nodes, []);
    expect(result.nodes).toHaveLength(1);
    expect(result.nodes[0].position).toBeDefined();
  });

  it('handles nodes with no type', () => {
    const nodes: Node[] = [
      { id: '1', position: { x: 0, y: 0 }, data: {} },
    ];

    const result = applyDagreLayout(nodes, []);
    expect(result.nodes).toHaveLength(1);
  });
});
