import React from 'react';
import styles from './LoadingSpinner.module.scss';

function LoadingSpinner({ message = 'Loading...', height, position = 'absolute' }) {
  return (
    <div className={styles.loadingOverlay} style={height ? { height, position } : { position }}>
      <div className={styles.loadingContainer}>
        <div className={styles.loadingSpinner}></div>
        <div>{message}</div>
      </div>
    </div>
  );
}

export default LoadingSpinner;
