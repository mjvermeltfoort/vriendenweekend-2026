// Issue Bot runner for think/review comments and solve ack + outputs (CommonJS)
// Node 20+ required (global fetch available)

const fs = require('fs');

const {
  OPENAI_API_KEY,
  GITHUB_TOKEN,
  REPO,
  ISSUE_NUMBER,
  ISSUE_TITLE,
  ISSUE_BODY,
  COMMENT_ID,
  COMMENT_BODY,
  COMMENT_AUTHOR,
  AUTHOR_ASSOCIATION,
  COMMENT_URL,
  GITHUB_OUTPUT
} = process.env;

async function postComment(body) {
  const url = `https://api.github.com/repos/${REPO}/issues/${ISSUE_NUMBER}/comments`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${GITHUB_TOKEN}`,
      'Content-Type': 'application/json',
      'Accept': 'application/vnd.github+json'
    },
    body: JSON.stringify({ body })
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`GitHub comment error: ${resp.status} ${text}`);
  }
}


async function reactToCommand(content) {
  if (!COMMENT_ID) throw new Error('Missing issue comment ID');
  const url = `https://api.github.com/repos/${REPO}/issues/comments/${COMMENT_ID}/reactions`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${GITHUB_TOKEN}`,
      'Content-Type': 'application/json',
      'Accept': 'application/vnd.github+json'
    },
    body: JSON.stringify({ content })
  });
  if (!resp.ok) {
    throw new Error(`GitHub reaction error: ${resp.status} ${await resp.text()}`);
  }
}

async function callOpenAI(messages) {
  if (!OPENAI_API_KEY) return 'OPENAI_API_KEY not configured.';
  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: process.env.MODEL || 'gpt-4o-mini',
      temperature: 0.2,
      messages
    })
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`OpenAI API error: ${resp.status} ${text}`);
  }
  const data = await resp.json();
  return data.choices?.[0]?.message?.content?.trim() || 'No response generated.';
}

(async () => {
  try {
    const body = (COMMENT_BODY || '').trim();
    const match = body.match(/^\/(think|solve|review)\b[:\s]*([\s\S]*)$/i);
    if (!match) {
      console.log('No supported command found.');
      process.exit(0);
    }

    const mode = match[1].toLowerCase();
    const userPrompt = (match[2] || '').trim();

    if (process.argv.includes('--react-only')) {
      // GitHub has no magnifying-glass reaction, so review uses eyes.
      await reactToCommand(mode === 'solve' ? '+1' : 'eyes');
      console.log(`Added GitHub reaction for /${mode} command`);
      return;
    }

    if (mode === 'solve') {
      // A thumbs-up reaction on the command already acknowledges /solve.
      // No issue comment is needed before running Continue.
      const prTitle = `fix: Resolve #${ISSUE_NUMBER} - ${ISSUE_TITLE} (bot via Continue)`;
      if (GITHUB_OUTPUT) {
        fs.appendFileSync(GITHUB_OUTPUT, `has_patch=false\n`);
        fs.appendFileSync(GITHUB_OUTPUT, `pr_title=${prTitle}\n`);
        fs.appendFileSync(GITHUB_OUTPUT, `pr_body_file=.github/issue-bot/pr-body.md\n`);
        fs.appendFileSync(GITHUB_OUTPUT, `solve_prompt=${userPrompt.replace(/\n/g, ' ')}\n`);
      }
      process.exit(0);
    }

    const systemBase = `You are a GitHub Issue Assistant. Be concise and practical. Use clear steps and bullet points when helpful. Do not reveal chain-of-thought; provide final reasoning, plans, or checklists only. If information is missing, state assumptions and ask for specifics.`;

    const modeGuidance = {
      think: `Objective: Think through the issue and provide a plan.\n- Summarize the problem and constraints.\n- Identify likely root causes and missing info.\n- Propose a short, prioritized investigation plan.\n- End with next actions for the reporter or maintainer.`,
      review: `Objective: Review the described approach or issue.\n- Assess correctness, risks, and performance/security concerns.\n- List specific checklist items to verify.\n- Suggest improvements and validation steps.`
    };

    const messages = [
      { role: 'system', content: systemBase + '\n\n' + modeGuidance[mode] },
      { role: 'user', content: [
          `Repository: ${REPO}`,
          `Issue #${ISSUE_NUMBER}: ${ISSUE_TITLE}`,
          `Issue body:\n${ISSUE_BODY || '(empty)'}\n`,
          `Command: /${mode}`,
          `Comment author: ${COMMENT_AUTHOR} (${AUTHOR_ASSOCIATION})`,
          `Prompt:\n${userPrompt || '(none)'}`
        ].join('\n') }
    ];

    const ai = await callOpenAI(messages);
    const header = `Mode: ${mode} — responding to ${COMMENT_AUTHOR}`;
    const content = `${header}\n\n${ai}`;
    await postComment(content);

    if (GITHUB_OUTPUT) {
      const prTitle = `chore: analysis for #${ISSUE_NUMBER} - ${ISSUE_TITLE} (bot)`;
      fs.appendFileSync(GITHUB_OUTPUT, `has_patch=false\n`);
      fs.appendFileSync(GITHUB_OUTPUT, `pr_title=${prTitle}\n`);
    }
  } catch (err) {
    console.error(String(err));
    try {
      if (process.argv.includes('--react-only')) throw err;
      const fallback = `Sorry, the bot failed with: ${String(err).slice(0, 1800)}\n\nPlease check the workflow logs.`;
      await postComment(fallback);
    } catch (_) {}
    process.exit(1);
  }
})();
