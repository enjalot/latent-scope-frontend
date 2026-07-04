---
title: Learned Representations
description: Autoencoders, VAE, scVI, parametric UMAP. When the dimensionality reduction is itself a trained neural function.
series: dim-reduction
order: 9
---

Every method in the earlier articles defines its notion of "good
embedding" once, in the algorithm. PCA preserves variance. t-SNE
preserves neighborhoods. Mapper preserves connectivity through a filter.
In each case, the method's objective is a fixed choice made by the
algorithm designer; the user's only knobs are hyperparameters that
change how the fixed objective is applied.

The learned-representation family breaks this constraint. Instead of
running an optimization over the embedding coordinates directly, it
trains a neural network to produce the embedding. The network is a
function: high-dimensional input in, low-dimensional output out.
Whatever you make the network minimize during training becomes, by the
end of training, what the embedding preserves. This makes the objective
itself a design knob.

Several families of methods fall under this umbrella. Vanilla
autoencoders preserve reconstruction. Variational autoencoders preserve
reconstruction plus a probabilistic prior. Parametric UMAP preserves
UMAP's neighbor objective, but through a trained encoder.
Domain-specific methods like scVI preserve reconstruction under a
likelihood model tailored to the data. They share a common shape: an
encoder that reduces dimensions, a training objective that disciplines
the encoder's behavior, and a latent space whose properties reflect what
the objective rewarded.

## The autoencoder: compress and reconstruct

The simplest member of the family is the autoencoder. Train a neural
network to take an input, compress it through a low-dimensional
bottleneck, and reconstruct the input from the bottleneck
representation. If the bottleneck is two- or three-dimensional, you get
a DR method as a side effect: the encoder maps the input to a
low-dimensional latent vector, which is the embedding.

The objective is reconstruction error (usually mean squared error or
cross-entropy). A point whose latent vector reconstructs its input
accurately has been represented well; a point whose reconstruction is
poor is being badly represented. The network learns to arrange the
latent space in a way that lets the decoder recover as much input
information as possible from as few latent dimensions as possible.
Unlike PCA, which also minimizes reconstruction error but only over
linear encoders, autoencoders can learn nonlinear mappings, which is
their main selling point.

A useful way to picture a trained autoencoder is to look at the
*decoder* as a parameterized curve or surface. The latent space has some
fixed dimension; the decoder maps each latent point to a reconstruction
in the original (high-dimensional) space. As you move through the latent
space, the reconstruction moves along a manifold that the network has
learned.

:::figure{id=ae}
A 1-dimensional autoencoder trained on a curved 2D manifold. Left: the
encoder maps each input point to a latent scalar $z$ in $[0, 1]$. Right:
the decoder maps any $z$ back to a 2D reconstruction (the blue curve). As you
drag the slider, the ringed point is the data point whose encoding is
nearest your $z$, and the dashed segment connects it to its
reconstruction on the learned curve — the full round trip
data → $z$ → reconstruction. The gap is the reconstruction error: the
off-manifold noise the autoencoder discards.
:::

What the autoencoder preserves is shaped entirely by the architecture
and the training data. With enough capacity, it can memorize the data
exactly. With too little capacity, it fails to reconstruct anything
well. In between, it preserves whichever aspects of the data are easiest
to reconstruct. For a curved manifold like the one in
:term[the figure above]{to=ae}, a small autoencoder will tend to find
the manifold's intrinsic parameterization.
For high-variance noise on top of low-dimensional structure, it will
tend to keep the structure and throw away the noise.

## Variational autoencoders: putting a prior on the latent

Vanilla autoencoders have no constraint on the geometry of their latent
space; the encoder can scatter inputs however it wants, as long as the
decoder can invert the mapping. This often produces latent spaces with
holes, elongated regions, or inconsistent density. Sampling a random
point in the latent space and decoding it may give nonsense, because the
decoder was only trained to handle the latent points the encoder
actually produced.

The variational autoencoder, from Kingma and Welling's 2013 paper, fixes
this by adding a probabilistic structure. The encoder does not output a
single latent point; it outputs a distribution (parameters of a
Gaussian). Training encourages this encoder distribution to stay close
to a fixed prior (typically a unit Gaussian), using a KL-divergence term
added to the reconstruction loss. The result is a latent space that is
continuous and has predictable density: you can sample from the prior,
decode, and get something that looks like training data.

In terms of what they preserve: a VAE preserves both reconstruction
*and* a smooth probabilistic latent geometry. This is very useful when
you want to generate new samples by sampling from the prior and decoding
them, when you want to interpolate smoothly between examples, or when
you want a latent space suitable for downstream probabilistic models. It
is less ideal as a pure visualization tool, because the smoothing can
wash out cluster structure that a non-regularized method would keep
sharp.

## Parametric UMAP: learning a neighbor objective with a network

