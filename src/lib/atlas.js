// Level-of-detail logic for the image-scope atlas pyramid: which resolution
// (r64…r1024) to show at the current zoom, and when individual points should
// be drawn back on top.
//
// On-screen size of one grid cell = width * k / R (the [-1,1] box maps to
// `width` px at k=1 and scales with the d3-zoom k). A finer grid becomes the
// target once its cells are big enough on screen to be legible.
// Ported from latent-scope's web/src/lib/atlasLod.js, with one change: when
// even the coarsest grid's cells are below the threshold (zoomed out), we fall
// back to the coarsest resolution instead of returning null — the hosted app
// always shows images for image scopes rather than switching to a heatmap.

// A (finer) resolution becomes the target once its cells reach this many
// on-screen px. Source cells are cell_size px (32 by default), so each level
// is shown from ~0.5x to ~1x its native size before the next takes over.
export const MIN_CELL_PX = 16;

// How big the finest resolution's cells may grow on screen before individual
// points are drawn on top again (maxZoom here is 40, so with a ~600-900px pane
// the finest r1024 cells reach ~23-35px at full zoom — 20px means the dots
// reappear on the last stretch of zoom).
export const POINTS_HANDOFF_CELL_PX = 20;

/**
 * @param {number} k - current zoom (transform.k)
 * @param {number} width - viewport width in px
 * @param {number[]} resolutions - available grid resolutions (any order)
 * @returns {{resolution: number|null, deepest: boolean}}
 *   resolution: finest grid whose cells are >= minCellPx on screen, falling
 *     back to the coarsest grid when zoomed out. null only if no resolutions.
 *   deepest: zoomed in past the finest grid's handoff - points should appear.
 */
export function atlasLod(
  k,
  width,
  resolutions,
  minCellPx = MIN_CELL_PX,
  pointsHandoffPx = POINTS_HANDOFF_CELL_PX
) {
  const res = [...(resolutions || [])].sort((a, b) => a - b);
  if (!res.length || !width || !k) {
    return { resolution: null, deepest: false };
  }
  let resolution = res[0]; // coarsest fallback so images always show
  for (const r of res) {
    if ((width * k) / r >= minCellPx) resolution = r; // ascending -> keep finest that fits
  }
  const finest = res[res.length - 1];
  const deepest = (width * k) / finest >= pointsHandoffPx;
  return { resolution, deepest };
}
