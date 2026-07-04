import { useEffect, useMemo, useRef, useState } from 'react'
import * as d3 from 'd3'
import type { FigureProps } from './registry'
import { num, str } from '../../runtime/lib/params'
import { useFigureHighlight } from '../../runtime/store'

// Faithful React ports of the four figures from docs/dim-reduction/02-linear.html
// (PCA, ICA, NMF, random projection), plus a kernel-PCA figure that has no
// counterpart in the original article. The geometry, seeded data, controls,
// dimensions, labels, and visual encodings follow the original D3/HTML
// figures closely, while using React state instead of direct DOM mutation.

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

function eig2x2(a: number, b: number, c: number, d: number) {
  const tr = a + d
  const det = a * d - b * c
  const disc = Math.sqrt(Math.max(0, (tr * tr) / 4 - det))
  const l1 = tr / 2 + disc
  const l2 = tr / 2 - disc
  let v1: [number, number]
  let v2: [number, number]
  if (Math.abs(b) > 1e-10) {
    v1 = [l1 - d, b]
    v2 = [l2 - d, b]
  } else {
    v1 = a >= d ? [1, 0] : [0, 1]
    v2 = a >= d ? [0, 1] : [1, 0]
  }
  const n1 = Math.hypot(v1[0], v1[1]) || 1
  const n2 = Math.hypot(v2[0], v2[1]) || 1
  v1 = [v1[0] / n1, v1[1] / n1]
  v2 = [v2[0] / n2, v2[1] / n2]
  return { l1, l2, v1, v2 }
}

function ControlSlider({
  label,
  title,
  value,
  min,
  max,
  step,
  onChange,
  format,
}: {
  label: string
  title?: string
  value: number
  min: number
  max: number
  step: number
  onChange: (v: number) => void
  format: (v: number) => string
}) {
  return (
    <label>
      <span style={title ? { cursor: 'help' } : undefined} title={title}>{label}</span>
      <span className="value">{format(value)}</span>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        step={step}
        onChange={(e) => onChange(+e.currentTarget.value)}
      />
    </label>
  )
}

function AxisBottom({ scale, y, ticks = 6 }: { scale: d3.ScaleLinear<number, number>; y: number; ticks?: number }) {
  return (
    <g className="axis" transform={`translate(0,${y})`}>
      <line x1={scale.range()[0]} x2={scale.range()[1]} y1={0} y2={0} stroke="var(--border-2)" />
      {scale.ticks(ticks).map((t) => (
        <g key={t} transform={`translate(${scale(t)},0)`}>
          <line y1={0} y2={4} stroke="var(--border-2)" />
          <text y={16} textAnchor="middle" fontSize={11} fill="var(--text-2)">{formatTick(t)}</text>
        </g>
      ))}
    </g>
  )
}

function AxisLeft({ scale, x, ticks = 5 }: { scale: d3.ScaleLinear<number, number>; x: number; ticks?: number }) {
  return (
    <g className="axis" transform={`translate(${x},0)`}>
      <line x1={0} x2={0} y1={scale.range()[0]} y2={scale.range()[1]} stroke="var(--border-2)" />
      {scale.ticks(ticks).map((t) => (
        <g key={t} transform={`translate(0,${scale(t)})`}>
          <line x1={-4} x2={0} stroke="var(--border-2)" />
          <text x={-7} dy="0.32em" textAnchor="end" fontSize={11} fill="var(--text-2)">{formatTick(t)}</text>
        </g>
      ))}
    </g>
  )
}

function formatTick(x: number) {
  return Math.abs(x) < 1e-9 ? '0' : Number.isInteger(x) ? String(x) : x.toFixed(1)
}

// ---------- Figure 1: PCA interactive ----------

// Tweakable surface — override per-instance in markdown: :::figure{id=pca rho=0.9}
export const PCA_DEFAULTS = {
  rho: 0.6, // initial correlation slider value, in [-0.95, 0.95]
  aniso: 2, // initial anisotropy slider value (σx/σy ratio), in [1, 6]
  n: 80, // number of sample points in the cloud
  seed: 1, // rng seed for the cloud ("regenerate" steps it by 1)
}

// Knob bounds matching the reader-facing sliders: rho is a correlation
// (heuristic would offer [0, 5]) and aniso is a σ-ratio shown in [1, 6].
export const PCA_HINTS = {
  rho: { min: -0.95, max: 0.95, step: 0.01 },
  aniso: { min: 1, max: 6, step: 0.1 },
}

export function PCAFigure(props: FigureProps) {
  const rho0 = num(props.rho, PCA_DEFAULTS.rho)
  const aniso0 = num(props.aniso, PCA_DEFAULTS.aniso)
  const n = num(props.n, PCA_DEFAULTS.n)
  const seed0 = num(props.seed, PCA_DEFAULTS.seed)
  const [rho, setRho] = useState(rho0)
  const [aniso, setAniso] = useState(aniso0)
  const [seedCounter, setSeedCounter] = useState(seed0)
  // Follow live knob-panel / markdown changes; reader interaction still wins
  // until the params change again.
  useEffect(() => setRho(rho0), [rho0])
  useEffect(() => setAniso(aniso0), [aniso0])
  useEffect(() => setSeedCounter(seed0), [seed0])
  const { activePart } = useFigureHighlight(props.figureId as string)
  const dim = (part: string) => (activePart && activePart !== part ? 0.3 : 1)

  const W = 680
  const H = 360
  const margin = { top: 20, right: 24, bottom: 36, left: 40 }
  const innerW = W - margin.left - margin.right
  const innerH = H - margin.top - margin.bottom
  const pxPerUnit = Math.min(innerW / 10, innerH / 6)
  const x = d3.scaleLinear([-innerW / (2 * pxPerUnit), innerW / (2 * pxPerUnit)], [0, innerW])
  const y = d3.scaleLinear([-innerH / (2 * pxPerUnit), innerH / (2 * pxPerUnit)], [innerH, 0])

  const { points, stats } = useMemo(() => {
    const sx = aniso
    const sy = 1
    const rng = mulberry32(seedCounter)
    const points = Array.from({ length: n }, () => {
      const z1 = gaussian(rng)
      const z2 = gaussian(rng)
      const px = sx * z1
      const py = rho * sy * z1 + Math.sqrt(Math.max(0, 1 - rho * rho)) * sy * z2
      return { x: px, y: py }
    })

    const mx = d3.mean(points, (d) => d.x) ?? 0
    const my = d3.mean(points, (d) => d.y) ?? 0
    let cxx = 0
    let cyy = 0
    let cxy = 0
    for (const p of points) {
      cxx += (p.x - mx) ** 2
      cyy += (p.y - my) ** 2
      cxy += (p.x - mx) * (p.y - my)
    }
    cxx /= n - 1
    cyy /= n - 1
    cxy /= n - 1
    const eig = eig2x2(cxx, cxy, cxy, cyy)
    return { points, stats: { mx, my, ...eig } }
  }, [rho, aniso, seedCounter, n])

  const cx = x(stats.mx)
  const cy = y(stats.my)
  const s1 = Math.sqrt(stats.l1) * pxPerUnit
  const s2 = Math.sqrt(stats.l2) * pxPerUnit
  const tot = stats.l1 + stats.l2
  const f1 = stats.l1 / tot
  const f2 = stats.l2 / tot

  return (
    <div>
      <div className="controls">
        <ControlSlider label="correlation" title="How strongly the two coordinates move together" value={rho} min={-0.95} max={0.95} step={0.01} onChange={setRho} format={(v) => v.toFixed(2)} />
        <ControlSlider label="anisotropy" title="How stretched the cloud is: ratio of spread along x vs y" value={aniso} min={1} max={6} step={0.1} onChange={setAniso} format={(v) => v.toFixed(1)} />
        <button className="figure-button" type="button" onClick={() => setSeedCounter((s) => s + 1)}>regenerate</button>
      </div>
      <svg width="100%" height={360} viewBox="0 0 680 360" preserveAspectRatio="xMidYMid meet">
        <g transform={`translate(${margin.left},${margin.top})`}>
          <AxisBottom scale={x} y={innerH / 2} ticks={6} />
          <AxisLeft scale={y} x={innerW / 2} ticks={5} />
          {points.map((p, i) => <circle key={i} cx={x(p.x)} cy={y(p.y)} r={3.5} fill="var(--text-2)" opacity={0.6} />)}
          <g opacity={dim('pc1')}>
            <PCLine cx={cx} cy={cy} v={stats.v1} s={s1} color="var(--accent)" width={activePart === 'pc1' ? 4 : 3} label="PC1" />
          </g>
          <g opacity={dim('pc2')}>
            <PCLine cx={cx} cy={cy} v={stats.v2} s={s2} color="var(--warm)" width={activePart === 'pc2' ? 4 : 2.5} label="PC2" />
          </g>
        </g>
      </svg>
      <div style={{ opacity: dim('pc1') }}>
        <VarianceBar label="explained variance" name="PC1" frac={f1} color="var(--accent)" />
      </div>
      <div style={{ opacity: dim('pc2') }}>
        <VarianceBar label="" name="PC2" frac={f2} color="var(--warm)" />
      </div>
    </div>
  )
}

