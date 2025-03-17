import { useCallback, useState, useEffect } from 'react';
import { Tooltip } from 'react-tooltip';
import { Footnote, FootnoteTooltip } from '../components/Essays/Footnotes';
import { P, H2, H3 } from '../components/Essays/Basics';

import { ScopeProvider } from '../contexts/ScopeContext';
import { SearchProvider, useSearch } from '../contexts/SearchContext';
import Search from '../components/Essays/Search';
import SearchResults from '../components/Essays/SearchResults';
import Examples from '../components/Essays/Examples';

import styles from './essays.module.scss';
// import styles from './nav-by-sim.module.scss';

import hilbert from './cached/hilbert.json';

function DadJokesSearch() {
  const { query, results, loading, handleSearch, setQuery, dataset, scope } = useSearch();
  const [initialSearchDone, setInitialSearchDone] = useState(false);

  // Run initial search only once
  useEffect(() => {
    if (!initialSearchDone && scope) {
      const defaultQuery = 'cows';
      setQuery(defaultQuery);
      handleSearch(defaultQuery);
      setInitialSearchDone(true);
    }
  }, [handleSearch, setQuery, initialSearchDone, scope]);

  const handleExampleClick = useCallback(
    (example) => {
      setQuery(example);
      handleSearch(example);
    },
    [handleSearch, setQuery]
  );

  return (
    <>
      <Examples
        examples={['cows', 'feline stuff', 'Will Smith', 'winter holidays']}
        onSelectExample={handleExampleClick}
      />
      <Search defaultQuery={query} onSearch={handleSearch} value={query} onChange={setQuery} />
      <SearchResults
        results={results}
        loading={loading}
        dataset={dataset}
        numToShow={10}
        showIndex={false}
      />
    </>
  );
}

function NavBySim() {
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
              <DadJokesSearch />
            </SearchProvider>
          </ScopeProvider>

          <br />
          <P>
            As you can see, even with more conceptual queries like "feline stuff" or "winter
            holidays" we get the kind of results we would hope for. But what happens when we query
            for something that's not well represented in the dataset? Let's search for one of my
            favorite mathematicians: Hilbert
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
          </P>
        </section>

        {/* Footnotes Section */}
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
      </article>
    </div>
  );
}

export default NavBySim;
