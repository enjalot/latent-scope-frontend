import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import * as d3 from 'd3'
import type { FigureProps } from './registry'
import { num, str } from '../../runtime/lib/params'
import { useFigureHighlight } from '../../runtime/store'

// Faithful React ports of docs/dim-reduction/03-global-distances.html.

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onChange = () => setReduced(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return reduced
}

type XY = [number, number]
type Point3 = { x: number; y: number; z: number; t: number; h: number; i: number; px: number; py: number }

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

function mdsLike(D: number[][], alpha = 0, dim = 2, iters = 200, seed = 5) {
  const n = D.length
  const rng = mulberry32(seed)
  const X = Array.from({ length: n }, () => Array.from({ length: dim }, () => gaussian(rng) * 0.5))
  const lr = 0.02
  for (let it = 0; it < iters; it++) {
    const grad = Array.from({ length: n }, () => new Array(dim).fill(0))
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (i === j) continue
        let d = 0
        for (let k = 0; k < dim; k++) d += (X[i][k] - X[j][k]) ** 2
        d = Math.sqrt(d) + 1e-9
        const target = D[i][j]
        const weight = alpha === 0 ? 1 : alpha * (1 / (target + 1e-6)) + (1 - alpha)
        const diff = ((d - target) / d) * weight
        for (let k = 0; k < dim; k++) grad[i][k] += diff * (X[i][k] - X[j][k])
      }
    }
    for (let i = 0; i < n; i++) for (let k = 0; k < dim; k++) X[i][k] -= lr * grad[i][k]
  }
  const mean = new Array(dim).fill(0)
  for (let i = 0; i < n; i++) for (let k = 0; k < dim; k++) mean[k] += X[i][k] / n
  for (let i = 0; i < n; i++) for (let k = 0; k < dim; k++) X[i][k] -= mean[k]
  return X
}

// Same gradient solver as mdsLike, but records a centered snapshot (and the
// normalized stress) every `every` iterations so the optimisation itself can
// be replayed: points crawling from the random init into the converged
// layout. The final frame is identical to what mdsLike returns.
function mdsTrajectory(D: number[][], alpha = 0, iters = 200, seed = 5, every = 4) {
  const n = D.length
  const dim = 2
  const rng = mulberry32(seed)
  const X = Array.from({ length: n }, () => Array.from({ length: dim }, () => gaussian(rng) * 0.5))
  const lr = 0.02
  let sumD2 = 0
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) sumD2 += D[i][j] * D[i][j]
  const frames: number[][][] = []
  const stresses: number[] = []
  const iterAt: number[] = []
  function snapshot(it: number) {
    const mean = [0, 0]
    for (let i = 0; i < n; i++) for (let k = 0; k < dim; k++) mean[k] += X[i][k] / n
    const F = X.map((row) => [row[0] - mean[0], row[1] - mean[1]])
    let err = 0
    for (let i = 0; i < n; i++)
      for (let j = i + 1; j < n; j++) {
        const d = Math.hypot(F[i][0] - F[j][0], F[i][1] - F[j][1])
        err += (d - D[i][j]) ** 2
      }
    frames.push(F)
    stresses.push(Math.sqrt(err / (sumD2 || 1)))
    iterAt.push(it)
  }
  snapshot(0)
  for (let it = 0; it < iters; it++) {
    const grad = Array.from({ length: n }, () => new Array(dim).fill(0))
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (i === j) continue
        let d = 0
        for (let k = 0; k < dim; k++) d += (X[i][k] - X[j][k]) ** 2
        d = Math.sqrt(d) + 1e-9
        const target = D[i][j]
        const weight = alpha === 0 ? 1 : alpha * (1 / (target + 1e-6)) + (1 - alpha)
        const diff = ((d - target) / d) * weight
        for (let k = 0; k < dim; k++) grad[i][k] += diff * (X[i][k] - X[j][k])
      }
    }
    for (let i = 0; i < n; i++) for (let k = 0; k < dim; k++) X[i][k] -= lr * grad[i][k]
    if ((it + 1) % every === 0 || it === iters - 1) snapshot(it + 1)
  }
  return { frames, stresses, iterAt }
}

function Slider({ label, value, min, max, step, onChange, format = String, hint }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; format?: (v: number) => string; hint?: string }) {
  return (
    <label>
      {label} <span className="value">{format(value)}</span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(+e.currentTarget.value)} />
      {hint && <span className="hint" style={{ color: 'var(--text-3)', fontSize: '0.78rem', marginLeft: '0.5rem' }}>{hint}</span>}
    </label>
  )
}

// --------- Figure 1: MDS (distance matrix -> points) ---------

type MdsSet = 'three' | 'line' | 'ring' | 'cities'

type MdsPoint = [number, number, number]

type MdsDataset = {
  pts: MdsPoint[]                  // visualisable "ground truth" coords (only used for the left panel)
  D: number[][]                    // distance matrix that MDS actually sees
  labels?: string[]                // optional row labels (for the cities matrix)
  hasGround: boolean               // whether the left panel shows real geometry
}

const MDS_SETS: MdsSet[] = ['three', 'line', 'ring', 'cities']

// Tweakable surface — override per-instance in markdown: :::figure{id=mds dataset=ring}
export const MDS_DEFAULTS = {
  dataset: 'three', // initial dataset: three | line | ring | cities
  clusterPts: 7, // points per cluster in the "three clusters" dataset
  linePts: 18, // points along the line dataset
  ringPts: 20, // points around the ring dataset
  noise: 0.4, // gaussian jitter (σ) of the three-clusters points
  iters: 260, // gradient-descent iterations of the MDS solver
  seed: 11, // random-init seed for the embedding
}

// Knob bounds where the magnitude heuristic guesses wrong: point counts of 0
// break the scales (and the O(n²) solver crawls past ~60/edge of usefulness),
// and noise past ~1.5 swamps the cluster centers at ±2.
export const MDS_HINTS = {
  clusterPts: { min: 2, max: 30 },
  linePts: { min: 3, max: 60 },
  ringPts: { min: 3, max: 60 },
  noise: { min: 0, max: 1.5, step: 0.05 },
}

