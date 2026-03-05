# 实施任务清单：React 前端完整实现

## 概览

本文档列出 `react-frontend` 变更的所有实施任务。任务按页面/模块分组，标注优先级和依赖关系。

---

## 1. 基础架构与通用组件

### 1.1 项目配置升级

- [ ] 安装新增依赖：
  - `@tanstack/react-query` -- 服务端状态管理
  - `zustand` -- 客户端状态管理
  - `immer` -- 不可变状态更新辅助
  - `dayjs` -- 日期格式化
- [ ] 配置 React Query Provider（`QueryClientProvider`），设置全局默认参数
- [ ] 配置 Ant Design 主题（`ConfigProvider`），引入中文语言包
- [ ] 配置 React Router v6，定义完整路由表

### 1.2 布局组件

- [ ] 实现 `AppLayout` 主布局组件（Ant Design `Layout`）
- [ ] 实现 `Sidebar` 侧边栏导航组件
  - 菜单项：概览、Skill 库、Pipeline、数据源、运行监控、输出目标、系统设置
  - 支持展开/收缩
  - 当前路由高亮
- [ ] 实现 `PageHeader` 页面头部组件（面包屑 + 标题 + 操作区）
- [ ] 创建 `uiStore`（Zustand），管理侧边栏状态和主题

### 1.3 通用组件

- [ ] 实现 `StatusTag` 通用状态标签组件（支持不同状态颜色映射）
- [ ] 实现 `ConfirmModal` 确认弹窗组件（删除等危险操作）
- [ ] 实现 `EmptyState` 空状态占位组件
- [ ] 实现 `LoadingSpinner` 加载状态组件
- [ ] 实现 `ErrorBoundary` 全局错误边界组件

### 1.4 API 集成层

- [ ] 重构 `apiClient.ts`，增加请求/响应拦截器
- [ ] 实现 `skillService.ts` -- Skill CRUD 的 React Query Hooks
- [ ] 实现 `pipelineService.ts` -- Pipeline CRUD 的 React Query Hooks
- [ ] 实现 `dataSourceService.ts` -- DataSource 管理 Hooks
- [ ] 实现 `targetService.ts` -- Target 管理 Hooks
- [ ] 实现 `runService.ts` -- Run 查询和操作 Hooks
- [ ] 实现 `systemService.ts` -- 系统配置和统计 Hooks

### 1.5 工具函数与类型定义

- [ ] 扩展 `types/index.ts`，补充 DataSource、Target 的完整类型定义
- [ ] 创建 `types/pipeline.ts`，定义 Pipeline 编辑器相关类型（SkillNodeData、ValidationError 等）
- [ ] 创建 `types/api.ts`，定义 API 请求/响应类型
- [ ] 实现 `utils/format.ts` -- 格式化工具（时间格式化、文件大小可读化、耗时格式化）
- [ ] 实现 `utils/constants.ts` -- 常量定义（Skill 类型列表、状态映射、颜色映射）
- [ ] 实现 `hooks/useDebounce.ts` -- 防抖 Hook
- [ ] 实现 `hooks/usePagination.ts` -- 分页 Hook

---

## 2. Dashboard（概览页）

- [ ] 实现 `Dashboard` 页面组件
- [ ] 实现 `OverviewCards` 统计卡片行
  - Pipeline 总数、Skill 总数、今日运行次数、运行成功率
  - 使用 Ant Design `Statistic` 和 `Card` 组件
- [ ] 实现 `RecentRuns` 最近运行列表
  - 展示最近 5 条运行记录
  - 包含 Pipeline 名称、状态标签、开始时间、耗时
  - 点击跳转到运行详情
- [ ] 实现 `QuickActions` 快捷操作区
  - 创建 Pipeline、导入 Skill、上传数据 三个快捷按钮
  - 点击后跳转到对应页面或弹出 Modal
- [ ] 实现 `PipelineOverviewList` Pipeline 概览列表
  - 展示所有 Pipeline 的卡片
  - 包含名称、状态、Skill 数量、最后运行时间
  - 点击跳转到 Pipeline 编辑器
- [ ] 连接后端 API，使用 React Query 获取数据
- [ ] 处理空状态（无 Pipeline、无运行记录时的引导提示）

