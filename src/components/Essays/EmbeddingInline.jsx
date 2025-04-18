import { useState, useEffect, useCallback } from 'react';
// import { apiService } from '../../lib/apiService';
import { maybeCachedCalcTokenizedEmbeddings } from '../../lib/cachedApiService';
// import EmbeddingVis from './Embedding';
import EmbeddingVis from './EmbeddingBarChart';
import EmbeddingDifferenceChart from './EmbeddingDifferenceChart';
import Examples from './Examples';
import styles from './EmbeddingInline.module.scss';

function EmbeddingVisualizer({
  defaultQuery = 'winter holidays',
  examples = ['cows', 'feline stuff', 'Will Smith', 'winter holidays'],
  compareEmbedding = null,
  height = 48,
}) {
  const [query, setQuery] = useState(defaultQuery);
  const [embedding, setEmbedding] = useState(null);
  const [loading, setLoading] = useState(false);
  const [initialVisualizationDone, setInitialVisualizationDone] = useState(false);

  // Function to fetch embedding
  const fetchEmbedding = async (searchQuery) => {
    setLoading(true);
    try {
      const response = await maybeCachedCalcTokenizedEmbeddings(searchQuery);
      setEmbedding(response.embedding);
    } catch (error) {
      console.error('Error fetching embedding:', error);
    } finally {
      setLoading(false);
    }
  };

  // Debounced fetch embedding - this will limit API calls while typing
  useEffect(() => {
    const handler = setTimeout(() => {
      if (query.trim()) {
        fetchEmbedding(query);
      }
    }, 500); // 500ms debounce time

    return () => {
      clearTimeout(handler);
    };
  }, [query]);

  // Initial visualization on component mount
  useEffect(() => {
    if (!initialVisualizationDone && defaultQuery) {
      setInitialVisualizationDone(true);
      // The other useEffect will handle the initial fetch
    }
  }, [defaultQuery, initialVisualizationDone]);

  // Handle example clicks
  const handleExampleClick = useCallback((example) => {
    setQuery(example);
    setLoading(true);
  }, []);

  return (
    <div className={styles.embeddingVisualizer}>
      <Examples examples={examples} onSelectExample={handleExampleClick} />

      <div className={styles.searchContainer}>
        <div className={styles.searchBar}>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Enter text to visualize its embedding"
            className={styles.searchInput}
          />
        </div>
      </div>

      {embedding ? (
        <div style={{ opacity: loading ? 0.5 : 1 }}>
          <EmbeddingVis embedding={embedding} rows={8} domain={[-0.1, 0, 0.1]} height={height} />
          {compareEmbedding && (
            <EmbeddingDifferenceChart
              embedding1={embedding}
              embedding2={compareEmbedding}
              domain={[-0.1, 0, 0.1]}
              height={height}
            />
          )}
        </div>
      ) : !loading ? (
        <div>Enter a query to see its embedding</div>
      ) : null}
      {loading && <div className={styles.loadingIndicator}>Loading embedding...</div>}
    </div>
  );
}

export default EmbeddingVisualizer;
