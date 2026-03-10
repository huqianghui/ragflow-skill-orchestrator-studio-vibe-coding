import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Button, Card, Collapse, Empty, Input, Modal, Select, Space, Spin,
  Tag, Typography, message, theme,
} from 'antd';
import {
  ArrowLeftOutlined, DatabaseOutlined, DeleteOutlined,
  EditOutlined, ForkOutlined, LinkOutlined,
  MenuFoldOutlined, MenuUnfoldOutlined,
  PlusOutlined, RobotOutlined, SaveOutlined, SendOutlined,
} from '@ant-design/icons';
import {
  ReactFlow, Background, Controls, MiniMap, ReactFlowProvider,
  Handle, Position, useReactFlow,
  useNodesState, useEdgesState,
  type Node as RFNode, type Edge as RFEdge, type NodeProps,
  type Connection,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type {
  DataSource, Pipeline, Target, Workflow,
  WorkflowGraphNode, WorkflowGraphEdge, FileFilter,
} from '../types';
import {
  workflowsApi, dataSourcesApi, pipelinesApi, targetsApi,
} from '../services/api';
import type { AgentInfo } from '../types/agent';
import { agentApi } from '../services/agentApi';
import AgentChatWidget from '../components/agent/AgentChatWidget';
import AgentSelector from '../components/agent/AgentSelector';

const { Title, Text } = Typography;

// ====================================================================
// Constants
// ====================================================================

const COL_X = { dataSource: 50, router: 350, pipeline: 650, target: 950 };
const NODE_V_START = 80;
const NODE_V_GAP = 120;

// ====================================================================
// Custom Node Types
// ====================================================================

type DSNodeData = { label: string; dsType?: string };
type RouterNodeData = {
  label: string;
  filterSummary: string;
  isDefault: boolean;
};
type PipelineNodeData = { label: string; pipelineId?: string };
type TargetNodeData = { label: string; targetType?: string };

function DataSourceNode({ data, selected }: NodeProps<RFNode<DSNodeData>>) {
  const { token: t } = theme.useToken();
  return (
    <div style={{
      background: t.colorBgContainer,
      border: `2px solid ${selected ? '#1677ff' : '#91caff'}`,
      borderRadius: 8, padding: '10px 14px', minWidth: 160,
      boxShadow: selected ? '0 0 0 2px rgba(22,119,255,0.2)' : undefined,
    }}>
      <DatabaseOutlined style={{ fontSize: 18, color: '#1677ff', marginRight: 6 }} />
      <Text strong style={{ fontSize: 12 }}>{data.label}</Text>
      {data.dsType && (
        <Tag color="blue" style={{ fontSize: 10, marginLeft: 4 }}>{data.dsType}</Tag>
      )}
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

function RouterNode({ data, selected }: NodeProps<RFNode<RouterNodeData>>) {
  const { token: t } = theme.useToken();
  return (
    <div style={{
      background: t.colorBgContainer,
      border: data.isDefault
        ? `2px dashed ${selected ? '#52c41a' : '#b7eb8f'}`
        : `2px solid ${selected ? '#52c41a' : '#b7eb8f'}`,
      borderRadius: 8, padding: '10px 14px', minWidth: 160,
      boxShadow: selected ? '0 0 0 2px rgba(82,196,26,0.2)' : undefined,
    }}>
      <ForkOutlined style={{ fontSize: 18, color: '#52c41a', marginRight: 6 }} />
      <Text strong style={{ fontSize: 12 }}>{data.label}</Text>
      {data.isDefault && (
        <Tag color="orange" style={{ fontSize: 10, marginLeft: 4 }}>Default</Tag>
      )}
      {data.filterSummary && !data.isDefault && (
        <div style={{ marginTop: 4 }}>
          <Text type="secondary" style={{ fontSize: 10 }}>{data.filterSummary}</Text>
        </div>
      )}
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

function PipelineFlowNode({ data, selected }: NodeProps<RFNode<PipelineNodeData>>) {
  const { token: t } = theme.useToken();
  return (
    <div style={{
      background: t.colorBgContainer,
      border: `2px solid ${selected ? '#722ed1' : '#d3adf7'}`,
      borderRadius: 8, padding: '10px 14px', minWidth: 160,
      boxShadow: selected ? '0 0 0 2px rgba(114,46,209,0.2)' : undefined,
    }}>
      <EditOutlined style={{ fontSize: 18, color: '#722ed1', marginRight: 6 }} />
      <Text strong style={{ fontSize: 12 }}>{data.label}</Text>
      {data.pipelineId && (
        <a
          href={`/pipelines/${data.pipelineId}`}
          target="_blank"
          rel="noreferrer"
          onClick={(e) => e.stopPropagation()}
          style={{ fontSize: 10, marginLeft: 4 }}
        >
          <LinkOutlined />
        </a>
      )}
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

function TargetNode({ data, selected }: NodeProps<RFNode<TargetNodeData>>) {
  const { token: t } = theme.useToken();
  return (
    <div style={{
      background: t.colorBgContainer,
      border: `2px solid ${selected ? '#fa8c16' : '#ffd591'}`,
      borderRadius: 8, padding: '10px 14px', minWidth: 160,
      boxShadow: selected ? '0 0 0 2px rgba(250,140,22,0.2)' : undefined,
    }}>
      <SendOutlined style={{ fontSize: 18, color: '#fa8c16', marginRight: 6 }} />
      <Text strong style={{ fontSize: 12 }}>{data.label}</Text>
      {data.targetType && (
        <Tag color="orange" style={{ fontSize: 10, marginLeft: 4 }}>{data.targetType}</Tag>
      )}
      <Handle type="target" position={Position.Left} />
    </div>
  );
}

const nodeTypes = {
  data_source: DataSourceNode,
  router: RouterNode,
  pipeline: PipelineFlowNode,
  target: TargetNode,
};

// ====================================================================
// Helpers
// ====================================================================

function uuid() {
  return crypto.randomUUID();
}

function filterSummary(f?: FileFilter): string {
  if (!f) return '';
  const parts: string[] = [];
  if (f.extensions?.length) parts.push(`*.${f.extensions.join(', *.')}`);
  if (f.mime_types?.length) parts.push(f.mime_types.join(', '));
  if (f.path_pattern) parts.push(f.path_pattern);
  return parts.join(' | ') || '';
}

/** Convert WorkflowGraphNode[] → React Flow nodes */
function toRFNodes(
  graphNodes: WorkflowGraphNode[],
  dsLookup: Map<string, DataSource>,
  pipLookup: Map<string, Pipeline>,
  tgtLookup: Map<string, Target>,
): RFNode[] {
  return graphNodes.map((n) => {
    const base = { id: n.id, position: { x: n.x, y: n.y }, type: n.type };
    switch (n.type) {
      case 'data_source': {
        const ds = n.data_source_id ? dsLookup.get(n.data_source_id) : undefined;
        return { ...base, data: { label: ds?.name || 'DataSource', dsType: ds?.source_type } };
      }
      case 'router':
        return {
          ...base,
          data: {
            label: n.name || 'Router',
            filterSummary: filterSummary(n.file_filter),
            isDefault: !!n.is_default,
          },
        };
      case 'pipeline': {
        const pip = n.pipeline_id ? pipLookup.get(n.pipeline_id) : undefined;
        return { ...base, data: { label: pip?.name || 'Pipeline', pipelineId: n.pipeline_id } };
      }
      case 'target': {
        const tgt = n.target_id ? tgtLookup.get(n.target_id) : undefined;
        return { ...base, data: { label: tgt?.name || 'Target', targetType: tgt?.target_type } };
      }
      default:
        return { ...base, data: { label: 'Unknown' } };
    }
  });
}

function toRFEdges(graphEdges: WorkflowGraphEdge[]): RFEdge[] {
  return graphEdges.map((e) => ({
    id: e.id, source: e.source, target: e.target,
    style: { strokeWidth: 2 },
  }));
}

/** Rebuild WorkflowGraphNode[] from RF nodes + original graph nodes for metadata */
function fromRFNodes(rfNodes: RFNode[], origMap: Map<string, WorkflowGraphNode>): WorkflowGraphNode[] {
  return rfNodes.map((rf) => {
    const orig = origMap.get(rf.id);
    return {
      ...(orig || { id: rf.id, type: rf.type as WorkflowGraphNode['type'] }),
      x: rf.position.x,
      y: rf.position.y,
    } as WorkflowGraphNode;
  });
}

function fromRFEdges(rfEdges: RFEdge[]): WorkflowGraphEdge[] {
  return rfEdges.map((e) => ({ id: e.id, source: e.source, target: e.target }));
}

/** graph → routes/data_source_ids/default_route */
function graphToRoutes(
  graphNodes: WorkflowGraphNode[],
  graphEdges: WorkflowGraphEdge[],
) {
  const nodeMap = new Map(graphNodes.map((n) => [n.id, n]));

  // Build adjacency: source → target[]
  const adj = new Map<string, string[]>();
  for (const e of graphEdges) {
    const list = adj.get(e.source) || [];
    list.push(e.target);
    adj.set(e.source, list);
  }

  // Collect all DataSource IDs
  const dsIds = new Set<string>();
  for (const n of graphNodes) {
    if (n.type === 'data_source' && n.data_source_id) dsIds.add(n.data_source_id);
  }

  // For each router, find connected pipeline and targets
  const routes: Array<{
    name: string; priority: number; file_filter: FileFilter;
    pipeline_id: string; target_ids: string[];
  }> = [];
  let defaultRoute: { name: string; pipeline_id: string; target_ids: string[] } | null = null;

  for (const n of graphNodes) {
    if (n.type !== 'router') continue;
    // Router → Pipeline
    const routerTargets = adj.get(n.id) || [];
    const pipNode = routerTargets.map((id) => nodeMap.get(id)).find((t) => t?.type === 'pipeline');
    if (!pipNode?.pipeline_id) continue;

    // Pipeline → Target
    const pipTargets = adj.get(pipNode.id) || [];
    const targetIds = pipTargets
      .map((id) => nodeMap.get(id))
      .filter((t) => t?.type === 'target' && t.target_id)
      .map((t) => t!.target_id!);

    if (n.is_default) {
      defaultRoute = {
        name: n.name || 'default',
        pipeline_id: pipNode.pipeline_id,
        target_ids: targetIds,
      };
    } else {
      routes.push({
        name: n.name || 'Route',
        priority: n.priority ?? routes.length,
        file_filter: n.file_filter || {},
        pipeline_id: pipNode.pipeline_id,
        target_ids: targetIds,
      });
    }
  }

  return {
    data_source_ids: [...dsIds],
    routes,
    default_route: defaultRoute,
  };
}

/** routes → graph (for old workflows without graph_data) */
function routesToGraph(
  workflow: Workflow,
): { nodes: WorkflowGraphNode[]; edges: WorkflowGraphEdge[] } {
  const nodes: WorkflowGraphNode[] = [];
  const edges: WorkflowGraphEdge[] = [];
  const usedTargets = new Map<string, string>(); // target_id → node_id
  const usedPipelines = new Map<string, string>(); // pipeline_id → node_id

  // DataSource nodes (column 1)
  (workflow.data_source_ids || []).forEach((dsId, i) => {
    const nid = uuid();
    nodes.push({
      id: nid, type: 'data_source', x: COL_X.dataSource,
      y: NODE_V_START + i * NODE_V_GAP, data_source_id: dsId,
    });
  });

  // Routes → Router + Pipeline + Target nodes
  const allRoutes = [...(workflow.routes || [])];

  allRoutes.forEach((route, i) => {
    const routerId = uuid();
    nodes.push({
      id: routerId, type: 'router', x: COL_X.router,
      y: NODE_V_START + i * NODE_V_GAP,
      name: route.name, priority: route.priority, file_filter: route.file_filter,
    });

    // Connect all DataSource nodes to this router
    nodes.filter((n) => n.type === 'data_source').forEach((dsNode) => {
      edges.push({ id: uuid(), source: dsNode.id, target: routerId });
    });

    // Pipeline node (reuse if same pipeline_id)
    let pipNodeId = usedPipelines.get(route.pipeline_id);
    if (!pipNodeId) {
      pipNodeId = uuid();
      nodes.push({
        id: pipNodeId, type: 'pipeline', x: COL_X.pipeline,
        y: NODE_V_START + i * NODE_V_GAP, pipeline_id: route.pipeline_id,
      });
      usedPipelines.set(route.pipeline_id, pipNodeId);
    }
    edges.push({ id: uuid(), source: routerId, target: pipNodeId });

    // Target nodes
    (route.target_ids || []).forEach((tgtId) => {
      let tgtNodeId = usedTargets.get(tgtId);
      if (!tgtNodeId) {
        tgtNodeId = uuid();
        const tgtCount = nodes.filter((n) => n.type === 'target').length;
        nodes.push({
          id: tgtNodeId, type: 'target', x: COL_X.target,
          y: NODE_V_START + tgtCount * NODE_V_GAP, target_id: tgtId,
        });
        usedTargets.set(tgtId, tgtNodeId);
      }
      edges.push({ id: uuid(), source: pipNodeId!, target: tgtNodeId });
    });
  });

  // Default route
  if (workflow.default_route) {
    const dr = workflow.default_route;
    const routerIdx = allRoutes.length;
    const routerId = uuid();
    nodes.push({
      id: routerId, type: 'router', x: COL_X.router,
      y: NODE_V_START + routerIdx * NODE_V_GAP,
      name: dr.name || 'default', is_default: true,
    });

    // Connect all DataSource nodes
    nodes.filter((n) => n.type === 'data_source').forEach((dsNode) => {
      edges.push({ id: uuid(), source: dsNode.id, target: routerId });
    });

    let pipNodeId = usedPipelines.get(dr.pipeline_id);
    if (!pipNodeId) {
      pipNodeId = uuid();
      nodes.push({
        id: pipNodeId, type: 'pipeline', x: COL_X.pipeline,
        y: NODE_V_START + routerIdx * NODE_V_GAP, pipeline_id: dr.pipeline_id,
      });
      usedPipelines.set(dr.pipeline_id, pipNodeId);
    }
    edges.push({ id: uuid(), source: routerId, target: pipNodeId });

    (dr.target_ids || []).forEach((tgtId) => {
      let tgtNodeId = usedTargets.get(tgtId);
      if (!tgtNodeId) {
        tgtNodeId = uuid();
        const tgtCount = nodes.filter((n) => n.type === 'target').length;
        nodes.push({
          id: tgtNodeId, type: 'target', x: COL_X.target,
          y: NODE_V_START + tgtCount * NODE_V_GAP, target_id: tgtId,
        });
        usedTargets.set(tgtId, tgtNodeId);
      }
      edges.push({ id: uuid(), source: pipNodeId!, target: tgtNodeId });
    });
  }

  return { nodes, edges };
}

// ====================================================================
// Main Editor (inner, needs ReactFlowProvider)
// ====================================================================

function WorkflowEditorInner() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { token } = theme.useToken();
  const reactFlowInstance = useReactFlow();

  // --- State ---
  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const [graphNodes, setGraphNodes] = useState<WorkflowGraphNode[]>([]);
  const [rfNodes, setRFNodes, onNodesChange] = useNodesState<RFNode>([]);
  const [rfEdges, setRFEdges, onEdgesChange] = useEdgesState<RFEdge>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  // Lookups
  const [dsList, setDsList] = useState<DataSource[]>([]);
  const [pipList, setPipList] = useState<Pipeline[]>([]);
  const [tgtList, setTgtList] = useState<Target[]>([]);

  const dsLookup = useMemo(() => new Map(dsList.map((d) => [d.id, d])), [dsList]);
  const pipLookup = useMemo(() => new Map(pipList.map((p) => [p.id, p])), [pipList]);
  const tgtLookup = useMemo(() => new Map(tgtList.map((t) => [t.id, t])), [tgtList]);

  // Sidebar
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarMode, setSidebarMode] = useState<'add' | 'config' | 'agent'>('add');

  // Agent
  const [showAgent, setShowAgent] = useState(false);
  const [agentList, setAgentList] = useState<AgentInfo[]>([]);
  const [selectedAgentName, setSelectedAgentName] = useState('');
  const [selectedAgentMode, setSelectedAgentMode] = useState('ask');

  // Resource picker modal
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerType, setPickerType] = useState<'data_source' | 'pipeline' | 'target'>('data_source');
  const [pickerPosition, setPickerPosition] = useState<{ x: number; y: number } | null>(null);

  // Graph node metadata map
  const graphNodeMap = useMemo(
    () => new Map(graphNodes.map((n) => [n.id, n])),
    [graphNodes],
  );

  // --- Load data ---
  useEffect(() => {
    if (!id) return;
    const load = async () => {
      try {
        const [wf, dsRes, pipRes, tgtRes] = await Promise.all([
          workflowsApi.get(id),
          dataSourcesApi.list(1, 100),
          pipelinesApi.list(1, 100),
          targetsApi.list(1, 100),
        ]);
        setWorkflow(wf);
        setDsList(dsRes.items);
        setPipList(pipRes.items);
        setTgtList(tgtRes.items);

        const dsMap = new Map(dsRes.items.map((d) => [d.id, d]));
        const pipMap = new Map(pipRes.items.map((p) => [p.id, p]));
        const tgtMap = new Map(tgtRes.items.map((t) => [t.id, t]));

        // Build graph from graph_data or reverse-engineer from routes
        let gNodes: WorkflowGraphNode[];
        let gEdges: WorkflowGraphEdge[];
        if (wf.graph_data?.nodes?.length) {
          gNodes = wf.graph_data.nodes;
          gEdges = wf.graph_data.edges || [];
        } else {
          const generated = routesToGraph(wf);
          gNodes = generated.nodes;
          gEdges = generated.edges;
        }
        setGraphNodes(gNodes);
        setRFNodes(toRFNodes(gNodes, dsMap, pipMap, tgtMap));
        setRFEdges(toRFEdges(gEdges));
      } catch {
        message.error('Failed to load workflow');
        navigate('/workflows');
      } finally {
        setLoading(false);
      }
    };
    load();

    // Load agents
    agentApi.getAvailable().then((agents) => {
      setAgentList(agents);
      const first = agents.find((a) => a.available);
      if (first) setSelectedAgentName(first.name);
    }).catch(() => {});
  }, [id]);  // eslint-disable-line react-hooks/exhaustive-deps

  // --- Sync RF node moves back to graphNodes ---
  const handleNodesChange: typeof onNodesChange = useCallback((changes) => {
    onNodesChange(changes);
    const posChanges = changes.filter((c) => c.type === 'position' && c.position);
    if (posChanges.length > 0) {
      setDirty(true);
      setGraphNodes((prev) => {
        const map = new Map(prev.map((n) => [n.id, n]));
        for (const c of posChanges) {
          if (c.type === 'position' && c.position) {
            const existing = map.get(c.id);
            if (existing) map.set(c.id, { ...existing, x: c.position.x, y: c.position.y });
          }
        }
        return [...map.values()];
      });
    }
  }, [onNodesChange]);

  // --- Connection validation ---
  const isValidConnection = useCallback((conn: RFEdge | Connection) => {
    const srcNode = graphNodeMap.get(conn.source);
    const tgtNode = graphNodeMap.get(conn.target);
    if (!srcNode || !tgtNode) return false;

    const allowed: Record<string, string> = {
      data_source: 'router',
      router: 'pipeline',
      pipeline: 'target',
    };
    if (allowed[srcNode.type] !== tgtNode.type) return false;

    // Router → Pipeline: 1:1 constraint
    if (srcNode.type === 'router') {
      const alreadyConnected = rfEdges.some(
        (e) => e.source === conn.source && graphNodeMap.get(e.target)?.type === 'pipeline',
      );
      if (alreadyConnected) {
        message.warning('一个 Router 只能连接一个 Pipeline');
        return false;
      }
    }
    return true;
  }, [graphNodeMap, rfEdges]);

  const handleConnect = useCallback((conn: Connection) => {
    if (!conn.source || !conn.target) return;
    const newEdge: RFEdge = {
      id: uuid(), source: conn.source, target: conn.target,
      style: { strokeWidth: 2 },
    };
    setRFEdges((prev) => [...prev, newEdge]);
    setDirty(true);
  }, [setRFEdges]);

  // --- Node selection ---
  const handleNodeClick = useCallback((_: React.MouseEvent, node: RFNode) => {
    setSelectedNodeId(node.id);
    setSidebarMode('config');
    setShowAgent(false);
    if (sidebarCollapsed) setSidebarCollapsed(false);
  }, [sidebarCollapsed]);

  const handlePaneClick = useCallback(() => {
    setSelectedNodeId(null);
    if (!showAgent) setSidebarMode('add');
  }, [showAgent]);

  // --- Node deletion ---
  const handleDeleteNode = useCallback((nodeId: string) => {
    setGraphNodes((prev) => prev.filter((n) => n.id !== nodeId));
    setRFNodes((prev) => prev.filter((n) => n.id !== nodeId));
    setRFEdges((prev) => prev.filter((e) => e.source !== nodeId && e.target !== nodeId));
    setSelectedNodeId(null);
    setSidebarMode('add');
    setDirty(true);
  }, [setRFNodes, setRFEdges]);

  // --- Edge deletion ---
  const handleEdgesDelete = useCallback((deleted: RFEdge[]) => {
    const ids = new Set(deleted.map((e) => e.id));
    setRFEdges((prev) => prev.filter((e) => !ids.has(e.id)));
    setDirty(true);
  }, [setRFEdges]);

  // --- Drag & Drop ---
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const nodeType = e.dataTransfer.getData('application/workflow-node-type') as WorkflowGraphNode['type'];
    if (!nodeType) return;

    const pos = reactFlowInstance.screenToFlowPosition({ x: e.clientX, y: e.clientY });

    if (nodeType === 'router') {
      // Create router directly
      const nid = uuid();
      const gNode: WorkflowGraphNode = {
        id: nid, type: 'router', x: pos.x, y: pos.y, name: 'New Router',
      };
      setGraphNodes((prev) => [...prev, gNode]);
      setRFNodes((prev) => [...prev, {
        id: nid, type: 'router', position: { x: pos.x, y: pos.y },
        data: { label: 'New Router', filterSummary: '', isDefault: false },
      }]);
      setSelectedNodeId(nid);
      setSidebarMode('config');
      setDirty(true);
    } else {
      // Open picker for DS/Pipeline/Target
      setPickerType(nodeType);
      setPickerPosition(pos);
      setPickerOpen(true);
    }
  }, [reactFlowInstance, setRFNodes]);

  // Handle resource selection from picker modal
  const handlePickerSelect = useCallback((resourceId: string) => {
    if (!pickerPosition) return;
    const nid = uuid();

    if (pickerType === 'data_source') {
      const ds = dsLookup.get(resourceId);
      const gNode: WorkflowGraphNode = {
        id: nid, type: 'data_source', x: pickerPosition.x, y: pickerPosition.y,
        data_source_id: resourceId,
      };
      setGraphNodes((prev) => [...prev, gNode]);
      setRFNodes((prev) => [...prev, {
        id: nid, type: 'data_source', position: pickerPosition,
        data: { label: ds?.name || 'DataSource', dsType: ds?.source_type },
      }]);
    } else if (pickerType === 'pipeline') {
      const pip = pipLookup.get(resourceId);
      const gNode: WorkflowGraphNode = {
        id: nid, type: 'pipeline', x: pickerPosition.x, y: pickerPosition.y,
        pipeline_id: resourceId,
      };
      setGraphNodes((prev) => [...prev, gNode]);
      setRFNodes((prev) => [...prev, {
        id: nid, type: 'pipeline', position: pickerPosition,
        data: { label: pip?.name || 'Pipeline', pipelineId: resourceId },
      }]);
    } else if (pickerType === 'target') {
      const tgt = tgtLookup.get(resourceId);
      const gNode: WorkflowGraphNode = {
        id: nid, type: 'target', x: pickerPosition.x, y: pickerPosition.y,
        target_id: resourceId,
      };
      setGraphNodes((prev) => [...prev, gNode]);
      setRFNodes((prev) => [...prev, {
        id: nid, type: 'target', position: pickerPosition,
        data: { label: tgt?.name || 'Target', targetType: tgt?.target_type },
      }]);
    }

    setPickerOpen(false);
    setPickerPosition(null);
    setDirty(true);
  }, [pickerType, pickerPosition, dsLookup, pipLookup, tgtLookup, setRFNodes]);

  // --- Click to add ---
  const handleClickAdd = useCallback((nodeType: WorkflowGraphNode['type']) => {
    if (nodeType === 'router') {
      const nid = uuid();
      const colNodes = graphNodes.filter((n) => n.type === 'router');
      const y = NODE_V_START + colNodes.length * NODE_V_GAP;
      const gNode: WorkflowGraphNode = {
        id: nid, type: 'router', x: COL_X.router, y, name: 'New Router',
      };
      setGraphNodes((prev) => [...prev, gNode]);
      setRFNodes((prev) => [...prev, {
        id: nid, type: 'router', position: { x: COL_X.router, y },
        data: { label: 'New Router', filterSummary: '', isDefault: false },
      }]);
      setSelectedNodeId(nid);
      setSidebarMode('config');
      setDirty(true);
    } else {
      const colNodes = graphNodes.filter((n) => n.type === nodeType);
      const y = NODE_V_START + colNodes.length * NODE_V_GAP;
      const colX = nodeType === 'data_source' ? COL_X.dataSource
        : nodeType === 'pipeline' ? COL_X.pipeline : COL_X.target;
      setPickerType(nodeType);
      setPickerPosition({ x: colX, y });
      setPickerOpen(true);
    }
  }, [graphNodes, setRFNodes]);

  // --- Update node config ---
  const handleUpdateNode = useCallback((nodeId: string, updates: Partial<WorkflowGraphNode>) => {
    setGraphNodes((prev) => prev.map((n) => n.id === nodeId ? { ...n, ...updates } : n));
    // Refresh RF node data
    setRFNodes((prev) => prev.map((rf) => {
      if (rf.id !== nodeId) return rf;
      const updated = { ...graphNodeMap.get(nodeId), ...updates } as WorkflowGraphNode;
      switch (updated.type) {
        case 'data_source': {
          const ds = updated.data_source_id ? dsLookup.get(updated.data_source_id) : undefined;
          return { ...rf, data: { label: ds?.name || 'DataSource', dsType: ds?.source_type } };
        }
        case 'router':
          return {
            ...rf,
            data: {
              label: updated.name || 'Router',
              filterSummary: filterSummary(updated.file_filter),
              isDefault: !!updated.is_default,
            },
          };
        case 'pipeline': {
          const pip = updated.pipeline_id ? pipLookup.get(updated.pipeline_id) : undefined;
          return { ...rf, data: { label: pip?.name || 'Pipeline', pipelineId: updated.pipeline_id } };
        }
        case 'target': {
          const tgt = updated.target_id ? tgtLookup.get(updated.target_id) : undefined;
          return { ...rf, data: { label: tgt?.name || 'Target', targetType: tgt?.target_type } };
        }
        default: return rf;
      }
    }));
    setDirty(true);
  }, [graphNodeMap, dsLookup, pipLookup, tgtLookup, setRFNodes]);

  // --- Save ---
  const handleSave = useCallback(async () => {
    if (!workflow) return;
    setSaving(true);
    try {
      const currentGraphNodes = fromRFNodes(rfNodes, graphNodeMap);
      const currentGraphEdges = fromRFEdges(rfEdges);
      const derived = graphToRoutes(currentGraphNodes, currentGraphEdges);

      await workflowsApi.update(workflow.id, {
        graph_data: { nodes: currentGraphNodes, edges: currentGraphEdges },
        data_source_ids: derived.data_source_ids,
        routes: derived.routes as never,
        default_route: derived.default_route as never,
      });
      setDirty(false);
      message.success('Workflow saved');
    } catch {
      message.error('Failed to save workflow');
    } finally {
      setSaving(false);
    }
  }, [workflow, rfNodes, rfEdges, graphNodeMap]);

  // --- Agent toggle ---
  const handleToggleAgent = useCallback(() => {
    setShowAgent((prev) => {
      const next = !prev;
      if (next) {
        setSidebarMode('agent');
        if (sidebarCollapsed) setSidebarCollapsed(false);
      } else {
        setSidebarMode(selectedNodeId ? 'config' : 'add');
      }
      return next;
    });
  }, [sidebarCollapsed, selectedNodeId]);

  // --- Render ---
  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!workflow) {
    return <Empty description="Workflow not found" />;
  }

  const selectedGraphNode = selectedNodeId ? graphNodeMap.get(selectedNodeId) : undefined;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Top bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '8px 16px',
        borderBottom: `1px solid ${token.colorBorderSecondary}`,
        background: token.colorBgContainer,
      }}>
        <Button
          icon={<ArrowLeftOutlined />}
          type="text"
          onClick={() => navigate('/workflows')}
        />
        <Title level={5} style={{ margin: 0, flex: 1 }}>
          {workflow.name}
        </Title>
        <Tag color={
          workflow.status === 'active' ? 'success'
            : workflow.status === 'archived' ? 'default' : 'processing'
        }>
          {workflow.status}
        </Tag>
        <Button
          icon={<RobotOutlined />}
          type={showAgent ? 'primary' : 'default'}
          onClick={handleToggleAgent}
        >
          Agent
        </Button>
        <Button
          type="primary"
          icon={<SaveOutlined />}
          loading={saving}
          disabled={!dirty}
          onClick={handleSave}
        >
          Save
        </Button>
      </div>

      {/* Main area: canvas + sidebar */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Canvas */}
        <div style={{ flex: 1 }}>
          <ReactFlow
            nodes={rfNodes}
            edges={rfEdges}
            onNodesChange={handleNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={handleConnect}
            isValidConnection={isValidConnection}
            onNodeClick={handleNodeClick}
            onPaneClick={handlePaneClick}
            onEdgesDelete={handleEdgesDelete}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            nodeTypes={nodeTypes}
            fitView
            deleteKeyCode="Delete"
            style={{ background: token.colorBgLayout }}
          >
            <Background />
            <Controls />
            <MiniMap
              nodeColor={(n) => {
                switch (n.type) {
                  case 'data_source': return '#1677ff';
                  case 'router': return '#52c41a';
                  case 'pipeline': return '#722ed1';
                  case 'target': return '#fa8c16';
                  default: return '#999';
                }
              }}
            />
          </ReactFlow>
        </div>

        {/* Right sidebar */}
        <div style={{
          width: sidebarCollapsed ? 40 : 380,
          minWidth: sidebarCollapsed ? 40 : 380,
          flexShrink: 0,
          borderLeft: `1px solid ${token.colorBorderSecondary}`,
          background: token.colorBgLayout,
          display: 'flex', flexDirection: 'column',
          transition: 'width 0.2s, min-width 0.2s',
        }}>
          {/* Collapse toggle */}
          <div
            onClick={() => setSidebarCollapsed((prev) => !prev)}
            style={{
              height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer',
              borderBottom: `1px solid ${token.colorBorderSecondary}`,
              background: token.colorBgContainer,
              color: token.colorTextSecondary, fontSize: 18,
              flexShrink: 0,
            }}
          >
            {sidebarCollapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
          </div>

          {!sidebarCollapsed && (
            sidebarMode === 'agent' && showAgent ? (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                <Collapse
                  size="small"
                  activeKey={['agent']}
                  onChange={(keys) => {
                    const arr = Array.isArray(keys) ? keys : keys ? [keys] : [];
                    if (!arr.includes('agent')) handleToggleAgent();
                  }}
                  destroyOnHidden={false}
                  style={{ flex: 1, display: 'flex', flexDirection: 'column' }}
                  items={[{
                    key: 'agent',
                    label: 'Agent Assistant',
                    children: (
                      <div style={{ height: 'calc(100vh - 260px)', overflow: 'hidden' }}>
                        <AgentSelector
                          compact
                          agents={agentList}
                          selectedAgent={selectedAgentName}
                          selectedMode={selectedAgentMode}
                          onAgentChange={setSelectedAgentName}
                          onModeChange={setSelectedAgentMode}
                        />
                        <AgentChatWidget
                          embedded
                          agents={agentList}
                          agentName={selectedAgentName}
                          agentMode={selectedAgentMode}
                          onModeChange={setSelectedAgentMode}
                          autoContext={{
                            type: 'pipeline',
                            data: {
                              name: workflow.name,
                              nodes: graphNodes,
                            },
                          }}
                        />
                      </div>
                    ),
                  }]}
                />
              </div>
            ) : sidebarMode === 'config' && selectedGraphNode ? (
              <div style={{ flex: 1, overflow: 'auto', padding: 12 }}>
                <NodeConfigPanel
                  node={selectedGraphNode}
                  dsList={dsList}
                  pipList={pipList}
                  tgtList={tgtList}
                  onUpdate={(updates) => handleUpdateNode(selectedGraphNode.id, updates)}
                  onDelete={() => handleDeleteNode(selectedGraphNode.id)}
                />
              </div>
            ) : (
              <div style={{ flex: 1, overflow: 'auto', padding: 12 }}>
                <AddNodePanel
                  onDragStart={(type) => (e: React.DragEvent) => {
                    e.dataTransfer.setData('application/workflow-node-type', type);
                    e.dataTransfer.effectAllowed = 'move';
                  }}
                  onClickAdd={handleClickAdd}
                />
              </div>
            )
          )}
        </div>
      </div>

      {/* Resource picker modal */}
      <ResourcePickerModal
        open={pickerOpen}
        type={pickerType}
        dsList={dsList}
        pipList={pipList}
        tgtList={tgtList}
        onSelect={handlePickerSelect}
        onCancel={() => { setPickerOpen(false); setPickerPosition(null); }}
      />
    </div>
  );
}

