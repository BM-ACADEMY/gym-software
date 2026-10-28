#!/usr/bin/env node
// C-01: package boundary check. Plain Node, no install needed. Exit 1 when a rule is broken.
// Rules (docs/ARCHITECTURE.md):
//  1. A product (apps/<name>, or today's gym code in server/ and client/) never imports another product.
//  2. A package (packages/<name>) never imports any product.
//  3. Packages only import the packages their level allows (see ALLOWED).
//  4. Nothing reaches into another package's inner folders: import the package name, not "../core-x/src/...".
// Usage: node scripts/check-boundaries.js [rootDir]     (default: the repo root)
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(process.argv[2] || path.join(__dirname, '..'));
const EXT = new Set(['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs']);
const SKIP = new Set(['node_modules', 'dist', 'build', '.git', 'coverage']);

// Which packages each package may use. core-server is the base: it uses no other package.
const ALLOWED = {
  'core-server': [],
  'core-messaging': ['core-server'],
  'core-ai': ['core-server'],
  'core-pos': ['core-server', 'core-messaging'],
  'core-ui': [],
};
const PRODUCTS = ['gym', 'salon', 'mart', 'dine', 'cloth', 'wash', 'hire'];

const exists = (p) => { try { return fs.statSync(p).isDirectory(); } catch { return false; } };

// Where each product's code lives. The gym is still in server/ and client/ until C-04.
const productDirs = () => {
  const map = {};
  for (const p of PRODUCTS) {
    const dirs = [path.join(ROOT, 'apps', p)];
    if (p === 'gym') dirs.push(path.join(ROOT, 'server'), path.join(ROOT, 'client', 'src'));
    map[p] = dirs.filter(exists);
  }
  return map;
};
const packageDirs = () => {
  const base = path.join(ROOT, 'packages');
  if (!exists(base)) return {};
  return Object.fromEntries(fs.readdirSync(base).filter((n) => exists(path.join(base, n))).map((n) => [n, path.join(base, n)]));
};

const files = (dir, out = []) => {
  for (const name of fs.readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) files(full, out);
    else if (EXT.has(path.extname(name))) out.push(full);
  }
  return out;
};

const IMPORT_RE = /(?:import\s[^'"]*?from\s*|import\s*\(\s*|require\s*\(\s*|import\s+)['"]([^'"]+)['"]/g;
const specifiers = (text) => { const out = []; let m; IMPORT_RE.lastIndex = 0; while ((m = IMPORT_RE.exec(text))) out.push(m[1]); return out; };

// Which owner (product or package) does a file path or an import target belong to?
const ownerOf = (abs, prods, pkgs) => {
  for (const [name, dirs] of Object.entries(prods)) if (dirs.some((d) => abs === d || abs.startsWith(d + path.sep))) return { kind: 'product', name };
  for (const [name, dir] of Object.entries(pkgs)) if (abs === dir || abs.startsWith(dir + path.sep)) return { kind: 'package', name };
  return null;
};

const check = () => {
  const prods = productDirs();
  const pkgs = packageDirs();
  const problems = [];
  const scan = (owner, dirs) => {
    for (const dir of dirs) for (const file of files(dir)) {
      const text = fs.readFileSync(file, 'utf8');
      for (const spec of specifiers(text)) {
        let target = null;
        let inner = false;
        if (spec.startsWith('.')) {
          const abs = path.resolve(path.dirname(file), spec);
          target = ownerOf(abs, prods, pkgs);
          // reaching into a package's inner files from outside it
          if (target && target.kind === 'package' && !(owner.kind === 'package' && owner.name === target.name)) inner = true;
        } else {
          const m = spec.match(/^@(?:afra|gymdesk)\/([a-z0-9-]+)(\/.*)?$/);
          if (m) {
            if (pkgs[m[1]] || ALLOWED[m[1]]) { target = { kind: 'package', name: m[1] }; inner = !!m[2] && m[2] !== '/'; }
            else if (PRODUCTS.includes(m[1])) target = { kind: 'product', name: m[1] };
          }
        }
        if (!target) continue;
        const rel = path.relative(ROOT, file);
        if (owner.kind === 'product' && target.kind === 'product' && target.name !== owner.name) problems.push(`${rel}: product "${owner.name}" imports product "${target.name}" (${spec})`);
        if (owner.kind === 'package' && target.kind === 'product') problems.push(`${rel}: package "${owner.name}" imports product "${target.name}" (${spec})`);
        if (owner.kind === 'package' && target.kind === 'package' && target.name !== owner.name && !(ALLOWED[owner.name] || []).includes(target.name)) problems.push(`${rel}: package "${owner.name}" may not use package "${target.name}" (${spec})`);
        if (inner && !(target.kind === 'package' && owner.kind === 'package' && owner.name === target.name)) problems.push(`${rel}: reaches inside package "${target.name}" (${spec}); import the package name instead`);
      }
    }
  };
  for (const [name, dirs] of Object.entries(prods)) scan({ kind: 'product', name }, dirs);
  for (const [name, dir] of Object.entries(pkgs)) scan({ kind: 'package', name }, [dir]);
  return { problems, products: Object.keys(prods).filter((k) => prods[k].length), packages: Object.keys(pkgs) };
};

if (require.main === module) {
  const { problems, products, packages } = check();
  console.log(`Checked products: ${products.join(', ') || 'none'}; packages: ${packages.join(', ') || 'none yet'}`);
  if (problems.length) { console.error(`\n${problems.length} boundary problem(s):\n- ${problems.join('\n- ')}`); process.exit(1); }
  console.log('Boundaries OK');
}
module.exports = { check, ALLOWED, PRODUCTS };
