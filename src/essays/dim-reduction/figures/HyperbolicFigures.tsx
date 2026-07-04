import { useEffect, useMemo, useRef, useState } from 'react'
import * as d3 from 'd3'
import type { FigureProps } from './registry'
import { num } from '../../runtime/lib/params'
import { useFigureHighlight } from '../../runtime/store'

// Faithful React ports of docs/dim-reduction/08-hierarchy.html.

// ---------- Figure 1: volume/tree comparison ----------

type TreeNode = {
  id: number
  depth: number
  parent: number
  children: TreeNode[]
  theta0?: number
  theta1?: number
  cx?: number
  cy?: number
  px?: number
  py?: number
}

function buildTree(depth: number, b: number): TreeNode[] {
  const nodes: TreeNode[] = [{ id: 0, depth: 0, parent: -1, children: [] }]
  let nextId = 1
  function expand(node: TreeNode) {
    if (node.depth >= depth) return
    for (let i = 0; i < b; i++) {
      const child: TreeNode = { id: nextId++, depth: node.depth + 1, parent: node.id, children: [] }
      node.children.push(child)
      nodes.push(child)
      expand(child)
    }
  }
  expand(nodes[0])
  return nodes
}

function layoutEuclidean(nodes: TreeNode[], depth: number, R: number) {
  nodes[0].theta0 = 0
  nodes[0].theta1 = 2 * Math.PI
  nodes[0].cx = 0
  nodes[0].cy = 0
  for (const n of nodes) {
    if (n.children.length === 0) continue
    const span = ((n.theta1 ?? 0) - (n.theta0 ?? 0)) / n.children.length
    n.children.forEach((c, i) => {
      c.theta0 = (n.theta0 ?? 0) + i * span
      c.theta1 = (n.theta0 ?? 0) + (i + 1) * span
      const theta = ((c.theta0 ?? 0) + (c.theta1 ?? 0)) / 2
      const r = (c.depth / depth) * R
      c.cx = r * Math.cos(theta)
      c.cy = r * Math.sin(theta)
    })
  }
}

// Möbius transform sending the disk's origin to `a` — an isometry of the
// Poincaré disk. Used to place a node's children in the node's *own* local
// frame and then map them back to global coordinates.
function mobiusFrom(a: [number, number], z: [number, number]): [number, number] {
  const [ax, ay] = a
  const [zx, zy] = z
  const nx = zx + ax, ny = zy + ay // z + a
  const cx = ax * zx + ay * zy // Re(conj(a) * z)
  const cy = ax * zy - ay * zx // Im(conj(a) * z)
  const dx = 1 + cx, dy = cy // 1 + conj(a) * z
  const dd = dx * dx + dy * dy
  return [(nx * dx + ny * dy) / dd, (ny * dx - nx * dy) / dd]
}

// Proper hyperbolic tree layout. Each node becomes a local origin via a
// Möbius isometry and fans its children into a cone pointing away from its
// parent. Every edge has the SAME hyperbolic length (`step`), so deep
// subtrees fan out into fresh room instead of piling onto one rim ring the
// way the Euclidean radial layout does — the whole point of the comparison.
function layoutPoincare(nodes: TreeNode[], _depth: number) {
  const step = 1.35 // hyperbolic length of every edge
  const childWedge = 1.7 // radians of cone handed to each child's subtree
  const rp = Math.tanh(step / 2) // Euclidean radius of a child in its local frame
  nodes[0].px = 0
  nodes[0].py = 0
  function place(node: TreeNode, center: number, width: number) {
    const kids = node.children
    if (kids.length === 0) return
    const g: [number, number] = [node.px ?? 0, node.py ?? 0]
    kids.forEach((c, i) => {
      const frac = kids.length === 1 ? 0.5 : (i + 0.5) / kids.length
      const phi = center + (frac - 0.5) * width
      const gc = mobiusFrom(g, [rp * Math.cos(phi), rp * Math.sin(phi)])
      c.px = gc[0]
      c.py = gc[1]
      // Direction back toward the parent, in the child's own local frame;
      // the child fans its descendants the opposite way (outward).
      const back = mobiusFrom([-gc[0], -gc[1]], g)
      const outAngle = Math.atan2(back[1], back[0]) + Math.PI
      place(c, outAngle, childWedge)
    })
  }
  place(nodes[0], 0, 2 * Math.PI) // root fans children around the full circle
}

