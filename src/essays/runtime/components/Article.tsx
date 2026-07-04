import { useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkDirective from 'remark-directive';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { Link } from 'react-router-dom';
import directiveHandler from '../directive-handler';
import { useArticleStore } from '../store';
import { useEssay } from '../EssayContext';
import Figure from './Figure';
import Term from './Term';
import InlineViz from './InlineViz';
import MoonshineFooter from './MoonshineFooter';
import type { ArticleData } from '../types';

type Props = {
  article: ArticleData;
  all: ArticleData[];
};

export default function Article({ article, all }: Props) {
  const clearPinned = useArticleStore((s) => s.clearPinned);
  const { basePath } = useEssay();

  useEffect(() => {
    document.title = article.title;
  }, [article.title]);

  // Escape releases a pinned term highlight, matching the
  // "click again to unpin" affordance with a keyboard path.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') clearPinned();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [clearPinned]);

  // Sibling navigation: if this article is part of a series, surface
  // prev/next links in the footer.
  const siblings = article.series
    ? all
        .filter((a) => a.series === article.series)
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    : [];
  const idx = siblings.findIndex((a) => a.slug === article.slug);
  const prev = idx > 0 ? siblings[idx - 1] : null;
  const next = idx >= 0 && idx < siblings.length - 1 ? siblings[idx + 1] : null;

  return (
    <article className="article">
      <header>
        <h1>{article.title}</h1>
        {article.description && <p className="lede">{article.description}</p>}
      </header>

      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath, remarkDirective, directiveHandler]}
        rehypePlugins={[rehypeKatex]}
        // react-markdown's Components type only enumerates known HTML
        // tag names; our directive handler emits dashed custom tag
        // names (mn-figure, mn-term, mn-inline-viz) that react-markdown
        // happily looks up at runtime, so we widen the type here.
        components={
          {
            'mn-figure': Figure,
            'mn-term': Term,
            'mn-inline-viz': InlineViz,
          } as Record<string, unknown>
        }
      >
        {article.body}
      </ReactMarkdown>

      {(prev || next || article.series) && (
        <footer className="article-footer">
          {article.series && (
            <p>
              Part of <Link to={basePath}>this series</Link>.
            </p>
          )}
          <p>
            {prev && (
              <>
                ← <Link to={`${basePath}/${prev.slug}`}>{prev.title}</Link>
              </>
            )}
            {prev && next && <span style={{ margin: '0 1rem' }}>·</span>}
            {next && (
              <>
                <Link to={`${basePath}/${next.slug}`}>{next.title}</Link> →
              </>
            )}
          </p>
        </footer>
      )}

      <MoonshineFooter />
    </article>
  );
}
