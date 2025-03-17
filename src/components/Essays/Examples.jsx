import React from 'react';
import styles from './Search.module.scss';

function Examples({ examples = [], onSelectExample }) {
  return (
    <div className={styles.examplesContainer}>
      <span className={styles.examplesLabel}>Try: </span>
      {examples.map((example, index) => (
        <React.Fragment key={example}>
          <em className={styles.example} onClick={() => onSelectExample(example)}>
            {example}
          </em>
          {index < examples.length - 1 && <span>, </span>}
        </React.Fragment>
      ))}
    </div>
  );
}

export default Examples;
