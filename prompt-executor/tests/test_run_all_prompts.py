from pathlib import Path
from unittest.mock import MagicMock, patch

from prompt_executor import (
    run_all_prompts,
    collect_pending_items,
    is_done,
    is_reference_file,
    mark_file_done,
    try_mark_ancestors_done,
    is_dir_fully_complete,
    get_pending_files_in_dir,
    has_done_files_in_dir,
    resolve_target_folder,
    safe_sleep,
    RESULT_SUCCESS,
    RESULT_ERROR,
    RESULT_FATAL,
    PromptResult,
)


class TestIsDone:
    def test_done(self):
        assert is_done("task_done") is True

    def test_not_done(self):
        assert is_done("task") is False


class TestIsReferenceFile:
    def test_overview(self):
        assert is_reference_file(Path("01-overview.md")) is True

    def test_readme(self):
        assert is_reference_file(Path("README.md")) is True

    def test_toc(self):
        assert is_reference_file(Path("table-of-contents.md")) is True

    def test_normal(self):
        assert is_reference_file(Path("01-task.md")) is False

    def test_done_still_reference(self):
        assert is_reference_file(Path("overview_done.md")) is True


class TestCollectPendingItems:
    def test_finds_md_files(self, tmp_path):
        (tmp_path / "01-a.md").write_text("task a")
        (tmp_path / "02-b.md").write_text("task b")
        items = collect_pending_items(tmp_path)
        assert len(items) == 2

    def test_skips_done(self, tmp_path):
        (tmp_path / "01-a.md").write_text("task a")
        (tmp_path / "02-b_done.md").write_text("done")
        items = collect_pending_items(tmp_path)
        assert len(items) == 1

    def test_skips_hidden(self, tmp_path):
        (tmp_path / ".hidden.md").write_text("hidden")
        (tmp_path / "01-visible.md").write_text("visible")
        items = collect_pending_items(tmp_path)
        assert len(items) == 1

    def test_skips_reference(self, tmp_path):
        (tmp_path / "01-overview.md").write_text("overview")
        (tmp_path / "02-task.md").write_text("task")
        items = collect_pending_items(tmp_path)
        assert len(items) == 1

    def test_skips_empty(self, tmp_path):
        (tmp_path / "01-empty.md").write_text("")
        (tmp_path / "02-full.md").write_text("content")
        items = collect_pending_items(tmp_path)
        assert len(items) == 1

    def test_recursive(self, tmp_path):
        sub = tmp_path / "sub"
        sub.mkdir()
        (tmp_path / "01-top.md").write_text("top")
        (sub / "02-nested.md").write_text("nested")
        items = collect_pending_items(tmp_path)
        assert len(items) == 2

    def test_skips_done_folders(self, tmp_path):
        done_dir = tmp_path / "completed_done"
        done_dir.mkdir()
        (done_dir / "01-task.md").write_text("done task")
        (tmp_path / "01-active.md").write_text("active")
        items = collect_pending_items(tmp_path)
        assert len(items) == 1

    def test_nonexistent_dir(self, tmp_path):
        items = collect_pending_items(tmp_path / "nope")
        assert items == []

    def test_unreadable_file_skipped(self, tmp_path):
        f = tmp_path / "01-bad.md"
        f.write_text("content")
        with patch.object(Path, "read_text", side_effect=OSError("nope")):
            items = collect_pending_items(tmp_path)
        assert items == []

    def test_sorted_order(self, tmp_path):
        (tmp_path / "03-c.md").write_text("c")
        (tmp_path / "01-a.md").write_text("a")
        (tmp_path / "02-b.md").write_text("b")
        items = collect_pending_items(tmp_path)
        assert [p.name for p in items] == ["01-a.md", "02-b.md", "03-c.md"]


class TestGetPendingFilesInDir:
    def test_returns_pending(self, tmp_path):
        (tmp_path / "01-a.md").write_text("a")
        (tmp_path / "02-b_done.md").write_text("b")
        result = get_pending_files_in_dir(tmp_path)
        assert len(result) == 1

    def test_nonexistent(self, tmp_path):
        assert get_pending_files_in_dir(tmp_path / "nope") == []


class TestHasDoneFilesInDir:
    def test_has_done(self, tmp_path):
        (tmp_path / "01-a_done.md").write_text("done")
        assert has_done_files_in_dir(tmp_path) is True

    def test_no_done(self, tmp_path):
        (tmp_path / "01-a.md").write_text("active")
        assert has_done_files_in_dir(tmp_path) is False


class TestIsDirFullyComplete:
    def test_complete(self, tmp_path):
        (tmp_path / "01-a_done.md").write_text("done")
        assert is_dir_fully_complete(tmp_path) is True

    def test_incomplete(self, tmp_path):
        (tmp_path / "01-a.md").write_text("active")
        assert is_dir_fully_complete(tmp_path) is False

    def test_subdir_done(self, tmp_path):
        d = tmp_path / "sub_done"
        d.mkdir()
        assert is_dir_fully_complete(tmp_path) is True

    def test_subdir_pending(self, tmp_path):
        d = tmp_path / "sub"
        d.mkdir()
        (d / "01-a.md").write_text("active")
        assert is_dir_fully_complete(tmp_path) is False


class TestMarkFileDone:
    def test_renames(self, tmp_path):
        f = tmp_path / "task.md"
        f.write_text("done")
        new = mark_file_done(f)
        assert new.name == "task_done.md"
        assert not f.exists()


