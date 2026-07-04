import { useMemo, useState } from 'react'
import * as d3 from 'd3'
import type { FigureProps } from './registry'
import { num } from '../../runtime/lib/params'
import { useFigureHighlight } from '../../runtime/store'

// Faithful React ports of docs/dim-reduction/06-density.html.

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
function gaussian(rng: () => number) {
  const u = 1 - rng(), v = rng()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

// Parse a comma-separated string of numbers (e.g. "0.3,1.0,2.5") into an
// array, falling back to `fallback` if any token is non-finite.
function numList(value: unknown, fallback: number[]): number[] {
  if (typeof value !== 'string') return fallback
  const parts = value.split(',').map((s) => Number(s.trim()))
  return parts.length > 0 && parts.every((n) => Number.isFinite(n)) ? parts : fallback
}

type Pane = { id: string; title: string; note: string; emb: [number, number][] }

function PaneRow({
  panes,
  colors,
  classOf,
  groupLabels,
  activePart,
  showSpreadRing = false,
  hoverHint,
  totalW = 680,
  totalH = 360,
  radius = 2.8,
}: {
  panes: Pane[]
  colors: string[]
  classOf: (i: number) => number
  // Human-readable name per class, used in the hover readout.
  groupLabels: string[]
  activePart?: string | null
  // Draw a translucent ring at each group's centroid sized to its on-screen
  // spread — for the density figure this makes the UMAP "lie" visible: the
  // ring balloons in the middle pane and shrinks again under densMAP.
  showSpreadRing?: boolean
  hoverHint?: string
  totalW?: number
  totalH?: number
  radius?: number
}) {
  const paneW = totalW / panes.length
  // Linked hover: hovering any point sets the active GROUP (class), which
  // highlights that group across every pane so the reader can trace the same
  // data through original → distorted → preserved.
  const [hoverGroup, setHoverGroup] = useState<number | null>(null)
  const nGroups = colors.length

  // Precompute per-pane screen coords + per-group centroid/spread so the
  // ring and readout stay in sync with the dots.
  const paneGeom = panes.map((pane) => {
    const ex = d3.extent(pane.emb, (d) => d[0]) as [number, number]
    const ey = d3.extent(pane.emb, (d) => d[1]) as [number, number]
    const epx = Math.max(0.1, (ex[1] - ex[0]) * 0.1)
    const epy = Math.max(0.1, (ey[1] - ey[0]) * 0.1)
    const innerX = d3.scaleLinear([ex[0] - epx, ex[1] + epx], [16, paneW - 16])
    const innerY = d3.scaleLinear([ey[0] - epy, ey[1] + epy], [totalH - 20, 44])
    const screen = pane.emb.map((p) => [innerX(p[0]), innerY(p[1])] as [number, number])
    // centroid + RMS radius per group, in screen pixels
    const cx = new Array(nGroups).fill(0)
    const cy = new Array(nGroups).fill(0)
    const cn = new Array(nGroups).fill(0)
    screen.forEach((s, i) => { const g = classOf(i); cx[g] += s[0]; cy[g] += s[1]; cn[g]++ })
    for (let g = 0; g < nGroups; g++) { if (cn[g]) { cx[g] /= cn[g]; cy[g] /= cn[g] } }
    // Robust "typical radius" per group: the 70th-percentile distance from
    // the centroid. RMS spread is too outlier-sensitive — a couple of points
    // flung out by the force layout would balloon the ring and falsely make a
    // cluster look spread (especially in the UMAP pane, where the lesson is
    // that all clusters end up the SAME size).
    const dists: number[][] = Array.from({ length: nGroups }, () => [])
    screen.forEach((s, i) => { const g = classOf(i); dists[g].push(Math.hypot(s[0] - cx[g], s[1] - cy[g])) })
    const sr = new Array(nGroups).fill(0)
    for (let g = 0; g < nGroups; g++) {
      if (!dists[g].length) continue
      dists[g].sort((a, b) => a - b)
      sr[g] = dists[g][Math.floor(0.7 * (dists[g].length - 1))]
    }
    // Mean cluster spread WITHIN this pane — the honest cross-pane metric is
    // each cluster's spread relative to its pane's average (absolute pixels
    // aren't comparable since every pane auto-scales to its own extent).
    let sm = 0, smc = 0
    for (let g = 0; g < nGroups; g++) if (cn[g]) { sm += sr[g]; smc++ }
    const spreadMean = smc ? sm / smc : 1
    return { screen, cx, cy, spread: sr, spreadMean }
  })

  return (
    <div>
      <svg
        width="100%"
        height={totalH}
        viewBox={`0 0 ${totalW} ${totalH}`}
        preserveAspectRatio="xMidYMid meet"
        onMouseLeave={() => setHoverGroup(null)}
      >
        {panes.map((pane, k) => {
          const geom = paneGeom[k]
          const active = activePart != null && activePart === pane.id
          const dimmed = activePart != null && activePart !== pane.id
          return (
            <g key={k} transform={`translate(${k * paneW},0)`} opacity={dimmed ? 0.7 : 1}>
              <text x={paneW / 2} y={16} textAnchor="middle" style={{ fontSize: 12, fontWeight: 700 }} fill="var(--text)">{pane.title}</text>
              <text x={paneW / 2} y={32} textAnchor="middle" style={{ fontSize: 10 }} fill="var(--text-3)">{pane.note}</text>
              <rect
                x={12}
                y={40}
                width={paneW - 24}
                height={totalH - 60}
                fill="var(--bg)"
                stroke={active ? 'var(--accent)' : 'var(--border)'}
                strokeWidth={active ? 2 : 1}
                rx={4}
              />
              {/* Spread rings (density figure): one per cluster, always on, so
                  the "lie" is visible at a glance — three same-size rings in the
                  middle pane (UMAP flattens) vs. clearly varied rings on the
                  outside panes (real / densMAP preserve). */}
              {showSpreadRing && colors.map((c, g) =>
                geom.spread[g] > 0 ? (
                  <circle
                    key={`ring-${g}`}
                    cx={geom.cx[g]}
                    cy={geom.cy[g]}
                    r={Math.max(6, geom.spread[g] * 1.45)}
                    fill="none"
                    stroke={c}
                    strokeWidth={hoverGroup === g ? 2 : 1.25}
                    strokeDasharray="3 3"
                    opacity={hoverGroup == null ? 0.45 : hoverGroup === g ? 0.95 : 0.08}
                    style={{ transition: 'opacity 150ms ease' }}
                  />
                ) : null,
              )}
              {pane.emb.map((p, i) => {
                const g = classOf(i)
                const muted = hoverGroup != null && hoverGroup !== g
                const dotOpacity = muted ? 0.12 : active ? 1 : dimmed ? 0.25 : 0.85
                return (
                  <circle
                    key={i}
                    cx={geom.screen[i][0]}
                    cy={geom.screen[i][1]}
                    r={hoverGroup === g ? radius + 0.6 : radius}
                    fill={colors[g]}
                    opacity={dotOpacity}
                    style={{ transition: 'opacity 150ms ease' }}
                  />
                )
              })}
              {/* Enlarged transparent hit targets so the small dots are easy
                  to hover; they set the linked group on enter. */}
              {pane.emb.map((p, i) => (
                <circle
                  key={`hit-${i}`}
                  cx={geom.screen[i][0]}
                  cy={geom.screen[i][1]}
                  r={Math.max(radius + 4, 6)}
                  fill="transparent"
                  style={{ cursor: 'pointer' }}
                  onMouseEnter={() => setHoverGroup(classOf(i))}
                />
              ))}
              {/* Per-group readout: which group + its on-screen spread in
                  this pane, so the comparison across panes is concrete. */}
              {hoverGroup != null && (
                <text x={paneW / 2} y={totalH - 6} textAnchor="middle" style={{ fontSize: 10, fontWeight: 600 }} fill={colors[hoverGroup]}>
                  {showSpreadRing
                    ? `${groupLabels[hoverGroup]} · ${(geom.spread[hoverGroup] / geom.spreadMean).toFixed(1)}× avg spread`
                    : groupLabels[hoverGroup]}
                </text>
              )}
            </g>
          )
        })}
      </svg>
      {hoverHint && (
        <div style={{ fontSize: 11, color: 'var(--text-3)', textAlign: 'center', marginTop: 4, minHeight: 14 }}>
          {hoverGroup == null ? hoverHint : ' '}
        </div>
      )}
    </div>
  )
}

// --------- Figure 1: density preservation comparison ---------

// Three Gaussian clusters in high-D with deliberately different spreads;
// the figure contrasts how a uniform UMAP-style layout flattens those
// densities vs. how a densMAP-style layout preserves them.
export const DENSITY_DEFAULTS = {
  seed: 7, // RNG seed for cluster sampling + layouts
  dim: 10, // dimensionality of the synthetic high-D space
  spreads: '0.3,1.0,2.5', // per-cluster Gaussian std dev (tight, medium, sparse)
  sizes: '60,40,50', // point count per cluster
  knn: 10, // neighbors for the density proxy + graph
  simSteps: 400, // force-sim iterations (settles the layout)
}

// dim needs a ≥2 floor (PCA projects to 2 components) and the heuristic's
// 500 ceiling is pointless; knn must stay ≥2 and well below the ~150-point
// dataset (heuristic would offer 500).
export const DENSITY_HINTS = {
  dim: { min: 2, max: 50 },
  knn: { min: 2, max: 30 },
}

export function DensityFigure(props: FigureProps) {
  const seed = num(props.seed, DENSITY_DEFAULTS.seed)
  const dim = num(props.dim, DENSITY_DEFAULTS.dim)
  const spreads = numList(props.spreads, numList(DENSITY_DEFAULTS.spreads, []))
  const sizes = numList(props.sizes, numList(DENSITY_DEFAULTS.sizes, []))
  const knn = num(props.knn, DENSITY_DEFAULTS.knn)
  const simSteps = num(props.simSteps, DENSITY_DEFAULTS.simSteps)
  const { activePart } = useFigureHighlight(props.figureId as string)

  const model = useMemo(
    () => buildDensityModel({ seed, dim, spreads, sizes, knn, simSteps }),
    [seed, dim, spreads.join(','), sizes.join(','), knn, simSteps],
  )
  const colors = ['var(--accent)', 'var(--warm)', 'var(--green)']
  const groupLabels = ['tight cluster', 'medium cluster', 'sparse cluster']
  const panes: Pane[] = [
    { id: 'original', title: 'original (PCA view)', note: 'densities are real', emb: model.inputEmb },
    { id: 'umap', title: 'UMAP-like', note: 'densities are lost', emb: model.umapEmb },
    { id: 'densmap', title: 'densMAP-like', note: 'densities preserved', emb: model.densEmb },
  ]
  return (
    <PaneRow
      panes={panes}
      colors={colors}
      groupLabels={groupLabels}
      classOf={(i) => model.pts[i].c}
      activePart={activePart}
      showSpreadRing
      hoverHint="Hover a cluster to trace it across all three panes — watch the ring balloon under UMAP, then shrink back under densMAP."
    />
  )
}

function buildDensityModel({
  seed,
  dim,
  spreads,
  sizes,
  knn,
  simSteps,
}: {
  seed: number
  dim: number
  spreads: number[]
  sizes: number[]
  knn: number
  simSteps: number
}) {
  const rng = mulberry32(seed)
  const nClusters = Math.min(spreads.length, sizes.length)
  const clusterSpread = spreads
  const clusterSize = sizes
  // Spread the clusters along the first axis: centers at -6, 0, 6, …
  const centers = Array.from({ length: nClusters }, (_, c) =>
    new Array(dim).fill(0).map((_, i) => (i === 0 ? (c - (nClusters - 1) / 2) * 6 : 0)),
  )
  type HD = { v: number[]; c: number; id: number }
  const pts: HD[] = []
  for (let c = 0; c < nClusters; c++) {
    for (let i = 0; i < clusterSize[c]; i++) {
      const p = new Array(dim)
      for (let d = 0; d < dim; d++) p[d] = centers[c][d] + gaussian(rng) * clusterSpread[c]
      pts.push({ v: p, c, id: pts.length })
    }
  }
  const N = pts.length
  function kNN(k: number) {
    const adj: { j: number; d: number }[][] = []
    for (let i = 0; i < N; i++) {
      const arr: { j: number; d: number }[] = []
      for (let j = 0; j < N; j++) {
        if (i === j) continue
        let d = 0
        for (let a = 0; a < dim; a++) d += (pts[i].v[a] - pts[j].v[a]) ** 2
        arr.push({ j, d: Math.sqrt(d) })
      }
      arr.sort((a, b) => a.d - b.d)
      adj.push(arr.slice(0, k))
    }
    return adj
  }
  const adj = kNN(knn)
  const dens = pts.map((_, i) => d3.mean(adj[i], (e) => e.d) ?? 0)

  function runForce(distanceFn: (i: number, j: number, d: number) => number, fseed: number) {
    const r = mulberry32(fseed)
    const data = pts.map((p, i) => ({ id: i, x: gaussian(r) * 10, y: gaussian(r) * 10, c: p.c }))
    const links: { source: number; target: number; dist: number }[] = []
    for (let i = 0; i < N; i++) {
      for (const e of adj[i].slice(0, 6)) {
        if (i < e.j) links.push({ source: i, target: e.j, dist: distanceFn(i, e.j, e.d) })
      }
    }
    const sim = d3.forceSimulation(data as d3.SimulationNodeDatum[])
      .force('link', d3.forceLink(links).id((d: any) => d.id).distance((d: any) => d.dist).strength(0.5))
      .force('charge', d3.forceManyBody().strength(-25))
      .force('center', d3.forceCenter(0, 0).strength(0.02))
      .force('collide', d3.forceCollide(2.5))
      .alpha(1).alphaDecay(0.02).stop()
    for (let s = 0; s < simSteps; s++) sim.tick()
    return data.map((d) => [d.x, d.y] as [number, number])
  }

  const umapEmb = runForce(() => 8, 21)
  const densEmb = runForce((i, j) => { const s = (dens[i] + dens[j]) / 2; return 2 + s * 4 }, 22)

  function pca2(X: number[][]) {
    const n = X.length, d = X[0].length
    const mean = new Array(d).fill(0)
    for (let i = 0; i < n; i++) for (let a = 0; a < d; a++) mean[a] += X[i][a] / n
    const Xc = X.map((row) => row.map((v, a) => v - mean[a]))
    const C = Array.from({ length: d }, () => new Array(d).fill(0))
    for (let i = 0; i < n; i++) for (let a = 0; a < d; a++) for (let b = 0; b < d; b++) C[a][b] += (Xc[i][a] * Xc[i][b]) / n
    const prng = mulberry32(99)
    function powerIter(M: number[][], iters = 100) {
      const dd = M.length
      let v = new Array(dd).fill(0).map(() => prng())
      for (let t = 0; t < iters; t++) {
        const Mv = new Array(dd).fill(0)
        for (let a = 0; a < dd; a++) for (let b = 0; b < dd; b++) Mv[a] += M[a][b] * v[b]
        const nv = Math.sqrt(Mv.reduce((s, x) => s + x * x, 0)) || 1
        v = Mv.map((x) => x / nv)
      }
      return v
    }
    const v1 = powerIter(C)
    const lam1 = (() => {
      const Mv = new Array(d).fill(0)
      for (let a = 0; a < d; a++) for (let b = 0; b < d; b++) Mv[a] += C[a][b] * v1[b]
      let s = 0
      for (let a = 0; a < d; a++) s += v1[a] * Mv[a]
      return s
    })()
    const C2 = C.map((row) => row.slice())
    for (let a = 0; a < d; a++) for (let b = 0; b < d; b++) C2[a][b] -= lam1 * v1[a] * v1[b]
    const v2 = powerIter(C2)
    return Xc.map((row) => {
      let a = 0, b = 0
      for (let i = 0; i < d; i++) { a += row[i] * v1[i]; b += row[i] * v2[i] }
      return [a, b] as [number, number]
    })
  }
  const inputEmb = pca2(pts.map((p) => p.v))
  return { pts, inputEmb, umapEmb, densEmb }
}

// --------- Figure 2: PHATE on branching trajectory ---------

// A branching trajectory (one stem, three diverging arms with growing
// noise). Contrasts a neighbor-based layout that shatters the branches
// into clumps against a PHATE-style potential-distance MDS that keeps the
// branching continuum intact.
export const PHATE_DEFAULTS = {
  seed: 123, // RNG seed for the trajectory + layouts
  pointsPerBranch: 55, // points along the stem and each of the 3 branches
  knn: 10, // neighbors for the diffusion graph
  diffusionSteps: 6, // random-walk steps t (P^t) before the log transform
  mdsIters: 600, // MDS gradient-descent iterations on potential distances
  simSteps: 400, // force-sim iterations for the neighbor-based pane
}

// The dense P^t pipeline is O(N³) per diffusion step (N = 4×pointsPerBranch),
// so the heuristic's 500-points / 50-steps ceilings would freeze the tab;
// knn must stay ≥2 and below N, and MDS iterations are O(N²) each.
export const PHATE_HINTS = {
  pointsPerBranch: { min: 10, max: 80 },
  knn: { min: 2, max: 30 },
  diffusionSteps: { min: 1, max: 10 },
  mdsIters: { min: 10, max: 600, step: 10 },
}

export function PHATEFigure(props: FigureProps) {
  const seed = num(props.seed, PHATE_DEFAULTS.seed)
  const pointsPerBranch = num(props.pointsPerBranch, PHATE_DEFAULTS.pointsPerBranch)
  const knn = num(props.knn, PHATE_DEFAULTS.knn)
  const diffusionSteps = num(props.diffusionSteps, PHATE_DEFAULTS.diffusionSteps)
  const mdsIters = num(props.mdsIters, PHATE_DEFAULTS.mdsIters)
  const simSteps = num(props.simSteps, PHATE_DEFAULTS.simSteps)
  const { activePart } = useFigureHighlight(props.figureId as string)

  const model = useMemo(
    () => buildPhateModel({ seed, pointsPerBranch, knn, diffusionSteps, mdsIters, simSteps }),
    [seed, pointsPerBranch, knn, diffusionSteps, mdsIters, simSteps],
  )
  const colors = ['var(--text-3)', 'var(--accent)', 'var(--warm)', 'var(--green)']
  const groupLabels = ['shared stem', 'branch 1', 'branch 2', 'branch 3']
  const panes: Pane[] = [
    { id: 'original', title: 'true structure (xy view)', note: 'branching trajectory', emb: model.inputEmb },
    { id: 'neighbor', title: 'neighbor-based', note: 'breaks branches into clumps', emb: model.umapEmb },
    { id: 'phate', title: 'PHATE-like', note: 'preserves branching continuum', emb: model.phateEmb },
  ]
  return (
    <PaneRow
      panes={panes}
      colors={colors}
      groupLabels={groupLabels}
      classOf={(i) => model.pts[i].c}
      activePart={activePart}
      radius={2.4}
      hoverHint="Hover a branch to trace it across all three panes — it stays a connected strand under PHATE but shatters under the neighbor-based layout."
    />
  )
}

function buildPhateModel({
  seed,
  pointsPerBranch,
  knn,
  diffusionSteps,
  mdsIters,
  simSteps,
}: {
  seed: number
  pointsPerBranch: number
  knn: number
  diffusionSteps: number
  mdsIters: number
  simSteps: number
}) {
  const rng = mulberry32(seed)
  type P3 = { x: number; y: number; z: number; c: number; id: number }
  const pts: P3[] = []
  const N_PER = pointsPerBranch
  for (let i = 0; i < N_PER; i++) {
    const t = i / (N_PER - 1)
    pts.push({ x: -4 + 4 * t + gaussian(rng) * 0.08, y: gaussian(rng) * 0.08, z: gaussian(rng) * 0.08, c: 0, id: pts.length })
  }
  const angles = [Math.PI / 3, 0, -Math.PI / 3]
  const branchColors = [1, 2, 3]
  for (let b = 0; b < 3; b++) {
    for (let i = 0; i < N_PER; i++) {
      const t = i / (N_PER - 1)
      const noise = 0.05 + 0.16 * t
      pts.push({ x: Math.cos(angles[b]) * 4 * t + gaussian(rng) * noise, y: Math.sin(angles[b]) * 4 * t + gaussian(rng) * noise, z: gaussian(rng) * noise, c: branchColors[b], id: pts.length })
    }
  }
  const N = pts.length
  const K = knn
  const adj: { j: number; d: number }[][] = []
  for (let i = 0; i < N; i++) {
    const arr: { j: number; d: number }[] = []
    for (let j = 0; j < N; j++) {
      if (i === j) continue
      const d = Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y, pts[i].z - pts[j].z)
      arr.push({ j, d })
    }
    arr.sort((a, b) => a.d - b.d)
    adj.push(arr.slice(0, K))
  }
  const P = Array.from({ length: N }, () => new Array(N).fill(0))
  for (let i = 0; i < N; i++) {
    const row = new Array(N).fill(0)
    for (const e of adj[i]) row[e.j] = Math.exp(-(e.d * e.d) / 0.5)
    const s = d3.sum(row) || 1
    for (let j = 0; j < N; j++) P[i][j] = row[j] / s
  }
  function matPower(M: number[][], t: number) {
    let R = M.map((row) => row.slice())
    for (let step = 1; step < t; step++) {
      const next = Array.from({ length: N }, () => new Array(N).fill(0))
      for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
        let s = 0
        for (let k = 0; k < N; k++) s += R[i][k] * M[k][j]
        next[i][j] = s
      }
      R = next
    }
    return R
  }
  const Pt = matPower(P, diffusionSteps)
  const Dpot = Array.from({ length: N }, () => new Array(N).fill(0))
  const EPS = 1e-8
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      let s = 0
      for (let k = 0; k < N; k++) {
        const diff = -Math.log(Pt[i][k] + EPS) - -Math.log(Pt[j][k] + EPS)
        s += diff * diff
      }
      Dpot[i][j] = Math.sqrt(s)
    }
  }
  // Rescale potential distances to a fixed mean so the MDS layout settles
  // at a predictable on-screen size regardless of diffusionSteps / N.
  let dmean = 0, dcount = 0
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) if (i !== j) { dmean += Dpot[i][j]; dcount++ }
  dmean = dmean / (dcount || 1) || 1
  const dscale = 4 / dmean
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) Dpot[i][j] *= dscale
  function mds(D: number[][], iters: number, mseed: number) {
    const r = mulberry32(mseed)
    const X = Array.from({ length: N }, () => [gaussian(r), gaussian(r)] as [number, number])
    // The raw stress gradient sums N-1 terms, so its magnitude scales with
    // N; dividing the step by N keeps the effective learning rate stable
    // across point counts. (With the old un-normalized lr=0.01 the layout
    // never converged — stress stayed ~0.7 and branches collapsed to a blob.)
    const lr = 0.5 / N
    for (let it = 0; it < iters; it++) {
      const grad = Array.from({ length: N }, () => [0, 0] as [number, number])
      for (let i = 0; i < N; i++) {
        for (let j = 0; j < N; j++) {
          if (i === j) continue
          const d = Math.hypot(X[i][0] - X[j][0], X[i][1] - X[j][1]) + 1e-9
          const t = D[i][j]
          const coef = (d - t) / d
          grad[i][0] += coef * (X[i][0] - X[j][0])
          grad[i][1] += coef * (X[i][1] - X[j][1])
        }
      }
      for (let i = 0; i < N; i++) { X[i][0] -= lr * grad[i][0]; X[i][1] -= lr * grad[i][1] }
    }
    return X
  }
  const phateEmb = mds(Dpot, mdsIters, 13)

  const r = mulberry32(seed + 90)
  const data = pts.map((p, i) => ({ id: i, x: gaussian(r) * 10, y: gaussian(r) * 10, c: p.c }))
  const links: { source: number; target: number }[] = []
  for (let i = 0; i < N; i++) for (const e of adj[i].slice(0, 6)) if (i < e.j) links.push({ source: i, target: e.j })
  const sim = d3.forceSimulation(data as d3.SimulationNodeDatum[])
    .force('link', d3.forceLink(links).id((d: any) => d.id).distance(6).strength(0.7))
    .force('charge', d3.forceManyBody().strength(-40))
    .force('center', d3.forceCenter(0, 0).strength(0.02))
    .force('collide', d3.forceCollide(2.5))
    .alpha(1).alphaDecay(0.02).stop()
  for (let s = 0; s < simSteps; s++) sim.tick()
  const umapEmb = data.map((d) => [d.x, d.y] as [number, number])
  const inputEmb = pts.map((p) => [p.x, p.y] as [number, number])
  return { pts, inputEmb, umapEmb, phateEmb }
}
