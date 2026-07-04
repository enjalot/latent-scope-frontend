---
title: The Linear Family
description: PCA, ICA, NMF, Kernel PCA, random projection. What each one preserves, and where linear methods are still a sensible first choice.
series: dim-reduction
order: 2
---

Linear dimensionality reduction is a matrix multiplication. Given data $X$
with $n$ rows and $d$ columns, pick a skinnier matrix $W$ with $d$ rows
and $k$ columns, and the embedding is $XW$. The methods we cover here
differ only in how they pick $W$.

That sounds like a narrow design space, and it is, but the narrowness is
a big part of why linear methods are still useful. They are fast,
deterministic, composable, and interpretable. When a nonlinear method
distorts your data in some hard-to-describe way, it is often linear
methods that serve as the baseline you compare against. And when a
nonlinear method needs a sensible starting configuration, it is often
PCA that provides it.

## PCA: preserve variance

Principal Component Analysis, introduced by Pearson in 1901 and
independently by Hotelling in 1933, asks a simple question: among all
possible directions through the data, which one has the most spread?
That direction becomes the first principal component. The second is the
direction of most spread *orthogonal* to the first. The third is the
direction of most spread orthogonal to both. Keep going, order by
spread, keep the top few.

Geometrically, the first few components define a subspace that lies as
close as possible to the data in a least-squares sense. If you were
asked to summarize the cloud with a line, you would pick the first
component. With a plane, the first two.

:::figure{id=pca}
Drag the sliders to reshape the point cloud. The blue arrow tracks the
first principal component, always aligning with the direction of maximum
spread; the orange arrow is the second, orthogonal to the first. The
bars show what fraction of the total variance each direction captures.
:::

As :term[the cloud]{to=pca} grows more anisotropic, the first component captures a
larger share of the variance. In the extreme case where the cloud is a
perfect line, PC1 captures 100% and a one-dimensional embedding loses
nothing. Most real data is somewhere in between: the first few
components capture most of the variance, and the rest is treated as
noise.

The components are eigenvectors of the data's covariance matrix;
equivalently, the right singular vectors of the centered data. Modern
implementations use SVD because it is numerically more stable.
Explained variance is just the eigenvalue, so picking a number of
components reduces to choosing a cutoff on a sorted list.

What PCA cannot do is bend: if the meaningful structure of the data lies
on a curved manifold, no linear subspace is going to be a good fit. This
is the observation that motivates almost every nonlinear method in this
series. PCA sees a swiss roll as an elongated blob; it has no way to
unroll it. But PCA is often a sensible baseline and initialization, and
for data whose structure is close to linear (a lot of data qualifies) it
can be all you need.

> A rule of thumb in practice: if you do not know where to start with new
> high-dimensional data, look at PCA first. If the first two components
> tell a reasonable story, you might not need anything else. If they do
> not, you have learned something about the data's nonlinearity before
> spending time on harder methods.

## ICA: preserve independence

Imagine three microphones in a room with three people talking. Each
microphone picks up a mixture of all three voices, with the mixing
weights depending on distances and geometry. Can we recover the
individual voices from just the mixtures?

PCA cannot do this: the principal components of the mixtures are the
directions of highest variance, which have no reason to align with the
individual speakers. PCA sees correlation, not the identity of the
underlying sources.

Independent Component Analysis, developed through the 1990s and codified
by Hyvärinen and Oja's FastICA in 2000, attacks the same problem from a
different angle. Its core assumption: the original sources are
statistically *independent*, and most interesting real-world signals are
*non-Gaussian*. A mixture of independent non-Gaussian signals is closer
to Gaussian than any of the sources on their own (this is a consequence
of the central limit theorem). So if we search among the directions in
the data that are the *least* Gaussian, we find the directions of the
original sources.

:::figure{id=ica}
Two non-Gaussian sources (a sawtooth and a square wave) are mixed
linearly to produce the two observed signals. Toggle the views to watch
the waveforms morph: PCA finds orthogonal axes of maximum variance,
which still blend the two sources. ICA finds the directions that are the
most non-Gaussian, and the mixtures untangle back into the sawtooth and
the square.
:::

If all your sources were Gaussian, you could not recover them: a rotation of
Gaussian noise is still Gaussian noise, so there is no way to pick out
the original orientation. Non-Gaussianity is what makes the problem
solvable.

ICA is a workhorse in neuroimaging: EEG and fMRI produce signals that
are linear mixtures of underlying brain sources plus artifacts (eye
blinks, heartbeat, muscle activity). Running ICA and manually labeling
components is a standard preprocessing step. In machine learning, ICA is
less commonly used as a front-line DR method, but it shows up in feature
engineering, denoising, and as a tool for analyzing learned
representations.

## NMF: preserve parts

Suppose your data are pixel intensities, word counts, gene expression
levels, or anything else that cannot physically be negative. PCA is
happy to write your face as "average face + 0.7 times (component 1,
which has negative regions) minus 0.3 times (component 2)." The math is
fine, but the interpretation is weird: what does it mean for a face to
contain a negative eye?

Non-negative Matrix Factorization, formalized by Lee and Seung in 1999,
adds a simple constraint: both the basis patterns and the coefficients
must be non-negative. Each sample is a sum (never a difference) of
:term[non-negative parts]{to=nmf}. In Lee and Seung's original face paper, the
discovered basis looks like localized face features: noses, eyebrows,
mouths. Every face is a positive combination of them.