// ====================================================================
// Sub-components
// ====================================================================

function AddNodePanel({ onDragStart, onClickAdd }: {
  onDragStart: (type: WorkflowGraphNode['type']) => (e: React.DragEvent) => void;
  onClickAdd: (type: WorkflowGraphNode['type']) => void;
}) {
  const items: Array<{
    type: WorkflowGraphNode['type']; label: string; color: string; icon: React.ReactNode;
  }> = [
    { type: 'data_source', label: 'DataSource', color: '#1677ff', icon: <DatabaseOutlined /> },
    { type: 'router', label: 'Router', color: '#52c41a', icon: <ForkOutlined /> },
    { type: 'pipeline', label: 'Pipeline', color: '#722ed1', icon: <EditOutlined /> },
    { type: 'target', label: 'Target', color: '#fa8c16', icon: <SendOutlined /> },
  ];

  return (
    <>
      <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 8, letterSpacing: 1 }}>
        ADD NODES
      </Text>
      <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 12 }}>
        Drag to canvas or click + to add
      </Text>
      {items.map((item) => (
        <Card
          key={item.type}
          size="small"
          style={{ marginBottom: 8, cursor: 'grab', borderLeft: `3px solid ${item.color}` }}
          draggable
          onDragStart={onDragStart(item.type)}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Space size={6}>
              <span style={{ color: item.color, fontSize: 16 }}>{item.icon}</span>
              <Text strong style={{ fontSize: 13 }}>{item.label}</Text>
            </Space>
            <Button
              type="text"
              size="small"
              icon={<PlusOutlined />}
              onClick={() => onClickAdd(item.type)}
            />
          </div>
        </Card>
      ))}
    </>
  );
}