export function MDSFigure(props: FigureProps) {
  const dsRaw = str(props.dataset, MDS_DEFAULTS.dataset)
  const ds0 = (MDS_SETS as string[]).includes(dsRaw) ? (dsRaw as MdsSet) : 'three'
  const clusterPts = num(props.clusterPts, MDS_DEFAULTS.clusterPts)
  const linePts = num(props.linePts, MDS_DEFAULTS.linePts)
  const ringPts = num(props.ringPts, MDS_DEFAULTS.ringPts)
  const noise = num(props.noise, MDS_DEFAULTS.noise)
  const iters = num(props.iters, MDS_DEFAULTS.iters)
  const seed = num(props.seed, MDS_DEFAULTS.seed)
  const [currentSet, setCurrentSet] = useState<MdsSet>(ds0)
  useEffect(() => setCurrentSet(ds0), [ds0])
  const { activePart } = useFigureHighlight(props.figureId as string)
  const reduced = usePrefersReducedMotion()
  const datasets = useMemo(
    () => buildMdsDatasets(clusterPts, linePts, ringPts, noise),
    [clusterPts, linePts, ringPts, noise],
  )
  const dataset = datasets[currentSet]
  const traj = useMemo(() => mdsTrajectory(dataset.D, 0, iters, seed, 4), [dataset, iters, seed])
  const lastFrame = traj.frames.length - 1
  // frame === lastFrame is the settled (deterministic) state shown on mount.
  const [frame, setFrame] = useState(lastFrame)
  const rafRef = useRef(0)
  const replay = () => {
    cancelAnimationFrame(rafRef.current)
    if (reduced) { setFrame(lastFrame); return }
    const dur = 2600
    const t0 = performance.now()
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / dur)
      // Ease-in on the frame index: the solver does almost all of its moving
      // in the first ~30 iterations, so spend most of the wall time there
      // and skim the long converged tail.
      setFrame(Math.round(Math.pow(p, 2.2) * lastFrame))
      if (p < 1) rafRef.current = requestAnimationFrame(tick)
    }
    setFrame(0)
    rafRef.current = requestAnimationFrame(tick)
  }
  // Replay automatically when the reader switches datasets (not on mount):
  // watching the points crawl into place is the point of the figure.
  const mounted = useRef(false)
  useEffect(() => {
    if (!mounted.current) { mounted.current = true; return }
    setFrame(lastFrame)
    replay()
    return () => cancelAnimationFrame(rafRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [traj])
  useEffect(() => () => cancelAnimationFrame(rafRef.current), [])
  const emb = traj.frames[Math.min(frame, lastFrame)]
  const solving = frame < lastFrame

  const W = 680, H = 340
  const colors = ['var(--accent)', 'var(--warm)', 'var(--green)']
  const panelGap = 18
  const panelW = (W - panelGap * 2) / 3
  const panelTop = 28
  const panelH = H - panelTop - 16
  const xPanel0 = 0
  const xPanel1 = panelW + panelGap
  const xPanel2 = 2 * (panelW + panelGap)

  // Left: ground-truth points (or a placeholder if there is no geometry)
  const left = dataset.hasGround
    ? scales2d(dataset.pts.map((d) => [d[0], d[1]] as XY), panelW, panelH)
    : null

  // Middle: distance matrix heatmap
  const n = dataset.D.length
  const flatD: number[] = []
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if (i !== j) flatD.push(dataset.D[i][j])
  const maxD = d3.max(flatD) ?? 1
  const cell = Math.min(panelW, panelH) / n
  const matrixSize = cell * n
  const matrixX = xPanel1 + (panelW - matrixSize) / 2
  const matrixY = panelTop + (panelH - matrixSize) / 2
  const heat = d3.scaleSequential(d3.interpolateMagma).domain([maxD * 1.05, 0])

  // Right: 2D embedding from MDS. Scales are fixed across the whole solver
  // trajectory so the replay animation doesn't zoom underneath the points.
  const right = useMemo(() => {
    const all: XY[] = []
    for (const F of traj.frames) for (const p of F) all.push([p[0], p[1]])
    return scales2d(all, panelW, panelH)
  }, [traj, panelW, panelH])

  // pair lines for the left panel (only when we have ground truth)
  const pairs: [number, number, number][] = []
  if (dataset.hasGround) {
    for (let i = 0; i < n; i++)
      for (let j = i + 1; j < n; j++) {
        const dij = dataset.D[i][j]
        pairs.push([i, j, dij])
      }
  }

  return (
    <div>
      <div className="controls">
        <div className="toggle-group">
          {([
            ['three', 'three clusters'],
            ['line', 'line'],
            ['ring', 'ring'],
            ['cities', 'distances only'],
          ] as [MdsSet, string][]).map(([key, label]) => (
            <button key={key} type="button" className={currentSet === key ? 'active' : ''} onClick={() => setCurrentSet(key)}>{label}</button>
          ))}
        </div>
        <button type="button" onClick={replay} disabled={solving}>{solving ? 'solving…' : '▶ replay solver'}</button>
        <span style={{ color: 'var(--text-3)', fontSize: '0.8rem' }}>
          iteration <span className="value" style={{ color: 'var(--text)' }}>{traj.iterAt[Math.min(frame, lastFrame)]}</span>/{iters}
          {'  '}stress <span className="value" style={{ color: 'var(--text)' }}>{traj.stresses[Math.min(frame, lastFrame)].toFixed(3)}</span>
        </span>
      </div>
      <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet">
        {/* Panel 1: ground truth (or "unknown geometry") */}
        <g transform={`translate(${xPanel0},0)`} opacity={activePart && activePart !== 'data' ? 0.35 : 1}>
          <text x={0} y={16} style={{ fontSize: 11, letterSpacing: '0.04em' }} fill="var(--text-3)">
            {dataset.hasGround ? 'GROUND TRUTH' : 'GEOMETRY UNKNOWN'}
          </text>
          {dataset.hasGround && left && (
            <g transform={`translate(0,${panelTop})`}>
              {pairs.map((p, i) => (
                <line key={i} x1={left.x(dataset.pts[p[0]][0])} y1={left.y(dataset.pts[p[0]][1])} x2={left.x(dataset.pts[p[1]][0])} y2={left.y(dataset.pts[p[1]][1])} stroke="var(--text-3)" strokeOpacity={0.04 + 0.18 * (1 - p[2] / maxD)} strokeWidth={0.3 + 1.2 * (1 - p[2] / maxD)} />
              ))}
              {dataset.pts.map((p, i) => (
                <circle key={i} cx={left.x(p[0])} cy={left.y(p[1])} r={4} fill={colors[p[2]] || 'var(--accent)'} opacity={0.85} stroke="white" strokeWidth={0.7} />
              ))}
            </g>
          )}
          {!dataset.hasGround && (
            <g transform={`translate(${panelW / 2},${panelTop + panelH / 2})`}>
              <text textAnchor="middle" y={-18} style={{ fontSize: 12 }} fill="var(--text-2)">a list of cities</text>
              <text textAnchor="middle" y={0} style={{ fontSize: 11 }} fill="var(--text-3)">we never see coordinates,</text>
              <text textAnchor="middle" y={16} style={{ fontSize: 11 }} fill="var(--text-3)">only pairwise distances →</text>
              {dataset.labels && (
                <g fontSize={10} fill="var(--text-2)" textAnchor="middle">
                  {dataset.labels.map((lab, idx) => (
                    <text key={lab} y={42 + idx * 13}>{lab}</text>
                  ))}
                </g>
              )}
            </g>
          )}
        </g>

        {/* Panel 2: distance matrix heatmap */}
        <g transform={`translate(${xPanel1},0)`} opacity={activePart && activePart !== 'matrix' ? 0.35 : 1}>
          <text x={0} y={16} style={{ fontSize: 11, letterSpacing: '0.04em' }} fill="var(--text-3)">DISTANCE MATRIX</text>
          <g transform={`translate(${matrixX - xPanel1},${matrixY})`}>
            {dataset.D.map((row, i) =>
              row.map((d, j) => (
                <rect key={`${i}-${j}`} x={j * cell} y={i * cell} width={cell + 0.5} height={cell + 0.5} fill={i === j ? 'var(--muted)' : heat(d)} />
              )),
            )}
            <rect x={0} y={0} width={matrixSize} height={matrixSize} fill="none" stroke={activePart === 'matrix' ? 'var(--accent)' : 'var(--border)'} strokeWidth={activePart === 'matrix' ? 1.5 : 1} />
          </g>
        </g>

        {/* Panel 3: MDS embedding */}
        <g transform={`translate(${xPanel2},0)`} opacity={activePart && activePart !== 'embedding' ? 0.35 : 1}>
          <text x={0} y={16} style={{ fontSize: 11, letterSpacing: '0.04em' }} fill="var(--text-3)">MDS EMBEDDING</text>
          <g transform={`translate(0,${panelTop})`}>
            {emb.map((p, i) => (
              <circle key={i} cx={right.x(p[0])} cy={right.y(p[1])} r={4} fill={colors[dataset.pts[i] ? dataset.pts[i][2] : 0] || 'var(--accent)'} opacity={0.85} stroke="white" strokeWidth={0.7} />
            ))}
          </g>
        </g>
      </svg>
    </div>
  )
}

function buildMdsDatasets(
  clusterPts: number,
  linePts: number,
  ringPts: number,
  noise: number,
): Record<MdsSet, MdsDataset> {
  function distMatrix(pts: MdsPoint[]) {
    const n = pts.length
    const D = Array.from({ length: n }, () => new Array(n).fill(0))
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) D[i][j] = Math.hypot(pts[i][0] - pts[j][0], pts[i][1] - pts[j][1])
    return D
  }

  // three clusters: sort by cluster so the heatmap shows block structure
  const three = (() => {
    const rng = mulberry32(3)
    const pts: MdsPoint[] = []
    const centers = [[-2.5, -1], [2, -1.5], [0, 2]]
    for (let c = 0; c < 3; c++) for (let i = 0; i < clusterPts; i++) pts.push([centers[c][0] + gaussian(rng) * noise, centers[c][1] + gaussian(rng) * noise, c])
    return pts
  })()
  // line (centered around x = 0 regardless of point count)
  const line = (() => {
    const rng = mulberry32(4)
    return d3.range(linePts).map((i) => [i * 0.3 - ((linePts - 1) * 0.3) / 2, gaussian(rng) * 0.12, 0] as MdsPoint)
  })()
  // ring
  const ring = (() => {
    const rng = mulberry32(5)
    const pts: MdsPoint[] = []
    const N = Math.max(3, Math.round(ringPts))
    for (let i = 0; i < N; i++) {
      const a = Math.PI * 2 * (i / N)
      pts.push([Math.cos(a) * 2 + gaussian(rng) * 0.15, Math.sin(a) * 2 + gaussian(rng) * 0.15, 0])
    }
    return pts
  })()

  // "cities" / distances-only: hand-rolled distance matrix that does NOT come
  // from a 2D embedding. We still need fake "pts" entries for indexing, but
  // we won't render the left panel as a scatter.
  const cityLabels = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']
  const cityD: number[][] = [
    //   A    B    C    D    E    F    G    H
    [    0, 1.2, 0.9, 3.4, 3.6, 4.1, 2.8, 2.4],
    [  1.2,   0, 1.0, 3.0, 3.2, 3.7, 2.2, 1.9],
    [  0.9, 1.0,   0, 3.5, 3.5, 3.9, 2.5, 2.1],
    [  3.4, 3.0, 3.5,   0, 0.8, 1.4, 3.1, 3.0],
    [  3.6, 3.2, 3.5, 0.8,   0, 0.9, 3.3, 3.2],
    [  4.1, 3.7, 3.9, 1.4, 0.9,   0, 3.7, 3.6],
    [  2.8, 2.2, 2.5, 3.1, 3.3, 3.7,   0, 0.7],
    [  2.4, 1.9, 2.1, 3.0, 3.2, 3.6, 0.7,   0],
  ]
  const citiesPts: MdsPoint[] = cityLabels.map((_, i) => [0, 0, i < 3 ? 0 : i < 6 ? 1 : 2])

  return {
    three: { pts: three, D: distMatrix(three), hasGround: true },
    line: { pts: line, D: distMatrix(line), hasGround: true },
    ring: { pts: ring, D: distMatrix(ring), hasGround: true },
    cities: { pts: citiesPts, D: cityD, hasGround: false, labels: cityLabels },
  }
}

