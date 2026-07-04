import { useEffect, useMemo, useState } from 'react'
import * as d3 from 'd3'
import type { FigureProps } from './registry'
import { num, str } from '../../runtime/lib/params'
import { useFigureHighlight } from '../../runtime/store'

// Faithful React ports of docs/dim-reduction/05-topology.html.

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
function Slider({ label, value, min, max, step, onChange, format = String }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; format?: (v: number) => string }) {
  return <label>{label} <span className="value">{format(value)}</span><input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(+e.currentTarget.value)} /></label>
}

// ---------- Figure 1: Mapper ----------

type Filter = 'x' | 'y' | 'r'

type Pt = { x: number; y: number; id: number }
type MapperNode = {
  id: number
  interval: number
  cidx: number
  members: Set<number>
  avgFilt: number
  avgX: number
  avgY: number
  x: number
  y: number
  vx?: number
  vy?: number
  fx: number | null
  fy: number | null
}
type MapperEdge = { source: MapperNode | number; target: MapperNode | number; w: number }

// Mapper pipeline on a figure-8 (lemniscate) point cloud.
// Override per-instance from markdown: :::figure{id=mapper resolution=12 filter=y}
export const MAPPER_DEFAULTS = {
  seed: 31, // RNG seed for the figure-8 point cloud
  n: 220, // number of points sampled along the lemniscate
  noise: 0.03, // gaussian noise std dev added to each point
  resolution: 8, // initial interval count (reader slider, 3–20)
  overlap: 0.3, // initial interval overlap fraction (reader slider, 0.05–0.6)
  filter: 'x', // initial filter lens: 'x' (horizontal) | 'y' (vertical) | 'r' (density)
  eps: 0.15, // single-linkage cluster threshold within each interval (data units)
  layoutSeed: 17, // RNG seed for the density-filter force layout init
  simTicks: 400, // force-simulation iterations (graph layout must settle)
}

// resolution/overlap mirror the reader-facing sliders (3–20 / 0.05–0.6);
// n is capped because per-interval clustering and the density filter are
// O(n²); noise/eps live at lemniscate scale (~1) so the heuristic's
// 0.001 step and 0.5 ceiling are both wrong. noise=0.03 + eps=0.15 are
// tuned together so the x-filter sweep walks three regimes: res 3–4 too
// coarse (no loops), res 5–12 the faithful figure-8 (1 component, 2
// loops), res 16+ shattered (graph falls into many components). Smaller
// eps fragments every interval into singleton clusters and no regime
// ever shows the loops.
export const MAPPER_HINTS = {
  n: { min: 50, max: 800 },
  noise: { min: 0, max: 0.15, step: 0.005 },
  resolution: { min: 3, max: 20, step: 1 },
  overlap: { min: 0.05, max: 0.6, step: 0.01 },
  eps: { min: 0.05, max: 0.3, step: 0.01 },
}

