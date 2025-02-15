import { useState, useEffect, useRef } from 'react';
import { apiService } from '../lib/apiService';

export default function useFeatureFilter({
  userId,
  datasetId,
  scope,
  urlParams,
  scopeLoaded,
  setFilteredIndices,
}) {
  const [feature, setFeature] = useState(-1);
  const [threshold, setThreshold] = useState(0.1);
  const [featureIndicesLoaded, setFeatureIndicesLoaded] = useState(false);
  const [active, setActive] = useState(false);
  const [loading, setLoading] = useState(false);

  // Handle URL initialization
  useEffect(() => {
    if (scopeLoaded && urlParams.has('feature')) {
      const featureParam = parseInt(urlParams.get('feature'));
      setFeature(featureParam);
    }
  }, [scopeLoaded, urlParams]);

  useEffect(() => {
    if (feature >= 0) {
      const maxActivation = scope?.sae?.max_activations[feature] || 0;
      let t = maxActivation < 0.2 ? maxActivation / 2 : 0.1;
      setThreshold(t);
      setActive(true);
    } else {
      setActive(false);
    }
  }, [feature, scope, setThreshold]);

  // Update feature indices and URL params when feature changes
  useEffect(() => {
    if (feature >= 0) {
      setFeatureIndicesLoaded(false);
      setLoading(true);
      apiService.searchSaeFeature(userId, datasetId, scope?.id, feature, threshold).then((data) => {
        setFilteredIndices(data);
        setFeatureIndicesLoaded(true);
        setLoading(false);
      });
    } else {
      setFilteredIndices([]);
      setLoading(false);
    }
  }, [userId, datasetId, scope, feature, threshold, setFilteredIndices, scopeLoaded]);

  return {
    feature,
    setFeature,
    threshold,
    setThreshold,
    featureIndicesLoaded,
    active,
    loading,
  };
}
