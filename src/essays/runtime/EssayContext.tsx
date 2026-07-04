import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import type { BakedFigure, FigureRegistry, InlineFigureRegistry } from './types';

// Per-essay wiring: which figure components the markdown directives can
// reference, where JSON fixtures live, and the route prefix used for
// series prev/next links. The runtime components read this instead of
// importing a global registry, so multiple essays can coexist in one app.

export type EssayContextValue = {
  // Essay slug (route segment under /essays/).
  slug: string;
  // Block figure registry: id → component entry.
  figures: FigureRegistry;
  // Inline figure registry for :inline-viz{kind=...}.
  inlineFigures: InlineFigureRegistry;
  // Base URL prefix for useFixture() fetches, WITHOUT trailing slash,
  // e.g. `${import.meta.env.BASE_URL}essays/anisotropy/data`.
  fixtureBase: string;
  // Route path prefix for article links within the essay, e.g.
  // `/essays/anisotropy`. Series articles link to `${basePath}/${slug}`.
  basePath: string;
  // Optional author-arranged figure layouts (content/figures/*.json in
  // the moonshine template).
  bakedFigures?: BakedFigure[];
};

const EssayContext = createContext<EssayContextValue | null>(null);

export function EssayProvider({
  value,
  children,
}: {
  value: EssayContextValue;
  children: ReactNode;
}) {
  return <EssayContext.Provider value={value}>{children}</EssayContext.Provider>;
}

export function useEssay(): EssayContextValue {
  const ctx = useContext(EssayContext);
  if (!ctx) {
    throw new Error('useEssay must be used inside an <EssayProvider> (see MoonshineEssay)');
  }
  return ctx;
}

export function getBakedFigure(
  baked: BakedFigure[] | undefined,
  figureId: string
): BakedFigure | null {
  return baked?.find((d) => d.figure === figureId) ?? null;
}
