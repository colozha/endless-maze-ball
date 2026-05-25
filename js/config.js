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
      durationMs: 7000,
      speedCellsPerSecond: 3.2
    },
    scaling: {
      baseCount: 5,
      countGrowthPerLevel: 1.12,
      randomSpread: 2,
      maxCount: 50,
      movingRatioStart: 0.1,
      movingRatioGrowth: 0.015,
      movingRatioMax: 0.28,
      homingRatioStart: 0.06,
      homingRatioGrowth: 0.008,
      homingRatioMax: 0.16
    }
  },
  bossLevel: {
    everyLevels: 10,
    wavePatterns: [
      { countMultiplier: 1.15, movingRatio: 0, homingRatio: 0 },
      { countMultiplier: 1.0, movingRatio: 0.32, homingRatio: 0 },
      { countMultiplier: 0.85, movingRatio: 0.12, homingRatio: 0.18 }
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
  },
  visual: {
    tokenSpawnMs: 260,
    tokenDespawnMs: 2000,
    particleCount: 14,
    particleDurationMs: 520,
    trailMaxPoints: 10,
    trailDurationMs: 260,
    shieldPulseMs: 520,
    levelTransitionMs: 900,
    themes: {
      blue: {
        minLevel: 1,
        maxLevel: 10,
        path: "#dbe7f5",
        wallStart: "#355b85",
        wallEnd: "#1f3755",
        spike: "#ff4f6d",
        homingSpike: "#70d8ff",
        homingGlow: "rgba(112, 216, 255, 0.7)"
      },
      orange: {
        minLevel: 11,
        maxLevel: 20,
        path: "#f4e4cf",
        wallStart: "#9a5a2c",
        wallEnd: "#3a2418",
        spike: "#ff6b3d",
        homingSpike: "#70d8ff",
        homingGlow: "rgba(112, 216, 255, 0.72)"
      },
      neon: {
        minLevel: 21,
        maxLevel: Infinity,
        path: "#101622",
        wallStart: "#3043ff",
        wallEnd: "#111735",
        spike: "#ff2bd6",
        homingSpike: "#21f6ff",
        homingGlow: "rgba(33, 246, 255, 0.78)"
      }
    }
  }
};

const STORAGE_KEYS = {
  highScore: "mazeBallHighScore",
  highScoreEasy: "mazeBallHighScoreEasy",
  highScoreHard: "mazeBallHighScoreHard",
  progress: "mazeBallProgress",
  controlsVisible: "mazeBallControlsVisible",
  difficulty: "mazeBallDifficulty",
  tutorialSeen: "mazeBallTutorialSeen"
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
