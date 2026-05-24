const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const pages = {
  home: document.getElementById("homePage"),
  game: document.getElementById("gamePage"),
  end: document.getElementById("endPage")
};

const hud = {
  homeHighScore: document.getElementById("homeHighScore"),
  levelText: document.getElementById("levelText"),
  livesText: document.getElementById("livesText"),
  gameHighScore: document.getElementById("gameHighScore"),
  finalLevelText: document.getElementById("finalLevelText"),
  endHighScore: document.getElementById("endHighScore")
};

const GRID_COLS = 13;
const GRID_ROWS = 21;
const WALL = 1;
const PATH = 0;

const gameState = {
  page: "home",
  level: 1,
  lives: 5,
  maxLives: 5,
  highScore: 0,
  maze: [],
  player: {
    x: 0,
    y: 0,
    targetX: 0,
    targetY: 0,
    moveStartX: 0,
    moveStartY: 0,
    moveStartedAt: 0,
    moveDuration: 150,
    radius: 0.25,
    isMoving: false
  },
  start: {
    x: 1,
    y: 1
  },
  finish: {
    x: GRID_COLS - 2,
    y: GRID_ROWS - 2
  },
  activeSpikes: [],
  spikeTimeoutId: null,
  spikeClearTimeoutId: null,
  isGameRunning: false,
  animationFrameId: null,
  cellSize: 1,
  offsetX: 0,
  offsetY: 0,
  controls: {
    isDragging: false,
    pointerId: null,
    dragOffsetX: 0,
    dragOffsetY: 0,
    wasMoved: false,
    userMoved: false
  },
  audio: {
    context: null
  }
};

function initGame() {
  gameState.highScore = loadHighScore();
  updateHUD();
  showPage("home");
  bindEvents();
  resizeCanvas();
  drawGame();
}

function bindEvents() {
  document.getElementById("startButton").addEventListener("click", startGame);
  document.getElementById("playAgainButton").addEventListener("click", startGame);
  document.getElementById("backHomeButton").addEventListener("click", () => {
    stopGameLoop();
    clearSpike();
    showPage("home");
  });

  window.addEventListener("resize", () => {
    resizeCanvas();
    drawGame();
  });

  window.addEventListener("keydown", (event) => {
    const keyMap = {
      ArrowUp: "up",
      ArrowDown: "down",
      ArrowLeft: "left",
      ArrowRight: "right",
      w: "up",
      W: "up",
      s: "down",
      S: "down",
      a: "left",
      A: "left",
      d: "right",
      D: "right"
    };

    const direction = keyMap[event.key];
    if (direction) {
      event.preventDefault();
      movePlayer(direction);
    }
  });

  document.querySelectorAll("[data-direction]").forEach((button) => {
    const handler = (event) => {
      event.preventDefault();
      event.stopPropagation();
      movePlayer(button.dataset.direction);
    };

    button.addEventListener("click", handler);
    button.addEventListener("pointerdown", handler);
  });

  bindDraggableControls();
}

function showPage(pageName) {
  gameState.page = pageName;
  Object.values(pages).forEach((page) => page.classList.remove("page-active"));
  pages[pageName].classList.add("page-active");
  updateHUD();
}

function startGame() {
  ensureAudioContext();
  clearSpike();
  stopGameLoop();
  gameState.level = 1;
  gameState.lives = gameState.maxLives;
  gameState.isGameRunning = true;
  generateMaze();
  showPage("game");
  resizeCanvas();
  scheduleNextSpike();
  updateGame();
}

function endGame() {
  gameState.isGameRunning = false;
  clearSpike();
  stopGameLoop();
  saveHighScore();
  showPage("end");
}

function nextLevel() {
  clearSpike();
  gameState.level += 1;
  saveHighScore();
  generateMaze();
  updateHUD();
  scheduleNextSpike();
}