function scales2d(points: XY[], paneW: number, paneH: number) {
  const xExt = d3.extent(points, (d) => d[0]) as [number, number]
  const yExt = d3.extent(points, (d) => d[1]) as [number, number]
  const padX = Math.max(0.1, (xExt[1] - xExt[0]) * 0.15)
  const padY = Math.max(0.1, (yExt[1] - yExt[0]) * 0.15)
  return {
    x: d3.scaleLinear([xExt[0] - padX, xExt[1] + padX], [0, paneW]),
    y: d3.scaleLinear([yExt[0] - padY, yExt[1] + padY], [paneH, 0]),
  }
}

// --------- Figure 2: Sammon vs MDS (multi-scale data) ---------

type SammonMode = 'mds' | 'sammon'

// Tweakable surface — override per-instance in markdown: :::figure{id=sammon mode=sammon}
export const SAMMON_DEFAULTS = {
  mode: 'mds', // starting view: 'mds' | 'sammon'
  clusterSize: 10, // points in each of the two dense inner clusters
  clusterSpread: 0.18, // gaussian σ of the inner clusters (small = very tight)
  anchorDist: 6, // distance of the 4 far anchor points from the origin
  iters: 350, // optimisation iterations per embedding
  seed: 17, // data-generation seed
}

// The figure's whole point is multi-scale contrast: spread must stay well
// below the ±1.2 cluster separation (heuristic max 5 destroys it), and
// anchorDist only reads as "far" in roughly 2–15 (integer default would
// otherwise snap to step 1).
export const SAMMON_HINTS = {
  clusterSize: { min: 2, max: 40 },
  clusterSpread: { min: 0.02, max: 0.8, step: 0.02 },
  anchorDist: { min: 2, max: 15, step: 0.5 },
}

export function SammonFigure(props: FigureProps) {
  const mode0: SammonMode = str(props.mode, SAMMON_DEFAULTS.mode) === 'sammon' ? 'sammon' : 'mds'
  const clusterSize = num(props.clusterSize, SAMMON_DEFAULTS.clusterSize)
  const clusterSpread = num(props.clusterSpread, SAMMON_DEFAULTS.clusterSpread)
  const anchorDist = num(props.anchorDist, SAMMON_DEFAULTS.anchorDist)
  const iters = num(props.iters, SAMMON_DEFAULTS.iters)
  const seed = num(props.seed, SAMMON_DEFAULTS.seed)
  const [mode, setMode] = useState<SammonMode>(mode0)
  useEffect(() => setMode(mode0), [mode0])
  const { activePart } = useFigureHighlight(props.figureId as string)
  const reduced = usePrefersReducedMotion()
  const model = useMemo(
    () => buildSammonModel(clusterSize, clusterSpread, anchorDist, iters, seed),
    [clusterSize, clusterSpread, anchorDist, iters, seed],
  )
  // Morph the embedding between the two objectives instead of snapping:
  // blend 0 = classical MDS positions, 1 = Sammon positions. Both runs share
  // an init seed, so point i corresponds across the two layouts and the
  // movement shows exactly what each objective sacrifices vs protects. The
  // Shepard diagram and error bars are derived from the blended positions,
  // so they update continuously during the morph.
  const [blend, setBlend] = useState(mode0 === 'sammon' ? 1 : 0)
  const blendRef = useRef(blend)
  blendRef.current = blend
  useEffect(() => {
    const target = mode === 'sammon' ? 1 : 0
    if (reduced || blendRef.current === target) { setBlend(target); return }
    const from = blendRef.current
    const dur = 800
    const t0 = performance.now()
    let raf = 0
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / dur)
      setBlend(from + (target - from) * d3.easeCubicInOut(p))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [mode, reduced])
  const emb = useMemo(
    () => model.embMds.map((p, i) => [
      p[0] + (model.embSammon[i][0] - p[0]) * blend,
      p[1] + (model.embSammon[i][1] - p[1]) * blend,
    ]),
    [model, blend],
  )
  // Linked hover: hovering a point in either scatter highlights it in both
  // panels and isolates its pairs in the Shepard diagram.
  const [hover, setHover] = useState<number | null>(null)

  const W = 680, H = 360
  const panelGap = 18
  const panelW = (W - panelGap * 2) / 3
  const panelTop = 28
  const scatterH = 220
  const stressH = 70
  const stressY = panelTop + scatterH + 14

  const left = scales2d(model.pts.map((p) => [p[0], p[1]] as XY), panelW, scatterH)
  // Fixed scales over both endpoint layouts so the morph doesn't re-zoom.
  const right = useMemo(
    () => scales2d([...model.embMds, ...model.embSammon].map((p) => [p[0], p[1]] as XY), panelW, scatterH),
    [model, panelW, scatterH],
  )
  const colors = ['var(--accent)', 'var(--warm)', 'var(--green)', 'var(--purple)']

  const pairs: { i: number; j: number; d0: number }[] = []
  for (let i = 0; i < model.pts.length; i++) for (let j = i + 1; j < model.pts.length; j++) pairs.push({ i, j, d0: model.D[i][j] })

  // stress by distance bucket
  const stress = useMemo(() => bucketStress(model.D, emb), [model.D, emb])
  const maxBucketStress = d3.max(stress.buckets, (b) => b.relErr) ?? 1
  const xStress = d3.scaleBand<string>().domain(stress.buckets.map((_, i) => String(i))).range([0, panelW]).paddingInner(0.25)
  const yStress = d3.scaleLinear([0, maxBucketStress * 1.1], [stressH, 0])
  const stressFill = mode === 'sammon' ? 'var(--green)' : 'var(--accent)'

  const totalStress = d3.sum(stress.buckets, (b) => b.relErr * b.count) / d3.sum(stress.buckets, (b) => b.count)
  const localStress = stress.buckets.length > 0 ? stress.buckets[0].relErr : 0
  const globalStress = stress.buckets.length > 0 ? stress.buckets[stress.buckets.length - 1].relErr : 0

  return (
    <div>
      <div className="controls">
        <div className="toggle-group">
          <button type="button" className={mode === 'mds' ? 'active' : ''} onClick={() => setMode('mds')}>classical MDS</button>
          <button type="button" className={mode === 'sammon' ? 'active' : ''} onClick={() => setMode('sammon')}>Sammon mapping</button>
        </div>
        <span style={{ color: 'var(--text-3)', fontSize: '0.8rem' }}>
          short-distance error <span className="value" style={{ color: 'var(--text)' }}>{localStress.toFixed(2)}</span>
          {'  '}long-distance error <span className="value" style={{ color: 'var(--text)' }}>{globalStress.toFixed(2)}</span>
          {'  '}overall <span className="value" style={{ color: 'var(--text)' }}>{totalStress.toFixed(2)}</span>
        </span>
      </div>
      <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet">
        {/* Panel 1: input */}
        <g transform={`translate(0,0)`} opacity={activePart && activePart !== 'input' ? 0.35 : 1}>
          <text y={16} style={{ fontSize: 11, letterSpacing: '0.04em' }} fill="var(--text-3)">INPUT DATA (2D)</text>
          <g transform={`translate(0,${panelTop})`} onMouseLeave={() => setHover(null)}>
            {model.pts.map((p, i) => (
              <circle
                key={i}
                cx={left.x(p[0])}
                cy={left.y(p[1])}
                r={(p[3] === 1 ? 5 : 3.5) + (hover === i ? 1.5 : 0)}
                fill={colors[p[2]] || 'var(--accent)'}
                opacity={hover === null || hover === i ? 0.9 : 0.35}
                stroke={hover === i ? 'var(--text)' : 'white'}
                strokeWidth={hover === i ? 1.6 : 0.7}
                onMouseEnter={() => setHover(i)}
                style={{ cursor: 'crosshair' }}
              />
            ))}
          </g>
        </g>
        {/* Panel 2: embedding */}
        <g transform={`translate(${panelW + panelGap},0)`} opacity={activePart && activePart !== 'embedding' ? 0.35 : 1}>
          <text y={16} style={{ fontSize: 11, letterSpacing: '0.04em' }} fill="var(--text-3)">{mode === 'sammon' ? 'SAMMON EMBEDDING' : 'CLASSICAL MDS EMBEDDING'}</text>
          <g transform={`translate(0,${panelTop})`} onMouseLeave={() => setHover(null)}>
            {emb.map((p, i) => (
              <circle
                key={i}
                cx={right.x(p[0])}
                cy={right.y(p[1])}
                r={(model.pts[i][3] === 1 ? 5 : 3.5) + (hover === i ? 1.5 : 0)}
                fill={colors[model.pts[i][2]] || 'var(--accent)'}
                opacity={hover === null || hover === i ? 0.9 : 0.35}
                stroke={hover === i ? 'var(--text)' : 'white'}
                strokeWidth={hover === i ? 1.6 : 0.7}
                onMouseEnter={() => setHover(i)}
                style={{ cursor: 'crosshair' }}
              />
            ))}
          </g>
        </g>
        {/* Panel 3: Shepard diagram (input vs embedded distance) */}
        <g transform={`translate(${2 * (panelW + panelGap)},0)`} opacity={activePart && activePart !== 'shepard' ? 0.35 : 1}>
          <text y={16} style={{ fontSize: 11, letterSpacing: '0.04em' }} fill="var(--text-3)">SHEPARD DIAGRAM</text>
          {(() => {
            const dEmb = (i: number, j: number) => Math.hypot(emb[i][0] - emb[j][0], emb[i][1] - emb[j][1])
            const xs = pairs.map((p) => p.d0)
            const ys = pairs.map((p) => dEmb(p.i, p.j))
            const xMax = (d3.max(xs) ?? 1) * 1.05
            const yMax = (d3.max(ys) ?? 1) * 1.05
            const m = Math.max(xMax, yMax)
            const sx = d3.scaleLinear([0, m], [0, panelW - 12])
            const sy = d3.scaleLinear([0, m], [scatterH, 0])
            return (
              <g transform={`translate(8,${panelTop})`}>
                <line x1={sx(0)} y1={sy(0)} x2={sx(m)} y2={sy(m)} stroke="var(--border-2)" strokeDasharray="3 3" />
                {pairs.map((p, i) => {
                  const involved = hover !== null && (p.i === hover || p.j === hover)
                  return (
                    <circle
                      key={i}
                      cx={sx(p.d0)}
                      cy={sy(ys[i])}
                      r={involved ? 3 : 2}
                      fill={stressFill}
                      opacity={hover === null ? 0.45 : involved ? 0.95 : 0.08}
                    />
                  )
                })}
                <text x={panelW - 16} y={scatterH - 4} textAnchor="end" style={{ fontSize: 10 }} fill="var(--text-3)">input distance →</text>
                <text x={0} y={10} style={{ fontSize: 10 }} fill="var(--text-3)">embedded ↑</text>
                {hover !== null && (
                  <text x={0} y={24} style={{ fontSize: 10 }} fill="var(--text-2)">pairs of the hovered point</text>
                )}
              </g>
            )
          })()}
        </g>

        {/* Bottom strip: stress per distance bucket, spans panels 1+2 */}
        <g transform={`translate(0,${stressY})`} opacity={activePart && activePart !== 'stress' ? 0.35 : 1}>
          <text y={-4} style={{ fontSize: 11, letterSpacing: '0.04em' }} fill="var(--text-3)">RELATIVE ERROR BY DISTANCE (short → long)</text>
          <g transform={`translate(0,4)`}>
            {stress.buckets.map((b, i) => (
              <g key={i} transform={`translate(${xStress(String(i)) ?? 0},0)`}>
                <rect x={0} y={yStress(b.relErr)} width={xStress.bandwidth()} height={stressH - yStress(b.relErr)} fill={stressFill} opacity={0.85} />
                <text x={xStress.bandwidth() / 2} y={stressH + 12} textAnchor="middle" style={{ fontSize: 10 }} fill="var(--text-3)">{b.label}</text>
              </g>
            ))}
            <line x1={0} y1={stressH} x2={panelW} y2={stressH} stroke="var(--border)" />
          </g>
        </g>
        {/* legend for the bottom strip on the right side */}
        <g transform={`translate(${panelW + panelGap},${stressY})`} opacity={activePart && activePart !== 'stress' ? 0.35 : 1}>
          <text y={-4} style={{ fontSize: 11, letterSpacing: '0.04em' }} fill="var(--text-3)">{mode === 'sammon' ? 'SAMMON: SHORT BARS GET SHORTER' : 'MDS: ALL BUCKETS WEIGHTED EQUALLY'}</text>
          <foreignObject x={0} y={6} width={panelW * 2 + panelGap} height={stressH + 6}>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-2)', lineHeight: 1.45 }}>
              {mode === 'sammon'
                ? 'Sammon divides each squared error by the original distance, so a 10% error on a tiny distance hurts as much as a 100% error on a big one. The optimiser pours its budget into the shortest pairs.'
                : 'Classical MDS adds up squared distance errors with no reweighting. Big pairs dominate the loss, so the optimiser is willing to crush small clusters together if that improves the long-range fit.'}
            </div>
          </foreignObject>
        </g>
      </svg>
    </div>
  )
}

