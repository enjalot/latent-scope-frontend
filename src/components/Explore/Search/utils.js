// find all features that match the query
export const filterByQuery = (features, query, top = 5) => {
  if (!query) return [];

  const searchTerm = query.toLowerCase();
  debugger;
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
