# 技术设计：React 前端完整实现

## 1. 整体布局架构

### 1.1 页面布局

采用经典的 **Sidebar + Content Area** 布局模式：

```
+----------------------------------------------------------+
|  Logo / App Name                          User Avatar     |
+--------+-------------------------------------------------+
|        |  Breadcrumb / Page Title                        |
|  Side  |                                                 |
|  bar   |  Content Area                                   |
|        |                                                 |
|  Nav   |  (各页面主体内容)                                |
|        |                                                 |
|        |                                                 |
+--------+-------------------------------------------------+
```

### 1.2 导航结构

使用 Ant Design 的 `Layout.Sider` 实现可收缩侧边栏：

```typescript
const menuItems: MenuProps['items'] = [
  { key: '/',            icon: <DashboardOutlined />,  label: '概览' },
  { key: '/skills',      icon: <AppstoreOutlined />,   label: 'Skill 库' },
  { key: '/pipelines',   icon: <ApartmentOutlined />,  label: 'Pipeline' },
  { key: '/data-sources',icon: <DatabaseOutlined />,   label: '数据源' },
  { key: '/runs',        icon: <PlayCircleOutlined />, label: '运行监控' },
  { key: '/targets',     icon: <ExportOutlined />,     label: '输出目标' },
  { key: '/settings',    icon: <SettingOutlined />,    label: '系统设置' },
];
```

### 1.3 路由配置

基于 React Router v6 的嵌套路由：

```typescript
const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true,                    element: <Dashboard /> },
      { path: 'skills',                 element: <SkillLibrary /> },
      { path: 'pipelines/:id/edit',     element: <PipelineEditor /> },
      { path: 'data-sources',           element: <DataSourceManager /> },
      { path: 'runs',                   element: <RunMonitor /> },
      { path: 'runs/:id',               element: <RunDetail /> },
      { path: 'targets',                element: <TargetConfig /> },
      { path: 'settings',               element: <SystemSettings /> },
    ],
  },
]);
```

---

## 2. 各页面组件架构

### 2.1 Dashboard（概览页）

**路由**: `/`

**功能**: 展示系统整体状态，提供快捷入口。

**组件结构**:

```
Dashboard
├── OverviewCards              # 统计卡片行
│   ├── StatCard (Pipeline 总数)
│   ├── StatCard (Skill 总数)
│   ├── StatCard (今日运行次数)
│   └── StatCard (成功率)
├── RecentRuns                 # 最近运行列表
│   └── RunStatusTag           # 运行状态标签（带颜色）
├── QuickActions               # 快捷操作区
│   ├── CreatePipelineButton
│   ├── ImportSkillButton
│   └── UploadDataButton
└── PipelineOverviewList       # Pipeline 概览列表
    └── PipelineCard           # Pipeline 卡片（名称、状态、最后运行时间）
```

**数据获取**:

```typescript
// 使用 React Query 并行获取概览数据
const { data: stats } = useQuery({ queryKey: ['dashboard-stats'], queryFn: fetchDashboardStats });
const { data: recentRuns } = useQuery({ queryKey: ['recent-runs'], queryFn: () => fetchRuns({ limit: 5 }) });
const { data: pipelines } = useQuery({ queryKey: ['pipelines'], queryFn: fetchPipelines });
```

---

### 2.2 Skill Library（Skill 库）

**路由**: `/skills`

**功能**: Skill 的浏览、搜索、过滤、创建和编辑。

**组件结构**:

```
SkillLibrary
├── SkillToolbar                # 顶部工具栏
│   ├── SearchInput             # 搜索框（按名称/描述搜索）
│   ├── TypeFilter              # 类型过滤（Select: document_parser, embedding, indexer 等）
│   ├── BuiltinFilter           # 内置/自定义过滤（Radio: 全部/内置/自定义）
│   ├── ViewToggle              # 视图切换（Grid / List）
│   └── CreateSkillButton       # 新建 Skill 按钮
├── SkillGridView               # 网格视图
│   └── SkillCard               # Skill 卡片
│       ├── SkillIcon           # 类型图标
│       ├── SkillName           # 名称
│       ├── SkillDescription    # 描述（截断显示）
│       ├── SkillTypeBadge      # 类型标签
│       └── CardActions         # 操作按钮（编辑、复制、删除）
├── SkillListView               # 列表视图
│   └── SkillTable              # Ant Design Table 组件
│       └── ActionColumn        # 操作列
├── Pagination                  # 分页控件
└── SkillFormModal              # 创建/编辑 Modal
    ├── BasicInfoForm           # 基本信息（名称、描述、类型）
    ├── ConfigSchemaEditor      # 配置 Schema 编辑器（JSON Editor）
    └── PreviewPanel            # 配置预览
```

