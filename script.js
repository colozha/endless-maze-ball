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
  difficultyText: document.getElementById("difficultyText"),
  finalLevelText: document.getElementById("finalLevelText"),
  endHighScore: document.getElementById("endHighScore"),
  controlsToggleIcon: document.getElementById("controlsToggleIcon")
};

const buttons = {
  continueButton: document.getElementById("continueButton")
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
  difficulty: "easy",
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
    moveDuration: 85,
    radius: 0.25,
    isMoving: false,
    queuedDirection: null
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
  lifeToken: null,
  lifeTokenTimeoutId: null,
  shieldToken: null,
  shieldTokenTimeoutId: null,
  shieldTimeoutId: null,
  shieldActiveUntil: 0,
  spikeTimeoutId: null,
  spikeClearTimeoutId: null,
  lastFrameTime: 0,
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
    userMoved: false,
    isVisible: true,
    holdIntervalId: null,
    holdDirection: null
  },
  keyboard: {
    heldDirections: [],
    holdIntervalId: null
  },
  swipe: {
    pointerId: null,
    startX: 0,
    startY: 0,
    isTracking: false,
    hasMoved: false,
    threshold: 30,
    repeatIntervalId: null,
    activeDirection: null,
    holdStartedAt: 0
  },
  audio: {
    context: null
  }
};

// Initialize saved state, UI, and first render.
function initGame() {
  gameState.highScore = loadHighScore();
  gameState.difficulty = loadSelectedDifficulty();
  gameState.controls.isVisible = loadControlsVisibility();
  updateControlsVisibility();
  updateDifficultySelection();
  updateHUD();
  updateContinueButton();
  showPage("home");
  bindEvents();
  resizeCanvas();
  drawGame();
}

// Bind all player input and page buttons.
function bindEvents() {
  document.getElementById("startButton").addEventListener("click", startGame);
  buttons.continueButton.addEventListener("click", continueGame);
  document.getElementById("playAgainButton").addEventListener("click", startGame);
  document.getElementById("backHomeButton").addEventListener("click", () => {
    saveProgress();
    stopControlPress();
    stopSwipeRepeat();
    stopKeyboardControls();
    stopGameLoop();
    clearSpike();
    clearLifeToken();
    clearShieldToken();
    clearShieldEffect();
    showPage("home");
  });
  document.getElementById("controlsToggle").addEventListener("click", toggleControlsVisibility);
  document.querySelectorAll("[data-difficulty]").forEach((button) => {
    button.addEventListener("click", () => {
      gameState.difficulty = button.dataset.difficulty;
      saveSelectedDifficulty();
      updateDifficultySelection();
      updateHUD();
    });
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
      startKeyboardPress(direction);
    }
  });

  window.addEventListener("keyup", (event) => {
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
      stopKeyboardPress(direction);
    }
  });

  document.querySelectorAll("[data-direction]").forEach((button) => {
    button.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      event.stopPropagation();
      button.setPointerCapture(event.pointerId);
      startControlPress(button.dataset.direction);
    });

    button.addEventListener("pointerup", stopControlPress);
    button.addEventListener("pointercancel", stopControlPress);
    button.addEventListener("pointerleave", stopControlPress);
  });

  bindDraggableControls();
  bindSwipeControls();
}

// Switch between Home, Game, and End screens.
function showPage(pageName) {
  gameState.page = pageName;
  Object.values(pages).forEach((page) => page.classList.remove("page-active"));
  pages[pageName].classList.add("page-active");
  updateContinueButton();
  updateHUD();
}

// Start a fresh run from level 1.
function startGame() {
  ensureAudioContext();
  clearSavedProgress();
  stopControlPress();
  stopSwipeRepeat();
  stopKeyboardControls();
  clearSpike();
  clearLifeToken();
  clearShieldToken();
  clearShieldEffect();
  stopGameLoop();
  gameState.level = 1;
  gameState.lives = gameState.maxLives;
  gameState.difficulty = loadSelectedDifficulty();
  updateDifficultySelection();
  gameState.isGameRunning = true;
  generateMaze();
  saveProgress();
  showPage("game");
  resizeCanvas();
  scheduleNextSpike();
  gameState.lastFrameTime = performance.now();
  updateGame();
}

