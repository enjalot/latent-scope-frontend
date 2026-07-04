---
title: Hyperbolic Embeddings
description: When your data is tree-shaped, Euclidean space cramps it. Hyperbolic geometry does not.
series: dim-reduction
order: 8
---

Every method we have seen so far embeds data into Euclidean space: a
flat plane, or a flat higher-dimensional space when more coordinates are
needed. This is such a default assumption that it is easy to miss. But
Euclidean space has a property that fights some kinds of data: its
volume grows slowly. The number of points you can fit at distance $r$
from the origin, in a plane, is proportional to $r$. As distance grows,
you get linearly more room.

Many interesting datasets do not grow linearly. Hierarchies, trees,
taxonomies, and branching structures all have *exponential* growth: each
level of depth has twice (or some constant factor more) nodes than the
one above. A binary tree of depth 20 has about a million leaves, and
trying to embed all of them in a plane with sensible distances is
impossible; :term[the leaves pile up and overlap at the edge]{to=volume.euclidean}
no matter how cleverly you arrange the interior.

Hyperbolic space, the standard non-Euclidean geometry with constant
negative curvature, has exponential volume growth. The number of points
at hyperbolic distance $r$ from the origin grows like $e^r$. This is the
same growth rate as a tree. When you embed a tree into hyperbolic space,
you can give every node plenty of room and preserve distances exactly;
you no longer have to compromise the geometry to fit the data.

## The Poincaré disk

There are several ways to model hyperbolic space. The most widely used
in dimensionality reduction is the **Poincaré disk**: the interior of
the unit circle in the plane, with a special metric. Distances grow as
you approach the boundary. A step near the center takes you some small
distance in hyperbolic terms; a step the same visual size near the
boundary takes you a huge hyperbolic distance. The boundary itself is
infinitely far away.

Geodesics (shortest paths) in the Poincaré disk are not straight lines.
They are either diameters of the disk or circular arcs perpendicular to
the boundary. This is famously illustrated in Escher's *Circle Limit*
woodcuts, where identical-sized hyperbolic triangles appear, in the
Euclidean view, to shrink toward the boundary. The figure below makes
this concrete.

:::figure{id=volume}
A balanced tree embedded in two ways. Left: Euclidean radial layout.
Increasing the depth or branching factor crowds the leaves against the
boundary. Right: the same tree in the Poincaré disk. Every node has
room; every edge has roughly the same hyperbolic length; the whole tree
fits comfortably inside the unit disk no matter how deep it goes. Press
*grow level by level* to add one generation at a time: each new layer
crushes onto the Euclidean rim, while the hyperbolic branches keep
fanning into fresh space.
:::

The visual compression near the boundary can be disorienting at first,
but it is not a distortion in the intrinsic geometry. To someone living
in the hyperbolic plane, all those shrinking triangles near the boundary
would look the same size. The Poincaré disk model is what hyperbolic
geometry looks like from the outside, in the same sense that a world map
projects the sphere onto a plane and introduces visual distortions. The
underlying geometry is consistent; only the rendering is weird.

## Embedding data into the Poincaré ball

Nickel and Kiela's 2017 paper "Poincaré Embeddings for Learning
Hierarchical Representations" popularized this idea in machine learning.
They wanted to embed words from WordNet (or concepts from any
hierarchical taxonomy) into a low-dimensional space so that the graph
distance between concepts would be preserved. Euclidean embeddings at
practical dimensions had to choose between preserving local
relationships and preserving global structure; neither was good.
Poincaré embeddings, with the same or smaller dimension, could do both,
because the geometry matched.

The algorithm is an ordinary gradient descent on a loss defined using
the Poincaré distance formula, with one twist: since the parameter space
is the unit ball (not a Euclidean space), you cannot just take Euclidean
gradient steps. You take *Riemannian* gradient steps, which account for
how the metric changes across the ball. In practice this amounts to
rescaling the gradient by a factor that becomes small near the boundary,
so that a point near the edge does not jump over it in one step.

A 2018 follow-up paper proposed the Lorentz (hyperboloid) model as a
numerically more stable parameterization: same geometry, different
coordinates. Subsequent work extended the idea to variants of UMAP and
t-SNE that embed into hyperbolic rather than Euclidean space, opening
the technique to general dimensionality reduction rather than only graph
embeddings.