**交互细节**:

- 搜索支持 300ms debounce，避免频繁请求
- Grid 视图每行显示 3-4 张卡片，响应式自适应
- 内置 Skill 禁止编辑和删除，仅允许复制
- 创建/编辑使用 Modal 弹窗，表单验证后提交

---

### 2.3 Pipeline Editor（Pipeline 编辑器）

**路由**: `/pipelines/:id/edit`

**功能**: 核心画布页面，拖拽编排 Skill 组成 Pipeline。

**组件结构**:

```
PipelineEditor
├── EditorToolbar               # 顶部工具栏
│   ├── PipelineNameInput       # Pipeline 名称（可编辑）
│   ├── SaveButton              # 保存按钮
│   ├── UndoRedoButtons         # 撤销/重做
│   ├── ZoomControls            # 缩放控制
│   ├── AutoLayoutButton        # 自动布局
│   ├── ValidateButton          # 验证 Pipeline
│   └── RunButton               # 执行 Pipeline
├── EditorBody                  # 编辑器主体（三栏布局）
│   ├── NodePalette             # 左侧节点面板（可拖拽的 Skill 列表）
│   │   ├── PaletteSearch       # 搜索过滤
│   │   ├── CategoryGroup       # 按类型分组
│   │   │   └── DraggableNode   # 可拖拽节点
│   │   └── DataSourceNode      # 数据源节点
│   ├── FlowCanvas              # 中间画布区域（React Flow）
│   │   ├── SkillNode           # 自定义 Skill 节点
│   │   │   ├── NodeHeader      # 节点头部（图标、名称、状态指示器）
│   │   │   ├── InputHandles    # 输入连接点
│   │   │   ├── OutputHandles   # 输出连接点
│   │   │   └── NodeBadge       # 配置状态徽标（已配置/未配置/错误）
│   │   ├── DataSourceNode      # 数据源节点（特殊样式）
│   │   ├── TargetNode          # 目标节点（特殊样式）
│   │   ├── CustomEdge          # 自定义连接线（带动画和删除按钮）
│   │   ├── MiniMap             # 小地图
│   │   └── Background          # 背景网格
│   └── PropertyPanel           # 右侧属性面板
│       ├── NodeProperties      # 节点属性配置
│       │   ├── BasicConfig     # 基本配置（名称、描述）
│       │   └── SkillConfig     # Skill 参数配置（动态表单，基于 config_schema 生成）
│       ├── EdgeProperties      # 边属性（数据映射）
│       └── PipelineProperties  # Pipeline 全局属性
└── ValidationPanel             # 底部验证面板（可折叠）
    ├── ValidationSummary       # 验证摘要（错误数、警告数）
    └── ValidationList          # 验证详情列表
        └── ValidationItem      # 单条验证信息（点击可定位到对应节点）
```

**React Flow 自定义节点**:

```typescript
// 自定义 Skill 节点组件
const SkillNodeComponent: React.FC<NodeProps<SkillNodeData>> = ({ data, selected }) => {
  return (
    <div className={`skill-node ${selected ? 'selected' : ''} ${data.status}`}>
      <Handle type="target" position={Position.Left} />
      <div className="node-header">
        <SkillIcon type={data.skillType} />
        <span className="node-name">{data.label}</span>
        <ConfigBadge configured={data.isConfigured} />
      </div>
      <div className="node-body">
        <span className="node-type">{data.skillType}</span>
      </div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
};

// 自定义节点类型注册
const nodeTypes = {
  skillNode: SkillNodeComponent,
  dataSourceNode: DataSourceNodeComponent,
  targetNode: TargetNodeComponent,
};
```

**拖拽添加节点**:

