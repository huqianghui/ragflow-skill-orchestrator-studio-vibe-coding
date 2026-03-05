# 实施任务清单：Pipeline 编排引擎

## 概览

本文档列出 `pipeline-orchestration` 变更的所有实施任务。任务按模块分组，标注优先级和依赖关系。

---

## 1. 后端数据模型

### 1.1 Pipeline 相关 ORM 模型

- [ ] 创建 `app/models/pipeline_node.py` -- PipelineNode 模型
  - 字段：pipeline_id (FK), skill_id (FK), node_key, label, position_x, position_y, config (JSON)
  - 关系：pipeline, skill
- [ ] 创建 `app/models/pipeline_edge.py` -- PipelineEdge 模型
  - 字段：pipeline_id (FK), source_node_id (FK), target_node_id (FK), source_handle, target_handle, field_mapping (JSON)
  - 关系：pipeline, source_node, target_node
- [ ] 更新 `app/models/pipeline.py` -- 扩展 Pipeline 模型
  - 新增字段：version, tags (JSON), template_id (FK), viewport (JSON)
  - 新增关系：nodes, edges（cascade delete）
- [ ] 创建 `app/models/pipeline_template.py` -- PipelineTemplate 模型
  - 字段：name, description, category, is_builtin, graph_snapshot (JSON), thumbnail_url, use_count
- [ ] 创建 `app/models/pipeline_version.py` -- PipelineVersion 模型
  - 字段：pipeline_id (FK), version, graph_snapshot (JSON), activated_at, description
- [ ] 更新 `app/models/__init__.py`，统一导出所有新模型

### 1.2 Pydantic Schema 定义

- [ ] 创建 `app/schemas/pipeline_node.py`
  - PipelineNodeCreate, PipelineNodeUpdate, PipelineNodeResponse
- [ ] 创建 `app/schemas/pipeline_edge.py`
  - PipelineEdgeCreate, PipelineEdgeUpdate, PipelineEdgeResponse
  - FieldMappingConfig, FieldMapping
- [ ] 更新 `app/schemas/pipeline.py`
  - PipelineCreate（新增 tags）
  - PipelineUpdate（新增 status, tags, viewport）
  - PipelineGraphUpdate（nodes + edges + viewport 整体更新）
  - PipelineDetailResponse（嵌套 nodes, edges）
- [ ] 创建 `app/schemas/pipeline_template.py`
  - PipelineTemplateCreate, PipelineTemplateResponse
- [ ] 创建 `app/schemas/pipeline_version.py`
  - PipelineVersionResponse
- [ ] 创建 `app/schemas/validation.py`
  - ValidationError, ValidationWarning, ValidationResult

### 1.3 数据库迁移

- [ ] 生成 Alembic 迁移脚本：`alembic revision --autogenerate -m "add pipeline nodes edges templates versions"`
- [ ] 验证迁移脚本正确创建以下表：pipeline_nodes, pipeline_edges, pipeline_templates, pipeline_versions
- [ ] 验证 Pipeline 表的新增字段（version, tags, template_id, viewport）正确更新
- [ ] 执行迁移并确认表结构正确

---

## 2. Pipeline CRUD API

### 2.1 Pipeline 基础 CRUD

- [ ] 实现 `GET /api/v1/pipelines` -- Pipeline 列表
  - 支持分页参数（page, page_size）
  - 支持按 status 过滤
  - 支持按 name 搜索（模糊匹配）
  - 支持按 tags 过滤
- [ ] 实现 `POST /api/v1/pipelines` -- 创建 Pipeline
  - 校验 name 非空
  - 默认状态为 draft
  - 默认 version 为 1
- [ ] 实现 `GET /api/v1/pipelines/{id}` -- 获取 Pipeline 详情
  - 嵌套返回所有 nodes 和 edges
  - nodes 中嵌套返回 Skill 基本信息
- [ ] 实现 `PUT /api/v1/pipelines/{id}` -- 更新 Pipeline 元数据
  - 仅允许更新 name, description, tags
  - status 变更使用专用端点
- [ ] 实现 `DELETE /api/v1/pipelines/{id}` -- 删除 Pipeline
  - 级联删除所有 nodes, edges
  - 不删除关联的 templates 和 versions（保留历史记录）

### 2.2 Pipeline 图结构操作

- [ ] 实现 `PUT /api/v1/pipelines/{id}/graph` -- 整体更新图结构
  - 接收完整的 nodes + edges + viewport
  - 在事务中执行：删除旧节点和边 -> 创建新节点和边
  - 验证所有 skill_id 存在
  - 验证 Edge 引用的 node_key 在当前提交的 nodes 中存在
- [ ] 实现 `POST /api/v1/pipelines/{id}/validate` -- 验证 Pipeline DAG
  - 调用 PipelineValidator 进行全量验证
  - 返回 ValidationResult

