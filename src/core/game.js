import { Bonus, DEFAULT_SETTINGS, Owner, Turn } from "./constants.js";
import { areAdjacent, cloneCells, createBoard, findLegalSwaps, findMatches, getCell, refillAfterClear, swapCrystals } from "./board.js";
import { createRng } from "./random.js";

export function createGame(seed = Date.now(), settings = DEFAULT_SETTINGS) {
  const rng = createRng(seed);

  return {
    rng,
    settings: { ...DEFAULT_SETTINGS, ...settings },
    cells: createBoard(rng),
    turn: Turn.Player,
    turnNumber: 1,
    scores: { player: 0, ai: 0 },
    profile: { rating: 1200, rays: 260 },
    bonuses: {
      [Bonus.Bomb]: 3,
      [Bonus.Line]: 3,
      [Bonus.Mix]: 2,
      [Bonus.Color]: 2,
    },
    selected: null,
    selectedBonus: null,
    events: [{ type: "MatchStarted", message: "Break enemy cells. Push the front." }],
    winner: null,
  };
}

export function selectCell(state, position) {
  if (state.turn !== Turn.Player || state.winner) return state;
  if (state.selectedBonus) return useBonus(state, state.selectedBonus, position);
  if (!state.selected) return { ...state, selected: position, events: [{ type: "CellSelected" }] };

  const from = getCell(state.cells, state.selected.row, state.selected.col);
  const to = getCell(state.cells, position.row, position.col);
  if (!areAdjacent(from, to)) return { ...state, selected: position, events: [{ type: "CellSelected" }] };

  return applySwapCommand(state, state.selected, position, Owner.Player);
}

export function selectBonus(state, bonus) {
  if (state.turn !== Turn.Player || state.winner) return state;
  if (state.bonuses[bonus] <= 0) {
    return { ...state, events: [{ type: "BonusUnavailable", message: "No bonus charges left." }] };
  }
  return { ...state, selected: null, selectedBonus: state.selectedBonus === bonus ? null : bonus };
}

export function runAiTurn(state) {
  if (state.turn !== Turn.AI || state.winner) return state;
  const swaps = findLegalSwaps(state.cells);

  if (swaps.length === 0) {
    return endOrPassTurn(state, Owner.AI);
  }

  const rated = swaps
    .map((swap) => ({ swap, score: previewSwapScore(state, swap, Owner.AI) }))
    .sort((a, b) => b.score - a.score);

  const difficulty = state.settings.aiDifficulty / 100;
  const choiceIndex = Math.min(rated.length - 1, Math.floor((1 - difficulty) * Math.random() * Math.min(8, rated.length)));
  const choice = rated[choiceIndex]?.swap ?? rated[0].swap;

  return applySwapCommand(state, choice.from, choice.to, Owner.AI);
}

export function restart(state) {
  return createGame(Date.now(), state.settings);
}

export function getSnapshot(state) {
  return {
    cells: state.cells.map((cell) => ({ ...cell })),
    turn: state.turn,
    turnNumber: state.turnNumber,
    scores: { ...state.scores },
    profile: { ...state.profile },
    bonuses: { ...state.bonuses },
    selected: state.selected,
    selectedBonus: state.selectedBonus,
    settings: { ...state.settings },
    events: state.events,
    winner: state.winner,
    legalMoves: findLegalSwaps(state.cells).length,
  };
}

function applySwapCommand(state, from, to, actor) {
  const swapped = swapCrystals(state.cells, from, to);
  const matches = findMatches(swapped);

  if (matches.length === 0) {
    return {
      ...state,
      selected: null,
      selectedBonus: null,
      events: [{ type: "MoveRejected", message: "No match. Choose a tactical swap." }],
    };
  }

  return resolveTurn({
    ...state,
    cells: swapped,
    selected: null,
    selectedBonus: null,
  }, actor, [{ type: "MoveAccepted", message: actor === Owner.Player ? "Player strike." : "AI strike." }]);
}

