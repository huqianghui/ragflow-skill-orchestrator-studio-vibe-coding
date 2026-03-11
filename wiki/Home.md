# Agentic RAGFlow Studio

AI Agent 驱动的智能编排工作室，用于构建数据摄取管道（Data Ingestion Pipeline）。

## 快速导航

| 目的 | 链接 |
|------|------|
| 项目概览、技术栈、快速开始 | [`README.md`](../blob/main/README.md) |
| 开发流程、编码规范、提交检查 | [`CLAUDE.md`](../blob/main/CLAUDE.md) |
| 系统行为规格（22 个模块） | [`openspec/specs/`](../tree/main/openspec/specs) |
| 变更追踪（37 个已归档） | [`openspec/changes/archive/`](../tree/main/openspec/changes/archive) |
| 任务看板 | [GitHub Projects](../../projects) |

## Wiki 页面索引

| 页面 | 说明 |
|------|------|
| [Architecture](Architecture) | 系统架构图、数据流、模块关系 |
| [Module Index](Module-Index) | 22 个 Spec 模块的摘要索引 |
| [Changelog](Changelog) | 37 个已归档变更的时间线 |
| [Roadmap](Roadmap) | 未来方向和计划 |
| [Dev Onboarding](Dev-Onboarding) | 新人上手指南 |

## 项目状态

- **Backend**: 12 个 API 模块, 12 个 ORM 模型, 35 个测试文件
- **Frontend**: 18 个页面组件, 11 个 E2E 测试
- **Specs**: 22 个模块规格, 37 个已归档变更
- **CI/CD**: GitHub Actions → Docker → Azure Container Apps

## 文档分层体系

```
README.md              ← 外部读者：项目是什么、怎么用
CLAUDE.md              ← Agent/开发者：怎么开发（HOW）
openspec/config.yaml   ← 项目元信息（技术栈、决策）
openspec/specs/        ← 产品规格：WHAT 详细
openspec/changes/      ← 变更追踪：WHY + WHEN
GitHub Projects        ← 任务看板（进行中的工作项）
GitHub Wiki            ← 全局视角（本站）：进度、架构、导览
```

> **不重复原则**: Wiki 只做导航和总览，不复制 README/CLAUDE.md/spec 中已有的内容。