// A balanced tree embedded two ways side by side — Euclidean radial layout
// (leaves crowd the boundary) vs. Poincaré disk (every node has room).
export const VOLUME_DEFAULTS = {
  depth: 4, // tree depth / number of levels (slider 1–6)
  branchingFactor: 3, // children per node (slider 2–4)
}

// Node count is b^depth, so the heuristic's max of 50 on either knob would
// build an astronomically large tree; mirror the reader sliders (1–6, 2–4),
// which cap the tree at 4^6 ≈ 4k leaves so the SVG stays responsive.
export const VOLUME_HINTS = {
  depth: { min: 1, max: 6, step: 1 },
  branchingFactor: { min: 2, max: 4, step: 1 },
}

export function VolumeFigure(props: FigureProps) {
  const depth0 = num(props.depth, VOLUME_DEFAULTS.depth)
  const b0 = num(props.branchingFactor, VOLUME_DEFAULTS.branchingFactor)
  const [depth, setDepth] = useState(depth0)
  const [b, setB] = useState(b0)
  // `shown` is the depth currently drawn; the grow button steps it 1→depth so
  // the reader watches each new generation appear (and the Euclidean tree
  // repack inward to make room) rather than snapping to the final tree.
  const [shown, setShown] = useState(depth0)
  const [playing, setPlaying] = useState(false)
  const growRef = useRef<number | null>(null)
  // Follow live knob/markdown changes.
  useEffect(() => { setDepth(depth0); setShown(depth0) }, [depth0])
  useEffect(() => setB(b0), [b0])
  useEffect(() => () => { if (growRef.current) window.clearInterval(growRef.current) }, [])
  const { activePart } = useFigureHighlight(props.figureId as string)
  const W = 680, H = 400
  const paneW = W / 2
  const cx0 = paneW / 2, cy0 = H / 2
  const cx1 = paneW + paneW / 2, cy1 = H / 2
  const R = Math.min(paneW, H) / 2 - 30

  const { nodes, edges } = useMemo(() => {
    const nodes = buildTree(shown, b)
    layoutEuclidean(nodes, shown, R)
    layoutPoincare(nodes, shown)
    const edges = nodes.filter((n) => n.parent >= 0).map((n) => ({ c: n, p: nodes[n.parent] }))
    return { nodes, edges }
  }, [shown, b, R])
  const depthColor = d3.scaleSequential(d3.interpolateBlues).domain([0, Math.max(depth, 1)])

  const arcLine = d3.line<[number, number]>().x((d) => cx1 + d[0] * R).y((d) => cy1 + d[1] * R)

  function stopGrow() {
    if (growRef.current) { window.clearInterval(growRef.current); growRef.current = null }
    setPlaying(false)
  }
  function setDepthValue(v: number) {
    stopGrow()
    setDepth(v)
    setShown(v)
  }
  function startGrow() {
    stopGrow()
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setShown(depth)
      return
    }
    setPlaying(true)
    setShown(1)
    let cur = 1
    growRef.current = window.setInterval(() => {
      cur += 1
      setShown(cur)
      if (cur >= depth) {
        if (growRef.current) { window.clearInterval(growRef.current); growRef.current = null }
        setPlaying(false)
      }
    }, 750)
  }

  return (
    <div>
      <div className="controls">
        <label>depth <span className="value">{depth}</span><input type="range" min={1} max={6} value={depth} onChange={(e) => setDepthValue(+e.currentTarget.value)} /></label>
        <label>branching factor <span className="value">{b}</span><input type="range" min={2} max={4} value={b} onChange={(e) => { stopGrow(); setB(+e.currentTarget.value); setShown(depth) }} /></label>
        <button className="figure-button" type="button" onClick={startGrow} disabled={playing || depth < 2}>{playing ? `growing… level ${shown}` : '▶ grow level by level'}</button>
      </div>
      <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet">
        <g opacity={activePart && activePart !== 'euclidean' ? 0.35 : 1}>
          <text x={paneW / 2} y={20} textAnchor="middle" style={{ fontSize: 12, fontWeight: 700 }} fill="var(--text)">Euclidean radial layout</text>
          <circle cx={cx0} cy={cy0} r={R} fill="white" stroke={activePart === 'euclidean' ? 'var(--accent)' : 'var(--border-2)'} strokeWidth={activePart === 'euclidean' ? 2 : 1} />
          {edges.map((e, i) => <line key={i} x1={cx0 + (e.p.cx ?? 0)} y1={cy0 + (e.p.cy ?? 0)} x2={cx0 + (e.c.cx ?? 0)} y2={cy0 + (e.c.cy ?? 0)} stroke="var(--text-3)" strokeWidth={0.7} strokeOpacity={0.5} />)}
          {nodes.map((n) => <circle key={n.id} className={n.depth === shown ? 'hyp-pop' : undefined} cx={cx0 + (n.cx ?? 0)} cy={cy0 + (n.cy ?? 0)} r={2.5} fill={depthColor(depth - n.depth)} stroke="white" strokeWidth={0.4} />)}
        </g>
        <g opacity={activePart && activePart !== 'poincare' ? 0.35 : 1}>
          <text x={cx1} y={20} textAnchor="middle" style={{ fontSize: 12, fontWeight: 700 }} fill="var(--text)">Poincaré disk</text>
          <circle cx={cx1} cy={cy1} r={R} fill="white" stroke={activePart === 'poincare' ? 'var(--accent)' : 'var(--border-2)'} strokeWidth={activePart === 'poincare' ? 2 : 1.5} />
          {edges.map((e, i) => <path key={i} d={arcLine(geodesicArcPoints([e.p.px ?? 0, e.p.py ?? 0], [e.c.px ?? 0, e.c.py ?? 0])) ?? ''} fill="none" stroke="var(--accent)" strokeWidth={0.9} strokeOpacity={0.6} />)}
          {nodes.map((n) => <circle key={n.id} className={n.depth === shown ? 'hyp-pop' : undefined} cx={cx1 + (n.px ?? 0) * R} cy={cy1 + (n.py ?? 0) * R} r={2.5} fill={depthColor(depth - n.depth)} stroke="white" strokeWidth={0.4} />)}
        </g>
      </svg>
    </div>
  )
}

