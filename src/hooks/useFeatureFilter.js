import { useState, useEffect, useRef } from 'react';
import { apiService } from '../lib/apiService';

const MIN_THRESHOLD = 0.1;
const MAX_THRESHOLD = 0.2;

const DEFAULT_FEATURE = -1;

export default function useFeatureFilter({ userId, datasetId, scope, scopeLoaded }) {
  const [feature, setFeature] = useState(DEFAULT_FEATURE);
  const [threshold, setThreshold] = useState(MIN_THRESHOLD);

  useEffect(() => {
    if (feature >= 0) {
      const maxActivation = scope?.sae?.max_activations[feature] || 0;
      let t =
        maxActivation < MIN_THRESHOLD
          ? MIN_THRESHOLD
          : maxActivation > MAX_THRESHOLD
            ? MAX_THRESHOLD
            : maxActivation;
      setThreshold(t);
    }
  }, [feature, scope, setThreshold]);

  const filter = async () => {
    console.log('feature filter');
    if (feature >= 0) {
      const data = await apiService.searchSaeFeature(
        userId,
        datasetId,
        scope?.id,
        feature,
        threshold
      );
      console.log('feature filter data', data);
      return data;
    }
    return [];
  };

  const clear = () => {
    setFeature(DEFAULT_FEATURE);
    setThreshold(MIN_THRESHOLD);
  };

  return {
    feature,
    setFeature,
    threshold,
    filter,
    clear,
  };
}