class TestTryMarkAncestorsDone:
    def test_marks_complete_parent(self, tmp_path):
        sub = tmp_path / "sub"
        sub.mkdir()
        f = sub / "task_done.md"
        f.write_text("done")
        with patch("prompt_executor.LOG_FILE", tmp_path / "test.log"):
            try_mark_ancestors_done(f, tmp_path)

    def test_stops_at_incomplete(self, tmp_path):
        sub = tmp_path / "sub"
        sub.mkdir()
        f = sub / "task_done.md"
        f.write_text("done")
        (sub / "other.md").write_text("still pending")
        with patch("prompt_executor.LOG_FILE", tmp_path / "test.log"):
            try_mark_ancestors_done(f, tmp_path)
        assert sub.exists()


class TestResolveTargetFolder:
    def test_absolute(self, tmp_path, monkeypatch):
        d = tmp_path / "my-folder"
        d.mkdir()
        result = resolve_target_folder(str(d))
        assert result == d

    def test_nonexistent_exits(self, tmp_path, monkeypatch):
        import pytest

        with pytest.raises(SystemExit):
            resolve_target_folder(str(tmp_path / "nope"))

    def test_not_dir_exits(self, tmp_path, monkeypatch):
        import pytest

        f = tmp_path / "file.txt"
        f.write_text("hi")
        with pytest.raises(SystemExit):
            resolve_target_folder(str(f))


class TestSafeSleep:
    def test_zero_returns_immediately(self):
        safe_sleep(0)

    def test_sleeps_in_chunks(self):
        with patch("prompt_executor.time.sleep") as mock:
            safe_sleep(1)
            assert mock.call_count > 0


class TestRunAllPrompts:
    def test_no_pending(self, tmp_path, monkeypatch):
        target = tmp_path / "empty"
        target.mkdir()
        monkeypatch.setattr("prompt_executor.LOG_FILE", tmp_path / "test.log")
        with patch("prompt_executor.collect_pending_items", return_value=[]):
            run_all_prompts(target, 1, 1, 1, "glm-5.1", "opencode")

    def test_executes_all(self, tmp_path, monkeypatch):
        target = tmp_path / "target"
        target.mkdir()
        f1 = target / "01-a.md"
        f2 = target / "02-b.md"
        f1.write_text("a")
        f2.write_text("b")
        monkeypatch.setattr("prompt_executor.LOG_FILE", tmp_path / "test.log")
        with patch("prompt_executor.execute_prompt_with_retry") as mock:
            mock.return_value = (True, False)
            run_all_prompts(target, 0, 1, 1, "glm-5.1", "opencode")
        assert mock.call_count == 2

    def test_skips_failed(self, tmp_path, monkeypatch):
        target = tmp_path / "target"
        target.mkdir()
        f1 = target / "01-a.md"
        f1.write_text("a")
        f2 = target / "02-b.md"
        f2.write_text("b")
        monkeypatch.setattr("prompt_executor.LOG_FILE", tmp_path / "test.log")
        results = [(False, False), (True, False)]
        with patch("prompt_executor.execute_prompt_with_retry", side_effect=results):
            run_all_prompts(target, 0, 1, 1, "glm-5.1", "opencode")

    def test_fatal_stops(self, tmp_path, monkeypatch):
        target = tmp_path / "target"
        target.mkdir()
        f1 = target / "01-a.md"
        f1.write_text("a")
        monkeypatch.setattr("prompt_executor.LOG_FILE", tmp_path / "test.log")
        with patch(
            "prompt_executor.execute_prompt_with_retry", return_value=(False, True)
        ):
            run_all_prompts(target, 0, 1, 1, "glm-5.1", "opencode")

    def test_renames_done_folder(self, tmp_path, monkeypatch):
        target = tmp_path / "target"
        target.mkdir()
        f1 = target / "01-a.md"
        f1.write_text("a")
        monkeypatch.setattr("prompt_executor.LOG_FILE", tmp_path / "test.log")
        with (
            patch(
                "prompt_executor.execute_prompt_with_retry", return_value=(True, False)
            ),
            patch("prompt_executor.mark_file_done") as mock_mark,
            patch("prompt_executor.try_mark_ancestors_done"),
            patch("prompt_executor.is_dir_fully_complete", return_value=True),
            patch("prompt_executor.has_done_files_in_dir", return_value=True),
        ):
            mock_mark.return_value = target / "01-a_done.md"
            run_all_prompts(target, 0, 1, 1, "glm-5.1", "opencode")

    def test_rename_folder_oserror(self, tmp_path, monkeypatch):
        target = tmp_path / "target"
        target.mkdir()
        f1 = target / "01-a.md"
        f1.write_text("a")
        monkeypatch.setattr("prompt_executor.LOG_FILE", tmp_path / "test.log")
        with (
            patch(
                "prompt_executor.execute_prompt_with_retry", return_value=(True, False)
            ),
            patch("prompt_executor.mark_file_done") as mock_mark,
            patch("prompt_executor.try_mark_ancestors_done"),
            patch("prompt_executor.is_dir_fully_complete", return_value=True),
            patch("prompt_executor.has_done_files_in_dir", return_value=True),
            patch.object(Path, "rename", side_effect=OSError("nope")),
        ):
            mock_mark.return_value = target / "01-a_done.md"
            run_all_prompts(target, 0, 1, 1, "glm-5.1", "opencode")
