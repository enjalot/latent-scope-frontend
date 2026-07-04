---
title: Preserving Local Neighborhoods
description: t-SNE, UMAP, and the neighbor-graph family. How "who is near whom" became the dominant paradigm.
series: dim-reduction
order: 4
---

Preserving distances is the most honest thing a projection can try to
do, but it is also the most constraining. If a dataset lives on a curved
manifold, every nonlinear method in article 3 had to work hard to
measure distance correctly (geodesically, diffusively, through a graph).
What if we simply gave up on distances and cared only about *who is a
neighbor of whom*?

That move, from distance preservation to neighborhood preservation,
defines the modern era of dimensionality reduction. A scatter plot that
gets neighbor lists right will cluster tightly, show cluster structure
clearly, and be visually striking. A scatter plot that gets distances
right tends to look smooth and featureless, so for visualization the
neighborhood-preserving methods won out.

The cost is that such plots tell you almost nothing about global
geometry. The distance between two clusters in a t-SNE plot is not
meaningful. The size of one cluster relative to another is not
meaningful. These follow from the objective.
If you treat a t-SNE or UMAP plot as if its global coordinates mattered,
you will reliably fool yourself. Understanding what this family
preserves and what it discards is essential for reading its output
honestly.

## From neighbors to forces

Every method in this family shares one core mechanism: pull near
neighbors together, push everyone else apart. The details change from
method to method (how the push and the pull are defined, what counts as
a neighbor, what the distribution of forces looks like at long range),
but the shared shape is the same. The figure below shows the mechanism
in its simplest form.

:::figure{id=forces}
A high-dimensional dataset with five clusters, laid out by a live
attract-repel simulation: it starts as a random scatter and organizes
itself on screen. Attractive forces act only between each point and its
k nearest neighbors in the original space; repulsive forces act between
every pair. This is a simplified version of what t-SNE and UMAP do, and
the qualitative behavior is very similar: clusters tighten, separate,
and become visible. Moving the sliders perturbs the running layout;
restart replays the settling from scratch.
:::

Watch what happens when you increase $k$: neighborhoods overlap more, and
the clusters stop separating cleanly because too many cross-cluster
points become "neighbors." Reduce $k$ too far, and the graph becomes
fragmented, with each cluster breaking into sub-pieces. The right window
of $k$ depends on the data. This is one of the most important
hyperparameters in this family, and it has different names in different
methods: *perplexity* in t-SNE, *n_neighbors* in UMAP, but the knob does
the same job.

## LLE and Laplacian eigenmaps: the spectral roots

Before t-SNE, the first attempts to do neighborhood-preserving DR were
spectral. Locally Linear Embedding, Roweis and Saul's 2000 paper,
noticed that in a smooth manifold, each point can be approximated as a
weighted average of its neighbors. LLE solves a system to find those
weights, then finds low-dimensional coordinates in which each point is
the same weighted average of its (now 2D) neighbors. The result
preserves local geometry by construction.

Laplacian Eigenmaps, Belkin and Niyogi's 2003 paper, works from a graph
Laplacian. Build the kNN graph, weight edges by similarity, and find the
smallest nonzero eigenvectors of the graph Laplacian. Those eigenvectors
are the embedding coordinates. Points that share many neighbors end up
close; points that are disconnected in the graph can end up anywhere.

Both are clean, elegant, and have closed-form solutions. Both also tend
to produce embeddings that are overly smooth, with clusters bleeding
into each other rather than separating. They set up the problem that the
next generation of methods would solve by switching to probabilistic and
optimization-based approaches.

## t-SNE: a probabilistic lens on neighbors

t-SNE, introduced by van der Maaten and Hinton in 2008, reframes the
problem probabilistically. For each pair of points in the original
space, compute a conditional probability: given point $i$, the probability
that $j$ is its neighbor, under a Gaussian centered at $i$. The variance of
each Gaussian is tuned so that the *perplexity* (a smooth analog of the
number of effective neighbors) matches a user-specified value. This
gives a probability distribution over neighbors for each point.

In the low-dimensional space, t-SNE uses a Student's t-distribution to
define the same kind of probabilities. It then minimizes the KL
divergence between the high-D and low-D distributions. Two key design
choices make t-SNE characteristic. First, using a t-distribution in low
dimensions rather than another Gaussian gives the embedding heavier
tails; this fights the "crowding problem" where everything tries to
collapse into the middle. Second, minimizing KL rather than a symmetric
divergence means t-SNE punishes putting close neighbors far apart much
more than it punishes putting far points close; this is why t-SNE
clusters are tight and well-separated, often misleadingly so.

> The "crowding problem" is a consequence of the volumes of balls growing
> very differently in high versus low dimensions. A Gaussian falls off too
> quickly in 2D to accommodate all the neighbors that fit around a point
> in 50D. The t-distribution's heavier tails leave room for more of them.

