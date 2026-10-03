Contribution type: Builder / Intelligent Contracts
Contribution date: 10/03/2026
Title: MeasureFold: Consensus unit-aware median oracle

Notes / Description:

MeasureFold is a repeated-round GenLayer oracle for prose measurement reports. For each later date, a caller supplies 3–5 commit-pinned report URLs and SHA-256 hashes within a fixed source repository. Leader and validators independently fetch complete texts; validators check exact station, date, observed value, unit and each MISSING decision, including decoy stations and forecasts. Only agreed readings enter integer conversion from mm/cm/in to nanometres, lower-median outlier filtering and a three-inlier quorum. The append-only result records source-linked extractions, exclusions, status and median. Gasless StudioNet proofs show mixed units with an excluded extreme outlier (12 mm), insufficient matching sources, and equivalent cross-unit readings (10.16 mm). Three MAJORITY_AGREE receipts match onchain reads. The repo includes a pinned GenVM contract and 15 direct tests. Synthetic reports demonstrate the mechanism, not physical-sensor truth.

Evidence:
- https://github.com/mahdidaawsh-commits/measure-fold
- https://github.com/mahdidaawsh-commits/measure-fold/blob/main/contracts/measure_fold.py
- https://github.com/mahdidaawsh-commits/measure-fold/blob/main/proofs/README.md
- https://github.com/mahdidaawsh-commits/measure-fold/blob/main/docs/design.md
