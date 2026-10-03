const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const crypto = require('node:crypto');

const root = path.resolve(__dirname, '..');
const cli = process.env.GENLAYER_CLI_PATH;
const passwordFile = process.env.MEASUREFOLD_PASSWORD_FILE;
const account = process.env.MEASUREFOLD_ACCOUNT;
const address = process.env.MEASUREFOLD_DEPLOYER_ADDRESS;
if (!cli || !fs.existsSync(cli) || !passwordFile || !fs.existsSync(passwordFile) || !account || !/^0x[0-9a-f]{40}$/i.test(address || '')) throw Error('Set GENLAYER_CLI_PATH, MEASUREFOLD_PASSWORD_FILE, MEASUREFOLD_ACCOUNT and MEASUREFOLD_DEPLOYER_ADDRESS.');
const password = fs.readFileSync(passwordFile, 'utf8').trim();
const hook = path.join(__dirname, 'cli-config.cjs');
const source = fs.readFileSync(path.join(root, 'contracts/measure_fold.py'));
const sourceHash = crypto.createHash('sha256').update(source).digest('hex');
const revision = '227401f77483dba2ee346354e1f4f4d58f1129a0';
const repo = 'mahdidaawsh-commits/measure-fold';
const journal = path.join(root, '.proof-journal/studionet');
const proofs = path.join(root, 'proofs');
fs.mkdirSync(journal, { recursive: true });
const cases = [
  { date: '2026-10-03', files: ['gauge-a.md', 'gauge-b.md', 'gauge-c.md', 'gauge-d.md'], status: 'READY', median: 12000000, measured: 4, inliers: 3, excluded: [3], values: [12000000, 12000000, 12700000, 180000000] },
  { date: '2026-10-04', files: ['gauge-a.md', 'gauge-b.md', 'gauge-c.md'], status: 'INSUFFICIENT', median: null, measured: 2, inliers: 0, excluded: [], values: [0, null, 0] },
  { date: '2026-10-05', files: ['gauge-a.md', 'gauge-b.md', 'gauge-c.md'], status: 'READY', median: 10160000, measured: 3, inliers: 3, excluded: [], values: [10160000, 10160000, 10160000] },
];

function sanitize(value) {
  if (Array.isArray(value)) return value.map(sanitize);
  if (!value || typeof value !== 'object') return value;
  const result = {};
  for (const [key, item] of Object.entries(value)) {
    if (key === 'node_config') continue;
    result[key] = /private.?key|api.?key|password|secret|authorization/i.test(key) ? 'REDACTED' : sanitize(item);
  }
  return result;
}
function save(name, value) { fs.writeFileSync(path.join(proofs, name + '.json'), JSON.stringify(sanitize(value), null, 2) + '\n'); }
function result(output) {
  const start = output.indexOf('Result:');
  if (start < 0) throw Error('CLI result missing: ' + output.slice(-300));
  return JSON.parse(output.slice(start + 7).trim());
}
function invoke(label, args, overrides = {}) {
  const file = path.join(journal, label + '.json');
  const prior = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
  if (prior.complete && (!['receipt', 'call'].includes(args[0]) || prior.stdout.includes('Result:'))) return Promise.resolve(prior.stdout);
  if (prior.hash && args[0] === 'write') return Promise.resolve('Write Transaction Hash: ' + prior.hash);
  if (prior.hash && args[0] === 'deploy') overrides.MEASUREFOLD_RESUME_HASH = prior.hash;
  console.log('RUN', label);
  return new Promise((resolve, reject) => {
    const child = cp.spawn(process.execPath, ['--require', hook, cli, ...args], {
      cwd: root, windowsHide: true,
      env: { ...process.env, NO_COLOR: '1', MEASUREFOLD_ACCOUNT: account, ...overrides },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    child.stdin.end(password + '\n');
    let stdout = '', stderr = '', hash = prior.hash;
    child.stdout.on('data', chunk => {
      stdout += chunk.toString();
      const found = stdout.match(/(?:Deployment|Write) Transaction Hash:\s*(0x[0-9a-f]{64})/i)?.[1];
      if (found && found !== hash) {
        hash = found;
        fs.writeFileSync(file, JSON.stringify({ hash, complete: false }));
        console.log('SUBMITTED', label, hash);
      }
    });
    child.stderr.on('data', chunk => { stderr += chunk.toString(); });
    child.on('error', reject);
    child.on('close', code => {
      fs.writeFileSync(file, JSON.stringify({ hash, complete: code === 0, stdout, stderr }));
      if (code) reject(Error(label + ': ' + stderr.slice(-1200)));
      else resolve(stdout);
    });
  });
}
async function receipt(label, hash) {
  const data = result(await invoke(label + '-receipt', ['receipt', hash, '--retries', '300', '--interval', '3000']));
  save(label + '-receipt', data);
  const status = data.statusName || data.status_name;
  const execution = data.txExecutionResultName || data.consensus_data?.leader_receipt?.[0]?.execution_result;
  if (status !== 'FINALIZED' || data.result_name !== 'MAJORITY_AGREE' || !['SUCCESS', 'FINISHED_WITH_RETURN'].includes(execution)) throw Error(label + ': ' + status + '/' + data.result_name + '/' + execution);
  console.log('FINALIZED', label, hash, execution);
  return data;
}
async function rpc(method, params) {
  const response = await fetch('https://studio.genlayer.com/api', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }), signal: AbortSignal.timeout(30000) });
  const data = await response.json();
  if (!response.ok || data.error) throw Error(JSON.stringify(data.error || response.status));
  return data.result;
}

