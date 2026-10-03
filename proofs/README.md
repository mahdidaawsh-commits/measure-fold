# Verified StudioNet rounds

The same `MeasureFold` instance deployed at `0x2516E6d7F49e8125A026874A4291a0858689d1bC` on gasless GenLayer StudioNet (chain 61999). The [deployment manifest](deployment.json) records the fixed [report-source commit](https://github.com/mahdidaawsh-commits/measure-fold/tree/227401f77483dba2ee346354e1f4f4d58f1129a0/reports), deployed-source byte match, SHA-256, and [deployment transaction](https://explorer-studio.genlayer.com/tx/0x16ddfc747419579a4599107df2038bc42b11f8a55047ff4273a9b6eafdd672a6). The three writes finalized with successful execution and `MAJORITY_AGREE`. The CLI proof runner checked every source against the immutable Git bytes, then compared each round's complete onchain report and outcome to expected normalized values.

| Date and case | Onchain result | Transaction | Full receipt and votes |
| --- | --- | --- | --- |
| [2026-10-03](round-0.json): mixed units, extreme outlier | READY; median 12 mm; source 4 excluded | [tx](https://explorer-studio.genlayer.com/tx/0xb7c8a43c22ea040f9e6eaee7cb61708e6a820179487aee846f48a44953dea209) | [receipt](round-0-write-receipt.json) — 3 agree, 2 idle |
| [2026-10-04](round-1.json): one report lacks target station | INSUFFICIENT; 2 matching readings; no median | [tx](https://explorer-studio.genlayer.com/tx/0x808b41cb0a01fcd843c82c3fc879d092eb887f8e28603167dc89cc2abb2099cc) | [receipt](round-1-write-receipt.json) — 3 agree, 1 disagree, 1 idle |
| [2026-10-05](round-2.json): three exactly equivalent units | READY; median 10.16 mm | [tx](https://explorer-studio.genlayer.com/tx/0x3487cdc1800f4ec6cebcf88a227b905d0c35219672972611f4a6c8621ce84af3) | [receipt](round-2-write-receipt.json) — 3 agree, 1 disagree, 1 idle |

These are majority outcomes, not unanimous inference. Each receipt preserves all validator votes. Every manifest includes the source manifest, raw semantic decisions, exact normalized nanometre values, onchain state, and transaction hash. The notices are synthetic; these executions prove source acquisition, consensus and onchain median logic, not real rainfall or independently operated sensors. StudioNet is a hosted development network, not Bradbury public testnet.
