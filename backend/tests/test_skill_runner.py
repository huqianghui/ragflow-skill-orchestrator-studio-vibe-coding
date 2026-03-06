import pytest

from app.services.skill_context import ContextLogger, SkillContext
from app.services.skill_runner import SkillRunner


def test_compile_module_valid():
    runner = SkillRunner()
    module = runner.compile_module("def process(data, context):\n    return {'echo': data}")
    assert hasattr(module, "process")


def test_compile_module_missing_process():
    runner = SkillRunner()
    with pytest.raises(ValueError, match="must define a 'process"):
        runner.compile_module("def not_process(data):\n    pass")


def test_execute_simple():
    runner = SkillRunner()
    context = SkillContext(config={}, connections={})
    result = runner.execute(
        source_code="def process(data, context):\n    return {'upper': data['text'].upper()}",
        test_input={
            "values": [
                {"recordId": "1", "data": {"text": "hello"}},
                {"recordId": "2", "data": {"text": "world"}},
            ]
        },
        context=context,
    )
    assert len(result["values"]) == 2
    assert result["values"][0]["data"]["upper"] == "HELLO"
    assert result["values"][1]["data"]["upper"] == "WORLD"
    assert result["values"][0]["errors"] == []
    assert "execution_time_ms" in result


def test_execute_with_error():
    runner = SkillRunner()
    context = SkillContext(config={}, connections={})
    result = runner.execute(
        source_code="def process(data, context):\n    raise ValueError('boom')",
        test_input={"values": [{"recordId": "1", "data": {}}]},
        context=context,
    )
    assert len(result["values"]) == 1
    assert result["values"][0]["errors"][0]["message"] == "boom"
    assert "traceback" in result["values"][0]["errors"][0]


def test_execute_partial_error():
    """One record fails, others succeed."""
    runner = SkillRunner()
    context = SkillContext(config={}, connections={})
    code = (
        "def process(data, context):\n"
        "    if data.get('fail'):\n"
        "        raise RuntimeError('failed')\n"
        "    return {'ok': True}\n"
    )
    result = runner.execute(
        source_code=code,
        test_input={
            "values": [
                {"recordId": "1", "data": {"fail": False}},
                {"recordId": "2", "data": {"fail": True}},
                {"recordId": "3", "data": {"fail": False}},
            ]
        },
        context=context,
    )
    assert result["values"][0]["data"] == {"ok": True}
    assert len(result["values"][1]["errors"]) == 1
    assert result["values"][2]["data"] == {"ok": True}


def test_execute_uses_preloaded_imports():
    """User code can use preloaded standard library modules."""
    runner = SkillRunner()
    context = SkillContext(config={}, connections={})
    code = (
        "def process(data, context):\n"
        "    return {'hash': hashlib.md5(data['text'].encode()).hexdigest()}\n"
    )
    result = runner.execute(
        source_code=code,
        test_input={"values": [{"recordId": "1", "data": {"text": "test"}}]},
        context=context,
    )
    assert result["values"][0]["errors"] == []
    assert len(result["values"][0]["data"]["hash"]) == 32


def test_execute_with_logger():
    runner = SkillRunner()
    context = SkillContext(config={}, connections={})
    code = (
        "def process(data, context):\n"
        "    context.logger.info('processing', key=data.get('key'))\n"
        "    return {'done': True}\n"
    )
    result = runner.execute(
        source_code=code,
        test_input={"values": [{"recordId": "1", "data": {"key": "val"}}]},
        context=context,
    )
    assert len(result["logs"]) == 1
    assert result["logs"][0]["level"] == "INFO"
    assert result["logs"][0]["message"] == "processing"


def test_context_logger():
    logger = ContextLogger()
    logger.info("hello")
    logger.warning("warn", detail="x")
    logger.error("err")
    assert len(logger.entries) == 3
    assert logger.entries[0]["level"] == "INFO"
    assert logger.entries[1]["level"] == "WARNING"
    assert logger.entries[2]["level"] == "ERROR"


def test_context_get_client_not_found():
    context = SkillContext(config={}, connections={})
    with pytest.raises(ValueError, match="Connection 'missing' not found"):
        context.get_client("missing")


def test_execute_auto_record_id():
    """Records without recordId get auto-generated IDs."""
    runner = SkillRunner()
    context = SkillContext(config={}, connections={})
    result = runner.execute(
        source_code="def process(data, context):\n    return data",
        test_input={"values": [{"data": {"x": 1}}, {"data": {"x": 2}}]},
        context=context,
    )
    assert result["values"][0]["recordId"] == "record_0"
    assert result["values"][1]["recordId"] == "record_1"
