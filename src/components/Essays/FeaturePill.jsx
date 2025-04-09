import React from 'react';
import { interpolateSinebow } from 'd3-scale-chromatic';
import { rgb } from 'd3-color';
import styles from './FeaturePill.module.scss';

const FeaturePill = ({ feature }) => {
  // Calculate feature color based on order
  const getFeatureColor = (order) => {
    if (!order) return 'rgba(0, 0, 0, 0.1)';
    const color = rgb(interpolateSinebow(order));
    color.opacity = 0.5;
    return color.toString();
  };

  const backgroundColor = feature?.order ? getFeatureColor(feature.order) : 'rgba(0, 0, 0, 0.1)';

  return (
    <span className={styles.featurePill} style={{ backgroundColor }}>
      {feature?.feature}
    </span>
  );
};

export default FeaturePill;
