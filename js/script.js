// ===== DOM References =====
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const pages = {
  home: document.getElementById("homePage"),
  game: document.getElementById("gamePage"),
  end: document.getElementById("endPage")
};

const hud = {
  homeEasyHighScore: document.getElementById("homeEasyHighScore"),
  homeHardHighScore: document.getElementById("homeHardHighScore"),
  levelText: document.getElementById("levelText"),
  livesText: document.getElementById("livesText"),
  gameHighScore: document.getElementById("gameHighScore"),
  difficultyFlag: document.querySelector(".difficulty-flag"),
  difficultyText: document.getElementById("difficultyText"),
  finalLevelText: document.getElementById("finalLevelText"),
  endHighScore: document.getElementById("endHighScore"),
  controlsToggleIcon: document.getElementById("controlsToggleIcon"),
  bossFlag: document.getElementById("bossFlag")
};

const buttons = {
  continueButton: document.getElementById("continueButton"),
  pauseButton: document.getElementById("pauseButton"),
  resumeButton: document.getElementById("resumeButton"),
  restartPauseButton: document.getElementById("restartPauseButton"),
  homePauseButton: document.getElementById("homePauseButton"),
  tutorialDoneButton: document.getElementById("tutorialDoneButton")
};

const overlays = {
  levelTransition: document.getElementById("levelTransition"),
  levelTransitionText: document.getElementById("levelTransitionText"),
  pause: document.getElementById("pauseOverlay"),
  tutorial: document.getElementById("tutorialOverlay")
};

// ===== Runtime State =====
const gameState = {
  page: "home",
  level: 1,
  lives: GAME_CONFIG.lives.initial,
  maxLives: GAME_CONFIG.lives.initial,
  difficulty: "easy",
  highScore: {
    easy: 0,
    hard: 0
  },
  maze: [],
  player: {
    x: 0,
    y: 0,
    targetX: 0,
    targetY: 0,
    moveStartX: 0,
    moveStartY: 0,
    moveStartedAt: 0,
    moveDuration: GAME_CONFIG.player.baseMoveDuration,
    radius: GAME_CONFIG.player.radius,
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
  lifeTokenSpawnCount: 0,
  lifeTokenTimeoutId: null,
  shieldTokens: [],
  shieldTokenTimeoutId: null,
  shieldTimeoutId: null,
  shieldActiveUntil: 0,
  particles: [],
  playerTrail: [],
  levelTransitionTimeoutId: null,
  spikeTimeoutId: null,
  spikeClearTimeoutId: null,
  lastFrameTime: 0,
  isGameRunning: false,
  isPaused: false,
  pausedAt: 0,
  pausedTimers: {},
  bossWaveIndex: 0,
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
    threshold: GAME_CONFIG.swipe.threshold,
    repeatIntervalId: null,
    activeDirection: null,
    holdStartedAt: 0
  },
  audio: {
    context: null
  }
};

// ===== App Lifecycle =====
// Initialize saved state, UI, and first render.
function initGame() {
  migrateLegacyHighScore();
  gameState.highScore = loadHighScores();
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
    clearActiveRunState();
    showPage("home");
  });
  document.getElementById("controlsToggle").addEventListener("click", toggleControlsVisibility);
  buttons.pauseButton.addEventListener("click", pauseGame);
  buttons.resumeButton.addEventListener("click", resumeGame);
  buttons.restartPauseButton.addEventListener("click", restartGameFromPause);
  buttons.homePauseButton.addEventListener("click", backHomeFromPause);
  buttons.tutorialDoneButton.addEventListener("click", hideTutorial);
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
    if (event.key === "Escape" && gameState.page === "game") {
      event.preventDefault();
      if (gameState.isPaused) {
        resumeGame();
      } else {
        pauseGame();
      }
      return;
    }

    const direction = DIRECTION_BY_KEY[event.key];
    if (direction) {
      event.preventDefault();
      startKeyboardPress(direction);
    }
  });

  window.addEventListener("keyup", (event) => {
    const direction = DIRECTION_BY_KEY[event.key];
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
  updateThemeClass();
  updateContinueButton();
  updateHUD();
}

// Start a fresh run from level 1.
function startGame() {
  ensureAudioContext();
  clearSavedProgress();
  clearActiveRunState();
  resetPauseState();
  gameState.level = DEBUG_FLAGS.enabled ? DEBUG_FLAGS.startLevel : 1;
  gameState.lives = gameState.maxLives;
  gameState.difficulty = DEBUG_FLAGS.forcedDifficulty || loadSelectedDifficulty();
  gameState.bossWaveIndex = 0;
  updateDifficultySelection();
  gameState.isGameRunning = true;
  generateMaze();
  clearVisualEffects();
  saveProgress();
  showPage("game");
  resizeCanvas();
  if (showTutorialIfNeeded()) {
    drawGame();
    return;
  }
  startLevelRuntime();
}

function startLevelRuntime() {
  prepareLevelRuntime();
  gameState.lastFrameTime = performance.now();
  updateGame();
}

function prepareLevelRuntime() {
  spawnLifeTokenForLevel();
  spawnShieldTokenForLevel();
  activateAutoShieldForLevel();
  scheduleNextSpike();
}

// Resume saved progress with a newly generated maze.
function continueGame() {
  const progress = loadSavedProgress();
  if (!progress) {
    updateContinueButton();
    return;
  }

  ensureAudioContext();
  clearActiveRunState();
  resetPauseState();
  gameState.level = progress.level;
  gameState.lives = progress.lives;
  gameState.difficulty = progress.difficulty || "easy";
  gameState.bossWaveIndex = 0;
  saveSelectedDifficulty();
  updateDifficultySelection();
  gameState.isGameRunning = true;
  generateMaze();
  clearVisualEffects();
  saveProgress();
  showPage("game");
  resizeCanvas();
  if (showTutorialIfNeeded()) {
    drawGame();
    return;
  }
  startLevelRuntime();
}

// Stop the run, clear active timers, and show Game Over.
function endGame() {
  gameState.isGameRunning = false;
  clearActiveRunState();
  saveHighScore();
  clearSavedProgress();
  showPage("end");
}

// Advance to the next level and rebuild level hazards.
function nextLevel() {
  clearLevelTimers();
  gameState.level += 1;
  gameState.bossWaveIndex = 0;
  saveHighScore();
  saveProgress();
  generateMaze();
  clearVisualEffects();
  updateHUD();
  updateThemeClass();
  showLevelTransition();
  prepareLevelRuntime();
}

// ===== Maze Generation =====
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
  clearPlayerTrail();
}

// ===== Rendering =====
// Render the full game scene to canvas.
function drawGame() {
  if (!ctx) {
    return;
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const theme = getCurrentTheme();
  ctx.fillStyle = theme.path;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  drawCells();
  drawStartIcon(gameState.start);
  drawFinishIcon(gameState.finish);
  drawLifeToken();
  drawShieldTokens();
  drawSpikes();
  drawParticles();
  drawPlayerTrail();
  drawPlayer();
  drawDebugOverlay();
}

function drawCells() {
  const theme = getCurrentTheme();
  for (let y = 0; y < GRID_ROWS; y += 1) {
    for (let x = 0; x < GRID_COLS; x += 1) {
      if (gameState.maze[y]?.[x] !== WALL) {
        continue;
      }

      const rect = gridRect(x, y);
      const gradient = ctx.createLinearGradient(rect.x, rect.y, rect.x + rect.size, rect.y + rect.size);
      gradient.addColorStop(0, theme.wallStart);
      gradient.addColorStop(1, theme.wallEnd);
      ctx.fillStyle = gradient;
      ctx.fillRect(rect.x, rect.y, rect.size + 0.5, rect.size + 0.5);
    }
  }
}

function drawDebugOverlay() {
  if (!DEBUG_MODE) {
    return;
  }

  drawDebugGrid();
  drawDebugPanel();
}

function drawDebugGrid() {
  ctx.save();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.26)";
  ctx.lineWidth = 1;

  for (let x = 0; x <= GRID_COLS; x += 1) {
    const px = gameState.offsetX + x * gameState.cellSize;
    ctx.beginPath();
    ctx.moveTo(px, gameState.offsetY);
    ctx.lineTo(px, gameState.offsetY + GRID_ROWS * gameState.cellSize);
    ctx.stroke();
  }

  for (let y = 0; y <= GRID_ROWS; y += 1) {
    const py = gameState.offsetY + y * gameState.cellSize;
    ctx.beginPath();
    ctx.moveTo(gameState.offsetX, py);
    ctx.lineTo(gameState.offsetX + GRID_COLS * gameState.cellSize, py);
    ctx.stroke();
  }

  ctx.restore();
}

