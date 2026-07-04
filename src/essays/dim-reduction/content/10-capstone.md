---
title: Opportunities & Open Problems
description: Where current methods fail for understanding ML latent spaces, and directions the families in this series suggest but have not yet taken.
series: dim-reduction
order: 10
---

Nine articles of methods, covering about forty years of dimensionality
reduction research. Looking back on them as a single landscape, a few
patterns stand out. Methods cluster tightly within families; families
are defined by what they preserve; and no single family covers
everything. Every method has a blind spot, and historically those blind
spots are what the next method set out to fix.

What follows is not a roadmap for research but a set of observations
about where the current methods fall short, especially for the use case
that motivated this series: understanding the latent spaces of large
machine learning models. The goal here is not to claim novelty; most of
these directions have been explored somewhere. The goal is to be honest
about what current practice gets you and where it runs out.

## The design space, seen at once

:::figure{id=matrix}
A rough sketch of which properties each family prioritizes (filled),
handles but does not emphasize (half), or tends to destroy (empty). No
method fills every cell. Workflows that need multiple cells filled have
to compose several methods or tolerate losses.
:::

:term[The matrix]{to=matrix} makes the tradeoffs concrete. PCA is strong on global linear
variance and interpretable components, weak on anything else. t-SNE and
UMAP are strong on local neighborhoods, weak on distances and density.
Mapper preserves topology well but produces graphs, not scatter plots.
Poincaré embeddings are strong on hierarchy, weak on most other things.
Learned representations are strong on the objective they are trained on,
which is whatever you make it, and weak on the rest.

This is a reasonable state of affairs, since different jobs call for
different methods. It becomes a problem when practitioners treat one
method as a default and forget that its defaults are choices. A common
failure mode, across every ML domain, is reading a UMAP plot as if its
global layout were a map. Another is running only one method and not
cross-checking.

## Evaluation is not solved

We use trustworthiness, continuity, stress, and Shepard diagrams to tell
whether an embedding "preserves structure." Each of these is defined
with respect to a particular notion of structure, and none of them
captures whether the embedding actually helps a human understand the
data. That is a much harder thing to evaluate, and the field is only
beginning to think about it seriously.

For understanding ML latent spaces, the evaluation problem is sharper.
What does it mean for a projection to "explain" a language model's
embedding space? Preservation metrics are necessary but not sufficient.
The end user is trying to form mental models: which concepts cluster,
which attributes are directions, where the failure modes live. A
projection that scores well on trustworthiness can still be useless for
these purposes if, for example, it puts meaningful axes at random
orientations.

Better evaluation likely requires task-specific benchmarks: projections
scored by their ability to support specific downstream analyses (concept
discovery, anomaly detection, counterfactual reasoning). This is harder
than publishing a metric on MNIST. It is also where the most useful
progress is likely to come from.

## Composition is underdeveloped

In practice, sophisticated workflows chain methods. PCA first, then
UMAP. UMAP for visualization, Mapper for topological validation.
Autoencoder for compression, then t-SNE on the latent. These
compositions are not accidents; they are attempts to fill in each
other's gaps. But the composition is almost always ad hoc. There are no
principled frameworks for combining methods with different preservation
objectives into a single view, and the compositions we do have are
chosen by practitioner intuition rather than designed.

A concrete opportunity: a method that jointly optimizes for neighborhood
preservation *and* density preservation *and* global distance
preservation, with user-adjustable weights on each. densMAP is a partial
step in this direction (neighborhood + density); PaCMAP is another
(neighborhood + global). A full three- or four-property version, with
weights that the user can slide, would make the tradeoffs explicit in
the UI rather than hidden in the algorithm's defaults.

Another concrete opportunity: a method that produces multiple linked
views simultaneously, each with a different objective, with the
guarantee that points are consistent across views. The Grand Tour from
the 1980s is the closest classical analog; a modern reinvention using
neural encoders and contrastive objectives is overdue.

## Domain-specific priors are underused

The learned-representation family taught us that matching the likelihood
to the data helps a lot. scVI's zero-inflated negative binomial is not
glamorous, but it is the difference between a useful embedding and a
broken one for count data. Yet outside of biology, domain-specific
priors are rare. We run generic UMAP on language model embeddings, on
code embeddings, on image embeddings, as if they all had the same
structure.

Language model hidden states have structure we know about:
superposition, polysemanticity, token-level features interacting with
concept-level features, residual stream direction reuse across layers. A
projection method that explicitly modeled this structure (e.g., a
learned encoder whose loss rewarded disentangling superposed features)
would, in principle, produce better latent visualizations for
interpretability research than a generic UMAP. This has not been built.
Related ideas from the sparse autoencoder literature gesture at it but
stop short of offering a DR workflow around them.

## Interactive projections are stuck at 2D scatter plots

