## Context

DataSource 模块已有 16 种数据源类型的连通性测试（`data_source_tester.py`）和本地文件上传管理（`upload_manager.py`）。本变更新增文件枚举与读取能力，为 Workflow 执行引擎提供数据输入。

## Goals / Non-Goals

**Goals:**
- 实现 `local_upload` 和 `azure_blob` 的文件枚举与读取
- 提供统一的 `FileInfo` 数据结构
- 提供 REST API 端点用于文件列表查询
- 采用与 `data_source_tester.py` 一致的分发器模式

**Non-Goals:**
- 不实现其他 14 种源类型的读取（后续按需添加）
- 不实现文件内容的 REST API 下载（读取仅供后端服务内部调用）
- 不实现增量检测逻辑（Change 4）

## Decisions

### 1. 采用分发器模式（Dispatcher Pattern）

复用 `data_source_tester.py` 的 `_TESTERS` dict 模式，创建 `_LISTERS` 和 `_READERS` 两个分发器字典，按 source_type 路由。

### 2. FileInfo 使用 Pydantic 模型

便于 API 序列化，与现有 schema 风格一致。

### 3. Azure SDK 延迟导入

与 `data_source_tester.py` 一致，Azure SDK 在函数体内延迟导入，避免未安装时全局导入失败。

## Risks / Trade-offs

- **[azure_blob 大目录]** → `list_files()` 默认限制返回 1000 条，通过 `max_results` 参数控制。
- **[文件读取内存]** → `read_file()` 返回 bytes，大文件需调用方注意内存。后续可改为流式读取。