function PCLine({ cx, cy, v, s, color, width, label }: { cx: number; cy: number; v: [number, number]; s: number; color: string; width: number; label: string }) {
  const x1 = cx - v[0] * s * 1.8
  const y1 = cy + v[1] * s * 1.8
  const x2 = cx + v[0] * s * 1.8
  const y2 = cy - v[1] * s * 1.8
  return (
    <g>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth={width} strokeLinecap="round" />
      <text x={x2 + v[0] * 14} y={y2 - v[1] * 14} textAnchor="middle" dy="0.35em" fill={color} style={{ fontWeight: 700, fontSize: 13 }}>{label}</text>
    </g>
  )
}

function VarianceBar({ label, name, frac, color }: { label: string; name: string; frac: number; color: string }) {
  return (
    <div className="stat-bar">
      <div style={{ minWidth: 110 }}>{label}</div>
      <div className="bar-bg"><div className="bar-fill" style={{ width: `${frac * 100}%`, background: color }} /></div>
      <div style={{ minWidth: 52, textAlign: 'right' }} className="value">{name} {(frac * 100).toFixed(0)}%</div>
    </div>
  )
}

// ---------- Figure 2: ICA vs PCA ----------

type IcaView = 'sources' | 'mixed' | 'pca' | 'ica'

const ICA_VIEWS: IcaView[] = ['sources', 'mixed', 'pca', 'ica']

// Tweakable surface — override per-instance in markdown: :::figure{id=ica view=ica}
export const ICA_DEFAULTS = {
  view: 'sources', // initial toggle: sources | mixed | pca | ica
  T: 300, // samples per signal
  sawPeriod: 50, // sawtooth period (samples)
  squarePeriod: 16, // square-wave sine divisor (samples per radian)
  // Mixing matrix chosen so both observations AND both principal components
  // stay visibly mixed (every output correlates with both sources), while
  // the kurtosis search still unmixes almost perfectly.
  mix11: 1, // mixing matrix A row 1: obs1 = mix11·sawtooth + mix12·square
  mix12: 0.6,
  mix21: -1.2, // mixing matrix A row 2: obs2 = mix21·sawtooth + mix22·square
  mix22: 1,
}

// Knob bounds for keys the heuristic gets wrong: signal lengths/periods
// need floors (period 0 divides by zero), and mixing-matrix entries are
// meaningfully negative while the heuristic pins min at 0.
export const ICA_HINTS = {
  T: { min: 50, max: 1000, step: 10 },
  sawPeriod: { min: 4, max: 150 },
  squarePeriod: { min: 2, max: 80 },
  mix11: { min: -3, max: 3, step: 0.05 },
  mix12: { min: -3, max: 3, step: 0.05 },
  mix21: { min: -3, max: 3, step: 0.05 },
  mix22: { min: -3, max: 3, step: 0.05 },
}

export function ICAFigure(props: FigureProps) {
  const viewRaw = str(props.view, ICA_DEFAULTS.view)
  const view0 = (ICA_VIEWS as string[]).includes(viewRaw) ? (viewRaw as IcaView) : 'sources'
  const T = num(props.T, ICA_DEFAULTS.T)
  const sawPeriod = num(props.sawPeriod, ICA_DEFAULTS.sawPeriod)
  const squarePeriod = num(props.squarePeriod, ICA_DEFAULTS.squarePeriod)
  const mix11 = num(props.mix11, ICA_DEFAULTS.mix11)
  const mix12 = num(props.mix12, ICA_DEFAULTS.mix12)
  const mix21 = num(props.mix21, ICA_DEFAULTS.mix21)
  const mix22 = num(props.mix22, ICA_DEFAULTS.mix22)
  const [chosenKey, setChosenKey] = useState<IcaView>(view0)
  useEffect(() => setChosenKey(view0), [view0])
  const { activePart } = useFigureHighlight(props.figureId as string)
  // A term reference like ica.pca temporarily shows that view; the reader's
  // own toggle choice returns when the highlight clears.
  const viewKey = activePart && (ICA_VIEWS as string[]).includes(activePart)
    ? (activePart as IcaView)
    : chosenKey
  const data = useMemo(
    () => buildIcaData(T, sawPeriod, squarePeriod, [[mix11, mix12], [mix21, mix22]]),
    [T, sawPeriod, squarePeriod, mix11, mix12, mix21, mix22],
  )
  const view = data.views[viewKey]

  const W = 680
  const H = 300
  const margin = { top: 16, right: 24, bottom: 28, left: 40 }
  const innerW = W - margin.left - margin.right
  const innerH = H - margin.top - margin.bottom
  const xScale = d3.scaleLinear([0, data.T - 1], [0, innerW])
  const yScale = d3.scaleLinear([-4, 4], [innerH / 2 - 8, 0])
  const yScale2 = d3.scaleLinear([-4, 4], [innerH, innerH / 2 + 8])
  const lineA = d3.line<number>().x((_, i) => xScale(i)).y((d) => yScale(d))
  const lineB = d3.line<number>().x((_, i) => xScale(i)).y((d) => yScale2(d))
  // Morph the waveforms between views so e.g. mixtures → ICA reads as the
  // signals visibly "unmixing" rather than a snap swap.
  const target = useMemo(
    () => ({ a: normalizeSignal(view.a), b: normalizeSignal(view.b) }),
    [view],
  )
  const { a, b } = useAnimatedSignals(target)

  const buttons: { key: IcaView; label: string }[] = [
    { key: 'sources', label: 'original sources' },
    { key: 'mixed', label: 'observed mixtures' },
    { key: 'pca', label: 'PCA recovery' },
    { key: 'ica', label: 'ICA recovery' },
  ]

  return (
    <div>
      <div className="controls">
        <div className="toggle-group">
          {buttons.map((button) => (
            <button key={button.key} type="button" className={viewKey === button.key ? 'active' : ''} onClick={() => setChosenKey(button.key)}>{button.label}</button>
          ))}
        </div>
      </div>
      <svg width="100%" height={300} viewBox="0 0 680 300" preserveAspectRatio="xMidYMid meet">
        <g transform={`translate(${margin.left},${margin.top})`}>
          <text x={4} y={10} style={{ fontSize: 11 }} fill="var(--accent)">{view.labA}</text>
          <text x={4} y={innerH / 2 + 18} style={{ fontSize: 11 }} fill="var(--warm)">{view.labB}</text>
          <path d={lineA(a) ?? ''} fill="none" stroke="var(--accent)" strokeWidth={1.6} />
          <path d={lineB(b) ?? ''} fill="none" stroke="var(--warm)" strokeWidth={1.6} />
          <line x1={0} x2={innerW} y1={innerH / 2} y2={innerH / 2} stroke="var(--border)" strokeDasharray="2 3" />
        </g>
      </svg>
    </div>
  )
}

