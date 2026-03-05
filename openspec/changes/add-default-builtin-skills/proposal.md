## Why

系统当前虽然定义了 Skill 数据模型和 CRUD API，但没有任何预装的内置 Skill。用户首次启动系统后看到的是一个空白的 Skill Library，无法快速体验 Pipeline 构建。参照 Azure AI Search 的做法，系统应在初始化时自动加载一组覆盖常见数据处理场景的内置 Skill（如文档解析、文本分割、OCR、实体识别、关键短语提取、语言检测、情感分析、文本翻译、图片分析、PII 脱敏等），让用户开箱即用。

## What Changes

- 新增内置 Skill 定义数据文件（JSON/Python），包含 10+ 个默认 Skill 的完整定义（name, description, skill_type=builtin, config_schema, is_builtin=True）
- 新增数据库 seeding 机制：应用启动时自动检测并插入缺失的内置 Skill（幂等操作，不覆盖已存在记录）
- 内置 Skill 列表参照 Azure AI Search 内置认知技能：
  - **DocumentCracker** - 文档解析（PDF/DOCX/HTML/TXT/Markdown）
  - **TextSplitter** - 文本分块（按固定大小/句子/段落）
  - **TextMerger** - 文本合并
  - **LanguageDetector** - 语言检测
  - **EntityRecognizer** - 命名实体识别 (NER)
  - **EntityLinker** - 实体链接
  - **KeyPhraseExtractor** - 关键短语提取
  - **SentimentAnalyzer** - 情感分析
  - **PIIDetector** - 个人信息检测与脱敏
  - **TextTranslator** - 文本翻译
  - **OCR** - 光学字符识别
  - **ImageAnalyzer** - 图片分析与描述
  - **TextEmbedder** - 文本向量化
  - **Shaper** - 数据整形/字段映射
  - **Conditional** - 条件路由
- 前端 Skill Library 页面能正确展示内置 Skill 列表（从 API 加载）
- 内置 Skill 在 UI 中标记为 "Built-in"，不可删除

## Capabilities

### New Capabilities

- `builtin-skill-seeding`: 系统启动时自动加载内置 Skill 定义到数据库的 seeding 机制

### Modified Capabilities

- `skills`: 扩展 Skill 规格，明确内置 Skill 的完整定义和不可删除约束

## Impact

- **Backend**: `backend/app/main.py`（lifespan 中添加 seed 调用）、新增 `backend/app/services/skill_seeder.py` 和 `backend/data/builtin_skills.py`
- **API**: 删除内置 Skill 时应返回 403 Forbidden
- **Database**: skills 表中新增 15 条内置记录
- **Frontend**: SkillLibrary 页面需从 API 加载数据并禁用内置 Skill 的删除按钮
- **Dependencies**: 无新增外部依赖