---

## 3. Skill Library（Skill 库）

### 3.1 页面框架

- [ ] 实现 `SkillLibrary` 页面组件
- [ ] 创建 `skillStore`（Zustand），管理搜索、过滤和视图状态

### 3.2 工具栏

- [ ] 实现 `SkillToolbar` 工具栏组件
- [ ] 实现搜索框（Input.Search），支持 300ms debounce
- [ ] 实现类型过滤下拉框（Select），选项从常量或 API 获取
- [ ] 实现内置/自定义过滤（Radio.Group: 全部 / 内置 / 自定义）
- [ ] 实现视图切换按钮（Grid / List）
- [ ] 实现「新建 Skill」按钮

### 3.3 Grid 视图

- [ ] 实现 `SkillGridView` 网格视图组件
- [ ] 实现 `SkillCard` 卡片组件
  - 类型图标、名称、描述（最多 2 行截断）、类型标签
  - 操作按钮：编辑、复制、删除（内置 Skill 禁止编辑和删除）
- [ ] 响应式布局：根据容器宽度自动调整每行卡片数量

### 3.4 List 视图

- [ ] 实现 `SkillListView` 列表视图组件
- [ ] 使用 Ant Design `Table` 组件
  - 列：名称、类型、描述、是否内置、创建时间、操作
  - 支持列排序
- [ ] 实现操作列（编辑、复制、删除）

### 3.5 创建/编辑 Modal

- [ ] 实现 `SkillFormModal` 弹窗组件
- [ ] 实现基本信息表单（名称、描述、类型选择）
  - 表单验证：名称必填、类型必选
- [ ] 实现配置 Schema 编辑器（JSON 编辑器组件）
- [ ] 实现配置预览面板
- [ ] 创建模式：提交后调用 `useCreateSkill`，成功后关闭 Modal 并刷新列表
- [ ] 编辑模式：加载现有数据填充表单，提交后调用 `useUpdateSkill`

### 3.6 分页

- [ ] 实现分页控件，与后端分页 API 对接
- [ ] 页码变化时更新 URL 查询参数（可选）

---

## 4. Pipeline Editor（Pipeline 编辑器）

### 4.1 状态管理

- [ ] 创建 `pipelineEditorStore`（Zustand + Immer）
  - 管理 nodes、edges、selectedNodeId、history、validationErrors
  - 实现 addNode、removeNode、updateNodeConfig、undo、redo 等 Actions
- [ ] 实现操作历史栈（撤销/重做），最多保留 50 步

### 4.2 编辑器框架

- [ ] 实现 `PipelineEditor` 页面组件
- [ ] 根据路由参数 `/:id` 从 API 加载 Pipeline 数据，初始化画布
- [ ] 实现三栏布局：左侧 NodePalette + 中间 FlowCanvas + 右侧 PropertyPanel
- [ ] 面板宽度可通过拖拽调整（使用 CSS resize 或 Splitter 组件）

### 4.3 编辑器工具栏

- [ ] 实现 `EditorToolbar` 工具栏组件
- [ ] Pipeline 名称可编辑输入框
- [ ] 保存按钮 -- 调用 `useUpdatePipeline` 保存 graph_data
- [ ] 撤销/重做按钮 -- 连接 Store 的 undo/redo
- [ ] 缩放控制（放大、缩小、适应屏幕）
- [ ] 自动布局按钮（使用 dagre 算法自动排列节点）
- [ ] 验证按钮 -- 触发 Pipeline 校验
- [ ] 执行按钮 -- 调用 `useRunPipeline` 启动运行

### 4.4 节点面板 (Node Palette)

- [ ] 实现 `NodePalette` 左侧面板组件
- [ ] 从 API 获取 Skill 列表，按类型分组展示
- [ ] 实现搜索过滤功能
- [ ] 实现 `DraggableNode` 可拖拽节点组件
  - 使用 HTML5 Drag and Drop API
  - 拖拽时设置 `dataTransfer` 数据
- [ ] 添加特殊节点类型：DataSource 节点、Target 节点

### 4.5 React Flow 画布