// Tween a pair of equal-length signals toward their target whenever the
// target changes (i.e. on a view toggle). Skips straight to the end state
// when the user prefers reduced motion or the signal length changes.
function useAnimatedSignals(target: { a: number[]; b: number[] }) {
  const [disp, setDisp] = useState(target)
  const dispRef = useRef(disp)
  dispRef.current = disp
  const prevTarget = useRef(target)
  const rafRef = useRef(0)
  useEffect(() => {
    if (prevTarget.current === target) return
    prevTarget.current = target
    cancelAnimationFrame(rafRef.current)
    const from = dispRef.current
    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced || from.a.length !== target.a.length) {
      setDisp(target)
      return
    }
    const D = 800
    const t0 = performance.now()
    const tick = (now: number) => {
      const u = Math.min(1, (now - t0) / D)
      const e = d3.easeCubicInOut(u)
      setDisp(
        u >= 1
          ? target
          : {
              a: target.a.map((v, i) => from.a[i] + (v - from.a[i]) * e),
              b: target.b.map((v, i) => from.b[i] + (v - from.b[i]) * e),
            },
      )
      if (u < 1) rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [target])
  return disp
}

function buildIcaData(T: number, sawPeriod: number, squarePeriod: number, A: number[][]) {
  const t = d3.range(T)
  const s1 = t.map((i) => {
    const phase = (i / sawPeriod) % 1
    return 2 * phase - 1
  })
  const s2 = t.map((i) => {
    const phase = Math.sin(i / squarePeriod)
    return phase > 0 ? 0.8 : -0.8
  })
  const x1 = t.map((i) => A[0][0] * s1[i] + A[0][1] * s2[i])
  const x2 = t.map((i) => A[1][0] * s1[i] + A[1][1] * s2[i])

  const mx1 = d3.mean(x1) ?? 0
  const mx2 = d3.mean(x2) ?? 0
  let cxx = 0
  let cyy = 0
  let cxy = 0
  for (let i = 0; i < T; i++) {
    cxx += (x1[i] - mx1) ** 2
    cyy += (x2[i] - mx2) ** 2
    cxy += (x1[i] - mx1) * (x2[i] - mx2)
  }
  cxx /= T - 1
  cyy /= T - 1
  cxy /= T - 1
  const { v1, v2, l1, l2 } = eig2x2(cxx, cxy, cxy, cyy)
  const pca1 = t.map((i) => v1[0] * (x1[i] - mx1) + v1[1] * (x2[i] - mx2))
  const pca2 = t.map((i) => v2[0] * (x1[i] - mx1) + v2[1] * (x2[i] - mx2))
  const wh1 = t.map((i) => (v1[0] * (x1[i] - mx1) + v1[1] * (x2[i] - mx2)) / Math.sqrt(l1))
  const wh2 = t.map((i) => (v2[0] * (x1[i] - mx1) + v2[1] * (x2[i] - mx2)) / Math.sqrt(l2))

  let bestTheta = 0
  let bestScore = -Infinity
  for (let th = 0; th < Math.PI; th += Math.PI / 180) {
    const p = wh1.map((_, i) => Math.cos(th) * wh1[i] + Math.sin(th) * wh2[i])
    const s = Math.abs(kurtosis(p))
    if (s > bestScore) {
      bestScore = s
      bestTheta = th
    }
  }
  let ica1 = wh1.map((_, i) => Math.cos(bestTheta) * wh1[i] + Math.sin(bestTheta) * wh2[i])
  let ica2 = wh1.map((_, i) => -Math.sin(bestTheta) * wh1[i] + Math.cos(bestTheta) * wh2[i])

  // ICA is blind to permutation and sign, so align the recovered components
  // with the true sources for display: recovered A should be the sawtooth,
  // recovered B the square, each with matching polarity.
  const signalCorr = (p: number[], q: number[]) => {
    const mp = d3.mean(p) ?? 0
    const mq = d3.mean(q) ?? 0
    let n = 0
    let dp = 0
    let dq = 0
    for (let i = 0; i < p.length; i++) {
      n += (p[i] - mp) * (q[i] - mq)
      dp += (p[i] - mp) ** 2
      dq += (q[i] - mq) ** 2
    }
    return n / (Math.sqrt(dp * dq) || 1)
  }
  const c11 = signalCorr(ica1, s1)
  const c21 = signalCorr(ica2, s1)
  if (Math.abs(c21) > Math.abs(c11)) [ica1, ica2] = [ica2, ica1]
  if (signalCorr(ica1, s1) < 0) ica1 = ica1.map((v) => -v)
  if (signalCorr(ica2, s2) < 0) ica2 = ica2.map((v) => -v)

  return {
    T,
    views: {
      sources: { a: s1, b: s2, labA: 'source A (sawtooth)', labB: 'source B (square)' },
      mixed: { a: x1, b: x2, labA: 'observation 1', labB: 'observation 2' },
      pca: { a: pca1, b: pca2, labA: 'PC1 (still mixed)', labB: 'PC2 (still mixed)' },
      ica: { a: ica1, b: ica2, labA: 'recovered source A (sawtooth)', labB: 'recovered source B (square)' },
    },
  }
}

function kurtosis(arr: number[]) {
  const m = d3.mean(arr) ?? 0
  let m2 = 0
  let m4 = 0
  for (const a of arr) {
    m2 += (a - m) ** 2
    m4 += (a - m) ** 4
  }
  m2 /= arr.length
  m4 /= arr.length
  return m4 / (m2 * m2) - 3
}

function normalizeSignal(arr: number[]) {
  const ex = d3.extent(arr) as [number, number]
  const m = Math.max(Math.abs(ex[0]), Math.abs(ex[1])) || 1
  return arr.map((a) => (a / m) * 3)
}

// ---------- Figure 3: NMF ----------

// Tweakable surface — override per-instance in markdown: :::figure{id=nmf rank=2}
export const NMF_DEFAULTS = {
  rank: 4, // initial rank slider value (true number of parts is 4), in [1, 8]
  samples: 12, // number of synthetic sample images in the top row
  iters: 300, // NMF multiplicative-update iterations per restart
  seed: 2, // rng seed for sample weights and factor init
}

// Knob bounds where the heuristic overshoots: rank matches the reader
// slider [1, 8]; samples beyond ~24 shrink to invisible cells in the
// 680px row; iters past ~1000 just lag the multiplicative updates.
export const NMF_HINTS = {
  rank: { min: 1, max: 8, step: 1 },
  samples: { min: 2, max: 24 },
  iters: { min: 10, max: 1000 },
}

export function NMFFigure(props: FigureProps) {
  const rank0 = num(props.rank, NMF_DEFAULTS.rank)
  const nSamples = num(props.samples, NMF_DEFAULTS.samples)
  const iters = num(props.iters, NMF_DEFAULTS.iters)
  const seed = num(props.seed, NMF_DEFAULTS.seed)
  const [rank, setRank] = useState(rank0)
  useEffect(() => setRank(rank0), [rank0])
  const { activePart } = useFigureHighlight(props.figureId as string)
  const dim = (part: string) => (activePart && activePart !== part ? 0.3 : 1)
  const model = useMemo(() => buildNmfBase(nSamples, seed), [nSamples, seed])
  const { parts, relErr } = useMemo(() => {
    // A handful of restarts keeps the figure honest: a single unlucky init
    // can land in a mixed local optimum even at the true rank.
    const best = nmfBest(model.samples, rank, iters, seed + rank * 10, 4)
    const ordered = orderPartsByMatch(best.H, model.trueParts)
    return {
      parts: ordered.map((row) => {
        const maxV = d3.max(row) ?? 1
        return row.map((v) => v / (maxV + 1e-9))
      }),
      relErr: best.relErr,
    }
  }, [model, rank, iters, seed])

  const W = 680
  const partSize = 8
  const gap = 12
  // Shrink the cells when needed so all samples fit inside the 680px
  // viewBox (the original article clipped the outer samples at 12×8px).
  const cellS = Math.min(8, (W - 32 - (nSamples - 1) * gap) / (nSamples * partSize))
  const sampleW = partSize * cellS
  const totalW = nSamples * sampleW + (nSamples - 1) * gap
  const startX = (W - totalW) / 2
  const pGap = 18
  const pCell = Math.min(12, (W - 32 - (rank - 1) * pGap) / (rank * partSize))
  const pW = partSize * pCell
  const pTotalW = rank * pW + (rank - 1) * pGap
  const pStartX = (W - pTotalW) / 2

  const tCell = 8
  const tW = partSize * tCell
  const tGap = 18
  const tTotalW = model.trueParts.length * tW + (model.trueParts.length - 1) * tGap
  const tStartX = (W - tTotalW) / 2

  return (
    <div>
      <div className="controls">
        <ControlSlider label="rank" value={rank} min={1} max={8} step={1} onChange={setRank} format={(v) => String(v)} />
        <span style={{ fontSize: '0.8rem', color: 'var(--text-3)' }}>
          reconstruction error <span className="value" style={{ color: 'var(--text)' }}>{(relErr * 100).toFixed(1)}%</span>
        </span>
      </div>
      <svg width="100%" height={350} viewBox="0 0 680 350" preserveAspectRatio="xMidYMid meet">
        <g opacity={dim('samples')}>
          <text x={20} y={14} style={{ fontSize: 12, fontWeight: 600 }} fill="var(--text-2)">synthetic samples (sums of parts with random positive weights)</text>
          {model.samples.map((sample, i) => <Patch key={i} data={sample} x={startX + i * (sampleW + gap)} y={22} cellSize={cellS} colorMax={2.5} />)}
        </g>
        <g opacity={dim('true')}>
          <text x={20} y={116} style={{ fontSize: 12, fontWeight: 600 }} fill="var(--text-2)">true parts (used to build the samples):</text>
          {model.trueParts.map((part, i) => (
            <Patch key={i} data={part} x={tStartX + i * (tW + tGap)} y={124} cellSize={tCell} colorMax={1} />
          ))}
        </g>
        <g opacity={dim('parts')}>
          <text x={20} y={218} style={{ fontSize: 12, fontWeight: 600 }} fill="var(--text-2)">NMF-recovered parts:</text>
          {parts.map((part, i) => (
            <g key={i}>
              <Patch data={part} x={pStartX + i * (pW + pGap)} y={226} cellSize={pCell} colorMax={1} />
              <text x={pStartX + i * (pW + pGap) + pW / 2} y={226 + pW + 16} textAnchor="middle" style={{ fontSize: 10 }} fill="var(--text-3)">part {i + 1}</text>
            </g>
          ))}
        </g>
      </svg>
    </div>
  )
}

function buildNmfBase(nSamples: number, seed: number) {
  const partSize = 8
  const trueParts = [
    Array.from({ length: partSize * partSize }, (_, i) => {
      const r = Math.floor(i / partSize)
      return r === 2 || r === 3 ? 1 : 0
    }),
    Array.from({ length: partSize * partSize }, (_, i) => {
      const c = i % partSize
      return c === 5 || c === 6 ? 1 : 0
    }),
    Array.from({ length: partSize * partSize }, (_, i) => {
      const r = Math.floor(i / partSize)
      const c = i % partSize
      return r < 3 && c < 3 ? 1 : 0
    }),
    Array.from({ length: partSize * partSize }, (_, i) => {
      const r = Math.floor(i / partSize)
      const c = i % partSize
      return r > 4 && c > 4 ? 1 : 0
    }),
  ]
  const rng = mulberry32(seed)
  const N = nSamples
  const samples: number[][] = []
  for (let i = 0; i < N; i++) {
    const c = trueParts.map(() => rng() * 0.9 + 0.1)
    const img = new Array(partSize * partSize).fill(0)
    for (let k = 0; k < trueParts.length; k++) {
      for (let j = 0; j < img.length; j++) img[j] += c[k] * trueParts[k][j]
    }
    samples.push(img)
  }
  return { trueParts, samples }
}

function nmf(V: number[][], k: number, iters = 150, seed = 1) {
  const rng = mulberry32(seed)
  const n = V.length
  const m = V[0].length
  const Wm = Array.from({ length: n }, () => Array.from({ length: k }, () => rng() * 0.5 + 0.1))
  const H = Array.from({ length: k }, () => Array.from({ length: m }, () => rng() * 0.5 + 0.1))
  const EPS = 1e-9
  for (let it = 0; it < iters; it++) {
    const WTV = Array.from({ length: k }, () => new Array(m).fill(0))
    for (let a = 0; a < k; a++) for (let b = 0; b < m; b++) for (let i = 0; i < n; i++) WTV[a][b] += Wm[i][a] * V[i][b]
    const WTW = Array.from({ length: k }, () => new Array(k).fill(0))
    for (let a = 0; a < k; a++) for (let b = 0; b < k; b++) for (let i = 0; i < n; i++) WTW[a][b] += Wm[i][a] * Wm[i][b]
    const WTWH = Array.from({ length: k }, () => new Array(m).fill(0))
    for (let a = 0; a < k; a++) for (let b = 0; b < m; b++) for (let c = 0; c < k; c++) WTWH[a][b] += WTW[a][c] * H[c][b]
    for (let a = 0; a < k; a++) for (let b = 0; b < m; b++) H[a][b] = (H[a][b] * WTV[a][b]) / (WTWH[a][b] + EPS)

    const VHT = Array.from({ length: n }, () => new Array(k).fill(0))
    for (let i = 0; i < n; i++) for (let a = 0; a < k; a++) for (let b = 0; b < m; b++) VHT[i][a] += V[i][b] * H[a][b]
    const HHT = Array.from({ length: k }, () => new Array(k).fill(0))
    for (let a = 0; a < k; a++) for (let b = 0; b < k; b++) for (let c = 0; c < m; c++) HHT[a][b] += H[a][c] * H[b][c]
    const WHHT = Array.from({ length: n }, () => new Array(k).fill(0))
    for (let i = 0; i < n; i++) for (let a = 0; a < k; a++) for (let b = 0; b < k; b++) WHHT[i][a] += Wm[i][b] * HHT[b][a]
    for (let i = 0; i < n; i++) for (let a = 0; a < k; a++) Wm[i][a] = (Wm[i][a] * VHT[i][a]) / (WHHT[i][a] + EPS)
  }
  return { W: Wm, H }
}

// Run NMF from several random inits and keep the factorization with the
// lowest relative reconstruction error ‖V − WH‖² / ‖V‖².
function nmfBest(V: number[][], k: number, iters: number, seedBase: number, restarts: number) {
  let best: { H: number[][]; relErr: number } | null = null
  for (let r = 0; r < restarts; r++) {
    const { W, H } = nmf(V, k, iters, seedBase + r)
    let err = 0
    let tot = 0
    for (let i = 0; i < V.length; i++) {
      for (let j = 0; j < V[i].length; j++) {
        let v = 0
        for (let a = 0; a < k; a++) v += W[i][a] * H[a][j]
        err += (V[i][j] - v) ** 2
        tot += V[i][j] ** 2
      }
    }
    const relErr = err / (tot || 1)
    if (!best || relErr < best.relErr) best = { H, relErr }
  }
  return best!
}

// NMF components come back in arbitrary order; greedily line them up under
// the true part each one best matches so the rows are visually comparable.
function orderPartsByMatch(H: number[][], trueParts: number[][]) {
  const cosine = (p: number[], q: number[]) => {
    let n = 0
    let dp = 0
    let dq = 0
    for (let i = 0; i < p.length; i++) {
      n += p[i] * q[i]
      dp += p[i] * p[i]
      dq += q[i] * q[i]
    }
    return n / (Math.sqrt(dp * dq) || 1)
  }
  const used = new Set<number>()
  const ordered: number[][] = []
  for (const tp of trueParts) {
    if (used.size >= H.length) break
    let best = -Infinity
    let bi = -1
    for (let j = 0; j < H.length; j++) {
      if (used.has(j)) continue
      const c = cosine(tp, H[j])
      if (c > best) {
        best = c
        bi = j
      }
    }
    if (bi >= 0) {
      used.add(bi)
      ordered.push(H[bi])
    }
  }
  for (let j = 0; j < H.length; j++) if (!used.has(j)) ordered.push(H[j])
  return ordered
}

function Patch({ data, x, y, cellSize, colorMax }: { data: number[]; x: number; y: number; cellSize: number; colorMax: number }) {
  const partSize = 8
  return (
    <g transform={`translate(${x},${y})`}>
      {data.map((d, i) => {
        const r = Math.floor(i / partSize)
        const c = i % partSize
        const v = Math.max(0, Math.min(1, d / colorMax))
        return <rect key={i} x={c * cellSize} y={r * cellSize} width={cellSize} height={cellSize} fill={d3.interpolateBlues(0.1 + 0.85 * v)} stroke="white" strokeWidth={0.3} />
      })}
      <rect width={partSize * cellSize} height={partSize * cellSize} fill="none" stroke="var(--border-2)" strokeWidth={0.5} />
    </g>
  )
}

// ---------- Figure 4: Random Projection ----------

// Tweakable surface — override per-instance in markdown: :::figure{id=jl k=4}
export const JL_DEFAULTS = {
  k: 16, // initial projected-dimension slider value, in [2, 100]
  n: 200, // initial point-count slider value, in [50, 400]
  origDim: 200, // dimensionality of the original space
  noise: 1.5, // gaussian σ around each blob center
  seed: 17, // rng seed for points and projection matrix
  maxPairs: 800, // number of point pairs plotted in the Shepard diagram
}

// Knob bounds: k and n mirror the reader-facing sliders; origDim stays
// at or above k's ceiling (projecting "down" to k > origDim is
// meaningless); noise σ beyond ~5 drowns the blob centers at 3.
export const JL_HINTS = {
  k: { min: 2, max: 100, step: 1 },
  n: { min: 50, max: 400, step: 50 },
  origDim: { min: 100, max: 1000, step: 10 },
  noise: { min: 0, max: 5, step: 0.1 },
}

export function JLFigure(props: FigureProps) {
  const k0 = num(props.k, JL_DEFAULTS.k)
  const n0 = num(props.n, JL_DEFAULTS.n)
  const origDim = num(props.origDim, JL_DEFAULTS.origDim)
  const noise = num(props.noise, JL_DEFAULTS.noise)
  const seed = num(props.seed, JL_DEFAULTS.seed)
  const maxPairs = num(props.maxPairs, JL_DEFAULTS.maxPairs)
  const [k, setK] = useState(k0)
  const [n, setN] = useState(n0)
  useEffect(() => setK(k0), [k0])
  useEffect(() => setN(n0), [n0])
  // "Sweep" replays the lesson as motion: k climbs from 2 to 100 while the
  // scatter visibly collapses onto the diagonal. The projection matrix rows
  // are drawn from the same seeded stream, so growing k nests the
  // projections and the pairs move continuously instead of reshuffling.
  const [sweeping, setSweeping] = useState(false)
  useEffect(() => {
    if (!sweeping) return
    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced) {
      setK(100)
      setSweeping(false)
      return
    }
    setK(2)
    let kk = 2
    const id = window.setInterval(() => {
      kk = Math.min(100, kk + 2)
      setK(kk)
      if (kk >= 100) {
        window.clearInterval(id)
        setSweeping(false)
      }
    }, 80)
    return () => window.clearInterval(id)
  }, [sweeping])
  const { pairs, corr } = useMemo(
    () => buildRandomProjectionPairs(k, n, origDim, noise, seed, maxPairs),
    [k, n, origDim, noise, seed, maxPairs],
  )

  const W = 680
  const H = 340
  const margin = { top: 20, right: 24, bottom: 44, left: 56 }
  const innerW = W - margin.left - margin.right
  const innerH = H - margin.top - margin.bottom
  const maxVal = (d3.max(pairs.flatMap((p) => [p.o, p.p])) ?? 1) * 1.05
  const xScale = d3.scaleLinear([0, maxVal], [0, innerW])
  const yScale = d3.scaleLinear([0, maxVal], [innerH, 0])

  return (
    <div>
      <div className="controls">
        <ControlSlider
          label="projected dim"
          value={k}
          min={2}
          max={100}
          step={1}
          onChange={(v) => {
            setSweeping(false)
            setK(v)
          }}
          format={String}
        />
        <ControlSlider label="points" value={n} min={50} max={400} step={50} onChange={setN} format={String} />
        <button className="figure-button" type="button" style={{ minWidth: 132 }} onClick={() => setSweeping((s) => !s)}>
          {sweeping ? 'stop' : 'sweep k: 2 → 100'}
        </button>
      </div>
      <div className="stat-bar">
        <div style={{ minWidth: 110 }}>distance corr.</div>
        <div className="bar-bg"><div className="bar-fill" style={{ width: `${Math.max(0, corr) * 100}%`, background: 'var(--accent)' }} /></div>
        <div style={{ minWidth: 76, textAlign: 'right' }} className="value">r = {corr.toFixed(3)}</div>
      </div>
      <svg width="100%" height={340} viewBox="0 0 680 340" preserveAspectRatio="xMidYMid meet">
        <g transform={`translate(${margin.left},${margin.top})`}>
          <AxisBottom scale={xScale} y={innerH} ticks={6} />
          <AxisLeft scale={yScale} x={0} ticks={5} />
          <text className="axis-label" x={innerW / 2} y={innerH + 36} textAnchor="middle">distance in {origDim}-D original space</text>
          <text className="axis-label" transform="rotate(-90)" x={-innerH / 2} y={-40} textAnchor="middle">distance after random projection</text>
          <line x1={xScale(0)} y1={yScale(0)} x2={xScale(maxVal)} y2={yScale(maxVal)} stroke="var(--border-2)" strokeWidth={1} strokeDasharray="3 3" />
          {pairs.map((p, i) => <circle key={i} cx={xScale(p.o)} cy={yScale(p.p)} r={2} fill="var(--accent)" opacity={0.35} />)}
          <text x={innerW - 8} y={14} textAnchor="end" style={{ fontSize: 12 }} fill="var(--text-2)">k = {k}</text>
        </g>
      </svg>
    </div>
  )
}

