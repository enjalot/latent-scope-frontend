import { useEffect, useMemo, useRef, useState } from 'react'
import * as d3 from 'd3'
import type { FigureProps } from './registry'
import { num } from '../../runtime/lib/params'
import { useFigureHighlight } from '../../runtime/store'

// Faithful React ports of docs/dim-reduction/04-local-neighborhoods.html.
// Figures 1 and 2 run their force simulations LIVE (like the original):
// the layout visibly organizes itself from a random scatter, and the
// sliders perturb the running simulation rather than regenerating a
// settled picture. Under prefers-reduced-motion we skip straight to the
// settled state.

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

// Settle a (stopped) simulation synchronously: reheat and tick to rest.
function settleSim(sim: d3.Simulation<d3.SimulationNodeDatum, undefined>, alpha: number, ticks: number) {
  sim.stop().alpha(alpha)
  for (let i = 0; i < ticks; i++) sim.tick()
}

// True once the element has scrolled into view (then stays true), so the
// live simulation starts when the reader can actually watch it organize,
// not on page load while the figure is below the fold.
function useInViewOnce<T extends Element>(ref: React.RefObject<T | null>) {
  const [inView, setInView] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') { setInView(true); return }
    const obs = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) { setInView(true); obs.disconnect() }
    }, { threshold: 0.25 })
    obs.observe(el)
    return () => obs.disconnect()
  }, [ref])
  return inView
}

type HDPoint = { v: number[]; c: number; id: number }
type SimPoint = HDPoint & { x: number; y: number; vx?: number; vy?: number; index?: number; super?: number; sub?: number }
type Link = { source: number | SimPoint; target: number | SimPoint }

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
function colors(i: number) { return ['var(--accent)', 'var(--warm)', 'var(--green)', 'var(--purple)', 'var(--text-2)'][i % 5] }

function Slider({ label, value, min, max, step, onChange, format = String }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; format?: (v: number) => string }) {
  return <label>{label} <span className="value">{format(value)}</span><input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(+e.currentTarget.value)} /></label>
}

function makeClusters(seed: number, nPer: number, kClusters: number, dim: number, sep: number): HDPoint[] {
  const rng = mulberry32(seed)
  const centers: number[][] = []
  for (let c = 0; c < kClusters; c++) {
    const ctr = new Array(dim)
    for (let d = 0; d < dim; d++) ctr[d] = gaussian(rng) * sep
    centers.push(ctr)
  }
  const pts: HDPoint[] = []
  for (let c = 0; c < kClusters; c++) {
    for (let i = 0; i < nPer; i++) {
      const p = new Array(dim)
      for (let d = 0; d < dim; d++) p[d] = centers[c][d] + gaussian(rng) * 1
      pts.push({ v: p, c, id: pts.length })
    }
  }
  return pts
}

function kNN(pts: { v: number[] }[], k: number) {
  const adj: number[][] = []
  for (let i = 0; i < pts.length; i++) {
    const arr: { j: number; d: number }[] = []
    for (let j = 0; j < pts.length; j++) {
      if (i === j) continue
      let d = 0
      for (let a = 0; a < pts[i].v.length; a++) d += (pts[i].v[a] - pts[j].v[a]) ** 2
      arr.push({ j, d })
    }
    arr.sort((a, b) => a.d - b.d)
    adj.push(arr.slice(0, k).map((e) => e.j))
  }
  return adj
}

function buildLinks(pts: { v: number[] }[], k: number): Link[] {
  const adj = kNN(pts, k)
  const links: Link[] = []
  for (let i = 0; i < pts.length; i++) for (const j of adj[i]) if (i < j) links.push({ source: i, target: j })
  return links
}

// ---------- Figure 1: Force-based layout ----------

