import { useEffect, useMemo, useRef, useState } from 'react'
import * as d3 from 'd3'
import type { FigureProps } from './registry'
import { num, str } from '../../runtime/lib/params'
import { useFigureHighlight } from '../../runtime/store'
import { crescentOutline } from './_twoMoons'

// Five lenses on the same two-moons dataset: points, distances,
// k-neighbors, density contours, topology blobs. Each lens encodes a
// different notion of "structure" and is what a corresponding family
// of dim-reduction methods tries to preserve.
//
// The points never move or re-render across lens switches — only the
// overlay (edges / contours / blobs) crossfades — so switching lenses
// reads as "same data, different annotation" rather than five separate
// pictures.
//
// Faithful port of docs/dim-reduction/01-framing.html Figure 2.

type Lens = 'points' | 'distances' | 'neighbors' | 'density' | 'topology'

const LENSES: Lens[] = ['points', 'distances', 'neighbors', 'density', 'topology']

// Tweakable surface. Override per-instance from markdown:
//   :::figure{id=lenses-view lens=density k=8}
export const DEFAULTS = {
  lens: 'points', // initial lens: points | distances | neighbors | density | topology
  nPer: 80, // points per crescent (two crescents total)
  noise: 0.05, // gaussian jitter on each crescent point
  seed: 7, // RNG seed for the point cloud
  k: 5, // nearest neighbors per point in the neighbors lens
  maxPairs: 1200, // how many of the shortest pairwise edges the distances lens draws
  bandwidth: 22, // kernel bandwidth (px) for the density contours
}

