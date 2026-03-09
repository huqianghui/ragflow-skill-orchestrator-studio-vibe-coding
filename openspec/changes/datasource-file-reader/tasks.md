## 1. DataSource Reader Service

- [ ] 1.1 创建 `backend/app/services/data_source_reader.py` — FileInfo 模型 + list_files() + read_file() 分发器
- [ ] 1.2 实现 local_upload 的 list_files 和 read_file
- [ ] 1.3 实现 azure_blob 的 list_files 和 read_file

## 2. API Endpoint

- [ ] 2.1 在 `backend/app/api/data_sources.py` 中新增 GET /{id}/files 端点

## 3. Tests

- [ ] 3.1 创建 `backend/tests/test_data_source_reader.py` — 单元测试
- [ ] 3.2 运行 ruff check + ruff format --check + pytest 全部通过

## 4. Spec & 提交

- [ ] 4.1 更新 `openspec/specs/datasources/spec.md` 追加文件读取需求
- [ ] 4.2 提交代码并推送，确保 CI/CD 通过
