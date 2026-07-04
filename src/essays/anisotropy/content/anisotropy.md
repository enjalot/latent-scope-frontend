---
title: 'Anisotropy: the shape of an embedding cloud'
description: Why random pairs of embeddings can look suspiciously similar, and what that does to every cosine, neighbor graph, and 2D map we compute.
tags:
  - embeddings
  - geometry
---

When we embed a collection of documents, we usually think about individual
vectors: this joke is near that joke, this query should retrieve that
passage. Anisotropy is a property of the *whole cloud* of vectors at once,
and it keeps showing up in our research logs because it quietly changes what
similarity scores mean. This article builds an intuition for it using a
concrete dataset: 52,000 dad jokes from r/dadjokes, embedded by four
different models.

## What does a random pair of embeddings look like?

Here is the experiment that defines the concept. Take two jokes at random,
with no reason to believe they have anything to do with each other, and
measure the cosine similarity of their embeddings. Do it again with another
random pair. The average over many random pairs is the anisotropy of the
space.

:::figure{id=joke-pairs}
Two jokes from the dadabase, with their cosine similarity in each of four
embedding spaces. The gray band is what random pairs score in that space.
Draw a few random pairs, then draw similar pairs, and watch which spaces
separate the two cases and which barely do.
:::

Try it a few times and one pattern should jump out: in MiniLM and jina, a
random pair scores near 0.1 and a similar pair scores much higher, while in
the GPT-2 space every pair of jokes scores about 0.99 no matter what. The
first two spaces have room to express "these are different"; the last one
has crushed all of its dynamic range into a hundredth of the cosine scale.

In a perfectly isotropic space, unrelated pairs average out to a cosine of
zero: for every direction some vector points, others point away. In an
anisotropic space, random pairs come out looking similar before you have
measured anything about their content. The word means "not the same in all
directions": the cloud has a preferred direction that every vector shares.

## Balls and cones

The geometry behind that number is easiest to see on a sphere. Embeddings
are usually compared by cosine, which only cares about direction, so picture
every vector pushed out to the unit sphere. The question anisotropy asks is:
how much of the sphere does the cloud actually use?

:::figure{id=ball-and-cone}
Points on a sphere, from uniform coverage to a tight cone. The histogram
shows cosine similarities of random pairs drawn from the cloud. Drag the
concentration slider and watch the histogram slide away from zero.
:::

At one extreme the cloud covers the sphere evenly, a ball. Random pairs are
as likely to oppose as to agree, and the mean cosine sits at zero. As the
cloud concentrates into a cone, every vector starts to share a common
component, and the cosine between two random points is dominated by that
shared direction rather than by anything specific to the pair. A mean random
cosine of 0.6 means the cone is narrow enough that "unrelated" jokes agree
more than perpendicular vectors would.

## What happens to cosine in high dimensions?

Our low-dimensional intuition undersells how strange a high random cosine
is. In 2D, two random directions can easily land near each other. In 768
dimensions, they essentially never do.

:::figure{id=cosine-dimensions}
Cosine similarity of random pairs of uniformly random unit vectors, as the
dimension grows. The spread collapses toward zero like $1/\sqrt{d}$.
:::

In high dimensions there is so much room that almost all directions are
almost orthogonal, so random pairs in an isotropic 768-dimensional space
concentrate tightly around cosine zero. That is the yardstick to keep in
mind when reading anisotropy numbers: in a space where chance alignment
should be a hundredth, a mean random cosine of 0.6 is not a small bias, it
means the shared direction is contributing most of every similarity score.

## Where cones and balls come from

The models we use land at very different points on this axis, and the
difference traces back to their training objectives.

Language models produce cones. Ethayarajh measured this in 2019 for ELMo,
BERT, and GPT-2: contextual token representations occupy a narrow cone that
tightens in the upper layers, to the point that two random words in GPT-2's
last layer have a cosine near 1.0. Nothing in a language-modeling objective
asks the representations to spread out, and residual streams accumulate
shared components layer after layer.

Contrastively trained embedding models produce balls, and Wang & Isola
showed why. A contrastive loss decomposes into two forces: an alignment
term that pulls positive pairs together, and a uniformity term that pushes
everything apart from everything else. The uniformity pressure has a
provable endpoint, the uniform distribution on the sphere. Sentence
embedding models like MiniLM and jina are trained this way, which is why
their clouds come out close to isotropic.

:::figure{id=alignment-uniformity}
A toy contrastive training run on the circle. Each short spoke joins a
positive pair, one dot just inside the circle and one just outside.
Alignment pulls the two halves of a pair together while uniformity repels
all points from each other. Try turning either force off: uniformity alone
still spreads the cloud, alignment alone collapses it back into a cone.
:::

## The dadabase in six spaces

