## 1. ProcessedFile 模型

- [x] 1.1 创建 ProcessedFile ORM 模型
- [x] 1.2 在 models/__init__.py 导出
- [x] 1.3 更新 Alembic init migration + 新建 migration

## 2. 废弃旧 FK

- [x] 2.1 DataSource model 移除 pipeline_id 的 ForeignKey 声明
- [x] 2.2 Target model 移除 pipeline_id 的 ForeignKey 声明
- [x] 2.3 更新 init migration 中的 FK 声明

## 3. 增量处理

- [x] 3.1 WorkflowExecutor 增加增量文件过滤逻辑
- [x] 3.2 执行完成后写入 ProcessedFile 记录

## 4. Tests

- [x] 4.1 ProcessedFile CRUD + 增量过滤测试
- [x] 4.2 ruff + pytest 全部通过

## 5. 前端

- [x] 5.1 DataSourceNew 无需修改（无 pipeline_id）; TargetNew 保留 pipeline_id 用于 schema inference
- [x] 5.2 tsc + build 通过

## 6. 提交

- [x] 6.1 提交代码并推送，CI/CD 通过