// Resume saved progress with a newly generated maze.
function continueGame() {
  const progress = loadSavedProgress();
  if (!progress) {
    updateContinueButton();
    return;
  }

  ensureAudioContext();
  stopControlPress();
  stopSwipeRepeat();
  stopKeyboardControls();
  clearSpike();
  clearLifeToken();
  clearShieldToken();
  clearShieldEffect();
  stopGameLoop();
  gameState.level = progress.level;
  gameState.lives = progress.lives;
  gameState.difficulty = progress.difficulty || "easy";
  saveSelectedDifficulty();
  updateDifficultySelection();
  gameState.isGameRunning = true;
  generateMaze();
  saveProgress();
  showPage("game");
  resizeCanvas();
  spawnLifeTokenForLevel();
  spawnShieldTokenForLevel();
  scheduleNextSpike();
  gameState.lastFrameTime = performance.now();
  updateGame();
}

// Stop the run, clear active timers, and show Game Over.
function endGame() {
  gameState.isGameRunning = false;
  stopControlPress();
  stopSwipeRepeat();
  stopKeyboardControls();
  clearSpike();
  clearLifeToken();
  stopGameLoop();
  saveHighScore();
  clearSavedProgress();
  showPage("end");
}

// Advance to the next level and rebuild level hazards.
function nextLevel() {
  clearSpike();
  clearLifeToken();
  clearShieldToken();
  clearShieldEffect();
  gameState.level += 1;
  saveHighScore();
  saveProgress();
  generateMaze();
  updateHUD();
  spawnLifeTokenForLevel();
  spawnShieldTokenForLevel();
  scheduleNextSpike();
}

// Generate a solvable randomized maze.
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
  gameState.player.queuedDirection = null;
}

