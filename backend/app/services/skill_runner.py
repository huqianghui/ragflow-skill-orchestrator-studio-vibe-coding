import time
import traceback
import types
from typing import Any

from app.services.skill_context import SkillContext

PRELOADED_IMPORTS = """\
import re
import json
import math
import csv
import io
import base64
import hashlib
import urllib.parse
import logging
from datetime import datetime, timedelta, timezone
from typing import Dict, Any, Optional, List, Tuple
from collections import Counter, defaultdict, OrderedDict
"""


class SkillRunner:
    """Executes python_code type Skills."""

    def compile_module(self, source_code: str) -> types.ModuleType:
        """Compile preloaded imports + user code into a callable module."""
        full_code = PRELOADED_IMPORTS + "\n" + source_code
        module = types.ModuleType("user_skill")
        exec(compile(full_code, "<skill>", "exec"), module.__dict__)  # noqa: S102
        if not hasattr(module, "process"):
            raise ValueError("Skill code must define a 'process(data, context)' function")
        return module

    def execute(
        self,
        source_code: str,
        test_input: dict,
        context: SkillContext,
    ) -> dict:
        """Execute skill code against test input, return structured results."""
        start_time = time.time()

        module = self.compile_module(source_code)
        process_fn = module.process

        values = test_input.get("values", [])
        results: list[dict[str, Any]] = []

        for index, record in enumerate(values):
            record_id = record.get("recordId", f"record_{index}")
            data = record.get("data", {})
            try:
                output = process_fn(data, context)
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
            "logs": context.logger.entries,
            "execution_time_ms": elapsed_ms,
        }
