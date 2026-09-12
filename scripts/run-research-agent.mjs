import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
const manual = process.argv.includes('--manual');
const lock = path.join(process.cwd(), '.research-agent.lock');
if (fs.existsSync(lock)) {
  console.error(
    'Research agent is already running; remove the lock only after confirming no run is active.',
  );
  process.exit(2);
}
fs.writeFileSync(lock, `${process.pid}\n`);
try {
  console.log(`[${new Date().toISOString()}] ${manual ? 'Manual' : 'Scheduled'} run.`);
  console.log(
    'This wrapper intentionally delegates research to an authenticated Codex CLI session.',
  );
  console.log(
    'Suggested command: codex exec --search --full-auto "Read prompts/daily-research-agent.md and execute one run."',
  );
  if (process.env.RUN_CODEX_AGENT === '1') {
    const result = spawnSync(
      'codex',
      [
        'exec',
        '--search',
        '--full-auto',
        'Read prompts/daily-research-agent.md and execute one research run.',
      ],
      { stdio: 'inherit', shell: true },
    );
    if (result.status !== 0) process.exit(result.status || 1);
  } else
    console.log(
      'Dry-run complete. Set RUN_CODEX_AGENT=1 in a trusted environment to invoke Codex.',
    );
} finally {
  fs.rmSync(lock, { force: true });
}
