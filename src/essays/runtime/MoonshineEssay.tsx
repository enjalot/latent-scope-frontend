import { Navigate, useParams } from 'react-router-dom';
// KaTeX styles for math rendered by rehype-katex ($...$ and $$...$$ in
// markdown). Imported here so they live in the essay chunk, not the main
// app bundle. All katex rules are .katex-prefixed, so no bleed.
import 'katex/dist/katex.min.css';
import './styles/tokens.scss';
import './styles/article.scss';

import { EssayProvider } from './EssayContext';
import Article from './components/Article';
import SeriesIndex from './components/SeriesIndex';
import type {
  ArticleData,
  BakedFigure,
  FigureRegistry,
  InlineFigureRegistry,
} from './types';

type Props = {
  // Essay slug: the route segment under /essays/ and the directory name
  // under public/essays/<slug>/data for fixtures.
  slug: string;
  // Parsed articles (see loadArticles).
  articles: ArticleData[];
  figures: FigureRegistry;
  inlineFigures?: InlineFigureRegistry;
  bakedFigures?: BakedFigure[];
};

// Routable component assembling the moonshine article runtime for one
// essay. Mount it at both `/essays/<slug>` and `/essays/<slug>/:article`:
// a single-article essay renders that article at the base path; a series
// renders its index at the base path and articles at `/:article`.
export default function MoonshineEssay({
  slug,
  articles,
  figures,
  inlineFigures = {},
  bakedFigures,
}: Props) {
  const { article: articleSlug } = useParams();
  const basePath = `/essays/${slug}`;
  // BASE_URL always ends with "/" (it's "/" in dev, the deploy origin in
  // production builds), so appending the essay data path works directly.
  const fixtureBase = `${import.meta.env.BASE_URL}essays/${slug}/data`;

  const value = {
    slug,
    figures,
    inlineFigures,
    fixtureBase,
    basePath,
    bakedFigures,
  };

  let content: React.ReactNode;
  if (articleSlug) {
    const article = articles.find((a) => a.slug === articleSlug);
    content = article ? (
      <Article article={article} all={articles} />
    ) : (
      <Navigate to={basePath} replace />
    );
  } else if (articles.length === 1) {
    content = <Article article={articles[0]} all={articles} />;
  } else {
    content = <SeriesIndex articles={articles} />;
  }

  return (
    <EssayProvider value={value}>
      <div className="mn-article-root">{content}</div>
    </EssayProvider>
  );
}