function buildRandomProjectionPairs(k: number, n: number, ORIG_D: number, noise: number, seed: number, maxPairs: number) {
  const rng = mulberry32(seed)
  const pts: number[][] = []
  // Three gaussian blobs: one at the origin, one offset in the first quarter
  // of the dimensions, one offset in the last quarter.
  const lo = Math.floor(ORIG_D * 0.25)
  const hi = Math.floor(ORIG_D * 0.75)
  for (let i = 0; i < n; i++) {
    const blob = Math.floor(rng() * 3)
    const center = new Array(ORIG_D).fill(0).map((_, j) => (blob === 0 ? 0 : blob === 1 ? (j < lo ? 3 : 0) : (j > hi ? 3 : 0)))
    const p = new Array(ORIG_D)
    for (let j = 0; j < ORIG_D; j++) p[j] = center[j] + gaussian(rng) * noise
    pts.push(p)
  }
  const Wm = Array.from({ length: k }, () => {
    const row = new Array(ORIG_D)
    for (let j = 0; j < ORIG_D; j++) row[j] = gaussian(rng) / Math.sqrt(k)
    return row
  })
  const projected = pts.map((p) => {
    const q = new Array(k)
    for (let a = 0; a < k; a++) {
      let s = 0
      for (let j = 0; j < ORIG_D; j++) s += Wm[a][j] * p[j]
      q[a] = s
    }
    return q
  })
  function dist(a: number[], b: number[]) {
    let s = 0
    for (let i = 0; i < a.length; i++) s += (a[i] - b[i]) ** 2
    return Math.sqrt(s)
  }
  const pairs: { o: number; p: number }[] = []
  for (let i = 0; i < pts.length && pairs.length < maxPairs; i++) {
    for (let j = i + 1; j < pts.length && pairs.length < maxPairs; j++) {
      pairs.push({ o: dist(pts[i], pts[j]), p: dist(projected[i], projected[j]) })
    }
  }
  const mx = d3.mean(pairs, (p) => p.o) ?? 0
  const my = d3.mean(pairs, (p) => p.p) ?? 0
  let num = 0
  let dx = 0
  let dy = 0
  for (const p of pairs) {
    num += (p.o - mx) * (p.p - my)
    dx += (p.o - mx) ** 2
    dy += (p.p - my) ** 2
  }
  const corr = num / Math.sqrt(dx * dy)
  return { pairs, corr }
}