// Sample points along the true Poincaré geodesic between two disk points:
// the circular arc orthogonal to the unit circle (a straight diameter when
// either endpoint is the origin). Replaces the original "bias toward origin"
// approximation, which produced spiky, unfaithful arcs.
function geodesicArcPoints(p: [number, number], q: [number, number]): [number, number][] {
  const circle = geodesicCircle(p, q)
  if (!circle) return [p, q]
  const a1 = Math.atan2(p[1] - circle.cy, p[0] - circle.cx)
  const a2 = Math.atan2(q[1] - circle.cy, q[0] - circle.cx)
  let delta = a2 - a1
  while (delta > Math.PI) delta -= 2 * Math.PI
  while (delta < -Math.PI) delta += 2 * Math.PI
  const steps = 16
  const pts: [number, number][] = []
  for (let s = 0; s <= steps; s++) {
    const a = a1 + delta * (s / steps)
    pts.push([circle.cx + circle.r * Math.cos(a), circle.cy + circle.r * Math.sin(a)])
  }
  return pts
}

// ---------- Figure 2: Poincaré geodesic ----------

type PtPair = { p1: [number, number]; p2: [number, number] }

// Two draggable points in the Poincaré disk; gray line is the Euclidean
// segment, blue arc is the hyperbolic geodesic (bends toward the origin).
// Default placement puts both points near the rim, well off the central
// diameter, so the geodesic visibly bows toward the origin (the behavior the
// prose :term-links to). A near-diametral placement would make the arc and the
// straight segment nearly coincide and hide the effect.
export const GEODESIC_DEFAULTS = {
  p1x: -0.6, // first point, Poincaré x in (-1, 1)
  p1y: 0.62, // first point, Poincaré y
  p2x: 0.6, // second point, Poincaré x
  p2y: 0.62, // second point, Poincaré y
}