```typescript
// NodePalette 拖拽开始
const onDragStart = (event: DragEvent, skill: Skill) => {
  event.dataTransfer.setData('application/json', JSON.stringify(skill));
  event.dataTransfer.effectAllowed = 'move';
};

// FlowCanvas 拖拽放置
const onDrop = useCallback((event: DragEvent) => {
  const skillData = JSON.parse(event.dataTransfer.getData('application/json'));
  const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
  const newNode: Node<SkillNodeData> = {
    id: `skill-${Date.now()}`,
    type: 'skillNode',
    position,
    data: { label: skillData.name, skillType: skillData.skill_type, config: {}, isConfigured: false },
  };
  setNodes((nds) => [...nds, newNode]);
}, [screenToFlowPosition]);
```

**Pipeline 验证规则**:

| 规则 | 级别 | 说明 |
|------|------|------|
| 需要至少一个数据源节点 | Error | Pipeline 必须有数据输入 |
| 需要至少一个目标节点 | Error | Pipeline 必须有数据输出 |
| 所有 Skill 节点需要连接 | Warning | 孤立节点不会被执行 |
| 不允许循环依赖 | Error | 有向无环图（DAG）约束 |
| Skill 配置必须完整 | Error | 必填参数不能为空 |
| 数据类型需要兼容 | Warning | 上游输出类型与下游输入类型应匹配 |

---

### 2.4 DataSource Manager（数据源管理）

**路由**: `/data-sources`

**功能**: 数据源的上传、配置和管理。

**组件结构**:

```
DataSourceManager
├── DataSourceToolbar           # 工具栏
│   ├── TypeTabs                # 类型标签页（本地文件 / Azure Blob / 数据库 / API）
│   └── RefreshButton           # 刷新按钮
├── UploadArea                  # 文件上传区域（Ant Design Upload.Dragger）
│   ├── DragDropZone            # 拖拽上传区域
│   ├── FileTypeHint            # 支持的文件类型提示（PDF, DOCX, TXT, CSV, JSON）
│   └── UploadProgress          # 上传进度列表
├── FileList                    # 已上传文件列表
│   └── FileTable               # 文件表格
│       ├── FileName            # 文件名
│       ├── FileSize            # 文件大小
│       ├── FileType            # 文件类型
│       ├── UploadTime          # 上传时间
│       ├── StatusTag           # 状态标签（已上传/处理中/已处理/错误）
│       └── ActionColumn        # 操作（预览、下载、删除）
├── AzureBlobConfigForm         # Azure Blob Storage 配置表单
│   ├── ConnectionStringInput   # 连接字符串（密码输入框）
│   ├── ContainerNameInput      # 容器名称
│   ├── PrefixInput             # Blob 前缀（可选）
│   ├── TestConnectionButton    # 测试连接按钮
│   └── BlobBrowser             # Blob 浏览器（测试通过后展示文件列表）
├── DatabaseConfigForm          # 数据库配置表单
│   ├── DbTypeSelect            # 数据库类型（PostgreSQL, MySQL, SQL Server）
│   ├── ConnectionFields        # 连接字段（host, port, database, user, password）
│   ├── QueryInput              # SQL 查询语句
│   └── TestConnectionButton    # 测试连接
└── ApiConfigForm               # API 数据源配置
    ├── EndpointInput           # API 端点 URL
    ├── MethodSelect            # HTTP 方法
    ├── HeadersEditor           # 请求头编辑器（Key-Value 对）
    └── TestButton              # 测试请求
```

---

### 2.5 Run Monitor（运行监控）

**路由**: `/runs` 和 `/runs/:id`

**功能**: Pipeline 运行状态监控、日志查看和指标展示。

**组件结构**:

```
RunMonitor
├── RunFilters                  # 过滤条件
│   ├── PipelineSelect          # Pipeline 过滤
│   ├── StatusFilter            # 状态过滤（全部/运行中/成功/失败）
│   ├── DateRangePicker         # 时间范围
│   └── RefreshToggle           # 自动刷新开关（5s / 10s / 30s / 关闭）
├── RunList                     # 运行列表
│   └── RunTable                # 运行表格
│       ├── PipelineName        # Pipeline 名称
│       ├── RunStatusTag        # 状态标签（带颜色和动画）
│       ├── StartTime           # 开始时间
│       ├── Duration            # 耗时
│       ├── ProcessedCount      # 处理数据条数
│       └── ActionColumn        # 操作（查看详情、重新运行、取消）
└── RunDetail                   # 运行详情页（/runs/:id）
    ├── RunSummary              # 运行摘要卡片
    │   ├── StatusBadge         # 运行状态
    │   ├── TimeInfo            # 时间信息（开始、结束、耗时）
    │   └── MetricsCards        # 指标卡片（处理条数、成功率、吞吐量）
    ├── ProgressView            # 进度视图
    │   └── StepProgress        # 步骤进度条（每个 Skill 节点一个步骤）
    │       ├── StepIcon        # 步骤图标（待执行/执行中/成功/失败）
    │       ├── StepName        # 步骤名称
    │       └── StepDuration    # 步骤耗时
    ├── StepInspector           # 步骤检查器
    │   ├── InputPreview        # 输入数据预览
    │   ├── OutputPreview       # 输出数据预览
    │   └── StepConfig          # 步骤配置快照
    └── LogViewer               # 日志查看器
        ├── LogLevelFilter      # 日志级别过滤（DEBUG/INFO/WARN/ERROR）
        ├── LogSearch           # 日志搜索
        └── LogStream           # 日志流（虚拟滚动，支持大量日志）
```

**自动刷新机制**:

```typescript
// 运行中的任务自动轮询
const { data: run } = useQuery({
  queryKey: ['run', runId],
  queryFn: () => fetchRun(runId),
  refetchInterval: (data) => {
    // 运行中时每 3 秒刷新，完成后停止
    return data?.status === 'running' ? 3000 : false;
  },
});
```

---

### 2.6 Target Config（输出目标配置）

**路由**: `/targets`

**功能**: Pipeline 输出目标的连接配置和字段映射。

**组件结构**:

```
TargetConfig
├── TargetList                  # 目标列表
│   └── TargetCard              # 目标卡片
│       ├── TargetIcon          # 类型图标（知识库/向量库/数据库）
│       ├── TargetName          # 名称
│       ├── TargetType          # 类型标签
│       ├── ConnectionStatus    # 连接状态（绿色/红色指示灯）
│       └── CardActions         # 操作按钮
├── CreateTargetButton          # 新建目标
├── TargetFormDrawer            # 配置抽屉（Drawer）
│   ├── TargetTypeSelect        # 目标类型选择
│   ├── ConnectionForm          # 连接配置表单
│   │   ├── KnowledgeBaseForm   # RAGFlow 知识库配置
│   │   │   ├── ApiEndpoint     # RAGFlow API 地址
│   │   │   ├── ApiKey          # API Key（密码输入）
│   │   │   └── KbSelect        # 知识库选择（下拉，联动 API 获取列表）
│   │   ├── VectorStoreForm     # 向量数据库配置
│   │   │   ├── StoreType       # 类型（Milvus / Qdrant / Weaviate）
│   │   │   ├── HostPort        # 地址和端口
│   │   │   ├── CollectionName  # 集合名称
│   │   │   └── Credentials     # 认证信息
│   │   └── DatabaseForm        # 关系型数据库配置
│   │       ├── DbType          # 数据库类型
│   │       ├── ConnectionFields# 连接字段
│   │       └── TableName       # 目标表名
│   ├── TestConnectionButton    # 测试连接按钮
│   │   └── ConnectionResult    # 测试结果（成功/失败 + 详情）
│   └── FieldMappingUI          # 字段映射界面
│       ├── SourceFieldList     # 源字段列表（从 Pipeline 上游推断）
│       ├── TargetFieldList     # 目标字段列表（从目标 Schema 获取）
│       ├── MappingLines        # 映射连线
│       └── MappingTable        # 映射表格（源字段 -> 目标字段 -> 转换规则）
└── TestConnectionButton        # 测试连接
```

---

### 2.7 System Settings（系统设置）

**路由**: `/settings`

**功能**: 系统配置查看、存储统计和数据清理。

**组件结构**:

