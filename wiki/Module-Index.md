# Module Index

22 个 OpenSpec 模块规格的索引。每个模块的完整规格见对应的 `spec.md` 文件。

## Backend Modules (12)

| 模块 | 说明 | Spec 链接 |
|------|------|-----------|
| **skills** | Skill 管理 — Pipeline 最小处理单元，支持内置 Skill 和三种自定义 Skill（Web API / 配置模板 / Python 代码） | [spec.md](../blob/main/openspec/specs/skills/spec.md) |
| **connections** | 外部服务认证凭据管理，供 Skill 执行时获取已认证 SDK 客户端，敏感配置加密存储并自动脱敏 | [spec.md](../blob/main/openspec/specs/connections/spec.md) |
| **pipelines** | Pipeline 编排容器，定义数据从输入到输出的完整处理流程，支持 Debug 模式和验证端点 | [spec.md](../blob/main/openspec/specs/pipelines/spec.md) |
| **pipeline-orchestration** | Pipeline 执行引擎，包括 Enrichment Tree 数据结构、Runner、Debug API、I/O 默认值和模板 | [spec.md](../blob/main/openspec/specs/pipeline-orchestration/spec.md) |
| **datasources** | 数据源管理，对齐 Azure AI Search 体验，支持 16 种数据源类型（Local / Azure / AWS 等） | [spec.md](../blob/main/openspec/specs/datasources/spec.md) |
| **runs** | Pipeline 执行记录管理，Phase 1 CRUD，Phase 2 完整执行引擎和步骤可观测性 | [spec.md](../blob/main/openspec/specs/runs/spec.md) |
| **targets** | 输出目标管理，支持 6 种目标类型，提供连通性测试、Schema 发现和字段映射引擎 | [spec.md](../blob/main/openspec/specs/targets/spec.md) |
| **agents** | CLI Coding Agent 集成 — 发现注册、Session 管理、WebSocket 实时聊天、配置读取 | [spec.md](../blob/main/openspec/specs/agents/spec.md) |
| **workflows** | DataSource → Pipeline → Target 编排层，路由规则将文件按类型路由到不同 Pipeline，支持增量处理 | [spec.md](../blob/main/openspec/specs/workflows/spec.md) |
| **executable-builtin-skills** | 使所有内置 Skill 可执行，支持 Azure 资源绑定、配置、在线测试和 Pipeline 就绪执行 | [spec.md](../blob/main/openspec/specs/executable-builtin-skills/spec.md) |
| **system** | 系统全局功能 — 健康检查、配置管理、API 通用规范、数据库初始化（MVP 单用户无认证） | [spec.md](../blob/main/openspec/specs/system/spec.md) |
| **dashboard** | 系统全局统计概览 — 资源总数、Workflow 执行状态分布、最近活动和成功率 | [spec.md](../blob/main/openspec/specs/dashboard/spec.md) |

## Frontend UI (9)

| 模块 | 说明 | Spec 链接 |
|------|------|-----------|
| **skill-library-ui** | SkillLibrary 页面，使用 PageHeader 和 ListToolbar 共享组件 | [spec.md](../blob/main/openspec/specs/skill-library-ui/spec.md) |
| **skill-editor-ui** | Python Code Skill 全页面编辑器，提供代码编写、Connection 绑定、依赖管理和在线测试 | [spec.md](../blob/main/openspec/specs/skill-editor-ui/spec.md) |
| **pipeline-editor-ui** | PipelineEditor 页面，ReactFlow 画布在暗色主题下的正确渲染 | [spec.md](../blob/main/openspec/specs/pipeline-editor-ui/spec.md) |
| **workflow-editor-ui** | WorkflowEditor 页面，React Flow 画布编辑器，4 种节点类型的拖拽式路由拓扑编辑 | [spec.md](../blob/main/openspec/specs/workflow-editor-ui/spec.md) |
| **editor-accordion-layout** | 编辑器页面右侧面板统一交互模式（SkillEditor、PipelineEditor、BuiltinSkillEditor） | [spec.md](../blob/main/openspec/specs/editor-accordion-layout/spec.md) |
| **unified-table-ui** | 统一表格组件，在所有主题下正确显示，避免硬编码颜色值 | [spec.md](../blob/main/openspec/specs/unified-table-ui/spec.md) |
| **page-header-component** | 统一 PageHeader 组件，用于所有页面头部标题区域 | [spec.md](../blob/main/openspec/specs/page-header-component/spec.md) |
| **list-toolbar-component** | 统一 ListToolbar 组件，用于所有列表页搜索/过滤区域 | [spec.md](../blob/main/openspec/specs/list-toolbar-component/spec.md) |
| **theme-system** | 内置 4 套主题配置，定义系统主题体系 | [spec.md](../blob/main/openspec/specs/theme-system/spec.md) |

## Testing (1)

| 模块 | 说明 | Spec 链接 |
|------|------|-----------|
| **e2e-testing** | Playwright E2E 测试覆盖 — Agent 模块及全系统 UI 功能验证 | [spec.md](../blob/main/openspec/specs/e2e-testing/spec.md) |

---

> 完整 spec 索引也可在 [`openspec/config.yaml`](../blob/main/openspec/config.yaml) 中查看。
