import { Modal, Button } from 'react-element-forge';
import { useCallback } from 'react';

function FeatureModal({
  isOpen,
  onClose,
  rowIndex,
  hoveredIdx,
  features,
  topIndices,
  topActs,
  selectedFeature,
  handleFeatureClick,
}) {
  const TO_SHOW = 15;

  const baseUrl = 'https://enjalot.github.io/latent-taxonomy#model=NOMIC_FWEDU_25k&feature=';
  const maxAct = Math.max(...topActs);
  const getWidth = (act) => {
    return `${(act / maxAct) * 100}%`;
  };

  const itemStyle = (featIdx) => ({
    fontWeight: featIdx === selectedFeature ? 'bold' : 'normal',
  });

  const featureClick = useCallback(
    (featIdx, activation) => {
      handleFeatureClick(featIdx, activation, features[featIdx]?.label);
      onClose();
    },
    [handleFeatureClick, onClose, features]
  );

  return (
    <Modal
      className="feature-modal"
      isVisible={isOpen}
      onClose={onClose}
      title={`Features for Index ${rowIndex}`}
    >
      <div className="feature-modal-close">
        <span className="feature-modal-text">Top {TO_SHOW} Activated SAE Features</span>
        <Button onClick={onClose} icon="x" color="primary" variant="outline" size="small" />
      </div>
      <div className="feature-modal-content">
        {topIndices.slice(0, TO_SHOW).map((featIdx, i) => (
          <div className="feature-modal-item" key={i} style={itemStyle(featIdx)}>
            <div
              className="feature-modal-item-background"
              style={{
                width: getWidth(topActs[i]),
                borderBottom: hoveredIdx === i ? '2px solid #b87333' : 'none',
                backgroundColor: hoveredIdx === i ? '#b87333' : '#aaa',
              }}
            />
            <div className="feature-label">
              <Button
                className="feature-modal-item-filter-button"
                icon="filter"
                color="primary"
                variant="outline"
                size="small"
                onClick={() => featureClick(featIdx, topActs[i])}
              />
              <span
                title={`${baseUrl}${featIdx}`}
                onClick={() => window.open(`${baseUrl}${featIdx}`, '_blank', 'noopener,noreferrer')}
                className="feature-modal-item-filter-link"
              >
                {featIdx}:
              </span>
              <span className="feature-modal-item-filter-label">
                {features?.[featIdx]?.label} ({topActs?.[i]?.toFixed(3)})
              </span>
            </div>
          </div>
        ))}
      </div>
    </Modal>
  );
}

export default FeatureModal;