// --------- Kernel PCA figure ---------
// No counterpart in the original HTML article (the kernel-PCA section there
// is prose-only); this figure was added in the port.

type KpcaDataset = 'circles' | 'moons' | 'xor'
type KpcaKernel = 'linear' | 'poly' | 'rbf'

const KPCA_DATASETS: KpcaDataset[] = ['circles', 'moons', 'xor']
const KPCA_KERNELS: KpcaKernel[] = ['linear', 'poly', 'rbf']

// Tweakable surface — override per-instance in markdown: :::figure{id=kpca dataset=moons}
export const KPCA_DEFAULTS = {
  dataset: 'circles', // initial dataset toggle: circles | moons | xor
  kernel: 'rbf', // initial kernel toggle: linear | poly | rbf
  // γ=1.5 cleanly separates the concentric circles along PC1; sliding toward
  // either end of the range shows the too-global / too-local failure modes.
  gamma: 1.5, // initial RBF inverse-bandwidth slider value, in [0.1, 6]
  degree: 3, // initial polynomial-degree slider value, in [2, 6]
  nPerClass: 30, // points per class for circles/moons (xor uses 0.6× per cluster)
  noiseScale: 1, // multiplier on each dataset's built-in gaussian jitter
}

// Knob bounds: gamma/degree mirror the reader-facing sliders; nPerClass
// is capped because the O(n²) gram matrix render + power iteration choke
// well before the heuristic's 500; noiseScale steps of 0.01 are fiddly.
export const KPCA_HINTS = {
  gamma: { min: 0.1, max: 6, step: 0.1 },
  degree: { min: 2, max: 6, step: 1 },
  nPerClass: { min: 4, max: 80 },
  noiseScale: { min: 0, max: 3, step: 0.05 },
}

