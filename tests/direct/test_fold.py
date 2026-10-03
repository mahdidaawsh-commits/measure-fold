import copy
import json
import pytest
from conftest import ROOT, REPO, DOCS, answer, mock_day, sources


def sample(fold, direct_vm, date):
    mock_day(direct_vm, date)
    fold.sample_day(date, json.dumps(sources(date)))


def test_mixed_units_outlier_and_quorum(fold, direct_vm):
    sample(fold, direct_vm, "2026-10-03")
    latest = fold.get_latest()
    assert latest["outcome"]["status"] == "READY"
    assert latest["outcome"]["median_nm"] == 12000000
    assert latest["outcome"]["measured_count"] == 4
    assert latest["outcome"]["inlier_count"] == 3
    assert latest["outcome"]["excluded_indexes"] == [3]
    assert [row["normalized_nm"] for row in latest["report"]["sources"]] == [12000000, 12000000, 12700000, 180000000]


def test_cli_parsed_source_array(fold, direct_vm):
    mock_day(direct_vm, "2026-10-03")
    fold.sample_day("2026-10-03", sources("2026-10-03"))
    assert fold.get_latest()["outcome"]["median_nm"] == 12000000


def test_missing_source_blocks_quorum_and_later_round_recovers(fold, direct_vm):
    sample(fold, direct_vm, "2026-10-03")
    sample(fold, direct_vm, "2026-10-04")
    assert fold.get_latest()["outcome"]["status"] == "INSUFFICIENT"
    assert fold.get_latest()["outcome"]["median_nm"] is None
    assert fold.get_latest()["outcome"]["measured_count"] == 2
    sample(fold, direct_vm, "2026-10-05")
    assert fold.get_latest()["outcome"]["status"] == "READY"
    assert fold.get_latest()["outcome"]["median_nm"] == 10160000
    assert fold.get_state()["round_count"] == 3
    assert fold.get_round(0)["outcome"]["median_nm"] == 12000000


def test_date_must_increase(fold, direct_vm):
    sample(fold, direct_vm, "2026-10-03")
    with direct_vm.expect_revert("later ISO date"):
        fold.sample_day("2026-10-03", json.dumps(sources("2026-10-03")))
    assert fold.get_state()["round_count"] == 1


def test_impossible_calendar_date_rejected(fold, direct_vm):
    with direct_vm.expect_revert("later ISO date"):
        fold.sample_day("2026-02-31", "[]")


def test_mutable_and_foreign_sources_rejected(fold, direct_vm):
    bad = sources("2026-10-03")
    bad[0]["url"] = bad[0]["url"].replace("/" + "a" * 40 + "/", "/main/")
    with direct_vm.expect_revert("commit-pinned"):
        fold.sample_day("2026-10-03", json.dumps(bad))
    bad = sources("2026-10-03")
    bad[0]["url"] = bad[0]["url"].replace(REPO, "attacker/measure-fold")
    with direct_vm.expect_revert("fixed repository"):
        fold.sample_day("2026-10-03", json.dumps(bad))


def test_hash_mismatch_rolls_back(fold, direct_vm):
    mock_day(direct_vm, "2026-10-03", changed=DOCS["2026-10-03"][0] + "changed")
    with direct_vm.expect_revert("hash or size mismatch"):
        fold.sample_day("2026-10-03", json.dumps(sources("2026-10-03")))
    assert fold.get_state()["round_count"] == 0


def test_fabricated_quote_rolls_back(fold, direct_vm):
    report = copy.deepcopy(answer("2026-10-03"))
    report["sources"][0]["quote"] = "Fabricated daily rainfall measurement."
    mock_day(direct_vm, "2026-10-03", report=report)
    with direct_vm.expect_revert("Unsupported measurement quote"):
        fold.sample_day("2026-10-03", json.dumps(sources("2026-10-03")))
    assert fold.get_state()["round_count"] == 0


def test_validator_independently_rechecks_sources(fold, direct_vm):
    sample(fold, direct_vm, "2026-10-03")
    assert direct_vm.run_validator() is True
    mock_day(direct_vm, "2026-10-03", verdict=[True, False, True, True])
    assert direct_vm.run_validator() is False


def test_validator_rejects_false_missing_decision(fold, direct_vm):
    sample(fold, direct_vm, "2026-10-04")
    mock_day(direct_vm, "2026-10-04", verdict=[True, False, True])
    assert direct_vm.run_validator() is False


def test_validator_rejects_changed_source(fold, direct_vm):
    sample(fold, direct_vm, "2026-10-03")
    mock_day(direct_vm, "2026-10-03", changed=DOCS["2026-10-03"][0] + "changed")
    assert direct_vm.run_validator() is False


def test_validator_rejects_forged_normalization(fold, direct_vm):
    sample(fold, direct_vm, "2026-10-03")
    report = copy.deepcopy(fold.get_latest()["report"])
    report["sources"][0]["normalized_nm"] = 999
    proposed = {"report": report, "source_hashes": [source["sha256"] for source in sources("2026-10-03")]}
    assert direct_vm.run_validator(leader_result=proposed) is False


@pytest.mark.parametrize("station", ["", "<script>", "x" * 41])
def test_invalid_station_rejected(direct_deploy, direct_vm, station):
    with direct_vm.expect_revert("Invalid station"):
        direct_deploy(str(ROOT / "contracts/measure_fold.py"), REPO, station)
