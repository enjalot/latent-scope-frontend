#!/usr/bin/env node
/**
 * Import (or re-sync) a moonshine "still" article project into this repo.
 *
 *   node scripts/import-moonshine.mjs <moonshine-project-dir> --slug <slug>
 *
 * What it does:
 *   - content/*.md                → src/essays/<slug>/content/
 *   - src/figures/** (used only)  → src/essays/<slug>/figures/
 *       - only figures whose registry id appears in the content markdown
 *         (:::figure{id=...} / :inline-viz{kind=...}) are copied
 *       - imports of the template runtime (../components/*, ../store,
 *         ./lib/data, ./lib/params, ../lib/*) are rewritten to point at
 *         src/essays/runtime/
 *       - figures/registry.ts is regenerated with only the used entries
 *   - public/data/**              → public/essays/<slug>/data/
 *
 * It does NOT copy the template runtime itself (Article/Figure/Term/...)
 * — that lives once at src/essays/runtime/. Authoring chrome (edit HUD,
 * feedback, knobs, velite config) is never copied.
 *
 * Idempotent: re-running fully overwrites src/essays/<slug>/content,
 * src/essays/<slug>/figures and public/essays/<slug>/data. The essay's
 * index.tsx is only written if missing, so hand-tuning survives re-syncs.
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, '..');

// ---------------------------------------------------------------- args

const args = process.argv.slice(2);
const slugIdx = args.indexOf('--slug');
const src = args.find((a) => !a.startsWith('--') && args[args.indexOf(a) - 1] !== '--slug');
const slug = slugIdx !== -1 ? args[slugIdx + 1] : null;

if (!src || !slug) {
  console.error('Usage: node scripts/import-moonshine.mjs <moonshine-project-dir> --slug <slug>');
  process.exit(1);
}
const SRC = path.resolve(src);
if (!fs.existsSync(path.join(SRC, 'content'))) {
  console.error(`error: ${SRC} does not look like a moonshine project (no content/ dir)`);
  process.exit(1);
}

const essayDir = path.join(REPO, 'src', 'essays', slug);
const figuresDest = path.join(essayDir, 'figures');
const contentDest = path.join(essayDir, 'content');
const dataDest = path.join(REPO, 'public', 'essays', slug, 'data');

// Files never copied, regardless of usage. DiagramFigure/FlowDiagram
// depend on @xyflow/react + velite-baked layouts, which the runtime here
// does not carry.
const FIGURE_EXCLUDE = new Set(['DiagramFigure.tsx', 'FlowDiagram.tsx']);
// figures/lib files owned by the runtime (rewritten, never copied).
const RUNTIME_LIB = new Set(['data.tsx', 'data.ts', 'params.ts']);

// ---------------------------------------------------------------- content

fs.rmSync(contentDest, { recursive: true, force: true });
fs.mkdirSync(contentDest, { recursive: true });
// Series projects keep their articles in content/series/*.md (the still
// template's velite config flattens that to slugs like `series-01-…`).
// Here articles are slugged from their filename, so copy series files
// flat under content/ with clean names; `series/index.md` becomes
// `series-index.md`, the slug the runtime's SeriesIndex treats as the
// series intro.
const contentSources = []; // { from, destName }
for (const f of fs.readdirSync(path.join(SRC, 'content'))) {
  if (f.endsWith('.md')) contentSources.push({ from: path.join(SRC, 'content', f), destName: f });
}
const seriesDir = path.join(SRC, 'content', 'series');
if (fs.existsSync(seriesDir)) {
  for (const f of fs.readdirSync(seriesDir).filter((f) => f.endsWith('.md'))) {
    const destName = f === 'index.md' ? 'series-index.md' : f;
    if (contentSources.some((c) => c.destName === destName)) {
      console.warn(`warning: content/series/${f} collides with content/${destName} — skipped`);
      continue;
    }
    contentSources.push({ from: path.join(seriesDir, f), destName });
  }
}
const mdFiles = [];
for (const { from, destName } of contentSources) {
  fs.copyFileSync(from, path.join(contentDest, destName));
  mdFiles.push(destName);
}
console.log(`content: copied ${mdFiles.length} markdown file(s)`);
if (fs.existsSync(path.join(SRC, 'content', 'figures'))) {
  console.log(
    'note: content/figures/*.json (baked diagram layouts) not copied — DiagramFigure is not part of the ported runtime'
  );
}

// Which figure ids / inline kinds does the content actually use?
const contentText = mdFiles
  .map((f) => fs.readFileSync(path.join(contentDest, f), 'utf8'))
  .join('\n');
const usedIds = new Set(
  [...contentText.matchAll(/:::+figure\{[^}]*?\bid=([\w-]+)/g)].map((m) => m[1])
);
const usedKinds = new Set(
  [...contentText.matchAll(/:inline-viz\{[^}]*?\bkind=([\w-]+)/g)].map((m) => m[1])
);
console.log(`content: uses figures [${[...usedIds].join(', ')}]`);
if (usedKinds.size) console.log(`content: uses inline kinds [${[...usedKinds].join(', ')}]`);

// ---------------------------------------------------------------- registry

const registryPath = path.join(SRC, 'src', 'figures', 'registry.ts');
const registrySrc = fs.existsSync(registryPath) ? fs.readFileSync(registryPath, 'utf8') : '';

// import Name from './File' / import Name, { A as b } from './File' /
// import { A, B as c } from './File'  (named-only is the common form in
// older template vintages).
const importRe = /import\s+(?:(\w+)\s*,\s*)?(?:(\w+)|\{([^}]*)\})\s*from\s+'(\.[^']+)'/g;
const imports = []; // { def, named: string, path }
for (const m of registrySrc.matchAll(importRe)) {
  imports.push({ def: m[1] || m[2] || '', named: m[3] || '', path: m[4] });
}

// Entries inside `export const figures = { ... }` — values are flat
// object literals (no nested braces in the template).
function parseEntries(objSrc) {
  const entries = [];
  for (const m of objSrc.matchAll(/(['"]?)([\w-]+)\1:\s*\{([^{}]*)\}/g)) {
    entries.push({ id: m[2], body: m[3] });
  }
  return entries;
}
function sliceObject(source, marker) {
  const i = source.indexOf(marker);
  if (i === -1) return '';
  const open = source.indexOf('{', i);
  let depth = 0;
  for (let j = open; j < source.length; j++) {
    if (source[j] === '{') depth++;
    if (source[j] === '}') depth--;
    if (depth === 0) return source.slice(open + 1, j);
  }
  return '';
}

const figureEntries = parseEntries(sliceObject(registrySrc, 'export const figures'));
const inlineSrc = sliceObject(registrySrc, 'export const inlineFigures');
// inline entries: 'kind': Component (possibly with `as ...` cast)
const inlineEntries = [...inlineSrc.matchAll(/(['"]?)([\w-]+)\1:\s*(\w+)/g)].map((m) => ({
  kind: m[2],
  component: m[3],
}));

const keptFigures = figureEntries.filter((e) => usedIds.has(e.id));
const keptInline = inlineEntries.filter((e) => usedKinds.has(e.kind));

const missing = [...usedIds].filter((id) => !figureEntries.some((e) => e.id === id));
if (missing.length) {
  console.warn(`warning: content references unregistered figure ids: ${missing.join(', ')}`);
}

// Identifiers referenced by kept entries → which imports to keep.
const referenced = new Set();
for (const e of keptFigures) {
  for (const m of e.body.matchAll(/:\s*(\w+)/g)) referenced.add(m[1]);
}
for (const e of keptInline) referenced.add(e.component);

// Local binding names of an import's named specifiers: the alias when
// `A as b`, otherwise the exported name itself.
function namedLocals(named) {
  return named
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const m = s.match(/^(\w+)(?:\s+as\s+(\w+))?$/);
      return m ? m[2] || m[1] : null;
    })
    .filter(Boolean);
}

const keptImports = imports.filter((imp) => {
  const file = path.basename(imp.path);
  if (FIGURE_EXCLUDE.has(`${file}.tsx`) || FIGURE_EXCLUDE.has(file)) return false;
  if (imp.def && referenced.has(imp.def)) return true;
  return namedLocals(imp.named).some((n) => referenced.has(n));
});

// ---------------------------------------------------------------- figures

fs.rmSync(figuresDest, { recursive: true, force: true });
fs.mkdirSync(figuresDest, { recursive: true });

// Rewrite template-runtime imports in a copied figure file. `depth` is
// the file's directory depth below figures/ (0 = figures/X.tsx).
function rewriteImports(code, depth) {
  const up = '../'.repeat(depth); // back to figures/
  const runtime = `${'../'.repeat(depth + 2)}runtime`; // src/essays/runtime
  return code
    // figures/lib/data + figures/lib/params are runtime-owned
    .replace(/from\s+'(?:\.{1,2}\/)+lib\/data'/g, `from '${runtime}/lib/data'`)
    .replace(/from\s+'(?:\.{1,2}\/)+lib\/params'/g, `from '${runtime}/lib/params'`)
    // template components / store / lib (imported by figures via ../)
    .replace(/from\s+'(?:\.{1,2}\/)+components\/(\w+)'/g, `from '${runtime}/components/$1'`)
    .replace(/from\s+'(?:\.{1,2}\/)+store'/g, `from '${runtime}/store'`)
    .replace(/from\s+'(?:\.{1,2}\/)+lib\/directive-handler'/g, `from '${runtime}/directive-handler'`)
    .replace(/from\s+'(?:\.{1,2}\/)+lib\/types'/g, `from '${runtime}/types'`)
    .replace(/from\s+'(?:\.{1,2}\/)+lib\/bakedFigures'/g, `from '${runtime}/EssayContext'`)
    // registry stays local to the essay
    .replace(/from\s+'(?:\.{1,2}\/)+registry'/g, `from '${up === '' ? './' : up}registry'`);
}

const copiedFiles = [];
function copyFigureFile(relPath) {
  const from = path.join(SRC, 'src', 'figures', relPath);
  if (!fs.existsSync(from)) {
    console.warn(`warning: figure source missing: ${relPath}`);
    return;
  }
  const to = path.join(figuresDest, relPath);
  fs.mkdirSync(path.dirname(to), { recursive: true });
  const depth = relPath.split('/').length - 1;
  const code = rewriteImports(fs.readFileSync(from, 'utf8'), depth);
  fs.writeFileSync(to, code);
  copiedFiles.push(relPath);

  // Pull in local helpers this figure imports — anything still relative
  // after the rewrite (runtime-owned imports now point at ../runtime and
  // the registry stays registry) that resolves inside src/figures/,
  // e.g. ./lib/geometry, ./_twoMoons, ../_twoMoons from inline/.
  for (const m of code.matchAll(/(?:from|import)\s+'(\.{1,2}\/[^']+)'/g)) {
    const spec = m[1];
    if (spec.includes('/runtime')) continue;
    if (path.basename(spec) === 'registry') continue;
    const resolved = path.normalize(path.join(path.dirname(relPath), spec));
    if (resolved.startsWith('..')) continue; // escapes figures/
    for (const ext of ['.ts', '.tsx']) {
      const rel = resolved + ext;
      if (
        !RUNTIME_LIB.has(path.basename(rel)) &&
        fs.existsSync(path.join(SRC, 'src', 'figures', rel)) &&
        !copiedFiles.includes(rel)
      ) {
        copyFigureFile(rel);
      }
    }
  }
}

function importRelToFile(imp) {
  // './BallAndCone' → 'BallAndCone.tsx', './inline/MiniSpark' → 'inline/MiniSpark.tsx'
  const rel = imp.replace(/^\.\//, '');
  for (const ext of ['.tsx', '.ts']) {
    if (fs.existsSync(path.join(SRC, 'src', 'figures', rel + ext))) return rel + ext;
  }
  return null;
}

for (const imp of keptImports) {
  const file = importRelToFile(imp.path);
  if (file) copyFigureFile(file);
}

// Regenerate registry.ts with only the used entries.
const runtimeFromFigures = '../../runtime';
const importLines = keptImports.map((imp) => {
  const named = imp.named.trim();
  const namedClause = named ? `{ ${named.replace(/\s+/g, ' ').replace(/,\s*$/, '')} }` : '';
  const clauses = [imp.def, namedClause].filter(Boolean).join(', ');
  return `import ${clauses} from '${imp.path}';`;
});

const figuresBody = keptFigures
  .map((e) => {
    const body = e.body
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .join(', ');
    return `  '${e.id}': { ${body} },`;
  })
  .join('\n');

const inlineBody = keptInline
  .map((e) => `  '${e.kind}': ${e.component} as ComponentType<Record<string, unknown>>,`)
  .join('\n');

const registryOut = `// Generated by scripts/import-moonshine.mjs — regenerated on every
// re-sync. Only figures referenced by the essay's markdown are included.
import type { ComponentType } from 'react';
import type { FigureRegistry, InlineFigureRegistry } from '${runtimeFromFigures}/types';
${importLines.join('\n')}

export type { FigureProps, FigureEntry, ParamHint } from '${runtimeFromFigures}/types';

export const figures: FigureRegistry = {
${figuresBody}
};

export const inlineFigures: InlineFigureRegistry = {
${inlineBody}
};
`;
fs.writeFileSync(path.join(figuresDest, 'registry.ts'), registryOut);
console.log(`figures: copied ${copiedFiles.length} file(s), registry has ${keptFigures.length} block + ${keptInline.length} inline entries`);

// ---------------------------------------------------------------- fixtures

fs.rmSync(dataDest, { recursive: true, force: true });
if (fs.existsSync(path.join(SRC, 'public', 'data'))) {
  fs.mkdirSync(dataDest, { recursive: true });
  fs.cpSync(path.join(SRC, 'public', 'data'), dataDest, { recursive: true });
  const n = fs.readdirSync(dataDest).length;
  console.log(`fixtures: copied ${n} file(s) to public/essays/${slug}/data/`);
} else {
  console.log('fixtures: no public/data directory in source project');
}

// ---------------------------------------------------------------- index.tsx

const indexPath = path.join(essayDir, 'index.tsx');
if (!fs.existsSync(indexPath)) {
  fs.writeFileSync(
    indexPath,
    `import { MoonshineEssay, loadArticles } from '../runtime';
import { figures, inlineFigures } from './figures/registry';

const modules = import.meta.glob('./content/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
});
const articles = loadArticles(modules as Record<string, string>);

export default function Essay() {
  return (
    <MoonshineEssay
      slug="${slug}"
      articles={articles}
      figures={figures}
      inlineFigures={inlineFigures}
    />
  );
}
`
  );
  console.log(`created ${path.relative(REPO, indexPath)}`);
} else {
  console.log(`kept existing ${path.relative(REPO, indexPath)}`);
}

// ---------------------------------------------------------------- manifest

const manifestPath = ['manifest.jsx', 'manifest.js', 'manifest.ts', 'manifest.tsx']
  .map((f) => path.join(REPO, 'src', 'essays', f))
  .find((p) => fs.existsSync(p));
if (manifestPath && !fs.readFileSync(manifestPath, 'utf8').includes(`'${slug}'`)) {
  console.log(`\nREMINDER: '${slug}' is not in ${path.relative(REPO, manifestPath)} — add an entry like:
  {
    slug: '${slug}',
    title: '<title from frontmatter>',
    description: '<description from frontmatter>',
    date: '${new Date().toISOString().slice(0, 10)}',
    kind: 'moonshine',
    load: () => import('./${slug}'),
  },`);
} else if (!manifestPath) {
  console.log('\nREMINDER: no src/essays/manifest.* found — create one and register this essay.');
}

console.log('\ndone.');