export function KPCAFigure(props: FigureProps) {
  const dsRaw = str(props.dataset, KPCA_DEFAULTS.dataset)
  const ds0 = (KPCA_DATASETS as string[]).includes(dsRaw) ? (dsRaw as KpcaDataset) : 'circles'
  const kernRaw = str(props.kernel, KPCA_DEFAULTS.kernel)
  const kern0 = (KPCA_KERNELS as string[]).includes(kernRaw) ? (kernRaw as KpcaKernel) : 'rbf'
  const gamma0 = num(props.gamma, KPCA_DEFAULTS.gamma)
  const degree0 = num(props.degree, KPCA_DEFAULTS.degree)
  const nPerClass = num(props.nPerClass, KPCA_DEFAULTS.nPerClass)
  const noiseScale = num(props.noiseScale, KPCA_DEFAULTS.noiseScale)
  const [dataset, setDataset] = useState<KpcaDataset>(ds0)
  const [kernel, setKernel] = useState<KpcaKernel>(kern0)
  const [gamma, setGamma] = useState(gamma0)
  const [degree, setDegree] = useState(degree0)
  useEffect(() => setDataset(ds0), [ds0])
  useEffect(() => setKernel(kern0), [kern0])
  useEffect(() => setGamma(gamma0), [gamma0])
  useEffect(() => setDegree(degree0), [degree0])
  const { activePart } = useFigureHighlight(props.figureId as string)
  const dim = (part: string) => (activePart && activePart !== part ? 0.3 : 1)
  const paneLabel = (part: string) => (activePart === part ? 'var(--accent)' : 'var(--text-3)')

  const pts = useMemo(
    () => buildKpcaDataset(dataset, nPerClass, noiseScale),
    [dataset, nPerClass, noiseScale],
  )
  const { K, emb, eigvals } = useMemo(
    () => kernelPCA(pts, kernel, gamma, degree),
    [pts, kernel, gamma, degree],
  )

  // Linked hover: one datum tracked across all three panes. Hovering a point
  // (or a Gram-matrix row) highlights it in the input scatter, lights up its
  // row+column of kernel values, and finds it again in the embedding.
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)
  useEffect(() => setHoverIdx(null), [pts])
  const ptR = (i: number) => (hoverIdx === i ? 5.5 : 3.5)
  const ptOpacity = (i: number) => (hoverIdx === null ? 0.85 : i === hoverIdx ? 1 : 0.3)
  const ptStroke = (i: number) => (hoverIdx === i ? 'var(--text)' : 'white')
  const ptStrokeW = (i: number) => (hoverIdx === i ? 1.4 : 0.6)

  const W = 680, H = 340
  const gap = 18
  const panelW = (W - gap * 2) / 3
  const panelTop = 28
  const panelH = H - panelTop - 18

  const classColors = ['var(--accent)', 'var(--warm)']

  // panel 1: input space
  const left = scales2d(pts.map((p) => [p.x, p.y] as [number, number]), panelW, panelH)
  // panel 3: kernel-PCA embedding
  const right = scales2d(emb.map((p) => [p[0], p[1]] as [number, number]), panelW, panelH)
  // panel 2: gram matrix
  const n = K.length
  const cell = Math.min(panelW - 4, panelH) / n
  const matrixSize = cell * n
  const matrixX = panelW + gap + (panelW - matrixSize) / 2
  const matrixY = panelTop + (panelH - matrixSize) / 2

  // colour scale for the gram matrix: kernel values are non-negative for
  // these kernels (linear can be negative — clamp to keep the heatmap
  // readable, the sign is mentioned in the caption). The cell grid is
  // memoized so hover-state changes don't re-diff n² rects.
  const gramGrid = useMemo(() => {
    const flat: number[] = []
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) flat.push(K[i][j])
    const kmin = d3.min(flat) ?? 0
    const kmax = d3.max(flat) ?? 1
    const heat = d3.scaleSequential(d3.interpolateMagma).domain([kmax * 1.02, kmin])
    return (
      <>
        {K.map((row, i) =>
          row.map((v, j) => (
            <rect key={`${i}-${j}`} x={j * cell} y={i * cell} width={cell + 0.5} height={cell + 0.5} fill={heat(v)} />
          )),
        )}
      </>
    )
  }, [K, cell, n])

  const evRatio = eigvals[0] + eigvals[1] > 0
    ? eigvals[0] / (eigvals.reduce((a, b) => a + Math.max(0, b), 0) + 1e-12)
    : 0

  return (
    <div>
      <div className="controls">
        <div className="toggle-group">
          {([
            ['circles', 'circles'],
            ['moons', 'two moons'],
            ['xor', 'xor'],
          ] as [KpcaDataset, string][]).map(([key, label]) => (
            <button key={key} type="button" className={dataset === key ? 'active' : ''} onClick={() => setDataset(key)}>{label}</button>
          ))}
        </div>
        <div className="toggle-group">
          {([
            ['linear', 'linear (= PCA)'],
            ['poly', 'polynomial'],
            ['rbf', 'RBF'],
          ] as [KpcaKernel, string][]).map(([key, label]) => (
            <button key={key} type="button" className={kernel === key ? 'active' : ''} onClick={() => setKernel(key)}>{label}</button>
          ))}
        </div>
        {kernel === 'rbf' && (
          <ControlSlider
            label="γ"
            value={gamma}
            min={0.1}
            max={6}
            step={0.1}
            onChange={setGamma}
            format={(v) => v.toFixed(2)}
            title="RBF inverse bandwidth: small γ is broad/global, large γ is narrow/local"
          />
        )}
        {kernel === 'poly' && (
          <ControlSlider
            label="degree"
            value={degree}
            min={2}
            max={6}
            step={1}
            onChange={setDegree}
            format={(v) => `${v}`}
            title="Polynomial feature interaction order"
          />
        )}
        {kernel === 'linear' && (
          <span style={{ fontSize: '0.8rem', color: 'var(--text-3)' }}>linear kernel has no extra parameter</span>
        )}
        <span style={{ fontSize: '0.8rem', color: 'var(--text-3)' }}>
          PC1 captures <span className="value" style={{ color: 'var(--text)' }}>{(evRatio * 100).toFixed(0)}%</span> of kernel variance
        </span>
      </div>
      <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" onMouseLeave={() => setHoverIdx(null)}>
        {/* Panel 1: input */}
        <g transform={`translate(0,0)`} opacity={dim('input')}>
          <text x={0} y={16} style={{ fontSize: 11, letterSpacing: '0.04em' }} fill={paneLabel('input')}>INPUT SPACE</text>
          <g transform={`translate(0,${panelTop})`}>
            {pts.map((p, i) => (
              <circle key={i} cx={left.x(p.x)} cy={left.y(p.y)} r={ptR(i)} fill={classColors[p.c]} opacity={ptOpacity(i)} stroke={ptStroke(i)} strokeWidth={ptStrokeW(i)} />
            ))}
            {pts.map((p, i) => (
              <circle key={`h${i}`} cx={left.x(p.x)} cy={left.y(p.y)} r={9} fill="transparent" onMouseEnter={() => setHoverIdx(i)} />
            ))}
          </g>
        </g>
        {/* Panel 2: gram matrix */}
        <g transform={`translate(${panelW + gap},0)`} opacity={dim('gram')}>
          <text x={0} y={16} style={{ fontSize: 11, letterSpacing: '0.04em' }} fill={paneLabel('gram')}>
            GRAM MATRIX · k({kernel === 'rbf' ? `RBF γ=${gamma.toFixed(1)}` : kernel === 'poly' ? `poly d=${degree}` : 'linear'})
          </text>
          <g transform={`translate(${matrixX - (panelW + gap)},${matrixY})`}>
            {gramGrid}
            <rect x={0} y={0} width={matrixSize} height={matrixSize} fill="none" stroke="var(--border)" />
            {/* class boundary lines */}
            {(() => {
              const split = pts.findIndex((p) => p.c === 1)
              if (split <= 0) return null
              const y = split * cell
              return (
                <>
                  <line x1={0} x2={matrixSize} y1={y} y2={y} stroke="var(--text)" strokeOpacity={0.35} strokeWidth={0.8} />
                  <line x1={y} x2={y} y1={0} y2={matrixSize} stroke="var(--text)" strokeOpacity={0.35} strokeWidth={0.8} />
                </>
              )
            })()}
            {hoverIdx !== null && (
              <g pointerEvents="none">
                <rect x={0} y={hoverIdx * cell} width={matrixSize} height={cell} fill="none" stroke={classColors[pts[hoverIdx].c]} strokeWidth={1.6} />
                <rect x={hoverIdx * cell} y={0} width={cell} height={matrixSize} fill="none" stroke={classColors[pts[hoverIdx].c]} strokeWidth={1.6} />
              </g>
            )}
            {K.map((_, i) => (
              <rect key={`hr${i}`} x={0} y={i * cell} width={matrixSize} height={cell} fill="transparent" onMouseEnter={() => setHoverIdx(i)} />
            ))}
          </g>
        </g>
        {/* Panel 3: kernel-PCA embedding */}
        <g transform={`translate(${2 * (panelW + gap)},0)`} opacity={dim('embedding')}>
          <text x={0} y={16} style={{ fontSize: 11, letterSpacing: '0.04em' }} fill={paneLabel('embedding')}>KERNEL-PCA EMBEDDING</text>
          <g transform={`translate(0,${panelTop})`}>
            {/* axis crosshair */}
            <line x1={right.x(0)} x2={right.x(0)} y1={0} y2={panelH} stroke="var(--border)" strokeDasharray="2 3" />
            <line x1={0} x2={panelW} y1={right.y(0)} y2={right.y(0)} stroke="var(--border)" strokeDasharray="2 3" />
            {emb.map((p, i) => (
              <circle key={i} cx={right.x(p[0])} cy={right.y(p[1])} r={ptR(i)} fill={classColors[pts[i].c]} opacity={ptOpacity(i)} stroke={ptStroke(i)} strokeWidth={ptStrokeW(i)} />
            ))}
            {emb.map((p, i) => (
              <circle key={`h${i}`} cx={right.x(p[0])} cy={right.y(p[1])} r={9} fill="transparent" onMouseEnter={() => setHoverIdx(i)} />
            ))}
            <text x={panelW - 6} y={panelH - 6} textAnchor="end" style={{ fontSize: 10 }} fill="var(--text-3)">PC1 →</text>
            <text x={6} y={12} style={{ fontSize: 10 }} fill="var(--text-3)">↑ PC2</text>
          </g>
        </g>
      </svg>
    </div>
  )
}

