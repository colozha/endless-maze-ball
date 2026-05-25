const DEBUG_PARAMS = new URLSearchParams(window.location.search);
const DEBUG_MODE = DEBUG_PARAMS.get("debug") === "1";
const DEBUG_FLAGS = {
  enabled: DEBUG_MODE,
  startLevel: Math.max(1, Number.parseInt(DEBUG_PARAMS.get("level"), 10) || 1),
  forcedDifficulty: DEBUG_PARAMS.get("difficulty") === "hard" ? "hard" : DEBUG_PARAMS.get("difficulty") === "easy" ? "easy" : null,
  forceMovingSpikes: DEBUG_PARAMS.get("forceMoving") === "1",
  forceHomingSpikes: DEBUG_PARAMS.get("forceHoming") === "1",
  forceLifeToken: DEBUG_PARAMS.get("forceLifeToken") === "1",
  forceShieldToken: DEBUG_PARAMS.get("forceShieldToken") === "1",
  noSpikes: DEBUG_PARAMS.get("noSpike") === "1",
  invincible: DEBUG_PARAMS.get("invincible") === "1"
};

const GAME_CONFIG = {
  grid: {
    cols: 13,
    rows: 21
  },
  player: {
    radius: 0.25,
    baseMoveDuration: 85,
    acceleratedMoveDurationReduction: 15
  },
  lives: {
    initial: 5
  },
  swipe: {
    threshold: 30,
    accelerationMs: 1600,
    repeatDelayMs: {
      base: 125,
      reduction: 40
    }
  },
  controls: {
    holdIntervalMs: 85
  },
  spikes: {
    visibleMs: {
      min: 2000,
      max: 4000
    },
    spawnDelayMs: {
      easy: { min: 5000, max: 10000 },
      hard: { min: 3000, max: 7000 }
    },
    moving: {
      levelMin: 11,
      levelMax: 20,
      ratio: 0.2,
      speedCellsPerSecond: 3.2
    },
    homing: {
      levelMin: 21,
      ratio: 0.1,
      durationMs: 5000,
      speedCellsPerSecond: 3.2
    },
    countByLevel: [
      { maxLevel: 5, min: 5, max: 10 },
      { maxLevel: 10, min: 8, max: 12 },
      { maxLevel: 15, min: 10, max: 16 },
      { maxLevel: 20, min: 20, max: 25 },
      { maxLevel: 25, min: 25, max: 30 },
      { maxLevel: 30, min: 30, max: 35 },
      { maxLevel: Infinity, min: 35, max: 50 }
    ]
  },
  tokens: {
    life: {
      everyLevels: 7,
      durationMs: 15000
    },
    shield: {
      levelMin: 6,
      spawnChance: 0.25,
      tokenDurationMs: 15000,
      effectDurationMs: 10000
    }
  }
};

const STORAGE_KEYS = {
  highScore: "mazeBallHighScore",
  progress: "mazeBallProgress",
  controlsVisible: "mazeBallControlsVisible",
  difficulty: "mazeBallDifficulty"
};

const GRID_COLS = GAME_CONFIG.grid.cols;
const GRID_ROWS = GAME_CONFIG.grid.rows;
const WALL = 1;
const PATH = 0;
const DIRECTION_BY_KEY = {
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
