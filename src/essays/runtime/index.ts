// Moonshine essay runtime — the read-path of the moonshine "still"
// article template, adapted to live inside latent-scope-frontend.
// See src/essays/README.md for the architecture and publishing flow.

export { default as MoonshineEssay } from './MoonshineEssay';
export { default as Article } from './components/Article';
export { default as Figure } from './components/Figure';
export { default as Term } from './components/Term';
export { default as InlineViz } from './components/InlineViz';
export { default as LazyIsland } from './components/LazyIsland';
export { default as SeriesIndex } from './components/SeriesIndex';
export { default as MoonshineFooter } from './components/MoonshineFooter';
export { default as directiveHandler } from './directive-handler';
export { EssayProvider, useEssay, getBakedFigure } from './EssayContext';
export { useArticleStore, useFigureHighlight, parseRef } from './store';
export { loadArticles, parseFrontmatter } from './loadArticles';
export { useFixture, FixtureFallback } from './lib/data';
export { num, bool, str } from './lib/params';
export type {
  ArticleData,
  BakedFigure,
  FigureEntry,
  FigureProps,
  FigureRegistry,
  InlineFigureRegistry,
  ParamHint,
} from './types';
