## Context

当前系统已有 Skill 数据模型（`backend/app/models/skill.py`）和完整的 CRUD API（`backend/app/api/skills.py`），但数据库中没有预置数据。用户首次使用时面对空白 Skill Library，无法快速构建 Pipeline。需要参照 Azure AI Search 内置认知技能，在系统启动时自动注入一组默认的内置 Skill。

现有模型字段：`name`, `description`, `skill_type`, `config_schema`, `is_builtin`。这些字段已足够支撑内置 Skill 的定义，无需变更数据模型。

## Goals / Non-Goals

**Goals:**
- 系统首次启动时自动插入 15 个内置 Skill 到数据库
- Seeding 操作幂等：重复启动不会创建重复记录
- 内置 Skill 不可被用户删除（API 层面保护）
- 前端 Skill Library 页面从 API 加载并展示内置 Skill

**Non-Goals:**
- 不实现 Skill 的实际执行引擎（仅定义元数据）
- 不实现 Skill Marketplace / Library 发布功能
- 不实现 input_schema / output_schema 等 Phase 2 字段
- 不实现版本管理

## Decisions

### D1: 内置 Skill 定义存放位置

**选择**: 在 `backend/app/data/builtin_skills.py` 中以 Python 字典列表定义

**理由**: 相比 JSON 文件或 YAML，Python 数据结构可直接被代码使用，支持注释，且与现有技术栈一致。无需引入额外的文件解析依赖。

**备选方案**: JSON 文件 → 需要文件加载逻辑和路径管理；数据库 migration → 不够灵活，修改需要新增 migration 文件。

### D2: Seeding 时机与机制

**选择**: 在 FastAPI `lifespan` 启动阶段，表创建之后调用 `seed_builtin_skills()`

**实现**:
1. 查询数据库中已存在的 `is_builtin=True` 的 Skill name 集合
2. 对比定义列表，仅插入缺失的 Skill
3. 使用 `SELECT name FROM skills WHERE is_builtin = TRUE` + 批量 INSERT

**理由**: 幂等且高效。每次启动只做一次轻量查询，只在缺失时才写入。

### D3: 内置 Skill 删除保护

**选择**: 在 `delete_skill` API 中增加 `is_builtin` 检查，内置 Skill 返回 403 Forbidden

**理由**: 最简单直接的保护方式，在 API 层面就拒绝，不需要额外的权限系统。

### D4: 内置 Skill 列表（参照 Azure AI Search）

按照 Azure AI Search 认知技能分类：

| # | Skill Name | Category | Description |
|---|-----------|----------|-------------|
| 1 | DocumentCracker | ingestion | 解析 PDF/DOCX/HTML/TXT/Markdown 提取文本 |
| 2 | TextSplitter | text_processing | 按策略分割文本（固定大小/句子/段落） |
| 3 | TextMerger | text_processing | 合并多段文本为一个文档 |
| 4 | LanguageDetector | text_processing | 检测文本语言 |
| 5 | EntityRecognizer | nlp | 命名实体识别（人名/地名/组织等） |
| 6 | EntityLinker | nlp | 实体链接到知识库 |
| 7 | KeyPhraseExtractor | nlp | 关键短语提取 |
| 8 | SentimentAnalyzer | nlp | 情感分析（正面/负面/中立） |
| 9 | PIIDetector | nlp | 个人信息检测与脱敏 |
| 10 | TextTranslator | nlp | 文本翻译 |
| 11 | OCR | vision | 光学字符识别 |
| 12 | ImageAnalyzer | vision | 图片分析与描述生成 |
| 13 | TextEmbedder | embedding | 文本向量化（支持多种模型） |
| 14 | Shaper | utility | 数据整形与字段映射 |
| 15 | Conditional | utility | 条件路由 |

## Risks / Trade-offs

- **[Risk] Seeding 与 Alembic migration 冲突** → Seeding 在应用层执行，不通过 migration，两者独立运行。生产环境中 migration 先跑（创建表），然后应用启动时 seeding 填充数据。
- **[Risk] 内置 Skill 定义变更** → 当前只做 INSERT 不做 UPDATE。如果需要修改内置 Skill 的描述或 config_schema，需要手动更新或未来实现 "upsert" 逻辑。MVP 阶段可接受。
- **[Trade-off] 不实现执行引擎** → 内置 Skill 目前仅作为元数据定义存在，实际执行在后续 change 中实现。好处是解耦，风险是用户可能期望立即可执行。