- [ ] 实现 `FlowCanvas` 画布组件，集成 React Flow
- [ ] 实现 `SkillNode` 自定义节点组件
  - 节点头部：类型图标 + 名称 + 配置状态徽标
  - 输入/输出 Handle
  - 选中/悬停样式
  - 错误/警告状态样式
- [ ] 实现 `DataSourceNode` 数据源自定义节点（绿色主题）
- [ ] 实现 `TargetNode` 目标自定义节点（橙色主题）
- [ ] 实现 `CustomEdge` 自定义连接线
  - 带动画效果（运行时）
  - 悬停显示删除按钮
- [ ] 实现拖拽放置逻辑（onDrop + onDragOver）
- [ ] 配置 React Flow：MiniMap、Background、Controls
- [ ] 实现节点删除（Delete 键 / 右键菜单）
- [ ] 实现边删除
- [ ] 实现框选多个节点

### 4.6 属性面板 (Property Panel)

- [ ] 实现 `PropertyPanel` 右侧面板组件
- [ ] 未选中节点时显示 Pipeline 全局属性（名称、描述、状态）
- [ ] 选中 Skill 节点时显示：
  - 基本配置（节点名称、描述）
  - Skill 参数配置 -- 根据 `config_schema`（JSON Schema）动态生成表单
  - 使用 Ant Design `Form` 组件，支持字符串、数字、布尔、选择、JSON 等字段类型
- [ ] 选中 DataSource 节点时显示数据源配置表单
- [ ] 选中 Target 节点时显示目标配置表单
- [ ] 选中 Edge 时显示数据映射配置
- [ ] 配置变更实时同步到 Store

### 4.7 验证面板 (Validation Panel)

- [ ] 实现 `ValidationPanel` 底部可折叠面板
- [ ] 实现 `utils/validation.ts` Pipeline 验证逻辑
  - 检查是否有数据源节点
  - 检查是否有目标节点
  - 检查孤立节点（无连接的节点）
  - 检查循环依赖（DAG 验证）
  - 检查 Skill 配置完整性
- [ ] 显示验证摘要（错误数、警告数）
- [ ] 显示验证详情列表，点击可定位到对应节点（高亮 + 居中）

---

## 5. DataSource Manager（数据源管理）

### 5.1 页面框架

- [ ] 实现 `DataSourceManager` 页面组件
- [ ] 实现类型标签页切换（本地文件 / Azure Blob / 数据库 / API）

### 5.2 文件上传

- [ ] 实现文件上传区域（Ant Design `Upload.Dragger`）
  - 支持拖拽上传和点击上传
  - 支持的文件类型：PDF, DOCX, TXT, CSV, JSON, XLSX
  - 文件大小限制提示
- [ ] 实现上传进度展示
- [ ] 实现批量上传支持

### 5.3 文件列表

- [ ] 实现已上传文件列表（Ant Design `Table`）
  - 列：文件名、文件大小、文件类型、上传时间、状态、操作
  - 状态：已上传 / 处理中 / 已处理 / 错误
- [ ] 实现文件预览功能（文本文件直接预览，其他类型显示元信息）
- [ ] 实现文件删除（带确认弹窗）
- [ ] 实现批量选择和批量删除

### 5.4 Azure Blob Storage 配置

- [ ] 实现 Azure Blob 配置表单
  - 连接字符串输入（密码类型，支持显示/隐藏切换）
  - 容器名称输入
  - Blob 前缀过滤（可选）
- [ ] 实现测试连接按钮和结果展示
- [ ] 测试通过后展示 Blob 文件浏览器

### 5.5 其他数据源类型

- [ ] 实现数据库配置表单（数据库类型选择、连接字段、SQL 查询）
- [ ] 实现 API 数据源配置表单（端点 URL、HTTP 方法、请求头编辑器）
- [ ] 各表单实现测试连接功能

---

## 6. Run Monitor（运行监控）

### 6.1 运行列表页

- [ ] 实现 `RunMonitor` 页面组件
- [ ] 创建 `runMonitorStore`（Zustand），管理过滤条件和刷新设置
- [ ] 实现过滤条件栏
  - Pipeline 选择下拉框
  - 状态过滤（全部 / 等待中 / 运行中 / 成功 / 失败）
  - 时间范围选择器（DateRangePicker）
  - 自动刷新开关和间隔设置
