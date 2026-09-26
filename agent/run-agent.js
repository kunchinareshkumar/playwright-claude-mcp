// Dynamic Playwright automation driven by Claude (Agent SDK) + Playwright MCP.
//
//   node agent/run-agent.js --goal "User can add, complete and clear todos" [--url https://...] [--name todos]
//   node agent/run-agent.js --heal            # repair currently failing tests
//
// Uses the planner/generator/healer subagents created by `npx playwright init-agents --loop=claude`
// (.claude/agents/*) and the MCP server in .mcp.json. Requires ANTHROPIC_API_KEY.

import { query } from '@anthropic-ai/claude-agent-sdk';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { parseArgs } from 'node:util';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const { values: args } = parseArgs({
  options: {
    goal: { type: 'string' },
    url: { type: 'string' },
    name: { type: 'string' },
    heal: { type: 'boolean', default: false },
    'max-turns': { type: 'string', default: '80' },
    model: { type: 'string' },
  },
});

if (!args.heal && !args.goal) {
  console.error('Usage: node agent/run-agent.js --goal "<what to test>" [--url <baseURL>] [--name <feature>] | --heal');
  process.exit(1);
}
if (!existsSync(path.join(ROOT, '.claude', 'agents'))) {
  console.error('Missing .claude/agents — run: npx playwright init-agents --loop=claude');
  process.exit(1);
}

const baseURL = args.url || process.env.BASE_URL || 'https://demo.playwright.dev/todomvc';
process.env.BASE_URL = baseURL;
const feature = (args.name || args.goal || 'heal').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40).replace(/-$/, '');

const runTests = (file) => {
  const r = spawnSync('npx', ['playwright', 'test', ...(file ? [file] : []), '--reporter=list'], {
    cwd: ROOT, stdio: 'inherit', env: process.env,
  });
  return r.status === 0;
};

const generatePrompt = `
Target app base URL: ${baseURL}
Test goal: ${args.goal}

Follow CLAUDE.md. Work in three stages, using the Playwright subagents:
1. Use the playwright-test-planner agent to explore the live app starting from tests/seed.spec.js and
   write a test plan to specs/${feature}.md (happy paths, edge cases, validation/negative cases).
2. Use the playwright-test-generator agent to turn every scenario in specs/${feature}.md into
   tests/${feature}.spec.js (JavaScript, not TypeScript), verifying locators against the live page.
3. Run: npx playwright test tests/${feature}.spec.js --reporter=list
   If anything fails, use the playwright-test-healer agent to fix it, then re-run. Stop after 3 heal rounds.
Finish with a short summary: scenarios covered, pass/fail counts, and any test.fixme() with the reason.`;

const healPrompt = `
Base URL: ${baseURL}. Follow CLAUDE.md.
Run: npx playwright test --reporter=list
For each failing test, use the playwright-test-healer agent to diagnose against the live app and fix it.
Re-run until green or 3 rounds. If the app (not the test) is broken, mark test.fixme() with the reason.
Finish with a summary of what changed per file.`;

console.log(`\n▶ ${args.heal ? 'Healing suite' : `Generating tests for "${args.goal}"`} against ${baseURL}\n`);

let result;
for await (const msg of query({
  prompt: args.heal ? healPrompt : generatePrompt,
  options: {
    cwd: ROOT,
    settingSources: ['project'],            // loads CLAUDE.md, .claude/agents/*, .mcp.json
    permissionMode: 'acceptEdits',
    allowedTools: [
      'Read', 'Write', 'Edit', 'Glob', 'Grep', 'Task',
      'Bash(npx playwright test:*)',
      'mcp__playwright-test',                // every tool from the Playwright test MCP server
    ],
    maxTurns: Number(args['max-turns']),
    ...(args.model ? { model: args.model } : {}),
  },
})) {
  if (msg.type === 'assistant') {
    for (const block of msg.message.content) {
      if (block.type === 'text' && block.text.trim()) console.log(block.text.trim());
      if (block.type === 'tool_use') console.log(`  · ${block.name}${block.input?.subagent_type ? ` → ${block.input.subagent_type}` : ''}`);
    }
  } else if (msg.type === 'result') {
    result = msg;
  }
}

if (result) {
  console.log(`\n■ Agent finished: ${result.subtype} | turns ${result.num_turns} | cost $${(result.total_cost_usd ?? 0).toFixed(3)}`);
}

// Independent verification — don't trust the agent's own report.
console.log('\n▶ Verifying with a clean run...\n');
const ok = runTests(args.heal ? undefined : `tests/${feature}.spec.js`);
console.log(ok ? '\n✅ All tests passed.' : '\n❌ Failures remain — see playwright-report/ (npm run report).');
process.exit(ok ? 0 : 1);
