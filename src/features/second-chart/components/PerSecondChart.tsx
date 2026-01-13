'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useOneTapProfit } from '@/features/trading/hooks/useOneTapProfitBetting';
import { usePythWebSocket } from '../hooks/usePythWebSocket';
import { toast } from 'sonner';
import { PricePoint, HoveredCellInfo } from '../types';
import { calculateMultiplier, generateCellId, parseCellId } from '../lib/calculations';
import {
  GRID_X_SECONDS,
  getGridYDollars,
  getPriceDecimals,
  RIGHT_MARGIN,
  BOTTOM_MARGIN,
  NOW_LINE_POSITION,
  TARGET_VERTICAL_GRIDS,
  SCROLL_STEP_PIXELS,
  DRAG_THRESHOLD_PIXELS,
  CHART_COLORS,
} from '../lib/config';
import PriceDisplay from './PriceDisplay';
import HoverTooltip from './HoverTooltip';

interface PerSecondChartProps {
  symbol: string;
  currentPrice: number;
  betAmount?: string;
  isBinaryTradingEnabled?: boolean;
}

const PerSecondChart: React.FC<PerSecondChartProps> = ({
  symbol,
  currentPrice,
  betAmount: propBetAmount = '10',
  isBinaryTradingEnabled = false,
}) => {
  const { placeBetWithSession, isPlacingBet } = useOneTapProfit();
  const { priceHistory } = usePythWebSocket(symbol, currentPrice);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | undefined>(undefined);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [scrollOffset, setScrollOffset] = useState(0);
  const [verticalOffset, setVerticalOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartX, setDragStartX] = useState(0);
  const [dragStartY, setDragStartY] = useState(0);
  const [dragStartScrollOffset, setDragStartScrollOffset] = useState(0);
  const [dragStartVerticalOffset, setDragStartVerticalOffset] = useState(0);
  const [hasMoved, setHasMoved] = useState(false);
  const [selectedCells, setSelectedCells] = useState<Set<string>>(new Set());
  const [hoveredCell, setHoveredCell] = useState<string | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);
  const [hoveredCellInfo, setHoveredCellInfo] = useState<HoveredCellInfo | null>(null);

  const GRID_Y_DOLLARS = getGridYDollars(symbol);

  // Update canvas dimensions
  useEffect(() => {
    const updateDimensions = () => {
      if (canvasRef.current?.parentElement) {
        const parent = canvasRef.current.parentElement;
        setDimensions({
          width: parent.clientWidth,
          height: parent.clientHeight,
        });
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    const interval = setInterval(updateDimensions, 1000);

    return () => {
      window.removeEventListener('resize', updateDimensions);
      clearInterval(interval);
    };
  }, []);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key.toLowerCase()) {
        case 'arrowleft':
          e.preventDefault();
          setScrollOffset((prev) => prev - SCROLL_STEP_PIXELS);
          break;
        case 'arrowright':
          e.preventDefault();
          setScrollOffset((prev) => prev + SCROLL_STEP_PIXELS);
          break;
        case 'arrowup':
          e.preventDefault();
          setVerticalOffset((prev) => prev + SCROLL_STEP_PIXELS);
          break;
        case 'arrowdown':
          e.preventDefault();
          setVerticalOffset((prev) => prev - SCROLL_STEP_PIXELS);
          break;
        case 'c':
          e.preventDefault();
          setScrollOffset(0);
          setVerticalOffset(0);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Drawing function - keeping this together for performance
  useEffect(() => {
    if (!canvasRef.current || dimensions.width === 0 || priceHistory.length === 0) {
      return;
    }

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const draw = () => {
      canvas.width = dimensions.width;
      canvas.height = dimensions.height;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const chartWidth = canvas.width - RIGHT_MARGIN;
      const chartHeight = canvas.height - BOTTOM_MARGIN;

      // Draw background for margins
      ctx.fillStyle = CHART_COLORS.background;
      ctx.fillRect(chartWidth, 0, RIGHT_MARGIN, canvas.height);
      ctx.fillRect(0, chartHeight, canvas.width, BOTTOM_MARGIN);

      // Calculate price range
      const prices = priceHistory.map((p) => p.price);
      const minPrice = Math.min(...prices);
      const maxPrice = Math.max(...prices);
      const priceCenter = (minPrice + maxPrice) / 2;

      // Calculate grid size
      const gridSizePixels = chartHeight / TARGET_VERTICAL_GRIDS;
      const pixelsPerDollar = gridSizePixels / GRID_Y_DOLLARS;
      const priceRangeToShow = chartHeight / pixelsPerDollar;

      const verticalPriceShift = verticalOffset / pixelsPerDollar;
      const displayMinPrice = priceCenter - priceRangeToShow / 2 + verticalPriceShift;
      const displayMaxPrice = priceCenter + priceRangeToShow / 2 + verticalPriceShift;

      const gridWidthPixels = gridSizePixels;
      const pixelsPerSecond = gridWidthPixels / GRID_X_SECONDS;

      // Helper functions
      const priceToY = (price: number): number => {
        return (
          chartHeight -
          ((price - displayMinPrice) / (displayMaxPrice - displayMinPrice)) * chartHeight
        );
      };

      const nowX = chartWidth * NOW_LINE_POSITION;

      const timeToX = (timestamp: number): number => {
        const now = Date.now();
        const secondsFromNow = (timestamp - now) / 1000;
        return nowX + secondsFromNow * pixelsPerSecond - scrollOffset;
      };

      // Draw horizontal grid lines
      ctx.strokeStyle = CHART_COLORS.gridLine;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 5]);

      const lowestPriceLevel = parseFloat(
        (Math.floor(displayMinPrice / GRID_Y_DOLLARS) * GRID_Y_DOLLARS).toFixed(2),
      );
      const highestPriceLevel = parseFloat(
        (Math.ceil(displayMaxPrice / GRID_Y_DOLLARS) * GRID_Y_DOLLARS).toFixed(2),
      );

      for (let price = lowestPriceLevel; price <= highestPriceLevel; price += GRID_Y_DOLLARS) {
        const y = priceToY(price);
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(chartWidth, y);
        ctx.stroke();

        ctx.fillStyle = CHART_COLORS.textSecondary;
        ctx.font = '11px monospace';
        const decimals = getPriceDecimals(symbol);
        ctx.fillText(`$${price.toFixed(decimals)}`, chartWidth + 5, y + 4);
      }
      ctx.setLineDash([]);

      // Draw vertical grid lines
      ctx.strokeStyle = CHART_COLORS.gridLineVertical;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 5]);

      const now = Date.now();
      const visibleTimeRangeSeconds = chartWidth / pixelsPerSecond + 60;
      const lowestTimeLevel = now - (visibleTimeRangeSeconds * 1000) / 2;
      const highestTimeLevel = now + visibleTimeRangeSeconds * 1000;

      const lowestTimeRounded =
        Math.floor(lowestTimeLevel / (GRID_X_SECONDS * 1000)) * (GRID_X_SECONDS * 1000);
      const highestTimeRounded =
        Math.ceil(highestTimeLevel / (GRID_X_SECONDS * 1000)) * (GRID_X_SECONDS * 1000);

      for (
        let timestamp = lowestTimeRounded;
        timestamp <= highestTimeRounded;
        timestamp += GRID_X_SECONDS * 1000
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

          ctx.fillStyle = CHART_COLORS.textSecondary;
          ctx.font = '9px monospace';
          const textWidth = ctx.measureText(timeLabel).width;

          if (x - textWidth / 2 >= 0 && x + textWidth / 2 <= chartWidth) {
            ctx.fillText(timeLabel, x - textWidth / 2, chartHeight + 18);
          }
        }
      }

      ctx.setLineDash([]);

      // Draw grid cells with hover and selection
      let currentHoveredCell: string | null = null;

      for (
        let priceLevelRaw = lowestPriceLevel;
        priceLevelRaw <= highestPriceLevel;
        priceLevelRaw += GRID_Y_DOLLARS
      ) {
        const priceLevel = parseFloat(priceLevelRaw.toFixed(2));
        const yTop = priceToY(priceLevel + GRID_Y_DOLLARS);
        const yBottom = priceToY(priceLevel);

        for (
          let timestamp = lowestTimeRounded;
          timestamp <= highestTimeRounded;
          timestamp += GRID_X_SECONDS * 1000
        ) {
          const xLeft = timeToX(timestamp);
          const xRight = timeToX(timestamp + GRID_X_SECONDS * 1000);

          if (xRight < -10 || xLeft > chartWidth + 10) continue;

          const boxWidth = xRight - xLeft;
          const boxHeight = Math.abs(yBottom - yTop);

          const cellId = generateCellId(timestamp, priceLevel);

          if (
            mousePos &&
            mousePos.x >= xLeft &&
            mousePos.x <= xRight &&
            mousePos.y >= yTop &&
            mousePos.y <= yBottom &&
            mousePos.x <= chartWidth &&
            mousePos.y <= chartHeight
          ) {
            currentHoveredCell = cellId;
          }

          const isSelected = selectedCells.has(cellId);
          const isHovered = hoveredCell === cellId;

          if (isSelected) {
            ctx.fillStyle = CHART_COLORS.selectedCell;
            ctx.fillRect(xLeft, yTop, boxWidth, boxHeight);

            ctx.strokeStyle = CHART_COLORS.selectedCellBorder;
            ctx.lineWidth = 2;
            ctx.strokeRect(xLeft, yTop, boxWidth, boxHeight);

            const targetPrice = priceLevel;
            const targetTime = Math.floor(timestamp / 1000);
            const entryPrice =
              priceHistory.length > 0 ? priceHistory[priceHistory.length - 1].price : currentPrice;
            const entryTime = Math.floor(Date.now() / 1000);
            const mult = calculateMultiplier(entryPrice, targetPrice, entryTime, targetTime);

            const displayPrice = priceLevel + GRID_Y_DOLLARS / 2;
            const centerX = xLeft + boxWidth / 2;
            const centerY = yTop + boxHeight / 2;

            ctx.font = 'bold 14px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
            ctx.shadowBlur = 6;

            ctx.fillStyle = CHART_COLORS.textPrimary;
            ctx.fillText(`${(mult / 100).toFixed(2)}x`, centerX, centerY - 8);

            ctx.font = '600 12px monospace';
            const decimals = getPriceDecimals(symbol);
            ctx.fillText(`$${displayPrice.toFixed(decimals)}`, centerX, centerY + 8);

            ctx.shadowBlur = 0;
            ctx.textAlign = 'left';
            ctx.textBaseline = 'alphabetic';
          } else if (isHovered && !isDragging) {
            ctx.fillStyle = CHART_COLORS.hoveredCell;
            ctx.fillRect(xLeft, yTop, boxWidth, boxHeight);

            ctx.strokeStyle = CHART_COLORS.hoveredCellBorder;
            ctx.lineWidth = 1;
            ctx.strokeRect(xLeft, yTop, boxWidth, boxHeight);
          }
        }
      }

      // Update hovered cell state
      if (currentHoveredCell !== hoveredCell) {
        setHoveredCell(currentHoveredCell);

        if (currentHoveredCell && priceHistory.length > 0) {
          const { timestamp: targetTime, priceLevel: targetPrice } =
            parseCellId(currentHoveredCell);
          const entryPrice = priceHistory[priceHistory.length - 1].price;
          const entryTime = Math.floor(Date.now() / 1000);

          const multiplier = calculateMultiplier(entryPrice, targetPrice, entryTime, targetTime);

          setHoveredCellInfo({
            targetPrice,
            targetTime,
            multiplier,
          });
        } else {
          setHoveredCellInfo(null);
        }
      }

      // Draw price line with gradient
      if (priceHistory.length > 1) {
        ctx.beginPath();
        let firstPoint = true;
        let lastX = 0;

        for (let i = 0; i < priceHistory.length; i++) {
          const point = priceHistory[i];
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
        gradient.addColorStop(0, CHART_COLORS.priceLineGradientTop);
        gradient.addColorStop(1, CHART_COLORS.priceLineGradientBottom);
        ctx.fillStyle = gradient;
        ctx.fill();
      }

      // Draw price line
      ctx.strokeStyle = CHART_COLORS.priceLine;
      ctx.lineWidth = 2;
      ctx.beginPath();

      let firstPoint = true;
      for (let i = 0; i < priceHistory.length; i++) {
        const point = priceHistory[i];
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

      // Draw current price indicator
      if (priceHistory.length > 0) {
        const latestPoint = priceHistory[priceHistory.length - 1];
        const currentPriceY = priceToY(latestPoint.price);
        const latestX = timeToX(latestPoint.time);

        ctx.fillStyle = CHART_COLORS.priceIndicator;
        ctx.beginPath();
        ctx.arc(latestX, currentPriceY, 4, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = CHART_COLORS.priceIndicatorBorder;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(latestX, currentPriceY, 4, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Draw NOW line
      ctx.strokeStyle = CHART_COLORS.nowLine;
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(nowX, 0);
      ctx.lineTo(nowX, chartHeight);
      ctx.stroke();
      ctx.setLineDash([]);

      animationFrameRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [
    priceHistory,
    dimensions,
    scrollOffset,
    verticalOffset,
    selectedCells,
    hoveredCell,
    mousePos,
    isDragging,
    symbol,
    currentPrice,
  ]);

  // Mouse handlers
  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      setIsDragging(true);
      setHasMoved(false);
      setDragStartX(e.clientX);
      setDragStartY(e.clientY);
      setDragStartScrollOffset(scrollOffset);
      setDragStartVerticalOffset(verticalOffset);
    },
    [scrollOffset, verticalOffset],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!canvasRef.current) return;

      const canvas = canvasRef.current;
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const mouseX = (e.clientX - rect.left) * scaleX;
      const mouseY = (e.clientY - rect.top) * scaleY;

      setMousePos({ x: mouseX, y: mouseY });

      if (isDragging) {
        e.preventDefault();

        const deltaX = dragStartX - e.clientX;
        const deltaY = dragStartY - e.clientY;

        if (Math.abs(deltaX) > DRAG_THRESHOLD_PIXELS || Math.abs(deltaY) > DRAG_THRESHOLD_PIXELS) {
          setHasMoved(true);
          setScrollOffset(dragStartScrollOffset + deltaX);
          setVerticalOffset(dragStartVerticalOffset - deltaY);
        }
      }
    },
    [isDragging, dragStartX, dragStartY, dragStartScrollOffset, dragStartVerticalOffset],
  );

  const handleMouseUp = useCallback(
    async (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (isDragging && !hasMoved && hoveredCell) {
        if (isPlacingBet) {
          toast.error('Please wait, placing bet...');
          return;
        }

        const { timestamp: gridStartTime, priceLevel: gridBottomPrice } = parseCellId(hoveredCell);
        const targetTime = gridStartTime + GRID_X_SECONDS;
        const targetPrice = gridBottomPrice + GRID_Y_DOLLARS / 2;

        const entryPrice =
          priceHistory.length > 0 ? priceHistory[priceHistory.length - 1].price : currentPrice;
        const entryTime = gridStartTime;

        const now = Math.floor(Date.now() / 1000);
        if (targetTime < now + 10) {
          toast.error('Target must be at least 10 seconds in the future');
          return;
        }

        setSelectedCells((prev) => {
          const newSet = new Set(prev);
          if (newSet.has(hoveredCell)) {
            newSet.delete(hoveredCell);
          } else {
            newSet.add(hoveredCell);
          }
          return newSet;
        });

        if (!isBinaryTradingEnabled) {
          toast.error('Please enable Binary Trading first', {
            duration: 4000,
            icon: '⚠️',
          });
          return;
        }

        const betAmount = propBetAmount || '10';

        toast.loading('Placing bet...', { id: 'place-bet' });

        try {
          await placeBetWithSession({
            symbol,
            betAmount: betAmount,
            targetPrice: targetPrice.toString(),
            targetTime: targetTime,
            entryPrice: entryPrice.toString(),
            entryTime: entryTime,
          });

          toast.success('✅ Bet placed successfully (gasless!)', { id: 'place-bet' });
        } catch (error: any) {
          console.error('Failed to place bet:', error);
          toast.error(error.message || 'Failed to place bet', { id: 'place-bet' });
        }
      }

      setIsDragging(false);
      setHasMoved(false);
    },
    [
      isDragging,
      hasMoved,
      hoveredCell,
      priceHistory,
      currentPrice,
      isPlacingBet,
      symbol,
      propBetAmount,
      isBinaryTradingEnabled,
      placeBetWithSession,
      GRID_Y_DOLLARS,
    ],
  );

  const handleMouseLeave = useCallback(() => {
    setIsDragging(false);
    setHasMoved(false);
    setHoveredCell(null);
    setMousePos(null);
    setHoveredCellInfo(null);
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();

    if (e.shiftKey) {
      const scrollAmount = e.deltaY > 0 ? 30 : -30;
      setScrollOffset((prev) => prev + scrollAmount);
    } else {
      const scrollAmount = e.deltaY > 0 ? -30 : 30;
      setVerticalOffset((prev) => prev + scrollAmount);
    }
  }, []);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <PriceDisplay symbol={symbol} currentPrice={currentPrice} />
      <HoverTooltip cellInfo={hoveredCellInfo} mousePos={mousePos} symbol={symbol} />
      <canvas
        ref={canvasRef}
        style={{
          width: '100%',
          height: '100%',
          cursor: isDragging ? 'grabbing' : 'crosshair',
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onWheel={handleWheel}
      />
    </div>
  );
};

export default PerSecondChart;
