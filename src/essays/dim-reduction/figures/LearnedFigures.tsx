import { useEffect, useMemo, useState } from 'react'
import * as d3 from 'd3'
import type { FigureProps } from './registry'
import { num } from '../../runtime/lib/params'
import { useFigureHighlight } from '../../runtime/store'

// Faithful React ports of docs/dim-reduction/09-learned.html.

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

// ---------- Figure 1: Autoencoder latent traversal ----------

// "Trained decoder": a smooth parameterization of the manifold.
function decode(z: number, freq: number, amp: number): [number, number] {
  const a = (z - 0.5) * 2.4
  return [a, Math.sin(a * freq) * amp]
}
// "Trained encoder": approximate inverse — recover t from x, clamped to [0, 1].
function encode(p: { x: number }) {
  return Math.max(0, Math.min(1, p.x / 2.4 + 0.5))
}

// A 1-D autoencoder on a curved 2D manifold: left pane shows the data
// colored by encoder output, right pane shows the decoder tracing the
// learned curve as the reader scrubs the latent slider.
export const AE_DEFAULTS = {
  z: 0.5, // initial latent slider position in [0, 1]
  seed: 13, // RNG seed for the synthetic manifold sample
  n: 200, // number of data points sampled along the manifold
  noise: 0.08, // gaussian noise added off-manifold (std dev)
  freq: 1.8, // sine frequency of the manifold curve
  amp: 0.8, // sine amplitude of the manifold curve
}

// z must match the reader slider's [0, 1]; n past ~1000 makes every scrub
// re-render thousands of circles; noise's heuristic step (0.001) is fiddly;
// freq/amp beyond the pane's [-1.5, 1.5] × [-1.2, 1.2] domain just clip.
export const AE_HINTS = {
  z: { min: 0, max: 1, step: 0.01 },
  n: { min: 10, max: 1000, step: 10 },
  noise: { min: 0, max: 0.5, step: 0.005 },
  freq: { min: 0.2, max: 6, step: 0.1 },
  amp: { min: 0, max: 1.2, step: 0.05 },
}

