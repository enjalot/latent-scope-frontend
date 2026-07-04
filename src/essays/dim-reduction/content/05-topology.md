---
title: Preserving Topology
description: Mapper, Reeb graphs, topological autoencoders. When shape matters more than position.
series: dim-reduction
order: 5
---

The methods we have seen so far try to place every data point at a
specific location in a plane. Topology takes a different stance: forget
the exact positions and keep track of the *shape*. How many connected
pieces does the dataset have? Are there loops? Are there branches? Is
there a hole in the middle?

Topology is a coarser description than geometry, and the coarseness is
deliberate. The same loop can be a circle, an ellipse, or a
wildly irregular closed curve, and all three are topologically
identical. A topological description is robust to noise and deformation.
For ML data that sits on a curved manifold with complicated local
structure, a topological summary often captures the part that actually
matters and ignores the part that changes every time you retrain.

This article covers Mapper (the most widely used topological DR method),
Reeb graphs (a close cousin with a more specific setup), persistent
homology (more an evaluator than a DR method, but central to the field),
and topological autoencoders (which carry topological constraints into
neural networks). None of these methods replaces t-SNE or UMAP as a
visualization default. But when used together with the neighbor-based
methods, they reveal structure that the others wash out.

## Mapper: the pipeline

Mapper, introduced by Singh, Memoli, and Carlsson in 2007, is the
topological method you are most likely to encounter in practice. The
pipeline has three steps, none of them hard in isolation.

First, pick a **filter function** (also called a lens). This is any
function from your data to a low-dimensional space, often just the real
line. Common choices are a coordinate projection, a density estimate, a
distance from a reference point, a PCA component, or a learned
embedding. The filter is what you are "looking through" when you examine
the data.

Second, pick a **cover** of the filter's range. Divide the range into
overlapping intervals (or rectangles, for a 2D filter). The overlap is
important; we will see why in a moment.

Third, **cluster within each cover element**. For each interval of the
filter, find the subset of data points that map into it. Run a
clustering algorithm on just those points, in the original
high-dimensional space. Each cluster becomes a node in the Mapper graph.
Whenever a point belongs to two overlapping intervals (via the overlap
from step 2), its cluster in one interval is connected by an edge to its
cluster in the other. The result is
:term[a graph that captures the topology]{to=mapper.graph} of the data through
the lens of the filter.

:::figure{id=mapper}
The Mapper pipeline applied to a figure-8 dataset. Left: the data
colored by filter value, with cover intervals shown as vertical (or
horizontal) bands. Right: the Mapper graph, where each node is a cluster
of points inside one interval and edges connect clusters that share
points via the interval overlaps. Hover a band or a graph node to see
exactly which points it contains. Sweep resolution from one end to the
other: too few intervals collapse the loops, a middle range recovers the
figure-8, too many shatter the graph. Changing the filter changes what
topology gets revealed.
:::

The two graph-shape knobs are resolution (how many intervals) and
overlap (how much adjacent intervals share). More resolution means finer
topological detail but also more noise; more overlap means more edges
but may merge features that should be distinct. In practice, the user
sweeps these and looks for structure that is stable across settings.

The filter function is where the creative work happens. The same dataset
under different filters reveals different aspects: a height filter on a
dataset of head poses reveals the rotation axis; a density filter
reveals where the dataset concentrates; a distance-from-center filter
reveals radial structure. Filter choice is the lens metaphor taken
literally: the Mapper graph is what your data looks like through that
particular lens. This has led to some confusion over whether Mapper is
"really" dimensionality reduction, because its output is a graph, not a
scatter plot. It is dimensionality reduction all the same: the graph is
the embedding, just in a non-standard format.

> Real Mapper workflows often use a learned lens, for example the
> activation of a specific neuron or the output of a classifier. The
> Ayasdi platform built a business on running Mapper with clever lenses on
> industrial datasets. The choice of lens is what makes Mapper flexible,
> and what makes it hard to use well.

## Reeb graphs: the special case

