import { useCallback, useState, useEffect, useMemo } from 'react';
import { Tooltip } from 'react-tooltip';
import { interpolateTurbo } from 'd3-scale-chromatic';
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
import EmbeddingVis from '../components/Essays/Embedding';
import EmbeddingInline from '../components/Essays/EmbeddingInline';
import CompareFeatureBars from '../components/Essays/CompareFeatureBars';
// import EmbeddingVis from '../components/Essays/EmbeddingBarChart';
import TokenEmbeddings, {
  AnimatedTokenEmbeddings,
  AverageTokenEmbeddings,
} from '../components/Essays/TokenEmbeddings';
import FeatureAutocomplete from '../components/Essays/FeatureAutocomplete';

import { cosineSimilarity } from '../utils';

import SearchInline from '../components/Essays/SearchInline';
import FeatureBars from '../components/Essays/FeatureBars';
import VectorVis from '../components/Essays/VectorVis';
import VectorEquation from '../components/Essays/VectorEquation';

import styles from './essays.module.scss';
// import styles from './nav-by-sim.module.scss';

import { apiService } from '../lib/apiService';
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
  const [steeredEmbedding, setSteeredEmbedding] = useState(null);

  const [selectedVector, setSelectedVector] = useState({
    vector: [0.5, 0.3],
    label: 'R1',
  });

  useEffect(() => {
    apiService.calcFeatures(catAndCalculatorEmbedding.embedding).then(async (features) => {
      const se = await apiService.calcSteering(features);
      setSteeredEmbedding(se);
    });
  }, []);

  useEffect(() => {
    apiService.getSaeFeatures(saeAvailable['🤗-nomic-ai___nomic-embed-text-v1.5'], (fts) => {
      console.log('SAE FEATURES', fts);
      setSaeFeatures(fts);
      setSelectedFeature(fts[6864]); //domestic wildlife
    });
  }, []);
  useEffect(() => {
    apiService.calcFeatures(catAndCalculatorEmbedding.embedding).then((features) => {
      console.log('FEATURES');
      console.log(features);
      setCatAndCalculatorFeatures(features);
      let catCalculatorModified = {
        ...features,
        top_acts: [...features.top_acts],
        top_indices: [...features.top_indices],
      };
      catCalculatorModified.top_acts[0] = cows[0].sae_acts[0];
      catCalculatorModified.top_indices[0] = cows[0].sae_indices[0];
      setCatCalculatorModified(catCalculatorModified);
      apiService.calcSteering(catCalculatorModified).then((embed) => {
        apiService.getNNEmbed('enjalot/ls-dadabase', 'scopes-001', embed).then((results) => {
          console.log('steered results', results);
          setSteeredResults(results);
        });
      });
    });
  }, []);
  useEffect(() => {
    apiService.getNNEmbed('enjalot/ls-dadabase', 'scopes-001', steeredEmbedding).then((results) => {
      console.log('reconstructed results', results);
      setReconstructedResults(results);
    });
  }, [steeredEmbedding]);

  const [tokenFeatures, setTokenFeatures] = useState([]);
  useEffect(() => {
    apiService
      .calcFeatures(
        catAndCalculatorEmbedding.hidden_states[0].map((hs) => {
          let norm = Math.sqrt(hs.reduce((sum, val) => sum + val * val, 0));
          let normalized = hs.map((val) => val / norm);
          return normalized;
        })
      )
      .then((features) => {
        console.log('TOKEN FEATURES', features);
        let tokfs = features.top_acts.map((act, i) => {
          return {
            top_acts: act,
            top_indices: features.top_indices[i],
          };
        });
        console.log('TOKFS', tokfs);
        setTokenFeatures(tokfs);
      });
  }, []);
  const [selectedResult, setSelectedResult] = useState(catAndCalculator[0]);

  const handleFeatureSelect = useCallback((feature) => {
    console.log('Selected feature:', feature);
    setSelectedFeature(feature);
  }, []);

  const handleSteer = useCallback((embedding) => {
    setSteeredEmbedding(embedding);
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
        </div>

        <section>
          <P>
            Navigating unstructured data with similarity search is becoming an increasingly popular
            technique. The fuzzy nature of nearest neighbor search is desirable for allowing people
            to search based more on the concepts they have in mind rather than the exact wording of
            the query. It is also a challenge when the results don't match the user's intent becuase
            it isn't clear what went wrong.
          </P>
          <P>
            There are new interpretability techniques like Sparse Autoencoders that allow us to dig
            a bit deeper into the concepts represented in the latent space used by the similarity
            search. They may even serve as a sort of high-dimensional compass, allowing us to
            navigate the space with more explicit control. This essay aims to build an intuition for
            similarity search, embedding spaces and how we can use Sparse Autoencoders to steer our
            searches through the latent space.
          </P>
        </section>

        <section>
          <H3>Dad Jokes</H3>
          <P>
            Let's start with a concrete dataset:{' '}
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

          {/* 
            <P>
              But what happens when we query for something that's not well represented in the
              dataset? Let's search for one of my favorite mathematicians: Hilbert.
            </P>

          <SearchResults
            results={hilbert}
            loading={false}
            dataset={{ text_column: 'joke' }}
            numToShow={4}
            showIndex={false}
          />
          <br />
          <P>
            We get a strange result as the first hit, a joke presumably related to Hilbert's German
            heritage and then two math related jokes.
          </P> */}
          <P>
            Let's try a query that doesn't give back an exact joke but has multiple concepts:
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
            From here out we'll represent these as a "waffle chart" just so we don't need to subject
            our eyes to 768 numbers every time we want to represent an embedding:
            <br />
            <Query>A cat and a calculator</Query>
            <EmbeddingVis
              embedding={catAndCalculatorEmbedding.embedding}
              rows={8}
              domain={[-0.1, 0, 0.1]}
              height={48}
            ></EmbeddingVis>
            <Caption>
              This visualization is a cross between a "waffle chart" and a heatmap, here we are
              converting each number to a small square, each square's color is more green the more
              positive the number and more orange the more negative.
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
                  height={48}
                ></EmbeddingVis>
              </div>
            ))}
            <br />
            You can embed any text and see what it looks like, flipping through the examples below
            you may also be able to sense that some are very different and some are more similar:
            <EmbeddingInline
              defaultQuery="winter holidays"
              examples={[
                'winter holidays',
                'A cat and a calculator',
                'Where do cats write notes? Scratch Paper!',
              ]}
            />
          </P>

          <P>
            Of course, it's very difficult for us to see similarity and differences across 768
            dimensions, whether we visualize them or not! We need more tools to see what is
            happening inside these representations.
          </P>
          {/* <EmbeddingVis embedding={catConstructed} rows={8} domain={[-0.2, 0, 0.2]} height={48} /> */}
        </section>

        <section>
          <H3>Sparse Autoencoders</H3>
          <P>
            A particularly helpful tool is called a Sparse Autoencoder, or SAE. An SAE allow us to
            automatically decompose embeddings into interpretable directions (i.e. concepts) that we
            can then use to navigate our data.
            <br />
            <img src="/images/essays/sae-diagram.png" />
            <br />
            For example, our query:
            <br />
            <Query>A cat and a calculator</Query>
            <EmbeddingVis
              embedding={catAndCalculatorEmbedding.embedding}
              rows={8}
              domain={[-0.1, 0, 0.1]}
              height={48}
            ></EmbeddingVis>
            Becomes:
            <Scrollable height={255}>
              <FeatureBars topk={catAndCalculatorFeatures} features={saeFeatures} numToShow={64} />
            </Scrollable>
            <Caption>
              The visualization above shows each of the directions as a bar. The number on the left{' '}
              <span className={styles.featureIdPill}>13557</span>is the feature index, and the
              number on the right <code>0.371</code> is the activation strength of that feature for
              the query. The bar's length is relative to the maximum activation seen on the SAE's
              training data. So this example activates the cat and the calculator about as strongly
              as they are ever activated.
            </Caption>
          </P>
          <P>
            The concepts shown in the above visualization are just 64 out of 25,000 directions that
            the SAE was trained to find. You can preview all the features in this grid below:
          </P>

          {saeFeatures && (
            <FeatureScatter
              features={saeFeatures}
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

          {/* <P>
            Now let's look at the top 10 directions of the top similarity result:
            <br />
            <Query>What do you call a reptile that is good at math? A Calcugator</Query>
            <FeatureBars topk={catAndCalculator[0]} features={saeFeatures} numToShow={10} />
          </P> */}

          <H3>Comparisons</H3>
          <P>
            Now we are equiped to examine our similarity search in more detail. Let's start by
            looking at the features in our query and compare them with the features in our search
            results:
          </P>
          <br />
          <div className={styles.fullWidth}>
            <div className={styles.fullWidthInner}>
              <CompareFeatureBars
                queryA="A cat and a calculator"
                queryB={selectedResult.joke}
                topkA={catAndCalculatorFeatures}
                topkB={selectedResult}
                features={saeFeatures}
                numToShow={10}
              />
            </div>
          </div>
          <em>Try selecting other results to see how the directions compare with the query.</em>
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
          <P>
            You may notice that many of the top features in our query are also contained in the top
            features of our search results! We can also see that some of our results contain some
            totally different directions that we may become curious about.
          </P>

          <H3>Filtering</H3>
          <P>
            We can follow our curiousity by filtering our dataset by finding the rows with the top
            activations for a given feature. This may be useful if you have identified a feature of
            interest and want to see what if any of your data activates strongly on that feature. To
            demonstrate this, select a feature and see the top 10 results that activate strongly on
            that feature:
          </P>

          {saeFeatures && (
            <div
              className={styles.featureSearchContainer}
              style={{ maxWidth: '600px', margin: '20px 0' }}
            >
              <FeatureFilter
                features={saeFeatures}
                defaultFeature={selectedFeature}
                onFeatureSelect={setSelectedFeature}
              />
            </div>
          )}

          <P>
            This form of filtering is supported directly in Latent Scope, see{' '}
            <a
              href={`https://latent.estate/scope/enjalot/ls-dadabase/scopes-001?filter=${selectedFeature?.feature}`}
            >
              all the jokes
            </a>{' '}
            that activate strongly on the <FeaturePill feature={selectedFeature} />{' '}
            {selectedFeature?.label} feature.
          </P>

          <H3>Steering 🐮</H3>

          <P>
            A very interesting technique we can do with an SAE is called steering. Steering in our
            context means we will change our embedding in a way that will affect the search results.
            In order to change our embedding we need to know that we can reconstruct our embedding
            from the SAE features. Reconstruction is when we take a query, run it through the SAE to
            get the features, and then run it backwards through the SAE to get a new embedding:
            <br />
            <img src="/images/essays/reconstruction-diagram.png" />
            <br />
            which will give us an approximation of our original embedding:
            <br />
            <Query>A cat and a calculator</Query>
            <EmbeddingVis
              embedding={catAndCalculatorEmbedding.embedding}
              rows={8}
              domain={[-0.1, 0, 0.1]}
              height={48}
            ></EmbeddingVis>
            <br />
            <Query>A cat and a calculator</Query>{' '}
            <em style={{ fontSize: '0.8em' }}>(reconstructed)</em>
            {steeredEmbedding && (
              <EmbeddingVis
                embedding={steeredEmbedding}
                rows={8}
                domain={[-0.1, 0, 0.1]}
                height={48}
              ></EmbeddingVis>
            )}
          </P>
          <P>
            You may be able to spot small differences in the visualization, but the cosine
            similarity between the two embeddings is{' '}
            <b>
              {steeredEmbedding
                ? cosineSimilarity(catAndCalculatorEmbedding.embedding, steeredEmbedding)?.toFixed(
                    3
                  )
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

          <P>
            Now let's take a look at a totally different query, showing just the top 5 directions:
            <br />
            <code>cows</code>
            <FeatureBars topk={cows[0]} features={saeFeatures} numToShow={5} />
            What if we were to take the top feature of this query{' '}
            <em>(6215 "characteristics and significance of cows")</em> and replace the top feature
            of our cat and calculator query:
            <br />
            <FeatureBars topk={catCalculatorModified} features={saeFeatures} numToShow={10} />
          </P>
          <P>
            Now let's do similarity search using the reconstructed embedding of our modified query:
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
          <P>
            Now we get several jokes about cowculators! Notice the Calcugator joke is still #4 in
            the search results.
          </P>
        </section>

        <section>
          <H3>Steering Playground</H3>

          <P>
            Now you can explore the Sparse Autoencoder features yourself and see how adjusting
            different semantic dimensions affects search results:
          </P>
          <ScopeProvider userParam="enjalot" datasetParam="ls-dadabase" scopeParam="scopes-001">
            <SearchProvider>
              <SteeringPlayground saeFeatures={saeFeatures} defaultQuery="A cat and a calculator" />
            </SearchProvider>
          </ScopeProvider>
          <P>
            Something you may have noticed is that before you start editing the steered features,
            your search results might be slightly different from the original query search results.
            This is beause when we use the SAE to reconstruct the original embedding it doesn't do a
            perfect job. Let's take a closer look, we can see the two embeddings visually are
            similar:
          </P>
        </section>

        <section>
          <H3>Look closer at your data</H3>
          <P>
            Use latent scope to run your own dataset through the same process to access these. The A
            live demo of thedad jokes scope is available{' '}
            <a href="https://latent.estate/scope/enjalot/ls-dadabase/scopes-001">on this site</a>
          </P>
        </section>

        <footer className={styles.footnotes}>
          <div className={styles.footnoteTitle}>Further Reading</div>
          <P>
            TODO: A number of articles on embeddings and SAEs:
            <ul>
              <li>
                <a href="https://www.jimmymeetsworld.com/embeddings">
                  Why I'm Excited About Embeddings
                </a>
              </li>
              <li></li>
            </ul>
          </P>

          <div className={styles.footnoteTitle}>Acknowledgements</div>
          <P>
            TODO:
            <a href="https://www.jimmymeetsworld.com/">Jimmy Zhang</a> for his contributions to
            Latent Scope, including improvements that made this article possible and his feedback on
            this article. Thank you to <a href="https://www.ksadov.com/">Konstantine Sadov</a>,{' '}
            <a href="https://a13x.io/">Alex Bäurle</a>
            for their thoughtful feedback on this article leading to numerous improvements.
          </P>

          {/* <Footnote
            number="1"
            text="This note underscores the importance of having a robust base in programming fundamentals."
          />
          <Footnote
            number="2"
            text="Abstraction not only simplifies complexity but also enables efficient problem decomposition."
          /> */}
          <Tooltip id="footnote" />
        </footer>
      </article>
    </div>
  );
}

export default NavBySim;
