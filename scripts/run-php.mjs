#!/usr/bin/env node
// Locates the Herd PHP binary (avoiding stale PATH / XAMPP) and spawns it with
// the passed args, e.g. `node scripts/run-php.mjs artisan test`.
// Resolution order: env PHP_BINARY -> Herd php84 under USERPROFILE -> bare `php`.
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';

function resolvePhp() {
    if (process.env.PHP_BINARY && existsSync(process.env.PHP_BINARY)) {
        return process.env.PHP_BINARY;
    }
    const home = process.env.USERPROFILE || process.env.HOME || '';
    if (home) {
        const herd = `${home}\\.config\\herd\\bin\\php84\\php.exe`;
        if (existsSync(herd)) {
            return herd;
        }
    }
    return 'php';
}

const php = resolvePhp();
const args = process.argv.slice(2);

const child = spawn(php, args, { stdio: 'inherit', shell: false });

child.on('error', (err) => {
    console.error(`Failed to launch PHP (${php}): ${err.message}`);
    process.exit(1);
});

child.on('exit', (code, signal) => {
    if (signal) {
        process.kill(process.pid, signal);
        return;
    }
    process.exit(code ?? 0);
});
