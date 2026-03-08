# Tasks: rename-to-agentic-ragflow

## Tasks

- [x] 1. 更新 `backend/pyproject.toml` — name 改为 "agentic-ragflow-studio"
- [x] 2. 更新 `backend/app/config.py` — app_name 改为 "Agentic RAGFlow Studio"
- [x] 3. 更新 `frontend/src/components/AppLayout.tsx` — Header 文字、Sider Logo、折叠缩写
- [x] 4. 更新 `openspec/config.yaml` — project.name 和 description
- [x] 5. 更新 `openspec/specs/system/spec.md` — app_name 配置表默认值
- [x] 6. 更新 `CLAUDE.md` — 标题和品牌引用 (不含 archive 引用)
- [x] 7. 更新 `README.md` — 标题和项目描述
- [x] 8. 更新 `package-lock.json` — name 字段 (package.json 无 name 字段,无需改动)
- [x] 9. 运行后端检查: ruff check + ruff format --check + pytest (198/199 passed, 1 个已有的 venv pip 超时问题与改名无关)
- [x] 10. 运行前端检查: npx tsc -b + npm run build (全部通过)