## UMAP: fuzzy simplicial sets, attract and repel

UMAP, McInnes and Healy's 2018 method, arrives at a similar place from a
different direction. Its theoretical story is about fuzzy simplicial
sets from algebraic topology, which sounds exotic but operationally
reduces to "build a weighted neighbor graph with locally-adaptive
radii." The weights represent fuzzy membership: how strongly does $j$
count as a neighbor of $i$, given that $i$'s nearest neighbor is treated
as distance 1 and others are scaled accordingly?

The low-dimensional graph uses a parametric family of similarity curves,
and UMAP optimizes cross-entropy between the high-D and low-D fuzzy
graphs. Edges with strong membership in the high-D graph create
attractive forces in the layout; non-edges (sampled) create repulsive
forces. This directly maps to the :term[pull-and-push picture]{to=forces}
in Figure 1.

UMAP is typically faster than t-SNE because it uses stochastic gradient
descent with negative sampling ($O(n)$ per epoch) rather than a denser
gradient, and because its nearest-neighbor stage uses approximate
methods. It also tends to preserve slightly more global structure than
t-SNE, making inter-cluster distances a bit more meaningful (though
still not *actually* meaningful).

## The n_neighbors knob, and what "local" means

The hyperparameter that names this family (n_neighbors, perplexity, $k$)
is the most consequential setting in practice. It controls the radius of
the local neighborhood: how far do you have to go before a point stops
counting as "near"?

:::figure{id=perplexity}
A multi-scale dataset (three large super-clusters, each containing three
sub-clusters), laid out live by an attract-repel simulation. Drag
n_neighbors and watch the layout reorganize: small $k$ emphasizes the
sub-cluster structure; large $k$ averages over it and reveals only the
super-clusters. There is no "right" value; different k answer different
questions about the data.
:::

Small $k$ makes the method aggressive about fine-scale structure: it will
separate anything that is even slightly a sub-cluster. Large $k$ averages
over local fluctuations and emphasizes larger-scale organization. Data
with structure at multiple scales (which is most real data)
:term[looks different]{to=perplexity} at different $k$, and there is no
universal right answer. The best practice is to run the method at
several $k$ and see which views are consistent across settings and which
only appear at specific ones. Structure that shows up only at one $k$ is
suspicious.

## PaCMAP, TriMap, LargeVis: what came next

After UMAP, several methods tried to push the family further. PaCMAP
(Wang and Rudin, 2021) argues that t-SNE and UMAP are two-term
objectives (attract near, repel everything else) that fail at
multi-scale structure, and introduces a three-term objective with
"mid-near" pairs pulling with moderate strength. This gives noticeably
better preservation of global structure in practice. TriMap (Amid and
Warmuth, 2019) replaces pair-based objectives with *triplet*
constraints: for anchor point a, near point n, and far point f, require
the embedding to place n closer to a than f is. LargeVis (Tang et al.,
2016) predates UMAP and shares much of its architecture, but was
optimized for very large datasets.

These methods are close cousins of t-SNE and UMAP, not revolutions. They
chip away at known weaknesses, especially around preserving global
structure. For most ML-adjacent workflows, UMAP remains the default,
with t-SNE close behind, and the alternatives used when the default
produces something visibly wrong for your data.

## Why the same data looks different under different methods

:term[Running several methods on the same dataset]{to=compare} is a good
way to calibrate what is signal and what is artifact. Where all methods agree, you can be
confident the structure is real. Where they disagree, you have found a
place where the methods' different priors matter.

:::figure{id=compare}
The same five-cluster dataset projected by PCA, Isomap, a t-SNE-like
neighbor-graph layout, and a UMAP-like layout. Hover any point to
highlight it, and its cluster, in all four views at once. PCA preserves
global distances but does not separate clusters. Isomap unrolls the
global geometry. The neighbor-based methods produce tighter clusters
with better separation but give up global faithfulness. The cluster
shapes are largely artifacts of the optimization; only the membership is
meaningful.
:::

## Reading these plots honestly

A practitioner habit worth developing: when looking at a t-SNE or UMAP
plot, ask what you are allowed to conclude. You can usually conclude
that points in the same visual cluster are neighbors in the original
space. You can often conclude that points in different visual clusters
are not neighbors. You *cannot* conclude anything about the shapes,
sizes, or relative positions of clusters, or about the distance between
any two specific points, or about whether a "gap" in the plot
corresponds to a gap in the data.

Used with this mental filter, the neighborhood-preserving family is
genuinely useful. It is the default visualization for language model
embeddings, image features, single-cell sequencing, and more. The filter
matters, though: the most common misuse of these methods is to read the
visual output as if it were a map.

The next articles push on the family's limitations. Article 5 looks at
methods that preserve *topology* rather than geometry, giving up point
positions altogether and asking only about connectivity. Article 6 looks
at methods that preserve *density*, which most of this family
deliberately flattens.
