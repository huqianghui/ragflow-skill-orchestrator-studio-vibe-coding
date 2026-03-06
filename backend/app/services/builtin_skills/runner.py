"""BuiltinSkillRunner — dispatches to skill implementations."""

import time
import traceback
from typing import Any

from app.services.builtin_skills.base import BaseBuiltinSkill
from app.services.builtin_skills.doc_skills import DocumentCrackerSkill
from app.services.builtin_skills.language_skills import (
    EntityLinkerSkill,
    EntityRecognizerSkill,
    KeyPhraseExtractorSkill,
    LanguageDetectorSkill,
    PIIDetectorSkill,
    SentimentAnalyzerSkill,
)
from app.services.builtin_skills.openai_skills import (
    GenAIPromptSkill,
    TextEmbedderSkill,
)
from app.services.builtin_skills.translator_skill import TextTranslatorSkill
from app.services.builtin_skills.utility_skills import (
    ConditionalSkill,
    ShaperSkill,
    TextMergerSkill,
    TextSplitterSkill,
)
from app.services.builtin_skills.vision_skills import (
    ImageAnalyzerSkill,
    OCRSkill,
)

SKILL_REGISTRY: dict[str, type[BaseBuiltinSkill]] = {
    "DocumentCracker": DocumentCrackerSkill,
    "TextSplitter": TextSplitterSkill,
    "TextMerger": TextMergerSkill,
    "LanguageDetector": LanguageDetectorSkill,
    "EntityRecognizer": EntityRecognizerSkill,
    "EntityLinker": EntityLinkerSkill,
    "KeyPhraseExtractor": KeyPhraseExtractorSkill,
    "SentimentAnalyzer": SentimentAnalyzerSkill,
    "PIIDetector": PIIDetectorSkill,
    "TextTranslator": TextTranslatorSkill,
    "OCR": OCRSkill,
    "ImageAnalyzer": ImageAnalyzerSkill,
    "TextEmbedder": TextEmbedderSkill,
    "GenAIPrompt": GenAIPromptSkill,
    "Shaper": ShaperSkill,
    "Conditional": ConditionalSkill,
}


class BuiltinSkillRunner:
    """Executes built-in skills using registered implementations."""

    def execute(
        self,
        skill_name: str,
        test_input: dict,
        config: dict,
        client: Any | None,
    ) -> dict:
        """Execute a built-in skill against test input."""
        if skill_name not in SKILL_REGISTRY:
            raise ValueError(f"Unknown built-in skill: {skill_name}")

        impl = SKILL_REGISTRY[skill_name]()
        start_time = time.time()

        values = test_input.get("values", [])
        results: list[dict[str, Any]] = []

        for index, record in enumerate(values):
            record_id = record.get("recordId", f"record_{index}")
            data = record.get("data", {})
            try:
                output = impl.execute(data, config, client)
                results.append(
                    {
                        "recordId": record_id,
                        "data": output if isinstance(output, dict) else {"result": output},
                        "errors": [],
                        "warnings": [],
                    }
                )
            except Exception as e:
                results.append(
                    {
                        "recordId": record_id,
                        "data": {},
                        "errors": [
                            {
                                "message": str(e),
                                "traceback": traceback.format_exc(),
                            }
                        ],
                        "warnings": [],
                    }
                )

        elapsed_ms = int((time.time() - start_time) * 1000)
        return {
            "values": results,
            "logs": [],
            "execution_time_ms": elapsed_ms,
        }
