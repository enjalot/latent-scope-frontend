import React, { useState, useEffect, useCallback } from 'react';
import { useSearch } from '../../contexts/SearchContext';
import Search from './Search';
import SearchResults from './SearchResults';
import FeatureBars from './FeatureBars';
import EditableFeatureBars from './EditableFeatureBars';
import styles from './SteeringPlayground.module.scss';
import { apiService } from '../../lib/apiService';
import { cosineSimilarity } from '../../utils';

function SteeringPlayground({ saeFeatures, defaultQuery, onSteer }) {
  const { query, results, loading, handleSearch, setQuery, dataset, scope } = useSearch();
  const [queryEmbedding, setQueryEmbedding] = useState(null);
  const [queryFeatures, setQueryFeatures] = useState(null);
  const [editedFeatures, setEditedFeatures] = useState(null);
  const [steeringEmbedding, setSteeringEmbedding] = useState(null);
  const [steeringResults, setSteeringResults] = useState(null);
  const [steeringLoading, setSteeringLoading] = useState(false);
  const [userHasEditedFeatures, setUserHasEditedFeatures] = useState(false);
  const [localQuery, setLocalQuery] = useState('');

  // Use effect to initialize localQuery when component mounts
  useEffect(() => {
    if (defaultQuery && scope) {
      setQuery(defaultQuery);
      setLocalQuery(defaultQuery);
      handleSearch(defaultQuery);
    }
  }, [defaultQuery, scope]);

  // Calculate embedding and features when query changes (after search is performed)
  useEffect(() => {
    if (!query) return;

    // Calculate embedding
    const getEmbedding = async () => {
      const emb = await apiService.calcTokenizedEmbeddings(query);
      setQueryEmbedding(emb);

      // Calculate features from embedding
      const features = await apiService.calcFeatures(emb.embedding);
      setQueryFeatures(features);
      setEditedFeatures(features);
      setUserHasEditedFeatures(false);
    };

    getEmbedding();
  }, [query]);

  // Perform search with edited features
  useEffect(() => {
    if (!editedFeatures || !scope || !userHasEditedFeatures) return;

    const performSteeringSearch = async () => {
      setSteeringLoading(true);
      try {
        // Calculate steering to get reconstructed embedding
        // console.log('editedFeatures', editedFeatures);
        const se = await apiService.calcSteering(editedFeatures);
        // console.log('steeringEmbedding', se);
        setSteeringEmbedding(se);
        // onSteer(steeringEmbedding);
        // Search with this embedding
        // TODO: this should be set by useSearch probably. its due to using the modal backend directly not via scope
        const res = await apiService.getNNEmbed('enjalot/ls-dadabase', 'scopes-001', se);

        setSteeringResults(res);
      } catch (error) {
        console.error('Error in steering search:', error);
      } finally {
        setSteeringLoading(false);
      }
    };

    performSteeringSearch();
  }, [editedFeatures, scope, userHasEditedFeatures]);

  const handleFeaturesChange = useCallback((newFeatures) => {
    setEditedFeatures(newFeatures);
    setUserHasEditedFeatures(true);
  }, []);

  const handleLocalSearch = (searchQuery) => {
    setLocalQuery(searchQuery);
    setQuery(searchQuery);
    handleSearch(searchQuery);
  };

  return (
    <div className={styles.steeringPlayground}>
      <div className={styles.headerSection}>
        <div className={styles.column}>
          <h3>Original Search</h3>
          <Search onSearch={handleLocalSearch} value={localQuery} onChange={setLocalQuery} />
        </div>

        <div className={styles.column}>
          <h3>Steering</h3>
          <p>
            Adjust feature activations to steer the search in different directions. Cosine
            similarity:{' '}
            <b>
              {steeringEmbedding && queryEmbedding
                ? cosineSimilarity(queryEmbedding.embedding, steeringEmbedding)?.toFixed(3)
                : 'N/A'}
            </b>
          </p>
        </div>
      </div>

      <div className={styles.fullWidthSection}>
        <div className={styles.fullWidthInner}>
          <div className={styles.featureAndResultsGrid}>
            <div className={styles.featureColumn}>
              {queryFeatures && saeFeatures && (
                <>
                  <h4>Query Features</h4>
                  <FeatureBars topk={queryFeatures} features={saeFeatures} numToShow={10} />
                </>
              )}
              <h4>Results</h4>
              <div className={styles.resultsContainer}>
                {results && results.length > 0 ? (
                  <SearchResults
                    results={results}
                    loading={loading}
                    dataset={dataset}
                    numToShow={5}
                    showIndex={false}
                  />
                ) : (
                  !loading && <p>No results found. Try a different search query.</p>
                )}
              </div>
            </div>

            <div className={styles.featureColumn}>
              {queryFeatures && saeFeatures && (
                <>
                  <h4>Steered Features</h4>
                  <EditableFeatureBars
                    topk={queryFeatures}
                    features={saeFeatures}
                    numToShow={10}
                    onFeaturesChange={handleFeaturesChange}
                  />
                </>
              )}
              <h4>Steered Results</h4>
              <div className={styles.resultsContainer}>
                {steeringResults && (
                  <SearchResults
                    results={steeringResults}
                    loading={steeringLoading}
                    dataset={dataset}
                    numToShow={5}
                    showIndex={false}
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SteeringPlayground;
