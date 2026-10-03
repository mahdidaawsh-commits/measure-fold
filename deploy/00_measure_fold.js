const fs = require('node:fs');
const path = require('node:path');

module.exports = async function deployMeasureFold(client) {
  const repo = process.env.MEASUREFOLD_SOURCE_REPO;
  const station = process.env.MEASUREFOLD_STATION;
  if (!repo || !station) throw Error('Set MEASUREFOLD_SOURCE_REPO and MEASUREFOLD_STATION.');
  const code = fs.readFileSync(path.join(__dirname, '../contracts/measure_fold.py'), 'utf8');
  const hash = process.env.MEASUREFOLD_RESUME_HASH || await client.deployContract({ code, args: [repo, station], leaderOnly: false });
  console.log('Deployment Transaction Hash:', hash);
  const receipt = await client.waitForTransactionReceipt({ hash, retries: 300, interval: 3000, status: 'FINALIZED' });
  const execution = receipt.consensus_data?.leader_receipt?.[0]?.execution_result ?? receipt.txExecutionResultName;
  if ((receipt.status_name || receipt.statusName || receipt.status) !== 'FINALIZED' || !['SUCCESS', 'FINISHED_WITH_RETURN'].includes(execution)) throw Error('Deployment failed: ' + execution);
  const address = receipt.data?.contract_address ?? receipt.txDataDecoded?.contractAddress;
  if (!/^0x[0-9a-f]{40}$/i.test(address || '')) throw Error('Deployment address missing.');
  console.log('Result:', { 'Transaction Hash': hash, 'Contract Address': address });
};
