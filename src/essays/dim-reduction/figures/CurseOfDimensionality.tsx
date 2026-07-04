import { useEffect, useMemo, useRef, useState } from 'react'
import * as d3 from 'd3'
import type { FigureProps } from './registry'
import { num } from '../../runtime/lib/params'

// Pairwise distance histogram for a uniform random cloud in d dimensions.
// As d grows, the histogram narrows and the max/min distance ratio
// approaches 1 — the "concentration of distances" piece of the curse of
// dimensionality.
//
// The y-axis is the *share* of pairs per bin and is held fixed at the
// most-concentrated case (d = dMax), so sweeping the dimension reads as
// a wide, low mound marching into a tall, narrow spike — the bars
// animate between positions rather than snapping, and a "sweep" button
// plays the whole 1 → dMax journey.

// Tweakable surface. Override per-instance from markdown:
//   :::figure{id=curse-of-dimensionality d=20 n=300}
export const DEFAULTS = {
  d: 2, // initial dimension slider value (1..dMax)
  n: 200, // initial point-count slider value (50–500, step 50)
  dMax: 50, // upper end of the dimension slider
  seed: 42, // PRNG seed for the uniform point cloud
  bins: 40, // histogram bin count over normalized distance [0, 1]
}

// Knob-panel bounds: d and n mirror the reader-facing sliders (d >= 1,
// n capped at 500 — the heuristic's n max of 5000 makes the O(n²)
// pairwise pass crawl); dMax needs a floor > 1; 500 bins over a 680px
// plot is noise, so cap bins at 100.
export const PARAM_HINTS = {
  d: { min: 1, max: 50, step: 1 },
  n: { min: 50, max: 500, step: 50 },
  dMax: { min: 2, max: 200, step: 1 },
  bins: { min: 5, max: 100, step: 1 },
}

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function sample(n: number, d: number, rng: () => number) {
  const pts: Float64Array[] = []
  for (let i = 0; i < n; i++) {
    const p = new Float64Array(d)
    for (let j = 0; j < d; j++) p[j] = rng()
    pts.push(p)
  }
  return pts
}

function pairwise(pts: Float64Array[]) {
  const n = pts.length
  const d = pts[0].length
  const out: number[] = []
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      let s = 0
      for (let k = 0; k < d; k++) {
        const x = pts[i][k] - pts[j][k]
        s += x * x
      }
      out.push(Math.sqrt(s))
    }
  }
  return out
}

// Normalized-distance histogram (shares, not counts) for a fresh cloud
// at dimension d. Shares make the y-axis comparable across d and n.
function histogram(n: number, d: number, seed: number, binCount: number) {
  const rng = mulberry32(seed)
  const pts = sample(n, d, rng)
  const dists = pairwise(pts)
  const theoMax = Math.sqrt(d)
  const norm = dists.map((x) => x / theoMax)
  const bins = d3.bin().domain([0, 1]).thresholds(binCount)(norm)
  const total = Math.max(1, norm.length)
  const minD = d3.min(norm) ?? 0
  const maxD = d3.max(norm) ?? 1
  return {
    bins: bins.map((b) => ({
      x0: b.x0 ?? 0,
      x1: b.x1 ?? 0,
      frac: b.length / total,
    })),
    ratio: maxD / Math.max(minD, 1e-9),
  }
}

const SWEEP_STEP_MS = 110 // dwell per dimension while sweeping
const BAR_TRANSITION_MS = 140 // bar morph between histogram states

