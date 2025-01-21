import { useState, useEffect } from 'react';
import { apiService } from '../lib/apiService';

export default function useFeatureFilter({
  userId,
  datasetId,
  scope,
  urlParams,
  setUrlParams,
  scopeLoaded,
}) {
  const [feature, setFeature] = useState(-1);
  const [threshold, setThreshold] = useState(0.1);
  const [featureIndices, setFeatureIndices] = useState([]);

  // Initialize feature from URL params
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
    }
  }, [feature, scope, setThreshold]);

  // Update feature indices and URL params when feature changes
  useEffect(() => {
    if (feature >= 0) {
      apiService.searchSaeFeature(userId, datasetId, scope?.id, feature, threshold).then((data) => {
        setFeatureIndices(data);
      });

      // Update URL params
      setUrlParams((prev) => {
        prev.set('feature', feature);
        return prev;
      });
    } else {
      setFeatureIndices([]);

      // Remove feature from URL params if scope is loaded
      if (scopeLoaded) {
        setUrlParams((prev) => {
          prev.delete('feature');
          return prev;
        });
      }
    }
  }, [userId, datasetId, scope, feature, threshold, setFeatureIndices, scopeLoaded, setUrlParams]);

  return {
    feature,
    setFeature,
    threshold,
    setThreshold,
    featureIndices,
    setFeatureIndices,
  };
}
