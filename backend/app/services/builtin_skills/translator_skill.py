"""Azure Translator built-in skill."""

from typing import Any

from app.services.builtin_skills.base import BaseBuiltinSkill


class TextTranslatorSkill(BaseBuiltinSkill):
    def execute(self, data: dict, config: dict, client: Any | None) -> dict:
        text = data.get("text", "")
        target_language = config.get("target_language", "en")
        source_language = config.get("source_language", "auto")

        params: dict[str, str] = {
            "api-version": "3.0",
            "to": target_language,
        }
        if source_language != "auto":
            params["from"] = source_language

        response = client.post(
            "/translator/text/v3.0/translate",
            params=params,
            json=[{"text": text}],
        )
        response.raise_for_status()
        result = response.json()

        if result and len(result) > 0:
            translation = result[0]
            translations = translation.get("translations", [])
            detected = translation.get("detectedLanguage", {})
            if translations:
                return {
                    "translatedText": translations[0]["text"],
                    "targetLanguage": translations[0].get("to", target_language),
                    "sourceLanguage": detected.get("language", source_language),
                }

        return {
            "translatedText": text,
            "targetLanguage": target_language,
            "sourceLanguage": source_language,
        }
