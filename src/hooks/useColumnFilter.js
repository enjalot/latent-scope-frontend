import { useState, useEffect, useCallback, useMemo } from 'react';
import { apiService } from '../lib/apiService';

const useColumnFilter = (userId, datasetId, scope) => {
  const [columnFiltersActive, setColumnFiltersActive] = useState({});
  const [columnIndices, setColumnIndices] = useState([]);

  const dataset = useMemo(() => {
    return scope?.dataset;
  }, [scope]);

  const columnFilters = useMemo(() => {
    if (!dataset?.column_metadata) return [];
    return Object.keys(dataset.column_metadata)
      .map((column) => ({
        column: column,
        categories: dataset.column_metadata[column].categories,
        counts: dataset.column_metadata[column].counts,
      }))
      .filter((d) => d.counts);
  }, [dataset]);

  const columnQuery = useCallback(
    (filters) => {
      let query = [];
      Object.keys(filters).forEach((c) => {
        let f = filters[c];
        if (f) {
          query.push({
            column: c,
            type: 'eq',
            value: f,
          });
        }
      });
      console.log('query', query);
      apiService.columnFilter(userId, datasetId, scope?.id, query).then((indices) => {
        console.log('==== indices ==== ', indices);
        setColumnIndices(indices.map((d) => d.index));
      });
    },
    [userId, datasetId, scope]
  );

  useEffect(() => {
    let active = Object.values(columnFiltersActive).filter((d) => !!d).length;
    // console.log("active filters", active, columnFiltersActive)
    if (active > 0) {
      columnQuery(columnFiltersActive);
    } else if (setColumnIndices) {
      setColumnIndices([]);
    }
  }, [columnFiltersActive, columnQuery, setColumnIndices]);

  return {
    columnFiltersActive,
    setColumnFiltersActive,
    columnFilters,
    columnIndices,
    setColumnIndices,
  };
};

export default useColumnFilter;