function generateMaze() {
  const maze = Array.from({ length: GRID_ROWS }, () => Array(GRID_COLS).fill(WALL));
  const directions = [
    { x: 0, y: -2 },
    { x: 2, y: 0 },
    { x: 0, y: 2 },
    { x: -2, y: 0 }
  ];

  function shuffle(items) {
    for (let i = items.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [items[i], items[j]] = [items[j], items[i]];
    }
    return items;
  }

  function carve(x, y) {
    maze[y][x] = PATH;
    shuffle([...directions]).forEach((direction) => {
      const nextX = x + direction.x;
      const nextY = y + direction.y;

      if (
        nextX > 0 &&
        nextX < GRID_COLS - 1 &&
        nextY > 0 &&
        nextY < GRID_ROWS - 1 &&
        maze[nextY][nextX] === WALL
      ) {
        maze[y + direction.y / 2][x + direction.x / 2] = PATH;
        carve(nextX, nextY);
      }
    });
  }

  carve(1, 1);

  gameState.maze = maze;
  gameState.start = { x: 1, y: 1 };
  gameState.finish = { x: GRID_COLS - 2, y: GRID_ROWS - 2 };
  gameState.maze[gameState.start.y][gameState.start.x] = PATH;
  gameState.maze[gameState.finish.y][gameState.finish.x] = PATH;
  resetPlayer();
}

function resetPlayer() {
  gameState.player.x = gameState.start.x + 0.5;
  gameState.player.y = gameState.start.y + 0.5;
  gameState.player.targetX = gameState.player.x;
  gameState.player.targetY = gameState.player.y;
  gameState.player.moveStartX = gameState.player.x;
  gameState.player.moveStartY = gameState.player.y;
  gameState.player.isMoving = false;
}

