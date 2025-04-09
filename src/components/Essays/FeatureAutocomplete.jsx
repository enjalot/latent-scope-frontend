import React, { useState, useMemo, useRef, useEffect } from 'react';
import { interpolateSinebow } from 'd3-scale-chromatic';
import { rgb } from 'd3-color';
import styles from './FeatureAutocomplete.module.scss';

const FeatureAutocomplete = ({ currentFeature, features, onSelect, placeholder }) => {
  const [search, setSearch] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const inputRef = useRef(null);
  const dropdownRef = useRef(null);

  // Calculate feature color internally instead of accepting as prop
  const featureColor = (order) => {
    if (!order) return 'rgba(0, 0, 0, 0.1)';
    const color = rgb(interpolateSinebow(order));
    color.opacity = 0.75;
    return color.toString();
  };

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

  useEffect(() => {
    if (showDropdown && inputRef.current && dropdownRef.current) {
      const rect = inputRef.current.getBoundingClientRect();
      dropdownRef.current.style.top = `${rect.bottom}px`;
      dropdownRef.current.style.left = `${rect.left}px`;
      dropdownRef.current.style.width = `${rect.width}px`;
    }
  }, [showDropdown, filteredFeatures]);

  return (
    <div className={styles.featureSelector}>
      <div className={styles.editablelabelContainer}>
        {currentFeature && (
          <span
            className={styles.featureIdPill}
            style={{ backgroundColor: featureColor(currentFeature.order), opacity: 0.75 }}
          >
            {currentFeature.feature}
          </span>
        )}
        <input
          ref={inputRef}
          type="text"
          value={search}
          onClick={(e) => {
            e.stopPropagation();
            setShowDropdown(true);
          }}
          onChange={(e) => setSearch(e.target.value)}
          onFocus={() => setShowDropdown(true)}
          onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
          placeholder={currentFeature ? currentFeature.label : placeholder || 'Search features...'}
          className={styles.featureSearch}
        />
      </div>
      {showDropdown && filteredFeatures.length > 0 && (
        <div ref={dropdownRef} className={styles.featureDropdown}>
          {filteredFeatures.map((feature) => (
            <div
              key={feature.feature}
              className={styles.featureOption}
              onClick={(e) => {
                e.stopPropagation();
                onSelect(feature);
                setSearch('');
                setShowDropdown(false);
              }}
            >
              <span
                className={styles.featureIdPill}
                style={{ backgroundColor: featureColor(feature.order) }}
              >
                {feature.feature}
              </span>
              <span className={styles.featureLabel}>{feature.label}</span>
              <span className={styles.featureCount}>{feature.count}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default FeatureAutocomplete;
