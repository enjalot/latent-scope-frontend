import React from 'react';

import PropTypes from 'prop-types';
import Select, { components } from 'react-select';
import { useFilter } from '../../../contexts/FilterContext';
import { useScope } from '../../../contexts/ScopeContext';

const FeatureGroup = () => {
  const { features } = useScope();
  const { featureFilter } = useFilter();

  const items = useMemo(() => {
    return features.map((feature) => ({
      value: feature.feature,
      label: feature.label,
    }));
  }, [features]);
};

export default FeatureGroup;
