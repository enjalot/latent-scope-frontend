import { useState, useEffect, useRef } from 'react';
import { apiService } from '../lib/apiService';

export default function useFeatureFilter({
  userId,
  datasetId,
  scope,
  urlParams,
  setUrlParams,
  scopeLoaded,
}) {
  const NEVER_SET = -2; // this is the value that is set when the feature is never set
  const EMPTY = -1; // this is the value that is set when the feature is empty (i.e. it has been set to -1 by the user)

  const [feature, setFeature] = useState(NEVER_SET);
  const [threshold, setThreshold] = useState(0.1);
  const [featureIndices, setFeatureIndices] = useState([]);
  const [featureIndicesLoaded, setFeatureIndicesLoaded] = useState(false);

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
    }
  }, [feature, scope, setThreshold]);

  // Handle URL updates
  useEffect(() => {
    if (feature >= 0) {
      setUrlParams((prev) => {
        prev.set('feature', feature);
        return prev;
      });
    } else {
      // if the feature is -1, we need to remove it from the url params
      // but only if it EMPTY (i.e. it has been set to -1 by the user from the UI). this is to prevent the case
      // where the URL param is incorrectly deleted when a feature is present in the URL params but the setFeature update above hasn't been processed yet
      // where
      if (feature === EMPTY) {
        setUrlParams((prev) => {
          prev.delete('feature');
          return prev;
        });
      }
    }
  }, [feature, setUrlParams]);

  // Update feature indices and URL params when feature changes
  useEffect(() => {
    if (feature >= 0) {
      setFeatureIndicesLoaded(false);
      apiService.searchSaeFeature(userId, datasetId, scope?.id, feature, threshold).then((data) => {
        setFeatureIndices(data);
        setFeatureIndicesLoaded(true);
      });
    } else {
      if (feature === EMPTY) {
        setFeatureIndices([]);
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
    featureIndicesLoaded,
  };
}
