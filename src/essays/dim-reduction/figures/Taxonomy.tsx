import { Link } from 'react-router-dom'
import type { FigureProps } from './registry'
import { useFigureHighlight } from '../../runtime/store'
import { useEssay } from '../../runtime/EssayContext'

// Static taxonomy table for the nine method families covered in the
// series. Each row links to the corresponding article slug, so this
// figure doubles as a contents view. Rows are addressable as highlight
// parts (taxonomy.linear, taxonomy.local, …) so prose terms can point
// at a single family.

// No tunable data — the table is the series' fixed contents. Kept as an
// (empty) export so the knob panel and registry contract stay uniform.
export const DEFAULTS = {}

type Family = {
  n: string
  slug: string
  // Stable part id for term highlighting; reads naturally in prose.
  part: string
  title: string
  preserves: string
  methods: string
}

const FAMILIES: Family[] = [
  {
    n: '02',
    slug: '02-linear',
    part: 'linear',
    title: 'Linear',
    preserves: 'variance, independence',
    methods: 'PCA · ICA · NMF · Kernel PCA',
  },
  {
    n: '03',
    slug: '03-global-distances',
    part: 'global',
    title: 'Global distances',
    preserves: 'pairwise & geodesic distances',
    methods: 'MDS · Sammon · Isomap · diffusion maps',
  },
  {
    n: '04',
    slug: '04-local-neighborhoods',
    part: 'local',
    title: 'Local neighborhoods',
    preserves: 'who-is-near-whom',
    methods: 't-SNE · UMAP · LargeVis · PaCMAP · TriMap',
  },
  {
    n: '05',
    slug: '05-topology',
    part: 'topology',
    title: 'Topology',
    preserves: 'connectivity & shape',
    methods: 'Mapper · Reeb graphs · topo-autoencoders',
  },
  {
    n: '06',
    slug: '06-density',
    part: 'density',
    title: 'Density',
    preserves: 'how tightly packed regions are',
    methods: 'densMAP · PHATE',
  },
  {
    n: '07',
    slug: '07-discrete-grids',
    part: 'grids',
    title: 'Discrete grids',
    preserves: 'an ordered grid layout',
    methods: 'Self-Organizing Maps',
  },
  {
    n: '08',
    slug: '08-hierarchy',
    part: 'hierarchy',
    title: 'Hierarchy',
    preserves: 'tree-like structure',
    methods: 'Poincaré / hyperbolic embeddings',
  },
  {
    n: '09',
    slug: '09-learned',
    part: 'learned',
    title: 'Learned reps',
    preserves: 'whatever the objective says',
    methods: 'autoencoders · VAE · scVI · parametric UMAP',
  },
  {
    n: '10',
    slug: '10-capstone',
    part: 'capstone',
    title: 'Capstone',
    preserves: 'open questions',
    methods: 'gaps · combinations · opportunities',
  },
]

export default function Taxonomy(props: FigureProps) {
  const { basePath } = useEssay()
  const { activePart } = useFigureHighlight(props.figureId as string)
  // A string activePart targets one row; null means the whole figure is
  // highlighted (the <Figure> frame handles that), undefined means none.
  const partActive = typeof activePart === 'string'

  return (
    <div className="taxonomy">
      <div className="taxonomy-header">
        # · family · preserves · methods
      </div>
      <ul className="taxonomy-list">
        {FAMILIES.map((f) => {
          const isActive = partActive && activePart === f.part
          return (
            <li
              key={f.n}
              className="taxonomy-row"
              style={{
                transition: 'background 0.15s ease, opacity 0.15s ease',
                ...(isActive
                  ? {
                      background: 'var(--accent-light)',
                      borderRadius: 4,
                      paddingLeft: '0.5rem',
                      paddingRight: '0.5rem',
                      marginLeft: '-0.5rem',
                      marginRight: '-0.5rem',
                    }
                  : partActive
                    ? { opacity: 0.45 }
                    : undefined),
              }}
            >
              <span className="taxonomy-num">{f.n}</span>
              <div className="taxonomy-main">
                <Link to={`${basePath}/${f.slug}`} className="taxonomy-title">
                  {f.title}
                </Link>
                <span className="taxonomy-preserves">{f.preserves}</span>
              </div>
              <span className="taxonomy-methods">{f.methods}</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