### 2.3 Pipeline 状态管理

- [ ] 实现 `POST /api/v1/pipelines/{id}/activate` -- 激活 Pipeline
  - 前置验证：调用 PipelineValidator，仅在验证通过时允许激活
  - 递增 version 字段
  - 在 pipeline_versions 表中保存图结构快照
  - 状态变更：draft -> active
- [ ] 实现 `POST /api/v1/pipelines/{id}/archive` -- 归档 Pipeline
  - 状态变更：active -> archived
  - archived 状态的 Pipeline 不允许编辑

---

## 3. Pipeline 验证引擎

### 3.1 验证器核心实现

- [ ] 创建 `app/services/pipeline_validator.py`
- [ ] 实现 `PipelineValidator` 类
- [ ] 实现环检测算法（Kahn 算法 / 拓扑排序）
  - 输入：节点列表和边列表
  - 输出：是否存在环 + 涉及的节点 ID
- [ ] 实现类型兼容性检查
  - 定义类型兼容矩阵（TYPE_COMPATIBILITY）
  - 遍历所有边，检查源节点输出类型与目标节点输入类型是否兼容
- [ ] 实现连通性检查（BFS）
  - 将有向边视为无向边进行 BFS 遍历
  - 检测是否存在孤立节点（Warning 级别）
- [ ] 实现必填输入完整性检查
  - 遍历所有节点，检查其必填输入字段是否有上游边提供数据
- [ ] 实现节点配置校验
  - 根据 Skill 的 config_schema 验证节点的 config 是否合法

### 3.2 验证器单元测试

- [ ] 测试空 Pipeline 验证通过
- [ ] 测试无环 DAG 验证通过
- [ ] 测试包含环的图被正确检测
- [ ] 测试类型兼容的边验证通过
- [ ] 测试类型不兼容的边被检测
- [ ] 测试孤立节点产生 Warning
- [ ] 测试必填输入缺失被检测
- [ ] 测试复杂图结构（多分支、汇聚）的综合验证

---

## 4. 字段映射（Field Mapping）

### 4.1 字段映射服务

- [ ] 创建 `app/services/field_mapping.py`
- [ ] 实现自动映射算法 `auto_map_fields()`
  - 第一轮：按字段名精确匹配
  - 第二轮：按字段类型匹配
  - 返回映射结果 + 未匹配字段列表
- [ ] 实现映射验证 `validate_mapping()`
  - 检查所有必填目标字段是否被映射
  - 检查映射的类型兼容性

### 4.2 字段映射 API

- [ ] 实现 `GET /api/v1/pipelines/{id}/edges/{edge_id}/mapping` -- 获取映射配置
- [ ] 实现 `PUT /api/v1/pipelines/{id}/edges/{edge_id}/mapping` -- 更新映射配置
  - 支持手动修改映射关系
  - 保存前验证映射合法性
- [ ] 实现 `POST /api/v1/pipelines/{id}/edges/{edge_id}/auto-mapping` -- 触发自动映射
  - 根据上游节点的 output_fields 和下游节点的 input_fields 自动生成映射

### 4.3 字段映射测试

- [ ] 测试名称精确匹配的自动映射
- [ ] 测试类型匹配的自动映射
- [ ] 测试无可映射字段的情况
- [ ] 测试手动更新映射的 API
- [ ] 测试映射验证（必填字段缺失、类型不兼容）

---

## 5. 模板系统

### 5.1 模板 CRUD

- [ ] 创建 `app/services/template_service.py`
- [ ] 实现 `GET /api/v1/templates` -- 模板列表
  - 支持按 category 过滤
  - 支持按 name 搜索
  - 支持按 use_count 排序
- [ ] 实现 `GET /api/v1/templates/{id}` -- 模板详情
- [ ] 实现 `POST /api/v1/templates` -- 创建模板（管理员）

### 5.2 模板与 Pipeline 互转

- [ ] 实现 `POST /api/v1/pipelines/{id}/save-as-template` -- Pipeline 保存为模板
  - 将当前 Pipeline 的 nodes + edges + viewport 打包为 graph_snapshot
  - 创建 PipelineTemplate 记录
- [ ] 实现 `POST /api/v1/templates/{id}/instantiate` -- 从模板创建 Pipeline
  - 从 graph_snapshot 恢复完整图结构
  - 生成新的节点和边 ID
  - 维护 ID 映射表，确保边的引用正确
  - 递增模板的 use_count

### 5.3 内置模板数据初始化

- [ ] 编写 Seed 脚本，创建 4 个内置模板
  - 文档解析与向量化模板
  - 知识库构建模板
  - 多源数据聚合模板
  - 问答增强模板
