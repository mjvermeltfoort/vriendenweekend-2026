// Post a concise per-command cost report from Continue session usage or OpenAI API usage.
// No prompts, session histories, or credentials are included in GitHub comments.
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

function number(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}

function loadJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; }
}

// Standard text-token prices in USD per million tokens:
// [uncached input, cached input, output]. See https://developers.openai.com/api/docs/pricing
const MODEL_RATES = {
  'gpt-5': [1.25, 0.125, 10],
  'gpt-5.4-mini': [0.75, 0.075, 4.5],
  'gpt-6-luna': [0.10, 0.01, 0.50],
  'gpt-6-sol': [2.00, 0.20, 10.00],
  'gpt-4o-mini': [0.15, 0.075, 0.60],
};

function estimateCost(model, input, output, cached) {
  const rates = MODEL_RATES[model];
  if (!rates || input === null || output === null) {
    return { cost: null, costRange: null, cachedVerified: false };
  }
  const [inputRate, cacheRate, outputRate] = rates;
  const baseOutput = output * outputRate;
  const maxCost = (input * inputRate + baseOutput) / 1e6;
  const minCost = (input * cacheRate + baseOutput) / 1e6;
  // A zero cached count can mean no cache hits OR an integration that did not
  // expose OpenAI cache usage. Never present that as a precise dollar amount.
  if (cached === null || cached === 0) {
    return { cost: null, costRange: [minCost, maxCost], cachedVerified: false };
  }
  const validCached = Math.min(input, cached);
  const cost = ((input - validCached) * inputRate + validCached * cacheRate + baseOutput) / 1e6;
  return { cost, costRange: null, cachedVerified: true };
}

function collectContinueUsage(startedAt, cwd, home = process.env.CONTINUE_GLOBAL_DIR || path.join(os.homedir(), '.continue')) {
  const dir = path.join(home, 'sessions');
  if (!fs.existsSync(dir)) return null;
  const sessions = [];
  for (const name of fs.readdirSync(dir)) {
    if (!name.endsWith('.json') || name === 'sessions.json') continue;
    const file = path.join(dir, name);
    try {
      if (fs.statSync(file).mtimeMs + 1000 < startedAt) continue;
      const session = loadJson(file);
      if (!session || !session.usage || path.resolve(session.workspaceDirectory || '') !== path.resolve(cwd)) continue;
      sessions.push(session.usage);
    } catch { /* Ignore incomplete or unrelated session files. */ }
  }
  if (sessions.length === 0) return null;
  const sum = (getter) => sessions.reduce((total, usage) => total + (number(getter(usage)) || 0), 0);
  const hasTokens = sessions.some((usage) => number(usage.promptTokens) !== null || number(usage.completionTokens) !== null);
  const input = hasTokens ? sum((u) => u.promptTokens) : null;
  const output = hasTokens ? sum((u) => u.completionTokens) : null;
  const hasCacheUsage = sessions.some((u) => number(u.promptTokensDetails?.cachedTokens) !== null);
  const cached = hasCacheUsage ? sum((u) => u.promptTokensDetails?.cachedTokens) : null;
  // The workflow records which single-model Continue config it actually used.
  let model = null;
  try {
    const selection = path.join(process.env.RUNNER_TEMP || '/tmp', 'issue-bot-config-used');
    const configPath = fs.readFileSync(selection, 'utf8').trim();
    const config = fs.readFileSync(configPath, 'utf8');
    const models = [...config.matchAll(/^\s+model:\s*([\w.-]+)\s*$/gm)];
    if (models.length === 1) model = models[0][1];
  } catch {
    // Historical jobs used only the default config.
    try {
      const config = fs.readFileSync('.continue/config.yaml', 'utf8');
      const models = [...config.matchAll(/^\s+model:\s*([\w.-]+)\s*$/gm)];
      if (models.length === 1) model = models[0][1];
    } catch { /* Model unknown. */ }
  }
  // Continue's session.totalCost is an internal estimate, not an OpenAI charge.
  // It can disagree with the selected model's published price by a large factor.
  const pricing = estimateCost(model, input, output, cached);
  return { input, output, cached, ...pricing, model, source: 'Continue-tokens + OpenAI-standaardtarieven' };
}