function bucketStress(D: number[][], emb: number[][]) {
  // Bucket pairs by input distance and compute mean relative error per bucket.
  const n = D.length
  const all: { d0: number; d1: number }[] = []
  for (let i = 0; i < n; i++)
    for (let j = i + 1; j < n; j++) {
      const d0 = D[i][j]
      const d1 = Math.hypot(emb[i][0] - emb[j][0], emb[i][1] - emb[j][1])
      all.push({ d0, d1 })
    }
  if (all.length === 0) return { buckets: [] as { label: string; relErr: number; count: number }[] }
  all.sort((a, b) => a.d0 - b.d0)
  const nBuckets = 6
  const perBucket = Math.ceil(all.length / nBuckets)
  const buckets: { label: string; relErr: number; count: number }[] = []
  for (let b = 0; b < nBuckets; b++) {
    const slice = all.slice(b * perBucket, (b + 1) * perBucket)
    if (slice.length === 0) continue
    const meanRel = d3.mean(slice, (s) => Math.abs(s.d1 - s.d0) / (s.d0 + 1e-6)) ?? 0
    buckets.push({ label: b === 0 ? 'short' : b === nBuckets - 1 ? 'long' : '·', relErr: meanRel, count: slice.length })
  }
  return { buckets }
}

function buildSammonModel(clusterSize: number, clusterSpread: number, anchorDist: number, iters: number, seed: number) {
  // Multi-scale design: two tight clusters near origin (small inter- and
  // intra-cluster distances) plus a handful of far-away anchors. Classical
  // MDS sacrifices the tight clusters to fit the long pairs. Sammon does the
  // opposite.
  const rng = mulberry32(seed)
  const pts: [number, number, number, number][] = [] // x, y, color group, size flag
  // dense cluster A near (-1.2, 0)
  for (let i = 0; i < clusterSize; i++) pts.push([-1.2 + gaussian(rng) * clusterSpread, gaussian(rng) * clusterSpread, 0, 0])
  // dense cluster B near (+1.2, 0)
  for (let i = 0; i < clusterSize; i++) pts.push([1.2 + gaussian(rng) * clusterSpread, gaussian(rng) * clusterSpread, 1, 0])
  // 4 far-away "anchor" points
  const anchors: [number, number][] = [[0, anchorDist], [0, -anchorDist], [anchorDist, 0], [-anchorDist, 0]]
  for (const a of anchors) pts.push([a[0], a[1], 2, 1])

  const n = pts.length
  const D = Array.from({ length: n }, () => new Array(n).fill(0))
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) D[i][j] = Math.hypot(pts[i][0] - pts[j][0], pts[i][1] - pts[j][1])
  const EMB_INIT_SEED = 13 // optimiser-init seed; data layout comes from `seed`
  const embMds = mdsLike(D, 0, 2, iters, EMB_INIT_SEED)
  // Procrustes-align the Sammon layout to the MDS one (rotation/reflection
  // only — both are centered and unscaled). MDS solutions are defined up to
  // an arbitrary rotation, so without alignment the toggle morph is mostly
  // meaningless spinning; aligned, the only movement left is the actual
  // trade-off between the two objectives.
  const embSammon = procrustesAlign(mdsLike(D, 1, 2, iters, EMB_INIT_SEED), embMds)
  return { pts, D, embMds, embSammon }
}

