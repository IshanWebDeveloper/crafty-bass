#!/usr/bin/env node
/**
 * Starts the whole dev stack with one terminal per app instead of one
 * multiplexed `concurrently` pane, so each app's logs stay readable and any
 * single app can be restarted (Ctrl+C in its own tab) without killing the rest.
 *
 * Usage (from repo root):
 *   pnpm dev:all:terminals                  docker + migrations, then a tab per app
 *   pnpm dev:all:terminals --windows        separate OS windows instead of tabs
 *   pnpm dev:all:terminals --no-prep        skip docker compose + migrate deploy
 *   pnpm dev:all:terminals --no-stripe      skip the stripe listener
 *   pnpm dev:all:terminals --only=backend,frontend
 */
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
);

const TASKS = [
  {
    name: 'backend',
    title: 'backend :3005',
    color: '#22c55e',
    command: 'pnpm nx run backend:dev',
  },
  {
    name: 'frontend',
    title: 'frontend :3000',
    color: '#06b6d4',
    command: 'pnpm nx run frontend:dev',
  },
  {
    name: 'admin',
    title: 'admin :3001',
    color: '#a855f7',
    command: 'pnpm nx run admin:dev',
  },
  {
    name: 'ai-service',
    title: 'ai-service :8006',
    color: '#eab308',
    command: 'pnpm nx run ai-service:dev',
  },
  {
    name: 'stripe',
    title: 'stripe listen',
    color: '#f97316',
    command: 'pnpm stripe:listen',
  },
];

const argv = process.argv.slice(2);
const has = (flag) => argv.includes(flag);
const onlyArg = argv.find((a) => a.startsWith('--only='));

const separateWindows = has('--windows');
const skipPrep = has('--no-prep');
const skipStripe = has('--no-stripe');

let tasks = TASKS;
if (onlyArg) {
  const wanted = onlyArg
    .slice('--only='.length)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const unknown = wanted.filter((w) => !TASKS.some((t) => t.name === w));
  if (unknown.length) {
    console.error(`Unknown --only target(s): ${unknown.join(', ')}`);
    console.error(`Available: ${TASKS.map((t) => t.name).join(', ')}`);
    process.exit(1);
  }
  tasks = TASKS.filter((t) => wanted.includes(t.name));
} else if (skipStripe) {
  tasks = TASKS.filter((t) => t.name !== 'stripe');
}

function runPrepStep(label, command) {
  console.log(`\n> ${label}`);
  const result = spawnSync(command, {
    cwd: repoRoot,
    stdio: 'inherit',
    shell: true,
  });
  if (result.status !== 0) {
    console.error(
      `\n"${label}" failed (exit ${result.status ?? 'signal'}). Aborting.`,
    );
    process.exit(result.status ?? 1);
  }
}

if (!skipPrep) {
  runPrepStep('docker compose up -d --wait', 'docker compose up -d --wait');
  runPrepStep(
    'prisma migrate deploy',
    'pnpm --filter @repo/db db:migrate:deploy',
  );
}

/** Shell that runs a task and stays open afterwards so failures are readable. */
function shellArgs(command) {
  return ['pwsh', '-NoLogo', '-NoExit', '-Command', command];
}

function launchWindowsTerminal(wtPath) {
  if (separateWindows) {
    for (const task of tasks) {
      // `-w -1` forces a brand new window per task.
      spawn(
        wtPath,
        [
          '-w',
          '-1',
          'new-tab',
          '--title',
          task.title,
          '--tabColor',
          task.color,
          '-d',
          repoRoot,
          ...shellArgs(task.command),
        ],
        { cwd: repoRoot, detached: true, stdio: 'ignore' },
      ).unref();
    }
    return;
  }

  const args = ['-w', 'crafty-bass'];
  tasks.forEach((task, index) => {
    // A bare ";" argument is how Windows Terminal separates chained subcommands.
    if (index > 0) args.push(';');
    args.push(
      'new-tab',
      '--title',
      task.title,
      '--tabColor',
      task.color,
      '-d',
      repoRoot,
      ...shellArgs(task.command),
    );
  });
  spawn(wtPath, args, {
    cwd: repoRoot,
    detached: true,
    stdio: 'ignore',
  }).unref();
}

function launchFallbackWindows() {
  for (const task of tasks) {
    spawn('cmd', ['/c', 'start', task.title, ...shellArgs(task.command)], {
      cwd: repoRoot,
      detached: true,
      stdio: 'ignore',
    }).unref();
  }
}

function launchMacTerminal() {
  for (const task of tasks) {
    const script = `tell application "Terminal" to do script "cd ${repoRoot.replace(/"/g, '\\"')} && ${task.command}"`;
    spawn('osascript', ['-e', script], {
      detached: true,
      stdio: 'ignore',
    }).unref();
  }
}

/**
 * `wt` lives in WindowsApps as an execution alias, which Node cannot spawn by
 * bare name, so resolve it to a real path first.
 */
function resolveBinary(bin) {
  const probe = process.platform === 'win32' ? 'where' : 'which';
  const result = spawnSync(probe, [bin], { encoding: 'utf8', shell: true });
  if (result.status !== 0) return null;
  const first = (result.stdout ?? '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .find(Boolean);
  return first ?? null;
}

if (process.platform === 'win32') {
  const wtPath = resolveBinary('wt');
  if (wtPath) launchWindowsTerminal(wtPath);
  else launchFallbackWindows();
} else if (process.platform === 'darwin') {
  launchMacTerminal();
} else {
  console.error(
    'Separate terminals are only wired up for Windows and macOS. Use `pnpm dev:all` instead.',
  );
  process.exit(1);
}

console.log(
  `\nLaunched ${tasks.length} terminal${tasks.length === 1 ? '' : 's'}: ${tasks.map((t) => t.name).join(', ')}`,
);
console.log(
  'Stop an app with Ctrl+C in its own terminal; the others keep running.',
);