export default function CurseOfDimensionality(props: FigureProps) {
  const d0 = num(props.d, DEFAULTS.d)
  const n0 = num(props.n, DEFAULTS.n)
  const dMax = num(props.dMax, DEFAULTS.dMax)
  const seed = num(props.seed, DEFAULTS.seed)
  const binCount = num(props.bins, DEFAULTS.bins)

  const [d, setD] = useState(d0)
  const [n, setN] = useState(n0)
  const [sweeping, setSweeping] = useState(false)
  // Follow live param changes (knob panel, markdown edit) — the reader's
  // own slider moves still win until the params change again.
  useEffect(() => {
    setD(d0)
    setSweeping(false)
  }, [d0])
  useEffect(() => setN(n0), [n0])
  const svgRef = useRef<SVGSVGElement>(null)
  const scaffoldRef = useRef<{
    barsG: d3.Selection<SVGGElement, unknown, null, undefined>
    ratioText: d3.Selection<SVGTextElement, unknown, null, undefined>
    xScale: d3.ScaleLinear<number, number>
    yScale: d3.ScaleLinear<number, number>
    innerH: number
  } | null>(null)

  const reduceMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches

  const { bins, ratio } = useMemo(
    () => histogram(n, d, seed, binCount),
    [d, n, seed, binCount],
  )

  // Fixed y ceiling: the tallest bar the sweep will ever produce is at
  // d = dMax (the most concentrated distribution). Locking the axis to
  // it means growing d visibly *raises* the spike instead of the axis
  // quietly rescaling away the drama.
  const yCeil = useMemo(() => {
    const peak = d3.max(histogram(n, dMax, seed, binCount).bins, (b) => b.frac) ?? 0.1
    return peak * 1.08
  }, [n, dMax, seed, binCount])

  // Sweep playback: march d from wherever it is up to dMax, one
  // dimension per tick. Pressing sweep at d = dMax restarts from 1.
  useEffect(() => {
    if (!sweeping) return
    if (reduceMotion) {
      // No animation: jump straight to the punchline.
      setD(dMax)
      setSweeping(false)
      return
    }
    const id = window.setInterval(
      () => setD((prev) => Math.min(dMax, prev + 1)),
      SWEEP_STEP_MS,
    )
    return () => window.clearInterval(id)
  }, [sweeping, dMax, reduceMotion])
  useEffect(() => {
    if (sweeping && d >= dMax) setSweeping(false)
  }, [d, dMax, sweeping])

  // Static scaffold: axes, labels, bar + readout containers. Rebuilt only
  // when the scales change (yCeil), never per-slider-step, so the bars
  // can transition smoothly between histogram states.
  useEffect(() => {
    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()
    const W = 680
    const H = 320
    const margin = { top: 20, right: 24, bottom: 44, left: 48 }
    const innerW = W - margin.left - margin.right
    const innerH = H - margin.top - margin.bottom
    const g = svg
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`)

    const xScale = d3.scaleLinear().domain([0, 1]).range([0, innerW])
    const yScale = d3.scaleLinear().domain([0, yCeil]).range([innerH, 0])

    g.append('g')
      .attr('class', 'axis')
      .attr('transform', `translate(0,${innerH})`)
      .call(d3.axisBottom(xScale).ticks(6))
    g.append('g')
      .attr('class', 'axis')
      .call(d3.axisLeft(yScale).ticks(5, '.0%'))

    g.append('text')
      .attr('class', 'axis-label')
      .attr('x', innerW / 2)
      .attr('y', innerH + 36)
      .attr('text-anchor', 'middle')
      .text('pairwise distance (normalized)')

    g.append('text')
      .attr('class', 'axis-label')
      .attr('transform', 'rotate(-90)')
      .attr('x', -innerH / 2)
      .attr('y', -34)
      .attr('text-anchor', 'middle')
      .text('share of pairs')

    const barsG = g.append('g')

    const ratioText = g
      .append('text')
      .attr('x', innerW - 8)
      .attr('y', 14)
      .attr('text-anchor', 'end')
      .attr('fill', 'var(--text-2)')
      .style('font-size', '12px')
      .style('font-family', 'var(--heading-font)')

    scaffoldRef.current = { barsG, ratioText, xScale, yScale, innerH }
  }, [yCeil])

  // Bars + readout: keyed join with a short transition so dragging the
  // slider (or running the sweep) reads as the distribution *moving* —
  // narrowing and rising — rather than flickering between snapshots.
  useEffect(() => {
    const sc = scaffoldRef.current
    if (!sc) return
    const { barsG, ratioText, xScale, yScale, innerH } = sc
    const dur = reduceMotion ? 0 : BAR_TRANSITION_MS

    barsG
      .selectAll<SVGRectElement, (typeof bins)[number]>('rect')
      .data(bins, (_, i) => i)
      .join(
        (enter) =>
          enter
            .append('rect')
            .attr('x', (b) => xScale(b.x0) + 1)
            .attr('width', (b) => Math.max(0, xScale(b.x1) - xScale(b.x0) - 1))
            .attr('y', innerH)
            .attr('height', 0)
            .attr('fill', 'var(--accent)')
            .attr('opacity', 0.85),
        (update) => update,
        (exit) => exit.remove(),
      )
      .transition()
      .duration(dur)
      .ease(d3.easeLinear)
      .attr('x', (b) => xScale(b.x0) + 1)
      .attr('width', (b) => Math.max(0, xScale(b.x1) - xScale(b.x0) - 1))
      .attr('y', (b) => yScale(Math.min(b.frac, yScale.domain()[1])))
      .attr('height', (b) => innerH - yScale(Math.min(b.frac, yScale.domain()[1])))

    ratioText.text(`max / min = ${ratio.toFixed(2)}`)
  }, [bins, ratio, yCeil, reduceMotion])

  return (
    <div>
      <div className="controls">
        <label>
          dimension <span className="value">{d}</span>
          <input
            type="range"
            min={1}
            max={dMax}
            step={1}
            value={d}
            onChange={(e) => {
              setSweeping(false)
              setD(+e.target.value)
            }}
          />
        </label>
        <label>
          points <span className="value">{n}</span>
          <input
            type="range"
            min={50}
            max={500}
            step={50}
            value={n}
            onChange={(e) => setN(+e.target.value)}
          />
        </label>
        <div className="toggle-group">
          <button
            type="button"
            className={sweeping ? 'active' : ''}
            onClick={() => {
              if (sweeping) {
                setSweeping(false)
              } else {
                if (d >= dMax) setD(1)
                setSweeping(true)
              }
            }}
          >
            {sweeping ? 'sweeping…' : `▶ sweep 1 → ${dMax}`}
          </button>
        </div>
      </div>
      <svg
        ref={svgRef}
        width="100%"
        height={320}
        viewBox="0 0 680 320"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="Histogram of pairwise distances between uniform random points; as the dimension slider increases the distribution narrows and rises into a spike and max/min approaches 1."
      />
    </div>
  )
}
