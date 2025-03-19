import React, { useState, useMemo, useEffect } from 'react';
import { interpolateTurbo } from 'd3-scale-chromatic';
import styles from './FeatureBars.module.scss';
import { rgb } from 'd3-color';

const FeatureAutocomplete = ({ currentFeature, features, onSelect, featureColor }) => {
  const [search, setSearch] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);

  const filteredFeatures = useMemo(() => {
    if (!search && !showDropdown) return [];
    if (!search) return features.slice(0, 10); // Show top 10 features when dropdown is opened without search
    return features
      .filter(
        (f) =>
          f.label.toLowerCase().includes(search.toLowerCase()) ||
          f.feature.toString().includes(search)
      )
      .slice(0, 10);
  }, [search, features, showDropdown]);

  // Prevent click events from bubbling up
  // const handleClick = (e) => {
  //   e.stopPropagation();
  // };

  return (
    <div className={styles.featureSelector}>
      <div className={styles.editablelabelContainer}>
        <span
          className={styles.featureIdPill}
          style={{ backgroundColor: featureColor, opacity: 0.75 }}
        >
          {currentFeature.feature}
        </span>
        <input
          type="text"
          value={search}
          onClick={(e) => {
            e.stopPropagation();
            setShowDropdown(true);
          }}
          onChange={(e) => setSearch(e.target.value)}
          onFocus={() => setShowDropdown(true)}
          onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
          placeholder={currentFeature.label}
          className={styles.featureSearch}
          style={{
            padding: '0px 4px',
            margin: 0,
            // border: 'none',
            // background: 'transparent',
            width: 'auto',
            minWidth: '100px',
            outline: 'none',
          }}
        />
      </div>
      {showDropdown && filteredFeatures.length > 0 && (
        <div
          className={styles.featureDropdown}
          style={{
            position: 'absolute',
            zIndex: 1000,
            background: 'white',
            border: '1px solid #ccc',
            borderRadius: '4px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            maxHeight: '200px',
            overflowY: 'auto',
            width: '100%',
          }}
        >
          {filteredFeatures.map((feature) => (
            <div
              key={feature.feature}
              className={styles.featureOption}
              style={{
                padding: '4px 8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
              onClick={(e) => {
                e.stopPropagation();
                onSelect(feature);
                setSearch('');
                setShowDropdown(false);
              }}
            >
              <span
                className={styles.featureIdPill}
                style={{ backgroundColor: interpolateTurbo(feature.order) }}
              >
                {feature.feature}
              </span>
              <span className={styles.featureLabel}>{feature.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const EditableActivationBar = ({
  feature,
  activation,
  onActivationChange,
  onFeatureChange,
  features,
}) => {
  const featureColor = useMemo(() => interpolateTurbo(feature?.order), [feature]);
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
            featureColor={featureColor}
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

    setEditedFeatures(newFeatures);
  }, [topk, features, numToShow]);

  useEffect(() => {
    if (editedFeatures.length > 0 && onFeaturesChange) {
      const top_acts = editedFeatures.map((f) => f.activation);
      const top_indices = editedFeatures.map((f) => f.featureIndex);
      onFeaturesChange({ top_acts, top_indices });
    }
  }, [editedFeatures, onFeaturesChange]);

  const handleActivationChange = (featureId, newActivation) => {
    setEditedFeatures((prev) =>
      prev.map((item) =>
        item.feature.feature === featureId ? { ...item, activation: newActivation } : item
      )
    );
  };

  const handleFeatureChange = (oldFeature, newFeature) => {
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
    <div className={styles.details}>
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
