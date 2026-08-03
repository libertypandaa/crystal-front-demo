import { Bonus, Owner, Turn } from "../../core/constants.js";
import { createGame, getSnapshot, restart, runAiTurnWithTrace, selectBonus, selectCell, submitBonusTurn, submitSwapTurn } from "../../core/game.js";

let state = createGame(271828);
let isAnimating = false;
let appView = "main";
let hasStartedMatch = false;

window.crystalFrontDebug = {
  getSnapshot: () => getSnapshot(state),
  getView: () => appView,
  getMoveHistory: () => getSnapshot(state).moveHistory,
  getLastMoves: (count = 5) => getSnapshot(state).moveHistory.slice(-count),
  dumpLastMoves: (count = 5) => JSON.stringify(getSnapshot(state).moveHistory.slice(-count), null, 2),
  copyLastMoves: (count = 10) => copyLastMoves(count),
};

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
  menuButton: document.querySelector("#menuButton"),
  pauseButton: document.querySelector("#pauseButton"),
  mainMenu: document.querySelector("#mainMenu"),
  pauseMenu: document.querySelector("#pauseMenu"),
  resultMenu: document.querySelector("#resultMenu"),
  playButton: document.querySelector("#playButton"),
  continueButton: document.querySelector("#continueButton"),
  setupButton: document.querySelector("#setupButton"),
  shopButton: document.querySelector("#shopButton"),
  leaderboardButton: document.querySelector("#leaderboardButton"),
  settingsButton: document.querySelector("#settingsButton"),
  menuProfile: document.querySelector("#menuProfile"),
  menuRays: document.querySelector("#menuRays"),
  resumeButton: document.querySelector("#resumeButton"),
  pauseRestartButton: document.querySelector("#pauseRestartButton"),
  pauseSettingsButton: document.querySelector("#pauseSettingsButton"),
  pauseMainButton: document.querySelector("#pauseMainButton"),
  resultTitle: document.querySelector("#resultTitle"),
  resultPlayerScore: document.querySelector("#resultPlayerScore"),
  resultAiScore: document.querySelector("#resultAiScore"),
  resultRating: document.querySelector("#resultRating"),
  resultRays: document.querySelector("#resultRays"),
  rematchButton: document.querySelector("#rematchButton"),
  resultSetupButton: document.querySelector("#resultSetupButton"),
  resultMainButton: document.querySelector("#resultMainButton"),
};

render();

els.board.addEventListener("click", async (event) => {
  if (isAnimating || appView !== "battle") return;
  const cell = event.target.closest("[data-row]");
  if (!cell) return;
  const position = {
    row: Number(cell.dataset.row),
    col: Number(cell.dataset.col),
  };

  if (state.selectedBonus && state.turn === Turn.Player) {
    await commitAnimatedTurn(submitBonusTurn(state, state.selectedBonus, position));
    await maybeRunAi();
    return;
  }

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
    if (isAnimating || appView !== "battle") return;
    state = selectBonus(state, button.dataset.bonus);
    render();
  });
});

els.restartButton.addEventListener("click", () => {
  restartMatch();
});

els.pauseButton.addEventListener("click", () => {
  openPauseMenu();
});

els.menuButton.addEventListener("click", () => {
  openPauseMenu();
});

els.playButton.addEventListener("click", () => {
  startNewMatch();
});

els.continueButton.addEventListener("click", () => {
  if (!hasStartedMatch) return;
  appView = state.winner ? "result" : "battle";
  render();
});

els.setupButton.addEventListener("click", () => showComingNext("Match Setup"));
els.shopButton.addEventListener("click", () => showComingNext("Shop"));
els.leaderboardButton.addEventListener("click", () => showComingNext("Leaderboard"));
els.settingsButton.addEventListener("click", () => showComingNext("Settings"));
els.pauseSettingsButton.addEventListener("click", () => showComingNext("Settings"));
els.resultSetupButton.addEventListener("click", () => showComingNext("Match Setup"));
els.resumeButton.addEventListener("click", () => {
  appView = "battle";
  render();
});
els.pauseRestartButton.addEventListener("click", () => restartMatch());
els.pauseMainButton.addEventListener("click", () => openMainMenu());
els.rematchButton.addEventListener("click", () => startNewMatch());
els.resultMainButton.addEventListener("click", () => openMainMenu());

async function maybeRunAi() {
  if (appView !== "battle" || state.turn !== Turn.AI || state.winner) return;
  await wait(520);
  if (appView !== "battle") return;
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
  persistLastMoves();
  isAnimating = false;
  document.body.classList.remove("is-animating");
  if (state.winner) appView = "result";
  render();
}