```
SystemSettings
├── SettingsTabs                # 设置标签页
├── ConfigView                  # 配置信息
│   ├── AppInfoSection          # 应用信息（版本、运行环境）
│   ├── BackendConfigSection    # 后端配置（只读，从 API 获取）
│   │   ├── DatabaseInfo        # 数据库类型和连接状态
│   │   ├── StoragePath         # 文件存储路径
│   │   └── ApiVersion          # API 版本
│   └── FrontendConfigSection   # 前端配置
│       ├── ThemeSwitch         # 主题切换（亮色/暗色）
│       ├── LanguageSelect      # 语言选择（预留，当前仅中文）
│       └── PageSizeConfig      # 默认分页大小
├── StorageStats                # 存储统计
│   ├── StorageOverview         # 存储概览（饼图 / 进度条）
│   │   ├── TotalUsage          # 总使用量
│   │   ├── FileStorage         # 文件存储占用
│   │   ├── DatabaseSize        # 数据库大小
│   │   └── LogSize             # 日志占用
│   ├── DataBreakdown           # 数据明细
│   │   ├── PipelineCount       # Pipeline 数量
│   │   ├── SkillCount          # Skill 数量
│   │   ├── RunCount            # 运行记录数量
│   │   └── FileCount           # 文件数量
│   └── GrowthTrend             # 增长趋势图（近 30 天）
└── CleanupControls             # 数据清理
    ├── RunHistoryCleanup       # 运行记录清理
    │   ├── RetentionPeriod     # 保留天数设置
    │   └── CleanupButton       # 清理按钮（带确认弹窗）
    ├── FileCleanup             # 孤立文件清理
    │   ├── OrphanFileList      # 孤立文件列表
    │   └── CleanupButton       # 清理按钮
    └── LogCleanup              # 日志清理
        ├── LogRetention        # 日志保留策略
        └── CleanupButton       # 清理按钮
```

---

## 3. 状态管理

### 3.1 Zustand Store 设计

采用 **模块化 Store** 模式，每个业务领域一个 Store：

```typescript
// stores/pipelineEditorStore.ts -- Pipeline 编辑器状态
interface PipelineEditorState {
  // 画布状态
  nodes: Node[];
  edges: Edge[];
  selectedNodeId: string | null;
  selectedEdgeId: string | null;

  // 操作历史（撤销/重做）
  history: { nodes: Node[]; edges: Edge[] }[];
  historyIndex: number;

  // 验证状态
  validationErrors: ValidationError[];

  // Actions
  setNodes: (nodes: Node[]) => void;
  setEdges: (edges: Edge[]) => void;
  addNode: (node: Node) => void;
  removeNode: (nodeId: string) => void;
  updateNodeConfig: (nodeId: string, config: Record<string, unknown>) => void;
  selectNode: (nodeId: string | null) => void;
  undo: () => void;
  redo: () => void;
  validate: () => ValidationError[];
  saveToServer: () => Promise<void>;
}

export const usePipelineEditorStore = create<PipelineEditorState>()(
  devtools(
    immer((set, get) => ({
      nodes: [],
      edges: [],
      selectedNodeId: null,
      // ... 实现
    }))
  )
);
```

```typescript
// stores/skillStore.ts -- Skill 库状态
interface SkillStoreState {
  searchQuery: string;
  typeFilter: string | null;
  builtinFilter: 'all' | 'builtin' | 'custom';
  viewMode: 'grid' | 'list';
  currentPage: number;
  pageSize: number;

  setSearchQuery: (query: string) => void;
  setTypeFilter: (type: string | null) => void;
  setBuiltinFilter: (filter: 'all' | 'builtin' | 'custom') => void;
  setViewMode: (mode: 'grid' | 'list') => void;
}
```

```typescript
// stores/uiStore.ts -- 全局 UI 状态
interface UIStoreState {
  sidebarCollapsed: boolean;
  theme: 'light' | 'dark';
  toggleSidebar: () => void;
  setTheme: (theme: 'light' | 'dark') => void;
}
```

### 3.2 Store 职责划分

| Store | 职责 | 持久化 |
|-------|------|--------|
| `uiStore` | 侧边栏状态、主题、全局 UI 配置 | localStorage |
| `pipelineEditorStore` | 画布节点/边、选中状态、操作历史 | 不持久化（从 API 加载） |
| `skillStore` | Skill 列表的搜索、过滤、视图模式 | 不持久化 |
| `runMonitorStore` | 运行列表过滤条件、自动刷新设置 | 不持久化 |

---

## 4. API 集成层

### 4.1 Axios 客户端配置

