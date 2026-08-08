export const BOARD_SIZE = 8;

export const Crystal = Object.freeze({
  Yellow: "yellow",
  Green: "green",
  Purple: "purple",
  Cyan: "cyan",
});

export const Owner = Object.freeze({
  Player: "player",
  AI: "ai",
  Neutral: "neutral",
});

export const Turn = Object.freeze({
  Player: "player",
  AI: "ai",
  Ended: "ended",
});

export const Bonus = Object.freeze({
  Bomb: "bomb",
  Line: "line",
  Mix: "mix",
  Color: "color",
});

export const VictoryMode = Object.freeze({
  TargetScore: "target-score",
  LastMove: "last-move",
  AiDuel: "ai-duel",
});

export const DEFAULT_SETTINGS = Object.freeze({
  targetScore: 1000,
  aiDifficulty: 62,
  victoryMode: VictoryMode.TargetScore,
});

export const CRYSTALS = Object.freeze([
  Crystal.Yellow,
  Crystal.Green,
  Crystal.Purple,
  Crystal.Cyan,
]);
