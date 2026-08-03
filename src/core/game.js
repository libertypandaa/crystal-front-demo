import { Bonus, DEFAULT_SETTINGS, Owner, Turn } from "./constants.js";
import { areAdjacent, cloneCells, createBoard, findCascadeMatches, findLegalSwaps, findMatchesFromCells, getCell, refillAfterClear, refillAfterClearWithCapture, swapCrystals } from "./board.js";
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
    moveHistory: [],
    winner: null,
  };
}

export function selectCell(state, position) {
  if (state.turn !== Turn.Player || state.winner) return state;
  if (state.selectedBonus) return useBonus(state, state.selectedBonus, position);
  const target = getCell(state.cells, position.row, position.col);
  if (target?.owner !== getMovableOwner(Owner.Player)) {
    return { ...state, selected: null, events: [{ type: "MoveRejected", message: "Move red rival crystals to push blue forward." }] };
  }
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
  return runAiTurnWithTrace(state).state;
}

export function runAiTurnWithTrace(state) {
  if (state.turn !== Turn.AI || state.winner) return { state, trace: [] };
  const swaps = findLegalSwaps(state.cells, getMovableOwner(Owner.AI));

  if (swaps.length === 0) {
    const nextState = endOrPassTurn(state, Owner.AI);
    return { state: nextState, trace: [{ type: "noMoves", actor: Owner.AI, message: nextState.events.at(-1)?.message }] };
  }

  const rated = swaps
    .map((swap) => ({ swap, preview: previewMoveWithCascade(state.cells, swap, Owner.AI) }))
    .sort((a, b) => b.preview.score - a.preview.score);

  const difficulty = state.settings.aiDifficulty / 100;
  const choiceIndex = Math.min(rated.length - 1, Math.floor((1 - difficulty) * Math.random() * Math.min(8, rated.length)));
  const choice = rated[choiceIndex] ?? rated[0];

  return submitSwapTurn(state, choice.swap.from, choice.swap.to, Owner.AI, {
    aiDecision: {
      difficulty: state.settings.aiDifficulty,
      choiceRank: choiceIndex + 1,
      consideredMoves: rated.length,
      preview: choice.preview,
    },
  });
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
    moveHistory: (state.moveHistory ?? []).map((move) => ({
      ...move,
      from: move.from ? { ...move.from } : null,
      to: move.to ? { ...move.to } : null,
      matched: move.matched.map((match) => ({ cascade: match.cascade, ids: [...match.ids] })),
      capturedIds: [...move.capturedIds],
      resultingScores: { ...move.resultingScores },
    })),
    winner: state.winner,
    legalMoves: findLegalSwaps(state.cells, getMovableOwner(state.turn)).length,
  };
}

export function submitSwapTurn(state, from, to, actor, options = {}) {
  return applySwapCommandWithTrace(state, from, to, actor, options);
}

function applySwapCommand(state, from, to, actor) {
  return applySwapCommandWithTrace(state, from, to, actor).state;
}

function applySwapCommandWithTrace(state, from, to, actor, options = {}) {
  const fromCell = getCell(state.cells, from.row, from.col);
  const toCell = getCell(state.cells, to.row, to.col);
  const movableOwner = getMovableOwner(actor);
  if (!fromCell || !toCell || !areAdjacent(fromCell, toCell) || fromCell.owner !== movableOwner || toCell.owner !== movableOwner) {
    const nextState = {
      ...state,
      selected: null,
      selectedBonus: null,
      events: [{ type: "MoveRejected", message: actor === Owner.Player ? "Move red rival crystals to push blue forward." : "AI moves blue crystals to push red forward." }],
    };
    return {
      state: recordRejectedMove(nextState, actor, movableOwner, from, to, nextState.events[0].message),
      trace: [{ type: "rejected", actor, movableOwner, from, to, cells: cloneCells(state.cells), message: nextState.events[0].message }],
    };
  }

  const swapped = swapCrystals(state.cells, from, to);
  const matches = findMatchesFromCells(swapped, [from, to]);
  const trace = [{
    type: "swap",
    actor,
    movableOwner,
    from,
    to,
    cells: cloneCells(swapped),
    message: actor === Owner.Player ? "You move red crystals." : "AI moves blue crystals.",
  }];

  if (matches.length === 0) {
    const nextState = {
      ...state,
      selected: null,
      selectedBonus: null,
      events: [{ type: "MoveRejected", message: "No match. Choose a tactical swap." }],
    };
    return {
      state: recordRejectedMove(nextState, actor, movableOwner, from, to, nextState.events[0].message),
      trace: [...trace, { type: "rejected", actor, movableOwner, from, to, cells: cloneCells(state.cells), message: nextState.events[0].message }],
    };
  }

  return resolveTurnWithTrace({
    ...state,
    cells: swapped,
    selected: null,
    selectedBonus: null,
  }, actor, [{ type: "MoveAccepted", message: actor === Owner.Player ? "You move red crystals." : "AI moves blue crystals." }], trace, options);
}

function resolveTurn(state, actor, incomingEvents) {
  return resolveTurnWithTrace(state, actor, incomingEvents).state;
}