(async () => {
  if (await rpc('eth_chainId', []) !== '0xf22f') throw Error('Unexpected chain ID');
  const accountInfo = await invoke('account', ['account', 'show', '--account', account]);
  if (!accountInfo.toLowerCase().includes(address.toLowerCase())) throw Error('Account mismatch');
  const allSources = [];
  for (const item of cases) {
    const sources = [];
    for (const file of item.files) {
      const url = `https://raw.githubusercontent.com/${repo}/${revision}/reports/${item.date}/${file}`;
      const body = fs.readFileSync(path.join(root, 'reports', item.date, file));
      const upstream = await fetch(url);
      if (!upstream.ok || !body.equals(Buffer.from(await upstream.arrayBuffer()))) throw Error('Published report differs: ' + item.date + '/' + file);
      sources.push({ id: file.slice(0, -3), url, sha256: crypto.createHash('sha256').update(body).digest('hex') });
    }
    allSources.push(sources);
  }
  const deployed = result(await invoke('main-deploy', ['deploy'], { MEASUREFOLD_SOURCE_REPO: repo, MEASUREFOLD_STATION: 'Harbor Basin' }));
  const contract = deployed['Contract Address'], deployHash = deployed['Transaction Hash'];
  await receipt('main-deploy', deployHash);
  for (let index = 0; index < cases.length; index++) {
    const item = cases[index], sources = allSources[index];
    const output = await invoke(`round-${index}-write`, ['write', contract, 'sample_day', '--args', item.date, JSON.stringify(sources)]);
    const hash = output.match(/Write Transaction Hash:\s*(0x[0-9a-f]{64})/i)?.[1];
    if (!hash) throw Error('Missing write hash: ' + item.date);
    await receipt(`round-${index}-write`, hash);
    const state = result(await invoke(`round-${index}-state`, ['call', contract, 'get_state']));
    const round = result(await invoke(`round-${index}-round`, ['call', contract, 'get_round', '--args', String(index)]));
    const outcome = round.outcome;
    if (state.round_count !== index + 1 || state.last_date !== item.date || outcome.status !== item.status || outcome.median_nm !== item.median || outcome.measured_count !== item.measured || outcome.inlier_count !== item.inliers || JSON.stringify(outcome.excluded_indexes) !== JSON.stringify(item.excluded) || JSON.stringify(round.report.sources.map(row => row.normalized_nm)) !== JSON.stringify(item.values)) throw Error('Unexpected onchain round: ' + item.date + ' ' + JSON.stringify({ outcome, state, report: round.report }));
    save(`round-${index}`, { network: 'studionet', chain_id: 61999, contract_address: contract, source_sha256: sourceHash, source_revision: revision, sources, transactions: [{ action: 'deploy', hash: deployHash }, { action: 'sample_day', hash }], state, round });
    console.log('VERIFIED', item.date, item.status, contract);
  }
  const codeOutput = await invoke('main-code', ['code', contract]);
  const start = codeOutput.indexOf('# { "Depends":');
  if (start < 0 || codeOutput.slice(start, start + source.length) !== source.toString()) throw Error('Deployed source mismatch');
  save('deployment', { network: 'studionet', chain_id: 61999, contract_address: contract, source_sha256: sourceHash, exact_source_match: true, source_revision: revision, deployment_transaction: deployHash });
  console.log('SOURCE VERIFIED', contract);
})().catch(error => { console.error(error.message); process.exitCode = 1; });