export function MapperFigure(props: FigureProps) {
  const seed = num(props.seed, MAPPER_DEFAULTS.seed)
  const n = num(props.n, MAPPER_DEFAULTS.n)
  const noise = num(props.noise, MAPPER_DEFAULTS.noise)
  const eps = num(props.eps, MAPPER_DEFAULTS.eps)
  const layoutSeed = num(props.layoutSeed, MAPPER_DEFAULTS.layoutSeed)
  const simTicks = num(props.simTicks, MAPPER_DEFAULTS.simTicks)
  const res0 = num(props.resolution, MAPPER_DEFAULTS.resolution)
  const ov0 = num(props.overlap, MAPPER_DEFAULTS.overlap)
  const filterRaw = str(props.filter, MAPPER_DEFAULTS.filter)
  const filter0: Filter = filterRaw === 'y' || filterRaw === 'r' ? filterRaw : 'x'

  const [res, setRes] = useState(res0)
  const [ov, setOv] = useState(ov0)
  const [currentFilter, setCurrentFilter] = useState<Filter>(filter0)
  // Follow live knob-panel / markdown changes; reader interactions still win
  // until the params change again.
  useEffect(() => setRes(res0), [res0])
  useEffect(() => setOv(ov0), [ov0])
  useEffect(() => setCurrentFilter(filter0), [filter0])

  const { activePart } = useFigureHighlight(props.figureId as string)

  const data = useMemo(() => buildMapperPoints(seed, n, noise), [seed, n, noise])
  const filt = useMemo(() => computeFilter(data, currentFilter), [data, currentFilter])
  const built = useMemo(
    () => buildMapper(data, filt, res, ov, currentFilter, eps, layoutSeed, simTicks),
    [data, filt, res, ov, currentFilter, eps, layoutSeed, simTicks],
  )

  // Linked hover: a cover band or a graph node selects a set of data points,
  // grounding the data → cover → cluster → node correspondence.
  type Hover = { kind: 'node'; id: number } | { kind: 'band'; idx: number } | null
  const [hover, setHover] = useState<Hover>(null)
  useEffect(() => setHover(null), [built]) // graph rebuilt: stale ids
  const hoverNode = hover?.kind === 'node' ? built.nodes[hover.id] : null
  const hoverBand = hover?.kind === 'band' ? hover.idx : hoverNode ? hoverNode.interval : null
  const hoverPts = useMemo<Set<number> | null>(() => {
    if (hoverNode) return hoverNode.members
    if (hover?.kind === 'band') {
      const iv = built.intervals[hover.idx]
      const s = new Set<number>()
      for (let i = 0; i < data.length; i++) if (filt[i] >= iv[0] && filt[i] <= iv[1]) s.add(i)
      return s
    }
    return null
  }, [hover, hoverNode, built, data, filt])
  const nodeLit = (nd: MapperNode): boolean | null => {
    if (hover == null) return null
    if (hover.kind === 'node') return nd.id === hover.id
    return nd.interval === hover.idx
  }

  const W = 680, H = 420, paneW = W / 2
  const lW = paneW - 40, lH = 320
  const xExt = d3.extent(data, (d) => d.x) as [number, number]
  const yExt = d3.extent(data, (d) => d.y) as [number, number]
  const x = d3.scaleLinear([xExt[0] - 0.1, xExt[1] + 0.1], [0, lW])
  const y = d3.scaleLinear([yExt[0] - 0.1, yExt[1] + 0.1], [lH, 0])
  const fExt = d3.extent(filt) as [number, number]
  const fScale = d3.scaleSequential(d3.interpolateViridis).domain(fExt)

  // Part highlighting: 'data' = left pane (data + cover), 'graph' = right
  // pane (the Mapper graph). Raise the active pane, dim the other.
  const paneOpacity = (id: string) => (activePart != null && activePart !== id ? 0.35 : 1)
  const paneOutline = (id: string, ox: number, w: number) =>
    activePart === id ? <rect x={ox - 8} y={2} width={w} height={lH + 24} fill="none" stroke="var(--accent)" strokeWidth={1.5} rx={4} /> : null

  return (
    <div>
      <div className="controls">
        <Slider label="resolution (intervals)" value={res} min={3} max={20} step={1} onChange={setRes} />
        <Slider label="overlap" value={ov} min={0.05} max={0.6} step={0.01} onChange={setOv} format={(v) => v.toFixed(2)} />
        <label>filter:
          <div className="toggle-group">
            {(['x', 'y', 'r'] as Filter[]).map((f) => <button key={f} type="button" className={currentFilter === f ? 'active' : ''} onClick={() => setCurrentFilter(f)}>{f === 'x' ? 'horizontal' : f === 'y' ? 'vertical' : 'density'}</button>)}
          </div>
        </label>
      </div>
      <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet">
        {paneOutline('data', 20, paneW - 16)}
        {paneOutline('graph', paneW + 20, paneW - 16)}
        <g transform="translate(20,20)" opacity={paneOpacity('data')}>
          <text y={-6} style={{ fontSize: 11, letterSpacing: '0.04em' }} fill="var(--text-3)">DATA + COVER</text>
          {built.intervals.map((iv, idx) => {
            const color = idx % 2 === 0 ? 'var(--accent)' : 'var(--warm)'
            const lit = hoverBand === idx
            const bandProps = {
              fill: color,
              opacity: lit ? 0.22 : 0.06,
              style: { cursor: 'pointer' as const },
              onMouseEnter: () => setHover({ kind: 'band', idx }),
              onMouseLeave: () => setHover(null),
            }
            if (currentFilter === 'x') {
              const x1 = x(Math.max(iv[0], fExt[0] - 0.2))
              const x2 = x(Math.min(iv[1], fExt[1] + 0.2))
              return <rect key={idx} x={x1} y={0} width={Math.max(0, x2 - x1)} height={lH} {...bandProps} />
            }
            if (currentFilter === 'y') {
              const y1 = y(Math.min(iv[1], fExt[1] + 0.2))
              const y2 = y(Math.max(iv[0], fExt[0] - 0.2))
              return <rect key={idx} x={0} y={y1} width={lW} height={Math.max(0, y2 - y1)} {...bandProps} />
            }
            return null
          })}
          {data.map((p, i) => {
            const lit = hoverPts ? hoverPts.has(i) : null
            return (
              <circle key={p.id} cx={x(p.x)} cy={y(p.y)} r={lit ? 3.6 : 2.8} fill={fScale(filt[i])}
                opacity={lit === false ? 0.15 : 0.9}
                stroke={lit ? 'var(--text)' : 'white'} strokeWidth={lit ? 1.2 : 0.3}
                pointerEvents="none" />
            )
          })}
        </g>
        <g transform={`translate(${paneW + 20},20)`} opacity={paneOpacity('graph')}>
          <text y={-6} style={{ fontSize: 11, letterSpacing: '0.04em' }} fill="var(--text-3)">MAPPER GRAPH</text>
          {built.edges.map((e, i) => {
            const a = typeof e.source === 'number' ? built.nodes[e.source] : (e.source as MapperNode)
            const b = typeof e.target === 'number' ? built.nodes[e.target] : (e.target as MapperNode)
            const dim = hover != null && nodeLit(a) !== true && nodeLit(b) !== true
            return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="var(--text-3)" strokeWidth={Math.min(3, Math.sqrt(e.w))} opacity={dim ? 0.25 : 1} />
          })}
          {built.nodes.map((n) => {
            const mem = [...n.members]
            const avg = mem.reduce((s, i) => s + filt[i], 0) / mem.length
            const lit = nodeLit(n)
            return (
              <circle key={n.id} cx={n.x} cy={n.y} r={Math.max(5, Math.min(14, Math.sqrt(n.members.size) * 2.5))}
                fill={fScale(avg)} stroke={lit ? 'var(--text)' : 'white'} strokeWidth={lit ? 2.5 : 1.5}
                opacity={lit === false ? 0.3 : 1} style={{ cursor: 'pointer' }}
                onMouseEnter={() => setHover({ kind: 'node', id: n.id })}
                onMouseLeave={() => setHover(null)} />
            )
          })}
        </g>
      </svg>
    </div>
  )
}