// Knob-panel bounds: nPer past ~200 makes the O(n²) distances lens
// sluggish; noise beyond ~0.25 destroys the crescents and mag/100 is
// too fine to dial; k must stay >= 1 and small vs. n; maxPairs only
// has ~13K pairs to draw at default size (heuristic max 50K); a 500px
// density bandwidth washes the whole panel out.
export const PARAM_HINTS = {
  nPer: { min: 5, max: 200, step: 5 },
  noise: { min: 0, max: 0.25, step: 0.005 },
  k: { min: 1, max: 30, step: 1 },
  maxPairs: { min: 50, max: 5000, step: 50 },
  bandwidth: { min: 2, max: 80, step: 1 },
}

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
function gaussian(rng: () => number) {
  const u = 1 - rng()
  const v = rng()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

type Pt = { x: number; y: number; c: 0 | 1; id: string }

function buildData(nPer: number, noise: number, seed: number): Pt[] {
  const rng = mulberry32(seed)
  const data: Pt[] = []
  for (let i = 0; i < nPer; i++) {
    const t = i / (nPer - 1)
    const a = Math.PI * t
    data.push({
      x: Math.cos(a) + gaussian(rng) * noise,
      y: Math.sin(a) + gaussian(rng) * noise,
      c: 0,
      id: `a${i}`,
    })
  }
  for (let i = 0; i < nPer; i++) {
    const t = i / (nPer - 1)
    const a = Math.PI * t
    data.push({
      x: 1 - Math.cos(a) + gaussian(rng) * noise,
      y: 0.5 - Math.sin(a) + gaussian(rng) * noise,
      c: 1,
      id: `b${i}`,
    })
  }
  return data
}

export default function LensesView(props: FigureProps) {
  const lensRaw = str(props.lens, DEFAULTS.lens)
  const lens0: Lens = (LENSES as string[]).includes(lensRaw)
    ? (lensRaw as Lens)
    : 'points'
  const nPer = Math.max(2, Math.round(num(props.nPer, DEFAULTS.nPer)))
  const noise = num(props.noise, DEFAULTS.noise)
  const seed = num(props.seed, DEFAULTS.seed)
  const k = Math.max(1, Math.round(num(props.k, DEFAULTS.k)))
  const maxPairs = Math.max(1, Math.round(num(props.maxPairs, DEFAULTS.maxPairs)))
  const bandwidth = num(props.bandwidth, DEFAULTS.bandwidth)

  const [lens, setLens] = useState<Lens>(lens0)
  useEffect(() => setLens(lens0), [lens0])

  // Term highlighting: prose can point at a specific lens
  // (lenses-view.points, .distances, .neighbors, .density, .topology)
  // and the figure switches to show that lens while the term is active.
  const { activePart } = useFigureHighlight(props.figureId as string)
  const highlightLens =
    activePart && (LENSES as string[]).includes(activePart)
      ? (activePart as Lens)
      : null
  const shownLens = highlightLens ?? lens

  const svgRef = useRef<SVGSVGElement>(null)
  const data = useMemo(() => buildData(nPer, noise, seed), [nPer, noise, seed])
  const sceneRef = useRef<{
    overlayHost: d3.Selection<SVGGElement, unknown, null, undefined>
    pointLayer: d3.Selection<SVGGElement, unknown, null, undefined>
    xScale: d3.ScaleLinear<number, number>
    yScale: d3.ScaleLinear<number, number>
    innerW: number
    innerH: number
  } | null>(null)
  const reduceMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches

  // Scene scaffold: scales and the (persistent) points. Rebuilt only when
  // the data itself changes — never on a lens switch, so the points hold
  // perfectly still while the lens overlays crossfade beneath them.
  useEffect(() => {
    const W = 680
    const H = 380
    const margin = { top: 16, right: 16, bottom: 16, left: 16 }
    const innerW = W - margin.left - margin.right
    const innerH = H - margin.top - margin.bottom
    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()
    const g = svg
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`)

    const xExt = d3.extent(data, (d) => d.x) as [number, number]
    const yExt = d3.extent(data, (d) => d.y) as [number, number]
    const pad = 0.15
    const xScale = d3
      .scaleLinear()
      .domain([xExt[0] - pad, xExt[1] + pad])
      .range([0, innerW])
    const yScale = d3
      .scaleLinear()
      .domain([yExt[0] - pad, yExt[1] + pad])
      .range([innerH, 0])

    const overlayHost = g.append('g')
    const pointLayer = g.append('g')

    pointLayer
      .selectAll('circle')
      .data(data, (d) => (d as Pt).id)
      .join('circle')
      .attr('r', 3.2)
      .attr('cx', (d) => xScale(d.x))
      .attr('cy', (d) => yScale(d.y))
      .attr('fill', (d) => (d.c === 0 ? 'var(--accent)' : 'var(--warm)'))
      .attr('opacity', 1)
      .attr('stroke', 'white')
      .attr('stroke-width', 0.5)

    sceneRef.current = { overlayHost, pointLayer, xScale, yScale, innerW, innerH }
  }, [data])

  // Lens overlay: each switch renders the new lens into its own group at
  // opacity 0 and crossfades it in while any previous overlay fades out
  // and is removed. The points only adjust their opacity (density and
  // topology dim them slightly so the annotation reads).
  useEffect(() => {
    const scene = sceneRef.current
    if (!scene) return
    const { overlayHost, pointLayer, xScale, yScale, innerW, innerH } = scene
    const dur = reduceMotion ? 0 : 350

    const old = overlayHost.selectAll<SVGGElement, unknown>(':scope > g')
    old
      .transition()
      .duration(dur)
      .style('opacity', 0)
      .remove()

    const bgLayer = overlayHost.append('g').style('opacity', 0)
    const edgeLayer = bgLayer.append('g')

    const pointOpacity =
      shownLens === 'density' ? 0.85 : shownLens === 'topology' ? 0.9 : 1
    pointLayer
      .selectAll('circle')
      .transition()
      .duration(dur)
      .attr('opacity', pointOpacity)

    if (shownLens === 'distances') {
      const pairs: { a: number; b: number; d: number }[] = []
      for (let i = 0; i < data.length; i++) {
        for (let j = i + 1; j < data.length; j++) {
          pairs.push({
            a: i,
            b: j,
            d: Math.hypot(data[i].x - data[j].x, data[i].y - data[j].y),
          })
        }
      }
      pairs.sort((a, b) => a.d - b.d)
      const sel = pairs.slice(0, maxPairs)
      const maxD = sel[sel.length - 1].d
      edgeLayer
        .selectAll('line')
        .data(sel)
        .join('line')
        .attr('x1', (p) => xScale(data[p.a].x))
        .attr('y1', (p) => yScale(data[p.a].y))
        .attr('x2', (p) => xScale(data[p.b].x))
        .attr('y2', (p) => yScale(data[p.b].y))
        .attr('stroke', 'var(--accent)')
        .attr('stroke-opacity', (p) => 0.02 + 0.25 * (1 - p.d / maxD))
        .attr('stroke-width', (p) => 0.3 + 1.4 * (1 - p.d / maxD))
    } else if (shownLens === 'neighbors') {
      const edges: { a: number; b: number }[] = []
      for (let i = 0; i < data.length; i++) {
        const dists = data
          .map((d, j) => ({
            j,
            d: Math.hypot(data[i].x - d.x, data[i].y - d.y),
          }))
          .filter((e) => e.j !== i)
          .sort((a, b) => a.d - b.d)
          .slice(0, k)
        for (const e of dists) if (i < e.j) edges.push({ a: i, b: e.j })
      }
      edgeLayer
        .selectAll('line')
        .data(edges)
        .join('line')
        .attr('x1', (e) => xScale(data[e.a].x))
        .attr('y1', (e) => yScale(data[e.a].y))
        .attr('x2', (e) => xScale(data[e.b].x))
        .attr('y2', (e) => yScale(data[e.b].y))
        .attr('stroke', (e) =>
          data[e.a].c === data[e.b].c ? 'var(--text-2)' : 'var(--warm)',
        )
        .attr('stroke-opacity', 0.5)
        .attr('stroke-width', 0.8)
    } else if (shownLens === 'density') {
      const contours = d3
        .contourDensity<Pt>()
        .x((d) => xScale(d.x))
        .y((d) => yScale(d.y))
        .size([innerW, innerH])
        .bandwidth(bandwidth)
        .thresholds(10)(data)
      const maxV = d3.max(contours, (c) => c.value) ?? 1
      bgLayer
        .selectAll('path')
        .data(contours)
        .join('path')
        .attr('d', d3.geoPath() as unknown as string)
        .attr('fill', (c) =>
          d3.interpolateBlues(0.15 + (0.85 * c.value) / maxV),
        )
        .attr('stroke', 'none')
        .attr('opacity', 0.75)
    } else if (shownLens === 'topology') {
      // Blobs that hug each crescent (spine + perpendicular offset)
      // rather than convex hulls: hulls of interlocking crescents
      // overlap heavily, which would wrongly suggest the two components
      // touch. The blob width scales with the jitter so the outline
      // covers the points.
      const c0 = data.filter((d) => d.c === 0)
      const c1 = data.filter((d) => d.c === 1)
      const pxPerUnit = Math.abs(xScale(1) - xScale(0))
      const w = Math.max(12, 2.9 * noise * pxPerUnit + 12)
      const line = d3.line().curve(d3.curveCatmullRomClosed)
      const blob0 = crescentOutline(c0, xScale, yScale, w)
      const blob1 = crescentOutline(c1, xScale, yScale, w)
      bgLayer
        .append('path')
        .attr('d', line(blob0) ?? '')
        .attr('fill', 'var(--accent-light)')
        .attr('stroke', 'var(--accent)')
        .attr('stroke-width', 2)
        .attr('opacity', 0.7)
      bgLayer
        .append('path')
        .attr('d', line(blob1) ?? '')
        .attr('fill', 'var(--warm-light)')
        .attr('stroke', 'var(--warm)')
        .attr('stroke-width', 2)
        .attr('opacity', 0.7)
      // Label each component at its crescent's apex (the arc midpoint),
      // pushed outward past the blob edge.
      const apex = (pts: Pt[]) => {
        const mid = Math.floor(pts.length / 2)
        const lo = Math.max(0, mid - 3)
        const hi = Math.min(pts.length - 1, mid + 3)
        const seg = pts.slice(lo, hi + 1)
        return [
          d3.mean(seg, (p) => xScale(p.x)) ?? 0,
          d3.mean(seg, (p) => yScale(p.y)) ?? 0,
        ] as [number, number]
      }
      const apex0 = apex(c0) // arch apex points up
      const apex1 = apex(c1) // arch apex points down
      bgLayer
        .append('text')
        .attr('x', apex0[0])
        .attr('y', apex0[1] - w - 10)
        .attr('text-anchor', 'middle')
        .attr('fill', 'var(--accent)')
        .style('font-size', '13px')
        .style('font-weight', 700)
        .style('font-family', 'var(--heading-font)')
        .text('component A')
      bgLayer
        .append('text')
        .attr('x', apex1[0])
        .attr('y', apex1[1] + w + 18)
        .attr('text-anchor', 'middle')
        .attr('fill', 'var(--warm)')
        .style('font-size', '13px')
        .style('font-weight', 700)
        .style('font-family', 'var(--heading-font)')
        .text('component B')
    }

    bgLayer.transition().duration(dur).style('opacity', 1)
  }, [shownLens, data, noise, k, maxPairs, bandwidth, reduceMotion])

  return (
    <div>
      <div className="controls">
        <div className="toggle-group">
          {LENSES.map((l) => (
            <button
              key={l}
              className={shownLens === l ? 'active' : ''}
              onClick={() => setLens(l)}
              type="button"
            >
              {l}
            </button>
          ))}
        </div>
      </div>
      <svg
        ref={svgRef}
        width="100%"
        height={380}
        viewBox="0 0 680 380"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="The same two-crescent dataset rendered through five different structural lenses: raw points, pairwise distances, k-nearest-neighbor graph, density contours, and topological components."
        style={{
          outline: highlightLens ? '2px solid var(--accent)' : 'none',
          outlineOffset: 2,
          borderRadius: 4,
        }}
      />
    </div>
  )
}