> The Poincaré distance between two points $u$ and $v$ in the unit ball is
> $$d(u, v) = \operatorname{arcosh}\!\left(1 + 2\,\frac{\lVert u - v\rVert^2}{(1 - \lVert u\rVert^2)(1 - \lVert v\rVert^2)}\right).$$
> The outer $\operatorname{arcosh}$ makes distances grow quickly as points
> approach the boundary (norm 1). The denominator is what creates the
> exponential-volume effect.

## Single-cell biology rediscovers hierarchy

One of the most useful applications of hyperbolic embeddings in
ML-adjacent work has been in single-cell biology. In 2020, Klimovskaia
and colleagues published "Poincaré maps for analyzing complex
hierarchies in single-cell data," arguing that cell developmental
trajectories are intrinsically tree-shaped (a progenitor cell divides
into daughters, which divide into further-specialized granddaughters). A
method that assumes Euclidean latent structure will garble this
hierarchy; a method that matches the space to the tree will lay it out
cleanly.

The choice of target geometry acts as a prior over what your data looks
like. Euclidean space is a prior that says the data lives in a flat,
isotropic region. Hyperbolic space is a prior that says the data has
exponential branching or hierarchical structure. If you know your data
matches that prior, the embedding will look much better; if you do not,
it will look worse.

## Poincaré geodesics, up close

The shortest path between two points in the Poincaré disk is not the
straight line you see between them; it is the circular arc perpendicular
to the boundary. This matters because it means the shortest path between
two points on opposite sides of the disk
:term[bends toward the center]{to=geodesic}. Points far from the origin
"want" to be connected through the middle,
which is how the hyperbolic plane accommodates its exponential room:
long-distance traffic routes through the hub.

:::figure{id=geodesic}
Drag the two blue points. The gray line is the Euclidean segment between
them; the blue arc is the hyperbolic geodesic. As the points approach
the boundary, the geodesic bends more strongly toward the origin. Near
the center, where the hyperbolic metric is close to Euclidean, the two
almost coincide.
:::

This bending behavior is worth building intuition for, because it is why
hyperbolic embeddings are able to pack so much structure into a small
Euclidean-looking area. Outer regions communicate through the interior,
so they do not have to be arranged on a line or a curve; they can be
placed in angular rings at any depth, with the knowledge that the
geometry will route their interactions sensibly.

## The cost

Hyperbolic embeddings are not free. The parameterization is numerically
delicate: points near the boundary have very high gradient norms and can
easily drift out of the valid region. Interpretation is harder than in
Euclidean space, because "distance" on the screen does not correspond to
the actual hyperbolic distance. Many ML pipelines assume Euclidean
latent spaces, so integrating hyperbolic embeddings with downstream
tools takes work.

The most important cost is that the approach only pays off when the data
is actually tree-shaped. If you run Poincaré embedding on data that
lacks hierarchical structure, the method works, but it buys you nothing
over Euclidean methods. It may even hurt, because you are paying the
numerical and interpretive cost of hyperbolic geometry for data that
does not benefit. This is why you see hyperbolic embeddings most often
on WordNet, taxonomies, phylogenetic trees, and developmental
trajectories, and rarely on image or audio embeddings.

## A broader principle

Hyperbolic embeddings show most clearly that the geometry of the target
space is a design choice, not a fixed constraint. Most methods default
to Euclidean space
because it is familiar and because the math works out nicely. But
Euclidean space is a particular choice, with particular assumptions
baked in. For the right kind of data, other geometries can do better.

Related ideas include spherical embeddings (for data with a natural
rotational symmetry or an intrinsic radius), product spaces (Euclidean
times hyperbolic times spherical, for data with mixed structure), and
pseudo-Riemannian spaces for relativistic data. None of these are as
well-developed as hyperbolic embeddings, but each one represents the
same move: match the geometry to the data.

The next article is about the last major family in this series: learned
representations. Here the geometry of the target space is itself
learned, not chosen in advance, because the embedding is produced by a
neural network trained to reproduce whatever properties the training
objective rewards.
