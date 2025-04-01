import React from 'react';
import { interpolateTurbo } from 'd3-scale-chromatic';
import { rgb } from 'd3-color';
import styles from './FeaturePill.module.scss';

const FeaturePill = ({ feature }) => {
  // Calculate feature color based on order
  const getFeatureColor = (order) => {
    if (!order) return 'rgba(0, 0, 0, 0.1)';
    const color = rgb(interpolateTurbo(order));
    color.opacity = 0.75;
    return color.toString();
  };

  const backgroundColor = feature?.order ? getFeatureColor(feature.order) : 'rgba(0, 0, 0, 0.1)';
  console.log('feature', feature, backgroundColor);

  return (
    <span className={styles.featurePill} style={{ backgroundColor }}>
      {feature?.feature}
    </span>
  );
};

export default FeaturePill;
