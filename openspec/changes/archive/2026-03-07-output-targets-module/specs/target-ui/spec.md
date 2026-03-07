# Target UI Specification

## Purpose

定义 Output Target 前端页面：Card Grid 类型选择器、配置 Modal、Schema Mapping UI、列表页增强。

### Requirement: Card Grid 类型选择器

#### Scenario: /targets/new 页面布局

- 页面标题：Choose an output target
- 副标题：Select a target type to configure.
- 搜索过滤输入框
- Card Grid（3 列），按 4 个类别分组：Search / Storage / Graph DB / Relational DB
- "← Back to Output Targets" 返回链接

#### Scenario: 卡片内容

每张卡片：SVG 图标 (48×48) + 目标名称 + 类别标签

6 张卡片，4 个类别：
- Search: Azure AI Search (1)
- Storage: Azure Blob Storage (1)
- Graph DB: CosmosDB (Gremlin), Neo4j (2)
- Relational DB: MySQL, PostgreSQL (2)

#### Scenario: 搜索过滤

输入 "neo" → 只显示 Neo4j 卡片，空类别自动隐藏

#### Scenario: 点击卡片 → 配置 Modal

### Requirement: 配置 Modal

#### Scenario: 连接配置 (第一步)

Modal 显示：
- Name* 输入框
- Description 文本域
- Pipeline 下拉选择（可选，用于 schema 推断）
- 分隔线 "Connection"
- 类型对应的 CONFIG_FIELDS（secret 用 password 输入框）
- 底部：Cancel / Test / Next

Test 按钮行为同 DataSource：创建 Target → 测试连接 → 成功保留或失败删除

#### Scenario: Schema Mapping (第二步 — AI Search / Graph / Relational)

点击 Next 后显示 Schema Mapping UI（见下方）

#### Scenario: Blob 路径配置 (第二步 — azure_blob)

点击 Next 后显示：
- Output Path Template 输入框 + 变量提示
- Content Format 下拉 (json / text / binary / jsonl)
- 预览：展示模板展开后的示例路径

### Requirement: Schema Mapping UI

#### Scenario: 两列映射布局

```
Pipeline Output           →          Target Schema
┌─────────────────┐                ┌─────────────────┐
│ /doc/content    ── string ────→  │ content         │
│ /doc/chunks/*/  │                │                 │
│   text         ── string ────→  │ chunk_text      │
│   embedding    ── vector ────→  │ contentVector   │
│ /doc/metadata/ │                 │ title           │
│   title        ── string ────→  │                 │
└─────────────────┘                └─────────────────┘
```

- 左侧：从 Pipeline graph_data 推断的输出字段（需选择 pipeline_id）
- 右侧：从 discover-schema 获取的目标 schema
- 中间：可拖拽连线或下拉选择
- [Auto-suggest] 按钮：自动匹配名称和类型

#### Scenario: 无 Pipeline 时

- 左侧为空，提示 "请先选择一个 Pipeline 以查看可用输出字段"
- 可手动输入 source 路径

#### Scenario: AI Search 索引不存在

- 右侧显示 "Index not found"
- 提供 "Create Index" 按钮
- 点击后根据 Pipeline 输出生成推荐 schema，用户确认后创建

#### Scenario: Graph 映射模式

Graph 类型 (cosmosdb_gremlin, neo4j) 使用不同的映射 UI：
- Vertex Source 路径 + 字段映射 (id, label, properties)
- Edge Source 路径 + 字段映射 (label, source_id, target_id, properties)
- 不使用两列拖拽，而是表单形式

#### Scenario: 映射验证

点击 "Validate" → 调用 POST /targets/{id}/validate-mapping
- 绿色：映射有效
- 黄色：警告（类型兼容但可能丢失精度）
- 红色：错误（必填字段未映射、类型不兼容）

### Requirement: 列表页增强

#### Scenario: 表格列

| 列 | 说明 |
|----|------|
| Name | 可点击打开编辑 Modal |
| Type | SVG 图标 + colored Tag |
| Pipeline | 关联的 Pipeline 名称 (如有) |
| Status | colored Tag (active/inactive/error) |
| Created At | 日期时间 |
| Actions | Test / Edit / Delete |

#### Scenario: Actions

- Test：连通性测试（loading state）
- Edit：弹出编辑 Modal，source_type 不可更改，secret placeholder
- Delete：Popconfirm 确认

"New Target" 按钮 → /targets/new

### Requirement: SVG 图标

6 个图标位于 `frontend/public/icons/targets/`，kebab-case 命名：
- azure-ai-search.svg
- azure-blob-storage.svg
- cosmosdb-gremlin.svg
- neo4j.svg
- mysql.svg
- postgresql.svg

### Requirement: 路由

`/targets/new` → TargetNew（置于 `/targets` 之前）
`/targets` → Targets（增强版）