The same 52,000 jokes, run through our four models, span nearly the whole
axis. The two contrastively trained sentence models land near zero: MiniLM
at a mean random-pair cosine of 0.11 and jina-v5-nano at 0.14. The language
model token spaces land near one: single-token vectors average 0.91 in
ColBERT and 0.96 in GPT-2's last layer. And mean-pooling the tokens of a
joke pushes things even further into the cone, 0.98 for ColBERT and 0.997
for GPT-2, because averaging vectors that already share a direction mostly
keeps the shared part.

:::figure{id=anisotropy-axis}
Each measured space placed by its mean random-pair cosine, with the full
distribution behind each mean. All values measured on the dadabase. The
checkbox subtracts each space's mean vector before measuring, previewing
the fix discussed below.
:::

Two details worth flagging when reading measurements like these. First,
our logs use two different statistics for anisotropy: the mean cosine of
random pairs, and the norm of the dataset mean vector divided by the mean
vector norm. Both capture "how much of every vector is a shared direction"
and they generally agree, but they are not the same number. Second,
anisotropy is a property of a model *and* a dataset. The same jina model
that is nearly isotropic on English web text showed a strong cone (+0.34)
on our Chinese corpus, and even MiniLM's 0.11 here is above zero for an
honest reason: every document in this corpus is a dad joke, so random
pairs really do share some content. A topically narrow corpus raises the
baseline for every model, which is why the baseline has to be measured on
your data rather than assumed.

## What the cone does to your tools

A shared dominant direction is not just a curiosity, it leaks into the
downstream computations that touch similarity.

**Cosine scores need a baseline.** In a cone, a cosine of 0.6 between two
jokes tells you almost nothing, because random pairs also score 0.6. Any
metric built on cosine has to subtract the random-pair baseline before it
can be compared across spaces. Our monosemanticity eval learned this the
hard way and now flags itself invalid when the baseline is too high.

**Centering fixes the measurement, not the representation.** The standard
correction for a cone is to subtract the dataset mean, which moves the
origin into the middle of the cloud so that angles once again measure how
points differ from each other. On our data it works exactly as advertised:
flip the checkbox on the distribution figure above and every space's random
baseline drops to zero, GPT-2's 0.997 included. One subtlety we tripped
over while making this figure: centering changes nothing under plain
Euclidean distance, because subtracting the same vector from every point is
a translation. It matters exactly when the metric cares about direction,
cosine or dot product, which is what our pipelines use.

What centering cannot do is put content into the leftover variation. The
maps below are real cosine-metric UMAPs of 8,000 jokes, colored by one
fixed reference grouping of the jokes. In the MiniLM map the colors settle
into coherent regions. The GPT-2 map is confetti as-is, and it stays
confetti after subtracting the mean, because what varies around GPT-2's
shared direction is mostly not the topic of the joke. The centered
statistics say the same thing: 85% of the centered GPT-2 variance lies in
just two directions, versus 6% for MiniLM. Centering repairs the cosines,
but a map only has something to organize when direction encodes content,
and that is a property the contrastive objective trains in and the
language-modeling objective does not.

:::figure{id=centering-demo}
Real cosine-metric UMAPs of the same 8,000 jokes. Colors are k-means
clusters computed in the MiniLM space, a fixed reference notion of content
grouping, so color coherence shows how much of a layout is driven by
content. Hover any point to read its joke.
:::

**Neighbor lists deserve suspicion.** High-dimensional neighbor graphs can
develop hubs, points that show up in everyone's nearest-neighbor list. Our
Chinese jina corpus paired a strong cone (+0.34) with heavy hubness: one
chunk appeared in the neighbor lists of 1,274 others. The two pathologies
don't have to travel together, though. On the dadabase the GPT-2 cone
space actually shows milder hubness than MiniLM, so we treat them as two
separate diagnostics on the same passport rather than one.

**Isotropy can also mean "nothing to see".** The flip side: our SAE decoder
dictionaries trained on contrastive embeddings come out near-isotropic, with
nearest-neighbor cosines barely above the random floor. A UMAP of those
decoder directions shows no clusters, and that is the space being uniform,
not the training failing.

## What this means for how we validate

Auditing our own pipelines for this article turned up a concrete
inconsistency: the basemap training graph is built with raw dot products,
the evaluation panel scores maps in raw L2, and the space passport
diagnoses geometry in cosine. Each of those metrics responds differently to
anisotropy, and none of the stages centers or whitens the embeddings first.

Some of our practices already correct for geometry, and they are the
template to extend: the space passport measures the random-pair baseline
directly, the centered feature-UMAP variant subtracts the dataset mean and
switches to cosine, the hierarchy eval compares against a shuffled-decoder
null, and the cross-model alignment eval z-scores activations before
correlating. The general rule all of these share: before trusting any
similarity number, ask what a random pair scores in that space, and measure
from there.
