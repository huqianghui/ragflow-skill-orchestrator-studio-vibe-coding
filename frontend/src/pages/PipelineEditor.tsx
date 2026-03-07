import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  Button, Card, Empty, Input, Modal, Select, Space, Spin,
  Tag, Tooltip, Typography, Upload, message,
} from 'antd';
import {
  ArrowLeftOutlined, BugOutlined, CheckCircleFilled, CloseCircleFilled,
  CodeOutlined, DeleteOutlined, DownloadOutlined, EditOutlined,
  FileTextOutlined, ImportOutlined, InboxOutlined,
  LinkOutlined, MenuFoldOutlined, MenuUnfoldOutlined,
  PlusOutlined, SaveOutlined, UploadOutlined,
} from '@ant-design/icons';
import {
  ReactFlow, Background, Controls, MiniMap, ReactFlowProvider,
  Handle, Position, useReactFlow,
  useNodesState, useEdgesState,
  type Node as RFNode, type Edge as RFEdge, type NodeProps,
  type OnNodesChange, type OnEdgesChange, type Connection,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type {
  NodeExecutionResult, Pipeline, PipelineDebugResult, PipelineEdge,
  PipelineNode, Skill,
} from '../types';
import { pipelinesApi } from '../services/api';

const { Title, Text, Paragraph } = Typography;
const { Dragger } = Upload;

// ====================================================================
// Constants
// ====================================================================

const DOC_NODE_ID = '__document__';
const NODE_WIDTH = 240;
const NODE_H_GAP = 280;
const NODE_V_GAP = 100;

// Document-initial paths (not produced by any skill)
const DOCUMENT_INITIAL_PATHS = new Set([
  '/document/file_content',
  '/document/file_name',
]);

// ====================================================================
// Custom Node Types
// ====================================================================

type DocNodeData = { label: string };
type SkillNodeData = {
  label: string;
  skillName: string;
  position: number;
  isBuiltin: boolean;
  connectionId?: string;
};

function DocumentNode({ data }: NodeProps<RFNode<DocNodeData>>) {
  return (
    <div style={{
      background: '#fff', border: '2px solid #d9d9d9', borderRadius: 8,
      padding: '12px 16px', minWidth: 140, textAlign: 'center',
    }}>
      <FileTextOutlined style={{ fontSize: 24, color: '#1677ff', display: 'block' }} />
      <div style={{ fontWeight: 600, marginTop: 4, fontSize: 13 }}>{data.label}</div>
      <Handle type="source" position={Position.Right} style={{ background: '#1677ff' }} />
    </div>
  );
}

function SkillNode({ data, selected }: NodeProps<RFNode<SkillNodeData>>) {
  return (
    <div style={{
      background: '#fff',
      border: `2px solid ${selected ? '#1677ff' : '#d9d9d9'}`,
      borderRadius: 8, padding: '10px 14px', minWidth: NODE_WIDTH,
      boxShadow: selected ? '0 0 0 2px rgba(22,119,255,0.2)' : 'none',
    }}>
      <Handle type="target" position={Position.Left} style={{ background: '#1677ff' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        <Tag color="blue" style={{ margin: 0 }}>#{data.position + 1}</Tag>
        <span style={{ fontWeight: 600, fontSize: 13, flex: 1 }}>
          {data.skillName}
        </span>
        <Tag color={data.isBuiltin ? 'cyan' : 'purple'} style={{ margin: 0, fontSize: 10 }}>
          {data.isBuiltin ? 'Builtin' : 'Custom'}
        </Tag>
      </div>
      {data.label !== data.skillName && (
        <div style={{ fontSize: 12, color: '#666', marginBottom: 2 }}>{data.label}</div>
      )}
      {data.connectionId && (
        <div style={{ fontSize: 11, color: '#999' }}>
          <LinkOutlined style={{ marginRight: 4 }} />{data.connectionId}
        </div>
      )}
      <Handle type="source" position={Position.Right} style={{ background: '#1677ff' }} />
    </div>
  );
}

const nodeTypes = {
  document: DocumentNode,
  skill: SkillNode,
};

// ====================================================================
// Conversion / layout helpers
// ====================================================================

function autoLayout(pNodes: PipelineNode[]): PipelineNode[] {
  const sorted = [...pNodes].sort((a, b) => a.position - b.position);
  const startX = 50 + NODE_H_GAP;
  const centerY = 200;

  return sorted.map((n, i) => {
    if (n.x !== undefined && n.y !== undefined) return n;
    return {
      ...n,
      x: startX + i * NODE_H_GAP,
      y: centerY - (sorted.length * NODE_V_GAP) / 2 + i * NODE_V_GAP,
    };
  });
}

function pipelineNodesToFlowNodes(
  pNodes: PipelineNode[],
  skills: Skill[],
): RFNode[] {
  const centerY = 200;
  const docNode: RFNode<DocNodeData> = {
    id: DOC_NODE_ID,
    type: 'document',
    position: { x: 50, y: centerY },
    data: { label: 'Document' },
    deletable: false,
  };

  const skillNodes: RFNode[] = pNodes.map((n) => {
    const skill = skills.find(s => s.name === n.skill_name);
    return {
      id: n.id,
      type: 'skill',
      position: { x: n.x ?? 350, y: n.y ?? 200 },
      data: {
        label: n.label,
        skillName: n.skill_name,
        position: n.position,
        isBuiltin: skill?.is_builtin ?? true,
        connectionId: n.bound_connection_id,
      } as SkillNodeData,
    };
  });

  return [docNode, ...skillNodes];
}

/** Compute the output path a node writes to for a given output def. */
function nodeOutputPath(node: PipelineNode, out: { name: string; targetName: string }): string {
  const ctx = node.context || '/document';
  const target = out.targetName || out.name;
  return ctx.endsWith('/*')
    ? `${ctx.replace('/*', '')}/*/${target}`
    : `${ctx}/${target}`;
}

/**
 * Derive edges using the enrichment-tree model:
 * 1. For each input source, find the LATEST earlier skill that produces it.
 * 2. If no skill produces it and it's a document-initial path → edge from Document.
 * 3. Add dashed execution-order edges between consecutive nodes not already connected.
 */
function deriveEdges(pNodes: PipelineNode[]): RFEdge[] {
  const edges: RFEdge[] = [];
  const edgeSet = new Set<string>();
  const sorted = [...pNodes].sort((a, b) => a.position - b.position);

  const addEdge = (src: string, tgt: string) => {
    const key = `${src}->${tgt}`;
    if (edgeSet.has(key)) return;
    edgeSet.add(key);
    edges.push({
      id: key,
      source: src,
      target: tgt,
      animated: true,
      deletable: true,
      interactionWidth: 20,
      style: { stroke: '#1677ff', strokeWidth: 2 },
    });
  };

  for (const n of sorted) {
    for (const inp of n.inputs || []) {
      const src = inp.source || '';
      if (!src) continue;

      // Find the LATEST earlier node that produces this path
      let producerNodeId: string | null = null;
      for (const earlier of sorted) {
        if (earlier.position >= n.position) break;
        for (const out of earlier.outputs || []) {
          if (nodeOutputPath(earlier, out) === src) {
            producerNodeId = earlier.id;
          }
        }
      }

      if (producerNodeId) {
        addEdge(producerNodeId, n.id);
      } else if (DOCUMENT_INITIAL_PATHS.has(src)) {
        addEdge(DOC_NODE_ID, n.id);
      }
    }
  }

  // First node always connects from Document
  if (sorted.length > 0) {
    addEdge(DOC_NODE_ID, sorted[0].id);
  }

  return edges;
}

function edgesToPipelineEdges(rfEdges: RFEdge[]): PipelineEdge[] {
  return rfEdges.map(e => ({
    id: e.id,
    source: e.source,
    target: e.target,
    sourceHandle: e.sourceHandle ?? undefined,
    targetHandle: e.targetHandle ?? undefined,
  }));
}

/**
 * Auto-wire: find a better input source from the previous node's outputs.
 * For inputs defaulting to /document/content, try to use the previous node's
 * primary text-like output instead, so the pipeline chains sequentially.
 */
function autoWireInputs(
  defaultInputs: { name: string; source: string }[],
  prevNode: PipelineNode | null,
): { name: string; source: string }[] {
  if (!prevNode) return defaultInputs;

  const prevOutputs = (prevNode.outputs || []).map(out => ({
    name: out.name,
    targetName: out.targetName || out.name,
    path: nodeOutputPath(prevNode, out),
  }));

  if (prevOutputs.length === 0) return defaultInputs;

  // Text-like output names in priority order
  const textLikeNames = [
    'content', 'text', 'markdown', 'translatedText',
    'redactedText', 'mergedText', 'aiOutput', 'output', 'chunks',
  ];

  // Find the best text-like output from the previous node
  let bestTextOutput = prevOutputs[0]; // fallback to first output
  for (const name of textLikeNames) {
    const found = prevOutputs.find(o => o.name === name || o.targetName === name);
    if (found) {
      bestTextOutput = found;
      break;
    }
  }

  return defaultInputs.map(inp => {
    // Only auto-wire inputs that default to /document/content
    // (don't change /document/file_content or /document/file_name inputs)
    if (inp.source === '/document/content' && bestTextOutput.path !== '/document/content') {
      return { ...inp, source: bestTextOutput.path };
    }
    return inp;
  });
}

/**
 * Cycle detection: returns true if adding an edge from `source` to `target`
 * would create a cycle in the DAG. Uses DFS from `target` following existing
 * edges to see if it can reach `source`.
 */
function wouldCreateCycle(
  source: string,
  target: string,
  pNodes: PipelineNode[],
): boolean {
  // Build adjacency from current input sources
  const adj = new Map<string, string[]>();
  for (const n of pNodes) adj.set(n.id, []);

  const sorted = [...pNodes].sort((a, b) => a.position - b.position);
  for (const n of sorted) {
    for (const inp of n.inputs || []) {
      const src = inp.source || '';
      if (!src) continue;
      for (const earlier of sorted) {
        if (earlier.position >= n.position) break;
        for (const out of earlier.outputs || []) {
          if (nodeOutputPath(earlier, out) === src) {
            adj.get(earlier.id)?.push(n.id);
          }
        }
      }
    }
  }

  // Simulate adding the new edge
  if (!adj.has(source)) adj.set(source, []);
  adj.get(source)!.push(target);

  // DFS from source, check if we can reach source again (cycle)
  const visited = new Set<string>();
  const stack = [target];
  while (stack.length > 0) {
    const cur = stack.pop()!;
    if (cur === source) return true; // cycle found
    if (visited.has(cur)) continue;
    visited.add(cur);
    for (const next of adj.get(cur) || []) {
      stack.push(next);
    }
  }
  return false;
}

/**
 * Topological sort: recompute position values based on edge topology.
 * Ensures source nodes always execute before target nodes.
 */
function topologicalSort(
  pNodes: PipelineNode[],
  rfEdges: { source: string; target: string }[],
): PipelineNode[] {
  if (pNodes.length === 0) return pNodes;
  const nodeMap = new Map(pNodes.map(n => [n.id, n]));
  const inDeg = new Map(pNodes.map(n => [n.id, 0]));
  const adj = new Map<string, string[]>(pNodes.map(n => [n.id, []]));

  for (const e of rfEdges) {
    if (e.source === DOC_NODE_ID) continue;
    if (!nodeMap.has(e.source) || !nodeMap.has(e.target)) continue;
    adj.get(e.source)!.push(e.target);
    inDeg.set(e.target, (inDeg.get(e.target) ?? 0) + 1);
  }

  // Kahn's algorithm — among equal-in-degree nodes, prefer current order
  const queue: string[] = [];
  for (const [id, deg] of inDeg) {
    if (deg === 0) queue.push(id);
  }
  queue.sort((a, b) => (nodeMap.get(a)!.position - nodeMap.get(b)!.position));

  const sorted: string[] = [];
  while (queue.length > 0) {
    queue.sort((a, b) => (nodeMap.get(a)!.position - nodeMap.get(b)!.position));
    const id = queue.shift()!;
    sorted.push(id);
    for (const next of adj.get(id) || []) {
      const nd = (inDeg.get(next) ?? 1) - 1;
      inDeg.set(next, nd);
      if (nd === 0) queue.push(next);
    }
  }

  // Append any remaining (cycle-safe)
  for (const n of pNodes) {
    if (!sorted.includes(n.id)) sorted.push(n.id);
  }

  return sorted.map((id, i) => ({ ...nodeMap.get(id)!, position: i }));
}

// ====================================================================
// Main component
// ====================================================================

export default function PipelineEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const mode = searchParams.get('mode') === 'debug' ? 'debug' : 'edit';

  const [pipeline, setPipeline] = useState<Pipeline | null>(null);
  const [nodes, setNodes] = useState<PipelineNode[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [jsonModalOpen, setJsonModalOpen] = useState(false);

  // Debug state
  const [debugFile, setDebugFile] = useState<File | null>(null);
  const [debugRunning, setDebugRunning] = useState(false);
  const [debugResult, setDebugResult] = useState<PipelineDebugResult | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  // Load pipeline & skills
  useEffect(() => {
    if (!id) return;
    const load = async () => {
      setLoading(true);
      try {
        const [p, s] = await Promise.all([
          pipelinesApi.get(id),
          pipelinesApi.getAvailableSkills(),
        ]);
        setPipeline(p);
        const layouted = autoLayout(p.graph_data?.nodes || []);
        setNodes(layouted);
        setSkills(s);
      } catch {
        message.error('Failed to load pipeline');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  const setMode = (m: 'edit' | 'debug') => {
    setSearchParams(m === 'debug' ? { mode: 'debug' } : {});
  };

  // ====================================================================
  // Edit mode handlers
  // ====================================================================

  const handleSave = async (currentNodes?: PipelineNode[]) => {
    if (!id || !pipeline) return;
    setSaving(true);
    const toSave = currentNodes ?? nodes;
    const edges = edgesToPipelineEdges(deriveEdges(toSave));
    try {
      await pipelinesApi.update(id, {
        graph_data: { nodes: toSave, edges },
      });
      message.success('Pipeline saved');
    } catch {
      message.error('Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const updateNode = useCallback((nodeId: string, patch: Partial<PipelineNode>) => {
    setNodes(prev => prev.map(n => n.id === nodeId ? { ...n, ...patch } : n));
  }, []);

  const removeNode = useCallback((nodeId: string) => {
    setNodes(prev => {
      const filtered = prev.filter(n => n.id !== nodeId);
      return filtered.map((n, i) => ({ ...n, position: i }));
    });
    setSelectedNodeId(prev => prev === nodeId ? null : prev);
  }, []);

  // Available output paths for source dropdowns
  const availablePaths = useMemo(() => {
    const paths = ['/document/file_content', '/document/file_name'];
    for (const node of nodes) {
      for (const out of node.outputs || []) {
        paths.push(nodeOutputPath(node, out));
      }
    }
    return [...new Set(paths)];
  }, [nodes]);

  // ====================================================================
  // JSON import/export
  // ====================================================================

  const handleJsonApply = useCallback((jsonStr: string) => {
    try {
      const data = JSON.parse(jsonStr);
      const importedNodes: PipelineNode[] = data.nodes || data.graph_data?.nodes || [];
      if (!Array.isArray(importedNodes)) {
        message.error('Invalid JSON: nodes must be an array');
        return false;
      }
      const layouted = autoLayout(importedNodes);
      setNodes(layouted);
      setJsonModalOpen(false);
      message.success(`Loaded ${layouted.length} nodes from JSON`);
      return true;
    } catch (e) {
      message.error(`Invalid JSON: ${e instanceof Error ? e.message : 'parse error'}`);
      return false;
    }
  }, []);

  const handleJsonImportFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result as string;
      handleJsonApply(text);
    };
    reader.readAsText(file);
  }, [handleJsonApply]);

  const handleJsonExport = useCallback(() => {
    const edges = edgesToPipelineEdges(deriveEdges(nodes));
    const data = { nodes, edges };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${pipeline?.name || 'pipeline'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [nodes, pipeline?.name]);

  // ====================================================================
  // Debug mode handlers
  // ====================================================================

  const runDebug = async () => {
    if (!id || !debugFile) return;
    setDebugRunning(true);
    setDebugResult(null);
    setSelectedNodeId(null);
    try {
      const edges = edgesToPipelineEdges(deriveEdges(nodes));
      await pipelinesApi.update(id, { graph_data: { nodes, edges } });
      const result = await pipelinesApi.debug(id, debugFile);
      setDebugResult(result);
      if (result.node_results.length > 0) {
        setSelectedNodeId(result.node_results[0].node_id);
      }
    } catch {
      message.error('Debug execution failed');
    } finally {
      setDebugRunning(false);
    }
  };

  const selectedNodeResult = useMemo(
    () => debugResult?.node_results.find(nr => nr.node_id === selectedNodeId) ?? null,
    [debugResult, selectedNodeId],
  );

  // ====================================================================
  // Render
  // ====================================================================

  if (loading) return <Spin style={{ display: 'block', margin: '100px auto' }} size="large" />;
  if (!pipeline) return <Empty description="Pipeline not found" />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 64px)' }}>
      {/* Top bar */}
      <div style={{
        padding: '8px 16px', borderBottom: '1px solid #f0f0f0',
        display: 'flex', alignItems: 'center', gap: 12, background: '#fff',
      }}>
        <Button icon={<ArrowLeftOutlined />} type="text" onClick={() => navigate('/pipelines')} />
        <Title level={4} style={{ margin: 0, flex: 1 }}>{pipeline.name}</Title>
        <Space>
          {mode === 'edit' && (
            <>
              <Button icon={<CodeOutlined />} onClick={() => setJsonModalOpen(true)}>
                JSON
              </Button>
              <Upload
                accept=".json"
                showUploadList={false}
                beforeUpload={(file) => { handleJsonImportFile(file); return false; }}
              >
                <Button icon={<ImportOutlined />}>Import</Button>
              </Upload>
              <Button icon={<DownloadOutlined />} onClick={handleJsonExport}>
                Export
              </Button>
            </>
          )}
          <Button
            type={mode === 'debug' ? 'primary' : 'default'}
            icon={<BugOutlined />}
            onClick={() => setMode(mode === 'debug' ? 'edit' : 'debug')}
          >
            Debug
          </Button>
          {mode === 'edit' && (
            <Button
              icon={<SaveOutlined />}
              type="primary"
              loading={saving}
              onClick={() => handleSave()}
            >
              Save
            </Button>
          )}
        </Space>
      </div>

      {/* Content */}
      {mode === 'edit' ? (
        <ReactFlowProvider>
          <EditMode
            nodes={nodes}
            skills={skills}
            availablePaths={availablePaths}
            selectedNodeId={selectedNodeId}
            setSelectedNodeId={setSelectedNodeId}
            updateNode={updateNode}
            removeNode={removeNode}
            setNodes={setNodes}
          />
        </ReactFlowProvider>
      ) : (
        <DebugMode
          nodes={nodes}
          debugFile={debugFile}
          setDebugFile={setDebugFile}
          debugRunning={debugRunning}
          debugResult={debugResult}
          selectedNodeId={selectedNodeId}
          setSelectedNodeId={setSelectedNodeId}
          selectedNodeResult={selectedNodeResult}
          runDebug={runDebug}
        />
      )}

      {/* JSON Editor Modal */}
      <JsonEditorModal
        open={jsonModalOpen}
        nodes={nodes}
        onApply={handleJsonApply}
        onCancel={() => setJsonModalOpen(false)}
      />
    </div>
  );
}

// ====================================================================
// Edit Mode — React Flow DAG Canvas
// ====================================================================

function EditMode({
  nodes, skills, availablePaths, selectedNodeId, setSelectedNodeId,
  updateNode, removeNode, setNodes,
}: {
  nodes: PipelineNode[];
  skills: Skill[];
  availablePaths: string[];
  selectedNodeId: string | null;
  setSelectedNodeId: (id: string | null) => void;
  updateNode: (id: string, patch: Partial<PipelineNode>) => void;
  removeNode: (id: string) => void;
  setNodes: React.Dispatch<React.SetStateAction<PipelineNode[]>>;
}) {
  const [sidebarTab, setSidebarTab] = useState<'skills' | 'config'>('skills');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const reactFlowInstance = useReactFlow();

  const initialFlowNodes = useMemo(
    () => pipelineNodesToFlowNodes(nodes, skills),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [nodes.length, skills],
  );
  const initialEdges = useMemo(() => deriveEdges(nodes), [nodes]);

  const [rfNodes, setRfNodes, onNodesChange] = useNodesState(initialFlowNodes);
  const [rfEdges, setRfEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Sync pipeline nodes -> flow nodes when pipeline data changes
  useEffect(() => {
    setRfNodes(pipelineNodesToFlowNodes(nodes, skills));
    setRfEdges(deriveEdges(nodes));
  }, [nodes, skills, setRfNodes, setRfEdges]);

  // Sync drag position changes back to pipeline nodes
  const handleNodesChange: OnNodesChange = useCallback((changes) => {
    onNodesChange(changes);

    const positionChanges = changes.filter(
      c => c.type === 'position' && 'position' in c && c.position && !c.dragging,
    );
    if (positionChanges.length > 0) {
      setNodes(prev => {
        const updated = [...prev];
        for (const change of positionChanges) {
          if ('position' in change && change.position) {
            const idx = updated.findIndex(n => n.id === change.id);
            if (idx >= 0) {
              updated[idx] = { ...updated[idx], x: change.position.x, y: change.position.y };
            }
          }
        }
        return updated;
      });
    }
  }, [onNodesChange, setNodes]);

  const handleEdgesChange: OnEdgesChange = useCallback((changes) => {
    onEdgesChange(changes);
  }, [onEdgesChange]);

  // -- Edge deletion: clear the input source that produced the edge --
  const handleEdgesDelete = useCallback((deletedEdges: RFEdge[]) => {
    setNodes(prev => {
      let updated = [...prev];
      for (const edge of deletedEdges) {
        // Skip non-data edges
        if (!edge.source || !edge.target) continue;

        const srcNodeId = edge.source;
        const tgtNodeId = edge.target;
        const tgtIdx = updated.findIndex(n => n.id === tgtNodeId);
        if (tgtIdx < 0) continue;

        const tgtNode = updated[tgtIdx];

        if (srcNodeId === DOC_NODE_ID) {
          // Clear any document-initial inputs on target
          const newInputs = (tgtNode.inputs || []).map(inp =>
            DOCUMENT_INITIAL_PATHS.has(inp.source) ? { ...inp, source: '' } : inp
          );
          updated[tgtIdx] = { ...tgtNode, inputs: newInputs };
        } else {
          // Clear inputs whose source matches the source node's outputs
          const srcNode = updated.find(n => n.id === srcNodeId);
          if (!srcNode) continue;
          const srcOutputPaths = new Set(
            (srcNode.outputs || []).map(out => nodeOutputPath(srcNode, out))
          );
          const newInputs = (tgtNode.inputs || []).map(inp =>
            srcOutputPaths.has(inp.source) ? { ...inp, source: '' } : inp
          );
          updated[tgtIdx] = { ...tgtNode, inputs: newInputs };
        }
      }
      return updated;
    });
  }, [setNodes]);

  // -- Manual edge connection: user drags handle A → handle B --
  const handleConnect = useCallback((conn: Connection) => {
    if (!conn.source || !conn.target) return;
    if (conn.source === conn.target) return; // self-loop

    if (conn.source === DOC_NODE_ID) {
      // Connect from Document → target: set target's first applicable input to document path
      setNodes(prev => {
        const tgt = prev.find(n => n.id === conn.target);
        if (!tgt || !tgt.inputs?.length) return prev;
        const updated = prev.map(n => {
          if (n.id !== conn.target) return n;
          const newInputs = [...(n.inputs || [])];
          // Set first input to a document path if not already
          if (newInputs.length > 0 && !DOCUMENT_INITIAL_PATHS.has(newInputs[0].source)) {
            newInputs[0] = { ...newInputs[0], source: '/document/file_content' };
          }
          return { ...n, inputs: newInputs };
        });
        return updated;
      });
      return;
    }

    // DAG cycle check — prevent creating cycles
    if (wouldCreateCycle(conn.source, conn.target, nodes)) {
      message.warning('Cannot connect: this would create a cycle. Pipeline must be a DAG.');
      return;
    }

    // Connect from skill A → skill B
    setNodes(prev => {
      const srcNode = prev.find(n => n.id === conn.source);
      const tgtNode = prev.find(n => n.id === conn.target);
      if (!srcNode || !tgtNode) return prev;

      // Get source node's primary output path
      const srcOutputs = (srcNode.outputs || []);
      if (srcOutputs.length === 0) return prev;
      const primaryOutput = nodeOutputPath(srcNode, srcOutputs[0]);

      // Update target node's first text-like input
      const updated = prev.map(n => {
        if (n.id !== conn.target) return n;
        const newInputs = [...(n.inputs || [])];
        if (newInputs.length > 0) {
          newInputs[0] = { ...newInputs[0], source: primaryOutput };
        }
        return { ...n, inputs: newInputs };
      });

      // Topological sort to ensure correct execution order
      const edges = deriveEdges(updated);
      const sorted = topologicalSort(updated, edges);
      return sorted;
    });
  }, [setNodes, nodes]);

  // -- Drag & Drop: skill from sidebar onto canvas --
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const skillName = e.dataTransfer.getData('application/skill-name');
    if (!skillName) return;

    const skill = skills.find(s => s.name === skillName);
    if (!skill) return;

    const pos = reactFlowInstance.screenToFlowPosition({
      x: e.clientX,
      y: e.clientY,
    });

    // Build new node at drop position
    const pio = skill.pipeline_io;
    const prevNode = nodes.length > 0 ? nodes[nodes.length - 1] : null;
    const defaultInputs = pio?.inputs?.map(i => ({ name: i.name, source: i.source })) || [];
    const wiredInputs = autoWireInputs(defaultInputs, prevNode);

    const newNode: PipelineNode = {
      id: `node-${Date.now()}`,
      skill_name: skill.name,
      label: skill.name,
      position: nodes.length,
      context: pio?.default_context || '/document',
      inputs: wiredInputs,
      outputs: pio?.outputs?.map(o => ({ name: o.name, targetName: o.targetName })) || [],
      config_overrides: {},
      x: pos.x,
      y: pos.y,
    };

    setNodes(prev => [...prev, newNode]);
    setSelectedNodeId(newNode.id);
    setSidebarTab('config');
    setSidebarCollapsed(false);
  }, [skills, nodes, reactFlowInstance, setNodes, setSelectedNodeId]);

  const handleNodeClick = useCallback((_: React.MouseEvent, node: RFNode) => {
    if (node.id === DOC_NODE_ID) {
      setSelectedNodeId(null);
      setSidebarTab('skills');
      return;
    }
    setSelectedNodeId(node.id);
    setSidebarTab('config');
    setSidebarCollapsed(false);
  }, [setSelectedNodeId]);

  const handlePaneClick = useCallback(() => {
    setSelectedNodeId(null);
  }, [setSelectedNodeId]);

  const selectedNode = nodes.find(n => n.id === selectedNodeId) ?? null;
  const selectedSkill = selectedNode
    ? skills.find(s => s.name === selectedNode.skill_name) ?? null
    : null;

  return (
    <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
      {/* Canvas */}
      <div style={{ flex: 1, position: 'relative' }}>
        <ReactFlow
          nodes={rfNodes}
          edges={rfEdges}
          onNodesChange={handleNodesChange}
          onEdgesChange={handleEdgesChange}
          onEdgesDelete={handleEdgesDelete}
          onConnect={handleConnect}
          onNodeClick={handleNodeClick}
          onPaneClick={handlePaneClick}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          nodeTypes={nodeTypes}
          deleteKeyCode="Backspace"
          fitView
          fitViewOptions={{ padding: 0.3 }}
          minZoom={0.2}
          maxZoom={2}
          proOptions={{ hideAttribution: true }}
        >
          <Background gap={20} size={1} />
          <Controls />
          <MiniMap
            nodeColor={(n) => n.type === 'document' ? '#1677ff' : '#e6f4ff'}
            style={{ height: 80, width: 120 }}
          />
        </ReactFlow>
      </div>

      {/* Right Sidebar — collapsible, tabbed: Skills / Config */}
      <div style={{
        width: sidebarCollapsed ? 40 : 380,
        minWidth: sidebarCollapsed ? 40 : 380,
        borderLeft: '1px solid #f0f0f0', background: '#fafafa',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        transition: 'width 0.2s, min-width 0.2s',
      }}>
        {/* Collapse toggle */}
        <div
          onClick={() => setSidebarCollapsed(prev => !prev)}
          style={{
            padding: '8px 0', textAlign: 'center', cursor: 'pointer',
            borderBottom: '1px solid #f0f0f0', background: '#fff',
            color: '#999', fontSize: 14,
          }}
        >
          {sidebarCollapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
        </div>

        {!sidebarCollapsed && (
          <>
            {/* Tab bar */}
            <div style={{
              display: 'flex', borderBottom: '1px solid #f0f0f0', background: '#fff',
            }}>
              <div
                onClick={() => setSidebarTab('skills')}
                style={{
                  flex: 1, padding: '10px 0', textAlign: 'center', cursor: 'pointer',
                  fontWeight: sidebarTab === 'skills' ? 600 : 400,
                  color: sidebarTab === 'skills' ? '#1677ff' : '#666',
                  borderBottom: sidebarTab === 'skills'
                    ? '2px solid #1677ff' : '2px solid transparent',
                  fontSize: 13,
                }}
              >
                <PlusOutlined style={{ marginRight: 6 }} />Add Skill
              </div>
              <div
                onClick={() => { if (selectedNode) setSidebarTab('config'); }}
                style={{
                  flex: 1, padding: '10px 0', textAlign: 'center',
                  cursor: selectedNode ? 'pointer' : 'not-allowed',
                  fontWeight: sidebarTab === 'config' ? 600 : 400,
                  color: sidebarTab === 'config'
                    ? '#1677ff' : selectedNode ? '#666' : '#ccc',
                  borderBottom: sidebarTab === 'config'
                    ? '2px solid #1677ff' : '2px solid transparent',
                  fontSize: 13,
                }}
              >
                <EditOutlined style={{ marginRight: 6 }} />
                {selectedNode
                  ? (selectedNode.label || selectedNode.skill_name)
                  : 'Node Config'}
              </div>
            </div>

            {/* Tab content */}
            <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
              {sidebarTab === 'skills' ? (
                <AddSkillPanel skills={skills} />
              ) : selectedNode ? (
                <ConfigPanel
                  node={selectedNode}
                  skill={selectedSkill}
                  availablePaths={availablePaths}
                  onUpdate={(patch) => updateNode(selectedNode.id, patch)}
                  onDelete={() => {
                    removeNode(selectedNode.id);
                    setSidebarTab('skills');
                  }}
                />
              ) : (
                <Empty
                  description="Select a node on the canvas"
                  style={{ marginTop: 60 }}
                />
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ====================================================================
// Config Panel (right sidebar in edit mode)
// ====================================================================

function ConfigPanel({
  node, skill, availablePaths, onUpdate, onDelete,
}: {
  node: PipelineNode;
  skill: Skill | null;
  availablePaths: string[];
  onUpdate: (patch: Partial<PipelineNode>) => void;
  onDelete: () => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Tag color="blue">#{node.position + 1}</Tag>
        <Text strong style={{ flex: 1 }}>{node.skill_name}</Text>
        <Tag color={skill?.is_builtin ? 'cyan' : 'purple'}>
          {skill?.is_builtin ? 'Builtin' : 'Custom'}
        </Tag>
      </div>

      {/* Label */}
      <div>
        <Text type="secondary" style={{ fontSize: 12 }}>Label</Text>
        <Input
          value={node.label}
          onChange={e => onUpdate({ label: e.target.value })}
          size="small"
        />
      </div>

      {/* Context Path */}
      <div>
        <Text type="secondary" style={{ fontSize: 12 }}>Context Path</Text>
        <Input
          value={node.context}
          onChange={e => onUpdate({ context: e.target.value })}
          size="small"
          placeholder="/document"
        />
      </div>

      {/* Inputs */}
      {(node.inputs || []).length > 0 && (
        <div>
          <Text type="secondary" strong style={{ fontSize: 12 }}>Inputs</Text>
          {(node.inputs || []).map((inp, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, marginTop: 6, alignItems: 'center' }}>
              <Tag style={{ minWidth: 80, textAlign: 'center' }}>{inp.name}</Tag>
              <Select
                value={inp.source}
                onChange={(val) => {
                  const newInputs = [...(node.inputs || [])];
                  newInputs[i] = { ...newInputs[i], source: val };
                  onUpdate({ inputs: newInputs });
                }}
                size="small"
                style={{ flex: 1 }}
                showSearch
                allowClear
                placeholder="Select source path"
              >
                {availablePaths.map(p => (
                  <Select.Option key={p} value={p}>{p}</Select.Option>
                ))}
              </Select>
            </div>
          ))}
        </div>
      )}

      {/* Outputs */}
      {(node.outputs || []).length > 0 && (
        <div>
          <Text type="secondary" strong style={{ fontSize: 12 }}>Outputs</Text>
          {(node.outputs || []).map((out, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, marginTop: 6, alignItems: 'center' }}>
              <Tag style={{ minWidth: 80, textAlign: 'center' }}>{out.name}</Tag>
              <Input
                value={out.targetName}
                onChange={(e) => {
                  const newOutputs = [...(node.outputs || [])];
                  newOutputs[i] = { ...newOutputs[i], targetName: e.target.value };
                  onUpdate({ outputs: newOutputs });
                }}
                size="small"
                style={{ flex: 1 }}
                addonBefore="target"
              />
            </div>
          ))}
        </div>
      )}

      {/* Config overrides (JSON) */}
      <div>
        <Text type="secondary" strong style={{ fontSize: 12 }}>Config Overrides (JSON)</Text>
        <Input.TextArea
          rows={4}
          value={JSON.stringify(node.config_overrides || {}, null, 2)}
          onChange={(e) => {
            try {
              const parsed = JSON.parse(e.target.value);
              onUpdate({ config_overrides: parsed });
            } catch {
              // allow invalid JSON while typing
            }
          }}
          style={{ fontFamily: 'monospace', fontSize: 12, marginTop: 4 }}
        />
      </div>

      {/* Delete */}
      <Button danger icon={<DeleteOutlined />} block onClick={onDelete}>
        Delete Node
      </Button>
    </div>
  );
}

// ====================================================================
// JSON Editor Modal
// ====================================================================

function JsonEditorModal({
  open, nodes, onApply, onCancel,
}: {
  open: boolean;
  nodes: PipelineNode[];
  onApply: (json: string) => boolean;
  onCancel: () => void;
}) {
  const edges = useMemo(() => edgesToPipelineEdges(deriveEdges(nodes)), [nodes]);
  const initialJson = useMemo(
    () => JSON.stringify({ nodes, edges }, null, 2),
    [nodes, edges],
  );
  const [jsonText, setJsonText] = useState(initialJson);
  const [jsonError, setJsonError] = useState<string | null>(null);

  // Sync when modal opens or nodes change
  useEffect(() => {
    if (open) {
      const e = edgesToPipelineEdges(deriveEdges(nodes));
      setJsonText(JSON.stringify({ nodes, edges: e }, null, 2));
      setJsonError(null);
    }
  }, [open, nodes]);

  const handleChange = (value: string) => {
    setJsonText(value);
    try {
      JSON.parse(value);
      setJsonError(null);
    } catch (e) {
      setJsonError(e instanceof Error ? e.message : 'Invalid JSON');
    }
  };

  return (
    <Modal
      title="Pipeline JSON Editor"
      open={open}
      onCancel={onCancel}
      width={800}
      footer={[
        <Button key="cancel" onClick={onCancel}>Cancel</Button>,
        <Button
          key="apply"
          type="primary"
          disabled={!!jsonError}
          onClick={() => onApply(jsonText)}
        >
          Apply
        </Button>,
      ]}
    >
      <div style={{ marginBottom: 8 }}>
        <Text type="secondary">
          Edit the pipeline graph_data JSON directly. Accepts {`{ nodes: [...] }`} or
          {` { graph_data: { nodes: [...] } }`} format.
        </Text>
      </div>
      <Input.TextArea
        rows={24}
        value={jsonText}
        onChange={(e) => handleChange(e.target.value)}
        style={{
          fontFamily: 'monospace',
          fontSize: 12,
          borderColor: jsonError ? '#ff4d4f' : undefined,
        }}
      />
      {jsonError && (
        <Text type="danger" style={{ fontSize: 12, marginTop: 4, display: 'block' }}>
          {jsonError}
        </Text>
      )}
    </Modal>
  );
}

// ====================================================================
// Add Skill Panel
// ====================================================================

function AddSkillPanel({ skills }: { skills: Skill[] }) {
  const [filter, setFilter] = useState('');
  const builtinSkills = skills.filter(s => s.is_builtin);
  const customSkills = skills.filter(s => !s.is_builtin);

  const filtered = (list: Skill[]) =>
    list.filter(s =>
      s.name.toLowerCase().includes(filter.toLowerCase()) ||
      (s.description || '').toLowerCase().includes(filter.toLowerCase())
    );

  const onDragStart = (e: React.DragEvent, skill: Skill) => {
    e.dataTransfer.setData('application/skill-name', skill.name);
    e.dataTransfer.effectAllowed = 'move';
  };

  const renderSkillItem = (s: Skill) => (
    <div
      key={s.name}
      draggable
      onDragStart={(e) => onDragStart(e, s)}
      style={{
        padding: '8px 12px', marginBottom: 4, borderRadius: 6,
        background: '#fff', border: '1px solid #e8e8e8',
        cursor: 'grab', userSelect: 'none',
        display: 'flex', alignItems: 'flex-start', gap: 8,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 500, fontSize: 13 }}>{s.name}</div>
        {s.description && (
          <div style={{ fontSize: 11, color: '#888', marginTop: 2, lineHeight: 1.4 }}>
            {s.description}
          </div>
        )}
      </div>
      {s.required_resource_types?.length
        ? <Tag color="orange" style={{ margin: 0, flexShrink: 0 }}>
            {s.required_resource_types[0]}
          </Tag>
        : <Tag color="green" style={{ margin: 0, flexShrink: 0 }}>Local</Tag>
      }
    </div>
  );

  return (
    <div>
      <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 8 }}>
        Drag a skill onto the canvas to add it
      </Text>
      <Input.Search
        placeholder="Search skills..."
        value={filter}
        onChange={e => setFilter(e.target.value)}
        style={{ marginBottom: 12 }}
      />
      {builtinSkills.length > 0 && (
        <>
          <Text type="secondary" strong style={{ fontSize: 12 }}>Built-in Skills</Text>
          <div style={{ marginTop: 6, marginBottom: 12 }}>
            {filtered(builtinSkills).map(renderSkillItem)}
          </div>
        </>
      )}
      {customSkills.length > 0 && (
        <>
          <Text type="secondary" strong style={{ fontSize: 12 }}>Custom Skills</Text>
          <div style={{ marginTop: 6 }}>
            {filtered(customSkills).map(renderSkillItem)}
          </div>
        </>
      )}
    </div>
  );
}

// ====================================================================
// Debug Mode — 3-column layout
// ====================================================================

function DebugMode({
  nodes, debugFile, setDebugFile, debugRunning, debugResult,
  selectedNodeId, setSelectedNodeId, selectedNodeResult, runDebug,
}: {
  nodes: PipelineNode[];
  debugFile: File | null;
  setDebugFile: (f: File | null) => void;
  debugRunning: boolean;
  debugResult: PipelineDebugResult | null;
  selectedNodeId: string | null;
  setSelectedNodeId: (id: string | null) => void;
  selectedNodeResult: NodeExecutionResult | null;
  runDebug: () => void;
}) {
  return (
    <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
      {/* Left column — file upload + status list */}
      <div style={{
        width: 240, borderRight: '1px solid #f0f0f0', padding: 12,
        display: 'flex', flexDirection: 'column', overflow: 'auto',
      }}>
        <Dragger
          accept="*"
          maxCount={1}
          showUploadList={false}
          beforeUpload={(file) => { setDebugFile(file); return false; }}
          style={{ marginBottom: 12 }}
        >
          <p className="ant-upload-drag-icon"><InboxOutlined /></p>
          <p className="ant-upload-text" style={{ fontSize: 13 }}>
            {debugFile ? debugFile.name : 'Drop file here'}
          </p>
          {debugFile && (
            <p className="ant-upload-hint" style={{ fontSize: 11 }}>
              {(debugFile.size / 1024).toFixed(1)} KB
            </p>
          )}
        </Dragger>

        <Button
          type="primary"
          icon={<UploadOutlined />}
          block
          disabled={!debugFile || nodes.length === 0}
          loading={debugRunning}
          onClick={runDebug}
          style={{ marginBottom: 12 }}
        >
          Run Debug
        </Button>

        {/* Node status list */}
        <div style={{ flex: 1 }}>
          {nodes.map(node => {
            const nr = debugResult?.node_results.find(r => r.node_id === node.id);
            const icon = !nr ? null :
              nr.status === 'success' ? <CheckCircleFilled style={{ color: '#52c41a' }} /> :
              <CloseCircleFilled style={{ color: '#ff4d4f' }} />;

            return (
              <div
                key={node.id}
                onClick={() => nr && setSelectedNodeId(node.id)}
                style={{
                  padding: '6px 8px', cursor: nr ? 'pointer' : 'default',
                  borderRadius: 4, marginBottom: 4,
                  background: selectedNodeId === node.id ? '#e6f4ff' : 'transparent',
                  display: 'flex', alignItems: 'center', gap: 6,
                }}
              >
                {icon}
                <Text
                  style={{ flex: 1, fontSize: 13 }}
                  ellipsis
                >
                  {node.label || node.skill_name}
                </Text>
                {nr && (
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    {nr.execution_time_ms}ms
                  </Text>
                )}
              </div>
            );
          })}

          {/* Summary */}
          {debugResult && (
            <div style={{
              marginTop: 12, padding: 8, borderTop: '1px solid #f0f0f0', fontSize: 12,
            }}>
              <div>Status: <Tag color={debugResult.status === 'success' ? 'green' : 'orange'}>
                {debugResult.status}
              </Tag></div>
              <div>Total: {debugResult.total_execution_time_ms}ms</div>
              <div>
                Nodes: {debugResult.node_results.filter(r => r.status === 'success').length}/
                {debugResult.node_results.length}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Middle column — enrichment tree */}
      <div style={{ flex: 1, overflow: 'auto', padding: 12 }}>
        {debugResult ? (
          <TreeViewer data={debugResult.enrichment_tree} />
        ) : (
          <Empty
            description="Upload a file and click Run Debug to see results"
            style={{ marginTop: 80 }}
          />
        )}
      </div>

      {/* Right column — node detail */}
      <div style={{
        width: 400, borderLeft: '1px solid #f0f0f0', padding: 12, overflow: 'auto',
      }}>
        {selectedNodeResult ? (
          <NodeDetail result={selectedNodeResult} />
        ) : (
          <Empty description="Click a node to see details" style={{ marginTop: 80 }} />
        )}
      </div>
    </div>
  );
}

// ====================================================================
// Enrichment Tree Viewer
// ====================================================================

function TreeViewer({ data }: { data: Record<string, unknown> }) {
  return (
    <div>
      <Text strong style={{ marginBottom: 8, display: 'block' }}>Enrichment Tree</Text>
      <div style={{ fontFamily: 'monospace', fontSize: 12 }}>
        <TreeNode name="root" value={data} depth={0} defaultExpanded />
      </div>
    </div>
  );
}

function TreeNode({
  name, value, depth, defaultExpanded = false,
}: {
  name: string;
  value: unknown;
  depth: number;
  defaultExpanded?: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded || depth < 2);

  if (value === null || value === undefined) {
    return (
      <div style={{ paddingLeft: depth * 16 }}>
        <Text type="secondary">{name}: </Text><Text>null</Text>
      </div>
    );
  }

  if (typeof value === 'string') {
    const display = value.length > 200 ? value.slice(0, 200) + '...' : value;
    return (
      <div style={{ paddingLeft: depth * 16 }}>
        <Text type="secondary">{name}: </Text>
        <Tooltip title={value.length > 200 ? value : undefined}>
          <Text style={{ color: '#389e0d' }}>"{display}"</Text>
        </Tooltip>
      </div>
    );
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return (
      <div style={{ paddingLeft: depth * 16 }}>
        <Text type="secondary">{name}: </Text>
        <Text style={{ color: '#1d39c4' }}>{String(value)}</Text>
      </div>
    );
  }

  if (Array.isArray(value)) {
    return (
      <div style={{ paddingLeft: depth * 16 }}>
        <span
          onClick={() => setExpanded(!expanded)}
          style={{ cursor: 'pointer', userSelect: 'none' }}
        >
          {expanded ? '▼' : '▶'}{' '}
          <Text type="secondary">{name}</Text>{' '}
          <Tag style={{ fontSize: 10 }}>Array [{value.length}]</Tag>
        </span>
        {expanded && value.map((item, i) => (
          <TreeNode key={i} name={String(i)} value={item} depth={depth + 1} />
        ))}
      </div>
    );
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    return (
      <div style={{ paddingLeft: depth * 16 }}>
        <span
          onClick={() => setExpanded(!expanded)}
          style={{ cursor: 'pointer', userSelect: 'none' }}
        >
          {expanded ? '▼' : '▶'}{' '}
          <Text type="secondary">{name}</Text>{' '}
          <Tag style={{ fontSize: 10 }}>Object {`{${entries.length}}`}</Tag>
        </span>
        {expanded && entries.map(([k, v]) => (
          <TreeNode key={k} name={k} value={v} depth={depth + 1} />
        ))}
      </div>
    );
  }

  return (
    <div style={{ paddingLeft: depth * 16 }}>
      <Text type="secondary">{name}: </Text>
      <Text>{String(value)}</Text>
    </div>
  );
}

// ====================================================================
// Node Detail Panel
// ====================================================================

function NodeDetail({ result }: { result: NodeExecutionResult }) {
  const [recordIdx, setRecordIdx] = useState(0);

  return (
    <div>
      <Title level={5} style={{ margin: 0 }}>
        {result.label || result.skill_name}
      </Title>
      <Space style={{ marginTop: 8 }}>
        <Tag color={result.status === 'success' ? 'green' : 'red'}>{result.status}</Tag>
        <Text type="secondary">{result.execution_time_ms}ms</Text>
        <Text type="secondary">{result.records_processed} record(s)</Text>
      </Space>

      {result.errors.length > 0 && (
        <Card size="small" style={{ marginTop: 12, borderColor: '#ff4d4f' }}>
          <Text type="danger" strong>Errors</Text>
          {result.errors.map((e, i) => (
            <Paragraph key={i} style={{ margin: '4px 0', fontSize: 12 }}>
              {e.message}
            </Paragraph>
          ))}
        </Card>
      )}

      {result.warnings.length > 0 && (
        <Card size="small" style={{ marginTop: 8, borderColor: '#faad14' }}>
          <Text style={{ color: '#faad14' }} strong>Warnings</Text>
          {result.warnings.map((w, i) => (
            <Paragraph key={i} style={{ margin: '4px 0', fontSize: 12 }}>{w}</Paragraph>
          ))}
        </Card>
      )}

      {/* Record selector for fan-out */}
      {result.records_processed > 1 && (
        <div style={{ marginTop: 12 }}>
          <Text type="secondary">Record: </Text>
          <Select
            value={recordIdx}
            onChange={setRecordIdx}
            size="small"
            style={{ width: 120 }}
          >
            {Array.from({ length: result.records_processed }, (_, i) => (
              <Select.Option key={i} value={i}>Record {i}</Select.Option>
            ))}
          </Select>
        </div>
      )}

      {/* Input snapshot */}
      {result.input_snapshots[recordIdx] && (
        <div style={{ marginTop: 12 }}>
          <Text strong>Input</Text>
          <pre style={{
            background: '#f6f6f6', padding: 8, borderRadius: 4,
            fontSize: 11, maxHeight: 200, overflow: 'auto',
          }}>
            {JSON.stringify(result.input_snapshots[recordIdx], null, 2)}
          </pre>
        </div>
      )}

      {/* Output snapshot */}
      {result.output_snapshots[recordIdx] && (
        <div style={{ marginTop: 12 }}>
          <Text strong>Output</Text>
          <pre style={{
            background: '#f6f8f0', padding: 8, borderRadius: 4,
            fontSize: 11, maxHeight: 200, overflow: 'auto',
          }}>
            {JSON.stringify(result.output_snapshots[recordIdx], null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
