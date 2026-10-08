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
  const hasCost = sessions.some((usage) => number(usage.totalCost) !== null && usage.totalCost > 0);
  const input = hasTokens ? sum((u) => u.promptTokens) : null;
  const output = hasTokens ? sum((u) => u.completionTokens) : null;
  const cached = hasTokens ? sum((u) => u.promptTokensDetails?.cachedTokens) : null;
  let model = null;
  try {
    const config = fs.readFileSync('.continue/config.yaml', 'utf8');
    const models = [...config.matchAll(/^\s+model:\s*([\w.-]+)\s*$/gm)];
    if (models.length === 1) model = models[0][1];
  } catch { /* Model unknown. */ }
  let cost = hasCost ? sum((u) => u.totalCost) : null;
  let source = 'Continue-sessiestatistieken';
  // Fall back only for a known configured model and measured tokens.
  // Published standard GPT-5 prices: https://developers.openai.com/api/docs/models/gpt-5
  if (cost === null && hasTokens && model === 'gpt-5') {
    const cachedInput = Math.min(input, cached);
    cost = ((input - cachedInput) * 1.25 + cachedInput * 0.125 + output * 10) / 1e6;
    source += ' + GPT-5-prijslijst (schatting)';
  }
  return { input, output, cached, cost, model, source };
}

function reviewUsage(filepath) {
  const record = loadJson(filepath);
  if (!record?.usage) return null;
  const u = record.usage;
  const input = number(u.prompt_tokens);
  const output = number(u.completion_tokens);
  if (input === null || output === null) return null;
  const cached = number(u.prompt_tokens_details?.cached_tokens) || 0;
  let cost = null;
  // USD per 1M text tokens, from the published GPT-4o-mini API prices.
  if (/^gpt-4o-mini(?:-|$)/.test(record.model || '')) {
    cost = ((input - Math.min(input, cached)) * 0.15 + Math.min(input, cached) * 0.075 + output * 0.60) / 1e6;
  }
  return { input, output, cached, cost, source: 'OpenAI API-usage', model: record.model };
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
    if (usage.input !== null) {
      lines.push('- Invoer: **' + count(usage.input) + ' tokens**' +
        (usage.cached ? ' (' + count(usage.cached) + ' cached)' : ''));
    }
    if (usage.output !== null) lines.push('- Uitvoer: **' + count(usage.output) + ' tokens**');
    lines.push('- Geschatte API-kosten: **' + (usage.cost === null ? 'niet beschikbaar' : usd(usage.cost)) + '**');
    lines.push('- Bron: ' + usage.source);
  } else {
    lines.push('- Tokens en kosten: **niet beschikbaar** (geen betrouwbare gebruiksstatistieken gevonden).');
  }
  lines.push('', 'De kosten zijn een schatting, niet de definitieve factuur. [GitHub Actions-run](' + runUrl + ').');
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
  const status = (outcome === 'success' && (mode !== 'solve' || process.env.PR_OUTCOME !== 'failure')) ? 'uitgevoerd' : 'mislukt of onderbroken';
  const repo = process.env.REPO;
  const issueNumber = process.env.ISSUE_NUMBER;
  const runUrl = 'https://github.com/' + repo + '/actions/runs/' + process.env.GITHUB_RUN_ID;
  const body = formatReport(mode, usage, runUrl, status);
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
module.exports = { collectContinueUsage, reviewUsage, formatReport };
