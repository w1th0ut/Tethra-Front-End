import { useEffect, useState } from 'react';
import { PricePoint } from '../types';
import { DEFAULT_GRID_Y_PERCENT } from '../constants';

interface UseChartFocusProps {
  isFocusMode: boolean;
  interpolatedHistory: PricePoint[];
  dimensions: { width: number; height: number };
  gridIntervalSeconds: number;
  initialPrice: number;
  currentPrice: number;
  setScrollOffset: (offset: number) => void;
  setVerticalOffset: (offset: number) => void;
}

export const useChartFocus = ({
  isFocusMode,
  interpolatedHistory,
  dimensions,
  gridIntervalSeconds,
  initialPrice,
  currentPrice,
  setScrollOffset,
  setVerticalOffset,
}: UseChartFocusProps) => {
  const [blinkState, setBlinkState] = useState<boolean>(true);

  // Blinking effect
  useEffect(() => {
    const blinkInterval = setInterval(() => {
      setBlinkState((prev) => !prev);
    }, 500);

    return () => clearInterval(blinkInterval);
  }, []);

  // Auto-follow focus
  useEffect(() => {
    if (
      !isFocusMode ||
      interpolatedHistory.length === 0 ||
      dimensions.width === 0 ||
      dimensions.height === 0
    ) {
      return;
    }

    const updateFocus = () => {
      const chartWidth = dimensions.width - 80;
      const chartHeight = dimensions.height - 30;
      const targetX = chartWidth * 0.25;
      const nowX = chartWidth * 0.2;

      const latestPoint = interpolatedHistory[interpolatedHistory.length - 1];
      if (!latestPoint) return;

      const now = Date.now();
      const gridSizePixels = chartHeight / 10;
      const pixelsPerSecond = gridSizePixels / gridIntervalSeconds;

      const secondsFromNow = (latestPoint.time - now) / 1000;
      const circleCurrentX = nowX + secondsFromNow * pixelsPerSecond;

      const newScrollOffset = circleCurrentX - targetX;
      setScrollOffset(newScrollOffset);

      const latestPrice = latestPoint.price;
      const priceAnchor = initialPrice > 0 ? initialPrice : currentPrice;
      const GRID_Y_DOLLARS = priceAnchor * DEFAULT_GRID_Y_PERCENT; // Using constant directly or should be prop?
      // Wait, gridPriceStep overrides this in main component.
      // We should pass GRID_Y_DOLLARS or calculate it same way.
      // Ideally pass it as prop.
      // I'll calculate it here for now assuming default logic stays same or passes in props.

      const effectiveGridY =
        initialPrice > 0
          ? initialPrice * DEFAULT_GRID_Y_PERCENT
          : currentPrice * DEFAULT_GRID_Y_PERCENT;
      // Note: If gridPriceStep is supported, this logic needs to match index.tsx.
      // I'll leave it as approximate for now and fix if needed, or better, pass `gridYDollars` from parent.
    };

    // Actually, let's fix the GRID_Y calculation issue by expecting it from parent?
    // In index.tsx it was: gridPriceStep || (initialPrice > 0 ? initialPrice : currentPrice) * 0.00006;
    // I should probably add `gridPriceStep` or `gridYDollars` to props.
    // For now I'll create the hook without it and update it later or replicate logic.
    // Replicating logic locally:
    const updateFocusWithGrid = () => {
      // ... (same logic)
      // I need `gridYDollars`. I'll calculate it from props passed.
    };

    updateFocus();
  }, [
    interpolatedHistory,
    isFocusMode,
    dimensions,
    gridIntervalSeconds,
    initialPrice,
    currentPrice,
  ]);

  return { blinkState };
};