- [ ] 实现运行列表表格（Ant Design `Table`）
  - 列：Pipeline 名称、状态（带颜色标签和动画）、开始时间、耗时、处理条数、操作
  - 运行中状态行高亮显示
- [ ] 实现操作列：查看详情、重新运行、取消运行
- [ ] 实现分页
- [ ] 实现自动刷新逻辑（React Query `refetchInterval`）

### 6.2 运行详情页

- [ ] 实现 `RunDetail` 页面组件（路由 `/runs/:id`）
- [ ] 实现运行摘要卡片
  - 状态标签、Pipeline 名称、开始/结束时间、耗时
  - 指标卡片：处理条数、成功率、吞吐量
- [ ] 实现步骤进度视图（`StepProgress`）
  - 每个 Skill 节点对应一个步骤
  - 步骤状态：待执行 / 执行中（带 Spin 动画）/ 成功 / 失败
  - 显示每步耗时
- [ ] 实现步骤检查器（`StepInspector`）
  - 点击步骤查看：输入数据预览、输出数据预览、步骤配置快照
  - 数据以 JSON 格式展示，支持折叠/展开
- [ ] 实现日志查看器（`LogViewer`）
  - 日志级别过滤（DEBUG / INFO / WARN / ERROR）
  - 日志内容搜索
  - 虚拟滚动支持大量日志数据（使用 `react-window` 或类似方案）
  - 不同级别日志颜色高亮
- [ ] 运行中状态下自动轮询更新

---

## 7. Target Config（输出目标配置）

### 7.1 目标列表

- [ ] 实现 `TargetConfig` 页面组件
- [ ] 实现目标卡片列表（Grid 布局）
  - 类型图标（知识库 / 向量库 / 数据库）
  - 名称、类型标签
  - 连接状态指示灯（绿色已连接 / 红色断开 / 灰色未测试）
  - 操作按钮（编辑、测试连接、删除）
- [ ] 实现「新建目标」按钮

### 7.2 目标配置 Drawer

- [ ] 实现 `TargetFormDrawer` 配置抽屉组件
- [ ] 实现目标类型选择步骤
- [ ] 实现 RAGFlow 知识库配置表单
  - API 端点地址、API Key 输入
  - 知识库下拉选择（联动 API：输入地址和 Key 后获取知识库列表）
- [ ] 实现向量数据库配置表单
  - 类型选择（Milvus / Qdrant / Weaviate）
  - 连接地址和端口、集合名称、认证信息
- [ ] 实现关系型数据库配置表单
  - 数据库类型、连接字段、目标表名

### 7.3 测试连接

- [ ] 实现测试连接按钮
- [ ] 展示测试结果：成功（绿色勾）/ 失败（红色叉 + 错误详情）
- [ ] 测试通过后自动更新连接状态

### 7.4 字段映射

- [ ] 实现 `FieldMappingUI` 字段映射界面
- [ ] 展示源字段列表（从 Pipeline 上游 Skill 输出推断）
- [ ] 展示目标字段列表（从目标 Schema 获取）
- [ ] 实现映射表格（源字段 -> 目标字段 -> 转换规则）
- [ ] 支持自动映射（字段名匹配）和手动映射
- [ ] 映射验证（类型兼容性检查）

---

## 8. System Settings（系统设置）

### 8.1 配置信息

- [ ] 实现 `SystemSettings` 页面组件
- [ ] 实现设置标签页（Ant Design `Tabs`）
- [ ] 实现应用信息展示（版本号、运行环境、API 地址）
- [ ] 实现后端配置展示（只读，从 `/system/config` API 获取）
- [ ] 实现前端配置
  - 主题切换（亮色 / 暗色）-- 连接 `uiStore`
  - 默认分页大小设置
  - 语言选择（预留接口）

### 8.2 存储统计

- [ ] 实现存储概览卡片
  - 总使用量、文件存储占用、数据库大小、日志占用
  - 使用 Ant Design `Progress` 或饼图可视化
