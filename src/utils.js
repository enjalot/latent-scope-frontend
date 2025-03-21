export function processHulls(labels, points, pointSelector = (d) => d) {
  if (!labels) return [];
  return labels.map((d) => {
    return d.hull.map((i) => pointSelector(points[i])).filter((d) => !!d);
  });
}

// let's warn mobile users (on demo in read-only) that desktop is better experience
export const isMobileDevice = () => {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
};

// Debounce function without importing all of lodash
export const debounce = (func, wait) => {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
};

export function cosineSimilarity(arrayA, arrayB) {
  // Make sure arrays are of the same length
  if (arrayA.length !== arrayB.length) {
    throw new Error('Arrays must be of the same length');
  }

  // Calculate dot product
  let dotProduct = 0;
  for (let i = 0; i < arrayA.length; i++) {
    dotProduct += arrayA[i] * arrayB[i];
  }

  // Calculate magnitudes
  let magnitudeA = 0;
  let magnitudeB = 0;
  for (let i = 0; i < arrayA.length; i++) {
    magnitudeA += arrayA[i] * arrayA[i];
    magnitudeB += arrayB[i] * arrayB[i];
  }
  magnitudeA = Math.sqrt(magnitudeA);
  magnitudeB = Math.sqrt(magnitudeB);

  // Calculate cosine similarity
  return dotProduct / (magnitudeA * magnitudeB);
}
