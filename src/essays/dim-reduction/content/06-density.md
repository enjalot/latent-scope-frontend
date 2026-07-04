---
title: Preserving Density
description: densMAP and PHATE. Why most methods flatten density, and what the exceptions buy you.
series: dim-reduction
order: 6
---

Look at a UMAP plot of :term[three clusters]{to=density.umap}. They appear
as three clouds, roughly the same size, separated by empty space. The visual message is
"here are three groups." But suppose one of those groups was ten times
as dense in the original high-dimensional space as the others: a tightly
concentrated population alongside two loosely scattered ones. The UMAP
plot will flatten that difference. All three clouds will look roughly
equally dense on screen because the optimization is driven by
neighborhood preservation, and preserving neighborhoods does not require
preserving how close those neighbors really were.

This is a deliberate design choice rather than a bug. For many tasks,
equalizing cluster sizes in the plot makes them easier to read. But when density
itself is the signal, this choice destroys it. A rare cell type that
concentrates because it is performing a specific function, a
well-practiced region of a policy's state space, a mode of a mixture
model with a particular width: all of these look identical in a standard
embedding to clusters that are merely noisy.

Two methods put density back into the picture. densMAP, a UMAP variant,
preserves local density as an additional constraint. PHATE, designed for
single-cell trajectories, uses a diffusion-based distance that naturally
captures continuous variation rather than isolated clusters. This
article is about what each of them buys you and when.

## Why the neighbor-based family flattens density

A t-SNE or UMAP embedding tries to lay out points so that each one is
close to the same neighbors it had in the original space. The objective
does not reward reproducing *how close* those neighbors were in absolute
terms, only the ranking. Two nearest neighbors ten units apart and two
nearest neighbors one unit apart both count the same: they are nearest
neighbors.

After optimization, the repulsive forces between non-neighbors take over
and push things apart until each cluster occupies some roughly standard
amount of space on the screen. The final plot tells you about cluster
membership, not about cluster tightness. Recall from article 4 that
cluster sizes in a t-SNE or UMAP plot are not meaningful; this article
is about what to do when you want them to be.

:::figure{id=density}
Three clusters with very different densities in the original space. A
UMAP-style layout pushes them apart until they all look roughly the same
size on screen. A densMAP-style layout rescales local spacing so that
dense clusters remain visually tight and sparse clusters remain visually
spread out. Same data; different answers to "how tightly packed is this
group?"
:::

## densMAP: UMAP with a density term

densMAP, introduced by Narayan, Berger, and Cho in 2021 as a drop-in
replacement for UMAP, adds one extra term to the optimization. Along
with the usual attract-and-repel objective, it computes the local
density around each point in the original space (basically, the average
distance to nearest neighbors) and encourages the local density around
the same point in the embedding to match.

The effect is subtle but often useful. A dense cluster in the original
space stays dense in the embedding; a sparse one stays sparse. The
relative spacing between clusters is still not fully meaningful, because
the repulsive forces still dominate between clusters, but *within* each
cluster the density becomes informative. If you are looking at
biological data, cells that are tightly related will cluster tightly;
cells that form a loose continuum will show up as a loose continuum
rather than being force-compressed into a tight blob.

One nice property of densMAP is that it is a modification of UMAP, not a
wholly new method. It inherits UMAP's speed, API, and ecosystem. In most
implementations you set a single flag and get density-aware output. This
is exactly the kind of low-overhead improvement that tends to spread
quickly.

> The density-preservation knob in densMAP is a blend: at 0, the output is
> identical to UMAP; as the weight increases, density becomes more
> faithfully preserved, at some cost to neighborhood preservation. Like
> most hyperparameters in this family, the right value depends on what you
> are trying to see.

## PHATE: potential distances for continuous structure

PHATE (Potential of Heat-diffusion for Affinity-based Trajectory
Embedding), from Moon and colleagues in 2019, comes at the problem from
a different direction. It was designed with single-cell developmental
biology in mind, where the data is not really a set of discrete
clusters; it is a continuum of states that cells pass through as they
differentiate. A UMAP plot of such data will usually carve the continuum
into clusters, because the attract-repel objective does not know how to
preserve continuous structure.

PHATE's key idea is the *potential distance*. Start with diffusion on
the kNN graph, similar to the diffusion maps we saw in article 3: a
random walker at one point has some probability of being at every other
point after $t$ steps. The distribution flattens as $t$ grows; after
many steps, the probability distribution reflects the long-run
connectivity structure of the graph. PHATE takes those diffused
distributions, applies a log transform (this is the "potential" step),
and uses the resulting transformed distributions as the basis for a
distance. Then it runs MDS on this distance matrix to produce the final
embedding.

The log step is what separates PHATE from ordinary diffusion maps. It
compresses the dynamic range of the probabilities, so that tiny
probabilities (points that are far through the graph) and moderate
probabilities (points that are somewhat connected) contribute comparably
to the distance. The upshot is that PHATE is sensitive to both local and
global structure, and it produces embeddings where
:term[branching trajectories]{to=phate.phate} look like branches rather than
like separated clusters.

:::figure{id=phate}
A branching trajectory: points progress from a common origin along three
diverging paths, with density gradually decreasing outward. A
neighbor-based layout tends to cluster the branches into three lumps
with the origin hidden inside. PHATE preserves the branching geometry,
making the common origin and the continuous divergence visible.
:::

## When density matters

Density preservation matters most when the data is itself a continuum or
when relative density is the biological or physical signal. The
paradigmatic examples are in single-cell biology: developmental
trajectories where cells flow from stem to specialized states, immune
responses where T-cell populations expand and contract, disease
progression where patients trace paths through state space. In all of
these, "how many cells are concentrated here" carries meaning, and
flattening it makes diagnosis harder.

In ML, density preservation is less often the dominant concern, but it
shows up in specific places. When comparing two embeddings (before and
after training, for instance), you often want to know whether the
feature space is becoming more or less concentrated in certain
directions. A density-preserving visualization lets you see that change;
a density-flattening one hides it. Similarly, when studying the internal
representations of models with many classes or sub-types, the relative
concentration of samples per class can be an interesting diagnostic.

## What density methods give up

Density-preserving methods pay for their faithfulness with lower
separation between clusters. Because they do not let repulsive forces
push clusters to uniform visual size, genuinely dissimilar groups
sometimes end up looking merged or overlapping in places. You gain
information about intra-cluster structure at some cost to inter-cluster
clarity.

A sensible workflow is to run both a standard neighborhood method and a
density-preserving one, and read them together. The neighborhood method
tells you where the clusters are; the density method tells you how tight
each one is. Neither on its own is a complete picture, but together they
give a richer read than either in isolation.

So far we have seen methods that produce scatter plots of floating
points, in various flavors. The next article is about a family that
does not float the points at all: Self-Organizing Maps place every
data point into a fixed low-dimensional grid. The move from free layout
to constrained layout is the topic of article 7.