function drawGame() {
  if (!ctx) {
    return;
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#dbe7f5";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  drawCells();
  drawStartIcon(gameState.start);
  drawFinishIcon(gameState.finish);
  drawSpikes();
  drawPlayer();
}

function drawCells() {
  for (let y = 0; y < GRID_ROWS; y += 1) {
    for (let x = 0; x < GRID_COLS; x += 1) {
      if (gameState.maze[y]?.[x] !== WALL) {
        continue;
      }

      const rect = gridRect(x, y);
      const gradient = ctx.createLinearGradient(rect.x, rect.y, rect.x + rect.size, rect.y + rect.size);
      gradient.addColorStop(0, "#355b85");
      gradient.addColorStop(1, "#1f3755");
      ctx.fillStyle = gradient;
      ctx.fillRect(rect.x, rect.y, rect.size + 0.5, rect.size + 0.5);
    }
  }
}

function drawIconBase(cell, color) {
  const center = gridCenter(cell.x, cell.y);
  const radius = gameState.cellSize * 0.34;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
  ctx.fill();
  return { center, radius };
}

function drawStartIcon(cell) {
  const { center, radius } = drawIconBase(cell, "#3ee184");
  const size = radius * 1.08;

  ctx.fillStyle = "rgba(4, 33, 26, 0.82)";
  ctx.beginPath();
  ctx.moveTo(center.x - size * 0.32, center.y - size * 0.46);
  ctx.lineTo(center.x - size * 0.32, center.y + size * 0.42);
  ctx.lineTo(center.x + size * 0.46, center.y);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = "rgba(255, 255, 255, 0.7)";
  ctx.lineWidth = Math.max(1.4, radius * 0.16);
  ctx.beginPath();
  ctx.arc(center.x, center.y, radius * 0.74, 0, Math.PI * 2);
  ctx.stroke();
}

function drawFinishIcon(cell) {
  const { center, radius } = drawIconBase(cell, "#5ab6ff");
  const flagWidth = radius * 0.9;
  const flagHeight = radius * 0.62;
  const poleHeight = radius * 1.45;

  ctx.strokeStyle = "rgba(4, 23, 42, 0.84)";
  ctx.lineWidth = Math.max(1.6, radius * 0.17);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(center.x - radius * 0.34, center.y + radius * 0.56);
  ctx.lineTo(center.x - radius * 0.34, center.y - poleHeight * 0.42);
  ctx.stroke();

  ctx.fillStyle = "#ffd66d";
  drawRoundedRect(
    center.x - radius * 0.28,
    center.y - radius * 0.56,
    flagWidth,
    flagHeight,
    Math.max(2, radius * 0.16),
    true
  );

  ctx.fillStyle = "rgba(4, 23, 42, 0.16)";
  ctx.beginPath();
  ctx.moveTo(center.x + radius * 0.16, center.y - radius * 0.56);
  ctx.lineTo(center.x + radius * 0.62, center.y - radius * 0.25);
  ctx.lineTo(center.x + radius * 0.16, center.y + radius * 0.06);
  ctx.closePath();
  ctx.fill();
}

function drawPlayer() {
  const center = gridToPixel(gameState.player.x, gameState.player.y);
  const radius = gameState.player.radius * gameState.cellSize;
  ctx.fillStyle = "#ffcf4d";
  ctx.beginPath();
  ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(4, 19, 22, 0.42)";
  ctx.lineWidth = Math.max(2, radius * 0.16);
  ctx.stroke();
}

function drawSpikes() {
  gameState.activeSpikes.forEach((spike) => {
    const rect = gridRect(spike.x, spike.y);
    const pad = rect.size * 0.18;
    ctx.fillStyle = "#ff4f6d";
    ctx.beginPath();

    if (spike.side === "top") {
      ctx.moveTo(rect.x + pad, rect.y);
      ctx.lineTo(rect.x + rect.size - pad, rect.y);
      ctx.lineTo(rect.x + rect.size / 2, rect.y + rect.size * 0.46);
    } else if (spike.side === "bottom") {
      ctx.moveTo(rect.x + pad, rect.y + rect.size);
      ctx.lineTo(rect.x + rect.size - pad, rect.y + rect.size);
      ctx.lineTo(rect.x + rect.size / 2, rect.y + rect.size * 0.54);
    } else if (spike.side === "left") {
      ctx.moveTo(rect.x, rect.y + pad);
      ctx.lineTo(rect.x, rect.y + rect.size - pad);
      ctx.lineTo(rect.x + rect.size * 0.46, rect.y + rect.size / 2);
    } else {
      ctx.moveTo(rect.x + rect.size, rect.y + pad);
      ctx.lineTo(rect.x + rect.size, rect.y + rect.size - pad);
      ctx.lineTo(rect.x + rect.size * 0.54, rect.y + rect.size / 2);
    }

    ctx.closePath();
    ctx.fill();
  });
}

function updateGame() {
  if (!gameState.isGameRunning) {
    return;
  }

  updatePlayerAnimation();
  drawGame();
  gameState.animationFrameId = requestAnimationFrame(updateGame);
}

function movePlayer(direction) {
  if (!gameState.isGameRunning || gameState.page !== "game" || gameState.player.isMoving) {
    return;
  }

  const moves = {
    up: { x: 0, y: -1 },
    down: { x: 0, y: 1 },
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 }
  };
  const move = moves[direction];

  if (!move) {
    return;
  }

  const nextX = gameState.player.targetX + move.x;
  const nextY = gameState.player.targetY + move.y;

  if (canMoveTo(nextX, nextY)) {
    playMoveSound();
    gameState.player.moveStartX = gameState.player.x;
    gameState.player.moveStartY = gameState.player.y;
    gameState.player.targetX = nextX;
    gameState.player.targetY = nextY;
    gameState.player.moveStartedAt = performance.now();
    gameState.player.isMoving = true;
  }
}

function canMoveTo(x, y) {
  const radius = gameState.player.radius;
  const points = [
    { x: x - radius, y: y - radius },
    { x: x + radius, y: y - radius },
    { x: x - radius, y: y + radius },
    { x: x + radius, y: y + radius }
  ];

  return points.every((point) => {
    const cellX = Math.floor(point.x);
    const cellY = Math.floor(point.y);
    return gameState.maze[cellY]?.[cellX] === PATH;
  });
}

