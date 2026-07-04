import type { ComponentType } from 'react';

// The shape each parsed markdown article takes (frontmatter + body).
// Mirrors what Velite emitted in the original moonshine template, minus
// the authoring-only `path` field.
export type ArticleData = {
  title: string;
  description?: string;
  series?: string;
  order?: number;
  tags?: string[];
  body: string;
  slug: string;
};

// Props every block figure receives from <Figure>.
export type FigureProps = {
  // The registry id this figure was referenced under. Pass it to
  // useFigureHighlight(figureId) so term→part highlighting can't fall
  // out of sync with the registry key or the markdown id.
  figureId: string;
} & Record<string, unknown>;

// Explicit slider bounds for a numeric parameter (kept for compatibility
// with figures that export PARAM_HINTS; the dev knob panel itself is not
// part of this runtime).
export type ParamHint = {
  min?: number;
  max?: number;
  step?: number;
};

export type FigureEntry = {
  component: ComponentType<FigureProps>;
  // Vertical space (px) reserved before the figure lazily mounts.
  // Prevents layout shift and makes term-pin auto-scroll land correctly
  // for below-fold figures. Estimate generously; exact is not required.
  height?: number;
  // Break out of the article column (maps to the .figure-wide class).
  wide?: boolean;
  defaults?: Record<string, number | boolean | string>;
  paramHints?: Record<string, ParamHint>;
};

export type FigureRegistry = Record<string, FigureEntry>;
export type InlineFigureRegistry = Record<string, ComponentType<Record<string, unknown>>>;

// Author-owned figure state baked from content/figures/*.json in the
// moonshine template. Essays that need it pass the parsed JSON array
// through the EssayProvider.
export type BakedFigure = {
  figure: string;
  layout?: Record<string, { x: number; y: number }>;
  viewport?: { x: number; y: number; zoom: number };
};
