import { Bonus, Owner, Turn } from "../../core/constants.js";
import { createGame, getSnapshot, restart, runAiTurnWithTrace, selectBonus, selectCell, submitSwapTurn } from "../../core/game.js";

let state = createGame(271828);
let hintMode = false;
let isAnimating = false;

const els = {
  board: document.querySelector("#board"),
  playerScore: document.querySelector("#playerScore"),
  aiScore: document.querySelector("#aiScore"),
  turnNumber: document.querySelector("#turnNumber"),
  turnOwner: document.querySelector("#turnOwner"),
  aiDifficulty: document.querySelector("#aiDifficulty"),
  playerRating: document.querySelector("#playerRating"),
  rays: document.querySelector("#rays"),
  targetScore: document.querySelector("#targetScore"),
  toast: document.querySelector("#toast"),
  restartButton: document.querySelector("#restartButton"),
  hintButton: document.querySelector("#hintButton"),
  pauseButton: document.querySelector("#pauseButton"),
};

render();

els.board.addEventListener("click", async (event) => {
  if (isAnimating) return;
  const cell = event.target.closest("[data-row]");
  if (!cell) return;
  const position = {
    row: Number(cell.dataset.row),
    col: Number(cell.dataset.col),
  };

  if (state.selected && isAdjacent(state.selected, position) && state.turn === Turn.Player && !state.selectedBonus) {
    await commitAnimatedTurn(submitSwapTurn(state, state.selected, position, Owner.Player));
    await maybeRunAi();
    return;
  }

  state = selectCell(state, position);
  render();
  await maybeRunAi();
});

document.querySelectorAll("[data-bonus]").forEach((button) => {
  button.addEventListener("click", () => {
    if (isAnimating) return;
    state = selectBonus(state, button.dataset.bonus);
    render();
  });
});

els.restartButton.addEventListener("click", () => {
  if (isAnimating) return;
  state = restart(state);
  render();
});

els.hintButton.addEventListener("click", () => {
  hintMode = !hintMode;
  render();
});

els.pauseButton.addEventListener("click", () => {
  showToast("Paused in spirit. This demo has no timer.");
});

async function maybeRunAi() {
  if (state.turn !== Turn.AI || state.winner) return;
  await wait(520);
  await commitAnimatedTurn(runAiTurnWithTrace(state));
}

async function commitAnimatedTurn(result) {
  isAnimating = true;
  document.body.classList.add("is-animating");

  for (const phase of result.trace) {
    if (phase.message) showToast(phase.message);
    if (phase.cells) render(makeSnapshot(phase.cells), phase);
    await wait(getPhaseDuration(phase));
  }

  state = result.state;
  isAnimating = false;
  document.body.classList.remove("is-animating");
  render();
}

function render(snapshot = getSnapshot(state), phase = null) {
  const control = getControl(snapshot);
  els.board.style.setProperty("--player-control", `${control.playerPercent}%`);
  els.board.style.setProperty("--front-blend-start", `${Math.max(0, control.playerPercent - 7)}%`);
  els.board.style.setProperty("--front-blend-end", `${Math.min(100, control.playerPercent + 7)}%`);
  els.board.setAttribute("aria-label", `Crystal Front board. You control ${control.playerPercent} percent.`);
  els.playerScore.textContent = snapshot.scores.player;
  els.aiScore.textContent = snapshot.scores.ai;
  els.turnNumber.textContent = snapshot.turnNumber;
  els.turnOwner.textContent = formatTurn(snapshot);
  els.aiDifficulty.textContent = `AI ${snapshot.settings.aiDifficulty}`;
  els.playerRating.textContent = `Rating ${snapshot.profile.rating}`;
  els.rays.textContent = snapshot.profile.rays;
  els.targetScore.textContent = snapshot.settings.targetScore;

  for (const bonus of Object.values(Bonus)) {
    const count = document.querySelector(`#bonus-${bonus}`);
    const button = document.querySelector(`[data-bonus="${bonus}"]`);
    count.textContent = snapshot.bonuses[bonus];
    button.classList.toggle("is-selected", snapshot.selectedBonus === bonus);
    button.disabled = snapshot.bonuses[bonus] <= 0 || snapshot.turn !== Turn.Player || snapshot.winner || isAnimating;
  }

  els.board.innerHTML = "";
  const legalStarts = hintMode ? new Set(snapshot.legalMoves ? findHintStarts(snapshot) : []) : new Set();

  for (const cell of snapshot.cells) {
    const button = document.createElement("button");
    button.className = `cell owner-${cell.owner} crystal-${cell.crystal}`;
    button.type = "button";
    button.dataset.row = cell.row;
    button.dataset.col = cell.col;
    button.setAttribute("role", "gridcell");
    button.setAttribute("aria-label", `${cell.owner} ${cell.crystal} crystal at ${cell.row + 1}, ${cell.col + 1}`);
    button.classList.toggle("is-selected", snapshot.selected?.row === cell.row && snapshot.selected?.col === cell.col);
    button.classList.toggle("is-hint", legalStarts.has(`${cell.row}-${cell.col}`));
    applyPhaseClasses(button, cell, phase);
    button.innerHTML = `<span class="crystal" aria-hidden="true"></span>`;
    els.board.append(button);
  }

  const message = snapshot.events.at(-1)?.message;
  if (message) showToast(message);
}

