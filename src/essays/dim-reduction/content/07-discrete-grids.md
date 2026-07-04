---
title: Self-Organizing Maps
description: When you want the output to be a grid, not a cloud. Competitive learning, neighborhood functions, U-matrices.
series: dim-reduction
order: 7
---

By now we have seen a range of dimensionality reduction methods, and
they all share a shape: input is a high-dimensional dataset; output is a
cloud of points in two or three dimensions, each point free to land
wherever the optimization puts it. Self-Organizing Maps break that mold.
The output is a regular grid (rectangular or hexagonal), and the
algorithm's job is to decide which grid cell each data point belongs to.
The points do not get their own individual low-dimensional coordinates;
they get assigned to fixed cells.

At first glance this sounds restrictive, and it is, but the restriction
buys something real. A grid is a simpler object than a scatter plot:
easy to read, easy to tile, easy to use as a coordinate system for
something else. When what you want is not "a picture of the data" but a
map-like substrate onto which data can be indexed, sorted, compared, or
displayed, a SOM is the right tool. When you do want a picture of the
data, you probably want UMAP or t-SNE instead.

## The algorithm

SOMs, introduced by Teuvo Kohonen in 1982 and polished over the
following decade, use a simple but effective training procedure called
competitive learning. The ingredients:

First, a grid of *prototype vectors*. For a 20-by-20 grid, that is 400
prototypes, each with the same dimension as the input data. They can be
initialized randomly or more cleverly (e.g., along the top principal
components). Importantly, each prototype has a fixed position on the 2D
grid; only its high-dimensional values will change during training.

Second, the training loop. For each training step, pick a random data
point. Find the prototype closest to it in the high-dimensional space;
this is the *best matching unit* or BMU. Move the BMU slightly toward
the data point. Also move the BMU's neighbors on the grid, but by a
smaller amount that falls off with grid distance. Over time, decay the
learning rate and shrink the neighborhood radius so that updates become
smaller and more local.

The neighborhood update is the key move. Because nearby prototypes on
the grid all move together (slightly) when one is chosen as BMU, they
end up similar in high-dimensional space. Cells that are close on the 2D
grid become close in high-D, and cells that are far on the grid become
different. This is how topology gets preserved: the 2D layout of the
grid ends up reflecting the similarity structure of the data.

:::figure{id=som}
A SOM training on a 2D dataset, chosen to be 2D so the prototypes can be
drawn on top of the data. At initialization the grid is a straight
rectangle. As training proceeds, each prototype migrates toward the data
while its grid neighbors drag along behind it; the grid deforms to cover
the data's shape (pause and step to study the deformation). Hover any
cell in either pane to see the same prototype and its grid neighbors in
both views — after training, cells that are adjacent on the grid sit
next to each other in the data too.
:::

In two dimensions the story is unusually vivid: the grid visibly
:term[bends and stretches]{to=som} to fit the data. In high dimensions
the same thing is
happening, but we cannot see it directly. What we can see is the
arrangement of prototype vectors on the 2D grid, because that is part of
the output by design.

## The U-matrix

A trained SOM does not itself look like a scatter plot. It is a grid of
prototypes, and the prototypes live in the original high-dimensional
space. To turn the SOM into a useful visualization, we plot the
:term[U-matrix]{to=umatrix.umatrix}: color each grid cell by the distance between its prototype
and the average of its grid neighbors' prototypes.

Regions of the grid where neighboring prototypes are very similar (low
U-values) represent tight clusters in the original data. Regions where
neighbors are dissimilar (high U-values) represent boundaries between
clusters. A U-matrix looks like a topographic map: dark "walls" separate
bright "valleys," each valley corresponding to a coherent group in the
data. This is how you read a SOM for cluster structure.

:::figure{id=umatrix}
Left: a SOM trained on three overlapping gaussian clusters in
20-dimensional space. Each cell shows its grid position; the color of
each cell is how similar its prototype is to those of its grid neighbors
(the U-matrix). Right: the data points, colored by their cluster, placed
into their BMU cells. Hover a cell to locate it in both panes: dark
"wall" cells on the U-matrix land in the empty band between colored
regions, while bright "valley" cells land inside a cluster.
:::

## What SOMs are good for

SOMs are unusual enough that it is worth being specific about when they
are the right tool. The grid-as-output property is the main driver.

First, when you need to lay out a dataset onto a fixed substrate that
can be tiled or printed. Map-making (mapping documents into a grid for
navigation), hexagonal tree maps, small-multiple dashboards: any time
the output has to be a rectangle, a SOM gives you a coherent mapping.

Second, when you want a quantization of the data into a fixed number of
representative vectors that are arranged smoothly in a low-dimensional
grid. This is useful for coarse-graining a large dataset (each prototype
represents a neighborhood of data points), or for downstream methods
that need a dictionary of vector representatives.

Third, as a different kind of exploratory view. SOMs tend to spread
clusters across the grid in a way that makes adjacencies visible, which
is sometimes useful when you want to see not just "are there clusters"
but "which clusters are similar to which."

The famous application, WEBSOM in the late 1990s, organized tens of
thousands of Usenet articles on a SOM grid that users could browse
spatially. A similar idea shows up in modern tools for organizing
latent-space embeddings of documents or images into tiled browsable
maps, sometimes called "atlases."

## What they are not good for

SOMs do not give you a position for every data point; they give you a
cell assignment. If you care about the fine-grained layout *within* a
cluster, a SOM will not show it. If you care about preserving pairwise
distances or detailed topology, a SOM is too coarse. If you want to do
out-of-sample projection, SOMs support it (find the BMU for the new
point), but the mapping is quantized to the grid resolution.

The method also has some numerical gotchas. Initialization matters
(random can be slow; PCA initialization is much more reliable). Training
is sensitive to the learning rate and neighborhood-decay schedules.
Extensions like Growing SOM and Growing Neural Gas, which adaptively
grow the grid, address some of these issues but add complexity.

> The "growing" variants of SOMs trade the fixed grid topology for more
> flexibility, at the cost of losing the very property (fixed grid) that
> makes SOMs distinctive. If what you need is a flexible layout with
> adaptive structure, you are better off with UMAP or a method from an
> earlier article; the SOM's value is precisely the rigidity.

## A method with a narrow purpose

SOMs are not a modern default for exploratory dimensionality reduction.
If someone hands you a new high-dimensional dataset and asks for a
visualization, UMAP or PCA is what you would reach for first. But SOMs
carve out a specific niche, the niche of "I want the output to be a
grid," and in that niche they are hard to beat. When you see one in the
wild, it is usually because someone needed a grid, not because they
thought it would produce a better scatter plot than UMAP.

The next article covers a method family that also constrains the
geometry of the output, but in a much more radical way. Instead of a 2D
grid, it uses the Poincaré disk, a piece of non-Euclidean geometry where
volume grows exponentially with distance. When the data is tree-shaped,
that geometry is exactly what you want.