// Both points live in the Poincaré disk, clamped to radius 0.95 like the
// drag handler — the heuristic would offer [-5, 5] / [0, 5].
export const GEODESIC_HINTS = {
  p1x: { min: -0.95, max: 0.95, step: 0.01 },
  p1y: { min: -0.95, max: 0.95, step: 0.01 },
  p2x: { min: -0.95, max: 0.95, step: 0.01 },
  p2y: { min: -0.95, max: 0.95, step: 0.01 },
}

export function GeodesicFigure(props: FigureProps) {
  const p1x = num(props.p1x, GEODESIC_DEFAULTS.p1x)
  const p1y = num(props.p1y, GEODESIC_DEFAULTS.p1y)
  const p2x = num(props.p2x, GEODESIC_DEFAULTS.p2x)
  const p2y = num(props.p2y, GEODESIC_DEFAULTS.p2y)
  const [pts, setPts] = useState<PtPair>({ p1: [p1x, p1y], p2: [p2x, p2y] })
  // Follow live knob/markdown changes; reader drags win until params change.
  useEffect(() => setPts({ p1: [p1x, p1y], p2: [p2x, p2y] }), [p1x, p1y, p2x, p2y])
  const svgRef = useRef<SVGSVGElement>(null)
  const draggingRef = useRef<null | 'p1' | 'p2'>(null)

  const W = 680, H = 360
  const cx = W / 2, cy = H / 2
  const R = Math.min(W, H) / 2 - 30

  const handleMove = (ev: PointerEvent) => {
    if (!draggingRef.current || !svgRef.current) return
    const rect = svgRef.current.getBoundingClientRect()
    const scale = rect.width / W
    let nx = (ev.clientX - rect.left - cx * scale) / (R * scale)
    let ny = (ev.clientY - rect.top - cy * scale) / (R * scale)
    const r = Math.hypot(nx, ny)
    if (r > 0.95) { nx = (nx / r) * 0.95; ny = (ny / r) * 0.95 }
    setPts((cur) => ({ ...cur, [draggingRef.current as 'p1' | 'p2']: [nx, ny] }))
  }
  const handleUp = () => { draggingRef.current = null }

  useEffect(() => {
    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', handleUp)
    return () => { window.removeEventListener('pointermove', handleMove); window.removeEventListener('pointerup', handleUp) }
  }, [])

  const circle = useMemo(() => geodesicCircle(pts.p1, pts.p2), [pts])
  let arcPath = ''
  if (circle) {
    const a1 = Math.atan2(pts.p1[1] - circle.cy, pts.p1[0] - circle.cx)
    const a2 = Math.atan2(pts.p2[1] - circle.cy, pts.p2[0] - circle.cx)
    let delta = a2 - a1
    while (delta > Math.PI) delta -= 2 * Math.PI
    while (delta < -Math.PI) delta += 2 * Math.PI
    const steps = 60
    const arcPts: [number, number][] = []
    for (let s = 0; s <= steps; s++) {
      const t = s / steps
      const a = a1 + delta * t
      arcPts.push([circle.cx + circle.r * Math.cos(a), circle.cy + circle.r * Math.sin(a)])
    }
    const gen = d3.line<[number, number]>().x((d) => cx + d[0] * R).y((d) => cy + d[1] * R)
    arcPath = gen(arcPts) ?? ''
  } else {
    const gen = d3.line<[number, number]>().x((d) => cx + d[0] * R).y((d) => cy + d[1] * R)
    arcPath = gen([pts.p1, pts.p2]) ?? ''
  }

  const pd = poincareDist(pts.p1, pts.p2)
  const ed = Math.hypot(pts.p1[0] - pts.p2[0], pts.p1[1] - pts.p2[1])

  return (
    <>
    <svg ref={svgRef} width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" style={{ touchAction: 'none' }}>
      <circle cx={cx} cy={cy} r={R} fill="white" stroke="var(--border-2)" strokeWidth={1.5} />
      <g opacity={0.2}>
        {Array.from({ length: 12 }, (_, i) => i * Math.PI / 6).map((a, i) => (
          <line key={i} x1={cx} y1={cy} x2={cx + Math.cos(a) * R} y2={cy + Math.sin(a) * R} stroke="var(--border-2)" strokeWidth={0.5} />
        ))}
        {[1, 2, 3, 4, 5].map((d) => <circle key={d} cx={cx} cy={cy} r={Math.tanh(d / 2) * R} fill="none" stroke="var(--border-2)" strokeWidth={0.5} />)}
      </g>
      <line x1={cx + pts.p1[0] * R} y1={cy + pts.p1[1] * R} x2={cx + pts.p2[0] * R} y2={cy + pts.p2[1] * R} stroke="var(--text-3)" strokeWidth={1.2} strokeDasharray="4 3" />
      <path d={arcPath} fill="none" stroke="var(--accent)" strokeWidth={2.2} />
      {(['p1', 'p2'] as const).map((key) => {
        const p = pts[key]
        return <circle key={key} cx={cx + p[0] * R} cy={cy + p[1] * R} r={7} fill="var(--accent)" stroke="white" strokeWidth={2} style={{ cursor: 'grab' }} onPointerDown={(e) => { draggingRef.current = key; (e.target as Element).setPointerCapture?.(e.pointerId) }} />
      })}
      <g>
        <rect x={12} y={12} width={200} height={42} fill="white" stroke="var(--border)" rx={4} />
        <text x={20} y={28} style={{ fontSize: 11 }} fill="var(--text-3)">Euclidean: <tspan dx={8} fill="var(--text)" style={{ fontFamily: 'var(--mono-font)' }}>{ed.toFixed(3)}</tspan></text>
        <text x={20} y={46} style={{ fontSize: 11 }} fill="var(--accent)">hyperbolic: <tspan dx={4} style={{ fontFamily: 'var(--mono-font)' }}>{pd.toFixed(3)}</tspan></text>
      </g>
    </svg>
    <p className="figure-hint">drag the two blue points to compare Euclidean and hyperbolic distance</p>
    </>
  )
}