A natural question: if neural networks can learn whatever objective we
train them with, why not train them on the UMAP or t-SNE objective
instead of reconstruction? That is what parametric UMAP (Sainburg et
al., 2021) does. Build the UMAP high-dimensional neighborhood graph as
usual, but instead of directly optimizing a 2D embedding, train a neural
network encoder whose output is scored against the UMAP loss.

This combines two useful properties. You get UMAP's characteristic
preservation of local neighborhoods, plus the benefits of a parametric
function: a new unseen data point can be embedded in a single forward
pass rather than needing to rerun the optimization; the encoder can be
regularized, composed with classifiers, or fine-tuned; the embedding
becomes reproducible across runs because the network captures the
mapping rather than the optimization's initialization.

The cost is the cost of neural networks in general. You need a GPU (or
patience), you need to pick an architecture, and you need to tune
learning rates and batch sizes. But for workflows where the same DR
model will be reused across many datasets or queried with new data,
parametric methods are often worth it. IVIS (Szubert et al., 2019) is a
similar idea that uses triplet-based supervision.

> Parametric methods turn dimensionality reduction into a trained model
> with a fixed API. This is often what you want when the DR is a
> production-facing pipeline that needs to embed new examples quickly and
> reproducibly. Non-parametric methods (the default t-SNE and UMAP) are
> more like a one-shot analysis.

## Domain-specific: scVI and the case of count data

A compelling argument for learned representations is that they
let you customize the likelihood model. Consider single-cell RNA
sequencing. Each cell produces a vector of gene counts, typically around
20,000 genes, with each count ranging from zero to thousands. The data
is sparse (most entries are zero), discrete (counts are integers), and
overdispersed (variance much larger than the mean).

Applying PCA or UMAP to raw counts is problematic: they assume
Gaussian-ish Euclidean data. The standard workaround is to
log-transform, normalize, and then run the DR method, but this is a
hack; the log step hides the discrete count structure and the
normalization introduces artifacts. What we actually want is a method
that takes the count structure seriously.

scVI, from Lopez and colleagues in 2018, is a VAE with a tailored
likelihood. Instead of a Gaussian reconstruction loss, it uses a
zero-inflated negative binomial distribution, which is appropriate for
sparse overdispersed counts. The latent space captures biological
variation; the likelihood handles the count-specific noise properly; and
batch effects can be modeled explicitly via a conditioning variable. The
whole pipeline is a single probabilistic model rather than a sequence of
separate preprocessing steps.

The scVI approach is a clear example of what learned
representations buy you: the ability to match the model to the data.
When your data has a specific structure (counts, sequences, images,
graphs), you can build a likelihood that respects that structure, and
the resulting latent space is consequently better. This is not possible
with methods from earlier articles, which are generic and
domain-agnostic.

## A unified view of the family

Despite their differences in objective, all the methods in this article
share :term[the same architectural shape]{to=neural}. An encoder reduces the
dimensionality; a training objective disciplines what the encoder
preserves; a latent space emerges that reflects the objective.

:::figure{id=neural}
The learned-representation family as variations on one architecture; the
training objective is what differs. The dashed orange ring marks where
each loss attaches. Autoencoders minimize reconstruction at the output.
VAEs add a prior on the latent, so their loss attaches in both places.
Parametric UMAP scores the latent directly against the neighbor graph —
no decoder needed. scVI replaces the Gaussian reconstruction with a
count-aware likelihood.
:::

Because the objective is where the methods differ, you can mix and
match. Train a VAE with a topological regularization term (topological
autoencoders, which we saw in article 5). Train a parametric UMAP with a
hyperbolic decoder. Train an scVI with contrastive pretraining. The
learned-representation family is modular in a way that the other
families are not.

## What you give up

The learned-representation family comes with real costs. Training is
slow (hours to days on a GPU) compared to a few minutes for UMAP on a
CPU. Reproducibility depends on random seeds, initialization, and
architecture choices. Hyperparameter sensitivity is higher than for the
classical methods. Interpretability is lower: a trained network is an
opaque function, and explaining why two points ended up near each other
in its latent space is harder than explaining why they did in PCA or
t-SNE.

For visualization alone, UMAP on the raw data is usually faster,
cheaper, and nearly as good. For production use, for domain-specific
likelihoods, for out-of-sample queries, or for composition with other
neural components, the learned family is worth the cost, so the choice
between them tends to depend on your workflow rather than raw performance.

## Why this family matters for understanding ML latent spaces

A small detail worth stating explicitly: if you are studying the
internal representations of a large neural model (an LLM, a vision
transformer, a protein model), you are already looking at a learned
representation. The activations you want to visualize are themselves the
output of an encoder trained on some objective; that objective is what
determines what those activations preserve.

So when you run UMAP on a language model's embeddings, you are actually
composing two learned representations: the LM's (trained to predict the
next token, say) and UMAP's (trained, implicitly, to preserve
neighborhoods). The resulting 2D picture tells you about the
intersection of those two objectives, not about either one in isolation.
This is a useful lens to carry into the capstone article, where we
consider what the current methods are missing and where the community
has room to invent.
