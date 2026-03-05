## ADDED Requirements

### Requirement: System SHALL seed built-in skills on startup

The system SHALL automatically insert a predefined set of built-in Skill records into the database during application startup, after database tables are created.

#### Scenario: First startup with empty database
- **WHEN** the application starts for the first time with no skills in the database
- **THEN** the system SHALL insert all 15 built-in Skill definitions into the `skills` table with `is_builtin = True`
- **AND** each skill SHALL have `name`, `description`, `skill_type = "builtin"`, `config_schema`, and `is_builtin = True` populated

#### Scenario: Subsequent startup with existing built-in skills
- **WHEN** the application starts and all 15 built-in skills already exist in the database
- **THEN** the system SHALL NOT create duplicate records
- **AND** the system SHALL NOT modify existing built-in skill records

#### Scenario: Startup with partial built-in skills
- **WHEN** the application starts and only some built-in skills exist (e.g., a new version adds more skills)
- **THEN** the system SHALL insert only the missing built-in skills
- **AND** the system SHALL NOT modify existing built-in skill records

### Requirement: Built-in skill definitions SHALL cover standard data processing categories

The system SHALL provide built-in skills in the following categories, aligned with Azure AI Search cognitive skills:

#### Scenario: Ingestion skills are available
- **WHEN** the system finishes startup seeding
- **THEN** the following ingestion skill SHALL exist: `DocumentCracker`

#### Scenario: Text processing skills are available
- **WHEN** the system finishes startup seeding
- **THEN** the following text processing skills SHALL exist: `TextSplitter`, `TextMerger`, `LanguageDetector`

#### Scenario: NLP skills are available
- **WHEN** the system finishes startup seeding
- **THEN** the following NLP skills SHALL exist: `EntityRecognizer`, `EntityLinker`, `KeyPhraseExtractor`, `SentimentAnalyzer`, `PIIDetector`, `TextTranslator`

#### Scenario: Vision skills are available
- **WHEN** the system finishes startup seeding
- **THEN** the following vision skills SHALL exist: `OCR`, `ImageAnalyzer`

#### Scenario: Embedding skills are available
- **WHEN** the system finishes startup seeding
- **THEN** the following embedding skill SHALL exist: `TextEmbedder`

#### Scenario: Utility skills are available
- **WHEN** the system finishes startup seeding
- **THEN** the following utility skills SHALL exist: `Shaper`, `Conditional`

### Requirement: Each built-in skill SHALL have a meaningful config_schema

Each built-in skill's `config_schema` SHALL be a valid JSON Schema object describing the configurable parameters for that skill.

#### Scenario: TextSplitter config schema
- **WHEN** the `TextSplitter` skill is queried
- **THEN** its `config_schema` SHALL include properties for `chunk_size` (integer), `chunk_overlap` (integer), and `split_method` (string enum)

#### Scenario: TextEmbedder config schema
- **WHEN** the `TextEmbedder` skill is queried
- **THEN** its `config_schema` SHALL include properties for `model_name` (string) and `dimensions` (integer)
