import React, { useEffect, useRef, useState } from 'react';

// --- Assets ---
const CARRO_SVG = '/assets/carro.svg';
const CAMION_SVG = '/assets/camion.svg';
const COCODRILO_SVG = '/assets/cocodrilo.svg';

// --- Game Constants ---
const CANVAS_WIDTH = 400;
const CANVAS_HEIGHT = 600;
const ROAD_WIDTH = 180;
const PLAYER_WIDTH = 30;
const PLAYER_HEIGHT = 50;
const ENEMY_WIDTH = 30;
const ENEMY_HEIGHT = 50;
const ITEM_SIZE = 25;
const CROC_WIDTH = 60;
const CROC_HEIGHT = 20;

const BASE_SCROLL_SPEED = 6;
const MAX_SCROLL_SPEED = 18;
const PLAYER_SPEED = 8;

// --- Types ---
type GameObject = {
  offsetX: number; // relative to road center
  y: number;
  width: number;
  height: number;
  color: string;
  markedForDeletion?: boolean;
};

type Enemy = GameObject & { speed: number };
type Croc = GameObject & { speedX: number };
type Item = GameObject & { type: 'accelerator' | 'shield' };
type Scenery = { offsetX: number; y: number; type: 'rock' | 'tree' | 'bush' | 'surfboard'; size: number; markedForDeletion?: boolean };

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameOver, setGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const [gameStarted, setGameStarted] = useState(false);
  const [assetsLoaded, setAssetsLoaded] = useState(false);
  const [gameId, setGameId] = useState(0);

  // Image refs
  const carroImg = useRef<HTMLImageElement | null>(null);
  const camionImg = useRef<HTMLImageElement | null>(null);
  const cocodriloImg = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    let loadedCount = 0;
    const totalAssets = 3;

    const checkLoaded = () => {
      loadedCount++;
      if (loadedCount === totalAssets) {
        setAssetsLoaded(true);
      }
    };

    const loadImg = (src: string) => {
      const img = new Image();
      img.src = src;
      img.onload = checkLoaded;
      img.onerror = checkLoaded; // Handle error gracefully
      return img;
    };

    carroImg.current = loadImg(CARRO_SVG);
    camionImg.current = loadImg(CAMION_SVG);
    cocodriloImg.current = loadImg(COCODRILO_SVG);
  }, []);

  // Game state refs to avoid dependency issues in animation frame
  const gameState = useRef({
    player: {
      offsetX: 0,
      y: CANVAS_HEIGHT - PLAYER_HEIGHT - 20,
      width: PLAYER_WIDTH,
      height: PLAYER_HEIGHT,
      color: '#3b82f6', // blue car
      shieldTimer: 0,
      boostTimer: 0,
    },
    keys: { w: false, a: false, s: false, d: false },
    enemies: [] as Enemy[],
    items: [] as Item[],
    crocs: [] as Croc[],
    scenery: [] as Scenery[],
    scrollSpeed: BASE_SCROLL_SPEED,
    totalScroll: 0,
    score: 0,
    frames: 0,
    isGameOver: false,
  });

  const startGame = () => {
    gameState.current = {
      player: {
        offsetX: 0,
        y: CANVAS_HEIGHT - PLAYER_HEIGHT - 20,
        width: PLAYER_WIDTH,
        height: PLAYER_HEIGHT,
        color: '#3b82f6',
        shieldTimer: 0,
        boostTimer: 0,
      },
      keys: { w: false, a: false, s: false, d: false },
      enemies: [],
      items: [],
      crocs: [],
      scenery: [],
      scrollSpeed: BASE_SCROLL_SPEED,
      totalScroll: 0,
      score: 0,
      frames: 0,
      isGameOver: false,
    };
    setGameOver(false);
    setScore(0);
    setGameStarted(true);
    setGameId(prev => prev + 1);
  };

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'r' && gameOver) {
        startGame();
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [gameOver]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (key in gameState.current.keys) {
        gameState.current.keys[key as keyof typeof gameState.current.keys] = true;
      }
      if (key === 'r' && gameOver) {
        startGame();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (key in gameState.current.keys) {
        gameState.current.keys[key as keyof typeof gameState.current.keys] = false;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  useEffect(() => {
    if (!gameStarted) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;

    const getRoadCenter = (y: number, totalScroll: number) => {
      const base = y - totalScroll;
      const curve1 = Math.sin(base * 0.002) * 60;
      const curve2 = Math.sin(base * 0.001) * 40;
      return CANVAS_WIDTH / 2 + curve1 + curve2;
    };

    const getLeftX = (obj: GameObject, totalScroll: number) => {
      return getRoadCenter(obj.y + obj.height / 2, totalScroll) + obj.offsetX - obj.width / 2;
    };

    const checkCollision = (obj1: GameObject, obj2: GameObject, totalScroll: number) => {
      const x1 = getLeftX(obj1, totalScroll);
      const y1 = obj1.y;
      const x2 = getLeftX(obj2, totalScroll);
      const y2 = obj2.y;
      return (
        x1 < x2 + obj2.width &&
        x1 + obj1.width > x2 &&
        y1 < y2 + obj2.height &&
        y1 + obj1.height > y2
      );
    };

    const update = () => {
      const state = gameState.current;
      if (state.isGameOver) return;

      state.frames++;
      state.totalScroll += state.scrollSpeed;
      state.score += state.scrollSpeed / 10;
      setScore(Math.floor(state.score));

      // Player movement & Speed
      let currentSpeed = PLAYER_SPEED;
      let targetScrollSpeed = BASE_SCROLL_SPEED + Math.min(state.score / 300, 8);

      if (state.player.boostTimer > 0) {
        currentSpeed = PLAYER_SPEED * 1.5;
        targetScrollSpeed = MAX_SCROLL_SPEED * 1.5; // Huge boost
        state.player.boostTimer--;
      } else {
        if (state.keys.w) {
          targetScrollSpeed *= 1.8; // Accelerate road
        } else if (state.keys.s) {
          targetScrollSpeed *= 0.5; // Brake road
        }
      }
      state.scrollSpeed = targetScrollSpeed;

      if (state.player.shieldTimer > 0) {
        state.player.shieldTimer--;
      }

      if (state.keys.w && state.player.y > 50) state.player.y -= currentSpeed * 0.5;
      if (state.keys.s && state.player.y < CANVAS_HEIGHT - state.player.height - 20) state.player.y += currentSpeed;
      if (!state.keys.w && !state.keys.s && state.player.y < CANVAS_HEIGHT - state.player.height - 20) {
        state.player.y += currentSpeed * 0.2; // Slowly fall back if not accelerating
      }
      if (state.keys.a) state.player.offsetX -= currentSpeed;
      if (state.keys.d) state.player.offsetX += currentSpeed;

      // Restrict player to road
      const maxOffsetX = ROAD_WIDTH / 2 - state.player.width / 2;
      if (state.player.offsetX < -maxOffsetX) state.player.offsetX = -maxOffsetX;
      if (state.player.offsetX > maxOffsetX) state.player.offsetX = maxOffsetX;

      // Spawning logic
      // Enemies
      if (state.frames % 60 === 0 && Math.random() < 0.7) {
        state.enemies.push({
          offsetX: (Math.random() - 0.5) * (ROAD_WIDTH - ENEMY_WIDTH),
          y: -ENEMY_HEIGHT,
          width: ENEMY_WIDTH,
          height: ENEMY_HEIGHT,
          color: '#ef4444', // red car
          speed: Math.random() * 2 + 1,
        });
      }

      // Items (Shields & Accelerators)
      if (state.frames % 300 === 0) {
        const isShield = Math.random() > 0.5;
        state.items.push({
          offsetX: (Math.random() - 0.5) * (ROAD_WIDTH - ITEM_SIZE),
          y: -ITEM_SIZE,
          width: ITEM_SIZE,
          height: ITEM_SIZE,
          color: isShield ? '#8b5cf6' : '#eab308',
          type: isShield ? 'shield' : 'accelerator',
        });
      }

      // Scenery (Australia vibe)
      if (state.frames % 15 === 0) {
        const side = Math.random() > 0.5 ? 'left' : 'right';
        if (side === 'right') {
          const types = ['rock', 'tree', 'bush'] as const;
          state.scenery.push({
            offsetX: ROAD_WIDTH / 2 + 40 + Math.random() * 200,
            y: -100,
            type: types[Math.floor(Math.random() * types.length)],
            size: Math.random() * 20 + 15,
          });
        } else {
          if (Math.random() > 0.7) {
            state.scenery.push({
              offsetX: -ROAD_WIDTH / 2 - 80 - Math.random() * 150,
              y: -100,
              type: 'surfboard',
              size: Math.random() * 10 + 15,
            });
          }
        }
      }

      // Crocodiles (Salties!)
      if (state.frames % 120 === 0) { // Appear more often
        state.crocs.push({
          offsetX: ROAD_WIDTH * 1.2, // Always start on the right (grass)
          y: -CROC_HEIGHT - 50,
          width: CROC_WIDTH,
          height: CROC_HEIGHT,
          color: '#14532d', // Dark saltwater croc green
          speedX: -5, // Always go left (towards the water)
        });
      }

      // Update entities
      state.enemies.forEach((enemy) => {
        enemy.y += state.scrollSpeed - enemy.speed;
        if (enemy.y > CANVAS_HEIGHT) enemy.markedForDeletion = true;

        if (checkCollision(state.player, enemy, state.totalScroll)) {
          if (state.player.shieldTimer > 0) {
            enemy.markedForDeletion = true;
          } else {
            state.isGameOver = true;
          }
        }
      });

      state.items.forEach((item) => {
        item.y += state.scrollSpeed;
        if (item.y > CANVAS_HEIGHT) item.markedForDeletion = true;

        if (checkCollision(state.player, item, state.totalScroll)) {
          if (item.type === 'shield') {
            state.player.shieldTimer = 300;
          } else if (item.type === 'accelerator') {
            state.player.boostTimer = 180;
          }
          item.markedForDeletion = true;
        }
      });

      state.crocs.forEach((croc) => {
        croc.y += state.scrollSpeed;
        croc.offsetX += croc.speedX;
        if (croc.y > CANVAS_HEIGHT || croc.offsetX < -ROAD_WIDTH * 1.5 || croc.offsetX > ROAD_WIDTH * 1.5) {
          croc.markedForDeletion = true;
        }

        if (checkCollision(state.player, croc, state.totalScroll)) {
          if (state.player.shieldTimer > 0) {
            croc.markedForDeletion = true;
          } else {
            state.isGameOver = true;
          }
        }
      });

      state.scenery.forEach((s) => {
        s.y += state.scrollSpeed;
        if (s.y > CANVAS_HEIGHT + 100) s.markedForDeletion = true;
      });

      // Cleanup
      state.enemies = state.enemies.filter((e) => !e.markedForDeletion);
      state.items = state.items.filter((i) => !i.markedForDeletion);
      state.crocs = state.crocs.filter((c) => !c.markedForDeletion);
      state.scenery = state.scenery.filter((s) => !s.markedForDeletion);

      if (state.isGameOver) {
        setGameOver(true);
      }
    };

    const draw = () => {
      const state = gameState.current;
      const ts = state.totalScroll;
      
      const SEGMENT_HEIGHT = 10;
      const SAND_WIDTH = 50;

      // 1. Fill Outback (Background Right)
      ctx.fillStyle = '#b45309'; // Outback orange/red dirt
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // 2. Draw Water (Left)
      ctx.fillStyle = '#0284c7'; // Deep ocean blue
      ctx.beginPath();
      ctx.moveTo(0, 0);
      for (let y = 0; y <= CANVAS_HEIGHT; y += SEGMENT_HEIGHT) {
        const centerX = getRoadCenter(y, ts);
        ctx.lineTo(centerX - ROAD_WIDTH / 2 - SAND_WIDTH, y);
      }
      ctx.lineTo(0, CANVAS_HEIGHT);
      ctx.fill();

      // 3. Draw Sand (Beach)
      ctx.fillStyle = '#fcd34d'; // Sand color
      ctx.beginPath();
      for (let y = 0; y <= CANVAS_HEIGHT; y += SEGMENT_HEIGHT) {
        const centerX = getRoadCenter(y, ts);
        if (y === 0) ctx.moveTo(centerX - ROAD_WIDTH / 2 - SAND_WIDTH, y);
        else ctx.lineTo(centerX - ROAD_WIDTH / 2 - SAND_WIDTH, y);
      }
      for (let y = CANVAS_HEIGHT; y >= 0; y -= SEGMENT_HEIGHT) {
        const centerX = getRoadCenter(y, ts);
        ctx.lineTo(centerX - ROAD_WIDTH / 2, y);
      }
      ctx.fill();

      // 4. Draw Road
      ctx.fillStyle = '#292524'; // Dark asphalt
      ctx.beginPath();
      for (let y = 0; y <= CANVAS_HEIGHT; y += SEGMENT_HEIGHT) {
        const centerX = getRoadCenter(y, ts);
        if (y === 0) ctx.moveTo(centerX - ROAD_WIDTH / 2, y);
        else ctx.lineTo(centerX - ROAD_WIDTH / 2, y);
      }
      for (let y = CANVAS_HEIGHT; y >= 0; y -= SEGMENT_HEIGHT) {
        const centerX = getRoadCenter(y, ts);
        ctx.lineTo(centerX + ROAD_WIDTH / 2, y);
      }
      ctx.fill();

      // Draw road lines (dashed)
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.setLineDash([20, 20]);
      ctx.lineDashOffset = -ts;
      for (let y = 0; y <= CANVAS_HEIGHT; y += SEGMENT_HEIGHT) {
        const centerX = getRoadCenter(y, ts);
        if (y === 0) ctx.moveTo(centerX, y);
        else ctx.lineTo(centerX, y);
      }
      ctx.stroke();
      ctx.setLineDash([]); // reset

      // Draw road borders
      ctx.lineWidth = 3;
      
      // Left border (Yellow)
      ctx.strokeStyle = '#eab308';
      ctx.beginPath();
      for (let y = 0; y <= CANVAS_HEIGHT; y += SEGMENT_HEIGHT) {
        const centerX = getRoadCenter(y, ts);
        if (y === 0) ctx.moveTo(centerX - ROAD_WIDTH / 2, y);
        else ctx.lineTo(centerX - ROAD_WIDTH / 2, y);
      }
      ctx.stroke();
      
      // Right border (White)
      ctx.strokeStyle = '#fff';
      ctx.beginPath();
      for (let y = 0; y <= CANVAS_HEIGHT; y += SEGMENT_HEIGHT) {
        const centerX = getRoadCenter(y, ts);
        if (y === 0) ctx.moveTo(centerX + ROAD_WIDTH / 2, y);
        else ctx.lineTo(centerX + ROAD_WIDTH / 2, y);
      }
      ctx.stroke();

      // Draw Scenery
      state.scenery.forEach((s) => {
        const x = getRoadCenter(s.y, ts) + s.offsetX;
        const y = s.y;

        if (s.type === 'rock') {
          ctx.fillStyle = '#7c2d12'; // Dark red/brown
          ctx.beginPath();
          ctx.arc(x, y, s.size, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#9a3412'; // Highlight
          ctx.beginPath();
          ctx.arc(x - s.size * 0.2, y - s.size * 0.2, s.size * 0.5, 0, Math.PI * 2);
          ctx.fill();
        } else if (s.type === 'bush') {
          ctx.fillStyle = '#4d7c0f'; // Olive green
          ctx.beginPath();
          ctx.arc(x, y, s.size, 0, Math.PI * 2);
          ctx.fill();
        } else if (s.type === 'tree') {
          ctx.fillStyle = '#78350f'; // Trunk
          ctx.fillRect(x - 2, y, 4, s.size);
          ctx.fillStyle = '#65a30d'; // Leaves
          ctx.beginPath();
          ctx.arc(x, y - s.size * 0.3, s.size * 0.8, 0, Math.PI * 2);
          ctx.fill();
        } else if (s.type === 'surfboard') {
          ctx.fillStyle = '#f8fafc';
          ctx.beginPath();
          ctx.ellipse(x, y, s.size * 0.3, s.size, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#ef4444'; // Red stripe
          ctx.fillRect(x - 1, y - s.size * 0.8, 2, s.size * 1.6);
        }
      });

      const drawObject = (obj: GameObject, drawFn: (x: number, y: number, o: any) => void) => {
        const x = getLeftX(obj, ts);
        const y = obj.y;
        drawFn(x, y, obj);
      };

      // Draw items
      state.items.forEach((item) => {
        drawObject(item, (x, y, i) => {
          ctx.fillStyle = i.color;
          ctx.fillRect(x, y, i.width, i.height);
          ctx.fillStyle = '#fff';
          ctx.font = '16px monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(i.type === 'shield' ? 'S' : 'A', x + i.width / 2, y + i.height / 2);
        });
      });

      // Draw crocs
      state.crocs.forEach((croc) => {
        drawObject(croc, (x, y, c) => {
          if (cocodriloImg.current && cocodriloImg.current.complete && cocodriloImg.current.naturalWidth !== 0) {
            ctx.save();
            // Add a slight wobble for fluid walking animation
            const wobble = Math.sin(state.frames * 0.2) * 0.15;
            ctx.translate(x + c.width / 2, y + c.height / 2);
            ctx.rotate(wobble);
            
            if (c.speedX < 0) {
              // Flip horizontally if moving left
              ctx.scale(-1, 1);
            }
            
            ctx.drawImage(cocodriloImg.current, -c.width / 2, -c.height / 2, c.width, c.height);
            ctx.restore();
          } else {
            // Fallback
            ctx.fillStyle = c.color;
            ctx.fillRect(x, y, c.width, c.height);
            ctx.strokeStyle = '#064e3b';
            ctx.lineWidth = 2;
            ctx.strokeRect(x, y, c.width, c.height);
            ctx.fillStyle = '#000';
            if (c.speedX > 0) {
              ctx.fillRect(x + c.width - 10, y + 2, 4, 4);
            } else {
              ctx.fillRect(x + 6, y + 2, 4, 4);
            }
          }
        });
      });

      // Draw enemies
      state.enemies.forEach((enemy) => {
        drawObject(enemy, (x, y, e) => {
          if (camionImg.current && camionImg.current.complete && camionImg.current.naturalWidth !== 0) {
            ctx.drawImage(camionImg.current, x, y, e.width, e.height);
          } else {
            // Fallback
            ctx.fillStyle = e.color;
            ctx.fillRect(x, y, e.width, e.height);
            ctx.fillStyle = '#000';
            ctx.fillRect(x + 5, y + 10, e.width - 10, 10);
          }
        });
      });

      // Draw player
      drawObject(state.player, (x, y, p) => {
        if (carroImg.current && carroImg.current.complete && carroImg.current.naturalWidth !== 0) {
          ctx.drawImage(carroImg.current, x, y, p.width, p.height);
        } else {
          // Fallback
          ctx.fillStyle = p.color;
          ctx.fillRect(x, y, p.width, p.height);
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = 2;
          ctx.strokeRect(x, y, p.width, p.height);
          ctx.fillStyle = '#000';
          ctx.fillRect(x + 5, y + 10, p.width - 10, 10);
        }

        if (p.shieldTimer > 0) {
          ctx.strokeStyle = '#8b5cf6';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(
            x + p.width / 2,
            y + p.height / 2,
            Math.max(p.width, p.height) / 2 + 10,
            0,
            Math.PI * 2
          );
          ctx.stroke();
        }

        if (p.boostTimer > 0) {
          ctx.fillStyle = '#eab308';
          ctx.beginPath();
          ctx.moveTo(x + 5, y + p.height);
          ctx.lineTo(x + p.width / 2, y + p.height + 20 + Math.random() * 10);
          ctx.lineTo(x + p.width - 5, y + p.height);
          ctx.fill();
        }
      });
    };

    const loop = () => {
      update();
      draw();
      if (!gameState.current.isGameOver) {
        animationFrameId = requestAnimationFrame(loop);
      }
    };

    loop();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [gameStarted, gameId]);

  return (
    <div className="min-h-screen bg-zinc-900 flex flex-col items-center justify-center p-4 font-sans text-white">
      <div className="mb-4 text-center">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-100 mb-2">Road Fighter Clone</h1>
        <p className="text-zinc-400 text-sm max-w-md">
          Usa <kbd className="bg-zinc-800 px-1 rounded">W</kbd> <kbd className="bg-zinc-800 px-1 rounded">A</kbd> <kbd className="bg-zinc-800 px-1 rounded">S</kbd> <kbd className="bg-zinc-800 px-1 rounded">D</kbd> para moverte.
          <br />
          <span className="text-yellow-500 font-bold">A</span> = Acelerador | <span className="text-purple-500 font-bold">S</span> = Escudo
          <br />
          ¡Cuidado con los cocodrilos verdes y los autos rojos!
        </p>
      </div>

      <div className="relative">
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          className="bg-zinc-800 rounded-lg shadow-2xl border border-zinc-700"
          style={{ display: gameStarted ? 'block' : 'none' }}
        />
        
        {!gameStarted && (
          <div 
            className="bg-zinc-800 rounded-lg shadow-2xl border border-zinc-700 flex flex-col items-center justify-center"
            style={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT }}
          >
            {!assetsLoaded ? (
              <p className="text-xl text-zinc-400">Cargando recursos...</p>
            ) : (
              <button
                onClick={startGame}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-colors text-xl"
              >
                Iniciar Juego
              </button>
            )}
          </div>
        )}

        {gameOver && (
          <div className="absolute inset-0 bg-black/80 rounded-lg flex flex-col items-center justify-center">
            <h2 className="text-4xl font-bold text-red-500 mb-2">¡GAME OVER!</h2>
            <p className="text-2xl text-white mb-6">Puntuación: {score}</p>
            <button
              onClick={startGame}
              className="px-6 py-3 bg-white text-black hover:bg-zinc-200 font-bold rounded-xl transition-colors text-xl mb-4"
            >
              Jugar de nuevo
            </button>
            <p className="text-zinc-400 text-sm">O presiona <kbd className="bg-zinc-800 px-2 py-1 rounded border border-zinc-700">R</kbd> para reiniciar</p>
          </div>
        )}

        {gameStarted && !gameOver && (
          <div className="absolute top-4 left-4 text-xl font-mono font-bold text-white drop-shadow-md">
            Score: {score}
          </div>
        )}
      </div>
    </div>
  );
}
