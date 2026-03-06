## 1. Database & Model

- [x] 1.1 Update `backend/app/models/skill.py`: add `unique=True` to `name` column
- [x] 1.2 Update Alembic init migration (`alembic/versions/d750dfb7d5f0_init_tables.py`) to include unique constraint on `skills.name`
- [x] 1.3 Delete local SQLite DB and re-run `alembic upgrade head` to verify migration

## 2. Backend Schema & API

- [x] 2.1 Remove `name` field from `SkillUpdate` schema in `backend/app/schemas/skill.py`
- [x] 2.2 Add duplicate name check in `create_skill` handler (`backend/app/api/skills.py`): query by name, return 409 if exists
- [x] 2.3 Add IntegrityError catch in `create_skill` as fallback for concurrent writes, return 409

## 3. Backend Tests

- [x] 3.1 Add test: creating a skill with duplicate name returns 409
- [x] 3.2 Add test: updating a skill does not accept name field (name unchanged after PUT)
- [x] 3.3 Verify existing tests pass with schema changes (run `pytest tests/ -v`)

## 4. Frontend - Skill Editor

- [x] 4.1 In SkillEditor edit mode: set name input field to `disabled`
- [x] 4.2 In SkillEditor edit mode: exclude `name` from PUT request body

## 5. Frontend - Skill Library Create Form

- [x] 5.1 Handle 409 response in create skill flow: show `message.error("Skill with name 'xxx' already exists")`
- [x] 5.2 Keep form open on 409 error so user can modify name and retry

## 6. Verification

- [x] 6.1 Run backend checks: `ruff check .`, `ruff format --check .`, `pytest tests/ -v`
- [x] 6.2 Run frontend checks: `npx tsc -b`, `npm run build`
