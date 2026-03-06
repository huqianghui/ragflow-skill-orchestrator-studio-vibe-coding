"""Azure AI Language built-in skills (Foundry Tools)."""

from typing import Any

from app.services.builtin_skills.base import BaseBuiltinSkill


def _call_language_api(client: Any, kind: str, text: str, params: dict) -> dict:
    """Call Azure AI Language :analyze-text endpoint."""
    response = client.post(
        "/language/:analyze-text",
        params={"api-version": "2023-04-01"},
        json={
            "kind": kind,
            "parameters": params,
            "analysisInput": {
                "documents": [{"id": "1", "text": text, "language": "en"}],
            },
        },
    )
    response.raise_for_status()
    return response.json()


class EntityRecognizerSkill(BaseBuiltinSkill):
    def execute(self, data: dict, config: dict, client: Any | None) -> dict:
        text = data.get("text", "")
        categories = config.get(
            "entity_categories",
            ["Person", "Location", "Organization", "DateTime", "Quantity"],
        )
        min_confidence = config.get("min_confidence", 0.6)

        result = _call_language_api(
            client,
            "EntityRecognition",
            text,
            {"modelVersion": config.get("model_version", "latest")},
        )

        entities = []
        for doc in result.get("results", {}).get("documents", []):
            for entity in doc.get("entities", []):
                if entity["category"] in categories and entity["confidenceScore"] >= min_confidence:
                    entities.append(
                        {
                            "text": entity["text"],
                            "category": entity["category"],
                            "subcategory": entity.get("subcategory"),
                            "confidence": entity["confidenceScore"],
                            "offset": entity["offset"],
                            "length": entity["length"],
                        }
                    )
        return {"entities": entities}


class EntityLinkerSkill(BaseBuiltinSkill):
    def execute(self, data: dict, config: dict, client: Any | None) -> dict:
        text = data.get("text", "")
        min_confidence = config.get("min_confidence", 0.5)

        result = _call_language_api(client, "EntityLinking", text, {"modelVersion": "latest"})

        entities = []
        for doc in result.get("results", {}).get("documents", []):
            for entity in doc.get("entities", []):
                if entity.get("bingId"):
                    for match in entity.get("matches", []):
                        if match["confidenceScore"] >= min_confidence:
                            entities.append(
                                {
                                    "name": entity["name"],
                                    "url": entity.get("url", ""),
                                    "data_source": entity.get("dataSource", ""),
                                    "text": match["text"],
                                    "confidence": match["confidenceScore"],
                                }
                            )
        return {"entities": entities}


class KeyPhraseExtractorSkill(BaseBuiltinSkill):
    def execute(self, data: dict, config: dict, client: Any | None) -> dict:
        text = data.get("text", "")
        max_phrases = config.get("max_phrases", 10)

        result = _call_language_api(client, "KeyPhraseExtraction", text, {"modelVersion": "latest"})

        key_phrases = []
        for doc in result.get("results", {}).get("documents", []):
            key_phrases.extend(doc.get("keyPhrases", []))

        return {"keyPhrases": key_phrases[:max_phrases]}


class SentimentAnalyzerSkill(BaseBuiltinSkill):
    def execute(self, data: dict, config: dict, client: Any | None) -> dict:
        text = data.get("text", "")
        include_opinions = config.get("include_opinion_mining", False)

        result = _call_language_api(
            client,
            "SentimentAnalysis",
            text,
            {"modelVersion": "latest", "opinionMining": include_opinions},
        )

        for doc in result.get("results", {}).get("documents", []):
            return {
                "sentiment": doc.get("sentiment", "neutral"),
                "confidenceScores": doc.get("confidenceScores", {}),
                "sentences": [
                    {
                        "text": s["text"],
                        "sentiment": s["sentiment"],
                        "confidenceScores": s["confidenceScores"],
                    }
                    for s in doc.get("sentences", [])
                ],
            }
        return {"sentiment": "neutral", "confidenceScores": {}, "sentences": []}


class PIIDetectorSkill(BaseBuiltinSkill):
    def execute(self, data: dict, config: dict, client: Any | None) -> dict:
        text = data.get("text", "")
        categories = config.get(
            "pii_categories",
            ["Name", "IDNumber", "PhoneNumber", "Email", "Address"],
        )
        redaction_mode = config.get("redaction_mode", "mask")

        result = _call_language_api(
            client,
            "PiiEntityRecognition",
            text,
            {
                "modelVersion": "latest",
                "piiCategories": categories,
            },
        )

        entities = []
        redacted_text = text
        for doc in result.get("results", {}).get("documents", []):
            redacted_text = doc.get("redactedText", text)
            for entity in doc.get("entities", []):
                entities.append(
                    {
                        "text": entity["text"],
                        "category": entity["category"],
                        "confidence": entity["confidenceScore"],
                    }
                )

        output = {"entities": entities}
        if redaction_mode == "mask":
            output["redactedText"] = redacted_text
        return output


class LanguageDetectorSkill(BaseBuiltinSkill):
    def execute(self, data: dict, config: dict, client: Any | None) -> dict:
        text = data.get("text", "")
        default_language = config.get("default_language", "en")
        min_confidence = config.get("min_confidence", 0.5)

        result = _call_language_api(client, "LanguageDetection", text, {"modelVersion": "latest"})

        for doc in result.get("results", {}).get("documents", []):
            detected = doc.get("detectedLanguage", {})
            confidence = detected.get("confidenceScore", 0)
            if confidence >= min_confidence:
                return {
                    "languageCode": detected.get("iso6391Name", default_language),
                    "languageName": detected.get("name", "Unknown"),
                    "confidence": confidence,
                }

        return {
            "languageCode": default_language,
            "languageName": "Unknown",
            "confidence": 0,
        }
