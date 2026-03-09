## Why

现有系统中 DataSource、Pipeline、Target 三个模块各自独立，缺少一个编排层将它们串通。用户需要将混合文件类型（PDF/Word/PPT/图片/视频）按类型路由到不同 Pipeline 处理，结果写入多个 Target。新增 Workflow 编排实体是实现端到端串联的第一步。

## What Changes

- 新增 **Workflow** ORM 模型，存储编排配置（数据源绑定、路由规则、默认路由）
- 新增 Workflow 的 Pydantic schemas（Create / Update / Response）
- 新增 Workflow CRUD API 路由（POST / GET / PUT / DELETE `/api/v1/workflows`）
- 新增 Alembic migration（`workflows` 表）
- 新增前端 Workflows 列表页 + 创建/编辑表单
- 注册路由到 FastAPI app

## Capabilities

### New Capabilities

- `workflows`: Workflow 编排实体的数据模型、CRUD API 和前端管理页面。包含路由规则定义（按文件扩展名/MIME 类型/大小/路径模式过滤）、数据源绑定、Pipeline + Target 关联。

### Modified Capabilities

（无现有 spec 的需求级变更）

## Impact

- **后端**: 新增 model / schema / api / migration 各一个文件，修改 `models/__init__.py` 和 `api/router.py`
- **前端**: 新增 Workflows 页面组件，修改路由配置和 API 客户端
- **数据库**: 新增 `workflows` 表
- **API**: 新增 `/api/v1/workflows` 端点族
