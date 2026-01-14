export const calculateMultiplier = (
  entryPrice: number,
  targetPrice: number,
  entryTime: number,
  targetTime: number,
): number => {
  // 1. Price distance as percentage
  const priceDistPercent = (Math.abs(targetPrice - entryPrice) / entryPrice) * 100;

  // 2. Time distance in seconds (minimum 10s)
  const duration = Math.max(targetTime - entryTime, 10);

  // 3. Crypto volatility: ~0.005% per second
  const volatilityPerSecond = 0.005;
  const expectedMove = volatilityPerSecond * Math.sqrt(duration);

  // 4. Difficulty ratio
  const difficultyRatio = Math.max(priceDistPercent / expectedMove, 0.1);

  // 5. Multiplier calculation (exponential)
  let multiplier = 100 + Math.pow(difficultyRatio, 1.5) * 10;

  // 6. Clamp [100, 2000] (1x - 20x)
  multiplier = Math.min(Math.max(Math.round(multiplier), 100), 2000);

  return multiplier;
};
