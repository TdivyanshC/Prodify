import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// The server must deploy from server/ alone (a host may ship only that
// folder): no source file may import from above it, and the three files it
// shares with the app are vendored into src/shared. When the app's originals
// are present, the copies must match them. Run: npm test
const root = join(dirname(fileURLToPath(import.meta.url)), '..'); // server/src

let failed = 0;
function check(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failed++;
    console.log(`  ✗ ${name}\n      ${(err as Error).message}`);
  }
}

console.log('\nProdify server is self-contained\n');

check('vendored shared files match the app copies', () => {
  // Strip the two-line "Vendored copy" header, and the one import path that differs.
  const body = (f: string) =>
    readFileSync(f, 'utf8')
      .replace(/\r\n/g, '\n')
      .replace(/^\/\/ Vendored copy[^\n]*\n\/\/ [^\n]*\n/, '')
      .replace("'../types/social'", "'./social'");
  const pairs: [string, string][] = [
    ['shared/notificationCopy.ts', '../../src/mocks/notificationCopy.ts'],
    ['shared/mascotQuotes.ts', '../../src/mocks/mascotQuotes.ts'],
    ['shared/social.ts', '../../src/types/social.ts'],
  ];
  for (const [vendored, original] of pairs) {
    const orig = join(root, original);
    if (!existsSync(orig)) continue; // server/ shipped alone: nothing to compare
    assert.equal(body(join(root, vendored)), body(orig), `${vendored} drifted from ${original} - copy it again`);
  }
});

check('no server source imports from outside server/', () => {
  const bad: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const file = join(dir, name);
      if (statSync(file).isDirectory()) {
        if (name !== 'tests' && name !== 'node_modules') walk(file);
      } else if (file.endsWith('.ts')) {
        const levelsBelowSrc = file.slice(root.length + 1).split(/[\\/]/).length - 1;
        for (const m of readFileSync(file, 'utf8').matchAll(/from '((?:\.\.\/)+)/g)) {
          if (m[1].length / 3 > levelsBelowSrc) bad.push(file.slice(root.length + 1));
        }
      }
    }
  };
  walk(root);
  assert.deepEqual(bad, [], 'these files import above server/src');
});

console.log(`\n${failed ? 'FAILED' : 'ok'}\n`);
process.exit(failed ? 1 : 0);