export const FORCES_DEFAULTS = {
  seed: 42, // RNG seed for high-D cluster generation
  nPer: 18, // points per cluster
  clusters: 5, // number of high-D clusters
  dim: 30, // ambient dimensionality of the generated data
  sep: 5, // cluster-center spread (σ multiplier; bigger = better-separated clusters)
  k: 6, // initial "neighbors" slider value (kNN graph degree)
  repulsion: -30, // initial "repulsion" slider value (forceManyBody strength, negative = repel)
  ticks: 460, // settle ticks used only under prefers-reduced-motion (live sim otherwise)
  linkDistance: 30, // target edge length for kNN links (px)
  layoutSeed: 7, // RNG seed for initial node positions (restart replays from the same scatter)
}

// Knob bounds where the magnitude heuristic misfires: point counts hit the
// O(N²) kNN wall (nPer→500 would mean 2500 points), repulsion must stay
// negative and k/repulsion should match the reader-facing sliders, and
// dim/linkDistance need sane floors/ceilings.
export const FORCES_HINTS = {
  nPer: { min: 2, max: 50 },
  clusters: { min: 2, max: 10 },
  dim: { min: 2, max: 100 },
  k: { min: 2, max: 20, step: 1 },
  repulsion: { min: -100, max: -5, step: 1 },
  linkDistance: { min: 5, max: 100 },
}