```typescript
// services/apiClient.ts
import axios from 'axios';
import { message } from 'antd';

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api/v1',
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

// 请求拦截器
apiClient.interceptors.request.use((config) => {
  // 可在此添加认证 token（预留）
  return config;
});

// 响应拦截器
apiClient.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const errorMsg = error.response?.data?.message || '网络请求失败';
    const errorCode = error.response?.data?.code;

    if (error.response?.status === 404) {
      message.error('资源不存在');
    } else if (error.response?.status >= 500) {
      message.error('服务器内部错误，请稍后重试');
    } else {
      message.error(errorMsg);
    }

    return Promise.reject({ code: errorCode, message: errorMsg });
  }
);

export default apiClient;
```

### 4.2 React Query 集成

使用 TanStack Query 管理服务端状态、缓存和请求去重：

```typescript
// services/skillService.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from './apiClient';

// 查询 Hooks
export const useSkills = (params: SkillQueryParams) => {
  return useQuery({
    queryKey: ['skills', params],
    queryFn: () => apiClient.get('/skills', { params }),
    staleTime: 30 * 1000,  // 30 秒内不重新请求
  });
};

export const useSkill = (id: string) => {
  return useQuery({
    queryKey: ['skills', id],
    queryFn: () => apiClient.get(`/skills/${id}`),
    enabled: !!id,
  });
};

// 变更 Hooks
export const useCreateSkill = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateSkillRequest) => apiClient.post('/skills', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['skills'] });
      message.success('Skill 创建成功');
    },
  });
};

export const useUpdateSkill = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateSkillRequest }) =>
      apiClient.put(`/skills/${id}`, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['skills'] });
      queryClient.invalidateQueries({ queryKey: ['skills', id] });
      message.success('Skill 更新成功');
    },
  });
};

export const useDeleteSkill = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.delete(`/skills/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['skills'] });
      message.success('Skill 已删除');
    },
  });
};
```

### 4.3 API Service 总览

| Service 文件 | 覆盖 API | 提供的 Hooks |
|-------------|----------|-------------|
| `skillService.ts` | `/skills` | `useSkills`, `useSkill`, `useCreateSkill`, `useUpdateSkill`, `useDeleteSkill` |
| `pipelineService.ts` | `/pipelines` | `usePipelines`, `usePipeline`, `useCreatePipeline`, `useUpdatePipeline`, `useDeletePipeline`, `useRunPipeline` |
| `dataSourceService.ts` | `/data-sources` | `useDataSources`, `useCreateDataSource`, `useUploadFile`, `useDeleteDataSource`, `useTestConnection` |
| `targetService.ts` | `/targets` | `useTargets`, `useTarget`, `useCreateTarget`, `useUpdateTarget`, `useDeleteTarget`, `useTestTargetConnection` |
| `runService.ts` | `/runs` | `useRuns`, `useRun`, `useRunLogs`, `useCancelRun` |
| `systemService.ts` | `/system` | `useSystemConfig`, `useStorageStats`, `useCleanup` |

---

## 5. 目录结构

```
frontend/src/
├── main.tsx                       # 应用入口
├── App.tsx                        # 根组件（Provider 包装）
├── router.tsx                     # 路由配置
├── components/                    # 通用组件
│   ├── layout/
│   │   ├── AppLayout.tsx          # 主布局（Sidebar + Content）
│   │   ├── Sidebar.tsx            # 侧边栏导航
│   │   └── PageHeader.tsx         # 页面头部（面包屑 + 标题）
│   ├── common/
│   │   ├── StatusTag.tsx          # 状态标签（通用）
│   │   ├── ConfirmModal.tsx       # 确认弹窗
│   │   ├── EmptyState.tsx         # 空状态占位
│   │   ├── LoadingSpinner.tsx     # 加载状态
│   │   └── ErrorBoundary.tsx      # 错误边界
│   └── pipeline/
│       ├── nodes/
│       │   ├── SkillNode.tsx      # Skill 节点组件
│       │   ├── DataSourceNode.tsx # 数据源节点
│       │   └── TargetNode.tsx     # 目标节点
│       ├── edges/
│       │   └── CustomEdge.tsx     # 自定义连接线
│       ├── NodePalette.tsx        # 节点面板
│       ├── PropertyPanel.tsx      # 属性面板
│       └── ValidationPanel.tsx    # 验证面板
├── pages/
│   ├── Dashboard.tsx
│   ├── SkillLibrary.tsx
│   ├── PipelineEditor.tsx
│   ├── DataSourceManager.tsx
│   ├── RunMonitor.tsx
│   ├── RunDetail.tsx
│   ├── TargetConfig.tsx
│   └── SystemSettings.tsx
├── stores/
│   ├── uiStore.ts
│   ├── pipelineEditorStore.ts
│   ├── skillStore.ts
│   └── runMonitorStore.ts
├── services/
│   ├── apiClient.ts
│   ├── skillService.ts
│   ├── pipelineService.ts
│   ├── dataSourceService.ts
│   ├── targetService.ts
│   ├── runService.ts
│   └── systemService.ts
├── hooks/
│   ├── useDebounce.ts
│   ├── usePagination.ts
│   └── useAutoRefresh.ts
├── types/
│   ├── index.ts                   # 核心业务类型
│   ├── pipeline.ts                # Pipeline 编辑器相关类型
│   └── api.ts                     # API 请求/响应类型
├── utils/
│   ├── format.ts                  # 格式化工具（时间、文件大小等）
│   ├── validation.ts              # Pipeline 验证逻辑
│   └── constants.ts               # 常量定义
└── styles/
    ├── global.css                 # 全局样式
    ├── variables.css              # CSS 变量（主题色、间距等）
    └── pipeline-editor.css        # Pipeline 编辑器专用样式
