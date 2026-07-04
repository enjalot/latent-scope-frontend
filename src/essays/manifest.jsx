// Registry of every essay published on the site. App.jsx builds routes
// from this list (each entry is lazy-loaded, so an essay's code only
// downloads when its route is visited) and Home.jsx renders its Essays
// section from it.
//
// Fields:
//   slug        route segment: /essays/<slug>
//   title       display title (Home page + cards)
//   description one-line subtitle
//   date        publish date (YYYY-MM-DD)
//   kind        'moonshine' | 'moonshine-series' | 'legacy'
//               moonshine kinds also get a /essays/<slug>/:article route
//               (used by series articles; harmless for single articles)
//   load        dynamic import of the essay's routable component
//   image       optional thumbnail for the Home page card
//   hidden      optional: exclude from the Home page (still routable)

const essays = [
  {
    slug: 'nav-by-sim',
    title: 'Navigating by Similarity',
    description: 'High-dimensional Wayfinding with Sparse Autoencoders',
    date: '2025-03-17',
    kind: 'legacy',
    image: '/navbysim/navbysim.png',
    load: () => import('./nav-by-sim'),
  },
  {
    slug: 'touch-tokens',
    title: 'Touch Tokens',
    description: 'Feeling out the building blocks of embeddings',
    date: '2025-03-18',
    kind: 'legacy',
    hidden: true, // unpublished draft
    load: () => import('./touch-tokens'),
  },
  {
    slug: 'dim-reduction',
    title: 'What Dimensionality Reduction Preserves',
    description:
      'A ten-part tour of dimensionality reduction methods, organized by what they try to preserve: PCA, t-SNE, UMAP, PHATE, Mapper, self-organizing maps, hyperbolic embeddings, and beyond.',
    date: '2026-07-03',
    kind: 'moonshine-series',
    load: () => import('./dim-reduction'),
  },
  {
    slug: 'anisotropy',
    title: 'Anisotropy: the shape of an embedding cloud',
    description:
      'Why random pairs of embeddings can look suspiciously similar, and what that does to every cosine, neighbor graph, and 2D map we compute.',
    date: '2026-07-03',
    kind: 'moonshine',
    load: () => import('./anisotropy'),
  },
];

export default essays;