function resolveTurn(state, actor, incomingEvents) {
  let cells = cloneCells(state.cells);
  let totalScore = 0;
  let cascade = 0;
  const events = [...incomingEvents];

  while (cascade < 8) {
    const matches = findMatches(cells);
    if (matches.length === 0) break;
    cascade += 1;
    totalScore += scoreMatches(matches, actor) + Math.max(0, cascade - 1) * 2;
    events.push({
      type: "CrystalsMatched",
      message: cascade > 1 ? `Cascade x${cascade}` : `${matches.length} crystals cleared`,
      cells: matches.map((cell) => cell.id),
    });
    cells = refillAfterClear(cells, matches, actor, state.rng);
  }

  const scores = { ...state.scores };
  if (actor === Owner.Player) scores.player += totalScore;
  if (actor === Owner.AI) scores.ai += totalScore;

  const nextTurn = actor === Owner.Player ? Turn.AI : Turn.Player;
  const nextState = {
    ...state,
    cells,
    scores,
    turn: nextTurn,
    turnNumber: actor === Owner.AI ? state.turnNumber + 1 : state.turnNumber,
    events: [...events, { type: "ScoreChanged", message: `${actor === Owner.Player ? "You" : "AI"} gained ${totalScore}.` }],
  };

  return checkWinner(nextState);
}

function useBonus(state, bonus, position) {
  const targets = getBonusTargets(state.cells, bonus, position);
  if (targets.length === 0) return state;

  const bonuses = { ...state.bonuses, [bonus]: state.bonuses[bonus] - 1 };
  const baseScore = scoreMatches(targets, Owner.Player) + Math.max(1, Math.floor(targets.length / 3));
  const cells = refillAfterClear(state.cells, targets, Owner.Player, state.rng);
  const scores = { ...state.scores, player: state.scores.player + baseScore };

  return checkWinner({
    ...state,
    cells,
    scores,
    bonuses,
    selected: null,
    selectedBonus: null,
    turn: Turn.AI,
    events: [{ type: "BonusUsed", message: `${bonus.toUpperCase()} cleared ${targets.length} cells.` }],
  });
}

function getBonusTargets(cells, bonus, position) {
  const cell = getCell(cells, position.row, position.col);
  if (!cell) return [];

  if (bonus === Bonus.Bomb) {
    return cells.filter((candidate) => Math.abs(candidate.row - position.row) <= 1 && Math.abs(candidate.col - position.col) <= 1);
  }

  if (bonus === Bonus.Line) {
    return cells.filter((candidate) => candidate.row === position.row || candidate.col === position.col);
  }

  if (bonus === Bonus.Mix) {
    return cells.filter((candidate) => Math.abs(candidate.row - position.row) <= 1 && Math.abs(candidate.col - position.col) <= 1);
  }

  if (bonus === Bonus.Color) {
    return cells.filter((candidate) => candidate.crystal === cell.crystal);
  }

  return [];
}

function scoreMatches(matches, actor) {
  const enemy = actor === Owner.Player ? Owner.AI : Owner.Player;
  const enemyCells = matches.filter((cell) => cell.owner === enemy).length;
  const neutralCells = matches.filter((cell) => cell.owner === Owner.Neutral).length;
  return enemyCells * 3 + neutralCells;
}

function previewSwapScore(state, swap, actor) {
  const swapped = swapCrystals(state.cells, swap.from, swap.to);
  return scoreMatches(findMatches(swapped), actor);
}

function checkWinner(state) {
  const target = state.settings.targetScore;
  if (state.scores.player >= target || state.scores.ai >= target) {
    const winner = state.scores.player === state.scores.ai ? "draw" : state.scores.player > state.scores.ai ? Owner.Player : Owner.AI;
    return {
      ...state,
      turn: Turn.Ended,
      winner,
      events: [{ type: "MatchEnded", message: winner === "draw" ? "Draw." : `${winner === Owner.Player ? "You win" : "Rival wins"}.` }],
    };
  }

  return state;
}

function endOrPassTurn(state, actor) {
  return {
    ...state,
    turn: actor === Owner.AI ? Turn.Player : Turn.AI,
    turnNumber: actor === Owner.AI ? state.turnNumber + 1 : state.turnNumber,
    events: [{ type: "NoMoves", message: `${actor === Owner.AI ? "AI" : "Player"} has no scoring move.` }],
  };
}