function reviewUsage(filepath) {
  const record = loadJson(filepath);
  if (!record?.usage) return null;
  const u = record.usage;
  const input = number(u.prompt_tokens);
  const output = number(u.completion_tokens);
  if (input === null || output === null) return null;
  const cached = number(u.prompt_tokens_details?.cached_tokens) || 0;
  const model = /^gpt-4o-mini(?:-|$)/.test(record.model || '') ? 'gpt-4o-mini' : (record.model || '');
  const pricing = estimateCost(model, input, output, cached);
  return { input, output, cached, ...pricing, source: 'OpenAI API-tokens + standaardtarieven', model: record.model };
}

function usd(n) {
  return '$' + n.toFixed(6);
}
function count(n) {
  return new Intl.NumberFormat('nl-NL').format(n);
}

function formatReport(mode, usage, runUrl, status) {
  const lines = [
    '### Kostenrapport — /' + mode,
    '',
    '- Status: **' + status + '**',
  ];
  if (usage) {
    if (usage.model) lines.push('- Model: \`' + usage.model + '\`');
    if (usage.input !== null) lines.push('- Invoer: **' + count(usage.input) + ' tokens**');
    if (usage.output !== null) lines.push('- Uitvoer: **' + count(usage.output) + ' tokens**');
    if (usage.cachedVerified) {
      lines.push('- Gerapporteerde cached input: **' + count(usage.cached) + ' tokens**');
      lines.push('- Tariefberekening (incl. caching): **' + usd(usage.cost) + '**');
    } else if (usage.costRange) {
      lines.push('- Kostenindicatie bij onbekende cachekorting: **' +
        usd(usage.costRange[0]) + ' – ' + usd(usage.costRange[1]) + '**');
      lines.push('- Cachegebruik: **niet betrouwbaar vastgesteld**. De bovengrens rekent alle input als ongecachet.');
    } else {
      lines.push('- Kosten: **niet betrouwbaar te berekenen**');
    }
    lines.push('- Bron: ' + usage.source);
  } else {
    lines.push('- Tokens en kosten: **niet beschikbaar** (geen betrouwbare gebruiksstatistieken gevonden).');
  }
  lines.push('', 'Dit is geen factuur: OpenAI Platform is leidend voor werkelijk verbruik. Afwijkende verwerkingstarieven of lange context kunnen het berekende bereik veranderen. [GitHub Actions-run](' + runUrl + ').');
  return lines.join('\n');
}

async function main() {
  const comment = (process.env.COMMENT_BODY || '').trim();
  const matched = /^\/(think|solve|review)\b/i.exec(comment);
  if (!matched) return;
  const mode = matched[1].toLowerCase();
  const startFile = path.join(process.env.RUNNER_TEMP || '/tmp', 'issue-bot-usage-start');
  let startedAt = 0;
  try { startedAt = fs.statSync(startFile).mtimeMs; } catch { /* No marker: report unavailable. */ }
  const usage = mode === 'review'
    ? reviewUsage(path.join(process.env.RUNNER_TEMP || '/tmp', 'issue-bot-review-usage.json'))
    : (startedAt ? collectContinueUsage(startedAt, process.cwd()) : null);

  const outcome = mode === 'think' ? process.env.THINK_OUTCOME :
    mode === 'review' ? process.env.REVIEW_OUTCOME : process.env.SOLVE_OUTCOME;
  const verificationFailed = mode === 'solve' && process.env.VERIFY_OUTCOME === 'failure';
  const prFailed = mode === 'solve' && process.env.PR_OUTCOME === 'failure';
  const status = outcome === 'success' && !verificationFailed && !prFailed ? 'uitgevoerd' : 'mislukt of onderbroken';
  const repo = process.env.REPO;
  const issueNumber = process.env.ISSUE_NUMBER;
  const runUrl = 'https://github.com/' + repo + '/actions/runs/' + process.env.GITHUB_RUN_ID;
  let body = formatReport(mode, usage, runUrl, status);
  if (verificationFailed) {
    body += '\n\n❌ Lint, tests of build mislukt; er is geen PR aangemaakt. Bekijk de verify-stap in de Actions-run.';
  }
  const response = await fetch('https://api.github.com/repos/' + repo + '/issues/' + issueNumber + '/comments', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + process.env.GITHUB_TOKEN,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ body }),
  });
  if (!response.ok) throw new Error('Could not post usage report: HTTP ' + response.status);
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, body + '\n');
  console.log('Posted ' + mode + ' cost report to issue #' + issueNumber);
}

if (require.main === module) {
  main().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
module.exports = { collectContinueUsage, reviewUsage, formatReport, estimateCost };
