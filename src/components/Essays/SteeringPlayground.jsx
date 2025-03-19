import React, { useState, useEffect, useCallback } from 'react';
import { useSearch } from '../../contexts/SearchContext';
import Search from './Search';
import SearchResults from './SearchResults';
import FeatureBars from './FeatureBars';
import EditableFeatureBars from './EditableFeatureBars';
import styles from './SteeringPlayground.module.scss';
import { apiService } from '../../lib/apiService';

function SteeringPlayground({ saeFeatures }) {
  const { query, results, loading, handleSearch, setQuery, dataset, scope } = useSearch();
  const [queryEmbedding, setQueryEmbedding] = useState(null);
  const [queryFeatures, setQueryFeatures] = useState(null);
  const [editedFeatures, setEditedFeatures] = useState(null);
  const [steeringResults, setSteeringResults] = useState(null);
  const [steeringLoading, setSteeringLoading] = useState(false);
  const [userHasEditedFeatures, setUserHasEditedFeatures] = useState(false);
  const [localQuery, setLocalQuery] = useState('');

  // Use effect to initialize localQuery when component mounts
  useEffect(() => {
    if (query) {
      setLocalQuery(query);
    }
  }, []);

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
        console.log('editedFeatures', editedFeatures);
        const steeringEmbedding = await apiService.calcSteering(editedFeatures);
        console.log('steeringEmbedding', steeringEmbedding);

        // Search with this embedding
        // TODO: this should be set by useSearch probably. its due to using the modal backend directly not via scope
        const res = await apiService.getNNEmbed(
          'enjalot/ls-dadabase',
          'scopes-001',
          steeringEmbedding
        );

        setSteeringResults(res);
      } catch (error) {
        console.error('Error in steering search:', error);
      } finally {
        setSteeringLoading(false);
      }
    };

    performSteeringSearch();
  }, [editedFeatures, scope, userHasEditedFeatures]);

  // Initial search
  // useEffect(() => {
  //   if (scope && defaultQuery) {
  //     setQuery(defaultQuery);
  //     handleSearch(defaultQuery);
  //   }
  // }, [scope, defaultQuery, setQuery, handleSearch]);

  const handleFeaturesChange = useCallback((newFeatures) => {
    setEditedFeatures(newFeatures);
    setUserHasEditedFeatures(true);
  }, []);

  const handleLocalSearch = (searchQuery) => {
    setQuery(searchQuery);
    handleSearch(searchQuery);
  };

  return (
    <div className={styles.steeringPlayground}>
      <div className={styles.column}>
        <h3>Original Search</h3>
        <Search
          defaultQuery={query}
          onSearch={handleLocalSearch}
          value={localQuery}
          onChange={setLocalQuery}
        />
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

      <div className={styles.column}>
        <h3>Steering</h3>
        <p style={{ marginBottom: '53px' }}>
          Adjust feature activations to steer the search in different directions
        </p>
        {queryFeatures && saeFeatures && (
          <EditableFeatureBars
            topk={queryFeatures}
            features={saeFeatures}
            numToShow={10}
            onFeaturesChange={handleFeaturesChange}
          />
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
  );
}

export default SteeringPlayground;
