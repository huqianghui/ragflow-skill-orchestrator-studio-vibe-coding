# Design: 全量改名 RAGFlow → Agentic RAGFlow

## 设计概要

这是一个纯文本替换的重构变更，不涉及逻辑改动。所有品牌引用从 "RAGFlow Skill Orchestrator Studio" 统一更名为 "Agentic RAGFlow Studio"。

## 改名映射表

| 上下文 | 旧值 | 新值 |
|--------|------|------|
| 品牌全名 | RAGFlow Skill Orchestrator Studio | Agentic RAGFlow Studio |
| 技术标识 | ragflow-skill-orchestrator-studio | agentic-ragflow-studio |
| UI Sider (展开) | Skill Orchestrator | Agentic RAGFlow |
| UI Sider (折叠) | SO | AR |
| config app_name | RAGFlow Skill Orchestrator Studio | Agentic RAGFlow Studio |

## 变更策略

1. 逐文件替换，不使用全局 sed 避免误伤
2. `openspec/changes/archive/` 中的历史文档保持不动
3. 代码中的变量名、函数名不受影响（未使用品牌名作标识符）
4. GitHub repo rename 在代码改动合并后手动执行

## 影响的文件

### Backend
- `backend/pyproject.toml` — name 字段
- `backend/app/config.py` — app_name 默认值

### Frontend
- `frontend/src/components/AppLayout.tsx` — Header 和 Sider 文字

### 配置 & 文档
- `openspec/config.yaml` — project.name 和 description
- `openspec/specs/system/spec.md` — app_name 配置表
- `CLAUDE.md` — 标题和品牌引用
- `README.md` — 标题和项目描述
- `package.json` — name 字段
- `package-lock.json` — name 字段