function poincareDist(u: [number, number], v: [number, number]) {
  const du = u[0] * u[0] + u[1] * u[1]
  const dv = v[0] * v[0] + v[1] * v[1]
  const dif = (u[0] - v[0]) ** 2 + (u[1] - v[1]) ** 2
  const arg = 1 + (2 * dif) / ((1 - du) * (1 - dv) + 1e-9)
  return Math.acosh(Math.max(1, arg))
}

function geodesicCircle(p: [number, number], q: [number, number]) {
  const cross = p[0] * q[1] - p[1] * q[0]
  if (Math.abs(cross) < 1e-5 || (p[0] === 0 && p[1] === 0) || (q[0] === 0 && q[1] === 0)) return null
  const pnorm = p[0] * p[0] + p[1] * p[1]
  const pStar: [number, number] = [p[0] / pnorm, p[1] / pnorm]
  const [x1, y1] = p
  const [x2, y2] = q
  const [x3, y3] = pStar
  const A = x2 - x1, B = y2 - y1, C = x3 - x1, D = y3 - y1
  const E = A * (x1 + x2) + B * (y1 + y2)
  const F = C * (x1 + x3) + D * (y1 + y3)
  const G = 2 * (A * (y3 - y2) - B * (x3 - x2))
  if (Math.abs(G) < 1e-8) return null
  const ccx = (D * E - B * F) / G
  const ccy = (A * F - C * E) / G
  const rr = Math.hypot(x1 - ccx, y1 - ccy)
  return { cx: ccx, cy: ccy, r: rr }
}