function buildMapperPoints(seed: number, n: number, noise: number): Pt[] {
  const rng = mulberry32(seed)
  const pts: Pt[] = []
  for (let i = 0; i < n; i++) {
    const t = (i / n) * 2 * Math.PI
    // figure-8: lemniscate of Bernoulli
    const s = Math.sin(t), c = Math.cos(t)
    const den = 1 + s * s
    pts.push({ x: c / den + gaussian(rng) * noise, y: (s * c) / den + gaussian(rng) * noise, id: i })
  }
  return pts
}

function computeFilter(pts: Pt[], name: Filter): number[] {
  if (name === 'x') return pts.map((p) => p.x)
  if (name === 'y') return pts.map((p) => p.y)
  return pts.map((p) => {
    let s = 0
    for (const q of pts) { const dx = p.x - q.x, dy = p.y - q.y; s += Math.exp(-(dx * dx + dy * dy) / 0.02) }
    return s
  })
}

function clusterInInterval(pts: Pt[], indices: number[], eps: number): number[][] {
  const parent = indices.map((_, i) => i)
  function find(i: number): number { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i] } return i }
  for (let a = 0; a < indices.length; a++) {
    for (let b = a + 1; b < indices.length; b++) {
      const p = pts[indices[a]], q = pts[indices[b]]
      const d = Math.hypot(p.x - q.x, p.y - q.y)
      if (d < eps) {
        const pa = find(a), pb = find(b)
        if (pa !== pb) parent[pa] = pb
      }
    }
  }
  const groups = new Map<number, number[]>()
  for (let i = 0; i < indices.length; i++) {
    const r = find(i)
    if (!groups.has(r)) groups.set(r, [])
    groups.get(r)!.push(indices[i])
  }
  return [...groups.values()]
}