Most of the methods in this series produce a 2D scatter plot and stop.
Interaction, when it exists, is usually "hover to see the label" or
"brush to filter." For exploring a latent space, that is a very limited
interface. We have seen what Mapper looks like (a graph), what SOMs look
like (a grid), what Poincaré embeddings look like (a disk). But the
synthesis is missing: we do not routinely build interfaces that let you
switch between scatter, graph, grid, and hyperbolic views of the same
embedding, linked and updated live.

Tools like latent-scope, Atlas, and the Embedding Projector are early
moves in this direction, but they almost all fall back to UMAP or t-SNE
for the main view. A more ambitious tool would treat the projection
method itself as a first-class object the user can manipulate: pick the
preserve-this-not-that priorities, see the projection update, compare
views side by side, annotate regions with labels that persist across
projections.

> This is an area where a series of papers has been published at IEEE VIS
> and TVCG for the last decade, collectively known as the "visual
> analytics of DR" literature. The ideas are there; the adoption in
> mainstream ML tools has been slow.

## Specifically for LLMs and large models

The need is acute for large models. Hidden state dimensions reach into
the tens of thousands; training runs produce terabytes of activations;
features span superposed, polysemantic directions that do not show up
cleanly in any single projection. Generic methods struggle here because
the structure we care about is not the structure they preserve.

Specific opportunities worth considering:

**Projections that respect the model's own geometry.** A transformer's
residual stream has a natural notion of "direction" that matters for
downstream layers. A projection that treated directions as first-class
objects (projecting directions, not just points) would align better with
how practitioners already think about these spaces. This is closer to
the ICA side of the world than the UMAP side, and it is underexplored
for modern architectures.

**Temporal projections.** We rarely look at how a single prompt's hidden
state evolves across layers, because no DR method is designed for that
kind of temporal data. A projection that treated each layer as a
timestep and produced a consistent 2D trajectory across layers would be
immediately useful for interpretability research.

**Compositional projections.** Large latent spaces have subspaces
(certain directions encode sentiment, others encode topic, others
syntax). Projections that let you choose a subspace of interest and
project within it, with the rest held constant, would let researchers
interrogate specific features without drowning in global structure.

**Projections integrated with probing.** The current interpretability
workflow runs a probe, gets a result, and then runs UMAP separately for
visualization. Integrating the two, with projections that condition on probe
directions or that optimize for preserving probe-readable structure,
would tighten the loop.

## What the families suggest but have not yet done

If we take each family's headline idea and ask what it has not yet been
combined with, a list of plausible directions falls out.

Hyperbolic space for neighborhood-preserving methods has been done at
small scale; a mature hyperbolic UMAP tuned for large model activations
would be valuable wherever concept hierarchies matter (which is almost
everywhere in LLMs). Topological regularization of learned
representations (beyond the existing topological autoencoders) could be
built into the training of sparse autoencoders to preserve interpretable
feature structure. Density-aware methods could be extended from
single-cell biology into dashboard tools for comparing model
checkpoints, where relative density of the activation space carries
training-dynamics signal.

None of these are moonshots. Each one is a recombination of ideas
already in this series. What is missing is usually not the conceptual
step but the engineering: building the method, scaling it, building UI
around it, and getting it into the hands of people doing the work it
could help with.

## Practical takeaways

If you are a practitioner using DR on ML data, a few rules of thumb that
fall out of this series:

Always start with PCA. It is cheap, deterministic, and tells you whether
the interesting structure is linear. If PCA already reveals what you
care about, you do not need anything fancier.

Run two methods, not one. UMAP plus PCA is a reasonable minimum; UMAP
plus Mapper or UMAP plus densMAP is better. If the methods agree on the
major features, those features are real. If they disagree, the
disagreement is information.

Vary the hyperparameters. Stability across n_neighbors, perplexity, and
random seed is how you tell signal from artifact. Structure that shows
up only at one parameter value should be treated skeptically.

Remember what each method preserves. Cluster sizes in a t-SNE plot are
not meaningful. Distances in a UMAP plot are not meaningful. Positions
in a Mapper graph are not meaningful. The meaningful content of each
visualization is narrower than it looks, and reading it accurately is
itself a skill.

Consider whether your data has structure that a specific family is
designed for. Tree-shaped data wants hyperbolic embeddings. Count data
wants scVI or similar. Data with meaningful density gradients wants
densMAP or PHATE. The generic default is not always the right default.

## Where this series goes next

This series was built as a survey, grounded in the literature and
organized around a single organizing question. The grounding material,
108 paper summaries in the latent-verse research directory, is linked
from the index. Where this series goes next depends on what you do with
it.

If you are an ML researcher, the most interesting opportunities are
probably in compositions and domain-specific priors, especially for
large-model interpretability. If you are a tool builder, the
interactive-view opportunity is wide open. If you are a practitioner,
the rules of thumb above will carry you further than adopting a new
method.

The families covered in this series are each answers to the question
"what should we preserve." The better questions, the ones worth asking
next, are about how we combine them, how we evaluate them in context,
and how we build interfaces that make the tradeoffs visible instead of
hiding them.
