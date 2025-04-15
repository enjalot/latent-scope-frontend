/**
 * Calculate Z-scores, Prominence Ratios, and Modified Weighted Scores for tokens
 * @param {Array} tokenData - Array of objects with token and activation properties
 * @param {Number} power - Power to raise activation to for modified weighted score (default: 2)
 * @returns {Array} Objects with token, averageActivation, frequency, zScore, prominenceRatio, and modifiedScore
 */
export function calculateTokenMetrics(tokenData, power = 2) {
  // Step 1: Group tokens and calculate their statistics
  const tokenStats = {};
  const totalTokens = tokenData.length;

  tokenData.forEach((item) => {
    if (!tokenStats[item.token]) {
      tokenStats[item.token] = {
        activations: [item.activation],
        sum: item.activation,
        count: 1,
      };
    } else {
      tokenStats[item.token].activations.push(item.activation);
      tokenStats[item.token].sum += item.activation;
      tokenStats[item.token].count += 1;
    }
  });

  // Step 2: Calculate the global mean and standard deviation for Z-scores
  let allActivations = tokenData.map((item) => item.activation);
  const globalMean = allActivations.reduce((sum, val) => sum + val, 0) / allActivations.length;

  const sumSquaredDiff = allActivations.reduce((sum, val) => {
    return sum + Math.pow(val - globalMean, 2);
  }, 0);

  const globalStdDev = Math.sqrt(sumSquaredDiff / allActivations.length);

  // Step 3: Calculate metrics for each token
  const results = Object.keys(tokenStats).map((token) => {
    const stats = tokenStats[token];
    const avgActivation = stats.sum / stats.count;

    // Calculate Z-score
    const zScore = (avgActivation - globalMean) / globalStdDev;

    // Calculate Prominence Ratio
    const prominenceRatio = avgActivation / globalMean;

    // Calculate Modified Weighted Score
    const activationPower = Math.pow(avgActivation, power);
    const frequencyWeight = (avgActivation * stats.count) / totalTokens;
    const modifiedScore = Math.max(activationPower, frequencyWeight);

    return {
      token: token,
      averageActivation: avgActivation,
      frequency: stats.count,
      zScore: zScore,
      prominenceRatio: prominenceRatio,
      modifiedScore: modifiedScore,
    };
  });

  // Sort by z-score in descending order (or any other metric if needed)
  return results.sort((a, b) => b.zScore - a.zScore);
}

export function extractActivations(embedding, feature) {
  const featureIndices = embedding.features.top_indices.map((i) => i.indexOf(feature));
  return embedding.features.top_acts.map((act, i) => act[featureIndices[i]] || 0);
}
