# 全量改名: RAGFlow → Agentic RAGFlow

## 变更编号

`rename-to-agentic-ragflow`

## 状态

`proposed`

## 问题描述

RAGFlow Skill Orchestrator Studio 正在从一个纯手动的 Pipeline 编排工具，进化为 AI Agent 驱动的智能编排平台。当前品牌名「RAGFlow Skill Orchestrator Studio」无法体现这一核心定位升级：

- **名称过长**：9 个词的全名在 UI、文档、口头交流中都不便使用
- **缺少 Agent 定位**：名称未体现 AI Agent 作为一等公民的产品方向
- **技术标识不一致**：pyproject.toml、package.json、config.yaml 中的技术名各有差异
- **后续 change 的基础**：`agent-backend-core`、`embedded-agent-ui`、`agent-playground` 三个 change 都依赖新名称

## 解决方案

将项目从 **RAGFlow Skill Orchestrator Studio** 全量改名为 **Agentic RAGFlow Studio**。

### 命名体系

| 用途 | 旧名称 | 新名称 |
|------|--------|--------|
| 品牌全名 | RAGFlow Skill Orchestrator Studio | **Agentic RAGFlow Studio** |
| 技术标识 (pyproject/package) | ragflow-skill-orchestrator-studio | **agentic-ragflow-studio** |
| 前端 Header | RAGFlow Skill Orchestrator Studio | **Agentic RAGFlow Studio** |
| 前端 Sider Logo (展开) | Skill Orchestrator | **Agentic RAGFlow** |
| 前端 Sider Logo (折叠) | SO | **AR** |
| 配置 app_name | RAGFlow Skill Orchestrator Studio | **Agentic RAGFlow Studio** |
| OpenSpec project.name | ragflow-skill-orchestrator-studio | **agentic-ragflow-studio** |

### 变更范围

#### 1. GitHub Repository

- rename repo: `ragflow-skill-orchestrator-studio-spec-drive-develop` → `agentic-ragflow-studio`

#### 2. Backend

| 文件 | 改动 |
|------|------|
| `backend/pyproject.toml` | `name = "agentic-ragflow-studio"` |
| `backend/app/config.py` | `app_name = "Agentic RAGFlow Studio"` |

#### 3. Frontend

| 文件 | 改动 |
|------|------|
| `frontend/src/components/AppLayout.tsx` | Header 文字、Sider Logo、折叠缩写 |

#### 4. 配置 & 文档

| 文件 | 改动 |
|------|------|
| `openspec/config.yaml` | `name: agentic-ragflow-studio`，`description` 更新 |
| `openspec/specs/system/spec.md` | `app_name` 默认值更新 |
| `CLAUDE.md` | 标题和所有品牌引用 |
| `README.md` | 标题和项目描述 |
| `package.json` | `name` 字段 |
| `package-lock.json` | `name` 字段 |

#### 5. 不改动的部分

- `openspec/changes/archive/` 下的历史文档 — 保持原样，作为历史记录
- 代码中的变量名、函数名 — 无需改动（内部没有使用品牌名作为标识符）
- `processor_class` 中的 `ragflow.processors.*` 引用 — 这是 archive 中的历史设计文档

## 影响范围

| 维度 | 说明 |
|------|------|
| 影响模块 | 跨全项目 (~15 处文本替换) |
| 依赖关系 | 无前置依赖 |
| 被依赖方 | `agent-backend-core`、`embedded-agent-ui`、`agent-playground` 都依赖本 change |
| 风险等级 | **低** — 纯文本替换，不涉及逻辑变更 |
| 破坏性 | GitHub repo rename 会使旧 URL 失效 (GitHub 自动重定向) |

## 成功标准

1. 所有源文件中不再出现 "RAGFlow Skill Orchestrator Studio" 品牌名 (archive 除外)
2. 前端 UI 显示新名称 "Agentic RAGFlow Studio"
3. `backend/app/config.py` 中 `app_name` 为新值
4. `ruff check .` + `ruff format --check .` + `pytest` 全通过
5. `npx tsc -b` + `npm run build` 全通过
6. GitHub repo 名为 `agentic-ragflow-studio`

## 与其他 Change 的协调

- 本 change **必须首先合并**到 main，作为后续三个 agent 相关 change 的基础
- 后续 change 中所有新文件、文档、注释中使用 "Agentic RAGFlow Studio" 作为品牌名
- `openspec/config.yaml` 的 description 在本 change 中先不加 agent 相关描述，留给 `agent-backend-core` 更新