export function AEFigure(props: FigureProps) {
  const z0 = num(props.z, AE_DEFAULTS.z)
  const seed = num(props.seed, AE_DEFAULTS.seed)
  const n = num(props.n, AE_DEFAULTS.n)
  const noise = num(props.noise, AE_DEFAULTS.noise)
  const freq = num(props.freq, AE_DEFAULTS.freq)
  const amp = num(props.amp, AE_DEFAULTS.amp)
  const [z, setZ] = useState(z0)
  // Follow live knob/markdown changes; reader scrubs win until params change.
  useEffect(() => setZ(z0), [z0])
  const { activePart } = useFigureHighlight(props.figureId as string)
  const data = useMemo(() => buildAeData(seed, n, noise, freq, amp), [seed, n, noise, freq, amp])
  const W = 680, H = 340
  // Extra viewBox room below the original 340 so the latent-axis labels
  // (baseline at ~348) are visible instead of clipped as in the HTML.
  const VH = 364
  const paneW = W / 2
  const lW = paneW - 30, lH = H - 50
  const xsc = d3.scaleLinear([-1.5, 1.5], [0, lW])
  const ysc = d3.scaleLinear([-1.2, 1.2], [lH, 0])
  const color = d3.scaleSequential(d3.interpolateViridis).domain([0, 1])
  const decoderPts = d3.range(0, 1.001, 0.01).map((v) => decode(v, freq, amp))
  const lineGen = d3.line<[number, number]>().x((d) => xsc(d[0])).y((d) => ysc(d[1])).curve(d3.curveMonotoneX)
  const decoded = decode(z, freq, amp)
  const closest = data.reduce<{ best: typeof data[0] | null; dz: number }>((acc, d) => {
    const dz = Math.abs(encode(d) - z)
    if (acc.best === null || dz < acc.dz) return { best: d, dz }
    return acc
  }, { best: null, dz: Infinity }).best
  // Round trip for the highlighted point: encode it, decode that z. The
  // reconstruction lands on the learned curve; the dashed gap to the noisy
  // data point IS the reconstruction error.
  const recon = closest ? decode(encode(closest), freq, amp) : null
  const dim = (part: string) => (activePart && activePart !== part ? 0.35 : 1)
  const paneStroke = (part: string) => (activePart === part ? 'var(--accent)' : 'var(--border)')
  return (
    <div>
      <div className="controls">
        <label>latent position z <span className="value">{z.toFixed(2)}</span><input type="range" min={0} max={1} step={0.01} value={z} onChange={(e) => setZ(+e.currentTarget.value)} /></label>
      </div>
      <svg width="100%" height={VH} viewBox={`0 0 ${W} ${VH}`} preserveAspectRatio="xMidYMid meet">
        <g transform="translate(10,16)">
          <g opacity={dim('encoder')}>
            <text y={0} style={{ fontSize: 11, letterSpacing: '0.04em' }} fill="var(--text-3)">DATA (2D) + ENCODER COLOR</text>
            <g transform="translate(0,14)">
              <rect x={0} y={0} width={lW} height={lH} fill="var(--bg)" stroke={paneStroke('encoder')} strokeWidth={activePart === 'encoder' ? 2 : 1} rx={4} />
              {data.map((d, i) => <circle key={i} cx={xsc(d.x)} cy={ysc(d.y)} r={2.8} fill={color(encode(d))} opacity={0.85} stroke="white" strokeWidth={0.4} />)}
              {closest && recon && (
                <g>
                  <line x1={xsc(closest.x)} y1={ysc(closest.y)} x2={xsc(recon[0])} y2={ysc(recon[1])} stroke="var(--warm)" strokeWidth={1.2} strokeDasharray="3,3" />
                  <circle cx={xsc(closest.x)} cy={ysc(closest.y)} r={7} fill="none" stroke="var(--warm)" strokeWidth={2.2} />
                  <circle cx={xsc(recon[0])} cy={ysc(recon[1])} r={3.5} fill="var(--warm)" stroke="white" strokeWidth={1.2} />
                </g>
              )}
            </g>
          </g>
          <g transform={`translate(0,${lH + 28})`} opacity={dim('latent')}>
            <line x1={0} x2={lW} y1={0} y2={0} stroke="var(--border-2)" strokeWidth={2} />
            {d3.range(0, 1.01, 0.1).map((zv, i) => <circle key={i} cx={zv * lW} cy={0} r={2} fill={color(zv)} />)}
            <circle cx={z * lW} cy={0} r={4.5} fill="var(--warm)" stroke="white" strokeWidth={1.5} />
            <text x={0} y={14} style={{ fontSize: 10 }} fill="var(--text-3)">latent z = 0</text>
            <text x={lW} y={14} textAnchor="end" style={{ fontSize: 10 }} fill="var(--text-3)">z = 1</text>
          </g>
        </g>
        <g transform={`translate(${paneW + 10},16)`} opacity={dim('decoder')}>
          <text y={0} style={{ fontSize: 11, letterSpacing: '0.04em' }} fill="var(--text-3)">DECODER SAMPLES THE LATENT LINE</text>
          <g transform="translate(0,14)">
            <rect x={0} y={0} width={lW} height={lH} fill="var(--bg)" stroke={paneStroke('decoder')} strokeWidth={activePart === 'decoder' ? 2 : 1} rx={4} />
            <path d={lineGen(decoderPts) ?? ''} fill="none" stroke="var(--accent)" strokeWidth={2.5} opacity={0.7} />
            <circle cx={xsc(decoded[0])} cy={ysc(decoded[1])} r={8} fill="var(--warm)" stroke="white" strokeWidth={2} />
          </g>
        </g>
      </svg>
    </div>
  )
}

function buildAeData(seed: number, n: number, noise: number, freq: number, amp: number) {
  const rng = mulberry32(seed)
  const data: { x: number; y: number; t: number }[] = []
  for (let i = 0; i < n; i++) {
    const t = rng()
    const [x, y] = decode(t, freq, amp)
    data.push({ x: x + gaussian(rng) * noise, y: y + gaussian(rng) * noise, t })
  }
  return data
}

// ---------- Figure 2: neural diagram ----------

// Four rows of the same encoder–bottleneck–decoder schematic, one per
// method; only the loss annotation differs.
export const NEURAL_DEFAULTS = {
  dots: 5, // input/output dots drawn on each side of the schematic
}

// Dots stack at 8px spacing inside a ~90px row, so the heuristic's max of 50
// would spill far outside the schematic; ~9 is the most that fits.
export const NEURAL_HINTS = {
  dots: { min: 1, max: 9, step: 1 },
}

// `lossAt` marks where the objective attaches (warm dashed halo): the
// reconstruction output, the latent, or both. Parametric UMAP's loss is
// scored on the latent itself; its decoder is optional, so it renders ghosted.
const NEURAL_METHODS: {
  id: string; name: string; loss: string[]; latent: string
  lossAt: ('output' | 'latent')[]; decoder: 'solid' | 'ghost'
}[] = [
  { id: 'autoencoder', name: 'Autoencoder', loss: ['reconstruction (MSE)'], latent: 'unconstrained', lossAt: ['output'], decoder: 'solid' },
  { id: 'vae', name: 'VAE', loss: ['reconstruction +', 'KL to prior on z'], latent: 'smooth Gaussian', lossAt: ['output', 'latent'], decoder: 'solid' },
  { id: 'parametric-umap', name: 'Parametric UMAP', loss: ['UMAP cross-entropy', 'on neighbor graph'], latent: 'neighbor-preserving', lossAt: ['latent'], decoder: 'ghost' },
  { id: 'scvi', name: 'scVI', loss: ['zero-inflated negative', 'binomial likelihood'], latent: 'count-aware', lossAt: ['output'], decoder: 'solid' },
]