function procrustesAlign(src: number[][], target: number[][]) {
  const apply = (p: number[], reflect: boolean) => (reflect ? [p[0], -p[1]] : p)
  let best: number[][] | null = null
  let bestErr = Infinity
  for (const reflect of [false, true]) {
    let num = 0, den = 0
    for (let i = 0; i < src.length; i++) {
      const s = apply(src[i], reflect)
      num += s[0] * target[i][1] - s[1] * target[i][0]
      den += s[0] * target[i][0] + s[1] * target[i][1]
    }
    const th = Math.atan2(num, den)
    const c = Math.cos(th), sn = Math.sin(th)
    const out = src.map((p0) => {
      const p = apply(p0, reflect)
      return [p[0] * c - p[1] * sn, p[0] * sn + p[1] * c]
    })
    let err = 0
    for (let i = 0; i < out.length; i++) err += (out[i][0] - target[i][0]) ** 2 + (out[i][1] - target[i][1]) ** 2
    if (err < bestErr) { bestErr = err; best = out }
  }
  return best!
}

// --------- Figure 3: Isomap (swiss roll, k-interactive) ---------

type IsoLayout = {
  N: number
  data3d: Point3[]
  scales: { xL: d3.ScaleLinear<number, number>; yL: d3.ScaleLinear<number, number>; paneW: number; paneH: number }
  color: d3.ScaleSequential<string>
  endpointA: number
  endpointB: number
}

// Tweakable surface — override per-instance in markdown: :::figure{id=isomap k=12}
export const ISOMAP_DEFAULTS = {
  k: 6, // initial neighbors per point in the kNN graph (reader slider, 2–26)
  n: 220, // swiss-roll sample count (sampled uniformly by surface area)
  seed: 9, // swiss-roll sampling seed
  shortcutRatio: 2.2, // edge is a shortcut when along-manifold dist > ratio × Euclidean dist
}

// k mirrors the reader-facing slider (2–26: at the defaults k=2–3 fragments
// the graph, k=4–7 is the clean sweet spot, k≥8 grows shortcuts). n is
// capped because all-pairs Dijkstra is O(n³) (heuristic max 5000 would
// freeze the tab); shortcutRatio below ~1.5 false-flags ordinary edges.
export const ISOMAP_HINTS = {
  k: { min: 2, max: 26, step: 1 },
  n: { min: 30, max: 400, step: 10 },
  shortcutRatio: { min: 1.3, max: 5, step: 0.1 },
}

export function IsomapFigure(props: FigureProps) {
  const k0 = num(props.k, ISOMAP_DEFAULTS.k)
  const n = num(props.n, ISOMAP_DEFAULTS.n)
  const seed = num(props.seed, ISOMAP_DEFAULTS.seed)
  const shortcutRatio = num(props.shortcutRatio, ISOMAP_DEFAULTS.shortcutRatio)
  const [k, setK] = useState(k0)
  useEffect(() => setK(k0), [k0])
  const dk = useDeferredValue(k)
  const { activePart } = useFigureHighlight(props.figureId as string)
  const layout = useMemo(() => buildIsomapLayout(n, seed), [n, seed])
  const model = useMemo(() => buildIsomapModel(layout, dk, shortcutRatio), [layout, dk, shortcutRatio])
  const { data3d, scales, color, endpointA, endpointB } = layout
  const { edges, embPanel, path, components, shortcutCount, eucD, geoD, disconnected } = model

  const W = 680, H = 380
  const regime = disconnected
    ? { label: 'fragmented', color: 'var(--warm)' }
    : shortcutCount > 0
      ? { label: 'shortcuts', color: 'var(--warm)' }
      : { label: 'sweet spot', color: 'var(--green)' }

  return (
    <div>
      <div className="controls">
        <Slider label="k" value={k} min={2} max={26} step={1} onChange={setK} format={(v) => `${v}`} />
        <span style={{ fontSize: '0.8rem', color: 'var(--text-3)' }}>
          components <span className="value" style={{ color: components > 1 ? 'var(--warm)' : 'var(--text)' }}>{components}</span>
          {'  '}shortcut edges <span className="value" style={{ color: shortcutCount > 0 ? 'var(--warm)' : 'var(--text)' }}>{shortcutCount}</span>
          {'  '}<span className="value" style={{ color: regime.color, fontWeight: 600 }}>{regime.label}</span>
        </span>
      </div>
      <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet">
        {/* Left: swiss roll + kNN graph */}
        <g opacity={activePart && activePart !== 'roll' ? 0.35 : 1}>
          <text x={10} y={18} style={{ fontSize: 11, letterSpacing: '0.04em' }} fill="var(--text-3)">SWISS ROLL IN 3D · kNN GRAPH</text>
          {edges.map((e, i) => (
            <line key={i} x1={scales.xL(data3d[e.a].px)} y1={scales.yL(data3d[e.a].py)} x2={scales.xL(data3d[e.b].px)} y2={scales.yL(data3d[e.b].py)} stroke={e.shortcut ? 'var(--warm)' : 'var(--text-3)'} strokeOpacity={e.shortcut ? 0.85 : 0.18} strokeWidth={e.shortcut ? 1.3 : 0.5} />
          ))}
          {disconnected ? (
            <text x={10} y={H - 16} style={{ fontSize: 11 }} fill="var(--warm)">graph is disconnected — geodesic undefined for some pairs</text>
          ) : (
            <>
              <line x1={scales.xL(data3d[endpointA].px)} y1={scales.yL(data3d[endpointA].py)} x2={scales.xL(data3d[endpointB].px)} y2={scales.yL(data3d[endpointB].py)} stroke="var(--warm)" strokeWidth={2} strokeDasharray="4 2" />
              {path.length > 1 && (
                <path d={pathD(path, (i) => scales.xL(data3d[i].px), (i) => scales.yL(data3d[i].py))} stroke="var(--accent)" strokeWidth={2.5} fill="none" />
              )}
              <g>
                <text x={10} y={H - 32} style={{ fontSize: 11 }} fill="var(--warm)">Euclidean: {eucD.toFixed(1)}</text>
                <text x={10} y={H - 16} style={{ fontSize: 11 }} fill="var(--accent)">geodesic (graph): {geoD.toFixed(1)}</text>
              </g>
            </>
          )}
          {data3d.map((p, i) => {
            const isEndpoint = i === endpointA || i === endpointB
            return (
              <circle key={i} cx={scales.xL(p.px)} cy={scales.yL(p.py)} r={isEndpoint ? 5 : 3.3} fill={color(p.t)} stroke={isEndpoint ? 'var(--text)' : 'white'} strokeWidth={isEndpoint ? 2 : 0.55} />
            )
          })}
        </g>
        {/* Right: Isomap embedding */}
        <g opacity={activePart && activePart !== 'embedding' ? 0.35 : 1}>
          <text x={scales.paneW + 30} y={18} style={{ fontSize: 11, letterSpacing: '0.04em' }} fill="var(--text-3)">ISOMAP EMBEDDING (2D)</text>
          {!disconnected && embPanel.emb.map((p, i) => (
            <circle key={i} cx={embPanel.x(p[0])} cy={embPanel.y(p[1])} r={(i === endpointA || i === endpointB) ? 5 : 3.3} fill={color(data3d[i].t)} stroke={(i === endpointA || i === endpointB) ? 'var(--text)' : 'white'} strokeWidth={(i === endpointA || i === endpointB) ? 2 : 0.55} />
          ))}
          {!disconnected && (
            <line x1={embPanel.x(embPanel.emb[endpointA][0])} y1={embPanel.y(embPanel.emb[endpointA][1])} x2={embPanel.x(embPanel.emb[endpointB][0])} y2={embPanel.y(embPanel.emb[endpointB][1])} stroke="var(--accent)" strokeWidth={2} strokeDasharray="6 3" />
          )}
          {disconnected && (
            <g transform={`translate(${scales.paneW + 30 + scales.paneW / 2},${H / 2})`}>
              <text textAnchor="middle" style={{ fontSize: 12 }} fill="var(--text-2)">Isomap needs a connected graph.</text>
              <text textAnchor="middle" y={18} style={{ fontSize: 11 }} fill="var(--text-3)">Increase k.</text>
            </g>
          )}
        </g>
      </svg>
    </div>
  )
}

