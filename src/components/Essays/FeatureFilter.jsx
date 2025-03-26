import { useState, useEffect } from 'react';
import { interpolateTurbo } from 'd3-scale-chromatic';
import FeatureAutocomplete from './FeatureAutocomplete';
import SearchResults from './SearchResults';
import { apiService } from '../../lib/apiService';

function FeatureFilter({ features, defaultFeature = null, threshold = 0.1, numToShow = 5 }) {
  const [selectedFeature, setSelectedFeature] = useState(defaultFeature);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!selectedFeature) return;

    setLoading(true);

    apiService
      .searchSaeFeature('enjalot', 'ls-dadabase', 'scopes-001', selectedFeature?.feature, threshold)
      .then((data) => {
        if (!data.length) {
          setResults([]);
          setLoading(false);
          return;
        }
        apiService
          .getRowsByIndices('enjalot', 'ls-dadabase', 'scopes-001', data.slice(0, numToShow))
          .then((rows) => {
            setResults(rows);
            setLoading(false);
          });
      })
      .catch((error) => {
        console.error('Error fetching feature results:', error);
        setLoading(false);
      });
  }, [selectedFeature, threshold]);

  const handleFeatureSelect = (feature) => {
    setSelectedFeature(feature);
  };

  const featureColor = selectedFeature && interpolateTurbo(selectedFeature.order);

  return (
    <div className="feature-filter-container">
      <FeatureAutocomplete
        currentFeature={selectedFeature}
        features={features || []}
        onSelect={handleFeatureSelect}
        featureColor={featureColor}
        placeholder="Search for a feature..."
      />

      <SearchResults
        results={results}
        loading={loading}
        dataset={{ text_column: 'joke' }}
        numToShow={10}
        showIndex={false}
        showFeatureActivation={true}
        feature={{
          ...selectedFeature,
          color: featureColor,
        }}
      />
    </div>
  );
}

export default FeatureFilter;