A Reeb graph is Mapper's continuous cousin. Given a smooth manifold and
a scalar function on it (think "height" on a torus), the Reeb graph
tracks how the level sets of the function change as you sweep through
its values. Components split, merge, appear, and disappear; the graph
records these events. Every "branch point" in the graph is a critical
point of the function.

Mapper is essentially a discrete, noise-tolerant approximation of the
Reeb graph, applied to point cloud data instead of smooth manifolds. The
theoretical guarantees come from the Reeb graph side; the practical
utility comes from the Mapper side.

## Persistent homology: which features are real?

Persistent homology is not a dimensionality reduction method, but it is
so central to topological data analysis that it belongs here. The idea:
grow a ball around each data point and slowly increase the radius. At
small radii, the union of balls is just disconnected dots. As radii
grow, balls start to overlap, connected components form, and eventually
the whole thing fills in. Along the way, topological features are born
and die.

A connected component is born when a ball first appears and dies when it
merges with another component. A loop is born when balls overlap enough
to enclose empty space and dies when that empty space gets filled in. A
void (a sphere's interior in 3D) is born and dies similarly. The
*persistence* of a feature is the length of the interval between its
birth and death.

:::figure{id=persistence}
Persistent homology in action on a noisy circle. As ball radius grows,
dots merge into a single connected component ($H_0$), then a loop
appears as the circle closes ($H_1$), and eventually the loop fills in
and dies.
The right panel shows a "barcode": each bar is one feature's life span.
The dashed cursor marks the current radius: bars fade once their feature
has died, and the $H_1$ bar lights up exactly while the hole is open on
the left. Features that live a long time (long bars) are real; features
that die quickly (short bars) are noise.
:::

Persistent homology gives you a principled answer to "which features in
this dataset are robust?" :term[Long bars in the barcode]{to=persistence.barcode}
are features that are stable across scales and therefore probably real;
short bars are noise.
Libraries like Ripser and Giotto-TDA compute persistence efficiently for
reasonably sized datasets. The barcode is not itself a visualization of
the data, but it is an auditable summary of the data's shape, which is
valuable both as a diagnostic and as a feature vector for downstream
tasks.

## Topological autoencoders: carrying topology into neural methods

The most recent development in this area is to build topological priors
into neural DR methods. Topological autoencoders, introduced by Moor and
colleagues in 2020, train an autoencoder with an additional term in the
loss that encourages the persistence features of the latent space to
match the persistence features of the input space. The result is a
learned embedding that does its best to preserve topology, while still
being a parametric neural function with all the benefits that come with
that (out-of-sample generalization, GPU training, compatibility with
downstream neural architectures).

Topological autoencoders are not yet a default tool the way UMAP is, but
they are a compelling direction because they combine the strengths of
two worlds. Neural methods are scalable and flexible but tend to distort
topology in unpredictable ways; topological methods are principled but
tend to be hard to scale or tune. Putting a topological regularizer on a
neural method is a way to get the best of both, when the training is
stable enough.

## When topology is the right lens

Topological methods are most useful when the shape of your data is
meaningful and when the absolute positions of points are not.
Developmental lineages branch and merge; disease progression traces
loops (patient gets sick, treatment, remission, possibly relapse);
dynamical systems visit a finite set of states with particular
transitions. For data like this, a t-SNE or UMAP plot will usually miss
the structure because the neighborhood-preserving objective does not
know about loops or branches. A Mapper graph, by contrast, makes them
visible.

The cost of using topological methods is that they produce graphs, not
scatter plots, and graphs are harder to interpret at a glance. The
standard workflow is to use topology as a companion tool: run UMAP for
the intuitive picture, run Mapper alongside for the structural
validation. When both agree, the structure is probably real. When they
disagree, the disagreement itself is worth a closer look.

The next article picks up a different kind of thing that gets washed out
by the neighborhood family: density. When a method can tell you not just
where the clusters are but how tightly packed they are, the workflow
opens up in a different direction.
