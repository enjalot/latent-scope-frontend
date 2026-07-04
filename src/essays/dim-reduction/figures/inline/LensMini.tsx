import { useMemo } from 'react'
import * as d3 from 'd3'
import { buildTwoMoons, crescentOutline, type Pt } from '../_twoMoons'
import { num, str } from '../../../runtime/lib/params'

// Inline mini-thumbnail of a single lens on the two-moons dataset.
// Used as `:inline-viz{kind=lens-mini name=points}` in markdown — one
// at the start of each lens-description paragraph as a visual reminder
// of which lens that paragraph is about.

const LENSES = ['points', 'distances', 'neighbors', 'density', 'topology'] as const
type Lens = (typeof LENSES)[number]

// Tweakable surface. Override per-instance from markdown:
//   :inline-viz{kind=lens-mini name=neighbors k=5}
export const DEFAULTS = {
  name: 'points', // which lens: points | distances | neighbors | density | topology
  nPer: 40, // points per crescent (80 total); thumbnail-scale subset of the big lenses-view
  seed: 7, // PRNG seed — same as lenses-view so both draw the same shape
  k: 3, // nearest neighbors per point in the neighbors lens
  maxPairs: 120, // shortest pairwise lines drawn in the distances lens
}

const W = 64
const H = 48

export default function LensMini(props: Record<string, unknown>) {
  const rawName = str(props.name, DEFAULTS.name)
  // Unknown names fall back to the plain points view rather than
  // silently rendering some other lens.
  const lens: Lens = (LENSES as readonly string[]).includes(rawName)
    ? (rawName as Lens)
    : 'points'
  const nPer = num(props.nPer, DEFAULTS.nPer)
  const seed = num(props.seed, DEFAULTS.seed)
  const k = num(props.k, DEFAULTS.k)
  const maxPairs = num(props.maxPairs, DEFAULTS.maxPairs)

  const data = useMemo(() => buildTwoMoons(nPer, seed), [nPer, seed])
  const scales = useMemo(() => {
    const xExt = d3.extent(data, (d) => d.x) as [number, number]
    const yExt = d3.extent(data, (d) => d.y) as [number, number]
    const pad = 0.15
    return {
      xs: d3
        .scaleLinear()
        .domain([xExt[0] - pad, xExt[1] + pad])
        .range([4, W - 4]),
      ys: d3
        .scaleLinear()
        .domain([yExt[0] - pad, yExt[1] + pad])
        .range([H - 4, 4]),
    }
  }, [data])

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width={W}
      height={H}
      role="img"
      aria-label={`${lens} lens preview`}
      style={{ verticalAlign: 'middle' }}
      className="lens-mini-svg"
    >
      <rect x={0} y={0} width={W} height={H} rx={2} fill="var(--bg)" stroke="var(--border)" />
      <Layer
        lens={lens}
        data={data}
        xs={scales.xs}
        ys={scales.ys}
        k={k}
        maxPairs={maxPairs}
      />
    </svg>
  )
}

function Layer({
  lens,
  data,
  xs,
  ys,
  k,
  maxPairs,
}: {
  lens: Lens
  data: Pt[]
  xs: d3.ScaleLinear<number, number>
  ys: d3.ScaleLinear<number, number>
  k: number
  maxPairs: number
}) {
  if (lens === 'distances')
    return (
      <>
        <Distances data={data} xs={xs} ys={ys} maxPairs={maxPairs} />
        <Points data={data} xs={xs} ys={ys} />
      </>
    )
  if (lens === 'neighbors')
    return (
      <>
        <Neighbors data={data} xs={xs} ys={ys} k={k} />
        <Points data={data} xs={xs} ys={ys} />
      </>
    )
  if (lens === 'density')
    return (
      <>
        <Density data={data} xs={xs} ys={ys} />
        <Points data={data} xs={xs} ys={ys} />
      </>
    )
  if (lens === 'topology')
    return (
      <>
        <Topology data={data} xs={xs} ys={ys} />
        <Points data={data} xs={xs} ys={ys} />
      </>
    )
  return <Points data={data} xs={xs} ys={ys} />
}

type LayerProps = {
  data: Pt[]
  xs: d3.ScaleLinear<number, number>
  ys: d3.ScaleLinear<number, number>
}