function buildMapper(pts: Pt[], filt: number[], res: number, ov: number, currentFilter: Filter, eps: number, layoutSeed: number, simTicks: number) {
  const N = pts.length
  const fExt = d3.extent(filt) as [number, number]
  const xExt = d3.extent(pts, (d) => d.x) as [number, number]
  const yExt = d3.extent(pts, (d) => d.y) as [number, number]
  const step = (fExt[1] - fExt[0]) / res
  const width = step * (1 + ov)
  const intervals: [number, number][] = []
  for (let i = 0; i < res; i++) {
    const a = fExt[0] + i * step - (step * ov) / 2
    const b = a + width
    intervals.push([a, b])
  }
  const nodes: MapperNode[] = []
  const intervalClusters = intervals.map((iv, idx) => {
    const mem: number[] = []
    for (let i = 0; i < N; i++) if (filt[i] >= iv[0] && filt[i] <= iv[1]) mem.push(i)
    return clusterInInterval(pts, mem, eps).map((cluster, cidx) => {
      const node: MapperNode = {
        interval: idx,
        cidx,
        members: new Set(cluster),
        id: nodes.length,
        avgFilt: cluster.reduce((s, i) => s + filt[i], 0) / cluster.length,
        avgX: cluster.reduce((s, i) => s + pts[i].x, 0) / cluster.length,
        avgY: cluster.reduce((s, i) => s + pts[i].y, 0) / cluster.length,
        x: 0, y: 0, fx: null, fy: null,
      }
      nodes.push(node)
      return node
    })
  })
  const edges: MapperEdge[] = []
  for (let i = 0; i < intervals.length - 1; i++) {
    for (const a of intervalClusters[i]) {
      for (const b of intervalClusters[i + 1]) {
        let shared = 0
        for (const m of a.members) if (b.members.has(m)) shared++
        if (shared > 0) edges.push({ source: a, target: b, w: shared })
      }
    }
  }

  const rW = 680 / 2 - 40, rH = 320
  const filtToX = (v: number) => 20 + ((v - fExt[0]) / (fExt[1] - fExt[0])) * (rW - 40)
  const filtToY = (v: number) => 20 + (1 - (v - fExt[0]) / (fExt[1] - fExt[0])) * (rH - 40)
  const dataYToY = (v: number) => 20 + (1 - (v - yExt[0]) / (yExt[1] - yExt[0])) * (rH - 40)
  const dataXToX = (v: number) => 20 + ((v - xExt[0]) / (xExt[1] - xExt[0])) * (rW - 40)
  const layoutRng = mulberry32(layoutSeed)

  if (currentFilter === 'x') {
    nodes.forEach((n) => {
      const iv = intervals[n.interval]
      n.fx = filtToX((iv[0] + iv[1]) / 2)
      n.x = n.fx as number
      n.y = dataYToY(n.avgY)
    })
  } else if (currentFilter === 'y') {
    nodes.forEach((n) => {
      const iv = intervals[n.interval]
      n.fy = filtToY((iv[0] + iv[1]) / 2)
      n.y = n.fy as number
      n.x = dataXToX(n.avgX)
    })
  } else {
    nodes.forEach((n) => {
      n.x = rW / 2 + (layoutRng() - 0.5) * rW * 0.6
      n.y = rH / 2 + (layoutRng() - 0.5) * rH * 0.6
    })
  }

  const sim = d3.forceSimulation(nodes as d3.SimulationNodeDatum[])
    .force('link', d3.forceLink(edges).id((d: any) => d.id).distance(28).strength(0.3))
    .force('collide', d3.forceCollide(14))

  if (currentFilter === 'x') sim.force('y', d3.forceY((n: any) => dataYToY(n.avgY)).strength(0.25))
  else if (currentFilter === 'y') sim.force('x', d3.forceX((n: any) => dataXToX(n.avgX)).strength(0.25))
  else sim.force('charge', d3.forceManyBody().strength(-60).distanceMax(90)).force('center', d3.forceCenter(rW / 2, rH / 2).strength(0.15))
  sim.alpha(1).alphaDecay(0.02).stop()
  for (let i = 0; i < simTicks; i++) sim.tick()
  for (const n of nodes) {
    n.x = Math.max(20, Math.min(rW - 20, n.x))
    n.y = Math.max(20, Math.min(rH - 20, n.y))
  }
  return { nodes, edges, intervals }
}

