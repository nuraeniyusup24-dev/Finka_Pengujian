import { readdirSync, statSync, existsSync } from 'node:fs';
import { resolve, relative, extname } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = resolve(import.meta.dirname, '..');
const scanRoots = ['src', 'test', 'scripts'].map((p) => resolve(root, p));
const failures = [];
const checked = [];

function walk(dir) {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const file = resolve(dir, entry.name);
    if (entry.isDirectory()) walk(file);
    else if (entry.isFile() && extname(file) === '.js') checked.push(file);
  }
}

for (const dir of scanRoots) walk(dir);
for (const file of checked) {
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (result.status !== 0) failures.push(`${relative(root, file)}\n${result.stderr || result.stdout}`);
}

const forbiddenEnvFiles = ['.env', '.env.local', '.env.production'].map((name) => resolve(root, name));
for (const file of forbiddenEnvFiles) {
  if (existsSync(file)) failures.push(`File rahasia tidak boleh ada dalam paket: ${relative(root, file)}`);
}

if (failures.length) {
  console.error(`Static check gagal (${failures.length} temuan):\n\n${failures.join('\n\n')}`);
  process.exitCode = 1;
} else {
  console.log(`Static check lulus: ${checked.length} file JavaScript lolos node --check; tidak ada .env root yang terdeteksi.`);
}