function Points({ data, xs, ys }: LayerProps) {
  return (
    <g>
      {data.map((d) => (
        <circle
          key={d.id}
          cx={xs(d.x)}
          cy={ys(d.y)}
          r={1.1}
          fill={d.c === 0 ? 'var(--accent)' : 'var(--warm)'}
        />
      ))}
    </g>
  )
}

function Distances({ data, xs, ys, maxPairs }: LayerProps & { maxPairs: number }) {
  const pairs = useMemo(() => {
    const out: { a: number; b: number; d: number }[] = []
    for (let i = 0; i < data.length; i++) {
      for (let j = i + 1; j < data.length; j++) {
        out.push({
          a: i,
          b: j,
          d: Math.hypot(data[i].x - data[j].x, data[i].y - data[j].y),
        })
      }
    }
    out.sort((a, b) => a.d - b.d)
    return out.slice(0, maxPairs)
  }, [data, maxPairs])
  if (pairs.length === 0) return null
  const maxD = pairs[pairs.length - 1].d
  return (
    <g>
      {pairs.map((p, i) => (
        <line
          key={i}
          x1={xs(data[p.a].x)}
          y1={ys(data[p.a].y)}
          x2={xs(data[p.b].x)}
          y2={ys(data[p.b].y)}
          stroke="var(--accent)"
          strokeOpacity={0.04 + 0.25 * (1 - p.d / maxD)}
          strokeWidth={0.3}
        />
      ))}
    </g>
  )
}

function Neighbors({ data, xs, ys, k }: LayerProps & { k: number }) {
  const edges = useMemo(() => {
    const e: { a: number; b: number; cross: boolean }[] = []
    for (let i = 0; i < data.length; i++) {
      const ds = data
        .map((d, j) => ({
          j,
          d: Math.hypot(data[i].x - d.x, data[i].y - d.y),
        }))
        .filter((x) => x.j !== i)
        .sort((a, b) => a.d - b.d)
        .slice(0, k)
      for (const x of ds) {
        if (i < x.j)
          e.push({ a: i, b: x.j, cross: data[i].c !== data[x.j].c })
      }
    }
    return e
  }, [data, k])
  return (
    <g>
      {edges.map((e, i) => (
        <line
          key={i}
          x1={xs(data[e.a].x)}
          y1={ys(data[e.a].y)}
          x2={xs(data[e.b].x)}
          y2={ys(data[e.b].y)}
          stroke={e.cross ? 'var(--warm)' : 'var(--text-2)'}
          strokeOpacity={0.55}
          strokeWidth={0.4}
        />
      ))}
    </g>
  )
}

function Density({ data, xs, ys }: LayerProps) {
  const contours = useMemo(() => {
    return d3
      .contourDensity<Pt>()
      .x((d) => xs(d.x))
      .y((d) => ys(d.y))
      .size([W, H])
      .bandwidth(4)
      .thresholds(6)(data)
  }, [data, xs, ys])
  const maxV = d3.max(contours, (c) => c.value) ?? 1
  const path = d3.geoPath()
  return (
    <g>
      {contours.map((c, i) => (
        <path
          key={i}
          d={path(c) ?? ''}
          fill={d3.interpolateBlues(0.2 + (0.8 * c.value) / maxV)}
          opacity={0.7}
        />
      ))}
    </g>
  )
}

function Topology({ data, xs, ys }: LayerProps) {
  // Crescent-hugging blobs, not convex hulls: hulls of the two
  // interlocking moons overlap, which would contradict the "two
  // separate components" reading even at glyph size.
  const { h0, h1 } = useMemo(() => {
    const c0 = data.filter((d) => d.c === 0)
    const c1 = data.filter((d) => d.c === 1)
    return {
      h0: crescentOutline(c0, xs, ys, 3.5),
      h1: crescentOutline(c1, xs, ys, 3.5),
    }
  }, [data, xs, ys])
  const line = d3.line().curve(d3.curveCatmullRomClosed)
  return (
    <g>
      <path
        d={line(h0) ?? ''}
        fill="var(--accent-light)"
        stroke="var(--accent)"
        strokeWidth={0.8}
        opacity={0.85}
      />
      <path
        d={line(h1) ?? ''}
        fill="var(--warm-light)"
        stroke="var(--warm)"
        strokeWidth={0.8}
        opacity={0.85}
      />
    </g>
  )
}
