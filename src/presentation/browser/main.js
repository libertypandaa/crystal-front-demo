import { Bonus, Owner, Turn } from "../../core/constants.js";
import { createGame, getSnapshot, restart, runAiTurn, selectBonus, selectCell } from "../../core/game.js";

let state = createGame(271828);
let hintMode = false;

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

els.board.addEventListener("click", (event) => {
  const cell = event.target.closest("[data-row]");
  if (!cell) return;
  state = selectCell(state, {
    row: Number(cell.dataset.row),
    col: Number(cell.dataset.col),
  });
  render();
  maybeRunAi();
});

document.querySelectorAll("[data-bonus]").forEach((button) => {
  button.addEventListener("click", () => {
    state = selectBonus(state, button.dataset.bonus);
    render();
  });
});

els.restartButton.addEventListener("click", () => {
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

function maybeRunAi() {
  if (state.turn !== Turn.AI || state.winner) return;
  window.setTimeout(() => {
    state = runAiTurn(state);
    render();
  }, 520);
}

function render() {
  const snapshot = getSnapshot(state);
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
    button.disabled = snapshot.bonuses[bonus] <= 0 || snapshot.turn !== Turn.Player || snapshot.winner;
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

  for (const cell of cells) {
    const right = cells[cell.row * size + cell.col + 1];
    const down = cells[(cell.row + 1) * size + cell.col];
    if (right && wouldMatch(cells, cell, right)) starts.push(cell.id, right.id);
    if (down && wouldMatch(cells, cell, down)) starts.push(cell.id, down.id);
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
