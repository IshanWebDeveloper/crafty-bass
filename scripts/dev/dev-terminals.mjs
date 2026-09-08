#!/usr/bin/env node
/**
 * Starts the whole dev stack with one terminal per app instead of one
 * multiplexed `concurrently` pane, so each app's logs stay readable and any
 * single app can be restarted (Ctrl+C in its own tab) without killing the rest.
 *
 * Apps come up in dependency order: the stripe listener and ai-service first,
 * then the backend that calls them, then the two clients that call the backend.
 *
 * Usage (from repo root):
 *   pnpm dev:all:terminals                  docker + migrations, then a tab per app
 *   pnpm dev:all:terminals --windows        separate OS windows instead of tabs
 *   pnpm dev:all:terminals --no-prep        skip docker compose + migrate deploy
 *   pnpm dev:all:terminals --no-stripe      skip the stripe listener
 *   pnpm dev:all:terminals --no-wait        launch every tab at once, no ordering
 *   pnpm dev:all:terminals --only=backend,frontend
 */
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import net from 'node:net';
import path from 'node:path';

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
);

/** How long to wait on a phase's ports before starting the next one anyway. */
const READY_TIMEOUT_MS = 180_000;
const POLL_INTERVAL_MS = 500;

const TASKS = [
  {
    name: 'stripe',
    title: 'stripe listen',
    color: '#f97316',
    command: 'pnpm stripe:listen',
    // The CLI listener holds an outbound websocket; it never opens a local port.
    readyPort: null,
  },
  {
    name: 'ai-service',
    title: 'ai-service :8006',
    color: '#eab308',
    command: 'pnpm nx run ai-service:dev',
    readyPort: 8006,
  },
  {
    name: 'backend',
    title: 'backend :3005',
    color: '#22c55e',
    command: 'pnpm nx run backend:dev',
    readyPort: 3005,
  },
  {
    name: 'frontend',
    title: 'frontend :3000',
    color: '#06b6d4',
    command: 'pnpm nx run frontend:dev',
    readyPort: 3000,
  },
  {
    name: 'admin',
    title: 'admin :3001',
    color: '#a855f7',
    command: 'pnpm nx run admin:dev',
    readyPort: 3001,
  },
];

/** Each phase launches only once the previous phase's ports are accepting. */
const PHASES = [['stripe', 'ai-service'], ['backend'], ['frontend', 'admin']];

const argv = process.argv.slice(2);
const has = (flag) => argv.includes(flag);
const onlyArg = argv.find((a) => a.startsWith('--only='));

const separateWindows = has('--windows');
const skipPrep = has('--no-prep');
const skipStripe = has('--no-stripe');
const skipWait = has('--no-wait');

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

/** The selected tasks grouped into startup phases, with empty phases dropped. */
const phases = skipWait
  ? [tasks]
  : PHASES.map((names) => tasks.filter((t) => names.includes(t.name))).filter(
      (phase) => phase.length,
    );

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

/**
 * PowerShell 7 (`pwsh`) is not installed everywhere, so fall back to the
 * Windows PowerShell that ships with the OS. Both accept the same flags.
 */
let cachedShell;
function powershellExe() {
  if (cachedShell === undefined) {
    cachedShell =
      resolveBinary('pwsh') ?? resolveBinary('powershell') ?? 'powershell.exe';
  }
  return cachedShell;
}

/** Shell that runs a task and stays open afterwards so failures are readable. */
function shellArgs(command) {
  return [powershellExe(), '-NoLogo', '-NoExit', '-Command', command];
}

function launchWindowsTerminal(wtPath, phaseTasks) {
  if (separateWindows) {
    for (const task of phaseTasks) {
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

  // Reusing the named window makes each later phase append tabs to it.
  const args = ['-w', 'crafty-bass'];
  phaseTasks.forEach((task, index) => {
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

function launchFallbackWindows(phaseTasks) {
  for (const task of phaseTasks) {
    spawn('cmd', ['/c', 'start', task.title, ...shellArgs(task.command)], {
      cwd: repoRoot,
      detached: true,
      stdio: 'ignore',
    }).unref();
  }
}

function launchMacTerminal(phaseTasks) {
  for (const task of phaseTasks) {
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

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Resolves true once something is accepting TCP connections on the port. */
function isPortOpen(port) {
  return new Promise((resolve) => {
    const socket = net.connect({ host: '127.0.0.1', port });
    const settle = (open) => {
      socket.destroy();
      resolve(open);
    };
    socket.setTimeout(1000);
    socket.once('connect', () => settle(true));
    socket.once('timeout', () => settle(false));
    socket.once('error', () => settle(false));
  });
}

async function waitForPhase(phaseTasks) {
  const gated = phaseTasks.filter((t) => t.readyPort);
  if (!gated.length) return;

  const pending = new Set(gated);
  const deadline = Date.now() + READY_TIMEOUT_MS;
  process.stdout.write(
    `  waiting for ${gated.map((t) => `${t.name}:${t.readyPort}`).join(', ')} `,
  );
  while (pending.size && Date.now() < deadline) {
    for (const task of [...pending]) {
      if (await isPortOpen(task.readyPort)) pending.delete(task);
    }
    if (!pending.size) break;
    process.stdout.write('.');
    await sleep(POLL_INTERVAL_MS);
  }
  if (pending.size) {
    const names = [...pending].map((t) => t.name).join(', ');
    console.log(
      `\n  ${names} not up after ${READY_TIMEOUT_MS / 1000}s; starting the next apps anyway.`,
    );
  } else {
    console.log(' ready');
  }
}

function makeLauncher() {
  if (process.platform === 'win32') {
    const wtPath = resolveBinary('wt');
    return wtPath
      ? (phaseTasks) => launchWindowsTerminal(wtPath, phaseTasks)
      : launchFallbackWindows;
  }
  if (process.platform === 'darwin') return launchMacTerminal;
  console.error(
    'Separate terminals are only wired up for Windows and macOS. Use `pnpm dev:all` instead.',
  );
  process.exit(1);
}

if (!skipPrep) {
  runPrepStep('docker compose up -d --wait', 'docker compose up -d --wait');
  runPrepStep(
    'prisma migrate deploy',
    'pnpm --filter @repo/db db:migrate:deploy',
  );
}

const launch = makeLauncher();

for (const [index, phaseTasks] of phases.entries()) {
  console.log(`\n> starting ${phaseTasks.map((t) => t.name).join(', ')}`);
  launch(phaseTasks);
  // Nothing is queued behind the last phase, so don't block on it.
  if (index < phases.length - 1) await waitForPhase(phaseTasks);
}

console.log(
  `\nLaunched ${tasks.length} terminal${tasks.length === 1 ? '' : 's'}: ${tasks.map((t) => t.name).join(', ')}`,
);
console.log(
  'Stop an app with Ctrl+C in its own terminal; the others keep running.',
);
