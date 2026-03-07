"""Unit tests for the EnrichmentTree shared data store."""

import pytest

from app.services.pipeline.enrichment_tree import EnrichmentTree

# ------------------------------------------------------------------
# get / set basics
# ------------------------------------------------------------------


class TestGetSet:
    def test_set_and_get_simple(self):
        tree = EnrichmentTree()
        tree.set("/document/content", "hello world")
        assert tree.get("/document/content") == "hello world"

    def test_set_nested_dict(self):
        tree = EnrichmentTree()
        tree.set("/document/metadata/author", "Alice")
        assert tree.get("/document/metadata/author") == "Alice"
        assert tree.get("/document/metadata") == {"author": "Alice"}

    def test_get_missing_raises(self):
        tree = EnrichmentTree()
        with pytest.raises(KeyError):
            tree.get("/missing/path")

    def test_has_existing(self):
        tree = EnrichmentTree()
        tree.set("/document/content", "text")
        assert tree.has("/document/content") is True
        assert tree.has("/document/missing") is False

    def test_set_overwrites(self):
        tree = EnrichmentTree()
        tree.set("/document/content", "v1")
        tree.set("/document/content", "v2")
        assert tree.get("/document/content") == "v2"

    def test_set_root_raises(self):
        tree = EnrichmentTree()
        with pytest.raises(ValueError, match="root"):
            tree.set("", "bad")


# ------------------------------------------------------------------
# Array / list handling
# ------------------------------------------------------------------


class TestArrays:
    def test_set_array_element(self):
        tree = EnrichmentTree()
        tree.set("/document/chunks", [{"text": "a"}, {"text": "b"}])
        assert tree.get("/document/chunks/0/text") == "a"
        assert tree.get("/document/chunks/1/text") == "b"

    def test_set_nested_array_index(self):
        tree = EnrichmentTree()
        tree.set("/document/chunks", ["x", "y", "z"])
        assert tree.get("/document/chunks/1") == "y"

    def test_set_into_existing_array(self):
        tree = EnrichmentTree()
        tree.set("/document/chunks", [{"text": "a"}])
        tree.set("/document/chunks/0/embedding", [0.1, 0.2])
        assert tree.get("/document/chunks/0/embedding") == [0.1, 0.2]
        assert tree.get("/document/chunks/0/text") == "a"


# ------------------------------------------------------------------
# expand_context
# ------------------------------------------------------------------


class TestExpandContext:
    def test_no_wildcard(self):
        tree = EnrichmentTree()
        assert tree.expand_context("/document") == ["/document"]

    def test_wildcard_with_array(self):
        tree = EnrichmentTree()
        tree.set("/document/chunks", ["a", "b", "c"])
        result = tree.expand_context("/document/chunks/*")
        assert result == [
            "/document/chunks/0",
            "/document/chunks/1",
            "/document/chunks/2",
        ]

    def test_wildcard_empty_array(self):
        tree = EnrichmentTree()
        tree.set("/document/chunks", [])
        assert tree.expand_context("/document/chunks/*") == []

    def test_wildcard_missing_path(self):
        tree = EnrichmentTree()
        assert tree.expand_context("/document/missing/*") == []

    def test_wildcard_non_array(self):
        tree = EnrichmentTree()
        tree.set("/document/chunks", "not an array")
        assert tree.expand_context("/document/chunks/*") == ["/document/chunks"]


# ------------------------------------------------------------------
# resolve_source
# ------------------------------------------------------------------


class TestResolveSource:
    def test_with_wildcard(self):
        result = EnrichmentTree.resolve_source(
            source="/document/chunks/*/text",
            context_path="/document/chunks/*",
            instance_path="/document/chunks/2",
        )
        assert result == "/document/chunks/2/text"

    def test_cross_context_no_wildcard_in_source(self):
        result = EnrichmentTree.resolve_source(
            source="/document/content",
            context_path="/document/chunks/*",
            instance_path="/document/chunks/2",
        )
        assert result == "/document/content"

    def test_no_wildcard_context(self):
        result = EnrichmentTree.resolve_source(
            source="/document/content",
            context_path="/document",
            instance_path="/document",
        )
        assert result == "/document/content"

    def test_wildcard_index_0(self):
        result = EnrichmentTree.resolve_source(
            source="/document/chunks/*/embedding",
            context_path="/document/chunks/*",
            instance_path="/document/chunks/0",
        )
        assert result == "/document/chunks/0/embedding"


# ------------------------------------------------------------------
# to_dict / serialization
# ------------------------------------------------------------------


class TestToDict:
    def test_plain_copy(self):
        tree = EnrichmentTree()
        tree.set("/document/content", "hello")
        d = tree.to_dict()
        assert d == {"document": {"content": "hello"}}
        # Must be a deep copy
        d["document"]["content"] = "modified"
        assert tree.get("/document/content") == "hello"

    def test_exclude_binary(self):
        tree = EnrichmentTree()
        tree.set("/document/file_content", b"\x00\x01\x02" * 100)
        d = tree.to_dict(exclude_binary=True)
        assert d["document"]["file_content"] == "(binary, 300 bytes)"

    def test_exclude_large_embedding(self):
        tree = EnrichmentTree()
        embedding = [0.1] * 2000
        tree.set("/document/embedding", embedding)
        d = tree.to_dict(exclude_binary=True)
        result = d["document"]["embedding"]
        assert len(result) == 6  # 5 values + "...(2000 dims)"
        assert result[-1] == "...(2000 dims)"

    def test_small_array_not_truncated(self):
        tree = EnrichmentTree()
        tree.set("/document/items", [1, 2, 3])
        d = tree.to_dict(exclude_binary=True)
        assert d["document"]["items"] == [1, 2, 3]

    def test_nested_binary_excluded(self):
        tree = EnrichmentTree()
        tree.set("/document/chunks", [{"data": b"\xff\xfe"}])
        d = tree.to_dict(exclude_binary=True)
        assert d["document"]["chunks"][0]["data"] == "(binary, 2 bytes)"


# ------------------------------------------------------------------
# Edge cases
# ------------------------------------------------------------------


class TestEdgeCases:
    def test_deeply_nested(self):
        tree = EnrichmentTree()
        tree.set("/a/b/c/d/e", 42)
        assert tree.get("/a/b/c/d/e") == 42
        assert tree.get("/a") == {"b": {"c": {"d": {"e": 42}}}}

    def test_multiple_paths(self):
        tree = EnrichmentTree()
        tree.set("/document/content", "text")
        tree.set("/document/file_name", "test.pdf")
        tree.set("/document/metadata/pages", 5)
        d = tree.to_dict()
        assert d["document"]["content"] == "text"
        assert d["document"]["file_name"] == "test.pdf"
        assert d["document"]["metadata"]["pages"] == 5