- [ ] 实现数据明细展示
  - Pipeline 数量、Skill 数量、运行记录数量、文件数量
- [ ] 实现增长趋势图（近 30 天，使用 Ant Design Charts 或简单的 SVG 折线图）

### 8.3 数据清理

- [ ] 实现运行记录清理
  - 保留天数设置输入框
  - 预计清理条数提示
  - 清理按钮（带二次确认弹窗）
- [ ] 实现孤立文件清理
  - 扫描并列出孤立文件
  - 选择性清理或全部清理
- [ ] 实现日志清理
  - 日志保留策略设置
  - 清理按钮

---

## 9. 样式与主题

- [ ] 定义 CSS 变量（`variables.css`）：主色、辅助色、间距、字体
- [ ] 实现全局样式（`global.css`）：重置样式、滚动条美化、通用类
- [ ] 实现 Pipeline 编辑器专用样式（`pipeline-editor.css`）
  - 自定义节点样式（不同类型不同颜色）
  - 连接线样式（默认和动画状态）
  - 面板拖拽分隔线样式
- [ ] 实现亮色/暗色主题切换（Ant Design `ConfigProvider` + CSS 变量切换）
- [ ] 响应式适配测试（1280px 以上正常展示，窄屏适当降级）

---

## 10. 测试

- [ ] 为 `StatusTag`、`ConfirmModal` 等通用组件编写单元测试
- [ ] 为 Pipeline 验证逻辑（`utils/validation.ts`）编写单元测试
- [ ] 为 `pipelineEditorStore` 编写状态管理测试
- [ ] 为 Skill Library 的搜索、过滤逻辑编写测试
- [ ] 为 API Service Hooks 编写集成测试（mock API 响应）
- [ ] 编写 Pipeline Editor 拖拽添加节点的交互测试
- [ ] 确保 `tsc --noEmit` 零错误
- [ ] 确保 `eslint` 零警告

---

## 任务依赖关系

```
1.1 项目配置升级
 ├── 1.2 布局组件
 │    └── 1.3 通用组件
 ├── 1.4 API 集成层
 │    └── 1.5 工具函数与类型定义
 │
 ├── 2. Dashboard（依赖 1.2 + 1.4）
 ├── 3. Skill Library（依赖 1.2 + 1.3 + 1.4）
 ├── 4. Pipeline Editor（依赖 1.2 + 1.3 + 1.4 + 3.已有 Skill 数据）
 ├── 5. DataSource Manager（依赖 1.2 + 1.3 + 1.4）
 ├── 6. Run Monitor（依赖 1.2 + 1.3 + 1.4）
 ├── 7. Target Config（依赖 1.2 + 1.3 + 1.4）
 └── 8. System Settings（依赖 1.2 + 1.4）

9. 样式与主题（与各页面并行进行）
10. 测试（各页面完成后进行）
```

## 推荐开发顺序

1. **第一阶段（基础设施）**: 1.1 -> 1.2 -> 1.3 -> 1.4 -> 1.5（约 2 天）
2. **第二阶段（核心页面）**: 2. Dashboard + 3. Skill Library（约 3 天）
3. **第三阶段（Pipeline 编辑器）**: 4. Pipeline Editor（约 4 天，最复杂的页面）
4. **第四阶段（辅助页面）**: 5. DataSource + 6. Run Monitor + 7. Target Config + 8. Settings（约 4 天）
5. **第五阶段（收尾）**: 9. 样式完善 + 10. 测试（约 2 天）

## 验收标准

1. 所有 7 个页面可正常访问，路由切换流畅
2. Sidebar 导航正常工作，当前页面高亮
3. Pipeline Editor 可拖拽添加 Skill 节点并连线
4. Pipeline Editor 可保存和加载画布数据
5. Skill Library 支持搜索、过滤和 Grid/List 视图切换
6. DataSource Manager 支持文件上传和 Azure Blob 配置
7. Run Monitor 展示运行列表和详情，支持自动刷新
8. Target Config 支持多种目标类型配置和测试连接
9. System Settings 展示系统信息和存储统计
10. `tsc --noEmit` 零错误，`eslint` 零警告
11. 核心组件有单元测试覆盖
