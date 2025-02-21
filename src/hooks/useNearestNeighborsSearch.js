import { useState, useCallback, useEffect } from 'react';
import { apiService } from '../lib/apiService';

const LIMIT = 20;

export default function useNearestNeighborsSearch({ userId, datasetId, scope, deletedIndices }) {
  const [distances, setDistances] = useState([]);

  const filter = async (query) => {
    const data = await apiService.searchNearestNeighbors(userId, datasetId, scope, query);
    const inds = data.indices.filter((d) => {
      return !deletedIndices.includes(d);
    });
    setDistances(data.distances);
    return inds.slice(0, LIMIT);
  };

  const clear = () => {
    setDistances([]);
  };

  return {
    distances,
    filter,
    clear,
  };
}
