## Why

Dashboard 当前只有 7 张纯计数卡片，缺少 Workflow 模块统计、状态分布、最近活动和成功率等关键信息。同时，前端通过 7 个独立 list API 获取计数数据，效率低下。需要一个后端聚合 API + 更丰富的前端展示，让用户一目了然掌握系统全貌。

## What Changes

- 新增后端 `GET /api/v1/dashboard/stats` 聚合端点，一次返回所有统计数据（各资源总数、状态分布、最近 WorkflowRun、成功率）
- Dashboard 新增 Workflows 和 Workflow Runs 两张统计卡片
- 新增"最近 Workflow Runs"活动列表区域，展示最近 5 条运行记录及状态
- 新增 WorkflowRun 成功率指标展示
- Dashboard 数据获取从 7 个独立 API 切换为单一 stats 聚合 API
- 保持现有可拖拽卡片布局，新增卡片自动融入网格

## Capabilities

### New Capabilities

- `dashboard`: Dashboard 页面的统计数据聚合 API 和前端增强展示

### Modified Capabilities

（无 spec 级别的行为变更）

## Impact

- 后端新增: `backend/app/api/dashboard.py` 路由，`backend/app/api/router.py` 注册
- 前端修改: `frontend/src/pages/Dashboard.tsx` 重构数据获取和卡片布局
- 前端修改: `frontend/src/services/api.ts` 新增 `dashboardApi`
- 前端修改: `frontend/src/types/index.ts` 新增 `DashboardStats` 类型
- 测试新增: `backend/tests/test_dashboard_api.py`
