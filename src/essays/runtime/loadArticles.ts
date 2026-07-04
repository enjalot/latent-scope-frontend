import type { ArticleData } from './types';

// Tiny frontmatter parser + article loader. Replaces Velite from the
// moonshine template: essays pass the result of
//
//   import.meta.glob('./content/*.md', { query: '?raw', import: 'default', eager: true })
//
// and get back parsed ArticleData objects. The parser covers the YAML
// subset moonshine articles actually use: scalar `key: value` pairs
// (strings, numbers), and block lists (`tags:` followed by `- item`
// lines). Nothing nested beyond that.

function parseScalar(raw: string): string | number {
  let v = raw.trim();
  if (
    (v.startsWith("'") && v.endsWith("'") && v.length >= 2) ||
    (v.startsWith('"') && v.endsWith('"') && v.length >= 2)
  ) {
    return v.slice(1, -1);
  }
  if (v !== '' && !Number.isNaN(Number(v))) return Number(v);
  return v;
}

export function parseFrontmatter(md: string): {
  data: Record<string, unknown>;
  body: string;
} {
  const m = md.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!m) return { data: {}, body: md };

  const data: Record<string, unknown> = {};
  const lines = m[1].split(/\r?\n/);
  let listKey: string | null = null;

  for (const line of lines) {
    if (!line.trim() || line.trim().startsWith('#')) continue;

    // List item under the current key: `  - value`
    const item = line.match(/^\s+-\s+(.*)$/);
    if (item && listKey) {
      (data[listKey] as unknown[]).push(parseScalar(item[1]));
      continue;
    }

    const kv = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!kv) continue;
    const [, key, rawValue] = kv;
    if (rawValue.trim() === '') {
      // Could be the start of a block list.
      data[key] = [];
      listKey = key;
    } else {
      data[key] = parseScalar(rawValue);
      listKey = null;
    }
  }

  return { data, body: md.slice(m[0].length) };
}

// modules: filename → raw markdown source (from an eager raw glob).
export function loadArticles(modules: Record<string, string>): ArticleData[] {
  return Object.entries(modules).map(([file, raw]) => {
    const { data, body } = parseFrontmatter(raw);
    const filename = file.split('/').pop() || file;
    const fallbackSlug = filename.replace(/\.md$/, '');
    return {
      title: typeof data.title === 'string' ? data.title : fallbackSlug,
      description: typeof data.description === 'string' ? data.description : undefined,
      series: typeof data.series === 'string' ? data.series : undefined,
      order: typeof data.order === 'number' ? data.order : undefined,
      tags: Array.isArray(data.tags) ? (data.tags as string[]) : undefined,
      slug: typeof data.slug === 'string' && data.slug ? data.slug : fallbackSlug,
      body,
    };
  });
}
