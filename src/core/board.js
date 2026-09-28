import { BOARD_SIZE, CRYSTALS, Owner } from "./constants.js";
import { pick } from "./random.js";

export function createBoard(rng) {
  const cells = [];

  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      cells.push({
        id: `${row}-${col}`,
        row,
        col,
        crystal: pickNonMatchingCrystal(cells, row, col, rng),
        owner: row < BOARD_SIZE / 2 ? Owner.AI : Owner.Player,
      });
    }
  }

  return cells;
}

export function getCell(cells, row, col) {
  return cells[row * BOARD_SIZE + col];
}

export function cloneCells(cells) {
  return cells.map((cell) => ({ ...cell }));
}

export function areAdjacent(a, b) {
  return Math.abs(a.row - b.row) + Math.abs(a.col - b.col) === 1;
}

export function swapCrystals(cells, a, b) {
  const next = cloneCells(cells);
  const first = getCell(next, a.row, a.col);
  const second = getCell(next, b.row, b.col);
  const crystal = first.crystal;
  first.crystal = second.crystal;
  second.crystal = crystal;
  return next;
}

export function findMatches(cells) {
  const matched = new Set();

  for (let row = 0; row < BOARD_SIZE; row += 1) {
    let run = [getCell(cells, row, 0)];
    for (let col = 1; col < BOARD_SIZE; col += 1) {
      const cell = getCell(cells, row, col);
      if (cell.crystal === run[0].crystal) {
        run.push(cell);
      } else {
        collectRun(run, matched);
        run = [cell];
      }
    }
    collectRun(run, matched);
  }

  for (let col = 0; col < BOARD_SIZE; col += 1) {
    let run = [getCell(cells, 0, col)];
    for (let row = 1; row < BOARD_SIZE; row += 1) {
      const cell = getCell(cells, row, col);
      if (cell.crystal === run[0].crystal) {
        run.push(cell);
      } else {
        collectRun(run, matched);
        run = [cell];
      }
    }
    collectRun(run, matched);
  }

  return [...matched].map((id) => {
    const [row, col] = id.split("-").map(Number);
    return getCell(cells, row, col);
  });
}

export function findMatchesFromCells(cells, positions) {
  const matched = new Set();

  for (const position of positions) {
    const cell = getCell(cells, position.row, position.col);
    if (!cell) continue;
    collectLine(getHorizontalRun(cells, cell), matched);
    collectLine(getVerticalRun(cells, cell), matched);
  }

  return idsToCells(cells, matched);
}

export function findCascadeMatches(cells, previousMatches) {
  return findMatchesFromCells(cells, getBoundaryCells(previousMatches));
}

// Plan a swap's entire chain on the unchanged post-swap board. Only cells in
// horizontal or vertical runs of at least three may join the chain.
export function planSwapChain(cells, initialMatches, maxWaves = 4) {
  const valid = new Map(findMatches(cells).map((cell) => [cell.id, cell]));
  const groups = [];
  const groupById = new Map();

  for (const cell of valid.values()) {
    if (groupById.has(cell.id)) continue;
    const group = { crystal: cell.crystal, ids: [] };
    const groupIndex = groups.length;
    groups.push(group);
    const pending = [cell];
    groupById.set(cell.id, groupIndex);

    while (pending.length > 0) {
      const current = pending.pop();
      group.ids.push(current.id);
      for (const neighbor of getOrthogonalCells(cells, current)) {
        if (!valid.has(neighbor.id) || neighbor.crystal !== group.crystal || groupById.has(neighbor.id)) continue;
        groupById.set(neighbor.id, groupIndex);
        pending.push(neighbor);
      }
    }
  }

  const depthByGroup = new Map();
  const pending = [];
  for (const cell of initialMatches) {
    const groupIndex = groupById.get(cell.id);
    if (groupIndex === undefined || depthByGroup.has(groupIndex)) continue;
    depthByGroup.set(groupIndex, 1);
    pending.push(groupIndex);
  }

  for (let cursor = 0; cursor < pending.length; cursor += 1) {
    const groupIndex = pending[cursor];
    const nextDepth = depthByGroup.get(groupIndex) + 1;
    if (nextDepth > maxWaves) continue;
    for (const id of groups[groupIndex].ids) {
      const cell = valid.get(id);
      for (const neighbor of getOrthogonalCells(cells, cell)) {
        const nextGroup = groupById.get(neighbor.id);
        if (nextGroup === undefined || nextGroup === groupIndex || depthByGroup.has(nextGroup)) continue;
        depthByGroup.set(nextGroup, nextDepth);
        pending.push(nextGroup);
      }
    }
  }

  const waves = Array.from({ length: maxWaves }, (_, index) => ({ cascade: index + 1, ids: [] }));
  for (const [groupIndex, depth] of depthByGroup) {
    waves[depth - 1].ids.push(...groups[groupIndex].ids);
  }
  const orderedWaves = waves.filter((wave) => wave.ids.length > 0);
  for (const wave of orderedWaves) wave.ids.sort((a, b) => cellIndex(a) - cellIndex(b));
  const matchedIds = orderedWaves.flatMap((wave) => wave.ids);
  return { waves: orderedWaves, matchedIds };
}

