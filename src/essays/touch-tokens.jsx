import { useCallback, useState, useEffect, useMemo } from 'react';
import { Tooltip } from 'react-tooltip';
import { Footnote, FootnoteTooltip } from '../components/Essays/Footnotes';
import { P, H2, H3, Query, Array } from '../components/Essays/Basics';

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

function TouchTokens() {
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
        <h1 className={styles.title}>Touch Tokens</h1>
        <p className={styles.subtitle}>I tried to pay attention but attention paid me —Lil Wayne</p>

        <div className={styles.meta}>
          <span className={styles.author}>By Ian Johnson</span>
          <span className={styles.date}>Published on March 17, 2025</span>
        </div>

        <section>
          <P>
            In <a href="">Navigating by Similarity</a> we took a closer look at cosine similarity
            and broke down how embeddings are compared to each other. Let's go one level deeper and
            look at the hidden states of each token. Could we do a better job of labeling our Sparse
            Autoencoder directions if we used token level information in auto-generating our labels?
          </P>
        </section>

        <section>
          <H3>Mean pooling</H3>
          <P>
            The embedding for a query is actually done by averaging the hidden states of each token.
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

export default TouchTokens;
