import hashlib
import json
import os
from pathlib import Path
import pytest


ROOT = Path(__file__).resolve().parents[2]
REPO = "example/measure-fold"
REV = "a" * 40
FILES = {
    "2026-10-03": ["gauge-a.md", "gauge-b.md", "gauge-c.md", "gauge-d.md"],
    "2026-10-04": ["gauge-a.md", "gauge-b.md", "gauge-c.md"],
    "2026-10-05": ["gauge-a.md", "gauge-b.md", "gauge-c.md"],
}
VALUES = {
    "2026-10-03": [("12", "mm"), ("1.2", "cm"), ("0.5", "in"), ("180", "mm")],
    "2026-10-04": [("0.0", "mm"), None, ("0.0", "cm")],
    "2026-10-05": [("10.16", "mm"), ("1.016", "cm"), ("0.4", "in")],
}
DOCS = {date: [(ROOT / "reports" / date / file).read_text(encoding="utf-8") for file in files] for date, files in FILES.items()}


@pytest.fixture
def direct_deploy(direct_deploy):
    def deploy(*args, **kwargs):
        return direct_deploy(*args, sdk_version="v0.2.16", **kwargs)
    return deploy


@pytest.fixture(autouse=True)
def windows_stdin_sharing_workaround(monkeypatch):
    if os.name != "nt":
        yield
        return
    from gltest.direct import loader
    original = loader._inject_message_to_fd0
    deferred = []

    def inject(vm):
        try:
            original(vm)
        except PermissionError as error:
            if error.winerror != 32:
                raise
            deferred.append(Path(error.filename))

    monkeypatch.setattr(loader, "_inject_message_to_fd0", inject)
    yield
    for file in deferred:
        try:
            file.unlink(missing_ok=True)
        except PermissionError:
            pass


def sources(date):
    return [
        {"id": file[:-3], "url": f"https://raw.githubusercontent.com/{REPO}/{REV}/reports/{date}/{file}", "sha256": hashlib.sha256(DOCS[date][index].encode()).hexdigest()}
        for index, file in enumerate(FILES[date])
    ]


def answer(date):
    rows = []
    for index, value in enumerate(VALUES[date]):
        if value is None:
            rows.append({"index": index, "decision": "MISSING", "value": "", "unit": "", "quote": ""})
        else:
            rows.append({"index": index, "decision": "MEASURED", "value": value[0], "unit": value[1], "quote": DOCS[date][index].strip()})
    return {"sources": rows}


def mock_day(vm, date, report=None, verdict=None, changed=None):
    vm.clear_mocks()
    for index, source in enumerate(sources(date)):
        document = changed if changed is not None and index == 0 else DOCS[date][index]
        vm.mock_web(source["url"].replace(".", r"\."), {"status": 200, "body": document})
    vm.mock_llm(r".*MEASUREFOLD-EXTRACT.*", json.dumps(report if report is not None else answer(date)))
    vm.mock_llm(r".*MEASUREFOLD-VERIFY.*", json.dumps({"valid": verdict if verdict is not None else [True] * len(FILES[date])}))


@pytest.fixture
def fold(direct_deploy):
    return direct_deploy(str(ROOT / "contracts/measure_fold.py"), REPO, "Harbor Basin")