function NodeConfigPanel({ node, dsList, pipList, tgtList, onUpdate, onDelete }: {
  node: WorkflowGraphNode;
  dsList: DataSource[];
  pipList: Pipeline[];
  tgtList: Target[];
  onUpdate: (updates: Partial<WorkflowGraphNode>) => void;
  onDelete: () => void;
}) {
  const typeLabels: Record<string, string> = {
    data_source: 'DataSource', router: 'Router', pipeline: 'Pipeline', target: 'Target',
  };
  const typeColors: Record<string, string> = {
    data_source: '#1677ff', router: '#52c41a', pipeline: '#722ed1', target: '#fa8c16',
  };

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <Tag color={typeColors[node.type]}>{typeLabels[node.type]}</Tag>
        <Button danger size="small" icon={<DeleteOutlined />} onClick={onDelete}>
          Delete
        </Button>
      </div>

      {node.type === 'data_source' && (
        <>
          <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 4 }}>Data Source</Text>
          <Select
            value={node.data_source_id}
            onChange={(val) => onUpdate({ data_source_id: val })}
            style={{ width: '100%', marginBottom: 12 }}
            placeholder="Select data source"
            options={dsList.map((ds) => ({ value: ds.id, label: ds.name }))}
          />
        </>
      )}

      {node.type === 'router' && (
        <>
          <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 4 }}>Name</Text>
          <Input
            value={node.name || ''}
            onChange={(e) => onUpdate({ name: e.target.value })}
            style={{ marginBottom: 12 }}
            placeholder="Route name"
          />
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={!!node.is_default}
                onChange={(e) => onUpdate({ is_default: e.target.checked })}
              />
              <Text style={{ fontSize: 12 }}>Default Route (catch-all)</Text>
            </label>
          </div>
          {!node.is_default && (
            <>
              <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 4 }}>Priority</Text>
              <Input
                type="number"
                value={node.priority ?? 0}
                onChange={(e) => onUpdate({ priority: parseInt(e.target.value) || 0 })}
                style={{ marginBottom: 12 }}
              />
              <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 4 }}>
                File Extensions (comma-separated)
              </Text>
              <Input
                value={(node.file_filter?.extensions || []).join(', ')}
                onChange={(e) => {
                  const exts = e.target.value.split(',').map((s) => s.trim()).filter(Boolean);
                  onUpdate({ file_filter: { ...node.file_filter, extensions: exts } });
                }}
                placeholder="pdf, docx, xlsx"
                style={{ marginBottom: 12 }}
              />
              <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 4 }}>
                MIME Types (comma-separated)
              </Text>
              <Input
                value={(node.file_filter?.mime_types || []).join(', ')}
                onChange={(e) => {
                  const mimes = e.target.value.split(',').map((s) => s.trim()).filter(Boolean);
                  onUpdate({ file_filter: { ...node.file_filter, mime_types: mimes } });
                }}
                placeholder="application/pdf"
                style={{ marginBottom: 12 }}
              />
              <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 4 }}>
                Path Pattern
              </Text>
              <Input
                value={node.file_filter?.path_pattern || ''}
                onChange={(e) => onUpdate({ file_filter: { ...node.file_filter, path_pattern: e.target.value } })}
                placeholder="training/*"
                style={{ marginBottom: 12 }}
              />
            </>
          )}
        </>
      )}

      {node.type === 'pipeline' && (
        <>
          <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 4 }}>Pipeline</Text>
          <Select
            value={node.pipeline_id}
            onChange={(val) => onUpdate({ pipeline_id: val })}
            style={{ width: '100%', marginBottom: 12 }}
            placeholder="Select pipeline"
            options={pipList.map((p) => ({ value: p.id, label: p.name }))}
          />
          {node.pipeline_id && (
            <Button
              type="link"
              size="small"
              icon={<LinkOutlined />}
              href={`/pipelines/${node.pipeline_id}`}
              target="_blank"
            >
              Open in Pipeline Editor
            </Button>
          )}
        </>
      )}

      {node.type === 'target' && (
        <>
          <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 4 }}>Target</Text>
          <Select
            value={node.target_id}
            onChange={(val) => onUpdate({ target_id: val })}
            style={{ width: '100%', marginBottom: 12 }}
            placeholder="Select target"
            options={tgtList.map((t) => ({ value: t.id, label: `${t.name} (${t.target_type})` }))}
          />
        </>
      )}
    </>
  );
}