// ---------- Figure 2: Persistent homology ----------

// Growing-ball filtration on a noisy circle, with an (illustrative)
// persistence barcode. Override per-instance: :::figure{id=persistence radius=0.05}
export const PERSISTENCE_DEFAULTS = {
  seed: 71, // RNG seed for the noisy circle sample
  n: 60, // number of points on the circle
  ringRadius: 0.3, // circle radius inside the unit square
  noise: 0.04, // gaussian noise std dev on each point
  radius: 0.15, // initial ball radius (reader slider, 0–maxRadius)
  maxRadius: 0.3, // slider max + barcode axis extent (loop dies ~0.21, so 0.3 leaves little dead travel)
}

// Everything here lives inside the unit square, so the heuristic's [0, 5]
// ranges overshoot ~10×: ringRadius must keep the circle in-frame, radius
// mirrors the reader slider (0–maxRadius step 0.005), maxRadius needs a
// nonzero floor (it's a scale domain), and n is capped so the barcode rows fit.
export const PERSISTENCE_HINTS = {
  n: { min: 10, max: 150 },
  ringRadius: { min: 0.1, max: 0.45, step: 0.01 },
  noise: { min: 0, max: 0.15, step: 0.005 },
  radius: { min: 0, max: 0.4, step: 0.005 },
  maxRadius: { min: 0.1, max: 1, step: 0.05 },
}