function drawDebugPanel() {
  const lines = [
    `debug=1`,
    `flags: ${getActiveDebugFlags().join(",") || "none"}`,
    `page: ${gameState.page}`,
    `level: ${gameState.level} (${gameState.difficulty})`,
    `lives: ${gameState.lives}`,
    `player: ${gameState.player.x.toFixed(2)}, ${gameState.player.y.toFixed(2)}`,
    `cell: ${Math.floor(gameState.player.x)}, ${Math.floor(gameState.player.y)}`,
    `spikes: ${gameState.activeSpikes.length}`,
    `moving: ${gameState.activeSpikes.filter((spike) => spike.isMoving).length}`,
    `homing: ${gameState.activeSpikes.filter((spike) => spike.isHoming).length}`,
    `homingPlayer: ${gameState.activeSpikes.filter((spike) => spike.isHoming && spike.homingTargetMode === "player").length}`,
    `homingRandom: ${gameState.activeSpikes.filter((spike) => spike.isHoming && spike.homingTargetMode === "random").length}`,
    `lifeToken: ${gameState.lifeToken ? "on" : "off"}`,
    `shieldTokens: ${gameState.shieldTokens.length}`,
    `shield: ${hasActiveShield() ? "on" : "off"}`,
    `spawnDelay: ${getSpikeSpawnDelay()}ms`
  ];
  const padding = 8;
  const lineHeight = 14;
  const width = 240;
  const height = padding * 2 + lines.length * lineHeight;
  const x = gameState.offsetX + 8;
  const y = gameState.offsetY + 8;

  ctx.save();
  ctx.fillStyle = "rgba(3, 12, 20, 0.76)";
  ctx.fillRect(x, y, width, height);
  ctx.fillStyle = "#ffffff";
  ctx.font = "11px Consolas, monospace";
  ctx.textBaseline = "top";
  lines.forEach((line, index) => {
    ctx.fillText(line, x + padding, y + padding + index * lineHeight);
  });
  ctx.restore();
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
    const pulse = getShieldPulse();
    ctx.strokeStyle = `rgba(112, 216, 255, ${pulse.alpha})`;
    ctx.lineWidth = Math.max(3, radius * 0.24);
    ctx.beginPath();
    ctx.arc(center.x, center.y, radius * 1.38 * pulse.scale, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawSpikes() {
  const theme = getCurrentTheme();
  gameState.activeSpikes.forEach((spike) => {
    const drawPosition = getSpikeDrawPosition(spike);
    const rect = gridRect(drawPosition.x, drawPosition.y);

    if (!spike.isMoving && !spike.isHoming) {
      drawStaticWallSpike(rect, spike.side, theme.spike);
      return;
    }

    const center = gridCenter(drawPosition.x, drawPosition.y);
    const angle = getSpikeFacingAngle(spike);
    const length = rect.size * 0.46;
    const width = rect.size * 0.36;

    ctx.save();
    ctx.translate(center.x, center.y);
    ctx.rotate(angle);
    ctx.fillStyle = spike.isHoming ? theme.homingSpike : theme.spike;
    ctx.beginPath();
    ctx.moveTo(length, 0);
    ctx.lineTo(-length * 0.52, -width);
    ctx.lineTo(-length * 0.52, width);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  });
}

function drawStaticWallSpike(rect, side, color) {
  const pad = rect.size * 0.16;
  const depth = rect.size * 0.52;

  ctx.fillStyle = color;
  ctx.beginPath();

  if (side === "top") {
    ctx.moveTo(rect.x + pad, rect.y);
    ctx.lineTo(rect.x + rect.size - pad, rect.y);
    ctx.lineTo(rect.x + rect.size / 2, rect.y + depth);
  } else if (side === "bottom") {
    ctx.moveTo(rect.x + pad, rect.y + rect.size);
    ctx.lineTo(rect.x + rect.size - pad, rect.y + rect.size);
    ctx.lineTo(rect.x + rect.size / 2, rect.y + rect.size - depth);
  } else if (side === "left") {
    ctx.moveTo(rect.x, rect.y + pad);
    ctx.lineTo(rect.x, rect.y + rect.size - pad);
    ctx.lineTo(rect.x + depth, rect.y + rect.size / 2);
  } else {
    ctx.moveTo(rect.x + rect.size, rect.y + pad);
    ctx.lineTo(rect.x + rect.size, rect.y + rect.size - pad);
    ctx.lineTo(rect.x + rect.size - depth, rect.y + rect.size / 2);
  }

  ctx.closePath();
  ctx.fill();
}

function drawLifeToken() {
  if (!gameState.lifeToken) {
    return;
  }

  const visual = getTokenVisualState(gameState.lifeToken);
  const center = gridCenter(gameState.lifeToken.x, gameState.lifeToken.y);
  const size = gameState.cellSize * 0.26;
  ctx.save();
  ctx.globalAlpha = visual.alpha;
  ctx.translate(center.x, center.y);
  ctx.scale(visual.scale, visual.scale);
  ctx.translate(-center.x, -center.y);
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
  ctx.restore();
}

function drawShieldTokens() {
  if (gameState.shieldTokens.length === 0) {
    return;
  }

  gameState.shieldTokens.forEach((shieldToken) => {
    const visual = getTokenVisualState(shieldToken);
    const center = gridCenter(shieldToken.x, shieldToken.y);
    const size = gameState.cellSize * 0.36;
    ctx.save();
    ctx.globalAlpha = visual.alpha;
    ctx.translate(center.x, center.y);
    ctx.scale(visual.scale, visual.scale);
    ctx.translate(-center.x, -center.y);
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
    ctx.restore();
  });
}

// ===== Game Loop and Player Movement =====
// Main requestAnimationFrame loop.
function updateGame() {
  if (!gameState.isGameRunning || gameState.isPaused) {
    return;
  }

  const now = performance.now();
  const deltaSeconds = Math.min((now - gameState.lastFrameTime) / 1000, 0.05);
  gameState.lastFrameTime = now;
  updateMovingSpikes(deltaSeconds);
  updateParticles(deltaSeconds);
  updatePlayerTrail();
  updatePlayerAnimation();
  drawGame();
  gameState.animationFrameId = requestAnimationFrame(updateGame);
}

// Queue or start one-cell player movement.
function movePlayer(direction) {
  if (!gameState.isGameRunning || isInputBlocked() || gameState.page !== "game") {
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
  const hitShieldTokenIndex = gameState.shieldTokens.findIndex((shieldToken) => (
    shieldToken.x === playerCell.x &&
    shieldToken.y === playerCell.y
  ));
  const hitShieldToken = hitShieldTokenIndex >= 0 ? gameState.shieldTokens[hitShieldTokenIndex] : null;

  if (hitLifeToken) {
    gameState.lives += 1;
    spawnTokenParticles(gameState.lifeToken, "#ff4f6d");
    clearLifeToken();
    saveProgress();
    updateHUD();
    return;
  }

  if (hitShieldToken) {
    activateShield();
    spawnTokenParticles(hitShieldToken, "#70d8ff");
    removeShieldTokenAt(hitShieldTokenIndex);
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

  if (DEBUG_FLAGS.invincible) {
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

// ===== Hazards and Tokens =====
// Spawn a wave of spikes based on the current level.
function spawnSpike() {
  if (!gameState.isGameRunning || gameState.isPaused || gameState.page !== "game" || DEBUG_FLAGS.noSpikes) {
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
  const now = performance.now();
  gameState.activeSpikes = gameState.activeSpikes.filter((spike) => spike.isHoming && now < spike.homingEndsAt);
  const usedCells = new Set(gameState.activeSpikes.map((spike) => {
    const cell = getSpikeCollisionCell(spike);
    return `${cell.x},${cell.y}`;
  }));
  const spawnedSpikes = [];

  const spikeCount = getSpikeCountForLevel();

  for (const candidate of shuffledCandidates) {
    const key = `${candidate.x},${candidate.y}`;
    if (usedCells.has(key)) {
      continue;
    }

    usedCells.add(key);
    const spike = {
      ...candidate,
      currentX: candidate.x,
      currentY: candidate.y,
      isMoving: false,
      moveDirection: null,
      targetX: candidate.x,
      targetY: candidate.y,
      facingAngle: directionToAngle(getSpikeMoveDirection(candidate.side)),
      targetFacingAngle: directionToAngle(getSpikeMoveDirection(candidate.side))
    };
    gameState.activeSpikes.push(spike);
    spawnedSpikes.push(spike);

    if (spawnedSpikes.length === spikeCount) {
      break;
    }
  }

  prepareMovingSpikes(spawnedSpikes);
  prepareHomingSpikes(spawnedSpikes);
  advanceBossWave();

  const visibleMs = getSpikeVisibleDuration();
  scheduleTrackedTimeout("spikeClearTimeoutId", visibleMs, () => {
    gameState.activeSpikes = gameState.activeSpikes.filter((spike) => spike.isHoming && performance.now() < spike.homingEndsAt);
    scheduleNextSpike();
  });
}

function clearSpike(cancelSchedule = true) {
  gameState.activeSpikes = [];

  if (gameState.spikeClearTimeoutId) {
    window.clearTimeout(gameState.spikeClearTimeoutId);
    gameState.spikeClearTimeoutId = null;
  }
  delete gameState.pausedTimers.spikeClearTimeoutId;

  if (cancelSchedule && gameState.spikeTimeoutId) {
    window.clearTimeout(gameState.spikeTimeoutId);
    gameState.spikeTimeoutId = null;
  }
  if (cancelSchedule) {
    delete gameState.pausedTimers.spikeTimeoutId;
  }
}

// Mark eligible level 11-20 spikes to move forward.
function prepareMovingSpikes(spikes = gameState.activeSpikes) {
  if (
    spikes.length === 0 ||
    !DEBUG_FLAGS.forceMovingSpikes &&
    (
      gameState.difficulty !== "hard" ||
      (
        !isBossLevel() &&
        (
          gameState.level < GAME_CONFIG.spikes.moving.levelMin ||
          gameState.level > GAME_CONFIG.spikes.moving.levelMax
        )
      )
    )
  ) {
    return;
  }

  const eligibleSpikes = spikes.filter((spike) => countForwardPathCells(spike) > 1);
  if (eligibleSpikes.length === 0) {
    return;
  }

  const movingRatio = getMovingSpikeRatio();
  if (movingRatio <= 0) {
    return;
  }

  const movingCount = Math.max(1, Math.ceil(eligibleSpikes.length * movingRatio));
  shuffleArray(eligibleSpikes).slice(0, movingCount).forEach((spike) => {
    const direction = getSpikeMoveDirection(spike.side);
    const distance = countForwardPathCells(spike);
    spike.isMoving = true;
    spike.moveDirection = direction;
    spike.targetX = spike.x + direction.x * distance;
    spike.targetY = spike.y + direction.y * distance;
    spike.targetFacingAngle = directionToAngle(direction);
  });
}

// Update forward-moving and homing spikes each frame.
function updateMovingSpikes(deltaSeconds) {
  if (gameState.activeSpikes.length === 0) {
    return;
  }

  const movingSpeed = GAME_CONFIG.spikes.moving.speedCellsPerSecond;
  const homingSpeed = GAME_CONFIG.spikes.homing.speedCellsPerSecond;
  const now = performance.now();
  gameState.activeSpikes = gameState.activeSpikes.filter((spike) => {
    if (spike.isHoming) {
      return updateHomingSpike(spike, now, homingSpeed * deltaSeconds);
    }

    if (!spike.isMoving || !spike.moveDirection) {
      return true;
    }

    if (moveSpikeTowardTarget(spike, movingSpeed * deltaSeconds)) {
      return false;
    }
    updateSpikeFacingAngle(spike);
    return true;
  });
}

// Mark random level 21+ spikes as homing, split between player chase and random patrol.
function prepareHomingSpikes(spikes = gameState.activeSpikes) {
  if (
    spikes.length === 0 ||
    (
      !DEBUG_FLAGS.forceHomingSpikes &&
      (
        gameState.difficulty !== "hard" ||
        (!isBossLevel() && gameState.level < GAME_CONFIG.spikes.homing.levelMin)
      )
    )
  ) {
    return;
  }

  const homingCandidates = spikes.filter((spike) => !spike.isHoming);
  const homingRatio = getHomingSpikeRatio();
  if (homingCandidates.length === 0 || homingRatio <= 0) {
    return;
  }

  const homingCount = Math.max(1, Math.ceil(homingCandidates.length * homingRatio));
  const selectedSpikes = shuffleArray([...homingCandidates]).slice(0, homingCount);
  const playerChaseCount = Math.floor(selectedSpikes.length * GAME_CONFIG.spikes.homing.playerChaseRatio);

  selectedSpikes.forEach((spike, index) => {
    const pathCell = getSpikePathCell(spike);
    spike.currentX = pathCell.x;
    spike.currentY = pathCell.y;
    spike.isMoving = false;
    spike.moveDirection = null;
    spike.isHoming = true;
    spike.targetX = null;
    spike.targetY = null;
    spike.pathCells = [];
    spike.lastPathUpdateAt = 0;
    spike.lastObservedX = pathCell.x;
    spike.lastObservedY = pathCell.y;
    spike.stuckStartedAt = null;
    spike.homingTargetMode = index < playerChaseCount ? "player" : "random";
    spike.destinationCell = spike.homingTargetMode === "random"
      ? getRandomHomingDestinationCell(pathCell)
      : null;
    spike.targetFacingAngle = spike.facingAngle ?? directionToAngle(getSpikeMoveDirection(spike.side));
    spike.homingEndsAt = performance.now() + GAME_CONFIG.spikes.homing.durationMs;
  });
}

function updateHomingSpike(spike, now, step) {
  if (now >= spike.homingEndsAt) {
    return false;
  }

  const wasStuck = isHomingSpikeStuck(spike, now);
  updateHomingSpikeTarget(spike, now, wasStuck);
  if (!hasValidSpikeTarget(spike)) {
    return true;
  }

  prepareHomingTurn(spike);
  const reachedTarget = moveSpikeTowardTarget(spike, step, false);
  if (reachedTarget) {
    consumeReachedHomingCell(spike);
    spike.targetX = null;
    spike.targetY = null;
    updateHomingSpikeTarget(spike, now, true);
  }

  updateSpikeFacingAngle(spike);
  return true;
}

function updateHomingSpikeTarget(spike, now, forceRefresh = false) {
  const currentCell = getSpikePathCell(spike);
  const destinationCell = getHomingDestinationCell(spike, currentCell);
  if (!destinationCell) {
    spike.targetX = null;
    spike.targetY = null;
    spike.pathCells = [];
    return;
  }

  if (currentCell.x === destinationCell.x && currentCell.y === destinationCell.y) {
    spike.targetX = currentCell.x;
    spike.targetY = currentCell.y;
    spike.pathCells = [];
    return;
  }

  const isBetweenCells = Math.abs(spike.currentX - currentCell.x) + Math.abs(spike.currentY - currentCell.y) > 0.12;
  const shouldThrottlePathfinding = now - spike.lastPathUpdateAt < 120;

  if (!forceRefresh && isBetweenCells) {
    return;
  }

  if (!forceRefresh && shouldThrottlePathfinding) {
    if (!hasValidSpikeTarget(spike)) {
      setNextHomingTarget(spike);
    }
    return;
  }

  const pathCells = findPathCells(currentCell, destinationCell);
  spike.lastPathUpdateAt = now;

  if (pathCells.length === 0) {
    const fallbackCell = findNearestPathCell(currentCell);
    if (fallbackCell) {
      spike.currentX = fallbackCell.x;
      spike.currentY = fallbackCell.y;
    }
    if (spike.homingTargetMode === "random") {
      spike.destinationCell = getRandomHomingDestinationCell(currentCell);
    }
    spike.pathCells = [];
    spike.targetX = null;
    spike.targetY = null;
    return;
  }

  spike.pathCells = pathCells;
  setNextHomingTarget(spike);
}

function getHomingDestinationCell(spike, currentCell = getSpikePathCell(spike)) {
  if (spike.homingTargetMode !== "random") {
    return getPlayerTargetCell();
  }

  if (
    !spike.destinationCell ||
    (spike.destinationCell.x === currentCell.x && spike.destinationCell.y === currentCell.y)
  ) {
    spike.destinationCell = getRandomHomingDestinationCell(currentCell);
  }

  return spike.destinationCell;
}

function getPlayerTargetCell() {
  return {
    x: Math.floor(gameState.player.targetX),
    y: Math.floor(gameState.player.targetY)
  };
}

function getRandomHomingDestinationCell(currentCell) {
  const playerCell = getPlayerTargetCell();
  const candidates = [];

  for (let y = 1; y < GRID_ROWS - 1; y += 1) {
    for (let x = 1; x < GRID_COLS - 1; x += 1) {
      if (
        gameState.maze[y][x] !== PATH ||
        isImportantCell(x, y) ||
        (x === playerCell.x && y === playerCell.y) ||
        (x === currentCell.x && y === currentCell.y)
      ) {
        continue;
      }

      candidates.push({ x, y });
    }
  }

  if (candidates.length === 0) {
    return null;
  }

  return candidates[Math.floor(Math.random() * candidates.length)];
}

function findNextPathCell(startCell, targetCell) {
  const pathCells = findPathCells(startCell, targetCell);
  return pathCells[0] ?? null;
}

function findPathCells(startCell, targetCell) {
  if (gameState.maze[startCell.y]?.[startCell.x] !== PATH) {
    return [];
  }

  const queue = [startCell];
  const visited = new Set([cellKey(startCell.x, startCell.y)]);
  const previous = new Map();
  let bestCell = startCell;
  let bestDistance = manhattanDistance(startCell, targetCell);
  const directions = [
    { x: 0, y: -1 },
    { x: 1, y: 0 },
    { x: 0, y: 1 },
    { x: -1, y: 0 }
  ];

  while (queue.length > 0) {
    const current = queue.shift();
    const distance = manhattanDistance(current, targetCell);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestCell = current;
    }

    if (current.x === targetCell.x && current.y === targetCell.y) {
      bestCell = current;
      break;
    }

    directions.forEach((direction) => {
      const next = {
        x: current.x + direction.x,
        y: current.y + direction.y
      };
      const key = cellKey(next.x, next.y);

      if (visited.has(key) || gameState.maze[next.y]?.[next.x] !== PATH) {
        return;
      }

      visited.add(key);
      previous.set(key, current);
      queue.push(next);
    });
  }

  let step = visited.has(cellKey(targetCell.x, targetCell.y)) ? targetCell : bestCell;
  const pathCells = [];
  while (previous.has(cellKey(step.x, step.y))) {
    pathCells.unshift(step);
    const parent = previous.get(cellKey(step.x, step.y));
    step = parent;
  }

  return pathCells;
}

function moveSpikeTowardTarget(spike, step, updateFacingFromMovement = true) {
  const startX = spike.currentX;
  const startY = spike.currentY;
  const remainingX = spike.targetX - spike.currentX;
  const remainingY = spike.targetY - spike.currentY;
  const remainingDistance = Math.abs(remainingX) + Math.abs(remainingY);

  if (remainingDistance <= step) {
    spike.currentX = spike.targetX;
    spike.currentY = spike.targetY;
    if (updateFacingFromMovement) {
      updateSpikeFacingFromDelta(spike, spike.currentX - startX, spike.currentY - startY);
    }
    return true;
  }

  if (Math.abs(remainingX) > 0) {
    spike.currentX += Math.sign(remainingX) * step;
  } else if (Math.abs(remainingY) > 0) {
    spike.currentY += Math.sign(remainingY) * step;
  }

  if (updateFacingFromMovement) {
    updateSpikeFacingFromDelta(spike, spike.currentX - startX, spike.currentY - startY);
  }
  return false;
}

function setNextHomingTarget(spike) {
  const currentCell = getSpikePathCell(spike);
  while (
    spike.pathCells?.length > 0 &&
    spike.pathCells[0].x === currentCell.x &&
    spike.pathCells[0].y === currentCell.y
  ) {
    spike.pathCells.shift();
  }

  const nextCell = spike.pathCells?.[0];
  if (!nextCell || gameState.maze[nextCell.y]?.[nextCell.x] !== PATH) {
    spike.targetX = null;
    spike.targetY = null;
    spike.pathCells = [];
    return;
  }

  spike.targetX = nextCell.x;
  spike.targetY = nextCell.y;
  updateSpikeFacingTowardCell(spike, currentCell, nextCell);
}

function prepareHomingTurn(spike) {
  if (!spike.isHoming || !hasValidSpikeTarget(spike) || !spike.pathCells || spike.pathCells.length < 2) {
    return;
  }

  const distanceToTarget = Math.abs(spike.targetX - spike.currentX) + Math.abs(spike.targetY - spike.currentY);
  if (distanceToTarget > 0.42) {
    return;
  }

  const currentTarget = spike.pathCells[0];
  const nextTarget = spike.pathCells[1];
  updateSpikeFacingTowardCell(spike, currentTarget, nextTarget);
}

function consumeReachedHomingCell(spike) {
  if (
    spike.pathCells?.length > 0 &&
    spike.pathCells[0].x === spike.targetX &&
    spike.pathCells[0].y === spike.targetY
  ) {
    spike.pathCells.shift();
  }

  if (spike.homingTargetMode === "random" && (!spike.pathCells || spike.pathCells.length === 0)) {
    spike.destinationCell = getRandomHomingDestinationCell(getSpikePathCell(spike));
  }
}

function hasValidSpikeTarget(spike) {
  return (
    spike.targetX !== null &&
    spike.targetY !== null &&
    gameState.maze[spike.targetY]?.[spike.targetX] === PATH
  );
}

function isHomingSpikeStuck(spike, now) {
  const movedDistance = Math.abs(spike.currentX - spike.lastObservedX) + Math.abs(spike.currentY - spike.lastObservedY);
  if (movedDistance > 0.025 || !hasValidSpikeTarget(spike)) {
    spike.lastObservedX = spike.currentX;
    spike.lastObservedY = spike.currentY;
    spike.stuckStartedAt = null;
    return false;
  }

  if (!spike.stuckStartedAt) {
    spike.stuckStartedAt = now;
  }

  const isStuck = now - spike.stuckStartedAt > 320;
  if (isStuck) {
    const pathCell = getSpikePathCell(spike);
    spike.currentX = pathCell.x;
    spike.currentY = pathCell.y;
    spike.pathCells = [];
    spike.targetX = null;
    spike.targetY = null;
    spike.stuckStartedAt = null;
  }

  return isStuck;
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

function getSpikeFacingAngle(spike) {
  if (spike.facingAngle === undefined) {
    spike.facingAngle = directionToAngle(getSpikeMoveDirection(spike.side));
  }

  if (spike.targetFacingAngle === undefined) {
    spike.targetFacingAngle = spike.facingAngle;
  }

  return spike.facingAngle;
}

function updateSpikeFacingFromDelta(spike, deltaX, deltaY) {
  if (Math.abs(deltaX) < 0.001 && Math.abs(deltaY) < 0.001) {
    return;
  }

  setSpikeTargetFacingAngle(
    spike,
    Math.abs(deltaX) > Math.abs(deltaY)
      ? directionToAngle({ x: Math.sign(deltaX), y: 0 })
      : directionToAngle({ x: 0, y: Math.sign(deltaY) })
  );
}

function updateSpikeFacingTowardCell(spike, fromCell, toCell) {
  const deltaX = toCell.x - fromCell.x;
  const deltaY = toCell.y - fromCell.y;
  if (deltaX === 0 && deltaY === 0) {
    return;
  }

  setSpikeTargetFacingAngle(
    spike,
    Math.abs(deltaX) > Math.abs(deltaY)
      ? directionToAngle({ x: Math.sign(deltaX), y: 0 })
      : directionToAngle({ x: 0, y: Math.sign(deltaY) })
  );
}

function setSpikeTargetFacingAngle(spike, angle) {
  if (spike.targetFacingAngle !== undefined && Math.abs(normalizeAngle(angle - spike.targetFacingAngle)) < 0.001) {
    return;
  }

  spike.targetFacingAngle = angle;
}

function updateSpikeFacingAngle(spike) {
  if (spike.targetFacingAngle === undefined) {
    return;
  }

  if (spike.facingAngle === undefined) {
    spike.facingAngle = spike.targetFacingAngle;
    return;
  }

  const delta = normalizeAngle(spike.targetFacingAngle - spike.facingAngle);
  if (Math.abs(delta) < 0.015) {
    spike.facingAngle += delta;
    return;
  }

  spike.facingAngle += delta * 0.12;
}

function directionToAngle(direction) {
  if (direction.x > 0) return 0;
  if (direction.x < 0) return Math.PI;
  if (direction.y > 0) return Math.PI / 2;
  return -Math.PI / 2;
}

function normalizeAngle(angle) {
  let normalized = angle;
  while (normalized > Math.PI) normalized -= Math.PI * 2;
  while (normalized < -Math.PI) normalized += Math.PI * 2;
  return normalized;
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

function getSpikePathCell(spike) {
  const position = getSpikeDrawPosition(spike);
  const roundedCell = {
    x: Math.round(position.x),
    y: Math.round(position.y)
  };

  if (gameState.maze[roundedCell.y]?.[roundedCell.x] === PATH) {
    return roundedCell;
  }

  const sourceCell = {
    x: Math.round(spike.x),
    y: Math.round(spike.y)
  };
  return findNearestPathCell(roundedCell) || findNearestPathCell(sourceCell) || sourceCell;
}

function manhattanDistance(cellA, cellB) {
  return Math.abs(cellA.x - cellB.x) + Math.abs(cellA.y - cellB.y);
}

function findNearestPathCell(originCell) {
  const queue = [originCell];
  const visited = new Set([cellKey(originCell.x, originCell.y)]);
  const directions = [
    { x: 0, y: -1 },
    { x: 1, y: 0 },
    { x: 0, y: 1 },
    { x: -1, y: 0 }
  ];

  while (queue.length > 0) {
    const current = queue.shift();
    if (gameState.maze[current.y]?.[current.x] === PATH) {
      return current;
    }

    directions.forEach((direction) => {
      const next = {
        x: current.x + direction.x,
        y: current.y + direction.y
      };
      const key = cellKey(next.x, next.y);

      if (
        visited.has(key) ||
        next.x < 0 ||
        next.y < 0 ||
        next.x >= GRID_COLS ||
        next.y >= GRID_ROWS
      ) {
        return;
      }

      visited.add(key);
      queue.push(next);
    });
  }

  return null;
}

function cellKey(x, y) {
  return `${x},${y}`;
}

function spawnLifeTokenForLevel() {
  gameState.lifeTokenSpawnCount = 0;

  if (!shouldSpawnLifeTokenForLevel()) {
    return;
  }

  spawnLifeTokenAttempt();
}

function spawnLifeTokenAttempt(excludedCellKey = null) {
  const candidates = getTokenSpawnCandidates({
    excludeLifeToken: true,
    excludeShieldTokens: true,
    excludedCellKey
  });
  if (candidates.length === 0) {
    return;
  }

  const now = performance.now();
  gameState.lifeTokenSpawnCount += 1;
  gameState.lifeToken = {
    ...candidates[Math.floor(Math.random() * candidates.length)],
    spawnedAt: now,
    expiresAt: now + GAME_CONFIG.tokens.life.durationMs
  };
  scheduleTrackedTimeout("lifeTokenTimeoutId", GAME_CONFIG.tokens.life.durationMs, expireLifeToken);
}

function clearLifeToken() {
  gameState.lifeToken = null;
  gameState.lifeTokenSpawnCount = 0;

  if (gameState.lifeTokenTimeoutId) {
    window.clearTimeout(gameState.lifeTokenTimeoutId);
    gameState.lifeTokenTimeoutId = null;
  }
  delete gameState.pausedTimers.lifeTokenTimeoutId;
}

function expireLifeToken() {
  if (!gameState.lifeToken) {
    clearLifeToken();
    return;
  }

  const previousCellKey = cellKey(gameState.lifeToken.x, gameState.lifeToken.y);
  gameState.lifeToken = null;

  if (gameState.lifeTokenTimeoutId) {
    window.clearTimeout(gameState.lifeTokenTimeoutId);
    gameState.lifeTokenTimeoutId = null;
  }
  delete gameState.pausedTimers.lifeTokenTimeoutId;

  if (
    shouldRetryLifeTokenForLevel() &&
    gameState.lifeTokenSpawnCount < GAME_CONFIG.tokens.life.retryMaxSpawns
  ) {
    spawnLifeTokenAttempt(previousCellKey);
    if (gameState.lifeToken) {
      return;
    }
  }

  gameState.lifeTokenSpawnCount = 0;
}

function spawnShieldTokenForLevel() {
  const shieldTokenCount = getShieldTokenSpawnCount();
  if (shieldTokenCount <= 0) {
    return;
  }

  const candidates = getTokenSpawnCandidates({
    excludeLifeToken: true,
    excludeShieldTokens: true
  });
  if (candidates.length === 0) {
    return;
  }

  shuffleArray(candidates);
  const now = performance.now();
  gameState.shieldTokens = candidates.slice(0, shieldTokenCount).map((candidate) => ({
    ...candidate,
    spawnedAt: now,
    expiresAt: now + GAME_CONFIG.tokens.shield.tokenDurationMs
  }));
  scheduleTrackedTimeout("shieldTokenTimeoutId", GAME_CONFIG.tokens.shield.tokenDurationMs, clearShieldTokens);
}

function clearShieldTokens() {
  gameState.shieldTokens = [];

  if (gameState.shieldTokenTimeoutId) {
    window.clearTimeout(gameState.shieldTokenTimeoutId);
    gameState.shieldTokenTimeoutId = null;
  }
  delete gameState.pausedTimers.shieldTokenTimeoutId;
}

function removeShieldTokenAt(index) {
  if (index < 0 || index >= gameState.shieldTokens.length) {
    return;
  }

  gameState.shieldTokens.splice(index, 1);
  if (gameState.shieldTokens.length === 0) {
    clearShieldTokens();
  }
}

function activateShield(durationMs = GAME_CONFIG.tokens.shield.effectDurationMs) {
  gameState.shieldActiveUntil = performance.now() + durationMs;

  scheduleTrackedTimeout("shieldTimeoutId", durationMs, () => {
    clearShieldEffect();
    playShieldExpireSound();
  });
}

function clearShieldEffect() {
  gameState.shieldActiveUntil = 0;

  if (gameState.shieldTimeoutId) {
    window.clearTimeout(gameState.shieldTimeoutId);
    gameState.shieldTimeoutId = null;
  }
  delete gameState.pausedTimers.shieldTimeoutId;
}

function activateAutoShieldForLevel() {
  if (!shouldAutoShieldAtLevelStart()) {
    return;
  }

  activateShield(GAME_CONFIG.tokens.shield.autoStartDurationMs);
}

function scheduleTrackedTimeout(timerKey, delay, callback) {
  clearTrackedTimeout(timerKey);
  gameState[timerKey] = window.setTimeout(() => {
    gameState[timerKey] = null;
    delete gameState.pausedTimers[timerKey];
    callback();
  }, delay);
  gameState.pausedTimers[timerKey] = {
    delay,
    startedAt: performance.now(),
    callback
  };
}

function clearTrackedTimeout(timerKey) {
  if (gameState[timerKey]) {
    window.clearTimeout(gameState[timerKey]);
    gameState[timerKey] = null;
  }
  delete gameState.pausedTimers[timerKey];
}

function pauseTrackedTimers() {
  const now = performance.now();
  Object.entries(gameState.pausedTimers).forEach(([timerKey, timer]) => {
    if (!gameState[timerKey]) {
      return;
    }

    timer.remaining = Math.max(timer.delay - (now - timer.startedAt), 0);
    window.clearTimeout(gameState[timerKey]);
    gameState[timerKey] = null;
  });
}

function resumeTrackedTimers() {
  Object.entries(gameState.pausedTimers).forEach(([timerKey, timer]) => {
    if (gameState[timerKey]) {
      return;
    }

    scheduleTrackedTimeout(timerKey, timer.remaining ?? timer.delay, timer.callback);
  });
}

function shiftActiveExpirations(duration) {
  if (gameState.lifeToken) {
    gameState.lifeToken.spawnedAt += duration;
    gameState.lifeToken.expiresAt += duration;
  }

  gameState.shieldTokens.forEach((shieldToken) => {
    shieldToken.spawnedAt += duration;
    shieldToken.expiresAt += duration;
  });

  if (gameState.shieldActiveUntil > 0) {
    gameState.shieldActiveUntil += duration;
  }

  gameState.activeSpikes.forEach((spike) => {
    if (spike.homingEndsAt) {
      spike.homingEndsAt += duration;
    }
  });
}

function clearLevelTimers() {
  clearSpike();
  clearLifeToken();
  clearShieldTokens();
  clearShieldEffect();
  clearVisualEffects();
}

function clearActiveRunState() {
  stopControlPress();
  stopSwipeRepeat();
  stopKeyboardControls();
  stopGameLoop();
  clearLevelTimers();
  resetPauseState();
}

function pauseGame() {
  if (!gameState.isGameRunning || gameState.page !== "game" || gameState.isPaused) {
    return;
  }

  gameState.isPaused = true;
  gameState.pausedAt = performance.now();
  stopControlPress();
  stopSwipeRepeat();
  stopKeyboardControls();
  stopGameLoop();
  pauseTrackedTimers();
  overlays.pause.hidden = false;
}

function resumeGame() {
  if (!gameState.isPaused) {
    return;
  }

  const pausedDuration = performance.now() - gameState.pausedAt;
  shiftActiveExpirations(pausedDuration);

  if (gameState.player.isMoving) {
    gameState.player.moveStartedAt += pausedDuration;
  }

  gameState.isPaused = false;
  gameState.pausedAt = 0;
  overlays.pause.hidden = true;
  resumeTrackedTimers();
  gameState.lastFrameTime = performance.now();
  updateGame();
}

function restartGameFromPause() {
  overlays.pause.hidden = true;
  resetPauseState();
  startGame();
}

function backHomeFromPause() {
  saveProgress();
  overlays.pause.hidden = true;
  clearActiveRunState();
  showPage("home");
}

function resetPauseState() {
  gameState.isPaused = false;
  gameState.pausedAt = 0;
  gameState.pausedTimers = {};
  if (overlays.pause) {
    overlays.pause.hidden = true;
  }
}

function isInputBlocked() {
  return gameState.isPaused || !overlays.tutorial.hidden;
}

function hasActiveShield() {
  return gameState.shieldActiveUntil > performance.now();
}

function clearVisualEffects() {
  clearParticles();
  clearPlayerTrail();

  clearTrackedTimeout("levelTransitionTimeoutId");

  overlays.levelTransition?.classList.remove("is-active");
}

function scheduleNextSpike() {
  if (!gameState.isGameRunning || gameState.isPaused || DEBUG_FLAGS.noSpikes) {
    return;
  }

  scheduleTrackedTimeout("spikeTimeoutId", getSpikeSpawnDelay(), () => {
    spawnSpike();
  });
}

// ===== HUD, Storage, and Settings =====
// Sync level, lives, and score text.
function updateHUD() {
  gameState.highScore = loadHighScores();
  const activeHighScore = gameState.highScore[gameState.difficulty] || 0;
  hud.homeEasyHighScore.textContent = gameState.highScore.easy;
  hud.homeHardHighScore.textContent = gameState.highScore.hard;
  hud.levelText.textContent = gameState.level;
  hud.livesText.textContent = gameState.lives;
  hud.gameHighScore.textContent = activeHighScore;
  hud.difficultyText.textContent = formatDifficulty(gameState.difficulty);
  hud.difficultyFlag.classList.toggle("is-easy", gameState.difficulty === "easy");
  hud.difficultyFlag.classList.toggle("is-hard", gameState.difficulty === "hard");
  hud.bossFlag.hidden = !isBossLevel();
  hud.finalLevelText.textContent = gameState.level;
  hud.endHighScore.textContent = activeHighScore;
}

// Persist unfinished run progress.
function saveProgress() {
  if (!gameState.isGameRunning || gameState.lives <= 0) {
    return;
  }

  localStorage.setItem(
    STORAGE_KEYS.progress,
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
    const progress = JSON.parse(localStorage.getItem(STORAGE_KEYS.progress));
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
  const savedDifficulty = localStorage.getItem(STORAGE_KEYS.difficulty);
  return savedDifficulty === "hard" ? "hard" : "easy";
}

function saveSelectedDifficulty() {
  localStorage.setItem(STORAGE_KEYS.difficulty, gameState.difficulty);
}

function updateDifficultySelection() {
  document.querySelectorAll("[data-difficulty]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.difficulty === gameState.difficulty);
  });
}

function formatDifficulty(difficulty) {
  return difficulty === "hard" ? "Hard" : "Easy";
}

function getActiveDebugFlags() {
  if (!DEBUG_FLAGS.enabled) {
    return [];
  }

  const flags = [];
  if (DEBUG_FLAGS.startLevel > 1) flags.push(`level=${DEBUG_FLAGS.startLevel}`);
  if (DEBUG_FLAGS.forcedDifficulty) flags.push(`difficulty=${DEBUG_FLAGS.forcedDifficulty}`);
  if (DEBUG_FLAGS.forceMovingSpikes) flags.push("moving");
  if (DEBUG_FLAGS.forceHomingSpikes) flags.push("homing");
  if (DEBUG_FLAGS.forceLifeToken) flags.push("life");
  if (DEBUG_FLAGS.forceShieldToken) flags.push("shield");
  if (DEBUG_FLAGS.noSpikes) flags.push("noSpike");
  if (DEBUG_FLAGS.invincible) flags.push("invincible");
  return flags;
}

function getSpikeSpawnDelay() {
  return gameState.difficulty === "hard"
    ? randomBetween(GAME_CONFIG.spikes.spawnDelayMs.hard.min, GAME_CONFIG.spikes.spawnDelayMs.hard.max)
    : randomBetween(GAME_CONFIG.spikes.spawnDelayMs.easy.min, GAME_CONFIG.spikes.spawnDelayMs.easy.max);
}

function isBossLevel() {
  return (
    gameState.difficulty === "hard" &&
    gameState.level > 0 &&
    gameState.level % GAME_CONFIG.bossLevel.everyLevels === 0
  );
}

function getBossPattern() {
  if (!isBossLevel()) {
    return null;
  }

  return GAME_CONFIG.bossLevel.wavePatterns[
    gameState.bossWaveIndex % GAME_CONFIG.bossLevel.wavePatterns.length
  ];
}

function advanceBossWave() {
  if (isBossLevel()) {
    gameState.bossWaveIndex += 1;
  }
}

function getMovingSpikeRatio() {
  const bossPattern = getBossPattern();
  if (bossPattern) {
    return bossPattern.movingRatio;
  }

  if (gameState.level < GAME_CONFIG.spikes.moving.levelMin) {
    return 0;
  }

  const scaling = GAME_CONFIG.spikes.scaling;
  const levelOffset = gameState.level - GAME_CONFIG.spikes.moving.levelMin;
  return Math.min(
    scaling.movingRatioMax,
    scaling.movingRatioStart + levelOffset * scaling.movingRatioGrowth
  );
}

function getHomingSpikeRatio() {
  if (gameState.difficulty === "hard" && isLevel31Plus()) {
    return GAME_CONFIG.spikes.homing.hardLevel31Ratio;
  }

  const bossPattern = getBossPattern();
  if (bossPattern) {
    return bossPattern.homingRatio;
  }

  if (gameState.level < GAME_CONFIG.spikes.homing.levelMin) {
    return 0;
  }

  const scaling = GAME_CONFIG.spikes.scaling;
  const levelOffset = gameState.level - GAME_CONFIG.spikes.homing.levelMin;
  return Math.min(
    scaling.homingRatioMax,
    scaling.homingRatioStart + levelOffset * scaling.homingRatioGrowth
  );
}

function getCurrentThemeKey() {
  if (gameState.level <= GAME_CONFIG.visual.themes.blue.maxLevel) return "blue";
  if (gameState.level <= GAME_CONFIG.visual.themes.orange.maxLevel) return "orange";
  if (gameState.level <= GAME_CONFIG.visual.themes.neon.maxLevel) return "neon";
  return "abyss";
}

function getCurrentTheme() {
  return GAME_CONFIG.visual.themes[getCurrentThemeKey()];
}

function updateThemeClass() {
  const frame = document.querySelector(".game-frame");
  if (!frame) {
    return;
  }

  frame.classList.remove("theme-blue", "theme-orange", "theme-neon", "theme-abyss");
  frame.classList.add(`theme-${getCurrentThemeKey()}`);
}

function getTokenVisualState(token) {
  const now = performance.now();
  const spawnProgress = Math.min((now - token.spawnedAt) / GAME_CONFIG.visual.tokenSpawnMs, 1);
  const remaining = token.expiresAt - now;
  const despawnProgress = remaining < GAME_CONFIG.visual.tokenDespawnMs
    ? Math.max(remaining / GAME_CONFIG.visual.tokenDespawnMs, 0)
    : 1;
  const blink = remaining < GAME_CONFIG.visual.tokenDespawnMs
    ? 0.72 + Math.sin(now / 70) * 0.28
    : 1;

  return {
    scale: 0.4 + 0.6 * easeOutBack(spawnProgress),
    alpha: Math.min(spawnProgress, despawnProgress) * blink
  };
}

function getShieldPulse() {
  const wave = (Math.sin(performance.now() / GAME_CONFIG.visual.shieldPulseMs * Math.PI * 2) + 1) / 2;
  return {
    scale: 1 + wave * 0.1,
    alpha: (0.62 + wave * 0.28).toFixed(2)
  };
}

function showLevelTransition() {
  if (!overlays.levelTransition || !overlays.levelTransitionText) {
    return;
  }

  overlays.levelTransitionText.textContent = `Level ${gameState.level}`;
  overlays.levelTransition.classList.add("is-active");

  if (gameState.levelTransitionTimeoutId) {
    window.clearTimeout(gameState.levelTransitionTimeoutId);
  }

  scheduleTrackedTimeout("levelTransitionTimeoutId", GAME_CONFIG.visual.levelTransitionMs, () => {
    overlays.levelTransition.classList.remove("is-active");
  });
}

function clearSavedProgress() {
  localStorage.removeItem(STORAGE_KEYS.progress);
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

function shouldShowTutorial() {
  return localStorage.getItem(STORAGE_KEYS.tutorialSeen) !== "true";
}

function showTutorialIfNeeded() {
  if (!shouldShowTutorial()) {
    return false;
  }

  overlays.tutorial.hidden = false;
  return true;
}

function hideTutorial() {
  localStorage.setItem(STORAGE_KEYS.tutorialSeen, "true");
  overlays.tutorial.hidden = true;

  if (gameState.isGameRunning && gameState.page === "game" && !gameState.animationFrameId) {
    startLevelRuntime();
  }
}

function saveHighScore() {
  const currentHighScore = loadHighScore(gameState.difficulty);
  if (gameState.level > currentHighScore) {
    localStorage.setItem(getHighScoreKey(gameState.difficulty), String(gameState.level));
    gameState.highScore = loadHighScores();
  }
  updateHUD();
}

function loadHighScore(difficulty = gameState.difficulty) {
  return Number(localStorage.getItem(getHighScoreKey(difficulty))) || 0;
}

function loadHighScores() {
  return {
    easy: loadHighScore("easy"),
    hard: loadHighScore("hard")
  };
}

function getHighScoreKey(difficulty) {
  return difficulty === "hard" ? STORAGE_KEYS.highScoreHard : STORAGE_KEYS.highScoreEasy;
}

function migrateLegacyHighScore() {
  const legacyScore = Number(localStorage.getItem(STORAGE_KEYS.highScore)) || 0;
  if (legacyScore <= 0 || localStorage.getItem(STORAGE_KEYS.highScoreEasy)) {
    return;
  }

  localStorage.setItem(STORAGE_KEYS.highScoreEasy, String(legacyScore));
}

function loadControlsVisibility() {
  return localStorage.getItem(STORAGE_KEYS.controlsVisible) !== "false";
}

function saveControlsVisibility() {
  localStorage.setItem(STORAGE_KEYS.controlsVisible, String(gameState.controls.isVisible));
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

// ===== Layout and General Utilities =====
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

function isShieldTokenCell(x, y) {
  return gameState.shieldTokens.some((shieldToken) => shieldToken.x === x && shieldToken.y === y);
}

function isLevel21Plus() {
  return gameState.level >= GAME_CONFIG.tokens.shield.autoStartLevelMin;
}

function isLevel31Plus() {
  return gameState.level >= GAME_CONFIG.visual.themes.abyss.minLevel;
}

function shouldAutoShieldAtLevelStart() {
  return isLevel21Plus();
}

function shouldSpawnLifeTokenForLevel() {
  if (DEBUG_FLAGS.forceLifeToken) {
    return true;
  }

  if (isLevel31Plus()) {
    return gameState.level % 2 === 1;
  }

  return gameState.level % GAME_CONFIG.tokens.life.everyLevels === 0;
}

function shouldRetryLifeTokenForLevel() {
  return isLevel31Plus() && gameState.level % 2 === 1;
}

function getShieldTokenSpawnCount() {
  if (DEBUG_FLAGS.forceShieldToken) {
    return shouldSpawnDoubleShieldTokensForLevel()
      ? GAME_CONFIG.tokens.shield.doubleSpawnCount
      : 1;
  }

  if (shouldSpawnDoubleShieldTokensForLevel()) {
    return GAME_CONFIG.tokens.shield.doubleSpawnCount;
  }

  if (isLevel31Plus()) {
    return 0;
  }

  if (
    gameState.level < GAME_CONFIG.tokens.shield.levelMin ||
    Math.random() >= GAME_CONFIG.tokens.shield.spawnChance
  ) {
    return 0;
  }

  return 1;
}

function shouldSpawnDoubleShieldTokensForLevel() {
  return (
    gameState.level >= GAME_CONFIG.tokens.shield.doubleSpawnLevelMin &&
    gameState.level % GAME_CONFIG.tokens.shield.doubleSpawnEveryLevels === 0
  );
}

function getTokenSpawnCandidates({
  excludeLifeToken = false,
  excludeShieldTokens = false,
  excludedCellKey = null
} = {}) {
  const candidates = [];
  for (let y = 1; y < GRID_ROWS - 1; y += 1) {
    for (let x = 1; x < GRID_COLS - 1; x += 1) {
      if (
        gameState.maze[y][x] !== PATH ||
        isImportantCell(x, y) ||
        isPlayerCell(x, y) ||
        excludedCellKey === cellKey(x, y) ||
        (excludeLifeToken && isLifeTokenCell(x, y)) ||
        (excludeShieldTokens && isShieldTokenCell(x, y))
      ) {
        continue;
      }

      candidates.push({ x, y });
    }
  }

  return candidates;
}

function randomBetween(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFloat(min, max) {
  return Math.random() * (max - min) + min;
}

function getSpikeVisibleDuration() {
  const visibleMs = isLevel31Plus()
    ? GAME_CONFIG.spikes.visibleMs.nightmare
    : GAME_CONFIG.spikes.visibleMs.default;
  return randomBetween(visibleMs.min, visibleMs.max);
}

function getSpikeCountForLevel() {
  const scaling = GAME_CONFIG.spikes.scaling;
  const baseCount = scaling.baseCount + Math.floor((gameState.level - 1) * scaling.countGrowthPerLevel);
  const bossPattern = getBossPattern();
  const scaledCount = bossPattern ? Math.ceil(baseCount * bossPattern.countMultiplier) : baseCount;
  const spread = randomBetween(-scaling.randomSpread, scaling.randomSpread);
  return Math.max(1, Math.min(scaling.maxCount, scaledCount + spread));
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

function easeOutBack(progress) {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(progress - 1, 3) + c1 * Math.pow(progress - 1, 2);
}

function spawnTokenParticles(cell, color) {
  if (!cell) {
    return;
  }

  const center = gridCenter(cell.x, cell.y);
  for (let i = 0; i < GAME_CONFIG.visual.particleCount; i += 1) {
    const angle = randomFloat(0, Math.PI * 2);
    const speed = randomFloat(32, 92);
    gameState.particles.push({
      x: center.x,
      y: center.y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      color,
      radius: randomFloat(2, 4),
      age: 0,
      duration: GAME_CONFIG.visual.particleDurationMs / 1000
    });
  }
}

function updateParticles(deltaSeconds) {
  gameState.particles = gameState.particles.filter((particle) => {
    particle.age += deltaSeconds;
    particle.x += particle.vx * deltaSeconds;
    particle.y += particle.vy * deltaSeconds;
    particle.vx *= 0.94;
    particle.vy *= 0.94;
    return particle.age < particle.duration;
  });
}

function drawParticles() {
  gameState.particles.forEach((particle) => {
    const alpha = 1 - particle.age / particle.duration;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = particle.color;
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, particle.radius * alpha, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });
}

function clearParticles() {
  gameState.particles = [];
}

function updatePlayerTrail() {
  if (gameState.player.isMoving) {
    gameState.playerTrail.push({
      x: gameState.player.x,
      y: gameState.player.y,
      createdAt: performance.now()
    });
  }

  const now = performance.now();
  gameState.playerTrail = gameState.playerTrail
    .filter((point) => now - point.createdAt <= GAME_CONFIG.visual.trailDurationMs)
    .slice(-GAME_CONFIG.visual.trailMaxPoints);
}

function drawPlayerTrail() {
  const now = performance.now();
  gameState.playerTrail.forEach((point) => {
    const age = now - point.createdAt;
    const progress = Math.min(age / GAME_CONFIG.visual.trailDurationMs, 1);
    const alpha = (1 - progress) * 0.26;
    const center = gridToPixel(point.x, point.y);
    const radius = gameState.player.radius * gameState.cellSize * (1 - progress * 0.35);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = "#ffcf4d";
    ctx.beginPath();
    ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });
}

function clearPlayerTrail() {
  gameState.playerTrail = [];
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

// ===== Input Controls =====
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
  if (!gameState.isGameRunning || isInputBlocked() || gameState.page !== "game") {
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
  if (gameState.isPaused || !gameState.swipe.activeDirection || !gameState.swipe.isTracking) {
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
  return Math.min(elapsed / GAME_CONFIG.swipe.accelerationMs, 1);
}

function getSwipeRepeatDelay() {
  return Math.round(
    GAME_CONFIG.swipe.repeatDelayMs.base -
    GAME_CONFIG.swipe.repeatDelayMs.reduction * getSwipeSpeedFactor()
  );
}

function getCurrentMoveDuration() {
  return Math.round(
    GAME_CONFIG.player.baseMoveDuration -
    GAME_CONFIG.player.acceleratedMoveDurationReduction * getSwipeSpeedFactor()
  );
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
  if (isInputBlocked()) {
    return;
  }

  stopControlPress();
  gameState.controls.holdDirection = direction;
  movePlayer(direction);
  gameState.controls.holdIntervalId = window.setInterval(() => {
    movePlayer(gameState.controls.holdDirection);
  }, GAME_CONFIG.controls.holdIntervalMs);
}

function stopControlPress() {
  if (gameState.controls.holdIntervalId) {
    window.clearInterval(gameState.controls.holdIntervalId);
    gameState.controls.holdIntervalId = null;
  }

  gameState.controls.holdDirection = null;
}

function startKeyboardPress(direction) {
  if (isInputBlocked()) {
    return;
  }

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
  }, GAME_CONFIG.controls.holdIntervalMs);
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