type KpcaPt = { x: number; y: number; c: number }

function buildKpcaDataset(kind: KpcaDataset, nPerClass: number, noiseScale: number): KpcaPt[] {
  const rng = mulberry32(kind === 'circles' ? 11 : kind === 'moons' ? 23 : 37)
  const pts: KpcaPt[] = []
  if (kind === 'circles') {
    // Radii tuned so the RBF kernel at the default γ separates the rings
    // along PC1 (with the old 1.0/2.4 geometry the ring harmonics dominated
    // the top eigenvectors and no γ made the embedding linearly separable).
    const N = Math.max(4, Math.round(nPerClass))
    for (let i = 0; i < N; i++) {
      const a = (i / N) * 2 * Math.PI
      pts.push({ x: Math.cos(a) * 0.6 + gaussian(rng) * 0.06 * noiseScale, y: Math.sin(a) * 0.6 + gaussian(rng) * 0.06 * noiseScale, c: 0 })
    }
    for (let i = 0; i < N; i++) {
      const a = (i / N) * 2 * Math.PI
      pts.push({ x: Math.cos(a) * 1.8 + gaussian(rng) * 0.075 * noiseScale, y: Math.sin(a) * 1.8 + gaussian(rng) * 0.075 * noiseScale, c: 1 })
    }
  } else if (kind === 'moons') {
    const N = Math.max(4, Math.round(nPerClass))
    for (let i = 0; i < N; i++) {
      const a = Math.PI * (i / (N - 1))
      pts.push({ x: Math.cos(a) + gaussian(rng) * 0.08 * noiseScale, y: Math.sin(a) + gaussian(rng) * 0.08 * noiseScale, c: 0 })
    }
    for (let i = 0; i < N; i++) {
      const a = Math.PI * (i / (N - 1))
      pts.push({ x: 1 - Math.cos(a) + gaussian(rng) * 0.08 * noiseScale, y: -Math.sin(a) + 0.5 + gaussian(rng) * 0.08 * noiseScale, c: 1 })
    }
  } else {
    // xor: two diagonal clusters per class
    const N = Math.max(3, Math.round(nPerClass * 0.6))
    const centers: [number, number, number][] = [
      [-1.2, -1.2, 0], [1.2, 1.2, 0],
      [-1.2, 1.2, 1], [1.2, -1.2, 1],
    ]
    for (const [cx, cy, c] of centers) {
      for (let i = 0; i < N; i++) pts.push({ x: cx + gaussian(rng) * 0.32 * noiseScale, y: cy + gaussian(rng) * 0.32 * noiseScale, c })
    }
  }
  // sort by class so the gram matrix shows visible block structure
  pts.sort((a, b) => a.c - b.c)
  return pts
}

