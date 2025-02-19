import { useState, useCallback, useEffect } from 'react';
import { apiService } from '../lib/apiService';

const LIMIT = 20;

export default function useNearestNeighborsSearch({ userId, datasetId, scope, deletedIndices }) {
  const [searchText, setSearchText] = useState('');
  const [distances, setDistances] = useState([]);

  const filter = async () => {
    const data = await apiService.searchNearestNeighbors(userId, datasetId, scope, searchText);
    const inds = data.indices.filter((d) => {
      return !deletedIndices.includes(d);
    });
    setDistances(data.distances);
    console.log('==== nnsearch ==== ', { searchText, inds });
    return inds.slice(0, LIMIT);
  };

  const clear = () => {
    setSearchText('');
    setDistances([]);
  };

  return {
    searchText,
    setSearchText,
    distances,
    filter,
    clear,
  };
}