function ResourcePickerModal({ open, type, dsList, pipList, tgtList, onSelect, onCancel }: {
  open: boolean;
  type: 'data_source' | 'pipeline' | 'target';
  dsList: DataSource[];
  pipList: Pipeline[];
  tgtList: Target[];
  onSelect: (id: string) => void;
  onCancel: () => void;
}) {
  const titles: Record<string, string> = {
    data_source: 'Select DataSource',
    pipeline: 'Select Pipeline',
    target: 'Select Target',
  };

  const items = type === 'data_source'
    ? dsList.map((d) => ({ id: d.id, label: `${d.name} (${d.source_type})` }))
    : type === 'pipeline'
      ? pipList.map((p) => ({ id: p.id, label: p.name }))
      : tgtList.map((t) => ({ id: t.id, label: `${t.name} (${t.target_type})` }));

  return (
    <Modal
      title={titles[type]}
      open={open}
      onCancel={onCancel}
      footer={null}
      width={400}
    >
      {items.length === 0 ? (
        <Empty description={`No ${type.replace('_', ' ')}s found`} />
      ) : (
        <div style={{ maxHeight: 300, overflow: 'auto' }}>
          {items.map((item) => (
            <Card
              key={item.id}
              size="small"
              hoverable
              style={{ marginBottom: 6, cursor: 'pointer' }}
              onClick={() => onSelect(item.id)}
            >
              <Text>{item.label}</Text>
            </Card>
          ))}
        </div>
      )}
    </Modal>
  );
}

// ====================================================================
// Page wrapper with ReactFlowProvider
// ====================================================================

export default function WorkflowEditor() {
  return (
    <ReactFlowProvider>
      <WorkflowEditorInner />
    </ReactFlowProvider>
  );
}