function checkCollision() {
  const playerCell = {
    x: Math.floor(gameState.player.x),
    y: Math.floor(gameState.player.y)
  };

  if (playerCell.x === gameState.finish.x && playerCell.y === gameState.finish.y) {
    playSuccessSound();
    nextLevel();
    return;
  }

  const hitSpike = gameState.activeSpikes.some((spike) => spike.x === playerCell.x && spike.y === playerCell.y);
  if (!hitSpike) {
    return;
  }

  gameState.lives -= 1;
  playFailSound();
  clearSpike();

  if (gameState.lives <= 0) {
    endGame();
    return;
  }

  resetPlayer();
  updateHUD();
  scheduleNextSpike();
}

function updatePlayerAnimation() {
  if (!gameState.player.isMoving) {
    checkCollision();
    return;
  }

  const elapsed = performance.now() - gameState.player.moveStartedAt;
  const progress = Math.min(elapsed / gameState.player.moveDuration, 1);
  const eased = 1 - Math.pow(1 - progress, 3);
  gameState.player.x = lerp(gameState.player.moveStartX, gameState.player.targetX, eased);
  gameState.player.y = lerp(gameState.player.moveStartY, gameState.player.targetY, eased);

  if (progress >= 1) {
    gameState.player.x = gameState.player.targetX;
    gameState.player.y = gameState.player.targetY;
    gameState.player.isMoving = false;
    checkCollision();
  }
}

function spawnSpike() {
  if (!gameState.isGameRunning || gameState.page !== "game") {
    return;
  }

  const candidates = [];
  for (let y = 1; y < GRID_ROWS - 1; y += 1) {
    for (let x = 1; x < GRID_COLS - 1; x += 1) {
      if (
        gameState.maze[y][x] !== PATH ||
        isImportantCell(x, y) ||
        isPlayerCell(x, y)
      ) {
        continue;
      }

      const wallSides = getAdjacentWallSides(x, y);
      wallSides.forEach((side) => candidates.push({ x, y, side }));
    }
  }

  if (candidates.length === 0) {
    scheduleNextSpike();
    return;
  }

  const shuffledCandidates = shuffleArray(candidates);
  const usedCells = new Set();
  gameState.activeSpikes = [];

  const spikeCount = getSpikeCountForLevel();

  for (const candidate of shuffledCandidates) {
    const key = `${candidate.x},${candidate.y}`;
    if (usedCells.has(key)) {
      continue;
    }

    usedCells.add(key);
    gameState.activeSpikes.push(candidate);

    if (gameState.activeSpikes.length === spikeCount) {
      break;
    }
  }

  const visibleMs = randomBetween(2000, 4000);
  gameState.spikeClearTimeoutId = window.setTimeout(() => {
    clearSpike(false);
    scheduleNextSpike();
  }, visibleMs);
}

function clearSpike(cancelSchedule = true) {
  gameState.activeSpikes = [];

  if (gameState.spikeClearTimeoutId) {
    window.clearTimeout(gameState.spikeClearTimeoutId);
    gameState.spikeClearTimeoutId = null;
  }

  if (cancelSchedule && gameState.spikeTimeoutId) {
    window.clearTimeout(gameState.spikeTimeoutId);
    gameState.spikeTimeoutId = null;
  }
}

function scheduleNextSpike() {
  if (!gameState.isGameRunning) {
    return;
  }

  if (gameState.spikeTimeoutId) {
    window.clearTimeout(gameState.spikeTimeoutId);
  }

  gameState.spikeTimeoutId = window.setTimeout(() => {
    gameState.spikeTimeoutId = null;
    spawnSpike();
  }, randomBetween(5000, 10000));
}

function updateHUD() {
  gameState.highScore = Math.max(gameState.highScore, loadHighScore());
  hud.homeHighScore.textContent = gameState.highScore;
  hud.levelText.textContent = gameState.level;
  hud.livesText.textContent = `${gameState.lives} / ${gameState.maxLives}`;
  hud.gameHighScore.textContent = gameState.highScore;
  hud.finalLevelText.textContent = gameState.level;
  hud.endHighScore.textContent = gameState.highScore;
}

