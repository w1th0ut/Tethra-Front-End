'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { toast } from 'sonner';

interface PerSecondChartProps {
  symbol: string;
  currentPrice: number;
  betAmount?: string; // Bet amount from sidebar (optional, default 10)
  isBinaryTradingEnabled?: boolean; // Whether binary trading is enabled with session key
  tradeMode?: 'one-tap-profit' | 'open-position'; // Trade mode
  onCellClick?: (
    targetPrice: number,
    targetTime: number,
    entryPrice: number,
    entryTime: number,
  ) => void;
  isPlacingBet?: boolean;
  logoUrl?: string; // URL for the coin logo
  // Grid configuration props
  gridIntervalSeconds?: number;
  gridPriceStep?: number;
  gridAnchorPrice?: number;
  gridAnchorTime?: number;
}

interface PricePoint {
  time: number;
  price: number;
}

const PerSecondChart: React.FC<PerSecondChartProps> = ({
  symbol,
  currentPrice,
  isBinaryTradingEnabled = false,
  tradeMode = 'one-tap-profit',
  onCellClick,
  isPlacingBet = false,

  logoUrl,
  gridIntervalSeconds,
  gridPriceStep,
  gridAnchorPrice,
  gridAnchorTime,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | undefined>(undefined);
  const [priceHistory, setPriceHistory] = useState<PricePoint[]>([]); // Displayed history (delayed)
  const [rawPriceBuffer, setRawPriceBuffer] = useState<PricePoint[]>([]); // Raw data buffer (1.5 sec delay)
  const [interpolatedHistory, setInterpolatedHistory] = useState<PricePoint[]>([]); // For smooth interpolation
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [scrollOffset, setScrollOffset] = useState(0); // Horizontal scroll offset in pixels
  const [verticalOffset, setVerticalOffset] = useState(0); // Vertical scroll offset in pixels
  const wsRef = useRef<WebSocket | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartX, setDragStartX] = useState(0);
  const [dragStartY, setDragStartY] = useState(0);
  const [dragStartScrollOffset, setDragStartScrollOffset] = useState(0);
  const [dragStartVerticalOffset, setDragStartVerticalOffset] = useState(0);
  const [hasMoved, setHasMoved] = useState(false); // Track if mouse has moved during drag
  const [selectedCells, setSelectedCells] = useState<Set<string>>(new Set()); // Track selected grid cells
  const [hoveredCell, setHoveredCell] = useState<string | null>(null); // Track hovered cell
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);
  const [hoveredCellInfo, setHoveredCellInfo] = useState<{
    targetPrice: number;
    targetCenterPrice?: number; // Added for Open Position logic
    targetTime: number;
    multiplier: number;
  } | null>(null);

  // Store initial price for stable grid calculation
  const initialPriceRef = useRef<number>(0);
  const [initialPrice, setInitialPrice] = useState<number>(0);

  // For blinking effect on the circle at the end of the line
  const [blinkState, setBlinkState] = useState<boolean>(true);

  // Focus mode - automatically follow the circle at the end of the line
  const [isFocusMode, setIsFocusMode] = useState<boolean>(true); // Default to focus mode ON

  // Fixed grid configuration (tidak bisa di-zoom)
  // Use prop or default to 10 seconds
  const GRID_X_SECONDS = gridIntervalSeconds || 10;

  // Grid Y configuration
  // If gridPriceStep is provided, use it. Otherwise calculate based on initial/current price.
  const GRID_Y_DOLLARS =
    gridPriceStep || (initialPrice > 0 ? initialPrice : currentPrice) * 0.00006; // Default 0.006%
  const INTERPOLATION_INTERVAL_MS = 16.67; // 60 FPS - buttery smooth animation (16.67ms per frame)
  const DISPLAY_DELAY_MS = 2000; // 2 second delay for perfect interpolation accuracy

  // Set initial price once when component mounts or currentPrice becomes available
  useEffect(() => {
    if (currentPrice > 0 && initialPriceRef.current === 0) {
      initialPriceRef.current = currentPrice;
      setInitialPrice(currentPrice);
    }
  }, [currentPrice]);

  // Blinking effect for the circle at the end of the line (500ms interval)
  useEffect(() => {
    const blinkInterval = setInterval(() => {
      setBlinkState((prev) => !prev);
    }, 500); // Blink every 500ms

    return () => clearInterval(blinkInterval);
  }, []);

  // Auto-follow the circle at the end of the line when in focus mode
  useEffect(() => {
    if (
      !isFocusMode ||
      interpolatedHistory.length === 0 ||
      dimensions.width === 0 ||
      dimensions.height === 0
    ) {
      return;
    }

    // Use requestAnimationFrame for smooth updates
    const updateFocus = () => {
      // Calculate the target position for the circle to appear at 25% from left (like in the image)
      const chartWidth = dimensions.width - 80; // Minus right margin
      const chartHeight = dimensions.height - 30; // Minus bottom margin
      const targetX = chartWidth * 0.25; // Circle appears at 25% from left
      const nowX = chartWidth * 0.2; // NOW line is at 20%

      // Get the latest point (where the circle is)
      const latestPoint = interpolatedHistory[interpolatedHistory.length - 1];
      if (!latestPoint) return;

      const now = Date.now();
      const gridSizePixels = chartHeight / 10;
      const pixelsPerSecond = gridSizePixels / GRID_X_SECONDS;

      // Calculate where the circle currently is in time
      const secondsFromNow = (latestPoint.time - now) / 1000;
      const circleCurrentX = nowX + secondsFromNow * pixelsPerSecond;

      // Calculate the scroll offset needed to move the circle to targetX
      // When scrollOffset = 0, circle is at circleCurrentX
      // We want: circleCurrentX - scrollOffset = targetX
      // So: scrollOffset = circleCurrentX - targetX
      const newScrollOffset = circleCurrentX - targetX;

      setScrollOffset(newScrollOffset);

      // Update vertical offset to keep current price centered
      // Grid Y uses initialPrice as anchor, so offset tracks price movement relative to initial price
      const latestPrice = latestPoint.price;
      const priceAnchor = initialPrice > 0 ? initialPrice : currentPrice;

      const pixelsPerDollar = gridSizePixels / GRID_Y_DOLLARS;

      // Calculate vertical offset to center current price
      // Since grid is anchored to initialPrice, offset = (currentPrice - initialPrice) * pixelsPerDollar
      const priceDiff = latestPrice - priceAnchor;
      const newVerticalOffset = priceDiff * pixelsPerDollar;

      setVerticalOffset(newVerticalOffset);
    };

    updateFocus();
  }, [interpolatedHistory, isFocusMode, dimensions, GRID_X_SECONDS, initialPrice, currentPrice]);

  // Calculate multiplier (matches smart contract logic)
  const calculateMultiplier = useCallback(
    (entryPrice: number, targetPrice: number, entryTime: number, targetTime: number): number => {
      // Calculate price distance percentage (in basis points)
      let priceDistance;
      if (targetPrice > entryPrice) {
        priceDistance = ((targetPrice - entryPrice) * 10000) / entryPrice;
      } else {
        priceDistance = ((entryPrice - targetPrice) * 10000) / entryPrice;
      }

      // Calculate time distance in seconds
      const timeDistance = targetTime > entryTime ? targetTime - entryTime : 0;

      // Combined distance factor: price (60%) + time (40%)
      // Each 1% price distance adds 0.02x (2 points)
      // Each 10 seconds adds 0.01x (1 point)
      const priceComponent = (priceDistance * 60) / 10000; // 0.6% per 1% price distance
      const timeComponent = (timeDistance * 40) / (10 * 100); // 0.4% per 10 seconds

      // Multiplier = BASE_MULTIPLIER + combined distance
      // Minimum 1.1x, scales up with distance
      let multiplier = 110 + priceComponent + timeComponent;

      // Cap maximum multiplier at 10x (1000 points)
      if (multiplier > 1000) {
        multiplier = 1000;
      }

      return multiplier;
    },
    [],
  );

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

  // Connect to Pyth Oracle WebSocket for real-time price updates
  useEffect(() => {
    // Mapping symbol to Pyth price feed IDs
    const pythPriceIds: { [key: string]: string } = {
      BTC: '0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43',
      ETH: '0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace',
      SOL: '0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d',
      AVAX: '0x93da3352f9f1d105fdfe4971cfa80e9dd777bfc5d0f683ebb6e1294b92137bb7',
      NEAR: '0xc415de8d2eba7db216527dff4b60e8f3a5311c740dadb233e13e12547e226750',
      BNB: '0x2f95862b045670cd22bee3114c39763a4a08beeb663b145d283c31d7d1101c4f',
      XRP: '0xec5d399846a9209f3fe5881d70aae9268c94339ff9817e8d18ff19fa05eea1c8',
      // Add more as needed
    };

    const priceId = pythPriceIds[symbol];
    if (!priceId) {
      console.warn(`No Pyth price feed for ${symbol}`);
      return;
    }

    try {
      const ws = new WebSocket('wss://hermes.pyth.network/ws');

      ws.onopen = () => {
        // Subscribe to price feed
        ws.send(
          JSON.stringify({
            type: 'subscribe',
            ids: [priceId],
          }),
        );
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);

          if (message.type === 'price_update' && message.price_feed) {
            const priceFeed = message.price_feed;
            const priceData = priceFeed.price;

            const priceRaw = parseFloat(priceData.price);
            const expo = priceData.expo;
            const price = priceRaw * Math.pow(10, expo);
            const timestamp = Date.now();

            // Add to RAW BUFFER (not displayed immediately)
            setRawPriceBuffer((prev) => {
              const newBuffer = [...prev, { time: timestamp, price }];
              // Keep only last 5 minutes + delay buffer
              const cutoffTime = timestamp - 300000 - DISPLAY_DELAY_MS;
              return newBuffer.filter((p) => p.time >= cutoffTime);
            });
          }
        } catch (error) {
          console.error('Error parsing Pyth message:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('Pyth WebSocket error:', error);
      };

      ws.onclose = () => {};

      wsRef.current = ws;

      return () => {
        if (wsRef.current) {
          wsRef.current.close();
          wsRef.current = null;
        }
      };
    } catch (error) {
      console.error('Failed to connect to Pyth WebSocket:', error);
    }
  }, [symbol]);

  // Add current price from props to buffer (fallback if WebSocket slow)
  useEffect(() => {
    if (currentPrice > 0) {
      setRawPriceBuffer((prev) => {
        const now = Date.now();
        // Only add if last update was more than 500ms ago (2 updates per second max)
        const lastUpdate = prev.length > 0 ? prev[prev.length - 1].time : 0;
        if (now - lastUpdate > 500) {
          const newBuffer = [...prev, { time: now, price: currentPrice }];
          const cutoffTime = now - 300000 - DISPLAY_DELAY_MS;
          return newBuffer.filter((p) => p.time >= cutoffTime);
        }
        return prev;
      });
    }
  }, [currentPrice, DISPLAY_DELAY_MS]);

  // Process buffer with delay - move data from rawPriceBuffer to priceHistory
  // This ensures we always have "future" data for perfect interpolation!
  useEffect(() => {
    const processTimer = setInterval(() => {
      const now = Date.now();
      const displayTime = now - DISPLAY_DELAY_MS; // Show data from 1.5 seconds ago

      setRawPriceBuffer((currentBuffer) => {
        // Get all data that should be displayed now (older than delay)
        const readyData = currentBuffer.filter((p) => p.time <= displayTime);

        if (readyData.length > 0) {
          // Add ready data to display history
          setPriceHistory((prev) => {
            const combined = [...prev, ...readyData];
            // Remove duplicates based on time
            const unique = combined.filter(
              (item, index, self) => index === self.findIndex((t) => t.time === item.time),
            );
            // Sort by time and keep last 5 minutes
            const sorted = unique.sort((a, b) => a.time - b.time);
            const cutoffTime = now - 300000;
            return sorted.filter((p) => p.time >= cutoffTime);
          });
        }

        // Keep only future data in buffer
        return currentBuffer.filter((p) => p.time > displayTime);
      });
    }, 100); // Check every 100ms

    return () => clearInterval(processTimer);
  }, [DISPLAY_DELAY_MS]);

  // Live interpolation - 60 FPS smooth animation with perfect buffer-based calculation
  // Each frame calculated from buffer = ZERO ambiguity, ZERO jumps!
  useEffect(() => {
    if (priceHistory.length < 1 && rawPriceBuffer.length < 1) {
      setInterpolatedHistory([]);
      return;
    }

    // Use requestAnimationFrame for smooth 60 FPS rendering
    let lastUpdateTime = Date.now();
    let animationId: number;

    const updateInterpolation = () => {
      const now = Date.now();
      const displayTime = now - DISPLAY_DELAY_MS; // 2 seconds behind real-time

      // Only update if enough time passed (16.67ms for 60 FPS)
      if (now - lastUpdateTime < INTERPOLATION_INTERVAL_MS) {
        animationId = requestAnimationFrame(updateInterpolation);
        return;
      }
      lastUpdateTime = now;

      // Combine ALL data (past + future buffer) for perfect interpolation
      const allData = [...priceHistory, ...rawPriceBuffer].sort((a, b) => a.time - b.time);

      // Remove duplicates
      const uniqueData = allData.filter(
        (item, index, self) => index === self.findIndex((t) => Math.abs(t.time - item.time) < 10),
      );

      if (uniqueData.length < 2) {
        if (uniqueData.length === 1) {
          setInterpolatedHistory(uniqueData);
        }
        animationId = requestAnimationFrame(updateInterpolation);
        return;
      }

      const interpolated: PricePoint[] = [];

      // Generate interpolated frames at EXACTLY 16.67ms intervals
      // Start from oldest data point
      const startTime = uniqueData[0].time;
      const endTime = displayTime;

      // Calculate all frames from start to current display time
      let currentFrameTime = startTime;

      while (currentFrameTime <= endTime) {
        // Find the two data points that bracket this frame time
        let beforePoint = uniqueData[0];
        let afterPoint = uniqueData[uniqueData.length - 1];

        for (let i = 0; i < uniqueData.length - 1; i++) {
          if (uniqueData[i].time <= currentFrameTime && uniqueData[i + 1].time > currentFrameTime) {
            beforePoint = uniqueData[i];
            afterPoint = uniqueData[i + 1];
            break;
          }
        }

        // Perfect linear interpolation between the two points
        const timeDiff = afterPoint.time - beforePoint.time;
        const priceDiff = afterPoint.price - beforePoint.price;
        const progress = timeDiff > 0 ? (currentFrameTime - beforePoint.time) / timeDiff : 0;
        const interpolatedPrice = beforePoint.price + priceDiff * progress;

        interpolated.push({
          time: currentFrameTime,
          price: interpolatedPrice,
        });

        // Move to next frame (exactly 16.67ms later)
        currentFrameTime += INTERPOLATION_INTERVAL_MS;
      }

      // Ensure we have the exact current display time point
      if (
        interpolated.length === 0 ||
        Math.abs(interpolated[interpolated.length - 1].time - displayTime) > 1
      ) {
        let beforePoint = uniqueData[0];
        let afterPoint = uniqueData[uniqueData.length - 1];

        for (let i = 0; i < uniqueData.length - 1; i++) {
          if (uniqueData[i].time <= displayTime && uniqueData[i + 1].time > displayTime) {
            beforePoint = uniqueData[i];
            afterPoint = uniqueData[i + 1];
            break;
          }
        }

        const timeDiff = afterPoint.time - beforePoint.time;
        const priceDiff = afterPoint.price - beforePoint.price;
        const progress = timeDiff > 0 ? (displayTime - beforePoint.time) / timeDiff : 0;
        const currentPrice = beforePoint.price + priceDiff * progress;

        interpolated.push({
          time: displayTime,
          price: currentPrice,
        });
      }

      // Keep only recent data (last 5 minutes)
      const cutoffTime = now - 300000;
      const filtered = interpolated.filter((p) => p.time >= cutoffTime);

      setInterpolatedHistory(filtered);
      animationId = requestAnimationFrame(updateInterpolation);
    };

    animationId = requestAnimationFrame(updateInterpolation);

    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
    };
  }, [priceHistory, rawPriceBuffer, INTERPOLATION_INTERVAL_MS, DISPLAY_DELAY_MS]);

  // Handle keyboard controls (C to toggle focus mode, arrow keys for manual adjustment)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const scrollStep = 50; // pixels per key press

      switch (e.key.toLowerCase()) {
        case 'arrowleft':
          e.preventDefault();
          setIsFocusMode(false); // Disable focus mode when manually scrolling
          setScrollOffset((prev) => prev - scrollStep);
          break;
        case 'arrowright':
          e.preventDefault();
          setIsFocusMode(false); // Disable focus mode when manually scrolling
          setScrollOffset((prev) => prev + scrollStep);
          break;
        case 'arrowup':
          e.preventDefault();
          setIsFocusMode(false); // Disable focus mode when manually scrolling
          // Arrow up = see higher prices (chart moves down)
          setVerticalOffset((prev) => prev + scrollStep);
          break;
        case 'arrowdown':
          e.preventDefault();
          setIsFocusMode(false); // Disable focus mode when manually scrolling
          // Arrow down = see lower prices (chart moves up)
          setVerticalOffset((prev) => prev - scrollStep);
          break;
        case 'c':
          e.preventDefault();
          // Toggle focus mode on/off
          setIsFocusMode((prev) => {
            const newValue = !prev;
            return newValue;
          });
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Drawing function
  useEffect(() => {
    if (!canvasRef.current || dimensions.width === 0 || interpolatedHistory.length === 0) {
      return;
    }

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const draw = () => {
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

      // Calculate grid square size - START FROM GRID SIZE to ensure perfect squares
      // More zoom out - fit more grids vertically for better overview
      const targetVerticalGrids = 10; // Increased from 6 to show more grids
      const gridSizePixels = chartHeight / targetVerticalGrids; // Square size in pixels

      // Y-axis: each grid = $10
      const pixelsPerDollar = gridSizePixels / GRID_Y_DOLLARS;

      // Calculate price range to display based on grid size
      const priceRangeToShow = chartHeight / pixelsPerDollar;

      // Use INITIAL PRICE as anchor point for STABLE GRID (never changes)
      // This price anchor is FIXED and determines where grid lines are drawn
      const priceAnchor = initialPrice > 0 ? initialPrice : currentPrice;

      // Base display range centered on price anchor (FIXED - for grid calculation)
      const baseDisplayMinPrice = priceAnchor - priceRangeToShow / 2;
      const baseDisplayMaxPrice = priceAnchor + priceRangeToShow / 2;

      // Apply vertical offset for panning (only affects line rendering, NOT grid)
      const verticalPriceShift = verticalOffset / pixelsPerDollar;
      const displayMinPrice = baseDisplayMinPrice + verticalPriceShift;
      const displayMaxPrice = baseDisplayMaxPrice + verticalPriceShift;

      // X-axis: make grid squares (same height and width)
      const gridWidthPixels = gridSizePixels; // Square grids - same as height
      const pixelsPerSecond = gridWidthPixels / GRID_X_SECONDS;

      // Helper functions
      const priceToY = (price: number): number => {
        return (
          chartHeight -
          ((price - displayMinPrice) / (displayMaxPrice - displayMinPrice)) * chartHeight
        );
      };

      // NOW line position - 20% from left (more space on right for future data)
      const nowX = chartWidth * 0.2;

      const timeToX = (timestamp: number): number => {
        const now = Date.now();
        const secondsFromNow = (timestamp - now) / 1000;
        return nowX + secondsFromNow * pixelsPerSecond - scrollOffset;
      };

      // Draw horizontal grid lines (price levels - FIXED positions based on initial price)
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)'; // Increased opacity from 0.1 to 0.25
      ctx.lineWidth = 1.5; // Increased from 1 to 1.5
      ctx.setLineDash([5, 5]); // Dashed line: 5px dash, 5px gap

      // Grid lines are at FIXED ABSOLUTE price levels (multiples of GRID_Y_DOLLARS)
      // IMPORTANT: Use LARGE FIXED RANGE based on initial price to ensure grid lines don't change
      // Render MANY grids (enough to cover all possible panning scenarios)
      const largeBufferGrids = 50; // Render 50 grids above and below base range

      // Calculate fixed range based on BASE display (without offset) for STABLE grid lines
      // Calculate fixed range based on BASE display (without offset) for STABLE grid lines
      let lowestPriceLevel: number;

      const priceDecimals =
        GRID_Y_DOLLARS < 0.0001 ? 6 : GRID_Y_DOLLARS < 0.01 ? 4 : GRID_Y_DOLLARS < 1 ? 2 : 1;

      if (gridAnchorPrice !== undefined) {
        // Align to anchor price
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
        // Default alignment (mulitples of step)
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

        // Price label - dynamic decimals based on GRID_Y_DOLLARS
        ctx.fillStyle = '#94a3b8';
        ctx.font = '11px monospace';
        // Determine decimals based on GRID_Y_DOLLARS
        ctx.fillText(`$${price.toFixed(priceDecimals)}`, chartWidth + 5, y + 4);
      }
      ctx.setLineDash([]);

      // Draw vertical grid lines (time - 1 second increments)
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)'; // Increased opacity from 0.05 to 0.2
      ctx.lineWidth = 1.5; // Increased from 1 to 1.5
      ctx.setLineDash([5, 5]); // Dashed line: 5px dash, 5px gap

      const now = Date.now();

      // Calculate visible time range based on chart width and pixels per second
      const visibleTimeRangeSeconds = chartWidth / pixelsPerSecond + 60; // Add buffer
      const lowestTimeLevel = now - (visibleTimeRangeSeconds * 1000) / 2;
      const highestTimeLevel = now + visibleTimeRangeSeconds * 1000;

      // Round to nearest grid boundary
      let lowestTimeRounded: number;
      if (gridAnchorTime !== undefined) {
        const anchorMs = gridAnchorTime * 1000;
        const stepMs = GRID_X_SECONDS * 1000;
        lowestTimeRounded = Math.floor((lowestTimeLevel - anchorMs) / stepMs) * stepMs + anchorMs;
      } else {
        lowestTimeRounded =
          Math.floor(lowestTimeLevel / (GRID_X_SECONDS * 1000)) * (GRID_X_SECONDS * 1000);
      }

      const highestTimeRounded =
        lowestTimeRounded +
        Math.ceil((highestTimeLevel - lowestTimeRounded) / (GRID_X_SECONDS * 1000)) *
          (GRID_X_SECONDS * 1000);

      for (
        let timestamp = lowestTimeRounded;
        timestamp <= highestTimeRounded;
        timestamp += GRID_X_SECONDS * 1000
      ) {
        const x = timeToX(timestamp);

        // Draw grid line if visible
        if (x >= -10 && x <= chartWidth + 10) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, chartHeight);
          ctx.stroke();

          // Time label - show EVERY 1 second (60 labels per minute)
          const date = new Date(timestamp);
          const timeLabel = `${String(date.getHours()).padStart(2, '0')}:${String(
            date.getMinutes(),
          ).padStart(2, '0')}:${String(date.getSeconds()).padStart(2, '0')}`;

          ctx.fillStyle = '#94a3b8';
          ctx.font = '9px monospace';
          const textWidth = ctx.measureText(timeLabel).width;

          // Only draw label if it's visible in the chart area
          if (x - textWidth / 2 >= 0 && x + textWidth / 2 <= chartWidth) {
            ctx.fillText(timeLabel, x - textWidth / 2, chartHeight + 18);
          }
        }
      }

      // Reset line dash to solid for other drawings
      ctx.setLineDash([]);

      // Draw grid cells (clickable areas) with hover and selection states
      let currentHoveredCell: string | null = null;

      for (
        let priceLevelRaw = lowestPriceLevel;
        priceLevelRaw <= highestPriceLevel;
        priceLevelRaw += GRID_Y_DOLLARS
      ) {
        // Round to avoid floating point precision issues
        const priceLevel = parseFloat(priceLevelRaw.toFixed(priceDecimals));
        const yTop = priceToY(priceLevel + GRID_Y_DOLLARS);
        const yBottom = priceToY(priceLevel);

        for (
          let timestamp = lowestTimeRounded;
          timestamp <= highestTimeRounded;
          timestamp += GRID_X_SECONDS * 1000
        ) {
          const xLeft = timeToX(timestamp);
          const xRight = timeToX(timestamp + GRID_X_SECONDS * 1000);

          // Skip if not visible
          if (xRight < -10 || xLeft > chartWidth + 10) continue;

          const boxWidth = xRight - xLeft;
          const boxHeight = Math.abs(yBottom - yTop);

          // Create cell ID with consistent formatting
          // Use toFixed to ensure consistent decimal representation
          const cellId = `${Math.floor(timestamp / 1000)}_${priceLevel.toFixed(priceDecimals)}`;

          // Check if mouse is hovering over this cell
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

          // Draw cell background based on state
          const isSelected = selectedCells.has(cellId);
          const isHovered = hoveredCell === cellId;

          // Define color based on trade mode and position relative to price
          let cellColor = '59, 130, 246'; // Default Blue
          let isLong = false;

          if (tradeMode === 'open-position') {
            const cellCenterPrice = priceLevel + GRID_Y_DOLLARS / 2;
            const currentPriceVal =
              priceHistory.length > 0 ? priceHistory[priceHistory.length - 1].price : currentPrice;
            isLong = cellCenterPrice < currentPriceVal; // Grid below price = LONG
            cellColor = isLong ? '34, 197, 94' : '239, 68, 68'; // Green : Red
          }

          if (isSelected) {
            // Selected cell - filled
            ctx.fillStyle = `rgba(${cellColor}, 0.3)`;
            ctx.fillRect(xLeft, yTop, boxWidth, boxHeight);

            // Border
            ctx.strokeStyle = `rgba(${cellColor}, 0.8)`;
            ctx.lineWidth = 2;
            ctx.strokeRect(xLeft, yTop, boxWidth, boxHeight);

            // Calculate multiplier and price for this cell
            // Use same logic as hover calculation
            const targetPrice = priceLevel; // Bottom of grid (same as hover)
            const targetTime = Math.floor(timestamp / 1000); // Start time of grid (same as hover)
            const entryPrice =
              priceHistory.length > 0 ? priceHistory[priceHistory.length - 1].price : currentPrice;
            const entryTime = Math.floor(Date.now() / 1000); // Current time (same as hover)
            const mult = calculateMultiplier(entryPrice, targetPrice, entryTime, targetTime);

            // Display center price for visual clarity
            const displayPrice = priceLevel + GRID_Y_DOLLARS / 2;

            // Display multiplier in the center of selected cell
            const centerX = xLeft + boxWidth / 2;
            const centerY = yTop + boxHeight / 2;

            // Draw multiplier text
            ctx.font = 'bold 14px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            // Text shadow for better visibility
            ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
            ctx.shadowBlur = 6;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 0;

            if (tradeMode === 'open-position') {
              // Just color of grid, no text inside (User Request)
              // ctx.fillStyle = isLong ? '#22c55e' : '#ef4444';
              // ctx.fillText(isLong ? 'LONG' : 'SHORT', centerX, centerY - 8);
            } else {
              ctx.fillStyle = '#ffffff';
              ctx.fillText(`${(mult / 100).toFixed(2)}x`, centerX, centerY - 8);
            }

            // Draw price text
            ctx.font = '600 12px monospace';
            ctx.fillStyle = '#ffffff';
            const decimals = symbol === 'SOL' ? 1 : 0;
            // Only show price if not open position or just show it small?
            // "just color of grid" -> maybe hide price too?
            // User complained about "text is long" (the LONG/SHORT text).
            // Usually price is helpful. I'll keep price for now unless they meant "completely empty box".
            // "just color of grid" usually implies the status.
            ctx.fillText(`$${displayPrice.toFixed(decimals)}`, centerX, centerY + 8);

            // Reset shadow
            ctx.shadowBlur = 0;
            ctx.textAlign = 'left';
            ctx.textBaseline = 'alphabetic';
          } else if (isHovered && !isDragging) {
            // Hovered cell - highlight
            ctx.fillStyle = `rgba(${cellColor}, 0.15)`;
            ctx.fillRect(xLeft, yTop, boxWidth, boxHeight);

            // Border
            ctx.strokeStyle = `rgba(${cellColor}, 0.5)`;
            ctx.lineWidth = 1;
            ctx.strokeRect(xLeft, yTop, boxWidth, boxHeight);
          }
        }
      }

      // Update hovered cell state and calculate multiplier
      if (currentHoveredCell !== hoveredCell) {
        setHoveredCell(currentHoveredCell);

        if (currentHoveredCell && priceHistory.length > 0) {
          // Parse cell ID: "timestamp_priceLevel"
          const [timestampStr, priceLevelStr] = currentHoveredCell.split('_');
          const targetTime = parseInt(timestampStr);
          const targetPrice = parseFloat(priceLevelStr);
          const entryPrice = priceHistory[priceHistory.length - 1].price;
          const entryTime = Math.floor(Date.now() / 1000);

          // Calculate multiplier
          // Use center price for accurate calculation in open position mode logic
          const targetCenterPrice = targetPrice + GRID_Y_DOLLARS / 2;
          const multiplier = calculateMultiplier(entryPrice, targetPrice, entryTime, targetTime);

          setHoveredCellInfo({
            targetPrice,
            targetCenterPrice, // pass center price for tooltip logic
            targetTime,
            multiplier,
          });
        } else {
          setHoveredCellInfo(null);
        }
      }

      // Draw price line chart with gradient fill - neon green color with glow effect
      // Using interpolatedHistory for smooth 100ms animation

      // First, draw filled area under the line
      if (interpolatedHistory.length > 1) {
        ctx.beginPath();
        let firstPoint = true;
        let lastX = 0;

        for (let i = 0; i < interpolatedHistory.length; i++) {
          const point = interpolatedHistory[i];
          const x = timeToX(point.time);
          const y = priceToY(point.price);

          if (x >= -50 && x <= chartWidth + 50) {
            if (firstPoint) {
              ctx.moveTo(x, chartHeight); // Start from bottom
              ctx.lineTo(x, y);
              firstPoint = false;
            } else {
              ctx.lineTo(x, y);
            }
            lastX = x;
          }
        }

        // Close the path to bottom
        ctx.lineTo(lastX, chartHeight);
        ctx.closePath();

        // Create gradient fill - neon green with transparency
        const gradient = ctx.createLinearGradient(0, 0, 0, chartHeight);
        gradient.addColorStop(0, 'rgba(0, 255, 65, 0.25)'); // Neon green with transparency
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0.05)'); // Fade to transparent at bottom
        ctx.fillStyle = gradient;
        ctx.fill();
      }

      // Then draw the line on top with neon glow effect
      ctx.strokeStyle = '#00ff41'; // Neon green color
      ctx.lineWidth = 3; // Thicker line
      ctx.shadowColor = '#00ff41'; // Neon green glow
      ctx.shadowBlur = 10; // Glow intensity
      ctx.beginPath();

      let firstPoint = true;
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

      // Reset shadow after drawing the line
      ctx.shadowBlur = 0;
      ctx.shadowColor = 'transparent';

      // Draw current price indicator (blinking circle at line end with neon effect)
      if (interpolatedHistory.length > 0) {
        const latestPoint = interpolatedHistory[interpolatedHistory.length - 1];
        const currentPriceY = priceToY(latestPoint.price);
        const latestX = timeToX(latestPoint.time);

        // Only draw the circle if blinkState is true (blinking effect)
        if (blinkState) {
          // If focus mode is ON, draw larger outer ring
          if (isFocusMode) {
            ctx.strokeStyle = 'rgba(0, 255, 65, 0.4)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(latestX, currentPriceY, 12, 0, Math.PI * 2);
            ctx.stroke();
          }

          // Outer glow circle (neon effect)
          ctx.fillStyle = 'rgba(0, 255, 65, 0.3)';
          ctx.beginPath();
          ctx.arc(latestX, currentPriceY, 8, 0, Math.PI * 2);
          ctx.fill();

          // Middle glow
          ctx.fillStyle = 'rgba(0, 255, 65, 0.6)';
          ctx.beginPath();
          ctx.arc(latestX, currentPriceY, 5, 0, Math.PI * 2);
          ctx.fill();

          // Inner bright circle (neon green)
          ctx.fillStyle = '#00ff41';
          ctx.shadowColor = '#00ff41';
          ctx.shadowBlur = 15;
          ctx.beginPath();
          ctx.arc(latestX, currentPriceY, 3, 0, Math.PI * 2);
          ctx.fill();

          // White center dot
          ctx.shadowBlur = 0;
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(latestX, currentPriceY, 1.5, 0, Math.PI * 2);
          ctx.fill();
        }

        // Reset shadow
        ctx.shadowBlur = 0;
        ctx.shadowColor = 'transparent';
      }

      // Draw "NOW" line (vertical line at nowX position)
      ctx.strokeStyle = 'rgba(100, 100, 100, 0.5)';
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
    interpolatedHistory,
    dimensions,
    scrollOffset,
    verticalOffset,
    selectedCells,
    hoveredCell,
    mousePos,
    isDragging,
    calculateMultiplier,
    blinkState,
    GRID_Y_DOLLARS,
    currentPrice,
    priceHistory,
    symbol,
    isFocusMode,
    initialPrice,
  ]);

  // Mouse drag handlers for panning (horizontal AND vertical)
  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      e.preventDefault(); // Prevent text selection
      setIsDragging(true);
      setHasMoved(false); // Reset movement flag
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

        // Both horizontal and vertical movement
        const deltaX = dragStartX - e.clientX;
        const deltaY = dragStartY - e.clientY;

        // Check if moved significantly (more than 5 pixels)
        if (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5) {
          setHasMoved(true);
          setIsFocusMode(false); // Disable focus mode when user drags
          setScrollOffset(dragStartScrollOffset + deltaX);
          // Invert vertical: drag up = chart goes down (see lower prices)
          setVerticalOffset(dragStartVerticalOffset - deltaY);
        }
      }
    },
    [isDragging, dragStartX, dragStartY, dragStartScrollOffset, dragStartVerticalOffset],
  );

  const handleMouseUp = useCallback(
    async (e: React.MouseEvent<HTMLCanvasElement>) => {
      // If didn't move, treat as click
      if (isDragging && !hasMoved && hoveredCell) {
        // Don't place bet if already placing one
        if (isPlacingBet) {
          toast.error('Please wait, placing bet...');
          return;
        }

        // Parse cell ID: "timestamp_priceLevel" (priceLevel is bottom of grid)
        const [timestampStr, priceLevelStr] = hoveredCell.split('_');
        const gridStartTime = parseInt(timestampStr); // Start of grid cell (left edge)
        const gridBottomPrice = parseFloat(priceLevelStr);

        // Use END time of grid cell as targetTime
        // Grid cell spans GRID_X_SECONDS (10 seconds)
        const targetTime = gridStartTime + GRID_X_SECONDS;

        // Use CENTER of grid cell as target price
        // Grid cell spans from gridBottomPrice to (gridBottomPrice + GRID_Y_DOLLARS)
        const targetPrice = gridBottomPrice + GRID_Y_DOLLARS / 2;

        // Get current price from latest price history
        const entryPrice =
          priceHistory.length > 0 ? priceHistory[priceHistory.length - 1].price : currentPrice;

        // Use grid START time as entry time (not current time)
        // This ensures bet time range matches the grid cell time range
        const entryTime = gridStartTime;

        // Check if target is at least 10 seconds in the future
        const now = Math.floor(Date.now() / 1000);
        if (targetTime < now + 10) {
          toast.error('Target must be at least 10 seconds in the future');
          return;
        }

        // Toggle cell selection for visual feedback
        setSelectedCells((prev) => {
          const newSet = new Set(prev);
          if (newSet.has(hoveredCell)) {
            newSet.delete(hoveredCell);
          } else {
            newSet.add(hoveredCell);
          }
          return newSet;
        });

        // Trigger callback if provided
        if (onCellClick) {
          onCellClick(targetPrice, targetTime, entryPrice, entryTime);
        } else {
          // Check if binary trading is enabled
          if (!isBinaryTradingEnabled) {
            toast.error(
              'Please enable Binary Trading first by clicking "Enable Binary Trading" button',
              {
                duration: 4000,
                icon: '⚠️',
              },
            );
            return;
          }
        }
      }

      setIsDragging(false);
      setHasMoved(false);
    },
    [
      isDragging,
      hasMoved,
      hoveredCell,
      isPlacingBet,
      GRID_Y_DOLLARS,
      priceHistory,
      currentPrice,
      onCellClick,
      isBinaryTradingEnabled,
    ],
  );

  const handleMouseLeave = useCallback(() => {
    setIsDragging(false);
    setHasMoved(false);
    setHoveredCell(null);
    setMousePos(null);
    setHoveredCellInfo(null);
  }, []);

  // Mouse wheel for both horizontal and vertical scroll
  const handleWheel = useCallback((e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();

    // Disable focus mode when user scrolls
    setIsFocusMode(false);

    // If shift is pressed, scroll horizontally
    if (e.shiftKey) {
      const scrollAmount = e.deltaY > 0 ? 30 : -30;
      setScrollOffset((prev) => prev + scrollAmount);
    } else {
      // Default: scroll vertically (inverted for natural scrolling)
      // Scroll down (deltaY positive) = see lower prices (negative offset)
      const scrollAmount = e.deltaY > 0 ? -30 : 30;
      setVerticalOffset((prev) => prev + scrollAmount);
    }
  }, []);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      {/* Price display - top left like reference */}
      <div
        style={{
          position: 'absolute',
          top: '15px',
          left: '15px',
          zIndex: 10,
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
        }}
      >
        {/* Coin logo from TrustWallet */}
        <img
          src={logoUrl}
          alt={symbol}
          style={{
            width: '32px',
            height: '32px',
            borderRadius: '50%',
          }}
          onError={(e) => {
            // Fallback to a placeholder if image fails to load
            e.currentTarget.style.display = 'none';
          }}
        />

        {/* Price */}
        <div
          style={{
            fontSize: '32px',
            fontWeight: '600',
            color: '#ffffff',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            letterSpacing: '-0.5px',
          }}
        >
          {interpolatedHistory.length > 0
            ? interpolatedHistory[interpolatedHistory.length - 1].price.toFixed(2)
            : '0.00'}
        </div>
      </div>

      {/* Instructions - bottom left */}
      <div
        style={{
          position: 'absolute',
          bottom: '45px',
          left: '15px',
          zIndex: 10,
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          borderRadius: '6px',
          padding: '6px 12px',
          border: `1px solid ${
            isFocusMode ? 'rgba(0, 255, 65, 0.5)' : 'rgba(255, 255, 255, 0.15)'
          }`,
        }}
      >
        <div
          style={{
            fontSize: '10px',
            color: isFocusMode ? '#00ff41' : '#94a3b8',
            fontFamily: 'monospace',
            lineHeight: '1.4',
          }}
        >
          {isFocusMode
            ? '🎯 Focus Mode ON • Press C to disable'
            : 'Click grid to select • Drag to pan • Press C to enable focus mode'}
        </div>
      </div>

      {/* Multiplier tooltip on hover */}
      {hoveredCellInfo && mousePos && !isDragging && (
        <div
          style={{
            position: 'absolute',
            left: `${mousePos.x + 15}px`,
            top: `${mousePos.y - 35}px`,
            zIndex: 20,
            backgroundColor: 'rgba(0, 0, 0, 0.9)',
            borderRadius: '8px',
            padding: '8px 14px',
            border: '1px solid rgba(59, 130, 246, 0.5)',
            pointerEvents: 'none',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)',
          }}
        >
          <div
            style={{
              fontSize: '16px',
              fontWeight: '700',
              color:
                tradeMode === 'open-position'
                  ? (hoveredCellInfo.targetCenterPrice || hoveredCellInfo.targetPrice) < // Use Center Price logic
                    (priceHistory.length > 0
                      ? priceHistory[priceHistory.length - 1].price
                      : currentPrice)
                    ? '#22c55e'
                    : '#ef4444'
                  : '#3b82f6',
              fontFamily: 'monospace',
              textAlign: 'center',
              marginBottom: '4px',
            }}
          >
            {tradeMode === 'open-position'
              ? (hoveredCellInfo.targetCenterPrice || hoveredCellInfo.targetPrice) < // Use Center Price logic
                (priceHistory.length > 0
                  ? priceHistory[priceHistory.length - 1].price
                  : currentPrice)
                ? 'LONG'
                : 'SHORT'
              : `${(hoveredCellInfo.multiplier / 100).toFixed(2)}x`}
          </div>
          <div
            style={{
              fontSize: '10px',
              color: '#94a3b8',
              fontFamily: 'monospace',
              whiteSpace: 'nowrap',
            }}
          >
            ${hoveredCellInfo.targetPrice.toFixed(symbol === 'SOL' ? 1 : 0)}
          </div>
        </div>
      )}

      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onWheel={handleWheel}
        onTouchStart={(e) => {
          if (e.touches.length === 1) {
            e.preventDefault();
            const touch = e.touches[0];
            setIsDragging(true);
            setHasMoved(false);
            setDragStartX(touch.clientX);
            setDragStartY(touch.clientY);
            setDragStartScrollOffset(scrollOffset);
            setDragStartVerticalOffset(verticalOffset);
          }
        }}
        onTouchMove={(e) => {
          if (isDragging && e.touches.length === 1) {
            e.preventDefault();
            const touch = e.touches[0];
            const deltaX = dragStartX - touch.clientX;
            const deltaY = touch.clientY - dragStartY; // Inverted for natural touch scrolling

            if (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5) {
              setHasMoved(true);
              setScrollOffset(dragStartScrollOffset + deltaX);
              setVerticalOffset(dragStartVerticalOffset + deltaY);
            }
          }
        }}
        onTouchEnd={async () => {
          if (isDragging && !hasMoved && hoveredCell) {
            // Treat as tap/click
            const [timestampStr, priceLevelStr] = hoveredCell.split('_');
            const timestamp = parseInt(timestampStr);
            const priceLevel = parseFloat(priceLevelStr);

            // Handle bet placement similar to mouse click
            if (!isPlacingBet) {
              const currentTime = Date.now();
              const isFuture = timestamp > currentTime;

              if (isFuture) {
                const currentPriceVal =
                  typeof currentPrice === 'string' ? parseFloat(currentPrice) : currentPrice;
                const isLong = priceLevel > currentPriceVal;
              }
            }
          }
          setIsDragging(false);
        }}
        style={{
          width: '100%',
          height: '100%',
          cursor:
            isDragging && hasMoved ? 'grabbing' : hoveredCell && !isDragging ? 'pointer' : 'grab',
          touchAction: 'none', // Allow both horizontal and vertical panning
          userSelect: 'none', // Prevent text selection during drag
        }}
      />
    </div>
  );
};

export default PerSecondChart;
