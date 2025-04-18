import { useCallback, useState, useEffect, useMemo } from 'react';
import { Tooltip } from 'react-tooltip';
import { Footnote, FootnoteTooltip } from '../components/Essays/Footnotes';
import {
  P,
  H2,
  H3,
  Query,
  Array,
  Scrollable,
  Caption,
  Aside,
  Expandable,
} from '../components/Essays/Basics';

import { saeAvailable } from '../lib/SAE';
import { ScopeProvider } from '../contexts/ScopeContext';
import { SearchProvider, useSearch } from '../contexts/SearchContext';
import Search from '../components/Essays/Search';
import SearchResults from '../components/Essays/SearchResults';
import Examples from '../components/Essays/Examples';
// import EmbeddingVis from '../components/Essays/Embedding';
import EmbeddingVis from '../components/Essays/EmbeddingBarChart';
import EmbeddingInline from '../components/Essays/EmbeddingInline';
import EmbeddingDifferenceChart from '../components/Essays/EmbeddingDifferenceChart';
import CompareFeatureBars from '../components/Essays/CompareFeatureBars';
// import EmbeddingVis from '../components/Essays/EmbeddingBarChart';

import { cosineSimilarity } from '../utils';

import SearchInline from '../components/Essays/SearchInline';
import FeatureBars from '../components/Essays/FeatureBars';
import VectorVis from '../components/Essays/VectorVis';
import VectorEquation from '../components/Essays/VectorEquation';

import styles from './essays.module.scss';
// import styles from './nav-by-sim.module.scss';

import { apiService } from '../lib/apiService';
import {
  maybeCachedCalcFeatures,
  // maybeCachedCalcTokenizedEmbeddings,
  maybeCachedCalcSteering,
  maybeCachedGetNNEmbed,
  maybeCachedGetSaeFeatures,
  maybeCachedGetDatasetFeatures,
  saveCurrentCacheToConsole,
} from '../lib/cachedApiService';
import hilbert from './cached/hilbert.json';
import catAndCalculator from './cached/acatandacalculator.json';
import catAndCalculatorEmbedding from './cached/embedding-acatandacalculator.json';
import cows from './cached/cows.json';
/*
catConstructed = getSteering({
  "top_acts": [1,.5],
  "top_indices": [13557, 6864]
})
*/
import catConstructed from './cached/constructed-cat.json';
import SteeringPlayground from '../components/Essays/SteeringPlayground';
import Title from '../components/Title';
import FeatureScatter from '../components/Essays/FeatureScatter';
import VectorExample from '../components/Essays/VectorExample';
import FeatureFilter from '../components/Essays/FeatureFilter';
import FeaturePill from '../components/Essays/FeaturePill';
import { Helmet } from 'react-helmet';

