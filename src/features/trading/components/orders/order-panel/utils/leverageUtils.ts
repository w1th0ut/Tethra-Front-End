/**
 * Leverage calculation utilities for order panel components
 */

export const LEVERAGE_MARKERS = [1, 2, 5, 10, 25, 50, 100];

export const generateLeverageValues = (): number[] => {
  const values: number[] = [];
  for (let i = 0; i < LEVERAGE_MARKERS.length - 1; i++) {
    const start = LEVERAGE_MARKERS[i];
    const end = LEVERAGE_MARKERS[i + 1];
    const step = (end - start) / 10;

    for (let j = 0; j < 10; j++) {
      const value = start + step * j;
      values.push(Number(value.toFixed(2)));
    }
  }
  values.push(LEVERAGE_MARKERS[LEVERAGE_MARKERS.length - 1]);
  return values;
};

export const getCurrentSliderIndex = (leverage: number, leverageValues: number[]): number => {
  let closestIndex = 0;
  let minDiff = Math.abs(leverageValues[0] - leverage);

  for (let i = 1; i < leverageValues.length; i++) {
    const diff = Math.abs(leverageValues[i] - leverage);
    if (diff < minDiff) {
      minDiff = diff;
      closestIndex = i;
    }
  }

  return closestIndex;
};
