import React, { useState, useEffect, useRef } from 'react';
import EmbeddingVis from './Embedding';
import styles from '../../essays/essays.module.scss';

const TokenEmbeddings = ({
  embeddingData,
  layerIndex = -1, // Default to last layer
  domain = [-0.8, 0, 0.8],
  rows = 8,
  height = 32,
}) => {
  if (!embeddingData || !embeddingData.tokens || !embeddingData.hidden_states) {
    return <div>No embedding data provided</div>;
  }

  // Use specified layer or default to last layer if layerIndex is -1
  const effectiveLayerIndex = layerIndex >= 0 ? layerIndex : embeddingData.hidden_states.length - 1;

  // Get tokens and their hidden states
  const tokens = embeddingData.tokens;
  const hiddenStates = embeddingData.hidden_states[effectiveLayerIndex];

  return (
    <div
      className={styles.tokenEmbeddingsContainer}
      style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}
    >
      {tokens.map((token, index) => (
        <div key={index} style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div
            style={{
              width: '100px',
              textAlign: 'right',
              fontFamily: 'monospace',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {token}
          </div>
          <EmbeddingVis
            embedding={hiddenStates[index]}
            rows={rows}
            height={height}
            domain={domain}
          />
        </div>
      ))}
    </div>
  );
};

function meanPooling(hiddenStates, attentionMask) {
  // hiddenStates: [batch_size=1, sequence_length, hidden_size]
  // attentionMask: [sequence_length]

  const sequenceLength = hiddenStates[0].length;
  const hiddenSize = hiddenStates[0][0].length;

  // Initialize embedding vector with zeros
  const result = new Array(hiddenSize).fill(0);

  // Sum the weighted token embeddings
  let maskSum = 0;
  for (let i = 0; i < sequenceLength; i++) {
    const mask = attentionMask[i];
    if (mask > 0) {
      for (let j = 0; j < hiddenSize; j++) {
        result[j] += hiddenStates[0][i][j] * mask;
      }
      maskSum += mask;
    }
  }

  // Normalize by mask sum (with a small epsilon to avoid division by zero)
  const epsilon = 1e-9;
  maskSum = Math.max(maskSum, epsilon);
  for (let j = 0; j < hiddenSize; j++) {
    result[j] /= maskSum;
  }

  // L2 normalize the result (optional if hiddenStates are already normalized)
  const norm = Math.sqrt(result.reduce((sum, val) => sum + val * val, 0));
  for (let j = 0; j < hiddenSize; j++) {
    result[j] /= norm;
  }

  return result;
}

// Example usage:
function recreateEmbedding(response) {
  const { hidden_states, attention_mask } = response;
  return meanPooling(hidden_states, attention_mask);
}

// Updated component with mean pooling
const AverageTokenEmbeddings = ({
  embeddingData,
  layerIndex = -1,
  domain = [-0.8, 0, 0.8],
  rows = 8,
  height = 32,
}) => {
  if (!embeddingData || !embeddingData.tokens || !embeddingData.hidden_states) {
    return <div>No embedding data provided</div>;
  }

  // Use specified layer or default to last layer if layerIndex is -1
  const effectiveLayerIndex = layerIndex >= 0 ? layerIndex : embeddingData.hidden_states.length - 1;

  // Get tokens and their hidden states
  const tokens = embeddingData.tokens;
  const hiddenStates = embeddingData.hidden_states[effectiveLayerIndex];

  // Calculate the average embedding
  const calculateAverageEmbedding = () => {
    if (!hiddenStates || hiddenStates.length === 0) return [];

    // Adapt hiddenStates format for meanPooling (adding batch dimension)
    const batchedHiddenStates = [hiddenStates];
    return meanPooling(batchedHiddenStates, embeddingData.attention_mask);
  };

  const averageEmbedding = calculateAverageEmbedding();
  console.log('averageEmbedding', averageEmbedding);
  console.log('embeddingData.embedding', embeddingData.embedding);

  return (
    <div className={styles.averageEmbeddingContainer}>
      <div style={{ marginBottom: '12px' }}>
        <span style={{ fontWeight: 'bold' }}>
          {embeddingData.attention_mask ? 'Mean pooled' : 'Average'} of {tokens.length} tokens
          (normalized):
        </span>
      </div>
      <EmbeddingVis embedding={averageEmbedding} rows={rows} height={height} domain={domain} />
      <EmbeddingVis
        embedding={embeddingData.embedding}
        rows={rows}
        height={height}
        domain={domain}
      />
    </div>
  );
};

const AnimatedTokenEmbeddings = ({
  embeddingData,
  layerIndex = -1,
  domain = [-0.8, 0, 0.8],
  rows = 8,
  height = 32,
}) => {
  const [progress, setProgress] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const animationRef = useRef(null);
  const lastTimeRef = useRef(0);

  if (!embeddingData || !embeddingData.tokens || !embeddingData.hidden_states) {
    return <div>No embedding data provided</div>;
  }

  // Use specified layer or default to last layer if layerIndex is -1
  const effectiveLayerIndex = layerIndex >= 0 ? layerIndex : embeddingData.hidden_states.length - 1;

  // Get tokens and their hidden states
  const tokens = embeddingData.tokens;
  const hiddenStates = embeddingData.hidden_states[effectiveLayerIndex];

  // Calculate fixed container height based on the number of tokens
  const containerHeight = tokens.length * (height + 16);

  // Animation logic
  useEffect(() => {
    if (!isPlaying) {
      cancelAnimationFrame(animationRef.current);
      return;
    }

    const animate = (timestamp) => {
      if (!lastTimeRef.current) lastTimeRef.current = timestamp;
      const deltaTime = timestamp - lastTimeRef.current;

      // Speed of animation - adjust as needed
      const animationSpeed = 0.001;
      setProgress((prev) => {
        const newProgress = Math.min(prev + deltaTime * animationSpeed, 1);
        if (newProgress >= 1) {
          setIsPlaying(false);
          return 1;
        }
        return newProgress;
      });

      lastTimeRef.current = timestamp;
      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animationRef.current);
    };
  }, [isPlaying]);

  // Calculate opacity based on progress and number of tokens
  const getOpacity = (index) => {
    // At progress 0, all tokens have full opacity
    // At progress 1, each token's opacity = 1/total tokens
    return 1.2 - progress * (1 - 1 / tokens.length);
  };

  const handlePlayClick = () => {
    if (progress >= 1) {
      setProgress(0);
      lastTimeRef.current = 0;
    }
    setIsPlaying(!isPlaying);
  };

  const handleReset = () => {
    setProgress(0);
    setIsPlaying(false);
    lastTimeRef.current = 0;
  };

  return (
    <div>
      <div
        className={styles.tokenEmbeddingsContainer}
        style={{
          position: 'relative',
          height: containerHeight, // Fixed height
        }}
      >
        {tokens.map((token, index) => {
          // Calculate position based on progress
          // At progress 0: original position (stacked vertically)
          // At progress 1: all at position 0 (stacked on top of each other)
          const positionY = index * (1 - progress) * (height + 16);

          return (
            <div
              key={index}
              style={{
                position: 'absolute',
                top: positionY,
                left: 0,
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                opacity: getOpacity(index),
                transition: 'none', // No easing/transitions
              }}
            >
              <div
                style={{
                  width: '100px',
                  textAlign: 'right',
                  fontFamily: 'monospace',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  opacity: 1 - progress, // Text fades out as progress increases
                }}
              >
                {token}
              </div>
              <EmbeddingVis
                embedding={hiddenStates[index]}
                rows={rows}
                height={height}
                domain={domain}
              />
            </div>
          );
        })}
      </div>

      <div className={styles.controls} style={{ marginTop: '16px' }}>
        <button
          onClick={handlePlayClick}
          style={{
            padding: '8px 16px',
            marginRight: '12px',
            borderRadius: '4px',
            background: '#0066cc',
            color: 'white',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          {isPlaying ? 'Pause' : 'Play'}
        </button>

        <button
          onClick={handleReset}
          style={{
            padding: '8px 16px',
            marginRight: '12px',
            borderRadius: '4px',
            background: '#666',
            color: 'white',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          Reset
        </button>

        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={progress}
          onChange={(e) => {
            setProgress(parseFloat(e.target.value));
            setIsPlaying(false);
          }}
          style={{ width: '200px', verticalAlign: 'middle' }}
        />
        <span style={{ marginLeft: '8px' }}>{Math.round(progress * 100)}%</span>
      </div>
    </div>
  );
};

export { AnimatedTokenEmbeddings, AverageTokenEmbeddings };
export default TokenEmbeddings;
