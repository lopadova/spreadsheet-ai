import { spawn, spawnSync } from 'node:child_process';
import { closeSync, mkdtempSync, openSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const port = process.argv[2] ?? '8123';
const directory = mkdtempSync(join(tmpdir(), 'spreadsheet-ai-e2e-'));
const database = join(directory, 'database.sqlite');
const env = {
    ...process.env,
    APP_ENV: 'testing',
    DB_CONNECTION: 'sqlite',
    DB_URL: '',
    DB_DATABASE: database,
    TABULAR_AI_MOCK: 'true',
    TABULAR_SSE_PACING_MS: '20',
};

closeSync(openSync(database, 'wx'));

const migrate = spawnSync(
    process.execPath,
    ['scripts/run-php.mjs', 'artisan', 'migrate', '--seed', '--force', '--no-interaction'],
    { cwd: root, env, stdio: 'inherit' },
);

if (migrate.error || migrate.status !== 0) {
    rmSync(directory, { recursive: true });
    throw migrate.error ?? new Error(`Database setup failed with exit code ${migrate.status}`);
}

const server = spawn(
    process.execPath,
    ['scripts/run-php.mjs', 'artisan', 'serve', '--host=127.0.0.1', `--port=${port}`],
    { cwd: root, env, stdio: 'inherit' },
);
let shuttingDown = false;

server.on('error', (error) => {
    console.error(error);
});

server.on('close', (code, signal) => {
    rmSync(directory, { recursive: true });
    process.exitCode = shuttingDown ? 0 : (code ?? 1);
});

process.on('SIGTERM', () => {
    shuttingDown = true;
    server.kill('SIGTERM');
});
process.on('SIGINT', () => {
    shuttingDown = true;
    server.kill('SIGINT');
});
