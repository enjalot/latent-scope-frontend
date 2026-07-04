import { useEffect, useMemo, useRef, useState } from 'react'
import * as d3 from 'd3'
import type { FigureProps } from './registry'
import { num, bool } from '../../runtime/lib/params'
import { useFigureHighlight } from '../../runtime/store'

// Faithful React ports of docs/dim-reduction/07-discrete-grids.html.
// One deliberate divergence from the original: training samples and the
// BMU-cell jitter are drawn from seeded RNGs (the original used
// Math.random()), so every run of a figure is reproducible.

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

// Series-wide category palette: accent, warm, green, purple, text-2.
function colors(i: number) { return ['var(--accent)', 'var(--warm)', 'var(--green)', 'var(--purple)', 'var(--text-2)'][i % 5] }

// Dim a pane when a DIFFERENT part of this figure is term-highlighted.
function paneOpacity(activePart: string | null | undefined, id: string) {
  return typeof activePart === 'string' && activePart !== id ? 0.35 : 1
}

// ---------- Figure 1: SOM training on 2D data ----------

const SOM_W = 680
const SOM_H = 380

type Vec2 = [number, number]

export const SOM_DEFAULTS = {
  gridSize: 14, // SOM side length (grid is gridSize × gridSize); reader slider, 6–20
  maxIter: 1500, // training iterations before the run auto-stops
  nData: 250, // points in the C-shaped 2D dataset
  noise: 0.22, // gaussian spread of data points around the C curve
  lr0: 0.4, // initial learning rate (decays exponentially over training)
  sigmaFactor: 0.6, // initial neighborhood radius = gridSize × this (decays with lr)
  stepsPerFrame: 6, // training steps per animation frame; 6 ≈ a 4s unfolding
  dataSeed: 5, // RNG seed for the dataset
  initSeed: 42, // RNG seed for the prototype-initialization jitter
  sampleSeed: 101, // RNG seed for the training sample order
  autoplay: true, // start training when the figure scrolls into view
}

// Knob bounds where the magnitude heuristic guesses wrong: gridSize must
// match the reader slider (6–20), lr0/sigmaFactor/noise are fractions where
// max 5 is nonsense, and nData past ~1000 makes the per-frame BMU loop crawl.
export const SOM_HINTS = {
  gridSize: { min: 6, max: 20, step: 1 },
  nData: { min: 20, max: 1000, step: 10 },
  noise: { min: 0, max: 1, step: 0.01 },
  lr0: { min: 0.05, max: 1, step: 0.05 },
  sigmaFactor: { min: 0.1, max: 1, step: 0.05 },
  stepsPerFrame: { min: 1, max: 60, step: 1 },
}

