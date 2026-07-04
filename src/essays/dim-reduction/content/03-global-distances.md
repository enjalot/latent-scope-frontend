---
title: Preserving Global Distances
description: Classical MDS, Sammon mapping, Isomap, diffusion maps. From Euclidean to geodesic to diffusion distance.
series: dim-reduction
order: 3
---

Linear methods force the data into a flat subspace. That works when the
data is already flat, but most interesting data is not. A ribbon of
points that curls through three-dimensional space cannot be laid out on
a plane by any rotation. The distances *through* the ribbon are much
longer than the distances *through empty space*, and it is the distances
through the ribbon that carry the meaning.

This article is about methods that take distances seriously, and the key
move each of them makes is redefining what distance means. Classical
multidimensional scaling starts from a given distance matrix and asks
for a low-dimensional arrangement that reproduces it. Sammon mapping
adjusts the emphasis so that small distances are preserved more
faithfully than large ones. Isomap replaces straight-line distance with
the distance *along the data*. Diffusion maps replace it with the
distance traveled by a random walk. Each is a different answer to the
same question: what does "far" really mean?

## Classical MDS: given the distances, recover the points

The oldest member of the family, classical multidimensional scaling,
takes a distance matrix as input. You hand it the pairwise distances
between $n$ items, and it returns :term[a set of coordinates]{to=mds} in
$k$ dimensions whose pairwise distances match your input as closely as
possible.

You can think of MDS as the answer to a natural geometric question:
given how far apart your items should be, where should they go? The
classical solution is a double-centering of the squared distance matrix
followed by an eigendecomposition, very much in the same family of tools
as PCA. In fact, when the input distances are Euclidean distances of the
original data, classical MDS *is* PCA, just reached from a different
starting point. MDS is the more general tool because the input distances
do not have to come from any embedding at all: they might be perceptual
distances between colors, edit distances between strings, or any
pairwise similarity you can encode.

:::figure{id=mds}
Three views of the same data. Left: the original points (when we have
them). Middle: the distance matrix MDS actually consumes, where every
cell is the distance between two items. Right: the 2D embedding MDS
recovers by minimising a stress objective. Press *replay solver* (or
switch datasets) to watch the optimisation itself: the points start at a
random scatter and crawl into place as the stress drops. Switch to
*distances only* to feed in a matrix that never came from coordinates at
all; MDS doesn't know the difference.
:::

Classical MDS tries to match all pairwise distances with equal emphasis.
That is a reasonable goal only when the data is roughly flat. When it is
not, classical MDS ends up compromising every distance and getting none
of them right. The next member of the family pushes on this.

## Sammon mapping: some distances matter more

Sammon mapping, introduced by John Sammon Jr. in 1969, starts from the
observation that not all distance errors are equally bad. If two items
are supposed to be 10 units apart and the embedding places them at 11,
that is a minor error. If they are supposed to be 0.5 units apart and
the embedding places them at 1.5, the topology is wrong: what should
have been near neighbors have been pulled apart.

Sammon's stress function divides each squared distance error by the
original distance itself, giving small distances higher weight. The
effect is that the optimiser fights hard to get
:term[local relationships]{to=sammon} right, tolerating larger errors in
the global layout when necessary.

:::figure{id=sammon}
A multi-scale dataset: two tight clusters at the centre plus four
far-away anchor points. Toggle between classical MDS and Sammon and
watch the embedding morph between the two solutions: the cluster points
shift as Sammon pours its error budget into getting the short pairs
right, while the anchors drift off their true distances to pay for it.
The per-bucket error bars make the trade explicit — Sammon pushes the
short-distance bars down at the cost of taller long-distance bars — and
the Shepard diagram tightens against the diagonal at the short end.
Hover any point to isolate it in both layouts and pick out its pairs in
the Shepard diagram: a cluster point's pairs hug the diagonal under
Sammon; an anchor's pairs fan away from it.
:::

Sammon also marks the transition from the MDS family to the
neighbor-based family of article 4. It up-weights local relationships,
and once you treat those as mattering more than global ones for most
real data, the neighbor-based methods follow naturally.

## Isomap: distances through the data, not through empty space

Even Sammon mapping computes distances as Euclidean distances in the
original coordinate space. That is a problem for curved data. Consider
the classic example: a two-dimensional ribbon rolled up into three
dimensions, the Swiss roll. Two points at opposite ends of the ribbon
are far apart along the ribbon, but they might be close to each other
through the empty air in the middle of the roll. Any method that uses
Euclidean distance will treat them as neighbors and fold the ribbon back
on itself.

