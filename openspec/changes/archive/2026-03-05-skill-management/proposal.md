# Skill 管理与执行引擎

## 变更编号

CHANGE-003: skill-management

## 状态

Draft

## 问题陈述

RAGFlow Skill Orchestrator Studio 需要一套完整的 Skill 管理体系，作为 Pipeline 的原子处理单元（类似 Azure AI Skillset 中的 Skill 概念）。当前面临以下挑战：

1. **内置 Skill 缺乏统一管理**：DocumentCracker、TextSplitter、TextEmbedder 等内置处理器没有标准化的注册和调用机制
2. **自定义扩展能力不足**：用户无法灵活地引入自定义处理逻辑，限制了平台的适用场景
3. **缺少三种关键自定义方式**：
   - **Web API Skill**：调用外部 HTTP 服务作为处理节点
   - **Config Template Skill**：通过配置模板组合内置处理器，无需编码
   - **Python Code Upload Skill**：上传自定义 Python 脚本，在沙箱中执行
4. **没有 Skill 库/Marketplace**：无法复用、分享和发现社区 Skill

## 提议方案

### 核心设计

构建统一的 Skill 管理与执行引擎，包含以下子系统：

1. **Skill CRUD API**：标准化的 Skill 元数据管理，支持创建、查询、更新、删除、版本管理
2. **三种执行引擎**：
   - **WebApiSkillEngine**：HTTP Client 封装，支持 retry、timeout、authentication
   - **ConfigTemplateSkillEngine**：内置处理器编排，通过 JSON/YAML 配置驱动
   - **PythonCodeSkillEngine**：沙箱化 Python 执行环境，subprocess 隔离，依赖安装
3. **Skill Registry**：统一的 Skill 注册中心，支持类型发现和动态加载
4. **Skill Library / Marketplace**：Skill 的发布、搜索、安装、评分体系

### 类型层次

```
Skill (Abstract Base)
├── BuiltInSkill          # 内置 Skill（系统预置）
├── WebApiSkill            # Web API 自定义 Skill
├── ConfigTemplateSkill    # 配置模板自定义 Skill
└── PythonCodeSkill        # Python 代码自定义 Skill
```

## 影响范围

### 核心影响

- **Pipeline 构建**：Skill 是 Pipeline 的核心构建块，所有 Pipeline 节点均对应一个 Skill 实例
- **数据模型**：新增 `skills` 表及关联表
- **API 层**：新增 `/api/v1/skills` 系列 endpoints
- **执行引擎**：新增三种 Skill Engine 实现

### 依赖关系

- 被 `pipeline-engine`（CHANGE-002）依赖：Pipeline 中的每个节点引用一个 Skill
- 依赖 `data-model`（CHANGE-001）：使用基础数据模型和存储层

### 安全考量

- Python Code Skill 需要严格的沙箱隔离（subprocess + resource limits）
- Web API Skill 需要 credential 安全存储
- Skill Library 需要代码审查和安全扫描机制

## 成功指标

- 内置 Skill 覆盖 RAGFlow 核心处理能力（>=8 个内置 Skill）
- 三种自定义 Skill 类型均可在 Pipeline 中正常执行
- Skill Library 支持发布和安装流程
- Python Code Skill 沙箱通过安全测试（资源限制、网络隔离）