function getOrthogonalCells(cells, cell) {
  return [
    [cell.row - 1, cell.col], [cell.row + 1, cell.col],
    [cell.row, cell.col - 1], [cell.row, cell.col + 1],
  ].filter(([row, col]) => row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE)
    .map(([row, col]) => getCell(cells, row, col));
}

function cellIndex(id) {
  const [row, col] = id.split("-").map(Number);
  return row * BOARD_SIZE + col;
}

export function getBoundaryCells(cells) {
  const boundary = new Set();
  const source = new Set(cells.map((cell) => cell.id ?? `${cell.row}-${cell.col}`));

  for (const cell of cells) {
    for (const [row, col] of [
      [cell.row - 1, cell.col],
      [cell.row + 1, cell.col],
      [cell.row, cell.col - 1],
      [cell.row, cell.col + 1],
    ]) {
      if (row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE) {
        boundary.add(`${row}-${col}`);
      }
    }
  }

  for (const id of source) {
    boundary.delete(id);
  }

  return [...boundary].map((id) => {
    const [row, col] = id.split("-").map(Number);
    return { row, col };
  });
}

export function refillAfterClear(cells, matchedCells, actor, rng) {
  return refillAfterClearWithCapture(cells, matchedCells, actor, rng).cells;
}

export function refillAfterClearWithCapture(cells, matchedCells, actor, rng) {
  const next = cloneCells(cells);
  const cleared = new Set(matchedCells.map((cell) => cell.id));
  const capturedIds = [];
  const movedIds = [];
  const spawnedIds = [];

  for (let col = 0; col < BOARD_SIZE; col += 1) {
    if (actor === Owner.Player) {
      refillColumnTowardTop(cells, next, cleared, col, actor, rng, capturedIds, movedIds, spawnedIds);
    } else {
      refillColumnTowardBottom(cells, next, cleared, col, actor, rng, capturedIds, movedIds, spawnedIds);
    }
  }

  return { cells: next, capturedIds, movedIds, spawnedIds };
}

export function findLegalSwaps(cells, actor = null) {
  const swaps = [];

  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      const cell = getCell(cells, row, col);
      for (const offset of [
        [0, 1],
        [1, 0],
      ]) {
        const otherRow = row + offset[0];
        const otherCol = col + offset[1];
        if (otherRow >= BOARD_SIZE || otherCol >= BOARD_SIZE) continue;
        const other = getCell(cells, otherRow, otherCol);
        if (actor && (cell.owner !== actor || other.owner !== actor)) continue;
        const swapped = swapCrystals(cells, cell, other);
        if (findMatchesFromCells(swapped, [{ row, col }, { row: otherRow, col: otherCol }]).length > 0) {
          swaps.push({ from: { row, col }, to: { row: otherRow, col: otherCol } });
        }
      }
    }
  }

  return swaps;
}

function collectRun(run, matched) {
  if (run.length < 3) return;
  for (const cell of run) matched.add(cell.id);
}

