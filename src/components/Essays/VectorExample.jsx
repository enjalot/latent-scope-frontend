import React, { useState, useEffect } from 'react';
import VectorVis from './VectorVis';
import styles from './VectorExample.module.scss';

function VectorExample({ onSelect, selectedVector }) {
  const [vectors] = useState([
    { vector: [0.5, 0.3], label: 'R1' },
    { vector: [-0.5, 0.5], label: 'R2' },
    { vector: [0.8, -0.4], label: 'R3' },
  ]);

  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    // Emit the selected vector object (not just the index)
    onSelect(vectors[selectedIndex]);
  }, [selectedIndex, vectors, onSelect]);

  return (
    <div className={styles.vectorExample}>
      <div className={styles.vectorGrid}>
        {vectors.map((vectorItem, index) => (
          <div
            key={index}
            className={`${styles.vectorItem} ${selectedIndex === index ? styles.selectedItem : ''}`}
            onClick={() => setSelectedIndex(index)}
          >
            <div className={styles.vectorLabel}>{vectorItem.label}</div>
            <div className={styles.vectorDisplay}>
              <VectorVis vectors={[vectorItem]} height={150} showResult={false} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default VectorExample;