function kernelFn(kind: KpcaKernel, gamma: number, degree: number) {
  if (kind === 'linear') return (a: KpcaPt, b: KpcaPt) => a.x * b.x + a.y * b.y
  if (kind === 'poly') {
    // Polynomial kernel with offset. We expose only the most legible knob:
    // interaction order. The usual gamma and coef0 parameters are fixed at
    // 1 to keep the figure focused.
    return (a: KpcaPt, b: KpcaPt) => Math.pow(a.x * b.x + a.y * b.y + 1, degree)
  }
  return (a: KpcaPt, b: KpcaPt) => {
    const d2 = (a.x - b.x) ** 2 + (a.y - b.y) ** 2
    return Math.exp(-gamma * d2)
  }
}

function kernelPCA(pts: KpcaPt[], kernel: KpcaKernel, gamma: number, degree: number, dim = 2, iters = 80, seed = 5) {
  const n = pts.length
  const k = kernelFn(kernel, gamma, degree)
  // Build Gram matrix
  const K = Array.from({ length: n }, () => new Array(n).fill(0))
  for (let i = 0; i < n; i++) for (let j = i; j < n; j++) {
    const v = k(pts[i], pts[j])
    K[i][j] = v
    K[j][i] = v
  }
  // Centre the Gram matrix: Kc = K - 1n K - K 1n + 1n K 1n
  const rowMean = K.map((row) => row.reduce((s, v) => s + v, 0) / n)
  const total = rowMean.reduce((s, v) => s + v, 0) / n
  const Kc = Array.from({ length: n }, (_, i) => new Array(n).fill(0))
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) Kc[i][j] = K[i][j] - rowMean[i] - rowMean[j] + total
  // Power iteration with deflation for top `dim` eigenpairs
  const rng = mulberry32(seed)
  const eigvecs: number[][] = []
  const eigvals: number[] = []
  const A = Kc.map((row) => row.slice())
  for (let d = 0; d < dim; d++) {
    let v = Array.from({ length: n }, () => rng() - 0.5)
    let norm = Math.hypot(...v) || 1
    v = v.map((x) => x / norm)
    let lambda = 0
    for (let it = 0; it < iters; it++) {
      const w = new Array(n).fill(0)
      for (let i = 0; i < n; i++) {
        let s = 0
        for (let j = 0; j < n; j++) s += A[i][j] * v[j]
        w[i] = s
      }
      norm = Math.hypot(...w) || 1
      v = w.map((x) => x / norm)
    }
    // Rayleigh quotient for the eigenvalue
    let num = 0
    for (let i = 0; i < n; i++) {
      let s = 0
      for (let j = 0; j < n; j++) s += A[i][j] * v[j]
      num += v[i] * s
    }
    lambda = num
    eigvecs.push(v)
    eigvals.push(lambda)
    // deflate
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) A[i][j] -= lambda * v[i] * v[j]
  }
  // Projection: y_id = sqrt(lambda_d) * alpha_d[i]
  const emb: number[][] = Array.from({ length: n }, (_, i) =>
    eigvecs.map((v, d) => Math.sqrt(Math.max(0, eigvals[d])) * v[i]),
  )
  return { K, emb, eigvals }
}

function scales2d(points: [number, number][], paneW: number, paneH: number) {
  const xExt = d3.extent(points, (d) => d[0]) as [number, number]
  const yExt = d3.extent(points, (d) => d[1]) as [number, number]
  const padX = Math.max(0.1, (xExt[1] - xExt[0]) * 0.15)
  const padY = Math.max(0.1, (yExt[1] - yExt[0]) * 0.15)
  return {
    x: d3.scaleLinear([xExt[0] - padX, xExt[1] + padX], [0, paneW]),
    y: d3.scaleLinear([yExt[0] - padY, yExt[1] + padY], [paneH, 0]),
  }
}