function render(snapshot = getSnapshot(state), phase = null) {
  updateScreens(snapshot);
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
    button.disabled = snapshot.bonuses[bonus] <= 0 || snapshot.turn !== Turn.Player || snapshot.winner || isAnimating || appView !== "battle";
  }

  els.board.innerHTML = "";

  for (const cell of snapshot.cells) {
    const button = document.createElement("button");
    button.className = `cell owner-${cell.owner} crystal-${cell.crystal}`;
    button.type = "button";
    button.dataset.row = cell.row;
    button.dataset.col = cell.col;
    button.setAttribute("role", "gridcell");
    button.setAttribute("aria-label", `${cell.owner} ${cell.crystal} crystal at ${cell.row + 1}, ${cell.col + 1}`);
    button.classList.toggle("is-selected", snapshot.selected?.row === cell.row && snapshot.selected?.col === cell.col);
    applyPhaseClasses(button, cell, phase);
    button.innerHTML = `<span class="crystal" aria-hidden="true"></span>`;
    els.board.append(button);
  }

  const message = snapshot.events.at(-1)?.message;
  if (message) showToast(message);
}

function updateScreens(snapshot) {
  document.body.dataset.view = appView;
  els.mainMenu.hidden = appView !== "main";
  els.pauseMenu.hidden = appView !== "pause";
  els.resultMenu.hidden = appView !== "result";
  els.continueButton.disabled = !hasStartedMatch;
  els.menuProfile.textContent = `Rating ${snapshot.profile.rating}`;
  els.menuRays.textContent = `${snapshot.profile.rays} Rays`;
  updateResult(snapshot);
}

function updateResult(snapshot) {
  const title = snapshot.winner === Owner.Player
    ? "Victory"
    : snapshot.winner === Owner.AI
      ? "Defeat"
      : snapshot.winner === "draw"
        ? "Draw"
        : "Match";
  els.resultTitle.textContent = title;
  els.resultPlayerScore.textContent = snapshot.scores.player;
  els.resultAiScore.textContent = snapshot.scores.ai;
  els.resultRating.textContent = snapshot.profile.rating;
  els.resultRays.textContent = snapshot.profile.rays;
}

function startNewMatch() {
  state = restart(state);
  hasStartedMatch = true;
  appView = "battle";
  render();
}

function restartMatch() {
  if (isAnimating) return;
  state = restart(state);
  hasStartedMatch = true;
  appView = "battle";
  render();
}

function openPauseMenu() {
  if (isAnimating || appView !== "battle" || state.winner) return;
  appView = "pause";
  render();
}

function openMainMenu() {
  appView = "main";
  render();
}

function showComingNext(label) {
  showToast(`${label} coming next.`);
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

async function copyLastMoves(count = 10) {
  const payload = window.crystalFrontDebug.dumpLastMoves(count);
  persistLastMoves();

  try {
    await navigator.clipboard.writeText(payload);
    showToast(`Copied last ${Math.min(count, getSnapshot(state).moveHistory.length)} moves.`);
    return payload;
  } catch {
    window.localStorage.setItem("crystalFrontLastMoves", payload);
    showToast("Saved last moves locally.");
    return payload;
  }
}

function persistLastMoves() {
  window.localStorage.setItem("crystalFrontLastMoves", window.crystalFrontDebug.dumpLastMoves(10));
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
  const isMixedCell = phase.type === "mix" && phase.changedIds?.includes(cell.id);
  const isBonusCell = phase.type === "bonus" && phase.targetIds?.includes(cell.id);
  const isAffectedCell = isSwapCell || isMatchedCell || isCapturedCell || isRejectedCell || isMixedCell || isBonusCell;

  const actionOwner = phase.actor;
  button.classList.toggle("is-player-action", actionOwner === Owner.Player && isAffectedCell);
  button.classList.toggle("is-ai-action", actionOwner === Owner.AI && isAffectedCell);

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

  if (isMixedCell) {
    button.classList.add("is-mixing");
  }

  if (isBonusCell) {
    button.classList.add("is-bonus-target");
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
  if (phase.type === "swap") return 760;
  if (phase.type === "bonus") return 520;
  if (phase.type === "mix") return 620;
  if (phase.type === "match") return 640;
  if (phase.type === "refill") return 560;
  if (phase.type === "advance") return 760;
  if (phase.type === "rejected") return 380;
  if (phase.type === "turnEnd") return 240;
  return 240;
}