function saveHighScore() {
  if (gameState.level > gameState.highScore) {
    gameState.highScore = gameState.level;
    localStorage.setItem("mazeBallHighScore", String(gameState.highScore));
  }
  updateHUD();
}

function loadHighScore() {
  return Number(localStorage.getItem("mazeBallHighScore")) || 0;
}

function resizeCanvas() {
  const wrapper = document.getElementById("canvasWrap");
  const rect = wrapper.getBoundingClientRect();
  const scale = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.floor(rect.width * scale));
  canvas.height = Math.max(1, Math.floor(rect.height * scale));
  ctx.setTransform(scale, 0, 0, scale, 0, 0);

  const availableWidth = rect.width;
  const availableHeight = rect.height;
  gameState.cellSize = Math.min(availableWidth / GRID_COLS, availableHeight / GRID_ROWS);
  gameState.offsetX = (availableWidth - gameState.cellSize * GRID_COLS) / 2;
  gameState.offsetY = (availableHeight - gameState.cellSize * GRID_ROWS) / 2;
  clampControls();
}

function stopGameLoop() {
  if (gameState.animationFrameId) {
    cancelAnimationFrame(gameState.animationFrameId);
    gameState.animationFrameId = null;
  }
}

function getAdjacentWallSides(x, y) {
  const sides = [];
  if (gameState.maze[y - 1]?.[x] === WALL) sides.push("top");
  if (gameState.maze[y + 1]?.[x] === WALL) sides.push("bottom");
  if (gameState.maze[y]?.[x - 1] === WALL) sides.push("left");
  if (gameState.maze[y]?.[x + 1] === WALL) sides.push("right");
  return sides;
}

function isImportantCell(x, y) {
  return (
    (x === gameState.start.x && y === gameState.start.y) ||
    (x === gameState.finish.x && y === gameState.finish.y)
  );
}

function isPlayerCell(x, y) {
  return x === Math.floor(gameState.player.targetX) && y === Math.floor(gameState.player.targetY);
}

function randomBetween(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getSpikeCountForLevel() {
  const level = gameState.level;

  if (level <= 5) return randomBetween(5, 10);
  if (level <= 10) return randomBetween(8, 12);
  if (level <= 15) return randomBetween(10, 16);
  if (level <= 20) return randomBetween(20, 25);
  if (level <= 25) return randomBetween(25, 30);
  if (level <= 30) return randomBetween(30, 35);
  return randomBetween(35, 50);
}

function shuffleArray(items) {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

function lerp(start, end, progress) {
  return start + (end - start) * progress;
}

function ensureAudioContext() {
  if (!gameState.audio.context) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) {
      return null;
    }

    gameState.audio.context = new AudioContextClass();
  }

  if (gameState.audio.context.state === "suspended") {
    gameState.audio.context.resume();
  }

  return gameState.audio.context;
}

function playSuccessSound() {
  const audioContext = ensureAudioContext();
  if (!audioContext) {
    return;
  }

  const now = audioContext.currentTime;
  playTone(523.25, now, 0.11, "sine", 0.08);
  playTone(659.25, now + 0.1, 0.12, "sine", 0.08);
  playTone(783.99, now + 0.22, 0.18, "triangle", 0.1);
}

function playFailSound() {
  const audioContext = ensureAudioContext();
  if (!audioContext) {
    return;
  }

  const now = audioContext.currentTime;
  playTone(196, now, 0.14, "sawtooth", 0.08);
  playTone(146.83, now + 0.11, 0.22, "sawtooth", 0.07);
  playNoise(now, 0.18, 0.04);
}

function playMoveSound() {
  const audioContext = ensureAudioContext();
  if (!audioContext) {
    return;
  }

  const now = audioContext.currentTime;
  playTone(330, now, 0.045, "triangle", 0.035);
}