- [ ] 在应用启动时检查并初始化内置模板（仅首次）

### 5.4 模板测试

- [ ] 测试模板 CRUD API
- [ ] 测试 Pipeline 保存为模板
- [ ] 测试从模板实例化 Pipeline（验证 ID 正确替换）
- [ ] 测试内置模板初始化

---

## 6. 版本管理

### 6.1 版本 API

- [ ] 实现 `GET /api/v1/pipelines/{id}/versions` -- 获取版本历史列表
  - 按 version 降序排列
  - 返回 version, activated_at, description
- [ ] 实现 `GET /api/v1/pipelines/{id}/versions/{version}` -- 获取指定版本详情
  - 返回完整的 graph_snapshot
- [ ] 实现 `POST /api/v1/pipelines/{id}/versions/{version}/rollback` -- 回滚到指定版本
  - 从 graph_snapshot 恢复图结构到当前 Pipeline
  - 将 Pipeline 状态重置为 draft
  - 不删除已有版本记录

### 6.2 版本自动快照

- [ ] 在 Pipeline 激活（activate）时自动创建版本快照
- [ ] 快照内容包含完整的 nodes + edges + viewport 结构
- [ ] 版本号自动递增

### 6.3 版本测试

- [ ] 测试激活 Pipeline 时自动创建版本
- [ ] 测试获取版本历史列表
- [ ] 测试获取指定版本详情
- [ ] 测试回滚到指定版本后图结构正确还原
- [ ] 测试回滚后 Pipeline 状态重置为 draft

---

## 7. 前端画布实现

### 7.1 React Flow 画布基础

- [ ] 安装 React Flow 依赖（`@xyflow/react`）
- [ ] 创建 `PipelineEditor` 页面组件
- [ ] 配置 React Flow 画布基础功能
  - 节点拖拽
  - 画布缩放与平移
  - Mini Map
  - 画布背景网格
- [ ] 实现画布的保存与还原逻辑
  - 从 API 加载 Pipeline 数据 -> 转换为 React Flow 格式 -> 渲染
  - React Flow 格式 -> 转换为 API 格式 -> 保存

### 7.2 自定义节点组件

- [ ] 创建 `SkillNode` 自定义节点组件
  - 显示 Skill 图标、名称、类型标签
  - 输入端口（左侧 Handle）
  - 输出端口（右侧 Handle）
  - 配置状态指示（已配置/未配置）
  - 验证错误标记（红色 Badge）
- [ ] 创建 `DataSourceNode` 自定义节点（数据源入口节点）
- [ ] 创建 `TargetNode` 自定义节点（输出目标节点）
- [ ] 注册所有自定义节点类型到 React Flow 的 `nodeTypes`

### 7.3 左侧 Skill 面板

- [ ] 创建 `SkillPanel` 组件
  - 获取可用 Skill 列表
  - 按 skill_type 分类展示
  - 支持搜索过滤
- [ ] 实现拖拽功能（HTML5 Drag and Drop API）
  - Skill 卡片设置 `draggable`
  - `onDragStart` 携带 skillId 数据
  - 画布 `onDrop` 事件处理，创建新节点

### 7.4 右侧属性面板

- [ ] 创建 `PropertyPanel` 组件（右侧抽屉）
- [ ] 实现节点配置表单
  - 根据 Skill 的 `config_schema`（JSON Schema）动态渲染表单
  - 支持文本输入、数字输入、下拉选择、开关等控件
  - 表单变更时更新节点 config 数据
- [ ] 实现字段映射编辑器
  - 选中 Edge 时显示字段映射面板
  - 展示源节点输出字段 -> 目标节点输入字段的映射关系
  - 支持手动调整映射
  - 提供 "自动映射" 按钮
- [ ] 实现验证信息面板
  - 展示当前 Pipeline 的验证结果
  - 点击错误项可高亮对应节点/边

### 7.5 画布状态管理（Zustand）

- [ ] 创建 `usePipelineEditorStore` Zustand Store
- [ ] 实现 Pipeline 加载逻辑（`loadPipeline`）
- [ ] 实现 Pipeline 保存逻辑（`savePipeline`）
- [ ] 实现节点增删改操作
- [ ] 实现边增删操作
- [ ] 实现验证触发与结果存储
- [ ] 实现 `isDirty` 状态跟踪（未保存变更提示）
- [ ] 实现 React Flow 回调绑定（onNodesChange, onEdgesChange, onConnect）

### 7.6 顶部工具栏

- [ ] 创建 `PipelineToolbar` 组件
  - Pipeline 名称（可编辑）
  - 保存按钮（调用 savePipeline）
  - 验证按钮（调用 validatePipeline，展示结果）
  - 运行按钮（预留，后续 `datasource-and-execution` 实现）
  - 版本历史按钮（打开版本列表 Modal）
  - 模板按钮（保存为模板 / 从模板创建）

