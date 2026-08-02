import assert from "node:assert/strict";
import { findLegalSwaps } from "../src/core/board.js";
import { Owner, Turn } from "../src/core/constants.js";
import { createGame, getSnapshot, runAiTurn, selectCell } from "../src/core/game.js";

let state = createGame(12345, { targetScore: 999, aiDifficulty: 62 });
let snapshot = getSnapshot(state);

assert.equal(snapshot.cells.length, 64);
assert.equal(snapshot.cells.filter((cell) => cell.owner === Owner.AI).length, 32);
assert.equal(snapshot.cells.filter((cell) => cell.owner === Owner.Player).length, 32);
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

state = runAiTurn(state);
snapshot = getSnapshot(state);

assert.equal(snapshot.turn, Turn.Player);
assert.ok(snapshot.turnNumber >= 2);

console.log("core smoke ok");
