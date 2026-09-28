import assert from "node:assert/strict";
import { findLegalSwaps, getBoundaryCells } from "../src/core/board.js";
import { Bonus, Owner, Turn, VictoryMode } from "../src/core/constants.js";
import { createGame, getSnapshot, runAiTurnWithTrace, runComputerTurnWithTrace, selectBonus, selectCell, submitBonusTurn } from "../src/core/game.js";

let state = createGame(12345, { aiDifficulty: 62 });
let snapshot = getSnapshot(state);

assert.equal(snapshot.cells.length, 64);
assert.equal(snapshot.cells.filter((cell) => cell.owner === Owner.AI).length, 32);
assert.equal(snapshot.cells.filter((cell) => cell.owner === Owner.Player).length, 32);
assert.equal(snapshot.settings.targetScore, 50);
assert.equal(snapshot.moveHistory.length, 0);
assert.ok(findLegalSwaps(snapshot.cells).length > 0);

const move = findLegalSwaps(snapshot.cells, Owner.AI)[0];
assert.ok(move, "player should have a legal rival-territory move");
assert.equal(snapshot.cells.find((cell) => cell.row === move.from.row && cell.col === move.from.col).owner, Owner.AI);
assert.equal(snapshot.cells.find((cell) => cell.row === move.to.row && cell.col === move.to.col).owner, Owner.AI);
state = selectCell(state, move.from);
state = selectCell(state, move.to);
snapshot = getSnapshot(state);

assert.equal(snapshot.turn, Turn.AI);
assert.ok(snapshot.scores.player >= 0);
assert.ok(snapshot.cells.filter((cell) => cell.owner === Owner.Player).length > 32);
assert.equal(snapshot.moveHistory.length, 1);
assert.equal(snapshot.moveHistory[0].actor, Owner.Player);
assert.equal(snapshot.moveHistory[0].accepted, true);
assert.ok(snapshot.moveHistory[0].capturedIds.length > 0);
assert.ok(snapshot.moveHistory[0].cascades <= 4);

const firstMatchIds = new Set(snapshot.moveHistory[0].matched[0].ids);
const boundaryIds = getBoundaryCells(snapshot.moveHistory[0].matched[0].ids.map((id) => {
  const [row, col] = id.split("-").map(Number);
  return { row, col };
})).map((cell) => `${cell.row}-${cell.col}`);
assert.ok(boundaryIds.every((id) => !firstMatchIds.has(id)));

const aiResult = runAiTurnWithTrace(state);
assert.equal(aiResult.trace[0]?.type, "decision");
const aiSwap = aiResult.trace.find((phase) => phase.type === "swap");
if (aiSwap) assert.equal(aiSwap.movableOwner, Owner.Player);
state = aiResult.state;
snapshot = getSnapshot(state);

assert.equal(snapshot.turn, Turn.Player);
assert.ok(snapshot.turnNumber >= 2);
assert.ok(snapshot.moveHistory.length >= 2);
assert.equal(snapshot.moveHistory[1].actor, Owner.AI);
assert.equal(snapshot.moveHistory[1].aiDecision.difficulty, 62);
assert.ok(snapshot.moveHistory[1].aiDecision.bias > 0);
assert.ok(snapshot.moveHistory[1].aiDecision.consideredMoves > 0);
assert.equal(snapshot.moveHistory[1].aiDecision.weights.length, snapshot.moveHistory[1].aiDecision.consideredMoves);
assert.equal(typeof snapshot.moveHistory[1].aiDecision.preview.cascadeCount, "number");
assert.ok(snapshot.moveHistory[1].aiDecision.preview.cascadeCount <= 4);

let mixState = createGame(24680, { aiDifficulty: 62 });
mixState = selectBonus(mixState, Bonus.Mix);
mixState = selectCell(mixState, { row: 4, col: 4 });
const mixSnapshot = getSnapshot(mixState);
assert.equal(mixSnapshot.bonuses[Bonus.Mix], 1);
assert.equal(mixSnapshot.moveHistory.length, 1);
assert.equal(mixSnapshot.moveHistory[0].actor, Owner.Player);
assert.equal(mixSnapshot.moveHistory[0].bonus.type, Bonus.Mix);
assert.equal(mixSnapshot.moveHistory[0].bonus.changedIds.length, 25);

const lastMoveState = createGame(11111, { victoryMode: VictoryMode.LastMove });
const lastMoveResult = runComputerTurnWithTrace({
  ...lastMoveState,
  cells: lastMoveState.cells.map((cell) => ({ ...cell, owner: Owner.AI })),
  turn: Turn.AI,
  scores: { player: 4, ai: 7 },
}, Owner.AI);
assert.equal(lastMoveResult.state.turn, Turn.Ended);
assert.equal(lastMoveResult.state.winner, Owner.AI);

const duelState = createGame(22222, { victoryMode: VictoryMode.AiDuel, aiDifficulty: 62 });
const duelResult = runComputerTurnWithTrace(duelState, Owner.Player);
const duelSnapshot = getSnapshot(duelResult.state);
assert.equal(duelSnapshot.moveHistory[0].actor, Owner.Player);
assert.equal(duelSnapshot.moveHistory[0].movableOwner, Owner.AI);
assert.equal(duelSnapshot.moveHistory[0].aiDecision.difficulty, 54);
assert.equal(duelSnapshot.turn, Turn.AI);

const redAssistResult = submitBonusTurn(createGame(33333, { victoryMode: VictoryMode.AiDuel }), Bonus.Bomb, { row: 4, col: 4 }, Owner.AI);
const redAssistSnapshot = getSnapshot(redAssistResult.state);
assert.equal(redAssistSnapshot.moveHistory[0].actor, Owner.AI);
assert.equal(redAssistSnapshot.moveHistory[0].bonus.type, Bonus.Bomb);

console.log("core smoke ok");
