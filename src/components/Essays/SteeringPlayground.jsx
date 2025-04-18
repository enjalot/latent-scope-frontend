import React, { useState, useEffect, useCallback } from 'react';
import { useSearch } from '../../contexts/SearchContext';
import Search from './Search';
import SearchResults from './SearchResults';
import FeatureBars from './FeatureBars';
import EditableFeatureBars from './EditableFeatureBars';
import styles from './SteeringPlayground.module.scss';
import { apiService } from '../../lib/apiService';
import {
  maybeCachedCalcTokenizedEmbeddings,
  maybeCachedCalcFeatures,
  maybeCachedGetNNEmbed,
  maybeCachedCalcSteering,
} from '../../lib/cachedApiService';
import { cosineSimilarity } from '../../utils';
import { Button } from 'react-element-forge';
import LoadingSpinner from '../LoadingSpinner';

function SteeringPlayground({ saeFeatures, defaultQuery, onSteer }) {
  const { query, results, loading, handleSearch, setQuery, dataset, scope } = useSearch();
  const [queryEmbedding, setQueryEmbedding] = useState(null);
  const [queryFeatures, setQueryFeatures] = useState(null);
  const [editedFeatures, setEditedFeatures] = useState(null);
  const [steeringEmbedding, setSteeringEmbedding] = useState(null);
  const [steeringResults, setSteeringResults] = useState(null);
  const [steeringLoading, setSteeringLoading] = useState(true);
  const [userHasEditedFeatures, setUserHasEditedFeatures] = useState(false);
  const [localQuery, setLocalQuery] = useState('');
  const [queryFeaturesLoading, setQueryFeaturesLoading] = useState(false);

  // Use effect to initialize localQuery when component mounts
  useEffect(() => {
    if (defaultQuery && scope) {
      setQuery(defaultQuery);
      setLocalQuery(defaultQuery);
      // handleSearch(defaultQuery);
    }
  }, [defaultQuery, scope]);

  // Calculate embedding
  const getEmbedding = useCallback(async (query) => {
    setQueryFeaturesLoading(true); // Start loading
    try {
      const emb = await maybeCachedCalcTokenizedEmbeddings(query);
      setQueryEmbedding(emb);

      // Calculate features from embedding
      const features = await maybeCachedCalcFeatures(emb.embedding);
      // setUserHasEditedFeatures(true);
      setQueryFeatures({ ...features });
      setEditedFeatures({ ...features });
    } finally {
      setQueryFeaturesLoading(false); // End loading
    }
  }, []);

  // Calculate embedding and features when query changes (after search is performed)
  useEffect(() => {
    if (!query) return;
    getEmbedding(query);
  }, [query]);

  // Perform search with edited features
  useEffect(() => {
    if (!scope) return;

    const performSteeringSearch = async () => {
      setSteeringLoading(true);
      try {
        // Calculate steering to get reconstructed embedding
        const se = await maybeCachedCalcSteering(editedFeatures);
        // console.log('steeringEmbedding', se);
        setSteeringEmbedding(se);
        // onSteer(steeringEmbedding);
        // Search with this embedding
        const res = await maybeCachedGetNNEmbed('enjalot/ls-dadabase', 'scopes-001', se);

        setSteeringResults(res);
      } catch (error) {
        console.error('Error in steering search:', error);
      } finally {
        setSteeringLoading(false);
      }
    };

    performSteeringSearch();
  }, [editedFeatures, scope]);

  const handleFeaturesChange = useCallback((newFeatures) => {
    // console.log('FEATURES CHANGED??', newFeatures);
    setEditedFeatures(newFeatures);
    setUserHasEditedFeatures(true);
  }, []);

  const handleLocalSearch = (searchQuery) => {
    setLocalQuery(searchQuery);
    setQuery(searchQuery);
    // handleSearch(searchQuery);
  };

  return (
    <div className={styles.steeringPlayground}>
      <div className={styles.featureAndResultsGrid}>
        <div className={styles.featureColumn}>
          <Search onSearch={handleLocalSearch} value={localQuery} onChange={setLocalQuery} />
          <div className={styles.featureRow}>
            <span>
              Cosine similarity with original query embedding:{' '}
              <b>
                {steeringLoading ||
                queryFeaturesLoading ||
                !(steeringEmbedding && queryEmbedding) ? (
                  <div className={styles.loadingSpinnerInline}></div>
                ) : (
                  cosineSimilarity(queryEmbedding.embedding, steeringEmbedding)?.toFixed(3)
                )}
              </b>
            </span>
            <span>
              {userHasEditedFeatures && (
                <Button
                  icon="refresh-ccw"
                  text="Reset"
                  color="secondary"
                  onClick={() => {
                    getEmbedding(localQuery);
                    setUserHasEditedFeatures(false);
                  }}
                />
              )}
            </span>
          </div>

          {saeFeatures ? (
            queryFeaturesLoading ? (
              <LoadingSpinner message="Loading features..." height={250} position="relative" />
            ) : (
              <EditableFeatureBars
                topk={queryFeatures}
                features={saeFeatures}
                numToShow={10}
                onFeaturesChange={handleFeaturesChange}
              />
            )
          ) : (
            <LoadingSpinner message="Loading features..." height={250} position="relative" />
          )}
          <div className={styles.resultsContainer}>
            <SearchResults
              results={steeringResults}
              loading={steeringLoading}
              dataset={dataset}
              numToShow={5}
              showIndex={false}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default SteeringPlayground;