// Render the full game scene to canvas.
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
  drawLifeToken();
  drawShieldToken();
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

  if (hasActiveShield()) {
    ctx.strokeStyle = "rgba(112, 216, 255, 0.94)";
    ctx.lineWidth = Math.max(3, radius * 0.24);
    ctx.beginPath();
    ctx.arc(center.x, center.y, radius * 1.38, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawSpikes() {
  gameState.activeSpikes.forEach((spike) => {
    const drawPosition = getSpikeDrawPosition(spike);
    const rect = gridRect(drawPosition.x, drawPosition.y);
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

function drawLifeToken() {
  if (!gameState.lifeToken) {
    return;
  }

  const center = gridCenter(gameState.lifeToken.x, gameState.lifeToken.y);
  const size = gameState.cellSize * 0.26;
  ctx.fillStyle = "#ff3f63";
  ctx.beginPath();
  ctx.moveTo(center.x, center.y + size * 0.72);
  ctx.bezierCurveTo(
    center.x - size * 1.9,
    center.y - size * 0.25,
    center.x - size * 0.98,
    center.y - size * 1.5,
    center.x,
    center.y - size * 0.72
  );
  ctx.bezierCurveTo(
    center.x + size * 0.98,
    center.y - size * 1.5,
    center.x + size * 1.9,
    center.y - size * 0.25,
    center.x,
    center.y + size * 0.72
  );
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.72)";
  ctx.lineWidth = Math.max(1.5, gameState.cellSize * 0.06);
  ctx.stroke();
}

function drawShieldToken() {
  if (!gameState.shieldToken) {
    return;
  }

  const center = gridCenter(gameState.shieldToken.x, gameState.shieldToken.y);
  const size = gameState.cellSize * 0.36;
  ctx.fillStyle = "#70d8ff";
  ctx.beginPath();
  ctx.moveTo(center.x, center.y - size * 1.1);
  ctx.lineTo(center.x + size * 0.88, center.y - size * 0.72);
  ctx.lineTo(center.x + size * 0.66, center.y + size * 0.28);
  ctx.quadraticCurveTo(center.x + size * 0.42, center.y + size * 0.86, center.x, center.y + size * 1.12);
  ctx.quadraticCurveTo(center.x - size * 0.42, center.y + size * 0.86, center.x - size * 0.66, center.y + size * 0.28);
  ctx.lineTo(center.x - size * 0.88, center.y - size * 0.72);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.78)";
  ctx.lineWidth = Math.max(1.5, gameState.cellSize * 0.06);
  ctx.stroke();
}

// Main requestAnimationFrame loop.
function updateGame() {
  if (!gameState.isGameRunning) {
    return;
  }

  const now = performance.now();
  const deltaSeconds = Math.min((now - gameState.lastFrameTime) / 1000, 0.05);
  gameState.lastFrameTime = now;
  updateMovingSpikes(deltaSeconds);
  updatePlayerAnimation();
  drawGame();
  gameState.animationFrameId = requestAnimationFrame(updateGame);
}

// Queue or start one-cell player movement.
function movePlayer(direction) {
  if (!gameState.isGameRunning || gameState.page !== "game") {
    return;
  }

  if (gameState.player.isMoving) {
    gameState.player.queuedDirection = direction;
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
    gameState.player.moveDuration = getCurrentMoveDuration();
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

// Resolve finish, token, spike, and shield collisions.
function checkCollision() {
  const playerCell = {
    x: Math.floor(gameState.player.x),
    y: Math.floor(gameState.player.y)
  };

  if (playerCell.x === gameState.finish.x && playerCell.y === gameState.finish.y) {
    clearShieldEffect();
    playSuccessSound();
    nextLevel();
    return;
  }

  const hitSpike = gameState.activeSpikes.some((spike) => {
    const spikeCell = getSpikeCollisionCell(spike);
    return spikeCell.x === playerCell.x && spikeCell.y === playerCell.y;
  });
  const hitLifeToken = gameState.lifeToken &&
    gameState.lifeToken.x === playerCell.x &&
    gameState.lifeToken.y === playerCell.y;
  const hitShieldToken = gameState.shieldToken &&
    gameState.shieldToken.x === playerCell.x &&
    gameState.shieldToken.y === playerCell.y;

  if (hitLifeToken) {
    gameState.lives += 1;
    clearLifeToken();
    saveProgress();
    updateHUD();
    return;
  }

  if (hitShieldToken) {
    activateShield();
    clearShieldToken();
    playShieldPickupSound();
    return;
  }

  if (!hitSpike) {
    return;
  }

  if (hasActiveShield()) {
    clearSpike();
    scheduleNextSpike();
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
  saveProgress();
  updateHUD();
  scheduleNextSpike();
}

// Interpolate player position between grid cells.
function updatePlayerAnimation() {
  if (!gameState.player.isMoving) {
    checkCollision();
    return;
  }

  const elapsed = performance.now() - gameState.player.moveStartedAt;
  const progress = Math.min(elapsed / gameState.player.moveDuration, 1);
  const eased = progress;
  gameState.player.x = lerp(gameState.player.moveStartX, gameState.player.targetX, eased);
  gameState.player.y = lerp(gameState.player.moveStartY, gameState.player.targetY, eased);

  if (progress >= 1) {
    gameState.player.x = gameState.player.targetX;
    gameState.player.y = gameState.player.targetY;
    gameState.player.isMoving = false;
    checkCollision();
    startQueuedMove();
  }
}

function startQueuedMove() {
  if (!gameState.isGameRunning || gameState.player.isMoving || !gameState.player.queuedDirection) {
    return;
  }

  const direction = gameState.player.queuedDirection;
  gameState.player.queuedDirection = null;
  movePlayer(direction);
}

// Spawn a wave of spikes based on the current level.
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
    gameState.activeSpikes.push({
      ...candidate,
      currentX: candidate.x,
      currentY: candidate.y,
      isMoving: false,
      moveDirection: null,
      targetX: candidate.x,
      targetY: candidate.y
    });

    if (gameState.activeSpikes.length === spikeCount) {
      break;
    }
  }

  prepareMovingSpikes();
  prepareHomingSpikes();

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

// Mark eligible level 11-20 spikes to move forward.
function prepareMovingSpikes() {
  if (gameState.difficulty !== "hard" || gameState.level < 11 || gameState.level > 20) {
    return;
  }

  const eligibleSpikes = gameState.activeSpikes.filter((spike) => countForwardPathCells(spike) > 1);
  if (eligibleSpikes.length === 0) {
    return;
  }

  const movingCount = Math.max(1, Math.ceil(eligibleSpikes.length * 0.2));
  shuffleArray(eligibleSpikes).slice(0, movingCount).forEach((spike) => {
    const direction = getSpikeMoveDirection(spike.side);
    const distance = countForwardPathCells(spike);
    spike.isMoving = true;
    spike.moveDirection = direction;
    spike.targetX = spike.x + direction.x * distance;
    spike.targetY = spike.y + direction.y * distance;
  });
}

// Update forward-moving and homing spikes each frame.
function updateMovingSpikes(deltaSeconds) {
  if (gameState.activeSpikes.length === 0) {
    return;
  }

  const speed = 3.2;
  const now = performance.now();
  gameState.activeSpikes = gameState.activeSpikes.filter((spike) => {
    if (spike.isHoming) {
      if (now >= spike.homingEndsAt) {
        return false;
      }

      const targetX = gameState.player.x;
      const targetY = gameState.player.y;
      const deltaX = targetX - spike.currentX;
      const deltaY = targetY - spike.currentY;
      const distance = Math.hypot(deltaX, deltaY);

      if (distance < 0.02) {
        return true;
      }

      const step = Math.min(speed * deltaSeconds, distance);
      spike.currentX += (deltaX / distance) * step;
      spike.currentY += (deltaY / distance) * step;
      return true;
    }

    if (!spike.isMoving || !spike.moveDirection) {
      return true;
    }

    const step = speed * deltaSeconds;
    const remainingX = spike.targetX - spike.currentX;
    const remainingY = spike.targetY - spike.currentY;
    const remainingDistance = Math.abs(remainingX) + Math.abs(remainingY);

    if (remainingDistance <= step) {
      return false;
    }

    spike.currentX += spike.moveDirection.x * step;
    spike.currentY += spike.moveDirection.y * step;
    return true;
  });
}

// Mark random level 21+ spikes to chase the player.
function prepareHomingSpikes() {
  if (gameState.difficulty !== "hard" || gameState.level < 21 || gameState.activeSpikes.length === 0) {
    return;
  }

  const homingCount = Math.max(1, Math.ceil(gameState.activeSpikes.length * 0.1));
  shuffleArray([...gameState.activeSpikes]).slice(0, homingCount).forEach((spike) => {
    spike.isMoving = false;
    spike.moveDirection = null;
    spike.isHoming = true;
    spike.homingEndsAt = performance.now() + 5000;
  });
}

function countForwardPathCells(spike) {
  const direction = getSpikeMoveDirection(spike.side);
  let x = spike.x + direction.x;
  let y = spike.y + direction.y;
  let count = 0;

  while (gameState.maze[y]?.[x] === PATH) {
    count += 1;
    x += direction.x;
    y += direction.y;
  }

  return count;
}

function getSpikeMoveDirection(side) {
  if (side === "top") return { x: 0, y: 1 };
  if (side === "bottom") return { x: 0, y: -1 };
  if (side === "left") return { x: 1, y: 0 };
  return { x: -1, y: 0 };
}

function getSpikeDrawPosition(spike) {
  return {
    x: spike.currentX ?? spike.x,
    y: spike.currentY ?? spike.y
  };
}

function getSpikeCollisionCell(spike) {
  const position = getSpikeDrawPosition(spike);
  return {
    x: Math.floor(position.x + 0.5),
    y: Math.floor(position.y + 0.5)
  };
}

// Spawn bonus life token on every 7th level.
function spawnLifeTokenForLevel() {
  if (gameState.level % 7 !== 0) {
    return;
  }

  const candidates = [];
  for (let y = 1; y < GRID_ROWS - 1; y += 1) {
    for (let x = 1; x < GRID_COLS - 1; x += 1) {
      if (
        gameState.maze[y][x] === PATH &&
        !isImportantCell(x, y) &&
        !isPlayerCell(x, y)
      ) {
        candidates.push({ x, y });
      }
    }
  }

  if (candidates.length === 0) {
    return;
  }

  gameState.lifeToken = candidates[Math.floor(Math.random() * candidates.length)];
  gameState.lifeTokenTimeoutId = window.setTimeout(clearLifeToken, 15000);
}

function clearLifeToken() {
  gameState.lifeToken = null;

  if (gameState.lifeTokenTimeoutId) {
    window.clearTimeout(gameState.lifeTokenTimeoutId);
    gameState.lifeTokenTimeoutId = null;
  }
}

// Randomly spawn a temporary shield token from level 6 onward.
function spawnShieldTokenForLevel() {
  if (gameState.level < 6 || Math.random() >= 0.25) {
    return;
  }

  const candidates = [];
  for (let y = 1; y < GRID_ROWS - 1; y += 1) {
    for (let x = 1; x < GRID_COLS - 1; x += 1) {
      if (
        gameState.maze[y][x] === PATH &&
        !isImportantCell(x, y) &&
        !isPlayerCell(x, y) &&
        !isLifeTokenCell(x, y)
      ) {
        candidates.push({ x, y });
      }
    }
  }

  if (candidates.length === 0) {
    return;
  }

  gameState.shieldToken = candidates[Math.floor(Math.random() * candidates.length)];
  gameState.shieldTokenTimeoutId = window.setTimeout(clearShieldToken, 15000);
}

function clearShieldToken() {
  gameState.shieldToken = null;

  if (gameState.shieldTokenTimeoutId) {
    window.clearTimeout(gameState.shieldTokenTimeoutId);
    gameState.shieldTokenTimeoutId = null;
  }
}

function activateShield() {
  gameState.shieldActiveUntil = performance.now() + 10000;

  if (gameState.shieldTimeoutId) {
    window.clearTimeout(gameState.shieldTimeoutId);
  }

  gameState.shieldTimeoutId = window.setTimeout(() => {
    clearShieldEffect();
    playShieldExpireSound();
  }, 10000);
}

function clearShieldEffect() {
  gameState.shieldActiveUntil = 0;

  if (gameState.shieldTimeoutId) {
    window.clearTimeout(gameState.shieldTimeoutId);
    gameState.shieldTimeoutId = null;
  }
}

function hasActiveShield() {
  return gameState.shieldActiveUntil > performance.now();
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
  }, getSpikeSpawnDelay());
}

// Sync level, lives, and score text.
function updateHUD() {
  gameState.highScore = Math.max(gameState.highScore, loadHighScore());
  hud.homeHighScore.textContent = gameState.highScore;
  hud.levelText.textContent = gameState.level;
  hud.livesText.textContent = gameState.lives;
  hud.gameHighScore.textContent = gameState.highScore;
  hud.difficultyText.textContent = formatDifficulty(gameState.difficulty);
  hud.finalLevelText.textContent = gameState.level;
  hud.endHighScore.textContent = gameState.highScore;
}

// Persist unfinished run progress.
function saveProgress() {
  if (!gameState.isGameRunning || gameState.lives <= 0) {
    return;
  }

  localStorage.setItem(
    "mazeBallProgress",
    JSON.stringify({
      level: gameState.level,
      lives: gameState.lives,
      difficulty: gameState.difficulty
    })
  );
  updateContinueButton();
}

function loadSavedProgress() {
  try {
    const progress = JSON.parse(localStorage.getItem("mazeBallProgress"));
    if (
      !progress ||
      !Number.isInteger(progress.level) ||
      !Number.isInteger(progress.lives) ||
      progress.level < 1 ||
      progress.lives < 1
    ) {
      return null;
    }

    return progress;
  } catch {
    return null;
  }
}

function loadSelectedDifficulty() {
  const savedDifficulty = localStorage.getItem("mazeBallDifficulty");
  return savedDifficulty === "hard" ? "hard" : "easy";
}

function saveSelectedDifficulty() {
  localStorage.setItem("mazeBallDifficulty", gameState.difficulty);
}

function updateDifficultySelection() {
  document.querySelectorAll("[data-difficulty]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.difficulty === gameState.difficulty);
  });
}

function formatDifficulty(difficulty) {
  return difficulty === "hard" ? "Hard" : "Easy";
}

function getSpikeSpawnDelay() {
  return gameState.difficulty === "hard"
    ? randomBetween(3000, 7000)
    : randomBetween(5000, 10000);
}

function clearSavedProgress() {
  localStorage.removeItem("mazeBallProgress");
  updateContinueButton();
}

function updateContinueButton() {
  if (!buttons.continueButton) {
    return;
  }

  const progress = loadSavedProgress();
  buttons.continueButton.hidden = !progress;

  if (progress) {
    buttons.continueButton.textContent = `Continue ${formatDifficulty(progress.difficulty || "easy")} Level ${progress.level}`;
  }
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

function loadControlsVisibility() {
  return localStorage.getItem("mazeBallControlsVisible") !== "false";
}

function saveControlsVisibility() {
  localStorage.setItem("mazeBallControlsVisible", String(gameState.controls.isVisible));
}

function toggleControlsVisibility() {
  stopControlPress();
  gameState.controls.isVisible = !gameState.controls.isVisible;
  saveControlsVisibility();
  updateControlsVisibility();
}

function updateControlsVisibility() {
  const controls = document.querySelector(".controls");
  const toggle = document.getElementById("controlsToggle");

  controls.classList.toggle("controls-hidden", !gameState.controls.isVisible);
  hud.controlsToggleIcon.classList.toggle("is-hidden", !gameState.controls.isVisible);
  toggle.setAttribute("aria-pressed", String(gameState.controls.isVisible));
  toggle.setAttribute(
    "aria-label",
    gameState.controls.isVisible ? "Hide directional controls" : "Show directional controls"
  );
}

// Resize canvas while keeping grid collision coordinates stable.
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

function isLifeTokenCell(x, y) {
  return Boolean(gameState.lifeToken && gameState.lifeToken.x === x && gameState.lifeToken.y === y);
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

// Lazily create browser audio after user interaction.
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

function playShieldPickupSound() {
  const audioContext = ensureAudioContext();
  if (!audioContext) {
    return;
  }

  const now = audioContext.currentTime;
  playTone(440, now, 0.1, "triangle", 0.06);
  playTone(659.25, now + 0.08, 0.14, "sine", 0.08);
  playTone(987.77, now + 0.18, 0.18, "sine", 0.06);
}

function playShieldExpireSound() {
  const audioContext = ensureAudioContext();
  if (!audioContext) {
    return;
  }

  const now = audioContext.currentTime;
  playTone(659.25, now, 0.1, "triangle", 0.045);
  playTone(493.88, now + 0.08, 0.14, "triangle", 0.04);
  playTone(329.63, now + 0.18, 0.18, "sine", 0.035);
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

// Let the joystick be repositioned inside the maze panel.
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

// Bind swipe and swipe-hold movement on the maze panel.
function bindSwipeControls() {
  const panel = document.getElementById("canvasWrap");

  panel.addEventListener("pointerdown", (event) => {
    if (!gameState.isGameRunning || event.target.closest(".controls")) {
      return;
    }

    event.preventDefault();
    gameState.swipe.pointerId = event.pointerId;
    gameState.swipe.startX = event.clientX;
    gameState.swipe.startY = event.clientY;
    gameState.swipe.isTracking = true;
    gameState.swipe.hasMoved = false;
    gameState.swipe.activeDirection = null;
    panel.setPointerCapture(event.pointerId);
  });

  panel.addEventListener("pointermove", (event) => {
    if (!gameState.swipe.isTracking || gameState.swipe.pointerId !== event.pointerId) {
      return;
    }

    event.preventDefault();
    handleSwipeMove(event.clientX, event.clientY);
  });

  panel.addEventListener("pointerup", (event) => {
    if (!gameState.swipe.isTracking || gameState.swipe.pointerId !== event.pointerId) {
      return;
    }

    event.preventDefault();
    handleSwipeMove(event.clientX, event.clientY);
    cancelSwipe(panel, event.pointerId);
  });

  panel.addEventListener("pointercancel", (event) => {
    if (gameState.swipe.pointerId === event.pointerId) {
      cancelSwipe(panel, event.pointerId);
    }
  });
}

function handleSwipeMove(endX, endY) {
  if (!gameState.isGameRunning || gameState.page !== "game") {
    return;
  }

  const deltaX = endX - gameState.swipe.startX;
  const deltaY = endY - gameState.swipe.startY;
  const absX = Math.abs(deltaX);
  const absY = Math.abs(deltaY);

  if (Math.max(absX, absY) < gameState.swipe.threshold) {
    return;
  }

  const direction = absX > absY
    ? (deltaX > 0 ? "right" : "left")
    : (deltaY > 0 ? "down" : "up");

  if (!gameState.swipe.hasMoved) {
    movePlayer(direction);
    gameState.swipe.hasMoved = true;
  }

  if (gameState.swipe.activeDirection !== direction) {
    startSwipeRepeat(direction);
  }
}

function cancelSwipe(panel, pointerId) {
  stopSwipeRepeat();
  gameState.swipe.isTracking = false;
  gameState.swipe.pointerId = null;
  gameState.swipe.hasMoved = false;
  gameState.swipe.activeDirection = null;

  if (panel.hasPointerCapture?.(pointerId)) {
    panel.releasePointerCapture(pointerId);
  }
}

function startSwipeRepeat(direction) {
  stopSwipeRepeat();
  gameState.swipe.activeDirection = direction;
  gameState.swipe.holdStartedAt = performance.now();
  scheduleSwipeRepeat();
}

function stopSwipeRepeat() {
  if (gameState.swipe.repeatIntervalId) {
    window.clearTimeout(gameState.swipe.repeatIntervalId);
    gameState.swipe.repeatIntervalId = null;
  }
}

function scheduleSwipeRepeat() {
  if (!gameState.swipe.activeDirection || !gameState.swipe.isTracking) {
    return;
  }

  gameState.swipe.repeatIntervalId = window.setTimeout(() => {
    movePlayer(gameState.swipe.activeDirection);
    scheduleSwipeRepeat();
  }, getSwipeRepeatDelay());
}

function getSwipeHoldElapsed() {
  if (!gameState.swipe.activeDirection || !gameState.swipe.holdStartedAt) {
    return 0;
  }

  return performance.now() - gameState.swipe.holdStartedAt;
}

function getSwipeSpeedFactor() {
  const elapsed = getSwipeHoldElapsed();
  return Math.min(elapsed / 1600, 1);
}

function getSwipeRepeatDelay() {
  return Math.round(125 - 40 * getSwipeSpeedFactor());
}

function getCurrentMoveDuration() {
  return Math.round(85 - 15 * getSwipeSpeedFactor());
}

function endControlDrag(event, controls) {
  if (gameState.controls.pointerId !== event.pointerId) {
    return;
  }

  gameState.controls.isDragging = false;
  gameState.controls.pointerId = null;
  controls.classList.remove("is-dragging");
}

function startControlPress(direction) {
  stopControlPress();
  gameState.controls.holdDirection = direction;
  movePlayer(direction);
  gameState.controls.holdIntervalId = window.setInterval(() => {
    movePlayer(gameState.controls.holdDirection);
  }, 85);
}

function stopControlPress() {
  if (gameState.controls.holdIntervalId) {
    window.clearInterval(gameState.controls.holdIntervalId);
    gameState.controls.holdIntervalId = null;
  }

  gameState.controls.holdDirection = null;
}

function startKeyboardPress(direction) {
  if (!gameState.keyboard.heldDirections.includes(direction)) {
    gameState.keyboard.heldDirections.push(direction);
  }

  movePlayer(direction);

  if (gameState.keyboard.holdIntervalId) {
    return;
  }

  gameState.keyboard.holdIntervalId = window.setInterval(() => {
    const activeDirection = gameState.keyboard.heldDirections.at(-1);
    if (activeDirection) {
      movePlayer(activeDirection);
    }
  }, 85);
}

function stopKeyboardPress(direction) {
  gameState.keyboard.heldDirections = gameState.keyboard.heldDirections.filter((item) => item !== direction);

  if (gameState.keyboard.heldDirections.length === 0) {
    stopKeyboardControls();
  }
}

function stopKeyboardControls() {
  if (gameState.keyboard.holdIntervalId) {
    window.clearInterval(gameState.keyboard.holdIntervalId);
    gameState.keyboard.holdIntervalId = null;
  }

  gameState.keyboard.heldDirections = [];
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