function NavBySim() {
  // const embedding = useMemo(async () => {
  //   const emb = await apiService.calcTokenizedEmbeddings('A cat and a calculator');
  //   console.log('EMBEDDING');
  //   console.log(emb);
  //   return emb.embedding;
  // }, []);
  const [catAndCalculatorFeatures, setCatAndCalculatorFeatures] = useState(null);
  const [catCalculatorModified, setCatCalculatorModified] = useState(null);
  const [reconstructedResults, setReconstructedResults] = useState(null);
  const [steeredResults, setSteeredResults] = useState(null);
  const [saeFeatures, setSaeFeatures] = useState(null);
  const [selectedFeature, setSelectedFeature] = useState(null);
  const [reconstructedEmbedding, setReconstructedEmbedding] = useState(null);
  const [catCalculatorModifiedEmbedding, setCatCalculatorModifiedEmbedding] = useState(null);

  const [selectedVector, setSelectedVector] = useState({
    vector: [0.5, 0.3],
    label: 'R1',
  });
  const [embeddingVisHeight, setEmbeddingVisHeight] = useState(64);

  useEffect(() => {
    maybeCachedGetSaeFeatures(saeAvailable['🤗-nomic-ai___nomic-embed-text-v1.5'], (fts) => {
      // apiService.getSaeFeatures(saeAvailable['🤗-nomic-ai___nomic-embed-text-v1.5'], (fts) => {
      // console.log('SAE FEATURES', fts);
      setSaeFeatures(fts);
    });
  }, []);

  const [datasetFilteredFeatures, setDatasetFilteredFeatures] = useState(null);
  useEffect(() => {
    if (!saeFeatures) return;
    // Fetch the dataset features to see which features are actually present
    // apiService
    //   .getDatasetFeatures('enjalot', 'ls-dadabase', 'sae-001')
    maybeCachedGetDatasetFeatures('enjalot', 'ls-dadabase', 'sae-001')
      .then((dataFeatures) => {
        // console.log('data features', dataFeatures);
        // const filtered = dataFeatures.filter((f) => f.count > 0);
        const filtered = dataFeatures.map((f) => f);
        // console.log('filtered data features', filtered);
        const filteredFeatures = filtered.map((d) => {
          return {
            ...d,
            ...saeFeatures[d.feature_id],
          };
        });
        // .sort((a, b) => b.count - a.count);
        // console.log('filtered features', filteredFeatures);
        setDatasetFilteredFeatures(filteredFeatures);
        setSelectedFeature(filteredFeatures[6864]); //domestic wildlife
      })
      .catch((error) => {
        console.error('Error fetching dataset features:', error);
      });
  }, [saeFeatures]);

  useEffect(() => {
    maybeCachedCalcFeatures(catAndCalculatorEmbedding.embedding).then((features) => {
      // console.log('FEATURES');
      // console.log(features);
      setCatAndCalculatorFeatures(features);
      // also calculate the reconstructed embedding and search results with the reconstruction
      maybeCachedCalcSteering(features).then((embed) => {
        setReconstructedEmbedding(embed);
        maybeCachedGetNNEmbed('enjalot/ls-dadabase', 'scopes-001', embed).then((results) => {
          setReconstructedResults(results);
        });
      });

      let catCalculatorModified = {
        ...features,
        top_acts: [...features.top_acts],
        top_indices: [...features.top_indices],
      };
      // catCalculatorModified.top_acts[0] = cows[0].sae_acts[0];
      catCalculatorModified.top_indices[0] = cows[0].sae_indices[0];
      setCatCalculatorModified(catCalculatorModified);
      maybeCachedCalcSteering(catCalculatorModified).then((embed) => {
        setCatCalculatorModifiedEmbedding(embed);
        maybeCachedGetNNEmbed('enjalot/ls-dadabase', 'scopes-001', embed).then((results) => {
          // console.log('steered results', results);
          setSteeredResults(results);
        });
      });
    });
  }, []);

  const [selectedResult, setSelectedResult] = useState(catAndCalculator[0]);

  const handleFeatureSelect = useCallback((feature) => {
    console.log('Selected feature:', feature);
    setSelectedFeature(feature);
  }, []);

  return (
    <div className={styles.essayContainer}>
      <Title title="Navigating by Similarity" />
      <article className={styles.essayContent}>
        <h1 className={styles.title}>Navigating by Similarity</h1>
        <p className={styles.subtitle}>High-dimensional Wayfinding with Sparse Autoencoders</p>

        <div className={styles.meta}>
          <span className={styles.author}>By Ian Johnson</span>
          <span className={styles.date}>Published on March 17, 2025</span>
          {/* <button onClick={saveCurrentCacheToConsole}>Save Cache</button> */}
        </div>

        <section>
          <P>
            Navigating unstructured data with similarity search is becoming an increasingly popular
            technique, but the same magic that makes it so powerful can also be frustratingly
            opaque. What if we could search by steering the concepts we care about rather than
            prompting blindly for the right results?
          </P>

          <ScopeProvider userParam="enjalot" datasetParam="ls-dadabase" scopeParam="scopes-001">
            <SearchProvider>
              {/* <div className={styles.fullWidth}>
                <div className={styles.fullWidthInner}> */}
              <SteeringPlayground
                saeFeatures={datasetFilteredFeatures}
                defaultQuery="A cat and a calculator"
              />

              <Caption>
                Type in any query into the search bar above and see the top 5 dad jokes that are
                most similar to your query. You can also adjust the concepts found in your query by
                either changing their strength or changing the concepts themselves.
              </Caption>
              {/* </div>
              </div> */}
            </SearchProvider>
          </ScopeProvider>
          <P>
            This article explores what it could look like to navigate latent space using a Sparse
            Autoencoder trained on a text embedding model. We'll aim to build an intuition for
            similarity search, embedding spaces and Sparse Autoencoders at a practical level with
            interactive examples.
          </P>
        </section>

        <section>
          <H3>Dad Jokes</H3>
          <P>
            Any similarity search application starts with a dataset, so we'll use my favorite:{' '}
            <a href="https://www.kaggle.com/datasets/oktayozturk010/reddit-dad-jokes?select=reddit_dadjokes.csv">
              50,000 dad jokes from r/dadjokes
            </a>{' '}
            that have been{' '}
            <a href="https://github.com/enjalot/latent-scope/blob/main/notebooks/dadabase.ipynb">
              lightly curated
            </a>
            . Try searching them with similarity search to get a sense for the data:
          </P>

          <ScopeProvider userParam="enjalot" datasetParam="ls-dadabase" scopeParam="scopes-001">
            <SearchProvider>
              <SearchInline
                defaultQuery="cows"
                examples={['cows', 'feline stuff', 'Will Smith', 'winter holidays']}
              />
            </SearchProvider>
          </ScopeProvider>

          <br />
          <P>
            As you can see, even with more conceptual queries like "feline stuff" or "winter
            holidays" we get the kind of results we would hope for. The number on the right hand
            side of each joke is the cosine similarity, the closer to 1 the more similar the joke is
            to the query.
          </P>

          <P>
            Let's try a query that contains two distinct concepts:
            <br />
          </P>
          <Query>A cat and a calculator</Query>
          <SearchResults
            results={catAndCalculator}
            loading={false}
            dataset={{ text_column: 'joke' }}
            numToShow={4}
            showIndex={false}
          />
          <br />
          <P>
            We can see that the first joke is more about the calculator concept (though it is also
            about an animal) while the second focuses on the cat (though using a calculator on an
            exam may be considered cheating in many circumstances). The next two jokes are about
            cats writing on paper, which is somewhat conceptually close to using a tool like a
            calculator.
          </P>
          <P>
            Wouldn't it be great if we could see just how much each concept was being represented in
            each joke? What if we wanted to edit the query to avoid certain concepts or always
            include another relevant concept? To do that we'll need to dig a little deeper to see
            how the model represents our jokes.
          </P>
        </section>

        <section>
          <H3>Embeddings</H3>
          <P>
            When we talk about similarity search, we're talking about using cosine similarity to
            compare a query with a bunch of documents. But what is the actual computation being done
            to do this comparison? What are the inputs to the cosine similarity function?
          </P>
          <P>
            <img src="/navbysim/embedding.png" className={styles.diagram} />
            <Caption>
              An embedding model is like a lens that converts text into a vector. Focusing an
              arbitrary amount of text data into a single high-dimensional point.
            </Caption>
          </P>
          <P>
            When we submit our query we are actually converting it into a vector using an embedding
            model. In this case we're using{' '}
            <a href="https://huggingface.co/nomic-ai/nomic-embed-text-v1.5">
              nomic-ai/nomic-embed-text-v1.5
            </a>
            , a popular and effective open source model.
            <br />
            Our query <Query>A cat and a calculator</Query> is converted into a vector of 768
            floats:
            <br />
            <Array>
              [
              {catAndCalculatorEmbedding.embedding
                .map((val) => val.toFixed(3).replace('0.', '.'))
                .join(' ')}
              ]
            </Array>
            From here out we'll represent these as a bar chart just so we don't need to subject our
            eyes to 768 numbers every time we want to represent an embedding:
            <br />
            <Query>A cat and a calculator</Query>
            <EmbeddingVis
              embedding={catAndCalculatorEmbedding.embedding}
              rows={8}
              domain={[-0.1, 0, 0.1]}
              height={embeddingVisHeight}
            ></EmbeddingVis>
            <Caption>
              This visualization is a bar chart converting each number to a bar where the color is
              determined by the value, the more green the more positive the number and more orange
              the more negative.
            </Caption>
            <P>
              We also convert each row of our dataset into a vector by embedding the text column (in
              this case, the joke). Here are the visualized results for the 4 most similar jokes to
              our query:
            </P>
            {catAndCalculator.slice(0, 4).map((joke, idx) => (
              <div key={idx}>
                <Query>{joke.joke}</Query>
                <EmbeddingVis
                  embedding={joke.vector}
                  rows={8}
                  domain={[-0.1, 0, 0.1]}
                  height={embeddingVisHeight}
                ></EmbeddingVis>
                {/* <EmbeddingDifferenceChart
                  embedding1={catAndCalculatorEmbedding.embedding}
                  embedding2={joke.vector}
                  domain={[-0.1, 0, 0.1]}
                  height={embeddingVisHeight}
                ></EmbeddingDifferenceChart> */}
              </div>
            ))}
            <br />
            You can embed any text and see what it looks like, flipping through the examples below
            you may also be able to sense that some are very different and some are more similar:
            <EmbeddingInline
              defaultQuery="winter holidays"
              examples={[
                'winter holidays',
                'Where do cats write notes? Scratch Paper!',
                'What kind of cat passes an exam without studying? Cheetah',
              ]}
              compareEmbedding={catAndCalculatorEmbedding.embedding}
              height={embeddingVisHeight}
            />
            <Caption>
              We show the difference between the original search term{' '}
              <Query>A cat and a calculator</Query> and the query here as the red bar chart of the
              magnitudes of the differences between the embeddings.
            </Caption>
          </P>

          <P>
            Of course, it's very difficult for us to see similarity and differences across 768
            dimensions, whether we visualize them or not! We need more tools to see what is
            happening inside these representations.
          </P>
          {/* <EmbeddingVis embedding={catConstructed} rows={8} domain={[-0.2, 0, 0.2]} height={embeddingVisHeight} /> */}
        </section>

        <section>
          <H3>Sparse Autoencoders</H3>
          <P>
            <img src="/navbysim/features.png" className={styles.diagram} />
            <Caption>
              An SAE is like a prism, scattering an embedding into it's component concepts, allowing
              us to see how it is composed.
            </Caption>
          </P>
          <P>
            A particularly helpful tool is called a Sparse Autoencoder, or SAE. An SAE allow us to
            automatically decompose embeddings into interpretable directions (i.e. concepts) that we
            can then use to navigate our data. For example, our query:
          </P>
          <P>
            <Query>A cat and a calculator</Query>
            <EmbeddingVis
              embedding={catAndCalculatorEmbedding.embedding}
              rows={8}
              domain={[-0.1, 0, 0.1]}
              height={embeddingVisHeight}
            ></EmbeddingVis>
          </P>
          <P>Decomposes into:</P>
          <Scrollable height={255}>
            <FeatureBars
              topk={catAndCalculatorFeatures}
              features={datasetFilteredFeatures}
              numToShow={64}
            />
          </Scrollable>
          <Caption>
            The visualization above shows each of the directions as a bar. The number on the left{' '}
            <span className={styles.featureIdPill}>13557</span>is the feature index, and the number
            on the right <code>0.371</code> is the activation strength of that feature for the
            query. The bar's length is relative to the maximum activation seen on the SAE's training
            data. So this example activates the cat and the calculator about as strongly as they are
            ever activated.
          </Caption>

          <Expandable
            title="An interactive refresher on high-dimensional vector composition"
            subtitle="This section tries to provide some intuition for how an SAE comes from adding vectors together."
          >
            <P>
              To understand what the SAE does for us, let's do a quick review of high-dimensional
              vector spaces, starting with a simplified version of the classic example:
              <VectorEquation
                vectors={[
                  { vector: [1, -1], label: 'King' },
                  { vector: [-0.3, 0.7], label: 'Man' },
                ]}
                operations={['-']}
                resultLabel="Queen"
                scale={0.75}
                height={200}
              />
              <P>
                It was shown{' '}
                {/* <Footnote number="1">
                  <a href="https://arxiv.org/abs/1509.01692">
                    <em>
                      Take and Took, Gaggle and Goose, Book and Read: Evaluating the Utility of Vector
                      Differences for Lexical Relation Learning
                    </em>
                  </a>
                </Footnote> */}
                that embeddings aren't just points in high-dimensional space, they are directions.
                So if you subtracted one direction from another (<Query>King</Query> -{' '}
                <Query>Man</Query>) you would be pointing in a new direction, which was very similar
                to the direction for <Query>Queen</Query>.
              </P>
              <P>We can also think about a direction as being composed of sub-directions:</P>
              <VectorEquation
                vectors={[
                  { vector: [0.3, -0.7], label: 'Woman' },
                  { vector: [0.4, 0.4], label: 'Royalty' },
                ]}
                operations={['+']}
                resultLabel="Queen"
                scale={0.75}
                height={200}
              />
              <P>We can take this further and add together sub-sub-directions:</P>
              <VectorEquation
                vectors={[
                  { vector: [0.3, -0.7], label: 'Woman' },
                  // { vector: [0.1, 0.15], label: 'Court' },
                  { vector: [0.15, 0.25], label: 'Crown' },
                  { vector: [0.25, 0.15], label: 'Monarchy' },
                ]}
                operations={['+', '+', '+']}
                scale={0.75}
                resultLabel="Queen"
                height={200}
              />
            </P>
            <P>
              Now we want to consider that each document in our dataset is a vector and we want to
              find some set of "sub-directions" that can be combined to reconstruct any document. A
              Sparse Autoencoder essentially figures out what those directions are. Thus, for a
              given document vector:
              <VectorExample onSelect={setSelectedVector} selectedVector={selectedVector} />
              We would get some linear combination of "sub-directions" (sometimes called "features")
              to reconstruct that vector:
              <VectorEquation
                vectors={[
                  { vector: [0.3, -0.7], label: 'A' },
                  { vector: [0.15, 0.5], label: 'B' },
                  // { vector: [-0.7, 0.15], label: 'C' },
                  // { vector: [-0.1, 0.8], label: 'D' },
                ]}
                operations={['+', '+']}
                scale={0.75}
                scalable={true}
                resultLabel={selectedVector.label}
                inverseK={true}
                interactive={false}
                targetVector={selectedVector}
                height={200}
              />
              Finally, you can reconstruct any direction in our space by doing some linear
              combination of the two "feature" directions, try changing the sliders or dragging the
              target vector to see it in action:
              <VectorEquation
                vectors={[
                  { vector: [0.3, -0.7], label: 'A' },
                  { vector: [0.15, 0.5], label: 'B' },
                  // { vector: [-0.7, 0.15], label: 'C' },
                  // { vector: [-0.1, 0.8], label: 'D' },
                ]}
                operations={['+', '+']}
                scale={0.75}
                scalable={true}
                resultLabel={'R'}
                inverseK={true}
                targetVector={{ vector: [0.5, 0.3], label: 'R' }}
                interactive={true}
                height={200}
              />
            </P>
            <P>
              Of course, in the high-dimensional SAE you would have many more features, and the
              combination would be made up of some small subset of them. The intuition should hold
              though, that you would be able to reconstruct any of the embeddings (directions) in
              your dataset as a linear combination of these features.
            </P>
          </Expandable>

          <P>
            The concepts shown in the above visualization are just 64 out of 25,000 directions that
            the SAE was trained to find. You can preview all the features in this grid below:
          </P>

          {datasetFilteredFeatures && (
            <FeatureScatter
              features={datasetFilteredFeatures}
              selectedFeature={selectedFeature}
              onFeature={handleFeatureSelect}
              height={500}
            />
          )}
          <Caption>
            Each dot is one feature, colored by semantic ordering. The names of each feature are
            automatically generated by an LLM from samples of the training data. You can read more
            about how this SAE was trained at{' '}
            <a href="https://enjalot.github.io/latent-taxonomy/articles/about">Latent Taxonomy</a>.
          </Caption>

          <P>We can filter our dataset to the rows with the top activations for a given feature:</P>

          {datasetFilteredFeatures && (
            <>
              <FeatureFilter
                features={datasetFilteredFeatures}
                selectedFeature={selectedFeature}
                onFeatureSelect={handleFeatureSelect}
              />
              <Caption>
                There are {selectedFeature?.count} jokes that activate on the{' '}
                <FeaturePill feature={selectedFeature} /> <Query>{selectedFeature?.label}</Query>{' '}
                feature.
                <br />
                See them all in the{' '}
                <a
                  href={`https://latent.estate/scope/enjalot/ls-dadabase/scopes-001?feature=${selectedFeature?.feature}`}
                >
                  Latent Scope demo
                </a>
                .
              </Caption>
            </>
          )}
          <P>
            This gives us another way to think about the SAE as a compass, pointing us in a
            particular direction in the latent space.
          </P>

          {/* <P>
            Now let's look at the top 10 directions of the top similarity result:
            <br />
            <Query>What do you call a reptile that is good at math? A Calcugator</Query>
            <FeatureBars topk={catAndCalculator[0]} features={datasetFilteredFeatures} numToShow={10} />
          </P> */}

          <H3>Comparisons</H3>
          <P>
            Now we are equipped to examine our similarity search in more detail. Let's start by
            comparing the concepts found in two embeddings. We take our search query and get it's
            features, and then we take a search result and get it's features. We can then see which
            features are shared, and how strongly they may be activated.
            <div className={styles.fullWidth}>
              <div className={styles.fullWidthInner}>
                <CompareFeatureBars
                  queryA="A cat and a calculator"
                  queryB={selectedResult.joke}
                  topkA={catAndCalculatorFeatures}
                  topkB={selectedResult}
                  features={datasetFilteredFeatures}
                  numToShow={10}
                />
              </div>
            </div>
            <SearchResults
              results={catAndCalculator}
              loading={false}
              dataset={{ text_column: 'joke' }}
              numToShow={5}
              showIndex={false}
              onSelect={setSelectedResult}
              selectedResult={selectedResult}
              selectable={true}
            />
            <Caption>
              Try selecting other results to see how the directions compare with the query.
            </Caption>
          </P>
          <P>
            You may notice that many of the top features in our query are also contained in the top
            features of our search results! We can also see that some of our results contain some
            totally different directions that we may become curious about.
          </P>

          <H3>Reconstruction</H3>
          <P>
            <img src="/navbysim/reconstruction.png" className={styles.diagram} />
            <Caption>
              We can also put features back into the SAE to reconstruct an embedding.
            </Caption>
          </P>
          <P>
            One more important concept we need to understand is reconstruction. Reconstruction is
            when we take a query, run it through the SAE to get the features, and then run it
            backwards through the SAE to get a new embedding: which will give us an approximation of
            our original embedding:
            <br />
            <Query>A cat and a calculator</Query>
            <EmbeddingVis
              embedding={catAndCalculatorEmbedding.embedding}
              rows={8}
              domain={[-0.1, 0, 0.1]}
              height={embeddingVisHeight}
            ></EmbeddingVis>
            <EmbeddingDifferenceChart
              embedding1={catAndCalculatorEmbedding.embedding}
              embedding2={reconstructedEmbedding}
              domain={[-0.1, 0, 0.1]}
              height={embeddingVisHeight}
            />
            <EmbeddingVis
              embedding={reconstructedEmbedding}
              rows={8}
              domain={[-0.1, 0, 0.1]}
              height={embeddingVisHeight}
            ></EmbeddingVis>
            <Query>A cat and a calculator</Query>{' '}
            <em style={{ fontSize: '0.8em' }}>(reconstructed)</em>
            <Caption>
              The difference between the original embedding and the reconstructed embedding is shown
              in red.
            </Caption>
          </P>
          <P>
            You may be able to spot small differences in the visualization, but the cosine
            similarity between the two embeddings is{' '}
            <b>
              {reconstructedEmbedding
                ? cosineSimilarity(
                    catAndCalculatorEmbedding.embedding,
                    reconstructedEmbedding
                  )?.toFixed(3)
                : 'N/A'}
            </b>
            , which is pretty close to 1. It isn't exactly 1 because the SAE isn't able to
            reconstruct perfectly, but it is close enough to get good results if we search by the
            reconstructed embedding:
            {reconstructedResults && (
              <SearchResults
                results={reconstructedResults}
                loading={false}
                dataset={{ text_column: 'joke' }}
                numToShow={5}
                showIndex={false}
              />
            )}
          </P>

          <H3>Steering 🐮</H3>
          <P>
            A very interesting technique we can do with reconstruction is called steering. Steering
            in our context means we will change our embedding in a way that will affect the search
            results. What if we were to take the{' '}
            <em>
              {datasetFilteredFeatures && (
                <>
                  <FeaturePill feature={datasetFilteredFeatures[6215]} /> characteristics and
                  significance of cows
                </>
              )}
            </em>{' '}
            and replace the top feature of our cat and calculator query with it:
            <br />
            {/* <FeatureBars
              topk={catCalculatorModified}
              features={datasetFilteredFeatures}
              numToShow={10}
            /> */}
            <div className={styles.fullWidth}>
              <div className={styles.fullWidthInner}>
                <CompareFeatureBars
                  queryA="A cat and a calculator"
                  queryB="*edited version with cow feature*"
                  topkA={catAndCalculatorFeatures}
                  topkB={catCalculatorModified}
                  features={datasetFilteredFeatures}
                  numToShow={10}
                />
              </div>
            </div>
          </P>
          <P>
            <Query>
              A cat and a calculator
              <em style={{ fontSize: '0.8em' }}>(reconstructed)</em>
            </Query>
            <EmbeddingVis
              embedding={reconstructedEmbedding}
              rows={8}
              domain={[-0.1, 0, 0.1]}
              height={embeddingVisHeight}
            ></EmbeddingVis>
            <EmbeddingDifferenceChart
              embedding1={reconstructedEmbedding}
              embedding2={catCalculatorModifiedEmbedding}
              domain={[-0.1, 0, 0.1]}
              height={embeddingVisHeight}
            />
            <EmbeddingVis
              embedding={catCalculatorModifiedEmbedding}
              rows={8}
              domain={[-0.1, 0, 0.1]}
              height={embeddingVisHeight}
            ></EmbeddingVis>
            <Query>*edited version with cow feature*</Query>{' '}
            <Caption>
              The difference between the original reconstructed embedding and the steered embedding
              is shown in red.
            </Caption>
          </P>
          <P>
            Now let's do similarity search using the reconstructed embedding of our steered query:
            <br />
            {steeredResults && (
              <SearchResults
                results={steeredResults}
                loading={false}
                dataset={{ text_column: 'joke' }}
                numToShow={5}
                showIndex={false}
              />
            )}
          </P>
          <P>We get several jokes about cowculators!</P>
        </section>

        <section>
          <H3>Steering Playground</H3>
          <P>
            At this point we can revisit the steering playground from the start of the article. Try
            exploring the Sparse Autoencoder features yourself and see how adjusting different
            semantic dimensions affects search results:
          </P>
          <ScopeProvider userParam="enjalot" datasetParam="ls-dadabase" scopeParam="scopes-001">
            <SearchProvider>
              <SteeringPlayground
                saeFeatures={datasetFilteredFeatures}
                defaultQuery="A cat and a calculator"
              />
            </SearchProvider>
          </ScopeProvider>
        </section>

        <section>
          <H3>Look closer at your data</H3>
          <P>
            If you want to do these same techniques on your own dataset, download{' '}
            <a href="https://github.com/enjalot/latent-scope">Latent Scope</a> and follow the steps
            to embed your data and extract SAE features from it. You will be able to explore via the
            interface demonstrated on the{' '}
            <a href="https://latent.estate/scope/enjalot/ls-dadabase/scopes-001">
              dad jokes dataset
            </a>
            .
            <br />
            <br />
            Join the <a href="https://discord.gg/x7NvpnM4pY">Latent Interfaces Discord</a> to get
            support for using Latent Scope and share your explorations with the community!
          </P>
        </section>

        <footer className={styles.footnotes}>
          <H2>Further Reading</H2>
          <P>
            Here is a select list of resources I've found helpful for understanding embeddings and
            Sparse Autoencoders
            <ul>
              <li>
                <a href="https://www.jimmymeetsworld.com/embeddings">
                  Why I'm Excited About Embeddings
                </a>{' '}
                by Jimmy Zhang
              </li>
              <li>
                <a href="https://adamkarvonen.github.io/machine_learning/2024/06/11/sae-intuitions.html">
                  An Intuitive Explanation of Sparse Autoencoders for LLM Interpretability
                </a>{' '}
                by Adam Karvonen
              </li>
              <li>
                <a href="https://thesephist.com/posts/prism/">
                  Prism: mapping interpretable concepts and features in a latent space of language
                </a>{' '}
                by Linus Lee
              </li>
              <li>
                <a href="https://arxiv.org/abs/2408.00657">
                  Disentangling Dense Embeddings with Sparse Autoencoders
                </a>{' '}
                by O'Neill et al.
              </li>
              <li>
                <a href="https://transformer-circuits.pub/2023/monosemantic-features">
                  Towards Monosemanticity: Decomposing Language Models With Dictionary Learning
                </a>{' '}
                by Anthropic
              </li>
              <li>
                <a href="https://transformer-circuits.pub/2023/monosemantic-features">
                  Towards Monosemanticity: Decomposing Language Models With Dictionary Learning
                </a>{' '}
                by Anthropic
              </li>
              <li>
                <a href="https://transformer-circuits.pub/2024/scaling-monosemanticity/index.html">
                  Scaling Monosemanticity: Extracting Interpretable Features from Claude 3 Sonnet
                </a>{' '}
                by Anthropic
              </li>
              <li>
                <a href="https://www.neuronpedia.org/">Neuronpedia</a> by Johnny Lin
              </li>
            </ul>
            You can read more about how the SAE used in this article was trained at{' '}
            <a href="https://enjalot.github.io/latent-taxonomy/articles/about">Latent Taxonomy</a>.
          </P>

          <H2>Acknowledgements</H2>
          <P>
            Thank you to <a href="https://www.jimmymeetsworld.com/">Jimmy Zhang</a> for his
            contributions to Latent Scope, including improvements that made this article possible as
            well as extensive feedback on this article.
          </P>
          <P>
            Thank you to <a href="https://www.ksadov.com/">Konstantine Sadov</a>,{' '}
            <a href="https://a13x.io/">Alex Bäurle</a>,{' '}
            <a href="https://gytis.co/">Gytis Daujotas</a>,{' '}
            <a href="http://erikhazzard.com">Erik Hazzard</a> and{' '}
            <a href="https://www.linkedin.com/in/johntigue/">John Tigue</a> for their thoughtful
            feedback on this article leading to numerous improvements.
          </P>
          <P>
            <a href="https://builders.mozilla.org/">Mozilla Builders</a> provided grant funding
            supporting Latent Scope.
          </P>
          <P>
            <a href="https://modal.com">Modal</a> provided the compute credits to train the SAE and
            host the API powering the interactive parts of this article.
          </P>
          <P>
            <br />
            <br />
            <br />
          </P>
        </footer>
      </article>
    </div>
  );
}

export default NavBySim;