:::figure{id=nmf}
A dataset of 12 synthetic "samples" (top row) is built from non-negative
mixtures of four true parts (middle row). Slide the rank: at the true
rank of 4, NMF recovers the parts almost exactly; below it, parts get
merged into composites; above it, the extra components duplicate
structure while the reconstruction error stops improving.
:::

NMF has become essential in single-cell genomics, where cells are linear
combinations of gene expression programs; in topic modeling, where
documents are combinations of word-distribution topics; and in audio
source separation, where spectrograms are sums of non-negative frequency
patterns. Wherever data has a natural "parts" reading, NMF tends to find
the parts.

The tradeoffs: the factorization is not unique (many valid
decompositions of the same data exist), the optimization is non-convex,
and there is no reliable recipe for picking the rank. But when the data is genuinely
non-negative and the parts interpretation is meaningful, NMF often
produces a decomposition that downstream analysts can actually reason
about, which is rare in DR.

## Kernel PCA: the bridge to nonlinear

PCA assumes the structure in the data is linear. What if it is not, but
could be made linear by a clever change of coordinates? This is the idea
that Schölkopf, Smola, and Müller published in 1998 under the name
kernel PCA.

Imagine a dataset shaped like :term[two concentric circles]{to=kpca}. No linear
projection separates them, because their separation is not along any
direction; it is along the radius. But if you map each point $(x, y)$ to
$(x, y, x^2 + y^2)$, the two circles now lie at different heights, and they
are linearly separable in the new coordinate system. Linear methods in
the *transformed* space correspond to nonlinear methods in the
*original* space.

The catch is that writing down the transformation explicitly becomes
expensive in high dimensions (and, for some useful transformations,
infinite). The kernel trick sidesteps this: PCA only needs inner
products between points, and an inner product in the transformed space
is computable directly from a kernel function $k(x, y)$ applied to points
in the original space. So we never build the transformed space; we just
compute a Gram matrix of kernel values and do PCA on that.

Common kernels are the polynomial kernel (captures pairwise
interactions) and the RBF or Gaussian kernel (captures local similarity,
softly). The choice of kernel and its hyperparameters are the knobs the
user turns.

:::figure{id=kpca}
Three panels: the input data in 2D, the $n \times n$ Gram matrix the algorithm
actually consumes (sorted by class), and the kernel-PCA embedding. Hover
any point to track the same datum across all three panels, including its
row of kernel values in the Gram matrix. With the *linear* kernel, kernel
PCA collapses to ordinary PCA: the embedding is just a rotated copy of the
input, and concentric circles or two moons stay tangled. With the RBF
kernel at the default $\gamma$, the two circles land on opposite sides of
the embedding: linearly separable after the lift. But $\gamma$ (the
inverse bandwidth) has to be right: too small and every point looks
alike, too large and only the nearest neighbors register. The polynomial
kernel exposes a degree control: higher degrees add higher-order feature
interactions, which is especially visible on the XOR dataset.
:::

Kernel PCA recovers nonlinear structure in many classical synthetic
examples, and it turns out to be a special case of a much broader
family: Laplacian eigenmaps, Isomap, diffusion maps, and spectral
clustering can all be viewed as kernel methods with particular kernels.
We will see them in the next article.

What holds kernel PCA back in practice is scale: the Gram matrix is
$n \times n$, and eigendecomposing it is cubic in $n$. Beyond a few thousand
points, it becomes unworkable without approximation. For large data, the
neighbor-based methods we cover in article 4 have won out.

## Random projection: preserve distances, cheaply

The last member of the linear family does not choose $W$ to preserve
some property; it just draws $W$ at random. Gaussian entries, or even
signed sparse entries, work fine; multiply and you are done.

This sounds like it should not work, but the Johnson-Lindenstrauss
lemma proves that for any desired precision, a random projection into
$O(\log(n) / \varepsilon^2)$ dimensions :term[approximately preserves all pairwise distances]{to=jl}
in the dataset, regardless of the original dimension. This works not
because the random projection is smart, but because high-dimensional
geometry itself is concentrated enough that a random direction is
almost always a reasonable summary.

:::figure{id=jl}
Shepard diagram: each point is a pair of samples. Its x-coordinate is
their distance in the original 200-dimensional space; its y-coordinate
is their distance after random projection. A perfect match would lie on
the diagonal. Press *sweep* to watch the cloud collapse onto the
diagonal as the projected dimension grows; the bar tracks the distance
correlation $r$ between original and projected distances.
:::

Random projection is a good default when you want to reduce dimension
for speed rather than visualization. As preprocessing before clustering, before
nearest-neighbor search, or before handing data to a more expensive
method, a random projection from 10,000 to 100 dimensions is cheap to
compute, provably loses little, and has no hyperparameters to tune. The
methods in the rest of this series often use it as preprocessing without
advertising the fact.

## What linear methods cannot do

Every method in this family picks the matrix $W$ to capture a different
property: variance (PCA), independence (ICA), additive parts (NMF),
kernelized similarity (kernel PCA), or plain distance (random
projection).

Linear methods struggle when the structure is fundamentally curved. A
swiss roll, two intertwined crescents, a branching developmental
trajectory: these are all cases where the local geometry does not match
the global geometry, and no single linear projection can reconcile them.
The next article picks up there, with methods that replace the Euclidean
distance between points with something curvier: distances along the
manifold, distances through a graph, distances from a random walk.