function pathD(path: number[], xf: (i: number) => number, yf: (i: number) => number) {
  if (path.length === 0) return ''
  let s = `M${xf(path[0])},${yf(path[0])}`
  for (let i = 1; i < path.length; i++) s += `L${xf(path[i])},${yf(path[i])}`
  return s
}

// Arc length along the spiral r = t, i.e. ∫√(1+t²)dt. Used both to sample
// the roll uniformly by surface area (uniform-in-t oversamples the tight
// inner windings and starves the rim, which destroys the k sweet spot) and
// to measure along-the-manifold distance for shortcut detection.
function spiralArc(t: number) {
  return 0.5 * (t * Math.sqrt(1 + t * t) + Math.asinh(t))
}

const ROLL_T0 = 1.5
const ROLL_T1 = 1.5 + 4.5 * Math.PI

function buildIsomapLayout(n: number, seed: number): IsoLayout {
  const W = 680, H = 380
  const rng = mulberry32(seed)
  const N = Math.max(10, Math.round(n))
  const data3d: Point3[] = []
  const angle = 0.35, tilt = 0.6
  const sx = Math.cos(angle), sz = Math.sin(angle)
  function project(p: { x: number; y: number; z: number }) {
    return { px: p.x * sx - p.z * sz, py: p.y * Math.cos(tilt) - (p.x * sz + p.z * sx) * Math.sin(tilt) }
  }
  const s0 = spiralArc(ROLL_T0), s1 = spiralArc(ROLL_T1)
  for (let i = 0; i < N; i++) {
    // invert s(t) by bisection → uniform sampling in arc length
    const s = s0 + rng() * (s1 - s0)
    let lo = ROLL_T0, hi = ROLL_T1
    for (let b = 0; b < 40; b++) { const mid = (lo + hi) / 2; if (spiralArc(mid) < s) lo = mid; else hi = mid }
    const t = (lo + hi) / 2
    const h = rng() * 8
    const p = { x: t * Math.cos(t), y: h, z: t * Math.sin(t), t, h, i }
    const pr = project(p)
    data3d.push({ ...p, ...pr })
  }
  const xExt = d3.extent(data3d, (d) => d.px) as [number, number]
  const yExt = d3.extent(data3d, (d) => d.py) as [number, number]
  const pad = 1.5
  const paneW = (W - 40) / 2
  const paneH = H - 70
  const xL = d3.scaleLinear([xExt[0] - pad, xExt[1] + pad], [10, 10 + paneW])
  const yL = d3.scaleLinear([yExt[0] - pad, yExt[1] + pad], [paneH + 20, 30])
  const tExt = d3.extent(data3d, (d) => d.t) as [number, number]
  const color = d3.scaleSequential(d3.interpolateViridis).domain(tExt)
  // Pick endpoints near the two extremes of the spiral.
  const sortedByT = [...data3d].sort((a, b) => a.t - b.t)
  const endpointA = sortedByT[2].i
  const endpointB = sortedByT[sortedByT.length - 3].i
  return { N, data3d, scales: { xL, yL, paneW, paneH }, color, endpointA, endpointB }
}

function buildIsomapModel(layout: IsoLayout, k: number, shortcutRatio: number) {
  const { N, data3d, scales, endpointA, endpointB } = layout
  const W = 680
  // Undirected (symmetrized) kNN graph, as Isomap uses: if i picks j OR j
  // picks i, the edge exists for both. The earlier directed version made
  // Dijkstra-from-A unable to reach nodes whose only link pointed *at* them,
  // so the geodesic came back Infinity on a graph reported as connected.
  const adj = Array.from({ length: N }, () => [] as { j: number; d: number }[])
  const edges: { a: number; b: number; d: number; shortcut: boolean }[] = []
  const seenEdge = new Set<string>()
  for (let i = 0; i < N; i++) {
    const arr: { j: number; d: number }[] = []
    for (let j = 0; j < N; j++) {
      if (i === j) continue
      const d = Math.hypot(data3d[i].x - data3d[j].x, data3d[i].y - data3d[j].y, data3d[i].z - data3d[j].z)
      arr.push({ j, d })
    }
    arr.sort((a, b) => a.d - b.d)
    const top = arr.slice(0, Math.max(1, k))
    for (const e of top) {
      const a = Math.min(i, e.j)
      const b = Math.max(i, e.j)
      const key = `${a}-${b}`
      if (seenEdge.has(key)) continue
      seenEdge.add(key)
      adj[a].push({ j: b, d: e.d })
      adj[b].push({ j: a, d: e.d })
      // shortcut = the edge is much shorter through 3D space than the walk
      // along the rolled-up sheet between its endpoints (true manifold
      // distance ≈ hypot of arc-length gap and height gap). A plain
      // t-parameter gap mislabels ordinary along-the-arm edges in sparse
      // regions, which is what previously painted the whole graph orange.
      const along = Math.hypot(spiralArc(data3d[b].t) - spiralArc(data3d[a].t), data3d[a].h - data3d[b].h)
      edges.push({ a, b, d: e.d, shortcut: along > shortcutRatio * e.d })
    }
  }

  function dijkstra(src: number) {
    const dist = new Array(N).fill(Infinity)
    const prev = new Array(N).fill(-1)
    dist[src] = 0
    const visited = new Array(N).fill(false)
    for (let it = 0; it < N; it++) {
      let u = -1, best = Infinity
      for (let i = 0; i < N; i++) if (!visited[i] && dist[i] < best) { best = dist[i]; u = i }
      if (u < 0) break
      visited[u] = true
      for (const { j, d } of adj[u]) if (dist[u] + d < dist[j]) { dist[j] = dist[u] + d; prev[j] = u }
    }
    return { dist, prev }
  }

  // count connected components via BFS over adj
  const seen = new Array(N).fill(false)
  let components = 0
  for (let s = 0; s < N; s++) {
    if (seen[s]) continue
    components++
    const stack = [s]
    while (stack.length) {
      const u = stack.pop()!
      if (seen[u]) continue
      seen[u] = true
      for (const { j } of adj[u]) if (!seen[j]) stack.push(j)
    }
  }
  const disconnected = components > 1
  const shortcutCount = edges.filter((e) => e.shortcut).length

  // path between the two display endpoints
  let path: number[] = []
  let geoD = 0
  let eucD = Math.hypot(
    data3d[endpointA].x - data3d[endpointB].x,
    data3d[endpointA].y - data3d[endpointB].y,
    data3d[endpointA].z - data3d[endpointB].z,
  )
  if (!disconnected) {
    const { prev, dist } = dijkstra(endpointA)
    let cur = endpointB
    const p = [cur]
    while (prev[cur] !== -1 && cur !== endpointA) { cur = prev[cur]; p.push(cur) }
    path = p.reverse()
    geoD = dist[endpointB]
  }

  // Isomap embedding (only when connected, otherwise skip). Real Isomap is
  // classical MDS (eigendecomposition) on the geodesic distance matrix — the
  // earlier gradient-descent solver never converged here and rendered every
  // k as the same structureless blob.
  let embPanel: { emb: number[][]; x: d3.ScaleLinear<number, number>; y: d3.ScaleLinear<number, number> }
  if (!disconnected) {
    const Dgeo = Array.from({ length: N }, () => new Array(N).fill(0))
    for (let i = 0; i < N; i++) {
      const { dist } = dijkstra(i)
      for (let j = 0; j < N; j++) Dgeo[i][j] = isFinite(dist[j]) ? dist[j] : 0
    }
    const emb = classicalMds2(Dgeo)
    // Stabilize orientation across k changes so dragging the slider reads as
    // a continuous morph (eigenvectors come back with arbitrary sign): axis 1
    // runs endpointA → endpointB, axis 2 follows the roll's height.
    if (emb[endpointB][0] < emb[endpointA][0]) for (const p of emb) p[0] = -p[0]
    const hMean = d3.mean(data3d, (d) => d.h) ?? 0
    let hCov = 0
    for (let i = 0; i < N; i++) hCov += emb[i][1] * (data3d[i].h - hMean)
    if (hCov < 0) for (const p of emb) p[1] = -p[1]
    // Aspect-preserving fit: the honest unroll is a long thin ribbon, and
    // stretching the axes independently would blow vertical noise up into
    // fake structure.
    const ex = d3.extent(emb, (d) => d[0]) as [number, number]
    const ey = d3.extent(emb, (d) => d[1]) as [number, number]
    const availX: [number, number] = [scales.paneW + 30, W - 10]
    const availY: [number, number] = [scales.paneH + 20, 30]
    const availW = availX[1] - availX[0]
    const availH = availY[0] - availY[1]
    const spanX = Math.max(1e-6, ex[1] - ex[0])
    const spanY = Math.max(1e-6, ey[1] - ey[0])
    const s = Math.min(availW / (spanX * 1.08), availH / (spanY * 1.08))
    const cx = (ex[0] + ex[1]) / 2, cy = (ey[0] + ey[1]) / 2
    const mx = (availX[0] + availX[1]) / 2, my = (availY[0] + availY[1]) / 2
    const xEmb = d3.scaleLinear([cx - 1, cx + 1], [mx - s, mx + s])
    const yEmb = d3.scaleLinear([cy - 1, cy + 1], [my + s, my - s])
    embPanel = { emb, x: xEmb, y: yEmb }
  } else {
    embPanel = { emb: [], x: d3.scaleLinear([0, 1], [0, 1]), y: d3.scaleLinear([0, 1], [0, 1]) }
  }

  return { edges, embPanel, path, components, shortcutCount, eucD, geoD, disconnected }
}