function formatTurn(snapshot) {
  if (snapshot.winner === Owner.Player) return "Victory";
  if (snapshot.winner === Owner.AI) return "Defeat";
  if (snapshot.winner === "draw") return "Draw";
  return snapshot.turn === Turn.Player ? `Player move · ${snapshot.legalMoves} options` : "AI thinking";
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add("is-visible");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => els.toast.classList.remove("is-visible"), 1800);
}

function findHintStarts(snapshot) {
  const starts = [];
  const cells = snapshot.cells;
  const size = 8;
  const movableOwner = getMovableOwner(snapshot.turn);

  for (const cell of cells) {
    const right = cells[cell.row * size + cell.col + 1];
    const down = cells[(cell.row + 1) * size + cell.col];
    if (right && cell.owner === movableOwner && right.owner === movableOwner && wouldMatch(cells, cell, right)) starts.push(cell.id, right.id);
    if (down && cell.owner === movableOwner && down.owner === movableOwner && wouldMatch(cells, cell, down)) starts.push(cell.id, down.id);
  }

  return starts;
}

function wouldMatch(cells, a, b) {
  const copy = cells.map((cell) => ({ ...cell }));
  const first = copy.find((cell) => cell.id === a.id);
  const second = copy.find((cell) => cell.id === b.id);
  const crystal = first.crystal;
  first.crystal = second.crystal;
  second.crystal = crystal;
  return hasMatchAt(copy, first) || hasMatchAt(copy, second);
}

function hasMatchAt(cells, target) {
  const sameRow = cells.filter((cell) => cell.row === target.row).sort((a, b) => a.col - b.col);
  const sameCol = cells.filter((cell) => cell.col === target.col).sort((a, b) => a.row - b.row);
  return longestRun(sameRow, target.crystal) >= 3 || longestRun(sameCol, target.crystal) >= 3;
}

function longestRun(cells, crystal) {
  let longest = 0;
  let current = 0;
  for (const cell of cells) {
    current = cell.crystal === crystal ? current + 1 : 0;
    longest = Math.max(longest, current);
  }
  return longest;
}

function getControl(snapshot) {
  const total = snapshot.cells.length || 1;
  const playerCells = snapshot.cells.filter((cell) => cell.owner === Owner.Player).length;
  return {
    playerCells,
    aiCells: snapshot.cells.filter((cell) => cell.owner === Owner.AI).length,
    playerPercent: Math.round((playerCells / total) * 100),
  };
}

function makeSnapshot(cells) {
  return {
    ...getSnapshot(state),
    cells: cells.map((cell) => ({ ...cell })),
  };
}

function applyPhaseClasses(button, cell, phase) {
  if (!phase) return;

  const isSwapCell = phase.type === "swap" && isPosition(cell, phase.from, phase.to);
  const isMatchedCell = phase.matchedIds?.includes(cell.id);
  const isCapturedCell = phase.capturedIds?.includes(cell.id);
  const isRejectedCell = phase.type === "rejected" && isPosition(cell, phase.from, phase.to);
  const isAffectedCell = isSwapCell || isMatchedCell || isCapturedCell || isRejectedCell;

  button.classList.toggle("is-player-action", phase.actor === Owner.Player && isAffectedCell);
  button.classList.toggle("is-ai-action", phase.actor === Owner.AI && isAffectedCell);

  if (isSwapCell) {
    button.classList.add("is-swapping");
  }

  if (phase.type === "match" && isMatchedCell) {
    button.classList.add("is-clearing");
  }

  if (phase.type === "refill" && isMatchedCell) {
    button.classList.add("is-spawning");
  }

  if (phase.type === "advance" && isCapturedCell) {
    button.classList.add("is-captured");
  }

  if (isRejectedCell) {
    button.classList.add("is-rejected");
  }
}

function isPosition(cell, ...positions) {
  return positions.some((position) => position && cell.row === position.row && cell.col === position.col);
}

function isAdjacent(a, b) {
  return Math.abs(a.row - b.row) + Math.abs(a.col - b.col) === 1;
}

function wait(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function getPhaseDuration(phase) {
  if (phase.type === "swap") return 360;
  if (phase.type === "match") return 430;
  if (phase.type === "refill") return 420;
  if (phase.type === "advance") return 460;
  if (phase.type === "rejected") return 300;
  if (phase.type === "turnEnd") return 180;
  return 240;
}

function getMovableOwner(turn) {
  if (turn === Turn.Player) return Owner.AI;
  if (turn === Turn.AI) return Owner.Player;
  return turn;
}