Isomap, introduced by Tenenbaum, de Silva, and Langford in 2000, fixes
this with a beautifully simple trick: redefine distance as shortest path
in a $k$-nearest-neighbor graph. Build a graph where each point connects
only to its $k$ closest neighbors. The distance between two points is the
total length of the shortest path through the graph between them. For a
swiss roll with reasonable point density, this *geodesic* distance
respects the curvature: two points at opposite ends of the ribbon are
far apart even if they sit next to each other in three dimensions,
because the shortest path has to walk all the way along the ribbon.

Feed the geodesic distance matrix into MDS and you have Isomap. The
embedding now tries to preserve distances along the manifold, which is
usually what we meant by "distance" in the first place.

:::figure{id=isomap}
A swiss roll with two endpoints fixed at opposite ends of the spiral.
The dashed orange line is their straight-line Euclidean distance,
cutting through empty space. The blue path is the geodesic, the
shortest walk through the kNN graph. Slide $k$ to change the graph: too
small and the graph fragments into disconnected pieces, breaking the
geodesic entirely; in the sweet spot the right panel unrolls the spiral
into a clean ribbon, ordered by colour from one end to the other; too
large and *shortcut edges* (highlighted in orange) jump across the
empty middle of the roll, folding the ribbon back into a jumble and
collapsing the geodesic toward the Euclidean answer. Finding that sweet
spot is the main craft of using Isomap.
:::

Isomap's weakness is the same graph that makes it work. If the sampling
is too sparse, the shortest-path approximation becomes unreliable. If
$k$ is chosen too large, :term[shortcut edges]{to=isomap.roll} appear: an edge connecting points
that are close in 3D but far along the manifold, which crash the
geodesic computation back toward a Euclidean one. The method is at its
best on densely sampled, smooth manifolds and gets shakier as those
assumptions weaken.

> The "right" $k$ for Isomap depends on the intrinsic dimension and the
> sampling density of the data. Too small and the graph becomes
> disconnected. Too large and shortcut edges distort the geodesic. There
> is no universal rule, and choosing $k$ is the main piece of craft in
> using Isomap.

## Diffusion maps: distance as a probability of connection

Isomap measures distance as the shortest path through a single chain of
neighbors. But what if we care about *how many paths* there are between
two points, not just the length of the shortest one? Two regions that
are connected by many independent paths should feel "closer" than two
regions that are connected by only one thin bridge, even if the single
thin bridge is shorter.

Diffusion maps, developed by Coifman and Lafon in 2006, formalize this
intuition by defining distance through a random walk. Imagine releasing
a cloud of walkers at one point. They wander around the kNN graph,
stepping to random neighbors with probabilities weighted by similarity.
After a few steps, the cloud has spread: some of it has reached point B,
more of it has reached point C. The *diffusion distance* between two
points is the difference between where the walker goes from one vs.
where it goes from the other, averaged over all possible destinations.

Diffusion distance is robust to noise (a single bad edge has little
effect if there are many good ones) and sensitive to bottlenecks (two
well-connected regions linked by a :term[thin bridge]{to=diffusion.graph} are
treated as further apart than their graph distance suggests).

:::figure{id=diffusion}
A dumbbell graph: two dense clusters joined by a narrow bridge. Click a
node to seed a random walk, then press *play* (or drag the steps
slider) to watch the probability cloud spread like heat: it floods the
seeded lobe within a few steps, then seeps through the bridge only
slowly. Blue intensity shows the probability of landing at each node. The summary at
right groups that probability mass by region and compares diffusion
distances from the selected node to three alternative starts: nearby,
on the bridge, and in the opposite lobe. The key point is not just the
shortest path length. Nodes in the same lobe have many overlapping
future walks, so their distributions look similar; nodes across the
bottleneck stay diffusion-far until enough probability leaks through the
bridge.
:::

Diffusion maps have been influential in single-cell biology, where they
handle branching developmental trajectories gracefully, and in analysis
of dynamical systems, where the random walk is a natural model of how
the system transitions between states. They are also one of the
theoretical linchpins for understanding the broader family of spectral
methods, because the diffusion operator's eigenvectors are exactly the
embedding coordinates.

## What the distance-preserving family gets and misses

All four methods take distances as their primary object and try to
reproduce them in two or three dimensions. Their family resemblance is
strong: each one is essentially MDS applied to a cleverer distance
matrix. The progression, from Euclidean to weighted-Euclidean to
geodesic to diffusion, is a progression of increasingly realistic
definitions of what "close" means.

What the family shares, for better and worse, is a commitment to
distance as the governing concept. When distance is a meaningful
quantity (spatial data, feature vectors with calibrated scales,
perceptual studies), this family is strong. When distance is not
meaningful, or when the interesting structure is in *who is near whom*
rather than *how far apart*, the distance-based methods start to
struggle. The next article is about methods that give up on preserving
distances and focus on preserving neighbor lists instead. That shift,
from distances to neighborhoods, drives much of the modern
dimensionality reduction landscape.