export function PersistenceFigure(props: FigureProps) {
  const seed = num(props.seed, PERSISTENCE_DEFAULTS.seed)
  const n = num(props.n, PERSISTENCE_DEFAULTS.n)
  const ringRadius = num(props.ringRadius, PERSISTENCE_DEFAULTS.ringRadius)
  const noise = num(props.noise, PERSISTENCE_DEFAULTS.noise)
  const maxRadius = num(props.maxRadius, PERSISTENCE_DEFAULTS.maxRadius)
  const r0 = num(props.radius, PERSISTENCE_DEFAULTS.radius)
  const [r, setR] = useState(r0)
  useEffect(() => setR(r0), [r0]) // follow live knob/markdown changes

  const { activePart } = useFigureHighlight(props.figureId as string)

  const model = useMemo(() => buildPersistenceModel(seed, n, ringRadius, noise), [seed, n, ringRadius, noise])
  const { pts, pairs, h0, h1 } = model
  const W = 680, H = 340, paneW = W / 2
  const lW = paneW - 40, lH = 290
  const x = d3.scaleLinear([0, 1], [0, lW])
  const y = d3.scaleLinear([0, 1], [lH, 0])
  const bW = paneW - 30, bH = 290
  const xr = d3.scaleLinear([0, maxRadius], [40, bW - 10])
  const activeEdges = pairs.filter((p) => p.d < 2 * r)
  const ballRadiusPx = r * (x.range()[1] - x.range()[0])
  const sortedH0 = h0.slice().sort((a, b) => (b.death === Infinity ? maxRadius : b.death) - (a.death === Infinity ? maxRadius : a.death))
  // Live state at the current radius, so the barcode and the balls read as
  // one story: H0 bars go out as components merge, the H1 bar lights up
  // while the loop is alive.
  const aliveComponents = h0.reduce((s, b) => s + (b.death > r ? 1 : 0), 0)
  const loop = h1[0]
  const loopState = loop == null ? null : r < loop.birth ? 'not yet born' : r <= loop.death ? 'alive' : 'filled in'

  // Part highlighting: 'balls' = left pane (data + growing balls),
  // 'barcode' = right pane (persistence barcode).
  const paneOpacity = (id: string) => (activePart != null && activePart !== id ? 0.35 : 1)
  const paneOutline = (id: string, ox: number, w: number) =>
    activePart === id ? <rect x={ox - 8} y={2} width={w} height={lH + 18} fill="none" stroke="var(--accent)" strokeWidth={1.5} rx={4} /> : null

  return (
    <div>
      <div className="controls"><Slider label="ball radius" value={r} min={0} max={maxRadius} step={0.005} onChange={setR} format={(v) => v.toFixed(3)} /></div>
      <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet">
        {paneOutline('balls', 20, paneW - 16)}
        {paneOutline('barcode', paneW + 10, paneW - 6)}
        <g transform="translate(20,20)" opacity={paneOpacity('balls')}>
          <text y={-6} style={{ fontSize: 11, letterSpacing: '0.04em' }} fill="var(--text-3)">DATA + BALLS</text>
          {pts.map((p, i) => <circle key={`b${i}`} cx={x(p.x)} cy={y(p.y)} r={ballRadiusPx} fill="var(--accent)" opacity={0.12} stroke="none" />)}
          {activeEdges.map((e, i) => <line key={`e${i}`} x1={x(pts[e.a].x)} y1={y(pts[e.a].y)} x2={x(pts[e.b].x)} y2={y(pts[e.b].y)} stroke="var(--accent)" strokeOpacity={0.35} strokeWidth={0.7} />)}
          {pts.map((p, i) => <circle key={i} cx={x(p.x)} cy={y(p.y)} r={2.5} fill="var(--text)" opacity={0.9} />)}
          <text y={lH + 16} style={{ fontSize: 11 }}>
            <tspan fill="var(--accent)">{aliveComponents} component{aliveComponents === 1 ? '' : 's'} (H₀)</tspan>
            {loopState != null && <tspan fill="var(--text-3)"> · </tspan>}
            {loopState != null && <tspan fill="var(--warm)">loop (H₁) {loopState}</tspan>}
          </text>
        </g>
        <g transform={`translate(${paneW + 10},20)`} opacity={paneOpacity('barcode')}>
          <text y={-6} style={{ fontSize: 11, letterSpacing: '0.04em' }} fill="var(--text-3)">PERSISTENCE BARCODE</text>
          <g className="axis" transform={`translate(0,${bH - 20})`}>
            <line x1={xr(0)} x2={xr(maxRadius)} y1={0} y2={0} stroke="var(--border-2)" />
            {xr.ticks(5).map((t) => (
              <g key={t} transform={`translate(${xr(t)},0)`}>
                <line y1={0} y2={4} stroke="var(--border-2)" />
                <text y={16} textAnchor="middle" fontSize={11} fill="var(--text-2)">{t.toFixed(2)}</text>
              </g>
            ))}
          </g>
          <text x={bW / 2} y={bH + 8} textAnchor="middle" style={{ fontSize: 11 }} fill="var(--text-2)">radius r</text>
          <text x={10} y={24} style={{ fontSize: 10 }} fill="var(--accent)">H₀</text>
          {sortedH0.map((bar, idx) => {
            const yy = 18 + idx * 3
            const start = xr(bar.birth)
            const end = xr(bar.death === Infinity ? maxRadius : Math.min(bar.death, maxRadius))
            const alive = bar.death > r
            return <line key={idx} x1={start} x2={end} y1={yy} y2={yy} stroke="var(--accent)" strokeWidth={1.4} opacity={alive ? 0.85 : 0.25} />
          })}
          {h1.map((bar, idx) => {
            const yy = 18 + pts.length * 3 + 16 + idx * 6
            const alive = r >= bar.birth && r <= bar.death
            return <line key={idx} x1={xr(bar.birth)} x2={xr(Math.min(bar.death, maxRadius))} y1={yy} y2={yy} stroke="var(--warm)" strokeWidth={alive ? 4.5 : 3} opacity={alive ? 1 : 0.4} />
          })}
          <text x={10} y={18 + pts.length * 3 + 28} style={{ fontSize: 10 }} fill="var(--warm)">H₁</text>
          <path d={`M ${xr(r) - 4} 4 L ${xr(r) + 4} 4 L ${xr(r)} 10 Z`} fill="var(--text)" />
          <line x1={xr(r)} x2={xr(r)} y1={10} y2={bH - 20} stroke="var(--text)" strokeWidth={1} strokeDasharray="3 2" />
        </g>
      </svg>
    </div>
  )
}

