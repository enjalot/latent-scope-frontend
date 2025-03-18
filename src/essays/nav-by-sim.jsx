import { useCallback, useState, useEffect, useMemo } from 'react';
import { Tooltip } from 'react-tooltip';
import { Footnote, FootnoteTooltip } from '../components/Essays/Footnotes';
import { P, H2, H3 } from '../components/Essays/Basics';

import { saeAvailable } from '../lib/SAE';
import { ScopeProvider } from '../contexts/ScopeContext';
import { SearchProvider, useSearch } from '../contexts/SearchContext';
import Search from '../components/Essays/Search';
import SearchResults from '../components/Essays/SearchResults';
import Examples from '../components/Essays/Examples';
import EmbeddingVis from '../components/Essays/Embedding';
// import EmbeddingVis from '../components/Essays/EmbeddingBarChart';
import TokenEmbeddings, {
  AnimatedTokenEmbeddings,
  AverageTokenEmbeddings,
} from '../components/Essays/TokenEmbeddings';

import SearchInline from '../components/Essays/SearchInline';
import FeatureBars from '../components/Essays/FeatureBars';

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

function NavBySim() {
  // const embedding = useMemo(async () => {
  //   const emb = await apiService.calcTokenizedEmbeddings('A cat and a calculator');
  //   console.log('EMBEDDING');
  //   console.log(emb);
  //   return emb.embedding;
  // }, []);
  const [catAndCalculatorFeatures, setCatAndCalculatorFeatures] = useState(null);
  const [catCalculatorModified, setCatCalculatorModified] = useState(null);
  const [steeredResults, setSteeredResults] = useState(null);
  const [saeFeatures, setSaeFeatures] = useState(null);
  useEffect(() => {
    apiService.getSaeFeatures(saeAvailable['🤗-nomic-ai___nomic-embed-text-v1.5'], (fts) => {
      console.log('SAE FEATURES', fts);
      setSaeFeatures(fts);
    });
  }, []);
  useEffect(() => {
    apiService.calcFeatures(catAndCalculatorEmbedding.embedding).then((features) => {
      console.log('FEATURES');
      console.log(features);
      setCatAndCalculatorFeatures(features);
      let catCalculatorModified = {
        ...features,
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
  const [tokenFeatures, setTokenFeatures] = useState([]);
  useEffect(() => {
    apiService
      .calcFeatures(
        catAndCalculatorEmbedding.hidden_states[0].map((hs) => {
          console.log('HS', hs);
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
  return (
    <div className={styles.essayContainer}>
      <article className={styles.essayContent}>
        <h1 className={styles.title}>Navigating by Similarity</h1>
        <p className={styles.subtitle}>Gaining a Visual Intuition for Latent Space</p>

        <div className={styles.meta}>
          <span className={styles.author}>By Ian Johnson</span>
          <span className={styles.date}>Published on March 17, 2025</span>
        </div>

        <section>
          <P>
            I am interested in better understaning what's happening when we use similarity search to
            navigate large amounts of unstructured data. I'm especially interested in new techniques
            that would allow us to build better tools for mapping latent space. In this essay I'm
            hoping to build an intuition for how similarity search works and when it fails. We'll
            examine the potential for Sparse Autoencoders to become a kind of high-dimensional
            compass, and use our intution to feel for the limits of steering similarity search.
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
            <em> A cat and a calculator</em>
          </P>
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
            include another relevant concept? To do that we'll need to have some way of accessing
            the concepts in our data, and that's where Sparse Autoencoders come in.
          </P>
        </section>

        <section>
          <H3>Embeddings</H3>
          <P>
            Before we can get into Sparse Autoencoders, let's take a closer look at what's actually
            happening with similarity search. We need to go one step deeper and look at what's being
            compared when we talk about "similarity".
          </P>
          <P>
            When we submit our query we are actually converting it into a vector using an embedding
            model. In this case we're using <a href="">nomic-ai/nomic-embed-text-v1.5</a>, an open
            source model with 768 dimensional embeddings. We'll represent those 768 numbers as a
            "waffle chart" just so we don't need to subject our eyes to 768 numbers every time we
            want to represent an embedding.
          </P>
          <P>
            <code>A cat and a calculator</code>
            <EmbeddingVis
              embedding={catAndCalculatorEmbedding.embedding}
              rows={8}
              domain={[-0.1, 0, 0.1]}
              height={48}
            ></EmbeddingVis>
          </P>
          <P>
            We also convert each row of our dataset into a vector by embedding the text column (in
            this case, the joke). Here are the visualized results for the 4 most similar jokes to
            our query:
            <br />
            <br />
            {catAndCalculator.slice(0, 4).map((joke, idx) => (
              <div key={idx}>
                <code>{joke.joke}</code>
                <EmbeddingVis
                  embedding={joke.vector}
                  rows={8}
                  domain={[-0.1, 0, 0.1]}
                  height={48}
                ></EmbeddingVis>
              </div>
            ))}
          </P>

          <P>
            Of course, it's very difficult for us to see similarity and differences across 768
            dimensions, whether we visualize them or not! That's why most applications of similarity
            search use a tool called cosine similarity to measure the distance between two
            high-dimensional embeddings. But by reducing our comparison to a single number we lose a
            lot of information about <em>what</em> is similar or different between our query and our
            data.
          </P>
          {/* <EmbeddingVis embedding={catConstructed} rows={8} domain={[-0.2, 0, 0.2]} height={48} /> */}
        </section>

        <section>
          <H3>Sparse Autoencoders</H3>
          <P>TODO: introduce</P>
          <P>
            We can break down our query embedding into directions (concepts) via the SAE:
            <br />
            <code>A cat and a calculator</code>
            {/* <EmbeddingVis
              embedding={catAndCalculatorEmbedding.embedding}
              rows={8}
              domain={[-0.1, 0, 0.1]}
              height={48}
            ></EmbeddingVis> */}
            <FeatureBars topk={catAndCalculatorFeatures} features={saeFeatures} numToShow={10} />
          </P>
          <P>
            Now let's look at the top 10 directions of the top similarity result:
            <br />
            <code>What do you call a reptile that is good at math? A Calcugator</code>
            {/* <EmbeddingVis
              embedding={catAndCalculator[0].vector}
              rows={8}
              domain={[-0.1, 0, 0.1]}
              height={48}
            ></EmbeddingVis> */}
            <FeatureBars topk={catAndCalculator[0]} features={saeFeatures} numToShow={10} />
          </P>
          <P>
            Notice how the top 6 directions in the top result are found near the top of the query.
            It's only the 8th feature that specifies "reptilian themes" that takes the result in a
            slightly different direciton.
          </P>

          <H3>Steering 🐮</H3>
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
        {/* 



------------------------------------------------------------------------------------------




*/}
        <section>
          <H3>Touch tokens</H3>
          <P>
            Let's see if we can tell which tokens are most activated by the different concepts...
            TODO
          </P>
          <div style={{ marginLeft: '116px' }}>
            <code>A cat and a calculator</code>
            <EmbeddingVis
              embedding={catAndCalculatorEmbedding.embedding}
              rows={8}
              domain={[-0.1, 0, 0.1]}
              height={48}
            ></EmbeddingVis>
          </div>
          <P>This is actually done by averaging the hidden states of each token in the query:</P>
          <AnimatedTokenEmbeddings
            embeddingData={catAndCalculatorEmbedding}
            domain={[-2.5, 0, 2.5]}
            rows={8}
            height={48}
          />
          {/* <AverageTokenEmbeddings
            embeddingData={catAndCalculatorEmbedding}
            domain={[-0.1, 0, 0.1]}
            rows={8}
            height={48}
          /> */}

          {tokenFeatures.map((tokf, i) => (
            <div key={i}>
              <code>{catAndCalculatorEmbedding.tokens[i]}</code>
              <FeatureBars topk={tokf} features={saeFeatures} numToShow={5} />
            </div>
          ))}
        </section>
        {/* 
        <footer className={styles.footnotes}>
          <div className={styles.footnoteTitle}>Footnotes</div>
          <Footnote
            number="1"
            text="This note underscores the importance of having a robust base in programming fundamentals."
          />
          <Footnote
            number="2"
            text="Abstraction not only simplifies complexity but also enables efficient problem decomposition."
          />
          <Tooltip id="footnote" />
        </footer>
        */}
      </article>
    </div>
  );
}

export default NavBySim;