// Classical (Torgerson) MDS to 2D: double-center the squared distance matrix
// and take the top two eigenvectors via power iteration with deflation.
// Deterministic (fixed pseudo-random init vector), exact enough for display.
function classicalMds2(D: number[][]) {
  const N = D.length
  const D2 = D.map((row) => row.map((v) => v * v))
  const rowMean = new Array(N).fill(0)
  let total = 0
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) rowMean[i] += D2[i][j] / N
    total += rowMean[i] / N
  }
  const B = Array.from({ length: N }, (_, i) =>
    Array.from({ length: N }, (_, j) => -0.5 * (D2[i][j] - rowMean[i] - rowMean[j] + total)),
  )
  function powerIter(deflate: { v: number[]; lambda: number } | null) {
    let v = Array.from({ length: N }, (_, i) => ((Math.sin(i * 12.9898) * 43758.5453) % 1) || 1e-3)
    let lambda = 0
    for (let it = 0; it < 140; it++) {
      const w = new Array(N).fill(0)
      for (let i = 0; i < N; i++) {
        const Bi = B[i]
        let s = 0
        for (let j = 0; j < N; j++) s += Bi[j] * v[j]
        w[i] = s
      }
      if (deflate) {
        let dot = 0
        for (let i = 0; i < N; i++) dot += w[i] * deflate.v[i]
        for (let i = 0; i < N; i++) w[i] -= dot * deflate.v[i]
      }
      const norm = Math.sqrt(w.reduce((s, x) => s + x * x, 0)) || 1
      lambda = norm
      v = w.map((x) => x / norm)
    }
    return { v, lambda }
  }
  const e1 = powerIter(null)
  const e2 = powerIter(e1)
  const s1 = Math.sqrt(Math.max(0, e1.lambda))
  const s2 = Math.sqrt(Math.max(0, e2.lambda))
  return Array.from({ length: N }, (_, i) => [e1.v[i] * s1, e2.v[i] * s2])
}

// --------- Figure 4: Diffusion Map ---------

// Tweakable surface — override per-instance in markdown: :::figure{id=diffusion steps=12}
export const DIFFUSION_DEFAULTS = {
  steps: 4, // initial diffusion steps t (reader slider)
  maxSteps: 30, // slider maximum (the original article ran 0–30)
  source: 2, // node id the walk starts from (clicking a node changes it)
  lobeSize: 20, // nodes in each dense lobe of the dumbbell
  sigma: 60, // edge-weight kernel scale: w = exp(-d/σ), in screen px
  seed: 21, // node-placement seed
}

// steps matches the reader slider (0–maxSteps, article ran 0–30); lobeSize
// past ~60 turns the fixed 455px panel into a blob; sigma is in screen px
// (edge lengths ~30–100) and σ→0 zeroes every kernel weight.
export const DIFFUSION_HINTS = {
  steps: { min: 0, max: 30, step: 1 },
  maxSteps: { min: 5, max: 100 },
  lobeSize: { min: 3, max: 60 },
  sigma: { min: 5, max: 300, step: 5 },
}

export function DiffusionFigure(props: FigureProps) {
  const steps0 = num(props.steps, DIFFUSION_DEFAULTS.steps)
  const maxSteps = num(props.maxSteps, DIFFUSION_DEFAULTS.maxSteps)
  const lobeSize = num(props.lobeSize, DIFFUSION_DEFAULTS.lobeSize)
  const sigma = num(props.sigma, DIFFUSION_DEFAULTS.sigma)
  const seed = num(props.seed, DIFFUSION_DEFAULTS.seed)
  const model = useMemo(() => buildDiffusionModel(lobeSize, sigma, seed), [lobeSize, sigma, seed])
  // clamp the source prop to a valid node id for the current graph size
  const source0 = Math.max(0, Math.min(model.nodes.length - 1, Math.round(num(props.source, DIFFUSION_DEFAULTS.source))))
  const [t, setT] = useState(steps0)
  useEffect(() => setT(steps0), [steps0])
  const [source, setSource] = useState(source0)
  useEffect(() => setSource(source0), [source0])
  const { activePart } = useFigureHighlight(props.figureId as string)
  const reduced = usePrefersReducedMotion()
  // Play: advance the walk step by step so the probability cloud visibly
  // spreads like heat — filling the seeded lobe quickly, then leaking
  // through the bridge. Restarts from 0 when pressed at the end.
  const [playing, setPlaying] = useState(false)
  useEffect(() => {
    if (!playing) return
    if (reduced) { setT(maxSteps); setPlaying(false); return }
    const id = window.setInterval(() => {
      setT((cur) => {
        if (cur >= maxSteps) { setPlaying(false); return cur }
        return cur + 1
      })
    }, 180)
    return () => window.clearInterval(id)
  }, [playing, reduced, maxSteps])
  const onPlay = () => {
    if (playing) { setPlaying(false); return }
    if (t >= maxSteps) setT(0)
    setPlaying(true)
  }
  const p = useMemo(() => diffusionProb(model.P, source, t), [model.P, source, t])
  const maxP = d3.max(p) || 1
  const color = d3.scaleSequential(d3.interpolateBlues).domain([0, maxP])
  const candidates = useMemo(() => diffusionCandidates(model.nodes, source), [model.nodes, source])
  const candidateById = new Map(candidates.map((c) => [c.id, c]))
  const distances = useMemo(
    () => candidates.map((c) => ({ ...c, d: diffusionDistance(model.P, source, c.id, t) })),
    [candidates, model.P, source, t],
  )
  const maxD = Math.max(0.05, d3.max(distances, (d) => d.d) ?? 0.05)
  const mass = [0, 0, 0]
  for (const n of model.nodes) mass[n.group] += p[n.id]

  const W = 680, H = 380
  const panelX = 480
  const barW = 165
  const massY = 68
  const distY = 192 // below the mass legend (which ends ≈y 136) + its header
  const regionColors = ['var(--accent)', 'var(--purple)', 'var(--warm)']
  const labels = ['left cluster', 'bridge', 'right cluster']
  const sourceGroup = model.nodes[source]?.group ?? 0

  return (
    <div>
      <div className="controls">
        <button type="button" onClick={onPlay}>{playing ? '❚❚ pause' : '▶ play'}</button>
        <Slider label="steps" value={t} min={0} max={maxSteps} step={1} onChange={(v) => { setPlaying(false); setT(v) }} />
      </div>
      <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet">
        {/* Graph + probability cloud */}
        <g opacity={activePart && activePart !== 'graph' ? 0.35 : 1}>
          <text x={10} y={18} style={{ fontSize: 11, letterSpacing: '0.04em' }} fill="var(--text-3)">DUMBBELL GRAPH · t-STEP WALK</text>
          {model.edges.map((e, i) => <line key={i} x1={model.nodes[e.a].x} y1={model.nodes[e.a].y} x2={model.nodes[e.b].x} y2={model.nodes[e.b].y} stroke="var(--border-2)" strokeWidth={1} />)}
          {model.nodes.map((n) => {
            const marker = candidateById.get(n.id)
            const isSource = n.id === source
            return (
              <g key={n.id} onClick={() => setSource(n.id)} style={{ cursor: 'pointer' }}>
                {marker && <circle cx={n.x} cy={n.y} r={11} fill="none" stroke={marker.color} strokeWidth={2.2} strokeDasharray={marker.kind === 'bridge' ? '3 2' : undefined} />}
                <circle cx={n.x} cy={n.y} r={isSource ? 9 : 6} fill={isSource ? 'var(--warm)' : color(p[n.id])} stroke={isSource ? 'var(--warm)' : 'var(--text-3)'} strokeWidth={isSource ? 3 : 0.8} />
              </g>
            )
          })}
          <text x={10} y={H - 14} style={{ fontSize: 11 }} fill="var(--text-3)">
            blue intensity = probability of landing at that node after {t} step{t === 1 ? '' : 's'}
          </text>
        </g>

        {/* Right summary panel */}
        <g transform={`translate(${panelX},0)`}>
          <g opacity={activePart && activePart !== 'mass' ? 0.35 : 1}>
          <text x={0} y={18} style={{ fontSize: 11, letterSpacing: '0.04em' }} fill="var(--text-3)">WHERE THE WALKER GOES</text>
          <text x={0} y={42} style={{ fontSize: 11 }} fill="var(--text-2)">probability mass by region</text>
          <g transform={`translate(0,${massY})`}>
            {(() => {
              let x = 0
              return mass.map((m, i) => {
                const w = m * barW
                const el = <rect key={i} x={x} y={0} width={w} height={18} fill={regionColors[i]} opacity={0.85} />
                x += w
                return el
              })
            })()}
            <rect x={0} y={0} width={barW} height={18} fill="none" stroke="var(--border)" />
            {mass.map((m, i) => (
              <g key={labels[i]} transform={`translate(0,${34 + i * 17})`}>
                <rect x={0} y={-9} width={9} height={9} fill={regionColors[i]} />
                <text x={14} y={0} style={{ fontSize: 10 }} fill={i === sourceGroup ? 'var(--text)' : 'var(--text-3)'}>{labels[i]}</text>
                <text x={barW} y={0} textAnchor="end" style={{ fontSize: 10 }} fill="var(--text-3)">{(m * 100).toFixed(0)}%</text>
              </g>
            ))}
          </g>
          </g>

          <g opacity={activePart && activePart !== 'distance' ? 0.35 : 1}>
          <text x={0} y={distY - 26} style={{ fontSize: 11, letterSpacing: '0.04em' }} fill="var(--text-3)">DIFFUSION DISTANCE</text>
          <text x={0} y={distY - 12} style={{ fontSize: 11 }} fill="var(--text-2)">compare starting clouds</text>
          <g transform={`translate(0,${distY})`}>
            {distances.map((d, i) => (
              <g key={d.id} transform={`translate(0,${i * 48})`}>
                <text x={0} y={2} style={{ fontSize: 10 }} fill="var(--text-2)">{d.label}</text>
                <text x={barW} y={2} textAnchor="end" style={{ fontSize: 10 }} fill="var(--text-3)">{d.d.toFixed(2)}</text>
                <rect x={0} y={8} width={barW} height={12} fill="var(--muted)" />
                <rect x={0} y={8} width={(d.d / maxD) * barW} height={12} fill={d.color} opacity={0.9} />
              </g>
            ))}
          </g>
          <foreignObject x={0} y={314} width={185} height={64}>
            <div style={{ fontSize: '0.72rem', lineHeight: 1.35, color: 'var(--text-3)' }}>
              Same-lobe starts soon share a future-walk distribution; across the bridge they stay different far longer.
            </div>
          </foreignObject>
          </g>
        </g>
      </svg>
      <p className="figure-hint">click any node to seed the random walk</p>
    </div>
  )
}