function collectLine(run, matched) {
  if (run.length < 3) return;
  for (const cell of run) matched.add(cell.id);
}

function idsToCells(cells, ids) {
  return [...ids].map((id) => {
    const [row, col] = id.split("-").map(Number);
    return getCell(cells, row, col);
  });
}

function getHorizontalRun(cells, target) {
  const run = [target];

  for (let col = target.col - 1; col >= 0; col -= 1) {
    const cell = getCell(cells, target.row, col);
    if (cell.crystal !== target.crystal) break;
    run.unshift(cell);
  }

  for (let col = target.col + 1; col < BOARD_SIZE; col += 1) {
    const cell = getCell(cells, target.row, col);
    if (cell.crystal !== target.crystal) break;
    run.push(cell);
  }

  return run;
}

function getVerticalRun(cells, target) {
  const run = [target];

  for (let row = target.row - 1; row >= 0; row -= 1) {
    const cell = getCell(cells, row, target.col);
    if (cell.crystal !== target.crystal) break;
    run.unshift(cell);
  }

  for (let row = target.row + 1; row < BOARD_SIZE; row += 1) {
    const cell = getCell(cells, row, target.col);
    if (cell.crystal !== target.crystal) break;
    run.push(cell);
  }

  return run;
}

function refillColumnTowardTop(original, next, cleared, col, actor, rng, capturedIds, movedIds, spawnedIds) {
  const survivors = [];
  for (let row = 0; row < BOARD_SIZE; row += 1) {
    const cell = getCell(next, row, col);
    if (!cleared.has(cell.id)) survivors.push({ ...cell });
  }

  for (let row = 0; row < BOARD_SIZE; row += 1) {
    const target = getCell(next, row, col);
    const source = survivors.shift();
    const beforeOwner = getCell(original, row, col).owner;
    if (source) {
      target.crystal = source.crystal;
      target.owner = source.owner;
      if (source.id !== target.id) movedIds.push(target.id);
    } else {
      target.crystal = pick(CRYSTALS, rng);
      target.owner = actor;
      spawnedIds.push(target.id);
    }
    collectCapturedId(target, beforeOwner, actor, capturedIds);
  }
}

function refillColumnTowardBottom(original, next, cleared, col, actor, rng, capturedIds, movedIds, spawnedIds) {
  const survivors = [];
  for (let row = BOARD_SIZE - 1; row >= 0; row -= 1) {
    const cell = getCell(next, row, col);
    if (!cleared.has(cell.id)) survivors.push({ ...cell });
  }

  for (let row = BOARD_SIZE - 1; row >= 0; row -= 1) {
    const target = getCell(next, row, col);
    const source = survivors.shift();
    const beforeOwner = getCell(original, row, col).owner;
    if (source) {
      target.crystal = source.crystal;
      target.owner = source.owner;
      if (source.id !== target.id) movedIds.push(target.id);
    } else {
      target.crystal = pick(CRYSTALS, rng);
      target.owner = actor;
      spawnedIds.push(target.id);
    }
    collectCapturedId(target, beforeOwner, actor, capturedIds);
  }
}

function collectCapturedId(target, beforeOwner, actor, capturedIds) {
  if (target.owner === actor && beforeOwner !== actor) {
    capturedIds.push(target.id);
  }
}

function pickNonMatchingCrystal(cells, row, col, rng) {
  let crystal = pick(CRYSTALS, rng);
  let guard = 0;

  while (guard < 12 && createsImmediateMatch(cells, row, col, crystal)) {
    crystal = pick(CRYSTALS, rng);
    guard += 1;
  }

  return crystal;
}

function createsImmediateMatch(cells, row, col, crystal) {
  const left1 = col >= 1 ? getCell(cells, row, col - 1)?.crystal : null;
  const left2 = col >= 2 ? getCell(cells, row, col - 2)?.crystal : null;
  const up1 = row >= 1 ? getCell(cells, row - 1, col)?.crystal : null;
  const up2 = row >= 2 ? getCell(cells, row - 2, col)?.crystal : null;
  return (left1 === crystal && left2 === crystal) || (up1 === crystal && up2 === crystal);
}