export function SOMFigure(props: FigureProps) {
  const size0 = num(props.gridSize, SOM_DEFAULTS.gridSize)
  const maxIter = num(props.maxIter, SOM_DEFAULTS.maxIter)
  const nData = num(props.nData, SOM_DEFAULTS.nData)
  const noise = num(props.noise, SOM_DEFAULTS.noise)
  const lr0 = num(props.lr0, SOM_DEFAULTS.lr0)
  const sigmaFactor = num(props.sigmaFactor, SOM_DEFAULTS.sigmaFactor)
  const stepsPerFrame = num(props.stepsPerFrame, SOM_DEFAULTS.stepsPerFrame)
  const dataSeed = num(props.dataSeed, SOM_DEFAULTS.dataSeed)
  const initSeed = num(props.initSeed, SOM_DEFAULTS.initSeed)
  const sampleSeed = num(props.sampleSeed, SOM_DEFAULTS.sampleSeed)
  const autoplay = bool(props.autoplay, SOM_DEFAULTS.autoplay)

  const { activePart } = useFigureHighlight(props.figureId as string)

  const dataPts = useMemo(() => makeSomData(nData, noise, dataSeed), [nData, noise, dataSeed])
  const [size, setSize] = useState(size0)
  const [running, setRunning] = useState(false)
  const [iter, setIter] = useState(0)
  // Index of the grid cell under the pointer (in either pane), or null.
  const [hover, setHover] = useState<number | null>(null)
  // Refs hold the simulation state so the rAF loop never trains from a
  // stale iteration count (state closures lag a frame behind).
  const iterRef = useRef(0)
  const protosRef = useRef<Vec2[]>([])
  const sampleRng = useRef<() => number>(mulberry32(sampleSeed))
  const rootRef = useRef<HTMLDivElement>(null)
  const [seen, setSeen] = useState(false)

  // Follow live knob/markdown changes. Pause first so the running loop
  // never trains a grid whose size changed under it.
  useEffect(() => { setRunning(false); setSize(size0) }, [size0])

  // Autoplay waits until the figure scrolls into view — the unfolding IS
  // the lesson, and training on mount would finish long before the reader
  // gets here. Readers who prefer reduced motion get the trained map
  // immediately instead of an animation.
  useEffect(() => {
    if (!autoplay || seen) return
    const el = rootRef.current
    if (!el || typeof IntersectionObserver === 'undefined') { setSeen(true); return }
    const obs = new IntersectionObserver(
      (entries) => { if (entries.some((e) => e.isIntersecting)) setSeen(true) },
      { threshold: 0.35 },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [autoplay, seen])
  useEffect(() => {
    if (!autoplay || !seen) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      if (iterRef.current < maxIter) trainStep(maxIter - iterRef.current)
      return
    }
    setRunning(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoplay, seen])

  const makeProtos = (G: number): Vec2[] => {
    const rng = mulberry32(initSeed)
    const protos: Vec2[] = []
    for (let r = 0; r < G; r++) {
      for (let c = 0; c < G; c++) {
        // Spread the initial grid in a small central rectangle.
        const px = -0.5 + (c / (G - 1)) * 1
        const py = -0.3 + (r / (G - 1)) * 0.6
        protos.push([px + gaussian(rng) * 0.02, py + gaussian(rng) * 0.02])
      }
    }
    return protos
  }

  const initialize = (G: number) => {
    protosRef.current = makeProtos(G)
    sampleRng.current = mulberry32(sampleSeed)
    iterRef.current = 0
    setIter(0)
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { initialize(size) }, [size, dataPts, initSeed, sampleSeed])

  const trainStep = (steps: number) => {
    const G = size
    const protos = protosRef.current
    let it = iterRef.current
    const sigma0 = G * sigmaFactor
    for (let s = 0; s < steps; s++) {
      const progress = it / maxIter
      const lr = lr0 * Math.exp(-progress * 3)
      const sigma = sigma0 * Math.exp(-progress * 3)
      const sample = dataPts[Math.floor(sampleRng.current() * dataPts.length)]
      let bmu = 0, bd = Infinity
      for (let i = 0; i < protos.length; i++) {
        const d = (protos[i][0] - sample[0]) ** 2 + (protos[i][1] - sample[1]) ** 2
        if (d < bd) { bd = d; bmu = i }
      }
      const bmuR = Math.floor(bmu / G), bmuC = bmu % G
      for (let i = 0; i < protos.length; i++) {
        const r = Math.floor(i / G), c = i % G
        const gd = Math.hypot(r - bmuR, c - bmuC)
        const h = Math.exp(-(gd * gd) / (2 * sigma * sigma + 1e-6))
        protos[i][0] += lr * h * (sample[0] - protos[i][0])
        protos[i][1] += lr * h * (sample[1] - protos[i][1])
      }
      it++
    }
    iterRef.current = it
    setIter(it)
  }

  useEffect(() => {
    if (!running) return
    if (iterRef.current >= maxIter) { setRunning(false); return }
    let raf = 0
    const tick = () => {
      trainStep(stepsPerFrame)
      if (iterRef.current >= maxIter) { setRunning(false); return }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, size, dataPts, lr0, sigmaFactor, maxIter, stepsPerFrame])

  const G = size
  // The initialize effect hasn't run yet on the first render (and for one
  // render after a grid-size change), so fall back to a fresh grid rather
  // than indexing into a stale or empty prototype array.
  const protos =
    protosRef.current.length === G * G ? protosRef.current : makeProtos(G)
  const paneW = SOM_W / 2
  const lW = paneW - 40, lH = SOM_H - 40
  const xsc = d3.scaleLinear([-3, 3], [8, lW - 8])
  const ysc = d3.scaleLinear([-3, 3], [lH - 8, 8])
  const gridXScale = d3.scaleLinear([0, 1], [8, lW - 8])
  const gridYScale = d3.scaleLinear([0, 1], [lH - 8, 8])
  const lines: [number, number][] = []
  for (let r = 0; r < G; r++) for (let c = 0; c < G; c++) {
    if (c < G - 1) lines.push([r * G + c, r * G + c + 1])
    if (r < G - 1) lines.push([r * G + c, (r + 1) * G + c])
  }
  const counts = new Array(protos.length).fill(0)
  const bmuOf = new Array(dataPts.length).fill(0)
  for (let k = 0; k < dataPts.length; k++) {
    const pt = dataPts[k]
    let bmu = 0, bd = Infinity
    for (let i = 0; i < protos.length; i++) {
      const d = (protos[i][0] - pt[0]) ** 2 + (protos[i][1] - pt[1]) ** 2
      if (d < bd) { bd = d; bmu = i }
    }
    counts[bmu]++
    bmuOf[k] = bmu
  }
  const maxC = Math.max(1, d3.max(counts) ?? 1)

  // Linked hover: the hovered cell plus its 4 grid neighbors, highlighted
  // in both panes. Seeing a cell's prototype AND its grid neighbors sit
  // together in data space is the topology-preservation claim made tangible.
  const hoverNbrs: number[] = []
  if (hover != null) {
    const hr = Math.floor(hover / G), hc = hover % G
    for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      const nr = hr + dr, nc = hc + dc
      if (nr >= 0 && nr < G && nc >= 0 && nc < G) hoverNbrs.push(nr * G + nc)
    }
  }
  const cellX = (i: number) => gridXScale((i % G) / G)
  const cellY = (i: number) => gridYScale((Math.floor(i / G) + 1) / G)
  const cellW = (lW - 16) / G - 1
  const cellH = (lH - 16) / G - 1

  return (
    <div ref={rootRef}>
      <div className="controls">
        <button className="figure-button" type="button" onClick={() => setRunning((r) => !r)}>{running ? 'pause' : 'play'}</button>
        <button className="figure-button" type="button" onClick={() => trainStep(50)}>step</button>
        <button className="figure-button" type="button" onClick={() => { setRunning(false); initialize(size) }}>reset</button>
        <label>grid size <span className="value">{size}</span><input type="range" min={6} max={20} value={size} step={1} onChange={(e) => { setRunning(false); setSize(+e.currentTarget.value) }} /></label>
        <label>iterations <span className="value">{iter}</span></label>
      </div>
      <svg width="100%" height={SOM_H} viewBox={`0 0 ${SOM_W} ${SOM_H}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label="Left: a self-organizing map grid deforming to cover a C-shaped 2D dataset. Right: the same grid drawn flat, cells shaded by how many data points map to each cell.">
        <g transform="translate(20,16)" opacity={paneOpacity(activePart, 'data-space')}>
          {activePart === 'data-space' && <rect x={-6} y={-16} width={lW + 12} height={lH + 22} rx={6} fill="none" stroke="var(--accent)" strokeWidth={1.5} />}
          <text y={-4} style={{ fontSize: 11, letterSpacing: '0.04em' }} fill="var(--text-3)">DATA SPACE WITH SOM GRID</text>
          {dataPts.map((d, i) => <circle key={i} cx={xsc(d[0])} cy={ysc(d[1])} r={2.2} fill="var(--text-3)" opacity={0.5} />)}
          {lines.map((e, i) => <line key={i} x1={xsc(protos[e[0]][0])} y1={ysc(protos[e[0]][1])} x2={xsc(protos[e[1]][0])} y2={ysc(protos[e[1]][1])} stroke="var(--accent)" strokeWidth={1} strokeOpacity={0.55} />)}
          {protos.map((p, i) => <circle key={i} cx={xsc(p[0])} cy={ysc(p[1])} r={2.5} fill="var(--accent)" opacity={0.9} />)}
          {hover != null && (
            <g pointerEvents="none">
              {dataPts.map((d, i) => bmuOf[i] === hover
                ? <circle key={`hd${i}`} cx={xsc(d[0])} cy={ysc(d[1])} r={3} fill="var(--warm)" opacity={0.9} />
                : null)}
              {hoverNbrs.map((n) => (
                <line key={`hl${n}`} x1={xsc(protos[hover][0])} y1={ysc(protos[hover][1])} x2={xsc(protos[n][0])} y2={ysc(protos[n][1])} stroke="var(--warm)" strokeWidth={2} />
              ))}
              {hoverNbrs.map((n) => (
                <circle key={`hn${n}`} cx={xsc(protos[n][0])} cy={ysc(protos[n][1])} r={3.5} fill="var(--warm)" opacity={0.75} />
              ))}
              <circle cx={xsc(protos[hover][0])} cy={ysc(protos[hover][1])} r={5} fill="var(--warm)" stroke="white" strokeWidth={1.5} />
            </g>
          )}
          {/* Invisible hit area: hovering near a prototype selects its cell. */}
          <rect
            x={0} y={0} width={lW} height={lH} fill="transparent" pointerEvents="all"
            onMouseMove={(e) => {
              const box = e.currentTarget.getBoundingClientRect()
              const mx = ((e.clientX - box.left) / box.width) * lW
              const my = ((e.clientY - box.top) / box.height) * lH
              let best = -1, bd = 18 * 18
              for (let i = 0; i < protos.length; i++) {
                const d = (xsc(protos[i][0]) - mx) ** 2 + (ysc(protos[i][1]) - my) ** 2
                if (d < bd) { bd = d; best = i }
              }
              setHover(best === -1 ? null : best)
            }}
            onMouseLeave={() => setHover(null)}
          />
        </g>
        <g transform={`translate(${paneW + 20},16)`} opacity={paneOpacity(activePart, 'grid-view')}>
          {activePart === 'grid-view' && <rect x={-6} y={-16} width={lW + 12} height={lH + 22} rx={6} fill="none" stroke="var(--accent)" strokeWidth={1.5} />}
          <text y={-4} style={{ fontSize: 11, letterSpacing: '0.04em' }} fill="var(--text-3)">GRID VIEW</text>
          <g onMouseLeave={() => setHover(null)}>
            {protos.map((_, i) => (
              <rect
                key={i}
                x={cellX(i)}
                y={cellY(i)}
                width={cellW}
                height={cellH}
                fill={d3.interpolateBlues(0.15 + (0.75 * counts[i]) / maxC)}
                stroke="white"
                strokeWidth={0.5}
                onMouseEnter={() => setHover(i)}
              />
            ))}
          </g>
          {hover != null && (
            <g pointerEvents="none">
              {hoverNbrs.map((n) => (
                <rect key={`gn${n}`} x={cellX(n)} y={cellY(n)} width={cellW} height={cellH} fill="none" stroke="var(--warm)" strokeWidth={1.5} opacity={0.75} />
              ))}
              <rect x={cellX(hover)} y={cellY(hover)} width={cellW} height={cellH} fill="none" stroke="var(--warm)" strokeWidth={2.5} />
            </g>
          )}
        </g>
      </svg>
    </div>
  )
}

function makeSomData(nData: number, noise: number, seed: number): Vec2[] {
  const rng = mulberry32(seed)
  const data: Vec2[] = []
  for (let i = 0; i < nData; i++) {
    // Parametric curve: a C shape.
    const t = rng()
    const a = Math.PI * (0.2 + t * 1.2)
    const r = 2
    const cx = r * Math.cos(a)
    const cy = r * Math.sin(a)
    data.push([cx + gaussian(rng) * noise, cy + gaussian(rng) * noise])
  }
  return data
}

// ---------- Figure 2: U-matrix on 20D data ----------

export const UMATRIX_DEFAULTS = {
  dim: 20, // ambient dimensionality of the synthetic data
  clusters: 3, // gaussian clusters, each active on its own block of 5 dims (needs dim ≥ 5×clusters)
  nPer: 60, // data points per cluster
  clusterSep: 3, // center magnitude on each cluster's active dims (separation between clusters)
  clusterNoise: 0.8, // within-cluster gaussian std
  gridSize: 12, // SOM side length (grid is gridSize × gridSize)
  maxIter: 3000, // offline training iterations (SOM is fully trained before render)
  lr0: 0.4, // initial learning rate (decays exponentially)
  sigmaFactor: 0.6, // initial neighborhood radius = gridSize × this
  seed: 29, // RNG seed for data generation + prototype init
  sampleSeed: 77, // RNG seed for the training sample order
  jitterSeed: 303, // RNG seed for the point jitter inside BMU cells
}

// Training runs synchronously in a useMemo, so cap gridSize/maxIter/dim well
// below the heuristic's 5×mag (a 500-cell grid or 50k iterations freezes the
// page); clusters is bounded by the 5-color palette and the 5-dims-per-cluster
// layout; lr0/sigmaFactor are fractions.
export const UMATRIX_HINTS = {
  dim: { min: 5, max: 50, step: 1 },
  clusters: { min: 1, max: 5, step: 1 },
  gridSize: { min: 6, max: 20, step: 1 },
  maxIter: { min: 100, max: 10000, step: 100 },
  lr0: { min: 0.05, max: 1, step: 0.05 },
  sigmaFactor: { min: 0.1, max: 1, step: 0.05 },
}

export function UMatrixFigure(props: FigureProps) {
  const dim = num(props.dim, UMATRIX_DEFAULTS.dim)
  const clusters = num(props.clusters, UMATRIX_DEFAULTS.clusters)
  const nPer = num(props.nPer, UMATRIX_DEFAULTS.nPer)
  const clusterSep = num(props.clusterSep, UMATRIX_DEFAULTS.clusterSep)
  const clusterNoise = num(props.clusterNoise, UMATRIX_DEFAULTS.clusterNoise)
  const gridSize = num(props.gridSize, UMATRIX_DEFAULTS.gridSize)
  const maxIter = num(props.maxIter, UMATRIX_DEFAULTS.maxIter)
  const lr0 = num(props.lr0, UMATRIX_DEFAULTS.lr0)
  const sigmaFactor = num(props.sigmaFactor, UMATRIX_DEFAULTS.sigmaFactor)
  const seed = num(props.seed, UMATRIX_DEFAULTS.seed)
  const sampleSeed = num(props.sampleSeed, UMATRIX_DEFAULTS.sampleSeed)
  const jitterSeed = num(props.jitterSeed, UMATRIX_DEFAULTS.jitterSeed)

  const { activePart } = useFigureHighlight(props.figureId as string)

  const model = useMemo(
    () => buildUMatrixModel({ dim, clusters, nPer, clusterSep, clusterNoise, gridSize, maxIter, lr0, sigmaFactor, seed, sampleSeed, jitterSeed }),
    [dim, clusters, nPer, clusterSep, clusterNoise, gridSize, maxIter, lr0, sigmaFactor, seed, sampleSeed, jitterSeed],
  )
  const W = 680, H = 340, paneW = W / 2
  const lW = paneW - 40, lH = H - 40
  const G = model.G
  const cellW = (lW - 10) / G
  const cellH = (lH - 10) / G

  // Linked hover: the same grid cell, outlined in both panes. Hovering a
  // dark wall on the left shows it landing on the boundary band between
  // colored regions on the right; a bright valley lands inside a region.
  const [hover, setHover] = useState<number | null>(null)
  const cx = (i: number) => (i % G) * cellW + 5
  const cy = (i: number) => Math.floor(i / G) * cellH + 5
  // White halo + text-color core so the outline reads on dark wall cells,
  // bright valley cells, and every cluster color.
  const outline = (i: number, key: string) => (
    <g key={key} pointerEvents="none">
      <rect x={cx(i) - 1} y={cy(i) - 1} width={cellW + 1} height={cellH + 1} fill="none" stroke="white" strokeWidth={3.5} />
      <rect x={cx(i) - 1} y={cy(i) - 1} width={cellW + 1} height={cellH + 1} fill="none" stroke="var(--text)" strokeWidth={1.5} />
    </g>
  )

  return (
    <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label="Left: U-matrix of a SOM trained on high-dimensional clusters — dark walls separate bright valleys. Right: the same grid with data points placed in their best-matching cells, colored by cluster. Hovering a cell highlights it in both panes.">
      <g transform="translate(20,16)" opacity={paneOpacity(activePart, 'umatrix')}>
        {activePart === 'umatrix' && <rect x={-1} y={-16} width={lW + 2} height={lH + 22} rx={6} fill="none" stroke="var(--accent)" strokeWidth={1.5} />}
        <text y={-4} style={{ fontSize: 11, letterSpacing: '0.04em' }} fill="var(--text-3)">U-MATRIX (cell-to-neighbor distance)</text>
        <g onMouseLeave={() => setHover(null)}>
          {model.uvals.map((u, i) => (
            <rect key={i} x={cx(i)} y={cy(i)} width={cellW - 1} height={cellH - 1} fill={d3.interpolateGreys(0.1 + (0.85 * u) / model.uMax)} stroke="white" strokeWidth={0.5} onMouseEnter={() => setHover(i)} />
          ))}
        </g>
        {hover != null && outline(hover, 'u-hover')}
      </g>
      <g transform={`translate(${paneW + 20},16)`} opacity={paneOpacity(activePart, 'bmu')}>
        {activePart === 'bmu' && <rect x={-1} y={-16} width={lW + 2} height={lH + 22} rx={6} fill="none" stroke="var(--accent)" strokeWidth={1.5} />}
        <text y={-4} style={{ fontSize: 11, letterSpacing: '0.04em' }} fill="var(--text-3)">DATA PLACED IN BMU CELLS</text>
        <g onMouseLeave={() => setHover(null)}>
          {model.cellClass.map((cls, i) => (
            <rect key={i} x={cx(i)} y={cy(i)} width={cellW - 1} height={cellH - 1} fill={cls === -1 ? 'var(--muted)' : colors(cls)} opacity={cls === -1 ? 0.3 : 0.6} stroke="white" strokeWidth={0.5} onMouseEnter={() => setHover(i)} />
          ))}
        </g>
        <g pointerEvents="none">
          {model.data.map((d, i) => {
            const bmu = model.bmuByPt[i]
            return <circle key={i} cx={cx(bmu) + cellW / 2 + model.jitter[i][0] * cellW * 0.6} cy={cy(bmu) + cellH / 2 + model.jitter[i][1] * cellH * 0.6} r={1.8} fill={colors(d.c)} opacity={0.9} stroke="white" strokeWidth={0.3} />
          })}
        </g>
        {hover != null && outline(hover, 'b-hover')}
      </g>
    </svg>
  )
}

function buildUMatrixModel(p: {
  dim: number; clusters: number; nPer: number; clusterSep: number; clusterNoise: number
  gridSize: number; maxIter: number; lr0: number; sigmaFactor: number
  seed: number; sampleSeed: number; jitterSeed: number
}) {
  const rng = mulberry32(p.seed)
  const dim = p.dim
  // Each cluster's center is clusterSep on its own block of 5 dims, 0 elsewhere.
  const centers: number[][] = []
  for (let c = 0; c < p.clusters; c++) {
    centers.push(new Array(dim).fill(0).map((_, d) => (d >= c * 5 && d < c * 5 + 5 ? p.clusterSep : 0)))
  }
  type HD = { v: number[]; c: number }
  const data: HD[] = []
  for (let c = 0; c < p.clusters; c++) {
    for (let i = 0; i < p.nPer; i++) {
      const pt = new Array(dim)
      for (let d = 0; d < dim; d++) pt[d] = centers[c][d] + gaussian(rng) * p.clusterNoise
      data.push({ v: pt, c })
    }
  }
  const G = p.gridSize
  const protos: number[][] = []
  for (let r = 0; r < G; r++) for (let c = 0; c < G; c++) {
    const v = new Array(dim)
    for (let d = 0; d < dim; d++) v[d] = gaussian(rng) * 0.5
    protos.push(v)
  }
  function distV(a: number[], b: number[]) { let s = 0; for (let i = 0; i < a.length; i++) s += (a[i] - b[i]) ** 2; return s }
  const sampleRng = mulberry32(p.sampleSeed)
  const sigma0 = G * p.sigmaFactor
  for (let it = 0; it < p.maxIter; it++) {
    const progress = it / p.maxIter
    const lr = p.lr0 * Math.exp(-progress * 3)
    const sigma = sigma0 * Math.exp(-progress * 3)
    const sample = data[Math.floor(sampleRng() * data.length)].v
    let bmu = 0, bd = Infinity
    for (let i = 0; i < protos.length; i++) { const d = distV(protos[i], sample); if (d < bd) { bd = d; bmu = i } }
    const bmuR = Math.floor(bmu / G), bmuC = bmu % G
    for (let i = 0; i < protos.length; i++) {
      const r = Math.floor(i / G), c = i % G
      const gd = Math.hypot(r - bmuR, c - bmuC)
      const h = Math.exp(-(gd * gd) / (2 * sigma * sigma + 1e-6))
      for (let d = 0; d < dim; d++) protos[i][d] += lr * h * (sample[d] - protos[i][d])
    }
  }
  // U-matrix: each cell's average distance to its grid neighbors.
  const uvals = new Array(protos.length).fill(0)
  for (let r = 0; r < G; r++) for (let c = 0; c < G; c++) {
    const i = r * G + c
    let s = 0, n = 0
    for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      const nr = r + dr, nc = c + dc
      if (nr < 0 || nr >= G || nc < 0 || nc >= G) continue
      s += Math.sqrt(distV(protos[i], protos[nr * G + nc]))
      n++
    }
    uvals[i] = n ? s / n : 0
  }
  const uMax = d3.max(uvals) || 1
  const bmuByPt = data.map((d) => {
    let bmu = 0, bd = Infinity
    for (let i = 0; i < protos.length; i++) { const dd = distV(protos[i], d.v); if (dd < bd) { bd = dd; bmu = i } }
    return bmu
  })
  // Majority cluster per cell (-1 = empty cell).
  const cellCounts: number[][] = new Array(protos.length).fill(0).map(() => new Array(p.clusters).fill(0))
  for (let k = 0; k < data.length; k++) cellCounts[bmuByPt[k]][data[k].c]++
  const cellClass = cellCounts.map((cc) => {
    const total = cc.reduce((a, b) => a + b, 0)
    return total === 0 ? -1 : cc.indexOf(Math.max(...cc))
  })
  const jitterRng = mulberry32(p.jitterSeed)
  const jitter = data.map(() => [jitterRng() - 0.5, jitterRng() - 0.5] as [number, number])
  return { G, uvals, uMax, bmuByPt, data, cellClass, jitter }
}