```

---

## 6. 主题与响应式设计

### 6.1 Ant Design 主题定制

```typescript
// theme/themeConfig.ts
import { ThemeConfig } from 'antd';

export const lightTheme: ThemeConfig = {
  token: {
    colorPrimary: '#1677ff',
    borderRadius: 6,
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Microsoft YaHei", sans-serif',
  },
  components: {
    Layout: {
      siderBg: '#fff',
      headerBg: '#fff',
    },
    Menu: {
      itemSelectedBg: '#e6f4ff',
    },
  },
};

export const darkTheme: ThemeConfig = {
  token: {
    colorPrimary: '#1677ff',
    borderRadius: 6,
  },
  algorithm: theme.darkAlgorithm,
};
```

### 6.2 响应式策略

| 断点 | 宽度范围 | 适配策略 |
|------|---------|----------|
| `lg` | >= 1280px | 完整布局，侧边栏展开 |
| `md` | 992px - 1279px | 侧边栏收缩为图标模式 |
| `sm` | 768px - 991px | 侧边栏隐藏，顶部汉堡菜单 |

Pipeline Editor 页面要求最低宽度 1280px，窄屏时显示提示信息。

### 6.3 CSS 变量

```css
:root {
  /* 主色调 */
  --color-primary: #1677ff;
  --color-success: #52c41a;
  --color-warning: #faad14;
  --color-error: #ff4d4f;

  /* 布局 */
  --sidebar-width: 220px;
  --sidebar-collapsed-width: 64px;
  --header-height: 56px;
  --content-padding: 24px;

  /* Pipeline 编辑器 */
  --node-palette-width: 240px;
  --property-panel-width: 320px;
  --node-width: 180px;
  --node-height: 60px;
}
```

---

## 7. 关键设计决策

| 决策 | 选择 | 理由 |
|------|------|------|
| 状态管理 | Zustand + React Query | Zustand 管理客户端 UI 状态，React Query 管理服务端数据缓存，职责分明 |
| UI 组件库 | Ant Design 5 | 企业级组件丰富，中文社区活跃，表单、表格、弹窗等开箱即用 |
| 画布引擎 | React Flow | 专为 React 设计的流程图库，自定义节点、拖拽、缩放、小地图等功能完善 |
| 表单动态生成 | 基于 JSON Schema | Skill 的配置参数通过 JSON Schema 描述，前端根据 Schema 自动生成配置表单 |
| 文件上传 | Ant Design Upload + 分片上传 | 大文件支持分片上传，显示进度条 |
| 日志查看器 | 虚拟滚动 | 运行日志可能非常大，使用虚拟滚动避免 DOM 性能问题 |
| Pipeline 编辑器三栏布局 | 固定左右面板 + 中间自适应画布 | 符合 IDE 风格的交互习惯，面板可通过拖拽调整宽度 |
