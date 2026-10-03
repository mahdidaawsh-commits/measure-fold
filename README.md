# MeasureFold

MeasureFold is a GenLayer primitive for building a unit-aware, robust median from independently checked prose measurements. It is a repeated-round oracle, distinct from an auction, a release checklist, or a disruption timeline.

For each new date, a caller submits 3–5 SHA-256 commitments and commit-pinned report URLs within the chosen source repository. The leader fetches full report bytes and extracts a daily observed rainfall value for one fixed station, or `MISSING` when a report has no matching value. Validators fetch and hash the same bytes and independently assess each positive and negative extraction against the entire source. Only after consensus does deterministic arithmetic convert `mm`, `cm`, and `in` to integer nanometres, exclude extreme outliers, and compute a median when at least three inliers remain. Outcomes and source-linked interpretations are appended to onchain history; dates strictly increase.

The supplied ten source reports are **synthetic**. Three live rounds demonstrate mixed-unit agreement with an excluded outlier, insufficient matching sources, and exact agreement across three unit spellings. They test the primitive; they are not actual gauge readings or a claim that the station exists. The source repository identifies a chosen publisher, not independently operated physical sensors. A production deployer must choose credible, independently governed feeds and address source collusion separately.

## Median rule

Decimal source values have at most three fractional digits. Conversion is integer-only: 1 mm = 1,000,000 nm, 1 cm = 10,000,000 nm, and 1 in = 25,400,000 nm. From at least three matching values, take the lower median as a seed. Exclude a value when its absolute deviation exceeds the larger of 5 mm and twice the seed. Recompute the lower median from inliers. Fewer than three inliers yields `INSUFFICIENT` and no median. The threshold never changes a validator's semantic acceptance decision; validators check exact source values and units before this deterministic rule runs.

## Interface

| Method | Effect |
| --- | --- |
| `constructor(source_repo, station)` | Fix source boundary and station |
| `sample_day(date, sources_json)` | Fetch, verify, classify and aggregate one later date |
| `get_latest()` | Read newest source-linked round |
| `get_round(index)` | Read a historical round |
| `get_state()` | Read fixed configuration and round count |

See [consensus design](docs/design.md), [tests](tests/direct/test_fold.py), and [live StudioNet proofs](proofs/README.md). A failed fetch, hash mismatch, malformed extraction, or validator disagreement leaves the previous round state unchanged. The bounded 12-round history does not automatically poll feeds or settle money.

## Reproduce

```sh
pip install -r requirements.txt
genvm-lint download --version v0.2.16
genvm-lint check contracts/measure_fold.py --json
pytest tests/direct/ -q
```

`deploy/00_measure_fold.js` supports CLI deployment with `MEASUREFOLD_SOURCE_REPO` and `MEASUREFOLD_STATION`. The `Depends` header pins a concrete GenVM runner. StudioNet deployment and write receipts were checked for finality, successful execution, validator majority, and matching onchain state.