function buildDiffusionModel(lobeSize: number, sigma: number, seed: number) {
  const W = 455, H = 380
  const L = Math.max(3, Math.round(lobeSize))
  const rng = mulberry32(seed)
  const nodes: { id: number; group: number; x: number; y: number }[] = []
  for (let i = 0; i < L; i++) nodes.push({ id: i, group: 0, x: 120 + gaussian(rng) * 34, y: 190 + gaussian(rng) * 58 })
  for (let i = 0; i < L; i++) nodes.push({ id: L + i, group: 2, x: 350 + gaussian(rng) * 34, y: 190 + gaussian(rng) * 58 })
  // three bridge nodes between the lobes (ids 2L, 2L+1, 2L+2)
  const b0 = 2 * L
  nodes.push({ id: b0, group: 1, x: 215, y: 190 }, { id: b0 + 1, group: 1, x: 260, y: 190 }, { id: b0 + 2, group: 1, x: 305, y: 190 })
  nodes.forEach((n) => { n.x = Math.max(35, Math.min(W - 35, n.x)); n.y = Math.max(42, Math.min(H - 42, n.y)) })
  const N = nodes.length
  const edges: { a: number; b: number }[] = []
  function addEdge(a: number, b: number) { if (a < b) edges.push({ a, b }); else if (b < a) edges.push({ a: b, b: a }) }
  for (let gr = 0; gr <= 2; gr++) {
    const members = nodes.filter((n) => n.group === gr).map((n) => n.id)
    for (const i of members) {
      const arr = members.map((j) => ({ j, d: Math.hypot(nodes[i].x - nodes[j].x, nodes[i].y - nodes[j].y) })).filter((e) => e.j !== i).sort((a, b) => a.d - b.d).slice(0, 3)
      for (const e of arr) addEdge(i, e.j)
    }
  }
  addEdge(b0, b0 + 1); addEdge(b0 + 1, b0 + 2)
  const leftSorted = nodes.filter((n) => n.group === 0).map((n) => n.id).sort((a, b) => Math.hypot(nodes[b0].x - nodes[a].x, nodes[b0].y - nodes[a].y) - Math.hypot(nodes[b0].x - nodes[b].x, nodes[b0].y - nodes[b].y))
  addEdge(b0, leftSorted[0]); addEdge(b0, leftSorted[1])
  const rightSorted = nodes.filter((n) => n.group === 2).map((n) => n.id).sort((a, b) => Math.hypot(nodes[b0 + 2].x - nodes[a].x, nodes[b0 + 2].y - nodes[a].y) - Math.hypot(nodes[b0 + 2].x - nodes[b].x, nodes[b0 + 2].y - nodes[b].y))
  addEdge(b0 + 2, rightSorted[0]); addEdge(b0 + 2, rightSorted[1])
  const edgeSet = new Set(edges.map((e) => `${e.a}-${e.b}`))
  const finalEdges = [...edgeSet].map((s) => { const [a, b] = s.split('-').map(Number); return { a, b } })
  const adjW = Array.from({ length: N }, () => new Array(N).fill(0))
  for (const e of finalEdges) {
    const d = Math.hypot(nodes[e.a].x - nodes[e.b].x, nodes[e.a].y - nodes[e.b].y)
    const w = Math.exp(-d / sigma)
    adjW[e.a][e.b] += w; adjW[e.b][e.a] += w
  }
  const P = Array.from({ length: N }, () => new Array(N).fill(0))
  for (let i = 0; i < N; i++) {
    const s = d3.sum(adjW[i])
    if (s > 0) for (let j = 0; j < N; j++) P[i][j] = adjW[i][j] / s
  }
  return { nodes, edges: finalEdges, P }
}

function diffusionCandidates(nodes: { id: number; group: number; x: number; y: number }[], source: number) {
  const src = nodes[source]
  const side = src.group === 2 ? 2 : 0
  const otherSide = side === 0 ? 2 : 0
  const samePool = nodes.filter((n) => n.group === side && n.id !== source)
  const oppositePool = nodes.filter((n) => n.group === otherSide)
  const closest = (pool: typeof nodes, target: { x: number; y: number }) =>
    pool.slice().sort((a, b) => Math.hypot(a.x - target.x, a.y - target.y) - Math.hypot(b.x - target.x, b.y - target.y))[0]
  const bridgeNodes = nodes.filter((n) => n.group === 1) // [left end, middle, right end]
  const same = src.group === 1 ? closest(nodes.filter((n) => n.group === 0), src) : closest(samePool, src)
  const bridge = source === bridgeNodes[1]?.id ? bridgeNodes[0] : bridgeNodes[1] ?? bridgeNodes[0]
  const oppositeAnchor = (otherSide === 0 ? bridgeNodes[0] : bridgeNodes[bridgeNodes.length - 1]) ?? src
  const opposite = closest(oppositePool, oppositeAnchor)
  return [
    { id: same.id, label: 'nearby start', kind: 'same', color: 'var(--green)' },
    { id: bridge.id, label: 'bridge start', kind: 'bridge', color: 'var(--purple)' },
    { id: opposite.id, label: 'opposite lobe', kind: 'across', color: 'var(--warm)' },
  ]
}

function diffusionDistance(P: number[][], a: number, b: number, t: number) {
  const pa = diffusionProb(P, a, t)
  const pb = diffusionProb(P, b, t)
  let s = 0
  for (let i = 0; i < pa.length; i++) s += (pa[i] - pb[i]) ** 2
  return Math.sqrt(s)
}

function diffusionProb(P: number[][], source: number, t: number) {
  const N = P.length
  let p = new Array(N).fill(0)
  p[source] = 1
  for (let s = 0; s < t; s++) {
    const next = new Array(N).fill(0)
    for (let i = 0; i < N; i++) {
      if (p[i] === 0) continue
      for (let j = 0; j < N; j++) next[j] += p[i] * P[i][j]
    }
    p = next
  }
  return p
}
