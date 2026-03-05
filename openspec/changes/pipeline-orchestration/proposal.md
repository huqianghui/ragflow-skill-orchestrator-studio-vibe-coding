# Pipeline 编排引擎

## 变更编号

`pipeline-orchestration`

## 状态

`proposed`

## 问题描述

RAGFlow Skill Orchestrator Studio 的核心价值在于让用户能够将多个 Skill 编排为数据处理流水线（Pipeline）。当前系统虽然已经具备了基础设施和 Skill 管理能力，但仍然缺少以下关键功能：

- **缺少可视化编排能力**：用户无法通过拖拽方式将 Skill 组装为 Pipeline，无法直观理解数据流转路径
- **Pipeline 生命周期管理缺失**：没有 Pipeline 的创建、编辑、保存、版本化等完整生命周期管理
- **DAG 结构未实现**：Pipeline 本质上是一个有向无环图（DAG），系统需要支持节点（Node）和边（Edge）的管理，以及图结构的校验（环检测、连通性检查、类型兼容性验证）
- **节点间数据映射缺失**：上游节点的输出字段如何映射到下游节点的输入字段，缺少明确的定义和验证机制
- **没有模板系统**：常见的数据处理模式（如 "文档解析 -> 向量化 -> 知识库写入"）无法被沉淀为可复用的模板，用户每次都需要从零开始构建

## 解决方案

构建完整的 Pipeline 编排引擎，包括以下子系统：

### Pipeline CRUD

- 完整的 Pipeline 生命周期管理（创建、读取、更新、删除）
- Pipeline 状态管理：`draft` -> `active` -> `archived`
- Pipeline 元数据管理（名称、描述、标签）

### 节点与边管理

- Pipeline Node 管理：每个节点引用一个 Skill，并持有该 Skill 的实例化配置
- Pipeline Edge 管理：定义节点之间的连接关系和数据流向
- 节点位置信息存储，用于画布渲染还原

### DAG 图验证

- **环检测（Cycle Detection）**：确保 Pipeline 无环，使用拓扑排序（Topological Sort）算法
- **类型兼容性检查（Type Compatibility）**：验证上游节点的输出类型与下游节点的输入类型是否匹配
- **连通性验证（Connectivity Check）**：确保图是连通的，不存在孤立节点
- **输入完整性检查**：确保每个节点的必填输入字段都有数据来源

### 字段映射（Field Mapping）

- 上游节点输出字段到下游节点输入字段的映射配置
- 支持自动映射（按名称/类型匹配）和手动映射
- 映射关系的可视化展示与编辑

### 模板系统

- 预定义常见 Pipeline 模板（如文档处理、知识库构建、数据清洗）
- 从已有 Pipeline 保存为模板
- 从模板创建新 Pipeline

### 画布 UI

- 基于 React Flow 的可视化编排画布
- 支持拖拽节点、连线、缩放、平移等交互
- 节点配置面板（右侧抽屉）
- 实时 DAG 验证反馈

## 影响范围

| 维度 | 说明 |
|------|------|
| 影响模块 | Pipeline 模块（核心）、Skill 模块（引用关系）、前端画布 |
| 依赖关系 | 依赖 `init-project-foundation`（基础设施）和 `skill-management`（Skill CRUD） |
| 被依赖方 | `datasource-and-execution`（数据源绑定与执行）、`output-targets`（输出目标配置） |
| 风险等级 | 中（系统核心功能，需要仔细设计数据结构和验证逻辑） |
| 预计工作量 | 8-12 个工作日 |

## 成功标准

1. 用户可以通过 API 创建、查询、更新、删除 Pipeline
2. 用户可以在画布上拖拽 Skill 节点并连线，构建 DAG
3. 系统能够检测并拒绝包含环的 Pipeline 图
4. 系统能够验证节点间的类型兼容性
5. 用户可以配置节点间的字段映射关系
6. 用户可以从模板创建 Pipeline，也可以将 Pipeline 保存为模板
7. 画布状态可以正确保存和还原
8. 所有 API 端点有对应的单元测试，覆盖率 >= 80%
