import { useRef, useEffect } from 'react';

interface SquaresProps {
  direction?: 'right' | 'left' | 'up' | 'down' | 'diagonal';
  speed?: number;
  borderColor?: string;
  squareSize?: number;
  hoverFillColor?: string;
  clickFillColor?: string;
  clickImage?: string;
}

interface ClickedSquare {
  screenX: number;
  screenY: number;
  movementX: number;
  movementY: number;
}

const Squares = ({
  direction = 'right',
  speed = 1,
  borderColor = '#999',
  squareSize = 40,
  hoverFillColor = '#222',
  clickFillColor = '#0a1a3a',
  clickImage
}: SquaresProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number | null>(null);
  const numSquaresX = useRef(0);
  const numSquaresY = useRef(0);
  const gridOffset = useRef({ x: 0, y: 0 });
  const hoveredSquareRef = useRef<{ x: number; y: number } | null>(null);
  const clickedSquaresRef = useRef<ClickedSquare[]>([]);
  const totalMovementRef = useRef({ x: 0, y: 0 });
  const logoImageRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const resizeCanvas = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      numSquaresX.current = Math.ceil(canvas.width / squareSize) + 1;
      numSquaresY.current = Math.ceil(canvas.height / squareSize) + 1;
    };

    // Load logo image
    if (clickImage) {
      const img = new Image();
      img.src = clickImage;
      img.onload = () => {
        logoImageRef.current = img;
      };
    }

    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    const drawGrid = () => {
      if (!ctx) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const startX = Math.floor(gridOffset.current.x / squareSize) * squareSize;
      const startY = Math.floor(gridOffset.current.y / squareSize) * squareSize;

      for (let x = startX; x < canvas.width + squareSize; x += squareSize) {
        for (let y = startY; y < canvas.height + squareSize; y += squareSize) {
          const squareX = x - (gridOffset.current.x % squareSize);
          const squareY = y - (gridOffset.current.y % squareSize);

          const gridX = Math.floor((x - startX) / squareSize);
          const gridY = Math.floor((y - startY) / squareSize);

          // Draw hovered square
          if (
            hoveredSquareRef.current &&
            gridX === hoveredSquareRef.current.x &&
            gridY === hoveredSquareRef.current.y
          ) {
            ctx.fillStyle = hoverFillColor;
            ctx.fillRect(squareX, squareY, squareSize, squareSize);
          }

          ctx.strokeStyle = borderColor;
          ctx.strokeRect(squareX, squareY, squareSize, squareSize);
        }
      }

      // Draw clicked squares that move with the grid
      clickedSquaresRef.current = clickedSquaresRef.current.filter(clicked => {
        const dx = totalMovementRef.current.x - clicked.movementX;
        const dy = totalMovementRef.current.y - clicked.movementY;
        const currentX = clicked.screenX + dx;
        const currentY = clicked.screenY + dy;

        // Remove if off screen
        if (
          currentX + squareSize < 0 || currentX > canvas.width ||
          currentY + squareSize < 0 || currentY > canvas.height
        ) {
          return false;
        }

        // Fill background
        ctx.fillStyle = clickFillColor;
        ctx.globalAlpha = 0.6;
        ctx.fillRect(currentX, currentY, squareSize, squareSize);
        ctx.globalAlpha = 1;

        // Draw logo image inside the cell
        if (logoImageRef.current) {
          const padding = 4;
          const imgSize = squareSize - padding * 2;
          ctx.globalAlpha = 0.8;
          ctx.drawImage(logoImageRef.current, currentX + padding, currentY + padding, imgSize, imgSize);
          ctx.globalAlpha = 1;
        }

        return true;
      });

      const gradient = ctx.createRadialGradient(
        canvas.width / 2,
        canvas.height / 2,
        0,
        canvas.width / 2,
        canvas.height / 2,
        Math.sqrt(canvas.width ** 2 + canvas.height ** 2) / 2
      );
      gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
      gradient.addColorStop(1, '#060010');

      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    };

    const updateAnimation = () => {
      const effectiveSpeed = Math.max(speed, 0.1);

      // Track cumulative screen movement
      switch (direction) {
        case 'right':
          totalMovementRef.current.x += effectiveSpeed;
          break;
        case 'left':
          totalMovementRef.current.x -= effectiveSpeed;
          break;
        case 'up':
          totalMovementRef.current.y -= effectiveSpeed;
          break;
        case 'down':
          totalMovementRef.current.y += effectiveSpeed;
          break;
        case 'diagonal':
          totalMovementRef.current.x += effectiveSpeed;
          totalMovementRef.current.y += effectiveSpeed;
          break;
        default:
          break;
      }

      // Update grid offset (with modulo wrapping for seamless tiling)
      switch (direction) {
        case 'right':
          gridOffset.current.x = (gridOffset.current.x - effectiveSpeed + squareSize) % squareSize;
          break;
        case 'left':
          gridOffset.current.x = (gridOffset.current.x + effectiveSpeed + squareSize) % squareSize;
          break;
        case 'up':
          gridOffset.current.y = (gridOffset.current.y + effectiveSpeed + squareSize) % squareSize;
          break;
        case 'down':
          gridOffset.current.y = (gridOffset.current.y - effectiveSpeed + squareSize) % squareSize;
          break;
        case 'diagonal':
          gridOffset.current.x = (gridOffset.current.x - effectiveSpeed + squareSize) % squareSize;
          gridOffset.current.y = (gridOffset.current.y - effectiveSpeed + squareSize) % squareSize;
          break;
        default:
          break;
      }

      drawGrid();
      requestRef.current = requestAnimationFrame(updateAnimation);
    };

    const getGridPosition = (event: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const mouseX = event.clientX - rect.left;
      const mouseY = event.clientY - rect.top;

      const startX = Math.floor(gridOffset.current.x / squareSize) * squareSize;
      const startY = Math.floor(gridOffset.current.y / squareSize) * squareSize;

      return {
        x: Math.floor((mouseX + gridOffset.current.x - startX) / squareSize),
        y: Math.floor((mouseY + gridOffset.current.y - startY) / squareSize),
      };
    };

    const handleMouseMove = (event: MouseEvent) => {
      const pos = getGridPosition(event);
      if (
        !hoveredSquareRef.current ||
        hoveredSquareRef.current.x !== pos.x ||
        hoveredSquareRef.current.y !== pos.y
      ) {
        hoveredSquareRef.current = pos;
      }
    };

    const handleClick = (event: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const mouseX = event.clientX - rect.left;
      const mouseY = event.clientY - rect.top;

      // Snap to the grid cell's top-left corner
      const offsetX = gridOffset.current.x % squareSize;
      const offsetY = gridOffset.current.y % squareSize;
      const cellX = Math.floor((mouseX + offsetX) / squareSize);
      const cellY = Math.floor((mouseY + offsetY) / squareSize);
      const screenX = cellX * squareSize - offsetX;
      const screenY = cellY * squareSize - offsetY;

      clickedSquaresRef.current.push({
        screenX,
        screenY,
        movementX: totalMovementRef.current.x,
        movementY: totalMovementRef.current.y,
      });
    };

    const handleMouseLeave = () => {
      hoveredSquareRef.current = null;
    };

    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseleave', handleMouseLeave);
    canvas.addEventListener('click', handleClick);
    requestRef.current = requestAnimationFrame(updateAnimation);

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mouseleave', handleMouseLeave);
      canvas.removeEventListener('click', handleClick);
    };
  }, [direction, speed, borderColor, hoverFillColor, clickFillColor, squareSize, clickImage]);

  return <canvas ref={canvasRef} className="w-full h-full border-none block"></canvas>;
};

export default Squares;
