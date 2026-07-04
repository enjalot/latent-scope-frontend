import { useState } from 'react'
import type { FigureProps } from './registry'
import { bool } from '../../runtime/lib/params'
import { useFigureHighlight } from '../../runtime/store'

// Faithful React port of docs/dim-reduction/10-capstone.html's design matrix.

// Each method family carries a part id (for term highlighting) plus its label.
const FAMILIES = [
  { id: 'linear', label: 'Linear (PCA, ICA, NMF)' },
  { id: 'mds-isomap', label: 'Global distances (MDS, Isomap)' },
  { id: 'diffusion', label: 'Diffusion (diffusion maps, PHATE)' },
  { id: 'neighbor-graphs', label: 'Neighbor graphs (t-SNE, UMAP)' },
  { id: 'mapper', label: 'Topology (Mapper)' },
  { id: 'densmap', label: 'Density (densMAP)' },
  { id: 'som', label: 'Discrete grids (SOM)' },
  { id: 'hyperbolic', label: 'Hyperbolic (Poincaré)' },
  { id: 'learned', label: 'Learned (AE, VAE, param UMAP, scVI)' },
]
// Property columns, each with a part id distinct from every row id.
const PROPS = [
  { id: 'global-distances', label: 'global distances' },
  { id: 'neighborhoods', label: 'neighborhoods' },
  { id: 'topology', label: 'topology' },
  { id: 'density', label: 'density' },
  { id: 'hierarchy', label: 'hierarchy' },
  { id: 'interpretability', label: 'interpretability' },
  { id: 'out-of-sample', label: 'out-of-sample' },
  { id: 'scalability', label: 'scalability' },
]
// Rating: 0 = does not preserve, 1 = partial, 2 = preserves well.
// Indexed [family][prop].
const R: number[][] = [
  [2, 0, 0, 0, 0, 2, 2, 2],
  [2, 1, 1, 0, 0, 1, 1, 0],
  [1, 2, 1, 1, 1, 0, 0, 1],
  [0, 2, 0, 0, 0, 0, 0, 2],
  [0, 1, 2, 0, 1, 1, 0, 1],
  [0, 2, 0, 2, 0, 0, 0, 2],
  [0, 1, 1, 1, 0, 2, 2, 1],
  [1, 1, 1, 0, 2, 0, 1, 0],
  [1, 1, 1, 1, 1, 0, 2, 2],
]

const LEGEND = [
  { label: 'preserves well', fill: 'var(--accent)', marker: '●', markerFill: 'white' },
  { label: 'partial', fill: 'var(--accent-light)', marker: '◐', markerFill: 'var(--accent)' },
  { label: 'does not preserve', fill: 'var(--muted)', marker: '', markerFill: 'var(--text-3)' },
]

// Static design-space matrix: nothing is data-generated, so the only
// author-facing switch is the legend row.
export const MATRIX_DEFAULTS = {
  legend: true, // show the three-swatch legend below the grid
}

const RATING_WORD = ['does not preserve', 'partial', 'preserves well']

