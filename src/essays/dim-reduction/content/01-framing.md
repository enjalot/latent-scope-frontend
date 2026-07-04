---
title: The Geometry of High-Dimensional Data
description: Before comparing methods, we need to agree on what they are trying to preserve. This article builds intuition for high-dimensional space and the different kinds of structure a dimensionality reduction method might care about.
series: dim-reduction
order: 1
tags:
  - framing
---

An image classifier produces a 2048-dimensional feature vector. A
language model produces a 4096-dimensional residual stream activation.
A single-cell RNA sequencing assay produces a 20,000-dimensional
expression profile. Each row of such data sits in a space we cannot
draw or picture directly. Dimensionality reduction exists to give us a
picture, but a picture of what?

Every dimensionality reduction method throws information away. The
interesting question is not whether it distorts the data, but *which*
properties it tries to keep and which it is willing to sacrifice.
t-SNE, UMAP, PCA, PHATE, and Mapper are not different answers to the
same question, they are answers to different questions. Once you see
that, choosing between them becomes a question about your data and
your goal, rather than about which scatter plot looks best.

This series works through the main families of methods one by one,
organized by what they preserve. This first article establishes the
shared vocabulary: what high-dimensional space actually looks like,
what kinds of structure live in it, and how we can tell whether a
projection has kept them or lost them.

## How high-dimensional space behaves

Most of our visual intuition for points, distances, and neighborhoods
comes from two- and three-dimensional space. Those intuitions do not
extend to the spaces where real ML data lives. Before we can reason
about methods that summarize high-dimensional data, we have to see
how high-dimensional space behaves on its own.

Consider a uniform random cloud of points and measure the distances
between every pair. In one or two dimensions, those distances are
spread out: some points are close, some are far. As the dimension
grows, the distances bunch up, until every pair of points is roughly
the same distance apart. :term[The plot below]{to=curse-of-dimensionality}
lets you watch this happen.

:::figure{id=curse-of-dimensionality}
Distribution of pairwise distances between uniformly random points,
as the dimension increases. Drag the dimension slider, or press sweep
to play the whole journey: the wide spread of distances collapses into
a narrow spike, until nearly every pair is the same distance apart.
"Nearest" and "farthest" stop being meaningful.
:::

In everyday three-dimensional space, the nearest point is clearly
closer than the farthest point. In fifty-dimensional space drawn from
the same uniform distribution, the ratio between them shrinks toward
one. Notions we take for granted, like "the closest point is
meaningfully close," weaken as dimension grows. This effect is
sometimes called the concentration of distances, and it is a core
piece of the *curse of dimensionality*.

Real data is rarely uniform, and the non-uniformity is what gives
dimensionality reduction something to work with. A
language model's embeddings do not fill their 4096-dimensional ambient
space uniformly. They cluster, they trace curves and manifolds, they
leave enormous regions empty. The meaningful information lives on a
much lower-dimensional structure *embedded* in a high-dimensional
container. Dimensionality reduction tries to find that structure and
render it at a size we can look at.

> The intrinsic dimension of a dataset is the number of parameters
> needed to describe it, which is often far smaller than the number of
> coordinates it is stored in. A rotating 3D object recorded as
> 100-pixel-by-100-pixel frames has 10,000 coordinates but only a few
> degrees of freedom. Finding the intrinsic dimension is itself an
> active research area.

## What counts as "structure"?

If the goal of dimensionality reduction is to preserve structure, we
should be precise about what structure means, and there is no single
answer: the same dataset has many kinds of structure layered on top of
each other, and different methods foreground different layers.

Take a simple two-dimensional dataset with two intertwined crescents.
We can look at it through at least five different lenses, shown in
:term[the figure below]{to=lenses-view}. Each lens emphasizes a different property and ignores
others. A dimensionality reduction method is, in effect, a decision
about which lens to prioritize when the data gets squished.

:::figure{id=lenses-view}
The same dataset seen through five different notions of structure.
A dimensionality reduction method is, implicitly, a choice about
which of these to prioritize when projecting to fewer dimensions.
:::

:inline-viz{kind=lens-mini name=points} The **points** view shows raw coordinates. Two crescents, each a
different color. This is the rawest form of the data.

:inline-viz{kind=lens-mini name=distances} The **distances** view draws lines for every pairwise distance,
thicker for shorter distances. It shows that each crescent is a tight
cluster, but also that some points in one crescent are closer to
points in the other crescent than to points at the far end of their
own. A method that tries to preserve all pairwise distances will have
a hard time with this shape, because the raw distances are misleading:
two points can be geometrically close while being meaningfully far
apart along the crescent.

