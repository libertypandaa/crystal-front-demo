import assert from "node:assert/strict";
import { findMatches, findMatchesFromCells, planSwapChain } from "../src/core/board.js";
import { CRYSTALS, Bonus, Owner, Turn } from "../src/core/constants.js";
import { createGame, runComputerTurnWithTrace, submitBonusTurn, submitSwapTurn } from "../src/core/game.js";

const [yellow, green, purple, cyan] = CRYSTALS;
const id = (row, col) => `${row}-${col}`;

function board() {
  return Array.from({ length: 64 }, (_, index) => {
    const row = Math.floor(index / 8);
    const col = index % 8;
    return { id: id(row, col), row, col, crystal: CRYSTALS[(row + col) % 4], owner: Owner.Player };
  });
}

function color(cells, crystal, ...positions) {
  for (const [row, col] of positions) cells[row * 8 + col].crystal = crystal;
}

function run(cells, crystal, row, fromCol, toCol) {
  for (let col = fromCol; col <= toCol; col += 1) color(cells, crystal, [row, col]);
}

function plan(cells, ...seeds) {
  const initial = findMatchesFromCells(cells, seeds.map(([row, col]) => ({ row, col })));
  return planSwapChain(cells, initial);
}

function waveIds(chain, number) {
  return new Set(chain.waves[number - 1]?.ids ?? []);
}

{
  const cells = board();
  run(cells, yellow, 2, 1, 3);
  color(cells, yellow, [1, 2], [3, 2], [3, 3]); // perpendicular run plus adjacent singleton
  color(cells, green, [1, 3], [3, 1]);
  const chain = plan(cells, [2, 2]);
  assert.equal(chain.waves.length, 1);
  assert.deepEqual(waveIds(chain, 1), new Set([id(2, 1), id(2, 2), id(2, 3), id(1, 2), id(3, 2)]));
  assert.ok(!chain.matchedIds.includes(id(3, 3)), "single same-color neighbor must not burn");
}

{
  const cells = board();
  run(cells, yellow, 2, 1, 3);
  color(cells, yellow, [3, 3], [4, 3], [5, 3]); // separate valid line touching the seed
  const chain = plan(cells, [2, 1]);
  assert.equal(chain.waves.length, 1);
  assert.ok([id(2, 1), id(2, 2), id(2, 3), id(3, 3), id(4, 3), id(5, 3)].every((cellId) => waveIds(chain, 1).has(cellId)));
}

{
  const cells = board();
  run(cells, yellow, 2, 1, 3);
  color(cells, green, [3, 3], [4, 3], [5, 3]);
  const chain = plan(cells, [2, 1]);
  assert.equal(chain.waves.length, 2);
  assert.ok(waveIds(chain, 2).has(id(5, 3)));
  assert.ok(!waveIds(chain, 1).has(id(5, 3)));
}

{
  const cells = board();
  run(cells, yellow, 1, 1, 3);
  run(cells, green, 2, 4, 6); // diagonal contact only
  color(cells, purple, [2, 3]);
  const chain = plan(cells, [1, 1]);
  assert.equal(chain.waves.length, 1);
  assert.ok(!chain.matchedIds.includes(id(2, 4)));
}

{
  const cells = board();
  [yellow, green, purple, cyan, yellow].forEach((crystal, index) => run(cells, crystal, index + 1, 1, 3));
  const chain = plan(cells, [1, 1]);
  assert.equal(chain.waves.length, 4);
  assert.ok(chain.matchedIds.includes(id(4, 2)));
  assert.ok(!chain.matchedIds.includes(id(5, 2)), "fifth wave must not burn");
  assert.ok(waveIds(chain, 2).has(id(2, 2)), "own-territory line is eligible");
}

{
  const cells = board();
  run(cells, yellow, 2, 0, 2);
  run(cells, green, 5, 4, 6);
  const chain = plan(cells, [2, 1], [5, 5]);
  assert.equal(chain.waves.length, 1);
  assert.equal(new Set(chain.matchedIds).size, chain.matchedIds.length);
  assert.ok(chain.matchedIds.includes(id(2, 0)) && chain.matchedIds.includes(id(5, 6)));
}

{
  const cells = board().map((cell) => ({ ...cell, owner: Owner.AI }));
  color(cells, green, [2, 2], [3, 2], [4, 2], [5, 2]);
  color(cells, yellow, [2, 0], [2, 1], [2, 3]);
  const state = { ...createGame(321, { targetScore: 999 }), cells, rng: () => 0, turn: Turn.Player };
  const result = submitSwapTurn(state, { row: 2, col: 2 }, { row: 2, col: 3 }, Owner.Player);
  const matches = result.trace.filter((phase) => phase.type === "match");
  const refills = result.trace.filter((phase) => phase.type === "refill");
  assert.equal(matches.length, 1);
  assert.equal(refills.length, 1);
  assert.equal(matches[0].waves.length, 2);
  assert.equal(result.state.moveHistory[0].matched.length, 2);
  assert.equal(result.state.moveHistory[0].scoreGain, new Set(matches[0].matchedIds).size);
  assert.equal(Math.max(...result.state.moveHistory[0].matched.map((wave) => wave.ids.length)), 3);
  assert.ok(findMatches(result.state.cells).length > 0, "spawned lines exist but do not start another cascade");
}

{
  const state = createGame(12345, { targetScore: 999 });
  const result = runComputerTurnWithTrace(state, Owner.Player);
  const swap = result.trace.find((phase) => phase.type === "swap");
  const match = result.trace.find((phase) => phase.type === "match");
  const refill = result.trace.find((phase) => phase.type === "refill");
  const decision = result.state.moveHistory[0].aiDecision.preview;
  assert.ok(swap && match && refill);
  assert.equal(decision.cascadeCount, match.waves.length);
  assert.equal(decision.playerDestroyed, match.matchedIds.filter((cellId) => swap.cells.find((cell) => cell.id === cellId).owner === Owner.Player).length);
  assert.equal(decision.enemyDestroyed, match.matchedIds.filter((cellId) => swap.cells.find((cell) => cell.id === cellId).owner === Owner.AI).length);
  assert.equal(decision.capturedCount, refill.capturedIds.length);
}

{
  const state = createGame(24680);
  for (const bonus of [Bonus.Bomb, Bonus.Line, Bonus.Color, Bonus.Mix]) {
    const result = submitBonusTurn(state, bonus, { row: 4, col: 4 });
    assert.equal(result.state.moveHistory[0].bonus.type, bonus);
    if (bonus !== Bonus.Mix) {
      const matches = result.trace.filter((phase) => phase.type === "match");
      const refills = result.trace.filter((phase) => phase.type === "refill");
      assert.equal(matches.length, refills.length, `${bonus} keeps its existing per-wave refill path`);
      assert.ok(matches.every((phase) => !phase.waves));
    }
  }
}

console.log("cascade chain ok");
