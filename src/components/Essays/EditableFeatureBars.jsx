import React, { useState, useMemo, useEffect, useRef } from 'react';
import styles from './FeatureBars.module.scss';
import { rgb } from 'd3-color';
import FeatureAutocomplete from './FeatureAutocomplete';
const EditableActivationBar = ({
  feature,
  activation,
  onActivationChange,
  onFeatureChange,
  features,
}) => {
  const [tempActivation, setTempActivation] = useState(activation / feature.max_activation);

  useEffect(() => {
    // Update temp value when activation changes from parent
    setTempActivation(activation / feature.max_activation);
  }, [activation, feature.max_activation]);

  return (
    <div className={styles.editableActivationBar}>
      <div className={styles.editableActivationBarLabel}>
        <div className={styles.editableFeatureContainer}>
          <FeatureAutocomplete
            currentFeature={feature}
            features={features}
            onSelect={onFeatureChange}
          />
        </div>
        <div className={styles.editableActivationControls}>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={tempActivation}
            onChange={(e) => {
              e.stopPropagation();
              setTempActivation(parseFloat(e.target.value));
            }}
            onMouseUp={(e) => {
              e.stopPropagation();
              onActivationChange(feature.feature, tempActivation * feature.max_activation);
            }}
            onTouchEnd={(e) => {
              e.stopPropagation();
              onActivationChange(feature.feature, tempActivation * feature.max_activation);
            }}
            onClick={(e) => e.stopPropagation()}
            className={styles.activationSlider}
          />
          <span className={styles.activationValue}>
            {(tempActivation * feature.max_activation).toFixed(3)}
          </span>
        </div>
      </div>
    </div>
  );
};

const EditableFeatureBars = ({ topk, features, numToShow = 10, onFeaturesChange }) => {
  const initialLoadRef = useRef(false);
  const [editedFeatures, setEditedFeatures] = useState([]);

  // Initialize from topk when it changes
  useEffect(() => {
    if (!topk || !features) return;

    const newFeatures = (topk.top_acts || topk.sae_acts).map((act, i) => {
      const featureIndex = topk.top_indices?.[i] || topk.sae_indices?.[i];
      const feature = features[featureIndex];
      return {
        feature: feature,
        activation: act,
        featureIndex: featureIndex,
      };
    });
    // .slice(0, numToShow);
    initialLoadRef.current = true;
    setEditedFeatures(newFeatures);
  }, [topk, features, numToShow]);

  useEffect(() => {
    if (editedFeatures.length > 0 && onFeaturesChange) {
      const top_acts = editedFeatures.map((f) => f.activation);
      const top_indices = editedFeatures.map((f) => f.featureIndex);
      if (!initialLoadRef.current) {
        onFeaturesChange({ top_acts, top_indices });
      }
    }
  }, [editedFeatures, onFeaturesChange]);

  const handleActivationChange = (featureId, newActivation) => {
    initialLoadRef.current = false;
    setEditedFeatures((prev) =>
      prev.map((item) =>
        item.feature.feature === featureId ? { ...item, activation: newActivation } : item
      )
    );
  };

  const handleFeatureChange = (oldFeature, newFeature) => {
    initialLoadRef.current = false;
    setEditedFeatures((prev) =>
      prev.map((item) => {
        if (item.feature.feature === oldFeature.feature) {
          const featureIndex = features.findIndex((f) => f.feature === newFeature.feature);
          return {
            feature: newFeature,
            activation: item.activation,
            featureIndex: featureIndex,
          };
        }
        return item;
      })
    );
  };

  if (!features) {
    return null;
  }

  return (
    <div className={styles.editableDetails}>
      <div
        className={styles.sampleTopFeatures}
        style={{
          height: `${numToShow * 23}px`,
          overflowY: 'auto',
          overflowX: 'hidden',
        }}
      >
        {editedFeatures.map((f, i) => (
          <EditableActivationBar
            key={i}
            feature={f.feature}
            activation={f.activation}
            onActivationChange={handleActivationChange}
            onFeatureChange={(newFeature) => handleFeatureChange(f.feature, newFeature)}
            features={features}
          />
        ))}
      </div>
    </div>
  );
};

export default EditableFeatureBars;