function resolveTurnWithTrace(state, actor, incomingEvents, incomingTrace = [], options = {}) {
  let cells = cloneCells(state.cells);
  let totalScore = 0;
  let cascade = 0;
  const events = [...incomingEvents];
  const trace = [...incomingTrace];
  let matches = findMatchesFromCells(cells, [trace[0]?.from, trace[0]?.to].filter(Boolean));

  while (cascade < 4) {
    if (matches.length === 0) break;
    if (cascade > 0 && !touchesEnemy(matches, actor)) break;
    cascade += 1;
    totalScore += scoreMatches(matches, actor);
    events.push({
      type: "CrystalsMatched",
      message: cascade > 1 ? `Cascade x${cascade}` : `${matches.length} crystals cleared`,
      cells: matches.map((cell) => cell.id),
    });
    trace.push({
      type: "match",
      actor,
      movableOwner: getMovableOwner(actor),
      cascade,
      matchedIds: matches.map((cell) => cell.id),
      cells: cloneCells(cells),
      message: cascade > 1 ? `Cascade x${cascade}` : `${matches.length} crystals cleared`,
    });
    const refill = refillAfterClearWithCapture(cells, matches, actor, state.rng);
    cells = refill.cells;
    trace.push({
      type: "refill",
      actor,
      movableOwner: getMovableOwner(actor),
      cascade,
      matchedIds: matches.map((cell) => cell.id),
      capturedIds: refill.capturedIds,
      cells: cloneCells(cells),
      message: cascade > 1 ? `Cascade refill x${cascade}` : "Front advances.",
    });
    if (refill.capturedIds.length > 0) {
      events.push({
        type: "FrontAdvanced",
        message: `${actor === Owner.Player ? "Your" : "Rival"} front captured ${refill.capturedIds.length}.`,
        cells: refill.capturedIds,
      });
      trace.push({
        type: "advance",
        actor,
        cascade,
        capturedIds: refill.capturedIds,
        cells: cloneCells(cells),
        message: actor === Owner.Player ? "Your territory moves forward." : "Rival territory moves forward.",
      });
    }
    matches = findCascadeMatches(cells, matches);
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

  const checkedState = checkWinner(nextState);
  const recordedState = recordAcceptedMove(checkedState, actor, trace, totalScore, cascade, scores, options.aiDecision);
  return {
    state: recordedState,
    trace: [
      ...trace,
      {
        type: "turnEnd",
        actor,
        cells: cloneCells(recordedState.cells),
        message: recordedState.events.at(-1)?.message,
      },
    ],
  };
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
  return matches.length;
}

function previewMoveWithCascade(cells, swap, actor) {
  let previewCells = swapCrystals(cells, swap.from, swap.to);
  let matches = findMatchesFromCells(previewCells, [swap.from, swap.to]);
  let cascadeCount = 0;
  let playerDestroyed = 0;
  let enemyDestroyed = 0;
  let capturedCount = 0;
  const rng = createRng((swap.from.row + 1) * 1000 + (swap.from.col + 1) * 100 + (swap.to.row + 1) * 10 + swap.to.col);

  while (matches.length > 0 && cascadeCount < 4) {
    if (cascadeCount > 0 && !touchesEnemy(matches, actor)) break;
    cascadeCount += 1;
    playerDestroyed += matches.filter((cell) => cell.owner === Owner.Player).length;
    enemyDestroyed += matches.filter((cell) => cell.owner === Owner.AI).length;
    const refill = refillAfterClearWithCapture(previewCells, matches, actor, rng);
    previewCells = refill.cells;
    capturedCount += refill.capturedIds.length;
    matches = findCascadeMatches(previewCells, matches);
  }

  const targetDestroyed = actor === Owner.AI ? playerDestroyed : enemyDestroyed;
  const ownDestroyed = actor === Owner.AI ? enemyDestroyed : playerDestroyed;
  return {
    createsMatch: cascadeCount > 0,
    playerDestroyed,
    enemyDestroyed,
    cascadeCount,
    capturedCount,
    score: targetDestroyed * 3 + cascadeCount * 2 + capturedCount - ownDestroyed,
  };
}

function touchesEnemy(matches, actor) {
  const enemy = actor === Owner.Player ? Owner.AI : Owner.Player;
  return matches.some((cell) => cell.owner === enemy);
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

function recordAcceptedMove(state, actor, trace, scoreGain, cascades, resultingScores, aiDecision = null) {
  const swap = trace.find((phase) => phase.type === "swap");
  const matched = trace
    .filter((phase) => phase.type === "match")
    .map((phase) => ({ cascade: phase.cascade, ids: [...phase.matchedIds] }));
  const capturedIds = trace.flatMap((phase) => phase.type === "advance" ? phase.capturedIds : []);

  return {
    ...state,
    moveHistory: [
      ...(state.moveHistory ?? []),
      {
        id: (state.moveHistory ?? []).length + 1,
        turnNumber: state.turnNumber,
        actor,
        movableOwner: swap?.movableOwner ?? getMovableOwner(actor),
        from: swap?.from ? { ...swap.from } : null,
        to: swap?.to ? { ...swap.to } : null,
        accepted: true,
        scoreGain,
        cascades,
        matched,
        capturedIds,
        resultingScores: { ...resultingScores },
        aiDecision: aiDecision ? {
          difficulty: aiDecision.difficulty,
          choiceRank: aiDecision.choiceRank,
          consideredMoves: aiDecision.consideredMoves,
          preview: { ...aiDecision.preview },
        } : null,
      },
    ],
  };
}

function recordRejectedMove(state, actor, movableOwner, from, to, reason) {
  return {
    ...state,
    moveHistory: [
      ...(state.moveHistory ?? []),
      {
        id: (state.moveHistory ?? []).length + 1,
        turnNumber: state.turnNumber,
        actor,
        movableOwner,
        from: from ? { ...from } : null,
        to: to ? { ...to } : null,
        accepted: false,
        reason,
        scoreGain: 0,
        cascades: 0,
        matched: [],
        capturedIds: [],
        resultingScores: { ...state.scores },
      },
    ],
  };
}

function getMovableOwner(actor) {
  if (actor === Owner.Player) return Owner.AI;
  if (actor === Owner.AI) return Owner.Player;
  return actor;
}