### 7.7 底部状态栏

- [ ] 创建 `PipelineStatusBar` 组件
  - 显示节点数量和边数量
  - 显示验证状态（通过/未通过/未验证）
  - 显示最后保存时间
  - 显示 Pipeline 状态（draft / active / archived）

---

## 8. 前端 API 集成

- [ ] 创建 `src/services/pipelineApi.ts` -- Pipeline API 调用方法
  - `listPipelines(params)` -- 获取 Pipeline 列表
  - `createPipeline(data)` -- 创建 Pipeline
  - `getPipeline(id)` -- 获取 Pipeline 详情
  - `updatePipeline(id, data)` -- 更新 Pipeline 元数据
  - `deletePipeline(id)` -- 删除 Pipeline
  - `updatePipelineGraph(id, graphData)` -- 更新图结构
  - `validatePipeline(id)` -- 验证 Pipeline
  - `activatePipeline(id)` -- 激活 Pipeline
- [ ] 创建 `src/services/templateApi.ts` -- 模板 API 调用方法
  - `listTemplates(params)` -- 获取模板列表
  - `getTemplate(id)` -- 获取模板详情
  - `saveAsTemplate(pipelineId, data)` -- 保存为模板
  - `instantiateTemplate(templateId, data)` -- 从模板创建 Pipeline
- [ ] 创建 `src/services/versionApi.ts` -- 版本 API 调用方法
  - `listVersions(pipelineId)` -- 获取版本历史
  - `getVersion(pipelineId, version)` -- 获取版本详情
  - `rollbackVersion(pipelineId, version)` -- 回滚版本
- [ ] 更新 TypeScript 类型定义
  - PipelineNode, PipelineEdge, FieldMapping 类型
  - PipelineTemplate, PipelineVersion 类型
  - ValidationResult, ValidationError, ValidationWarning 类型

---

## 9. 后端集成测试

- [ ] 测试 Pipeline CRUD 完整流程
- [ ] 测试图结构更新 API（节点和边的正确存储与返回）
- [ ] 测试 Pipeline 验证 API（各种验证场景）
- [ ] 测试 Pipeline 激活流程（验证 -> 版本快照 -> 状态变更）
- [ ] 测试模板保存与实例化
- [ ] 测试版本回滚
- [ ] 测试级联删除（删除 Pipeline 时 nodes 和 edges 同步删除）
- [ ] 测试字段映射 API
- [ ] 测试并发安全（两个用户同时编辑同一 Pipeline）

---

## 任务依赖关系

```
1.1 ORM 模型
 ├── 1.2 Pydantic Schema
 │    ├── 2.1 Pipeline CRUD API
 │    ├── 2.2 图结构操作 API
 │    └── 2.3 状态管理 API
 └── 1.3 数据库迁移
      └── 9. 后端集成测试

3.1 验证器实现
 ├── 3.2 验证器测试
 └── 2.2 图结构操作 API（validate 端点）

4.1 字段映射服务
 ├── 4.2 字段映射 API
 └── 4.3 字段映射测试

5.1 模板 CRUD
 ├── 5.2 模板与 Pipeline 互转
 ├── 5.3 内置模板初始化
 └── 5.4 模板测试

6.1 版本 API
 ├── 6.2 版本自动快照
 └── 6.3 版本测试

7.1 React Flow 画布
 ├── 7.2 自定义节点组件
 ├── 7.3 左侧 Skill 面板
 ├── 7.4 右侧属性面板
 ├── 7.5 Zustand Store
 ├── 7.6 顶部工具栏
 └── 7.7 底部状态栏

8. 前端 API 集成（依赖后端 API 完成）
```

## 验收标准

1. `POST /api/v1/pipelines` 成功创建 Pipeline，`GET /api/v1/pipelines/{id}` 返回完整的节点和边信息
2. `PUT /api/v1/pipelines/{id}/graph` 能够正确保存和还原画布状态（节点位置、连线关系、viewport）
3. `POST /api/v1/pipelines/{id}/validate` 能够检测出环、类型不兼容、孤立节点等问题
4. 字段自动映射能够正确匹配名称相同且类型兼容的字段
5. Pipeline 激活时自动创建版本快照，回滚操作能正确还原图结构
6. 从模板创建的 Pipeline 与模板的图结构一致，但使用全新的 ID
7. 前端画布支持拖拽 Skill 创建节点、连线、配置节点参数、字段映射编辑
8. 所有后端 API 有对应的测试用例，核心逻辑（验证器、字段映射）测试覆盖率 >= 80%
9. 前端无 TypeScript 类型错误（`tsc --noEmit` 通过）