export function MatrixFigure(props: FigureProps) {
  const legend = bool(props.legend, MATRIX_DEFAULTS.legend)
  const { activePart } = useFigureHighlight(props.figureId as string)
  // Direct hover on the grid: row / col are -1 when only the other axis is
  // hovered (a label or header). Hover wins over prose term highlighting.
  const [hover, setHover] = useState<{ row: number; col: number } | null>(null)
  const W = 680, H = 480
  const leftPad = 230, topPad = 80
  const cellW = 44, cellH = 38
  const rowH = 40

  const termRow = FAMILIES.findIndex((f) => f.id === activePart)
  const termCol = PROPS.findIndex((p) => p.id === activePart)
  const activeRow = hover ? hover.row : termRow
  const activeCol = hover ? hover.col : termCol
  const hasActive = activeRow >= 0 || activeCol >= 0
  const cellDim = (i: number, j: number) =>
    !hasActive || i === activeRow || j === activeCol ? 1 : 0.3
  const hoveredCell = hover && hover.row >= 0 && hover.col >= 0 ? hover : null

  return (
    <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" onMouseLeave={() => setHover(null)}>
      {activeRow >= 0 && (
        <rect x={6} y={topPad + activeRow * rowH + rowH / 2 - cellH / 2} width={leftPad + PROPS.length * cellW - 4} height={cellH + 2} fill="none" stroke="var(--accent)" strokeWidth={1.5} rx={6} />
      )}
      {activeCol >= 0 && (
        <rect x={leftPad + activeCol * cellW} y={topPad - 4} width={cellW} height={FAMILIES.length * rowH + 6} fill="none" stroke="var(--accent)" strokeWidth={1.5} rx={6} />
      )}
      {PROPS.map((p, j) => {
        const x = leftPad + j * cellW + cellW / 2
        const active = j === activeCol
        return (
          <g key={p.id}>
            <text transform={`translate(${x},${topPad - 14}) rotate(-38)`} textAnchor="start" style={{ fontSize: 11, fontWeight: active ? 700 : 400 }} fill={active ? 'var(--accent)' : 'var(--text-2)'} opacity={!hasActive || active ? 1 : 0.45}>{p.label}</text>
            <rect x={leftPad + j * cellW} y={0} width={cellW} height={topPad - 4} fill="transparent" onMouseEnter={() => setHover({ row: -1, col: j })} />
          </g>
        )
      })}
      {FAMILIES.map((f, i) => {
        const y = topPad + i * rowH + rowH / 2
        const rowActive = i === activeRow
        return (
          <g key={f.id}>
            <text x={leftPad - 12} y={y} dy="0.35em" textAnchor="end" style={{ fontSize: 11, fontWeight: rowActive ? 700 : 600 }} fill={rowActive ? 'var(--accent)' : 'var(--text)'} opacity={!hasActive || rowActive ? 1 : 0.45}>{f.label}</text>
            <rect x={0} y={y - rowH / 2} width={leftPad - 4} height={rowH} fill="transparent" onMouseEnter={() => setHover({ row: i, col: -1 })} />
            {PROPS.map((_, j) => {
              const cx = leftPad + j * cellW + cellW / 2
              const r = R[i][j]
              const fill = r === 2 ? 'var(--accent)' : r === 1 ? 'var(--accent-light)' : 'var(--muted)'
              return (
                <g key={j} opacity={cellDim(i, j)} onMouseEnter={() => setHover({ row: i, col: j })}>
                  <rect x={leftPad + j * cellW + 2} y={y - cellH / 2 + 3} width={cellW - 4} height={cellH - 6} fill={fill} stroke="var(--border)" rx={3} />
                  {r === 2 && <text x={cx} y={y} dy="0.35em" textAnchor="middle" style={{ fontSize: 12, fontWeight: 700 }} fill="white" pointerEvents="none">●</text>}
                  {r === 1 && <text x={cx} y={y} dy="0.35em" textAnchor="middle" style={{ fontSize: 12 }} fill="var(--accent)" pointerEvents="none">◐</text>}
                </g>
              )
            })}
          </g>
        )
      })}
      {hoveredCell && (() => {
        const r = R[hoveredCell.row][hoveredCell.col]
        const item = LEGEND[2 - r]
        const y = H - 36
        return (
          <g>
            <rect x={12} y={y} width={22} height={20} fill={item.fill} stroke="var(--border)" rx={3} />
            {item.marker && <text x={23} y={y + 14} textAnchor="middle" style={{ fontSize: 12 }} fill={item.markerFill}>{item.marker}</text>}
            <text x={44} y={y + 14} style={{ fontSize: 12 }} fill="var(--text)">
              <tspan fontWeight={700}>{FAMILIES[hoveredCell.row].label}</tspan>
              <tspan fill="var(--text-3)"> × </tspan>
              <tspan fontWeight={700}>{PROPS[hoveredCell.col].label}</tspan>
              <tspan fill="var(--text-2)">: {RATING_WORD[r]}</tspan>
            </text>
          </g>
        )
      })()}
      {!hoveredCell && legend && LEGEND.map((item, i) => {
        const x = 12 + i * 180
        const y = H - 36
        return (
          <g key={item.label}>
            <rect x={x} y={y} width={22} height={20} fill={item.fill} stroke="var(--border)" rx={3} />
            {item.marker && <text x={x + 11} y={y + 14} textAnchor="middle" style={{ fontSize: 12 }} fill={item.markerFill}>{item.marker}</text>}
            <text x={x + 32} y={y + 14} style={{ fontSize: 11 }} fill="var(--text-2)">{item.label}</text>
          </g>
        )
      })}
    </svg>
  )
}
