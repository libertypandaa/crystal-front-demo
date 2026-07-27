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

export function refillAfterClear(cells, matchedCells, actor, rng) {
  const next = cloneCells(cells);
  const cleared = new Set(matchedCells.map((cell) => cell.id));

  for (let col = 0; col < BOARD_SIZE; col += 1) {
    const survivors = [];
    for (let row = BOARD_SIZE - 1; row >= 0; row -= 1) {
      const cell = getCell(next, row, col);
      if (!cleared.has(cell.id)) survivors.push({ ...cell });
    }

    for (let row = BOARD_SIZE - 1; row >= 0; row -= 1) {
      const target = getCell(next, row, col);
      const source = survivors.shift();
      if (source) {
        target.crystal = source.crystal;
        target.owner = source.owner;
      } else {
        target.crystal = pick(CRYSTALS, rng);
        target.owner = actor;
      }
    }
  }

  return next;
}

export function findLegalSwaps(cells) {
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
        const swapped = swapCrystals(cells, cell, other);
        if (findMatches(swapped).length > 0) {
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
