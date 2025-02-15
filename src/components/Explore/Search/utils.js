// find all features that match the query
export const findFeaturesByQuery = (features, query, top = 5) => {
  if (!query) return [];

  const searchTerm = query.toLowerCase();
  return features
    .filter(
      (feature) =>
        feature.label.toLowerCase().includes(searchTerm) ||
        feature.feature.toString().includes(searchTerm)
    )
    .slice(0, top)
    .map((feature) => ({
      value: feature.feature,
      label: `(${feature.feature}) ${feature.label}`,
    }));
};

export const findClustersByQuery = (clusters, query, top = 5) => {
  if (!query) return [];

  const searchTerm = query.toLowerCase();
  return clusters
    .filter((cluster) => cluster.label.toLowerCase().includes(searchTerm))
    .slice(0, top)
    .map((cluster) => ({
      value: cluster.cluster,
      label: cluster.label,
    }));
};

export const filterConstants = {
  SEARCH: 'search',
  CLUSTER: 'cluster',
  FEATURE: 'feature',
  COLUMN: 'column',
};
