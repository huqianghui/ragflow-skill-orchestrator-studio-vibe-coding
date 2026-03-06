"""Azure OpenAI built-in skills (TextEmbedder and GenAIPrompt)."""

from typing import Any

from app.services.builtin_skills.base import BaseBuiltinSkill


class TextEmbedderSkill(BaseBuiltinSkill):
    def execute(self, data: dict, config: dict, client: Any | None) -> dict:
        text = data.get("text", "")
        model = config.get("model_name", "text-embedding-ada-002")
        dimensions = config.get("dimensions")

        kwargs: dict[str, Any] = {"model": model, "input": text}
        if dimensions:
            kwargs["dimensions"] = dimensions

        response = client.embeddings.create(**kwargs)
        embedding = response.data[0].embedding

        return {
            "embedding": embedding,
            "model": response.model,
            "dimensions": len(embedding),
        }


class GenAIPromptSkill(BaseBuiltinSkill):
    def execute(self, data: dict, config: dict, client: Any | None) -> dict:
        text = data.get("text", "")
        system_prompt = config.get("system_prompt", "You are a helpful assistant.")
        user_template = config.get("user_prompt_template", "Process the following text:\n\n{text}")
        model = config.get("model_deployment", "gpt-4o")
        temperature = config.get("temperature", 0.7)
        max_tokens = config.get("max_tokens", 1024)

        user_message = user_template.replace("{text}", text)

        response = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message},
            ],
            temperature=temperature,
            max_tokens=max_tokens,
        )

        choice = response.choices[0]
        return {
            "output": choice.message.content,
            "model": response.model,
            "usage": {
                "prompt_tokens": response.usage.prompt_tokens,
                "completion_tokens": response.usage.completion_tokens,
                "total_tokens": response.usage.total_tokens,
            },
        }