function buildPersistenceModel(seed: number, n: number, ringRadius: number, noise: number) {
  const rng = mulberry32(seed)
  const pts: { x: number; y: number }[] = []
  for (let i = 0; i < n; i++) {
    const t = (i / n) * 2 * Math.PI
    pts.push({ x: 0.5 + ringRadius * Math.cos(t) + gaussian(rng) * noise, y: 0.5 + ringRadius * Math.sin(t) + gaussian(rng) * noise })
  }
  const pairs: { a: number; b: number; d: number }[] = []
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) pairs.push({ a: i, b: j, d: Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y) })
  pairs.sort((a, b) => a.d - b.d)
  const parent = new Array(n).fill(0).map((_, i) => i)
  function find(i: number): number { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i] } return i }
  // H0: each point born at r=0, dies when its component merges into another.
  // Kill the higher-indexed root and keep the lower as the surviving root
  // (if the killed root stayed as union-find root, later merges would skip
  // recording deaths and bars would spuriously run to infinity).
  const h0 = pts.map(() => ({ birth: 0, death: Infinity as number }))
  for (const p of pairs) {
    const r = p.d / 2
    const pa = find(p.a), pb = find(p.b)
    if (pa !== pb) {
      const kill = Math.max(pa, pb), keep = Math.min(pa, pb)
      h0[kill].death = r
      parent[kill] = keep
    }
  }
  // Approx H1: loop born when the circle closes (~ max gap between angular
  // neighbors / 2, i.e. when the last pair of adjacent balls touches), dies
  // when the balls cover the last uncovered spot inside the ring. The death
  // radius is found by a grid search for the in-hole point farthest from
  // every sample, so the bar's right end coincides with the hole visually
  // filling in on the left. Illustrative, not a full persistence computation.
  const gaps: number[] = []
  for (let i = 0; i < n; i++) {
    const i2 = (i + 1) % n
    gaps.push(Math.hypot(pts[i].x - pts[i2].x, pts[i].y - pts[i2].y))
  }
  const maxGap = d3.max(gaps) ?? 0
  let death = 0
  const G = 40, R = ringRadius * 0.8
  for (let gi = 0; gi <= G; gi++) {
    for (let gj = 0; gj <= G; gj++) {
      const px = 0.5 + ((gi / G) - 0.5) * 2 * R
      const py = 0.5 + ((gj / G) - 0.5) * 2 * R
      if (Math.hypot(px - 0.5, py - 0.5) > R) continue
      let mind = Infinity
      for (const p of pts) {
        const d = Math.hypot(p.x - px, p.y - py)
        if (d < mind) mind = d
      }
      if (mind > death) death = mind
    }
  }
  const h1 = [{ birth: maxGap / 2, death }]
  return { pts, pairs, h0, h1 }
}