export function NeuralFigure(props: FigureProps) {
  const dots = num(props.dots, NEURAL_DEFAULTS.dots)
  const { activePart } = useFigureHighlight(props.figureId as string)
  const W = 680, H = 360
  const rowH = H / NEURAL_METHODS.length
  const ex = 150, bx = 320, dx = 470, endx = 620

  return (
    <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet">
      {NEURAL_METHODS.map((m, i) => {
        const y = i * rowH + 8
        const midY = rowH / 2 + 4
        const active = activePart === m.id
        const ghost = m.decoder === 'ghost'
        const dotsHalf = ((dots - 1) / 2) * 8
        const lineY0 = midY - 8 + (m.loss.length === 1 ? 6 : 0)
        return (
          <g key={m.id} transform={`translate(0,${y})`} opacity={activePart && !active ? 0.35 : 1}>
            {active && <rect x={4} y={-2} width={W - 8} height={rowH - 8} fill="none" stroke="var(--accent)" strokeWidth={1.5} rx={6} />}
            <text x={12} y={20} style={{ fontSize: 13, fontWeight: 700 }} fill={active ? 'var(--accent)' : 'var(--text)'}>{m.name}</text>
            {d3.range(dots).map((j) => <circle key={j} cx={ex - 20} cy={midY + (j - (dots - 1) / 2) * 8} r={2.5} fill="var(--text-3)" />)}
            <path d={`M${ex},${midY - 20} L${bx - 10},${midY - 6} L${bx - 10},${midY + 6} L${ex},${midY + 20} Z`} fill="var(--accent-light)" stroke="var(--accent)" strokeWidth={1.2} />
            <text x={(ex + bx) / 2 - 5} y={midY + 4} textAnchor="middle" style={{ fontSize: 10 }} fill="var(--accent)">encoder</text>
            <circle cx={bx} cy={midY - 4} r={3.5} fill="var(--warm)" />
            <circle cx={bx} cy={midY + 4} r={3.5} fill="var(--warm)" />
            <text x={bx} y={midY + 24} textAnchor="middle" style={{ fontSize: 10 }} fill="var(--warm)">latent z</text>
            <g opacity={ghost ? 0.3 : 1}>
              <path d={`M${bx + 10},${midY - 6} L${dx},${midY - 20} L${dx},${midY + 20} L${bx + 10},${midY + 6} Z`} fill={ghost ? 'none' : 'var(--accent-light)'} stroke="var(--accent)" strokeWidth={1.2} strokeDasharray={ghost ? '4,3' : undefined} />
              <text x={(bx + dx) / 2 + 5} y={midY + (ghost ? -1 : 4)} textAnchor="middle" style={{ fontSize: 10 }} fill="var(--accent)">decoder</text>
              {ghost && <text x={(bx + dx) / 2 + 5} y={midY + 11} textAnchor="middle" style={{ fontSize: 9 }} fill="var(--accent)">(optional)</text>}
              {d3.range(dots).map((j) => <circle key={j} cx={dx + 20} cy={midY + (j - (dots - 1) / 2) * 8} r={2.5} fill="var(--text-3)" />)}
            </g>
            {/* warm dashed halo: where this method's objective attaches */}
            {m.lossAt.includes('output') && (
              <rect x={dx + 10} y={midY - dotsHalf - 8} width={20} height={dotsHalf * 2 + 16} fill="none" stroke="var(--warm)" strokeWidth={1.5} strokeDasharray="3,3" rx={7} />
            )}
            {m.lossAt.includes('latent') && (
              <rect x={bx - 10} y={midY - 14} width={20} height={28} fill="none" stroke="var(--warm)" strokeWidth={1.5} strokeDasharray="3,3" rx={7} />
            )}
            <rect x={endx - 42} y={midY - 30} width={10} height={10} fill="none" stroke="var(--warm)" strokeWidth={1.2} strokeDasharray="2.5,2" rx={3} />
            <text x={endx} y={midY - 22} textAnchor="end" style={{ fontSize: 10 }} fill="var(--warm)">loss:</text>
            {m.loss.map((line, k) => (
              <text key={k} x={endx} y={lineY0 + k * 13} textAnchor="end" style={{ fontSize: 11 }} fill="var(--text)">{line}</text>
            ))}
            <text x={endx} y={midY + 22} textAnchor="end" style={{ fontSize: 10 }} fill="var(--text-2)">→ latent is {m.latent}</text>
            {i < NEURAL_METHODS.length - 1 && <line x1={10} x2={W - 10} y1={rowH - 4} y2={rowH - 4} stroke="var(--border)" strokeWidth={0.5} />}
          </g>
        )
      })}
    </svg>
  )
}