export function ForcesFigure(props: FigureProps) {
  const seed = num(props.seed, FORCES_DEFAULTS.seed)
  const nPer = num(props.nPer, FORCES_DEFAULTS.nPer)
  const clusters = num(props.clusters, FORCES_DEFAULTS.clusters)
  const dim = num(props.dim, FORCES_DEFAULTS.dim)
  const sep = num(props.sep, FORCES_DEFAULTS.sep)
  const ticks = num(props.ticks, FORCES_DEFAULTS.ticks)
  const linkDistance = num(props.linkDistance, FORCES_DEFAULTS.linkDistance)
  const layoutSeed = num(props.layoutSeed, FORCES_DEFAULTS.layoutSeed)
  const k0 = num(props.k, FORCES_DEFAULTS.k)
  const rep0 = num(props.repulsion, FORCES_DEFAULTS.repulsion)
  const [k, setK] = useState(k0)
  useEffect(() => setK(k0), [k0])
  const [rep, setRep] = useState(rep0)
  useEffect(() => setRep(rep0), [rep0])
  const [reset, setReset] = useState(0)
  const reducedMotion = usePrefersReducedMotion()
  const base = useMemo(() => makeClusters(seed, nPer, clusters, dim, sep), [seed, nPer, clusters, dim, sep])

  const W = 680, H = 360
  const wrapRef = useRef<HTMLDivElement>(null)
  const inView = useInViewOnce(wrapRef)
  const simRef = useRef<d3.Simulation<d3.SimulationNodeDatum, undefined> | null>(null)
  const nodesRef = useRef<SimPoint[]>([])
  const linksRef = useRef<Link[]>([])
  const appliedRef = useRef<{ k: number; rep: number } | null>(null)
  const [, bump] = useState(0)
  const rerender = () => bump((b) => b + 1)

  // Create the simulation (and replay it from the same seeded random scatter
  // on restart). It runs live, organizing on screen; under reduced motion we
  // tick synchronously to the settled state instead.
  useEffect(() => {
    // Wide random scatter + extra friction so the reader can WATCH points
    // travel to find their neighbors (the pull/push process is the lesson).
    const rng = mulberry32(layoutSeed)
    const nodes: SimPoint[] = base.map((p) => ({ ...p, x: W / 2 + (rng() - 0.5) * (W - 80), y: H / 2 + (rng() - 0.5) * (H - 80), vx: 0, vy: 0 }))
    const links = buildLinks(base, k)
    nodesRef.current = nodes
    linksRef.current = links
    appliedRef.current = { k, rep }
    const sim = d3.forceSimulation(nodes as d3.SimulationNodeDatum[])
      .force('link', d3.forceLink(links as d3.SimulationLinkDatum<d3.SimulationNodeDatum>[]).id((d: any) => d.id).distance(linkDistance).strength(0.6))
      .force('charge', d3.forceManyBody().strength(rep).distanceMax(140))
      .force('center', d3.forceCenter(W / 2, H / 2).strength(0.08))
      .force('collide', d3.forceCollide(4))
      .velocityDecay(0.55)
      .alpha(1)
      .alphaDecay(0.015)
    simRef.current = sim
    if (reducedMotion) {
      settleSim(sim, 1, ticks)
    } else {
      if (!inView) sim.stop() // hold the scatter until scrolled into view
      sim.on('tick', rerender)
    }
    rerender()
    return () => { sim.stop(); simRef.current = null }
    // k/rep intentionally omitted: slider changes perturb the live sim below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base, reset, layoutSeed, linkDistance, ticks, reducedMotion, inView])

  // Slider changes perturb the RUNNING simulation: swap in the new kNN graph
  // and/or charge strength, then reheat so the layout visibly reorganizes
  // from where it currently sits.
  useEffect(() => {
    const sim = simRef.current
    const applied = appliedRef.current
    if (!sim || !applied || (applied.k === k && applied.rep === rep)) return
    const kChanged = applied.k !== k
    appliedRef.current = { k, rep }
    if (kChanged) {
      linksRef.current = buildLinks(base, k)
      ;(sim.force('link') as d3.ForceLink<d3.SimulationNodeDatum, any>).links(linksRef.current as any)
    }
    ;(sim.force('charge') as d3.ForceManyBody<d3.SimulationNodeDatum>).strength(rep)
    if (reducedMotion) {
      settleSim(sim, kChanged ? 0.5 : 0.3, ticks)
      rerender()
    } else {
      sim.alpha(kChanged ? 0.5 : 0.3).restart()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [k, rep])

  const nodes = nodesRef.current
  const links = linksRef.current
  return (
    <div ref={wrapRef}>
      <div className="controls">
        <Slider label="neighbors" value={k} min={2} max={20} step={1} onChange={setK} />
        <Slider label="repulsion" value={rep} min={-100} max={-5} step={1} onChange={setRep} />
        <button className="figure-button" type="button" onClick={() => setReset((r) => r + 1)}>restart</button>
      </div>
      <svg width="100%" height={360} viewBox="0 0 680 360" preserveAspectRatio="xMidYMid meet">
        {links.map((l, i) => <line key={i} x1={(l.source as SimPoint).x} y1={(l.source as SimPoint).y} x2={(l.target as SimPoint).x} y2={(l.target as SimPoint).y} stroke="var(--border-2)" strokeOpacity={0.4} strokeWidth={0.6} />)}
        {nodes.map((p) => <circle key={p.id} cx={p.x} cy={p.y} r={4} fill={colors(p.c)} opacity={0.85} stroke="white" strokeWidth={0.6} />)}
      </svg>
    </div>
  )
}

// ---------- Figure 2: perplexity / n_neighbors ----------

type MultiPoint = SimPoint & { super: number; sub: number }

export const PERPLEXITY_DEFAULTS = {
  seed: 9, // RNG seed for multi-scale data generation
  superClusters: 3, // number of super-clusters
  subPerSuper: 3, // sub-clusters inside each super-cluster
  nPerSub: 12, // points per sub-cluster
  dim: 20, // ambient dimensionality
  superSpread: 6, // super-cluster center spread (σ)
  subSpread: 1.5, // sub-cluster offset from its super center (σ)
  noise: 0.3, // per-point noise around the sub center (σ)
  k: 15, // initial n_neighbors slider value (low = sub-clusters split, high = super-clusters merge)
  ticks: 400, // settle ticks used only under prefers-reduced-motion (live sim otherwise)
}

// Cluster counts/sizes capped so total N stays kNN-friendly (heuristic would
// allow 500 points per sub-cluster), k matches the reader slider (3–60),
// dim gets a ≥2 floor, and spreads/noise stay in the regime where the
// sub/super hierarchy is still meaningful.
export const PERPLEXITY_HINTS = {
  superClusters: { min: 1, max: 6 },
  subPerSuper: { min: 1, max: 6 },
  nPerSub: { min: 3, max: 40 },
  dim: { min: 2, max: 100 },
  subSpread: { min: 0, max: 6 },
  noise: { min: 0, max: 2, step: 0.05 },
  k: { min: 3, max: 60, step: 1 },
}

export function PerplexityFigure(props: FigureProps) {
  const seed = num(props.seed, PERPLEXITY_DEFAULTS.seed)
  const superClusters = num(props.superClusters, PERPLEXITY_DEFAULTS.superClusters)
  const subPerSuper = num(props.subPerSuper, PERPLEXITY_DEFAULTS.subPerSuper)
  const nPerSub = num(props.nPerSub, PERPLEXITY_DEFAULTS.nPerSub)
  const dim = num(props.dim, PERPLEXITY_DEFAULTS.dim)
  const superSpread = num(props.superSpread, PERPLEXITY_DEFAULTS.superSpread)
  const subSpread = num(props.subSpread, PERPLEXITY_DEFAULTS.subSpread)
  const noise = num(props.noise, PERPLEXITY_DEFAULTS.noise)
  const ticks = num(props.ticks, PERPLEXITY_DEFAULTS.ticks)
  const k0 = num(props.k, PERPLEXITY_DEFAULTS.k)
  const [k, setK] = useState(k0)
  useEffect(() => setK(k0), [k0])
  const [reset, setReset] = useState(0)
  const reducedMotion = usePrefersReducedMotion()
  const base = useMemo(
    () => makeMultiScaleData(seed, superClusters, subPerSuper, nPerSub, dim, superSpread, subSpread, noise),
    [seed, superClusters, subPerSuper, nPerSub, dim, superSpread, subSpread, noise],
  )

  const W = 680, H = 320
  const wrapRef = useRef<HTMLDivElement>(null)
  const inView = useInViewOnce(wrapRef)
  const simRef = useRef<d3.Simulation<d3.SimulationNodeDatum, undefined> | null>(null)
  const nodesRef = useRef<MultiPoint[]>([])
  const linksRef = useRef<Link[]>([])
  const appliedKRef = useRef<number | null>(null)
  const [, bump] = useState(0)
  const rerender = () => bump((b) => b + 1)

  // Live simulation: same contract as the forces figure above. Restart
  // replays from the same seeded scatter; the slider perturbs the running
  // layout in place.
  useEffect(() => {
    const rng = mulberry32(11)
    const nodes = base.map((p) => ({ ...p, x: W / 2 + (rng() - 0.5) * (W - 80), y: H / 2 + (rng() - 0.5) * (H - 80), vx: 0, vy: 0 }))
    const links = buildLinks(base, k)
    nodesRef.current = nodes
    linksRef.current = links
    appliedKRef.current = k
    const sim = d3.forceSimulation(nodes as d3.SimulationNodeDatum[])
      .force('link', d3.forceLink(links as d3.SimulationLinkDatum<d3.SimulationNodeDatum>[]).id((d: any) => d.id).distance(25).strength(0.8))
      .force('charge', d3.forceManyBody().strength(-28).distanceMax(120))
      .force('center', d3.forceCenter(W / 2, H / 2).strength(0.08))
      .force('collide', d3.forceCollide(3.5))
      .velocityDecay(0.55)
      .alpha(1)
      .alphaDecay(0.02)
    simRef.current = sim
    if (reducedMotion) {
      settleSim(sim, 1, ticks)
    } else {
      if (!inView) sim.stop() // hold the scatter until scrolled into view
      sim.on('tick', rerender)
    }
    rerender()
    return () => { sim.stop(); simRef.current = null }
    // k intentionally omitted: slider changes perturb the live sim below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base, reset, ticks, reducedMotion, inView])

  useEffect(() => {
    const sim = simRef.current
    if (!sim || appliedKRef.current === k) return
    appliedKRef.current = k
    linksRef.current = buildLinks(base, k)
    ;(sim.force('link') as d3.ForceLink<d3.SimulationNodeDatum, any>).links(linksRef.current as any)
    if (reducedMotion) {
      settleSim(sim, 0.5, ticks)
      rerender()
    } else {
      sim.alpha(0.5).restart()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [k])

  const nodes = nodesRef.current
  const links = linksRef.current
  return (
    <div ref={wrapRef}>
      <div className="controls">
        <Slider label="n_neighbors" value={k} min={3} max={60} step={1} onChange={setK} />
        <button className="figure-button" type="button" onClick={() => setReset((r) => r + 1)}>restart</button>
      </div>
      <svg width="100%" height={320} viewBox="0 0 680 320" preserveAspectRatio="xMidYMid meet">
        {links.map((l, i) => <line key={i} x1={(l.source as MultiPoint).x} y1={(l.source as MultiPoint).y} x2={(l.target as MultiPoint).x} y2={(l.target as MultiPoint).y} stroke="var(--border-2)" strokeOpacity={0.3} strokeWidth={0.5} />)}
        {nodes.map((p) => <circle key={p.id} cx={p.x} cy={p.y} r={3.5} fill={colors(p.super)} stroke="white" strokeWidth={0.5} opacity={0.9} />)}
      </svg>
    </div>
  )
}

function makeMultiScaleData(seed: number, superClusters: number, subPerSuper: number, nPerSub: number, dim: number, superSpread: number, subSpread: number, noise: number): MultiPoint[] {
  const rng = mulberry32(seed)
  const pts: MultiPoint[] = []
  for (let sc = 0; sc < superClusters; sc++) {
    const superCtr = new Array(dim)
    for (let d = 0; d < dim; d++) superCtr[d] = gaussian(rng) * superSpread
    for (let sub = 0; sub < subPerSuper; sub++) {
      const subCtr = new Array(dim)
      for (let d = 0; d < dim; d++) subCtr[d] = superCtr[d] + gaussian(rng) * subSpread
      for (let i = 0; i < nPerSub; i++) {
        const p = new Array(dim)
        for (let d = 0; d < dim; d++) p[d] = subCtr[d] + gaussian(rng) * noise
        pts.push({ v: p, c: sc, super: sc, sub: sc * subPerSuper + sub, id: pts.length, x: 0, y: 0 })
      }
    }
  }
  return pts
}

// ---------- Figure 3: method comparison ----------

type ComparePoint = { x: number; y: number; z: number; theta: number; c: number; id: number }

export const COMPARE_DEFAULTS = {
  seed: 55, // RNG seed for the 3D swiss-roll dataset
  clusters: 5, // clusters spaced along the roll's angle parameter
  perCluster: 40, // points per cluster
  tsneK: 10, // kNN degree for the t-SNE-like pane (small k = tighter clusters)
  tsneRepulsion: -60, // charge strength for the t-SNE-like pane (heavy repulsion)
  umapK: 15, // kNN degree for the UMAP-like pane (moderate k)
  umapRepulsion: -30, // charge strength for the UMAP-like pane (moderate repulsion)
  iters: 400, // force iterations for the t-SNE-like / UMAP-like panes
}

// Repulsion strengths must stay negative (the heuristic offers [-500, 500];
// positive charge collapses the layout), k stays ≥2 and below the dataset
// size, and cluster counts/sizes are capped to keep the O(N²) kNN panes fast.
export const COMPARE_HINTS = {
  clusters: { min: 2, max: 10 },
  perCluster: { min: 10, max: 100 },
  tsneK: { min: 2, max: 40 },
  tsneRepulsion: { min: -150, max: -5, step: 1 },
  umapK: { min: 2, max: 40 },
  umapRepulsion: { min: -150, max: -5, step: 1 },
}

export function CompareFigure(props: FigureProps) {
  const seed = num(props.seed, COMPARE_DEFAULTS.seed)
  const clusters = num(props.clusters, COMPARE_DEFAULTS.clusters)
  const perCluster = num(props.perCluster, COMPARE_DEFAULTS.perCluster)
  const tsneK = num(props.tsneK, COMPARE_DEFAULTS.tsneK)
  const tsneRepulsion = num(props.tsneRepulsion, COMPARE_DEFAULTS.tsneRepulsion)
  const umapK = num(props.umapK, COMPARE_DEFAULTS.umapK)
  const umapRepulsion = num(props.umapRepulsion, COMPARE_DEFAULTS.umapRepulsion)
  const iters = num(props.iters, COMPARE_DEFAULTS.iters)
  const { activePart } = useFigureHighlight(props.figureId as string)
  const model = useMemo(
    () => buildCompareModel(seed, clusters, perCluster, tsneK, tsneRepulsion, umapK, umapRepulsion, iters),
    [seed, clusters, perCluster, tsneK, tsneRepulsion, umapK, umapRepulsion, iters],
  )
  const W = 680, H = 340, paneW = W / 4, paneH = H - 20
  const padX = 18, padY = 36
  // Pane-local screen coordinates, shared by rendering and hover hit-testing.
  const panes = useMemo(() => model.embs.map((E) => {
    const ex = d3.extent(E.emb, (d) => d[0]) as [number, number]
    const ey = d3.extent(E.emb, (d) => d[1]) as [number, number]
    const ePadX = Math.max(0.1, (ex[1] - ex[0]) * 0.1)
    const ePadY = Math.max(0.1, (ey[1] - ey[0]) * 0.1)
    const xs = d3.scaleLinear([ex[0] - ePadX, ex[1] + ePadX], [padX, paneW - padX])
    const ys = d3.scaleLinear([ey[0] - ePadY, ey[1] + ePadY], [paneH - 8, padY])
    return { ...E, pos: E.emb.map((p) => [xs(p[0]), ys(p[1])] as XY) }
  }), [model, paneW, paneH])

  // Linked hover: hovering near a point in ANY pane highlights that same
  // datum (ring) and its cluster siblings in all four panes, so the reader
  // can track one datum across methods.
  const svgRef = useRef<SVGSVGElement | null>(null)
  const [hoverId, setHoverId] = useState<number | null>(null)
  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const svg = svgRef.current
    const ctm = svg?.getScreenCTM()
    if (!svg || !ctm) return
    const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse())
    let best: number | null = null
    let bestD = 12 * 12 // only grab points within ~12px (viewBox units)
    panes.forEach((pane, paneIdx) => {
      const lx = pt.x - paneIdx * paneW
      for (let i = 0; i < pane.pos.length; i++) {
        const dx = pane.pos[i][0] - lx, dy = pane.pos[i][1] - pt.y
        const d = dx * dx + dy * dy
        if (d < bestD) { bestD = d; best = i }
      }
    })
    setHoverId(best)
  }
  const hoverC = hoverId != null ? model.pts[hoverId].c : null

  return (
    <svg ref={svgRef} width="100%" height={340} viewBox="0 0 680 340" preserveAspectRatio="xMidYMid meet"
      onPointerMove={onPointerMove} onPointerLeave={() => setHoverId(null)} style={{ touchAction: 'none' }}>
      {panes.map((E, k) => {
        // Part highlighting: emphasize the named pane, dim the rest.
        const active = activePart === E.part
        const dimmed = activePart != null && !active
        return (
          <g key={E.title} transform={`translate(${k * paneW},0)`} opacity={dimmed ? 0.35 : 1}>
            <text x={paneW / 2} y={16} textAnchor="middle" style={{ fontSize: 12, fontWeight: 700 }} fill={active ? 'var(--accent)' : 'var(--text)'}>{E.title}</text>
            <text x={paneW / 2} y={30} textAnchor="middle" style={{ fontSize: 10 }} fill="var(--text-3)">{E.note}</text>
            <rect x={padX - 4} y={padY - 6} width={paneW - 2 * padX + 8} height={paneH - padY + 4} fill="var(--bg)" stroke={active ? 'var(--accent)' : 'var(--border)'} strokeWidth={active ? 1.5 : 1} rx={4} />
            {E.pos.map((q, i) => {
              const sameCluster = hoverC != null && model.pts[i].c === hoverC
              const faded = hoverId != null && !sameCluster
              return <circle key={i} cx={q[0]} cy={q[1]} r={2.6} fill={colors(model.pts[i].c)} opacity={faded ? 0.15 : sameCluster ? 1 : 0.85} />
            })}
            {hoverId != null && (
              <g pointerEvents="none">
                <circle cx={E.pos[hoverId][0]} cy={E.pos[hoverId][1]} r={3.4} fill={colors(model.pts[hoverId].c)} stroke="white" strokeWidth={1} />
                <circle cx={E.pos[hoverId][0]} cy={E.pos[hoverId][1]} r={7} fill="none" stroke="var(--text)" strokeWidth={1.2} />
              </g>
            )}
          </g>
        )
      })}
      {hoverId == null && (
        <text x={W / 2} y={H - 2} textAnchor="middle" style={{ fontSize: 10 }} fill="var(--text-3)">hover a point to track it across all four views</text>
      )}
    </svg>
  )
}

function buildCompareModel(seed: number, K: number, perCluster: number, tsneK: number, tsneRepulsion: number, umapK: number, umapRepulsion: number, iters: number) {
  const rng = mulberry32(seed)
  const pts: ComparePoint[] = []
  for (let c = 0; c < K; c++) {
    const theta0 = 1.5 + c * 0.9
    for (let i = 0; i < perCluster; i++) {
      const theta = theta0 + gaussian(rng) * 0.25
      const h = gaussian(rng) * 2
      const x = theta * Math.cos(theta) + gaussian(rng) * 0.3
      const y = h
      const z = theta * Math.sin(theta) + gaussian(rng) * 0.3
      pts.push({ x, y, z, theta, c, id: pts.length })
    }
  }
  const pcaEmb = () => {
    const mx = d3.mean(pts, (d) => d.x) ?? 0
    const mz = d3.mean(pts, (d) => d.z) ?? 0
    return pts.map((p) => [p.x - mx, p.z - mz] as XY)
  }
  const isomapEmb = () => pts.map((p) => [p.theta, p.y] as XY)
  const forceEmb = (k: number, charge: number, itersN: number, layoutSeed: number): XY[] => {
    const data = pts.map((p) => ({ id: p.id, x: 0, y: 0, c: p.c }))
    const rng = mulberry32(layoutSeed)
    data.forEach((d) => { d.x = gaussian(rng) * 10; d.y = gaussian(rng) * 10 })
    const links: { source: number; target: number }[] = []
    for (let i = 0; i < pts.length; i++) {
      const arr = []
      for (let j = 0; j < pts.length; j++) {
        if (i === j) continue
        const d = Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y, pts[i].z - pts[j].z)
        arr.push({ j, d })
      }
      arr.sort((a, b) => a.d - b.d)
      for (const e of arr.slice(0, k)) if (i < e.j) links.push({ source: i, target: e.j })
    }
    const sim = d3.forceSimulation(data as d3.SimulationNodeDatum[])
      .force('link', d3.forceLink(links).id((d: any) => d.id).distance(6).strength(0.8))
      .force('charge', d3.forceManyBody().strength(charge).distanceMax(45))
      .force('center', d3.forceCenter(0, 0).strength(0.05))
      .force('collide', d3.forceCollide(2))
      .alpha(1).alphaDecay(0.015).stop()
    for (let i = 0; i < itersN; i++) sim.tick()
    return data.map((d) => [d.x, d.y] as XY)
  }
  const embs = [
    { part: 'pca', title: 'PCA', note: 'linear · preserves variance', emb: pcaEmb() },
    { part: 'isomap', title: 'Isomap', note: 'preserves geodesic distance', emb: isomapEmb() },
    { part: 'tsne', title: 't-SNE-like', note: 'tight clusters · heavy repulsion', emb: forceEmb(tsneK, tsneRepulsion, iters, 101) },
    { part: 'umap', title: 'UMAP-like', note: 'balanced · moderate k', emb: forceEmb(umapK, umapRepulsion, iters, 202) },
  ]
  return { pts, embs }
}

type XY = [number, number]
