'use client';

import React, { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { PerSecondChartProps } from './types';
import { DEFAULT_GRID_X_SECONDS, DEFAULT_GRID_Y_PERCENT } from './constants';
import { calculateMultiplier } from './utils';

// Hooks
import { useChartDimensions } from './hooks/useChartDimensions';
import { usePriceHistory } from './hooks/usePriceHistory';
import { useChartFocus } from './hooks/useChartFocus';
import { useChartInteraction } from './hooks/useChartInteraction';

const PerSecondChart: React.FC<PerSecondChartProps> = ({
  symbol,
  currentPrice,
  isBinaryTradingEnabled = false,
  tradeMode = 'one-tap-profit',
  onCellClick,
  isPlacingBet = false,
  logoUrl,
  gridIntervalSeconds = DEFAULT_GRID_X_SECONDS,
  gridPriceStep,
  gridAnchorPrice,
  gridAnchorTime,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // State lifted from hooks for shared access
  const [scrollOffset, setScrollOffset] = useState(0);
  const [verticalOffset, setVerticalOffset] = useState(0);
  const [isFocusMode, setIsFocusMode] = useState<boolean>(true);
  const [hoveredCell, setHoveredCell] = useState<string | null>(null);
  const [hoveredCellInfo, setHoveredCellInfo] = useState<{
    targetPrice: number;
    targetCenterPrice?: number;
    targetTime: number;
    multiplier: number;
  } | null>(null);

  // 1. Dimensions
  const dimensions = useChartDimensions(canvasRef);

  // 2. Data & History
  const { priceHistory, interpolatedHistory } = usePriceHistory(symbol, currentPrice);

  // 3. Initial Price (Anchor)
  const initialPriceRef = useRef<number>(0);
  const [initialPrice, setInitialPrice] = useState<number>(0);

  useEffect(() => {
    if (currentPrice > 0 && initialPriceRef.current === 0) {
      initialPriceRef.current = currentPrice;
      setInitialPrice(currentPrice);
    }
  }, [currentPrice]);

  // Derived constants
  // Derived constants
  // Ensure we never have 0 grid step (avoids division by zero in drawing)
  const basePrice = initialPrice > 0 ? initialPrice : currentPrice > 0 ? currentPrice : 1000; // Fallback to 1000 if no price
  const GRID_Y_DOLLARS = gridPriceStep || basePrice * DEFAULT_GRID_Y_PERCENT;

  // 4. Focus & Auto-scroll
  const { blinkState } = useChartFocus({
    isFocusMode,
    interpolatedHistory,
    dimensions,
    gridIntervalSeconds,
    initialPrice,
    currentPrice,
    setScrollOffset,
    setVerticalOffset,
  });

  // 5. Interaction (Mouse/Keyboard)
  const {
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    mousePos,
    isDragging,
    selectedCells,
    // setSelectedCells is internal to hook, but we might need it if we want to manipulate it?
    // The hook manages selection state.
  } = useChartInteraction({
    canvasRef,
    scrollOffset,
    verticalOffset,
    setScrollOffset,
    setVerticalOffset,
    setIsFocusMode,
    hoveredCell,
    isPlacingBet,
    onCellClick,
    priceHistory,
    currentPrice,
    gridIntervalSeconds,
    gridYDollars: GRID_Y_DOLLARS,
  });

  // 6. Drawing Logic (View)
  useEffect(() => {
    if (!canvasRef.current || dimensions.width === 0 || interpolatedHistory.length === 0) {
      return;
    }

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    canvas.width = dimensions.width;
    canvas.height = dimensions.height;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Define margins
    const rightMargin = 80;
    const bottomMargin = 30;
    const chartWidth = canvas.width - rightMargin;
    const chartHeight = canvas.height - bottomMargin;

    // Draw background for margins
    ctx.fillStyle = '#000000';
    ctx.fillRect(chartWidth, 0, rightMargin, canvas.height);
    ctx.fillRect(0, chartHeight, canvas.width, bottomMargin);

    // Calculate grid square size
    const targetVerticalGrids = 10;
    const gridSizePixels = chartHeight / targetVerticalGrids;
    const pixelsPerDollar = gridSizePixels / GRID_Y_DOLLARS;
    const priceRangeToShow = chartHeight / pixelsPerDollar;

    const priceAnchor = initialPrice > 0 ? initialPrice : currentPrice;
    const baseDisplayMinPrice = priceAnchor - priceRangeToShow / 2;
    const baseDisplayMaxPrice = priceAnchor + priceRangeToShow / 2;

    const verticalPriceShift = verticalOffset / pixelsPerDollar;
    const displayMinPrice = baseDisplayMinPrice + verticalPriceShift;
    const displayMaxPrice = baseDisplayMaxPrice + verticalPriceShift;

    const gridWidthPixels = gridSizePixels;
    const pixelsPerSecond = gridWidthPixels / gridIntervalSeconds;

    // Helpers
    const priceToY = (price: number): number => {
      return (
        chartHeight -
        ((price - displayMinPrice) / (displayMaxPrice - displayMinPrice)) * chartHeight
      );
    };

    const nowX = chartWidth * 0.2;

    const timeToX = (timestamp: number): number => {
      const now = Date.now();
      const secondsFromNow = (timestamp - now) / 1000;
      return nowX + secondsFromNow * pixelsPerSecond - scrollOffset;
    };

    // --- Draw Grid ---
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 5]);

    const largeBufferGrids = 50;
    let lowestPriceLevel: number;
    const priceDecimals =
      GRID_Y_DOLLARS < 0.0001 ? 6 : GRID_Y_DOLLARS < 0.01 ? 4 : GRID_Y_DOLLARS < 1 ? 2 : 1;

    if (gridAnchorPrice !== undefined) {
      lowestPriceLevel = parseFloat(
        (
          Math.floor(
            (baseDisplayMinPrice - largeBufferGrids * GRID_Y_DOLLARS - gridAnchorPrice) /
              GRID_Y_DOLLARS,
          ) *
            GRID_Y_DOLLARS +
          gridAnchorPrice
        ).toFixed(priceDecimals),
      );
    } else {
      lowestPriceLevel = parseFloat(
        (
          Math.floor((baseDisplayMinPrice - largeBufferGrids * GRID_Y_DOLLARS) / GRID_Y_DOLLARS) *
          GRID_Y_DOLLARS
        ).toFixed(priceDecimals),
      );
    }

    const highestPriceLevel = parseFloat(
      (
        Math.ceil((baseDisplayMaxPrice + largeBufferGrids * GRID_Y_DOLLARS) / GRID_Y_DOLLARS) *
        GRID_Y_DOLLARS
      ).toFixed(priceDecimals),
    );

    for (let price = lowestPriceLevel; price <= highestPriceLevel; price += GRID_Y_DOLLARS) {
      const y = priceToY(price);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(chartWidth, y);
      ctx.stroke();

      ctx.fillStyle = '#94a3b8';
      ctx.font = '11px monospace';
      ctx.fillText(`$${price.toFixed(priceDecimals)}`, chartWidth + 5, y + 4);
    }
    ctx.setLineDash([]);

    // --- Draw Vertical Grid (Time) ---
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 5]);

    const now = Date.now();
    const visibleTimeRangeSeconds = chartWidth / pixelsPerSecond + 60;
    const lowestTimeLevel = now - (visibleTimeRangeSeconds * 1000) / 2;
    const highestTimeLevel = now + visibleTimeRangeSeconds * 1000;

    let lowestTimeRounded: number;
    if (gridAnchorTime !== undefined) {
      const anchorMs = gridAnchorTime * 1000;
      const stepMs = gridIntervalSeconds * 1000;
      lowestTimeRounded = Math.floor((lowestTimeLevel - anchorMs) / stepMs) * stepMs + anchorMs;
    } else {
      lowestTimeRounded =
        Math.floor(lowestTimeLevel / (gridIntervalSeconds * 1000)) * (gridIntervalSeconds * 1000);
    }

    const highestTimeRounded =
      lowestTimeRounded +
      Math.ceil((highestTimeLevel - lowestTimeRounded) / (gridIntervalSeconds * 1000)) *
        (gridIntervalSeconds * 1000);

    for (
      let timestamp = lowestTimeRounded;
      timestamp <= highestTimeRounded;
      timestamp += gridIntervalSeconds * 1000
    ) {
      const x = timeToX(timestamp);

      if (x >= -10 && x <= chartWidth + 10) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, chartHeight);
        ctx.stroke();

        const date = new Date(timestamp);
        const timeLabel = `${String(date.getHours()).padStart(2, '0')}:${String(
          date.getMinutes(),
        ).padStart(2, '0')}:${String(date.getSeconds()).padStart(2, '0')}`;

        ctx.fillStyle = '#94a3b8';
        ctx.font = '9px monospace';
        const textWidth = ctx.measureText(timeLabel).width;

        if (x - textWidth / 2 >= 0 && x + textWidth / 2 <= chartWidth) {
          ctx.fillText(timeLabel, x - textWidth / 2, chartHeight + 18);
        }
      }
    }
    ctx.setLineDash([]);

    // --- Draw Unplayable Area Overlay ---
    const nowTs = Date.now() / 1000;
    const currentGridStartTs = Math.floor(nowTs / gridIntervalSeconds) * gridIntervalSeconds;
    // const minSelectableGridStartTs = currentGridStartTs + gridIntervalSeconds * 1.5; // (Old ref)

    let headX = nowX;
    if (interpolatedHistory.length > 0) {
      const latestPoint = interpolatedHistory[interpolatedHistory.length - 1];
      headX = timeToX(latestPoint.time);
    }

    if (headX > 0) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
      ctx.fillRect(0, 0, headX, chartHeight);

      ctx.strokeStyle = '#374151';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(headX, 0);
      ctx.lineTo(headX, chartHeight);
      ctx.stroke();
    }

    // --- Draw Cells (Interaction) ---
    let currentHoveredCellId: string | null = null;

    for (
      let priceLevelRaw = lowestPriceLevel;
      priceLevelRaw <= highestPriceLevel;
      priceLevelRaw += GRID_Y_DOLLARS
    ) {
      const priceLevel = parseFloat(priceLevelRaw.toFixed(priceDecimals));
      const yTop = priceToY(priceLevel + GRID_Y_DOLLARS);
      const yBottom = priceToY(priceLevel);

      for (
        let timestamp = lowestTimeRounded;
        timestamp <= highestTimeRounded;
        timestamp += gridIntervalSeconds * 1000
      ) {
        const xLeft = timeToX(timestamp);
        const xRight = timeToX(timestamp + gridIntervalSeconds * 1000);

        if (xRight < -10 || xLeft > chartWidth + 10) continue;

        const boxWidth = xRight - xLeft;
        const boxHeight = Math.abs(yBottom - yTop);
        const cellId = `${Math.floor(timestamp / 1000)}_${priceLevel.toFixed(priceDecimals)}`;

        // Check hover
        if (
          mousePos &&
          mousePos.x >= xLeft &&
          mousePos.x <= xRight &&
          mousePos.y >= yTop &&
          mousePos.y <= yBottom &&
          mousePos.x <= chartWidth &&
          mousePos.y <= chartHeight
        ) {
          const nowLocal = Date.now() / 1000;
          const currentGridStart = Math.floor(nowLocal / gridIntervalSeconds) * gridIntervalSeconds;
          const minSelectableGridStart = currentGridStart + gridIntervalSeconds * 1;
          const gridStartTime = Math.floor(timestamp / 1000);

          if (gridStartTime >= minSelectableGridStart) {
            currentHoveredCellId = cellId;
          }
        }

        const isSelected = selectedCells.has(cellId);
        const isHovered = hoveredCell === cellId;

        // Default colors
        let cellColor = '59, 130, 246'; // Blue
        if (tradeMode === 'open-position') {
          const cellCenterPrice = priceLevel + GRID_Y_DOLLARS / 2;
          const currentPriceVal =
            priceHistory.length > 0 ? priceHistory[priceHistory.length - 1].price : currentPrice;
          const isLong = cellCenterPrice < currentPriceVal;
          cellColor = isLong ? '34, 197, 94' : '239, 68, 68'; // Green : Red
        }

        if (isSelected) {
          ctx.fillStyle = `rgba(${cellColor}, 0.3)`;
          ctx.fillRect(xLeft, yTop, boxWidth, boxHeight);
          ctx.strokeStyle = `rgba(${cellColor}, 0.8)`;
          ctx.lineWidth = 2;
          ctx.strokeRect(xLeft, yTop, boxWidth, boxHeight);
        } else if (isHovered && !isDragging) {
          ctx.fillStyle = `rgba(${cellColor}, 0.15)`;
          ctx.fillRect(xLeft, yTop, boxWidth, boxHeight);
          ctx.strokeStyle = `rgba(${cellColor}, 0.5)`;
          ctx.lineWidth = 1;
          ctx.strokeRect(xLeft, yTop, boxWidth, boxHeight);
        }

        // Shared text drawing logic for both Selected and Hovered states
        if (isSelected || (isHovered && !isDragging)) {
          // Calculate values
          const targetPrice = priceLevel + GRID_Y_DOLLARS / 2;
          const targetTime = Math.floor(timestamp / 1000) + gridIntervalSeconds; // End of grid
          const entryPrice =
            priceHistory.length > 0 ? priceHistory[priceHistory.length - 1].price : currentPrice;
          const entryTime = Math.floor(timestamp / 1000); // Start of grid

          const mult = calculateMultiplier(entryPrice, targetPrice, entryTime, targetTime);
          const displayMult = !isNaN(mult) && mult > 0 ? mult : 100;

          const centerX = xLeft + boxWidth / 2;
          const centerY = yTop + boxHeight / 2;
          const displayPrice = priceLevel + GRID_Y_DOLLARS / 2;

          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';

          // Multiplier
          if (tradeMode !== 'open-position') {
            ctx.font = 'bold 14px monospace';
            ctx.fillStyle = '#ffffff';
            ctx.shadowBlur = 4;
            ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
            ctx.fillText(`${(displayMult / 100).toFixed(2)}x`, centerX, centerY - 8);
          }

          // Price
          ctx.font = '600 12px monospace';
          ctx.fillStyle = '#ffffff';
          ctx.shadowBlur = 4;
          ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
          ctx.fillText(
            `$${displayPrice.toFixed(priceDecimals)}`,
            centerX,
            tradeMode !== 'open-position' ? centerY + 8 : centerY,
          );

          ctx.shadowBlur = 0;
          ctx.textAlign = 'left';
          ctx.textBaseline = 'alphabetic';
        }
      }
    }

    // Update hovered cell logic
    if (currentHoveredCellId !== hoveredCell) {
      setHoveredCell(currentHoveredCellId);

      if (currentHoveredCellId && priceHistory.length > 0) {
        const [timestampStr, priceLevelStr] = currentHoveredCellId.split('_');
        const gridStartTime = parseInt(timestampStr);
        const gridBottomPrice = parseFloat(priceLevelStr);
        const entryPrice = priceHistory[priceHistory.length - 1].price;

        const validTargetPrice = gridBottomPrice + GRID_Y_DOLLARS / 2;
        const validTargetTime = gridStartTime + gridIntervalSeconds;
        const validEntryTime = gridStartTime;

        const multiplier = calculateMultiplier(
          entryPrice,
          validTargetPrice,
          validEntryTime,
          validTargetTime,
        );

        setHoveredCellInfo({
          targetPrice: gridBottomPrice,
          targetCenterPrice: validTargetPrice,
          targetTime: validTargetTime,
          multiplier,
        });
      } else {
        setHoveredCellInfo(null);
      }
    }

    // --- Draw Price Line ---
    if (interpolatedHistory.length > 1) {
      // Gradient
      ctx.beginPath();
      let firstPoint = true;
      let lastX = 0;

      for (let i = 0; i < interpolatedHistory.length; i++) {
        const point = interpolatedHistory[i];
        const x = timeToX(point.time);
        const y = priceToY(point.price);
        if (x >= -50 && x <= chartWidth + 50) {
          if (firstPoint) {
            ctx.moveTo(x, chartHeight);
            ctx.lineTo(x, y);
            firstPoint = false;
          } else {
            ctx.lineTo(x, y);
          }
          lastX = x;
        }
      }
      ctx.lineTo(lastX, chartHeight);
      ctx.closePath();
      const gradient = ctx.createLinearGradient(0, 0, 0, chartHeight);
      gradient.addColorStop(0, 'rgba(0, 255, 65, 0.25)');
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0.05)');
      ctx.fillStyle = gradient;
      ctx.fill();

      // Line
      ctx.strokeStyle = '#00ff41';
      ctx.lineWidth = 3;
      ctx.shadowColor = '#00ff41';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      firstPoint = true;
      for (let i = 0; i < interpolatedHistory.length; i++) {
        const point = interpolatedHistory[i];
        const x = timeToX(point.time);
        const y = priceToY(point.price);

        if (x >= -50 && x <= chartWidth + 50) {
          if (firstPoint) {
            ctx.moveTo(x, y);
            firstPoint = false;
          } else {
            ctx.lineTo(x, y);
          }
        }
      }
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.shadowColor = 'transparent';

      // Head Circle
      const latestPoint = interpolatedHistory[interpolatedHistory.length - 1];
      const currentPriceY = priceToY(latestPoint.price);
      const latestX = timeToX(latestPoint.time);

      if (blinkState) {
        if (isFocusMode) {
          ctx.strokeStyle = 'rgba(0, 255, 65, 0.4)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(latestX, currentPriceY, 12, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.fillStyle = 'rgba(0, 255, 65, 0.3)';
        ctx.beginPath();
        ctx.arc(latestX, currentPriceY, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(0, 255, 65, 0.6)';
        ctx.beginPath();
        ctx.arc(latestX, currentPriceY, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#00ff41';
        ctx.shadowColor = '#00ff41';
        ctx.shadowBlur = 15;
        ctx.beginPath();
        ctx.arc(latestX, currentPriceY, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    }
  }, [
    dimensions,
    interpolatedHistory,
    priceHistory,
    scrollOffset,
    verticalOffset,
    hoveredCell,
    selectedCells,
    mousePos,
    blinkState,
    isFocusMode,
    isDragging,
    GRID_Y_DOLLARS,
    tradeMode,
    isPlacingBet,
    gridIntervalSeconds,
    initialPrice,
    currentPrice,
    gridAnchorPrice,
    gridAnchorTime,
    symbol,
  ]);

  return (
    <canvas
      ref={canvasRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={() => {
        // Optional: clear hover
      }}
      className="w-full h-full cursor-crosshair touch-none select-none"
    />
  );
};

export default PerSecondChart;