function playTone(frequency, startTime, duration, type, volume) {
  const audioContext = gameState.audio.context;
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, startTime);
  gain.gain.setValueAtTime(0.0001, startTime);
  gain.gain.exponentialRampToValueAtTime(volume, startTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

  oscillator.connect(gain);
  gain.connect(audioContext.destination);
  oscillator.start(startTime);
  oscillator.stop(startTime + duration + 0.03);
}

function playNoise(startTime, duration, volume) {
  const audioContext = gameState.audio.context;
  const bufferSize = audioContext.sampleRate * duration;
  const buffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
  const data = buffer.getChannelData(0);

  for (let i = 0; i < bufferSize; i += 1) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
  }

  const source = audioContext.createBufferSource();
  const gain = audioContext.createGain();
  source.buffer = buffer;
  gain.gain.setValueAtTime(volume, startTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
  source.connect(gain);
  gain.connect(audioContext.destination);
  source.start(startTime);
}

function drawRoundedRect(x, y, width, height, radius, fill = false) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();

  if (fill) {
    ctx.fill();
  }
}

function bindDraggableControls() {
  const controls = document.querySelector(".controls");
  const wrapper = document.getElementById("canvasWrap");

  controls.addEventListener("pointerdown", (event) => {
    if (event.target.closest("[data-direction]")) {
      return;
    }

    const controlsRect = controls.getBoundingClientRect();
    gameState.controls.isDragging = true;
    gameState.controls.pointerId = event.pointerId;
    gameState.controls.dragOffsetX = event.clientX - controlsRect.left;
    gameState.controls.dragOffsetY = event.clientY - controlsRect.top;
    gameState.controls.wasMoved = false;
    controls.classList.add("is-dragging");
    controls.setPointerCapture(event.pointerId);
  });

  controls.addEventListener("pointermove", (event) => {
    if (!gameState.controls.isDragging || gameState.controls.pointerId !== event.pointerId) {
      return;
    }

    const wrapperRect = wrapper.getBoundingClientRect();
    const left = event.clientX - wrapperRect.left - gameState.controls.dragOffsetX;
    const top = event.clientY - wrapperRect.top - gameState.controls.dragOffsetY;
    setControlsPosition(left, top);
    gameState.controls.wasMoved = true;
    gameState.controls.userMoved = true;
  });

  controls.addEventListener("pointerup", (event) => endControlDrag(event, controls));
  controls.addEventListener("pointercancel", (event) => endControlDrag(event, controls));
}

function endControlDrag(event, controls) {
  if (gameState.controls.pointerId !== event.pointerId) {
    return;
  }

  gameState.controls.isDragging = false;
  gameState.controls.pointerId = null;
  controls.classList.remove("is-dragging");
}

function setControlsPosition(left, top) {
  const controls = document.querySelector(".controls");
  const wrapper = document.getElementById("canvasWrap");
  const maxLeft = wrapper.clientWidth - controls.offsetWidth;
  const maxTop = wrapper.clientHeight - controls.offsetHeight;
  const clampedLeft = Math.max(8, Math.min(left, maxLeft - 8));
  const clampedTop = Math.max(8, Math.min(top, maxTop - 8));

  controls.style.left = `${clampedLeft}px`;
  controls.style.top = `${clampedTop}px`;
  controls.style.right = "auto";
  controls.style.bottom = "auto";
  controls.style.transform = "none";
}

function clampControls() {
  if (!gameState.controls.userMoved) {
    return;
  }

  const controls = document.querySelector(".controls");
  setControlsPosition(controls.offsetLeft, controls.offsetTop);
}

function gridRect(x, y) {
  return {
    x: gameState.offsetX + x * gameState.cellSize,
    y: gameState.offsetY + y * gameState.cellSize,
    size: gameState.cellSize
  };
}

function gridCenter(x, y) {
  const rect = gridRect(x, y);
  return {
    x: rect.x + rect.size / 2,
    y: rect.y + rect.size / 2
  };
}

function gridToPixel(x, y) {
  return {
    x: gameState.offsetX + x * gameState.cellSize,
    y: gameState.offsetY + y * gameState.cellSize
  };
}

initGame();
