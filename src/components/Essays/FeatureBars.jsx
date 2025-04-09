import React, { useMemo } from 'react';
import { interpolateSinebow } from 'd3-scale-chromatic';
import styles from './FeatureBars.module.scss';
import { rgb } from 'd3-color';
function yiq(color) {
  const { r, g, b } = rgb(color);
  return (r * 299 + g * 587 + b * 114) / 1000 / 255; // returns values between 0 and 1
}
const ActivationBar = ({
  feature,
  activation,
  content,
  onHover = () => {},
  onSelect = () => {},
}) => {
  const featureColor = useMemo(() => interpolateSinebow(feature?.order), [feature]);
  return (
    <div
      className={styles.sampleActivationBar}
      onMouseEnter={() => onHover(feature)}
      onMouseLeave={() => onHover(null)}
      onClick={() => onSelect(feature)}
    >
      <div
        className={styles.sampleActivationBarForeground}
        style={{
          width: `${(activation / feature.max_activation) * 100}%`,
          backgroundColor: featureColor,
        }}
      ></div>
      <div
        className={styles.sampleActivationBarLabel}
        style={
          {
            // color: yiq(featureColor) >= 0.6 ? '#111' : 'white',
          }
        }
      >
        <div className={styles.labelContainer}>
          <span className={styles.featureIdPill}>{feature.feature}</span>
          <span className={styles.featureLabel}>{feature.label}</span>
        </div>
        <span className={styles.activationValue}>
          {activation.toFixed(3)}
          {/* ({((100 * activation) / feature.max_activation).toFixed(0)}%) */}
        </span>
      </div>
    </div>
  );
};

const FeatureBars = ({
  topk,
  features,
  numToShow = 10,
  onHover = () => {},
  onSelect = () => {},
}) => {
  // topk looks like:
  /*
  {top_acts: [...], top_indices: [...]}
  */
  // top_indices are ints that index into the features array
  if (!topk || !features) {
    return null;
  }

  return (
    <div className={styles.details}>
      <div className={styles.sampleTopFeatures}>
        {(topk.top_acts || topk.sae_acts)
          .map((act, i) => {
            let f = features[topk.top_indices?.[i] || topk.sae_indices?.[i]];
            return {
              i,
              feature: f,
              activation: act,
              percent: act / f.max_activation,
            };
          })
          //.sort((a,b) => b.percent - a.percent)
          .slice(0, numToShow)
          .map((f) => (
            <ActivationBar
              key={f.i}
              feature={f.feature}
              activation={f.activation}
              onHover={onHover}
              onSelect={onSelect}
            />
          ))}
      </div>
    </div>
  );
};

export default FeatureBars;