:inline-viz{kind=lens-mini name=neighbors} The **neighbors** view draws edges only to each point's $k$ nearest
neighbors. The crescents become two connected clusters. This is a much
more honest picture of the data's shape, which is why many of the most
successful methods we will meet later, t-SNE and UMAP among them,
build on neighborhood graphs rather than raw distances.

:inline-viz{kind=lens-mini name=density} The **density** view colors the plane by how many points live nearby.
The dense cores of the crescents show as bright regions; the sparse
tails fade out. Density is information that most methods discard:
clusters get repositioned to be visually separated even when one is
actually much denser than another.

:inline-viz{kind=lens-mini name=topology} The **topology** view ignores metric detail entirely and summarizes
what connects to what. Two crescents show up as two connected
components with no loops. Topology is a lossy summary, but it captures
properties that survive distortion, and it is what a method like
Mapper is designed to preserve.

No single projection can maintain all five views faithfully. When a
method collapses 4096 dimensions to 2, it has to favor some of these
properties over others. The rest of this series is organized around
those choices.

## How do we tell if the picture is honest?

Once we know what a method is trying to preserve, we can ask whether
it succeeded. The field has settled on a few standard measurements,
each of them probing a different kind of honesty.

**Trustworthiness** asks: of the points that appear close in the 2D
picture, how many were actually close in the original space? A
trustworthy embedding does not invent :term[false neighbors]{to=trust-continuity.trust}.
**Continuity** asks the reverse: of the points that were close in the
original space, how many are still close in the picture? A continuous
embedding does not rip apart neighborhoods that belonged together. A
projection can be high on one and low on the other, and usually is.
Together they make a reasonable first check.


:::figure{id=trust-continuity}
Two failure modes of a dimensionality reduction, side by side. The
toggle picks which honesty the embedding violates, and the embedded
panel animates the re-projection so you can watch it happen: in "false
neighbors" the projection pulls the two unrelated clusters together
and trustworthiness falls; in "torn neighborhood" it rips a handful of
points out of their cluster and continuity falls. Red lines mark the
broken pairs, brighter for worse betrayals — note that each failure
mode hurts one score far more than the other.
:::

**Stress** measures how well all pairwise distances agree between the
original space and the embedding. It is the natural metric when a
method targets global distance preservation (like MDS), and an unfair
one when the method deliberately warps distances in favor of
neighborhoods (like t-SNE). **:term[Shepard diagrams]{to=shepard-diagram}** plot original
distances against embedded distances point by point, revealing at a
glance where and how the projection distorts.

:::figure{id=shepard-diagram}
A Shepard diagram. Each dot is one pair of points: x-axis is their
distance in the original space, y-axis is their distance in the
embedding. A perfectly distance-preserving method puts every dot on
the dashed diagonal. Toggle to the neighborhood-preserving regime and
watch the same pairs move: small distances stay put while large ones
get squashed off the diagonal, bending the cloud into an S. The
stress score summarizes this scatter in a single number, and climbs
as the cloud leaves the diagonal.
:::


No single number captures quality, because quality itself is
conditional on what you wanted to preserve. When we compare methods in
later articles, we will return to these measures and show what each
family looks good (and bad) at.

## The series, at a glance

The remaining nine articles each take :term[one family of methods]{to=taxonomy},
built around a single answer to "what should we preserve."

:::figure{id=taxonomy}
The nine method families covered in this series, organized by what
they try to preserve. Each family is a different answer to the same
question. Methods within a family share a viewpoint; methods across
families do not.
:::

The progression is roughly from the simplest idea (preserve variance
along orthogonal directions) to the most elaborate (learn a neural
network whose latent space is the dimensionality reduction). Along
the way, each family makes a new move that the previous family could
not: preserve nonlinear distances, preserve neighborhoods rather than
distances, preserve topology rather than geometry, preserve density,
fit data to a grid, use a non-flat geometry, learn from data. We
finish with a capstone article on open problems, where the families
we have met suggest directions they have not yet gone.

Each article is self-contained, but they build on each other. The
linear family sets up problems that the nonlinear families try to
solve. The local-neighborhood family creates evaluation puzzles that
the topological and density families respond to. The
learned-representation family borrows ideas from everywhere else.
The articles can be read in order as a narrative, or individually for
reference.
