import React from 'react';
import { rgb } from 'd3-color';
import { interpolateSinebow } from 'd3-scale-chromatic';
import styles from './TokensAnnotated.module.scss';

function TokensAnnotated({ embedding, selectedFeature }) {
  const getTokenStyle = (tokenIndex) => {
    const featureIndex = embedding.features.top_indices[tokenIndex].indexOf(
      selectedFeature.feature
    );
    const activation =
      featureIndex !== -1 ? embedding.features.top_acts[tokenIndex][featureIndex] : 0;
    if (activation > 0) {
      const color = rgb(interpolateSinebow(selectedFeature.order));
      color.opacity = activation;
      return {
        backgroundColor: color,
      };
    } else {
      return {
        backgroundColor: 'rgba(0, 0, 0, 0)',
      };
    }
  };

  if (!embedding || !embedding.token_spans) {
    return null;
  }

  const renderTextWithSpans = () => {
    const text = embedding.text[0];
    const tokenSpans = embedding.token_spans[0];
    const elements = [];
    let lastIndex = 0;

    tokenSpans.forEach((tokenSpan, index) => {
      // Add text before the current token span
      if (tokenSpan[0] == tokenSpan[1]) {
        return;
      }
      if (lastIndex < tokenSpan[0]) {
        elements.push(
          <span key={`text-${lastIndex}`} style={{ whiteSpace: 'pre' }}>
            {text.slice(lastIndex, tokenSpan[0])}
          </span>
        );
      }

      // Add the token span
      const activation = getTokenStyle(index).backgroundColor.opacity;
      elements.push(
        <span
          key={`token-${index}`}
          className={styles.token}
          style={{ ...getTokenStyle(index), whiteSpace: 'pre' }}
        >
          {text.slice(tokenSpan[0], tokenSpan[1])}
          <span className={styles.tooltip}>Activation: {activation?.toFixed(2)}</span>
        </span>
      );

      // Update lastIndex to the end of the current token span
      lastIndex = tokenSpan[1];
    });

    // Add any remaining text after the last token span
    if (lastIndex < text.length) {
      elements.push(
        <span key={`text-${lastIndex}`} style={{ whiteSpace: 'pre' }}>
          {text.slice(lastIndex)}
        </span>
      );
    }

    return elements;
  };

  return <div className={styles.container}>{renderTextWithSpans()}</div>;
}

export default TokensAnnotated;
