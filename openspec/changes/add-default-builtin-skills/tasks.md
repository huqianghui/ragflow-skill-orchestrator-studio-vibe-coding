## 1. 内置 Skill 数据定义

- [x] 1.1 创建 `backend/app/data/builtin_skills.py`，定义 15 个内置 Skill 的完整数据（name, description, skill_type="builtin", config_schema, is_builtin=True），包括 DocumentCracker, TextSplitter, TextMerger, LanguageDetector, EntityRecognizer, EntityLinker, KeyPhraseExtractor, SentimentAnalyzer, PIIDetector, TextTranslator, OCR, ImageAnalyzer, TextEmbedder, Shaper, Conditional
- [x] 1.2 为每个 Skill 编写有意义的 `config_schema`（JSON Schema 格式），描述该 Skill 的可配置参数

## 2. 数据库 Seeding 机制

- [x] 2.1 创建 `backend/app/services/skill_seeder.py`，实现 `seed_builtin_skills(db: AsyncSession)` 函数：查询已有 built-in skill names，对比定义列表，仅插入缺失的 Skill
- [x] 2.2 在 `backend/app/main.py` 的 `lifespan` 函数中，在表创建之后调用 `seed_builtin_skills()`

## 3. API 保护（内置 Skill 不可删改）

- [x] 3.1 修改 `backend/app/api/skills.py` 的 `delete_skill` 端点：查询到 Skill 后检查 `is_builtin`，若为 True 则返回 HTTP 403 并附带错误信息 "Built-in skills cannot be deleted"
- [x] 3.2 修改 `backend/app/api/skills.py` 的 `update_skill` 端点：查询到 Skill 后检查 `is_builtin`，若为 True 则返回 HTTP 403 并附带错误信息 "Built-in skills cannot be modified"

## 4. 前端展示

- [x] 4.1 修改 `frontend/src/pages/SkillLibrary.tsx`：在页面加载时调用 `GET /api/v1/skills` 获取 Skill 列表并渲染到 Table 中
- [x] 4.2 内置 Skill 的 Actions 列禁用 Edit 和 Delete 按钮（根据 `is_builtin` 字段判断）

## 5. 测试

- [x] 5.1 编写 `backend/tests/test_skill_seeder.py`：测试首次 seeding 插入所有 Skill、重复 seeding 不产生重复、部分存在时仅补充缺失
- [x] 5.2 编写 `backend/tests/test_skills_api.py`：测试删除内置 Skill 返回 403、更新内置 Skill 返回 403、删除自定义 Skill 正常返回 204
