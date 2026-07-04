# Essays

Long-form interactive articles published on latent.estate under `/essays/<slug>`.
Two kinds live here:

- **Legacy essays** — hand-written JSX pages (`nav-by-sim.jsx`, `touch-tokens.jsx`)
  that use the Essays components in `src/components/Essays/`.
- **Moonshine essays** — articles authored in a moonshine "still" project
  (markdown prose + React figures) and imported into this repo via
  `scripts/import-moonshine.mjs`.

Every essay is registered in `manifest.jsx` and lazy-loaded: its code is a
separate chunk that only downloads when the route is visited. `App.jsx`
builds the routes from the manifest and `pages/Home.jsx` renders the Essays
section from it.

## Layout

```
src/essays/
  manifest.jsx          essay registry (slug, title, kind, load())
  runtime/              the moonshine article runtime (shared, port of the
                        moonshine still template's read path — TypeScript)
  <slug>/               one directory per moonshine essay
    index.tsx           routable component: content + registry + runtime
    content/*.md        the article markdown (frontmatter + directives)
    figures/            the essay's React figures + generated registry.ts
  nav-by-sim.jsx        legacy essay (kept as-is)
  touch-tokens.jsx      legacy essay (hidden: unpublished)
  cached/initial.json   pre-baked API responses for the legacy essays
                        (lazy-loaded by src/lib/cachedApiService.js)

public/essays/<slug>/data/   JSON fixtures fetched at runtime by figures
```

## Publishing a moonshine article

1. Author the article as a moonshine "still" project (the `$still` skill),
   e.g. at `~/.agent/moonshine/<project>/`.
2. Import it:

   ```sh
   node scripts/import-moonshine.mjs ~/.agent/moonshine/<project> --slug <slug>
   ```

   The script:
   - copies `content/*.md` → `src/essays/<slug>/content/`
   - copies only the figures the markdown actually references
     (`:::figure{id=...}` / `:inline-viz{kind=...}`) into
     `src/essays/<slug>/figures/`, rewriting template imports
     (`./lib/data`, `./lib/params`, `../components/*`, `../store`) to point
     at `src/essays/runtime/`
   - regenerates `figures/registry.ts` with only the used entries
   - copies `public/data/**` → `public/essays/<slug>/data/`
   - writes a stub `index.tsx` if one doesn't exist (existing ones are kept)
   - never copies the template runtime or its authoring chrome (edit HUD,
     knobs, feedback, velite config, DiagramFigure/FlowDiagram)

3. Add the essay to `manifest.jsx` (the script prints a ready-to-paste stub
   if the slug is missing):

   ```js
   {
     slug: '<slug>',
     title: '...',
     description: '...',
     date: 'YYYY-MM-DD',
     kind: 'moonshine',        // or 'moonshine-series'
     load: () => import('./<slug>'),
   },
   ```

4. `npm run dev` and check `/essays/<slug>`.

Re-running the script re-syncs content, figures and fixtures (it fully
overwrites those directories), so the moonshine project stays the source of
truth for prose and figures while this repo owns the manifest and `index.tsx`.

### Series

A project with multiple markdown files becomes a series: give each file
`series`, `order` (and optionally a `series-index.md` intro) in frontmatter,
set `kind: 'moonshine-series'` in the manifest, and the runtime renders a
card index at `/essays/<slug>` with articles at `/essays/<slug>/<article>`.

## Adding a legacy / custom essay

Write a routable component anywhere under `src/essays/` (default export),
and add a manifest entry with `kind: 'legacy'` and `load: () => import(...)`.
That's it — routes and the Home card come from the manifest. Set
`hidden: true` to keep it routable but off the Home page.

## What the runtime provides

`src/essays/runtime/` is the read-path of the moonshine still template
(authoring chrome removed):

- `MoonshineEssay` — top-level routable component; takes `slug`, parsed
  `articles`, and the figure registries, provides the `EssayContext`
  (fixture base URL, route base path) and handles single-article vs series.
- `Article` — renders markdown at runtime with react-markdown + remark-gfm,
  remark-math, remark-directive (custom directives) and rehype-katex (math).
- `Figure`, `Term`, `InlineViz`, `LazyIsland`, `SeriesIndex`,
  `MoonshineFooter` — the directive-backed components. Figures mount lazily
  via IntersectionObserver.
- `store` (zustand) — term→figure highlight state (`useArticleStore`,
  `useFigureHighlight`): hovering a `:term` softly highlights its figure,
  clicking pins the highlight and scrolls the figure into view.
- `loadArticles` / `parseFrontmatter` — turn an
  `import.meta.glob('./content/*.md', { query: '?raw', import: 'default', eager: true })`
  result into `ArticleData[]` (no Velite, no build step).
- `lib/data` — `useFixture(name)` fetches JSON from
  `public/essays/<slug>/data/<name>`; `lib/params` — `num`/`bool`/`str`
  coercion for directive attributes.
- `styles/tokens.scss` + `styles/article.scss` — the article look, scoped
  under `.mn-article-root` so it never leaks into the rest of the app
  (`MoonshineEssay` adds that wrapper). KaTeX CSS is imported inside the
  runtime chunk.

## Directive cheat-sheet

Markdown is parsed at render time; remark-directive syntax connects prose
to figures:

```markdown
:::figure{id=joke-pairs}
Caption text (markdown allowed). The id must exist in the essay's
figures/registry.ts. Extra attributes pass to the component as string
props: :::figure{id=ball-and-cone concentration=8}
:::

A sentence with a :term[linked term]{to=joke-pairs} that highlights its
figure on hover and pins + scrolls on click. Use `to=figure-id.part-id`
to target an element inside a figure, or omit `{to=...}` for a plain
vocabulary call-out.

An inline visual mid-sentence: :inline-viz{kind=mini-spark value=0.8}
(kind comes from the essay's inlineFigures registry).

Math works too: $\cos\theta$ inline, $$ ... $$ display (KaTeX).
```
