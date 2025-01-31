import React from 'react';
import Select from 'react-select';
import { selectStyles } from './SelectStyles';
import { useFilter } from '../../contexts/FilterContext';

export default function ClusterFilter({ clusterLabels }) {
  const { setActiveFilterTab, clusterFilter, setUrlParams, filterConstants } = useFilter();
  const { cluster, setCluster, clusterIndices } = clusterFilter;

  const selectOptions = clusterLabels?.map((cl) => ({
    value: cl.cluster,
    label: `${cl.cluster}: ${cl.label} (${cl.count})`,
  }));

  const handleClusterChange = (selectedOption) => {
    if (!selectedOption) {
      setCluster(null);
      setUrlParams((prev) => {
        prev.delete('cluster');
        return prev;
      });
      return;
    }
    const cl = clusterLabels.find((cluster) => cluster.cluster === selectedOption.value);
    if (cl) {
      debugger;
      setActiveFilterTab(filterConstants.CLUSTER);
      setCluster(cl);
      setUrlParams((prev) => {
        prev.set('cluster', cl.cluster);
        return prev;
      });
    }
  };

  return (
    <div className={`clusters-select filter-row ${clusterIndices?.length ? 'active' : ''}`}>
      <div className="filter-cell left">
        <Select
          value={
            cluster
              ? {
                  value: cluster.cluster,
                  label: `${cluster.cluster}: ${cluster.label}`,
                }
              : null
          }
          onChange={handleClusterChange}
          options={selectOptions}
          isClearable
          placeholder="Filter by cluster"
          className="cluster-react-select"
          styles={selectStyles}
        />
      </div>
      <div className="filter-cell middle">
        {clusterIndices?.length ? <span>{clusterIndices.length} rows</span> : <span>0 rows</span>}
      </div>
    </div>
  );
}
