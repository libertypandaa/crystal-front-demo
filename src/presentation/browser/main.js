import { Bonus, Owner, Turn } from "../../core/constants.js";
import { createGame, getSnapshot, restart, runAiTurnWithTrace, selectBonus, selectCell, submitBonusTurn, submitSwapTurn } from "../../core/game.js";

let state = createGame(271828);
let isAnimating = false;
let appView = "main";
let hasStartedMatch = false;
let pendingSettings = { ...state.settings };
let setupReturnView = "main";
let uiPreferences = {
  sound: true,
  sfx: true,
  animations: true,
  motion: 100,
  orientation: "auto",
  palette: "classic",
};

const shopItems = [
  { bonus: Bonus.Bomb, label: "Bomb", detail: "Clears a 3x3 strike zone.", cost: 35 },
  { bonus: Bonus.Line, label: "Line", detail: "Clears one row and column.", cost: 45 },
  { bonus: Bonus.Mix, label: "Mix", detail: "Shuffles a local 5x5 area.", cost: 30 },
  { bonus: Bonus.Color, label: "Color", detail: "Clears one crystal color.", cost: 60 },
];

const rivals = [
  { name: "North Prism", rating: 1380, record: "18-7" },
  { name: "Rose Shard", rating: 1315, record: "15-8" },
  { name: "Glass Warden", rating: 1260, record: "12-9" },
  { name: "Mint Oracle", rating: 1120, record: "8-11" },
];

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
  targetScore: document.querySelector("#targetScore"),
  toast: document.querySelector("#toast"),
  menuButton: document.querySelector("#menuButton"),
  pauseButton: document.querySelector("#pauseButton"),
  mainMenu: document.querySelector("#mainMenu"),
  setupMenu: document.querySelector("#setupMenu"),
  shopMenu: document.querySelector("#shopMenu"),
  leaderboardMenu: document.querySelector("#leaderboardMenu"),
  settingsMenu: document.querySelector("#settingsMenu"),
  pauseMenu: document.querySelector("#pauseMenu"),
  resultMenu: document.querySelector("#resultMenu"),
  exitMenu: document.querySelector("#exitMenu"),
  playButton: document.querySelector("#playButton"),
  continueButton: document.querySelector("#continueButton"),
  setupButton: document.querySelector("#setupButton"),
  shopButton: document.querySelector("#shopButton"),
  leaderboardButton: document.querySelector("#leaderboardButton"),
  settingsButton: document.querySelector("#settingsButton"),
  menuProfile: document.querySelector("#menuProfile"),
  menuRays: document.querySelector("#menuRays"),
  setupAiDifficulty: document.querySelector("#setupAiDifficulty"),
  setupAiValue: document.querySelector("#setupAiValue"),
  setupTargetScore: document.querySelector("#setupTargetScore"),
  setupTargetValue: document.querySelector("#setupTargetValue"),
  shopList: document.querySelector("#shopList"),
  leaderboardList: document.querySelector("#leaderboardList"),
  ratingValue: document.querySelector("#ratingValue"),
  ratingRays: document.querySelector("#ratingRays"),
  ratingBest: document.querySelector("#ratingBest"),
  settingSound: document.querySelector("#settingSound"),
  settingSfx: document.querySelector("#settingSfx"),
  settingAnimations: document.querySelector("#settingAnimations"),
  settingMotion: document.querySelector("#settingMotion"),
  settingMotionValue: document.querySelector("#settingMotionValue"),
  resultTitle: document.querySelector("#resultTitle"),
  resultPlayerScore: document.querySelector("#resultPlayerScore"),
  resultAiScore: document.querySelector("#resultAiScore"),
  resultRating: document.querySelector("#resultRating"),
  resultRays: document.querySelector("#resultRays"),
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

els.pauseButton.addEventListener("click", () => {
  openPauseMenu();
});

els.menuButton.addEventListener("click", () => {
  openPauseMenu();
});

document.addEventListener("click", (event) => {
  const actionButton = event.target.closest("[data-action]");
  if (!actionButton || actionButton.disabled) return;
  handleMenuAction(actionButton.dataset.action, actionButton);
});

document.addEventListener("pointerdown", (event) => {
  const button = event.target.closest("button");
  if (!button || button.disabled) return;
  button.classList.add("is-pressed");
});

document.addEventListener("pointerup", clearPressedButtons);
document.addEventListener("pointercancel", clearPressedButtons);

document.addEventListener("pointermove", (event) => {
  document.querySelectorAll("button.is-touch-hover").forEach((button) => button.classList.remove("is-touch-hover"));
  const button = document.elementFromPoint(event.clientX, event.clientY)?.closest("button");
  if (button && !button.disabled) button.classList.add("is-touch-hover");
});

els.setupAiDifficulty.addEventListener("input", () => {
  pendingSettings = {
    ...pendingSettings,
    aiDifficulty: Number(els.setupAiDifficulty.value),
  };
  renderSetupValues();
});
els.setupTargetScore.addEventListener("input", () => {
  pendingSettings = {
    ...pendingSettings,
    targetScore: Number(els.setupTargetScore.value),
  };
  renderSetupValues();
});

els.settingSound.addEventListener("change", () => updatePreference("sound", els.settingSound.checked));
els.settingSfx.addEventListener("change", () => updatePreference("sfx", els.settingSfx.checked));
els.settingAnimations.addEventListener("change", () => updatePreference("animations", els.settingAnimations.checked));
els.settingMotion.addEventListener("input", () => updatePreference("motion", Number(els.settingMotion.value)));

document.querySelectorAll("[data-setting]").forEach((button) => {
  button.addEventListener("click", () => updatePreference(button.dataset.setting, button.dataset.value));
});

function handleMenuAction(action, sourceButton) {
  if (action === "start") startNewMatch();
  if (action === "continue") continueMatch();
  if (action === "setup") openSetupMenu();
  if (action === "shop") openShopMenu();
  if (action === "leaderboard") openLeaderboardMenu();
  if (action === "settings") openSettingsMenu();
  if (action === "buy-bonus") buyBonus(sourceButton.dataset.bonus);
  if (action === "setup-start") startNewMatch();
  if (action === "setup-back") closeSetupMenu();
  if (action === "resume") continueMatch();
  if (action === "restart") restartMatch();
  if (action === "main") openMainMenu();
  if (action === "exit-game") exitGame();
  if (action === "settings-apply") applySettings();
}

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
    button.innerHTML = `
      <span class="crystal" aria-hidden="true">
        <span class="crystal-core"></span>
        <span class="crystal-shard shard-a"></span>
        <span class="crystal-shard shard-b"></span>
        <span class="crystal-shard shard-c"></span>
      </span>
    `;
    els.board.append(button);
  }

  if (appView !== "battle") {
    const message = snapshot.events.at(-1)?.message;
    if (message) showToast(message);
  }
}

function updateScreens(snapshot) {
  document.body.dataset.view = appView;
  els.mainMenu.hidden = appView !== "main";
  els.setupMenu.hidden = appView !== "setup";
  els.shopMenu.hidden = appView !== "shop";
  els.leaderboardMenu.hidden = appView !== "leaderboard";
  els.settingsMenu.hidden = appView !== "settings";
  els.pauseMenu.hidden = appView !== "pause";
  els.resultMenu.hidden = appView !== "result";
  els.exitMenu.hidden = appView !== "exit";
  els.continueButton.disabled = !hasStartedMatch;
  els.menuProfile.textContent = `Rating ${snapshot.profile.rating}`;
  els.menuRays.textContent = `${snapshot.profile.rays} Rays`;
  renderSetupValues();
  renderShop(snapshot);
  renderLeaderboard(snapshot);
  renderSettings();
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

function continueMatch() {
  if (!hasStartedMatch) return;
  appView = state.winner ? "result" : "battle";
  render();
}

function startNewMatch() {
  state = createGame(Date.now(), pendingSettings);
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

function openSetupMenu() {
  pendingSettings = { ...state.settings };
  setupReturnView = appView === "result" ? "result" : "main";
  appView = "setup";
  render();
}

function openShopMenu() {
  appView = "shop";
  render();
}

function openLeaderboardMenu() {
  appView = "leaderboard";
  render();
}

function openSettingsMenu() {
  appView = "settings";
  render();
}

function closeSetupMenu() {
  appView = setupReturnView;
  render();
}

function exitGame() {
  appView = "exit";
  window.close();
  render();
}

function renderSetupValues() {
  els.setupAiDifficulty.value = String(pendingSettings.aiDifficulty);
  els.setupAiValue.textContent = pendingSettings.aiDifficulty;
  els.setupTargetScore.value = String(pendingSettings.targetScore);
  els.setupTargetValue.textContent = pendingSettings.targetScore;
}

function renderShop(snapshot) {
  els.shopList.innerHTML = "";
  for (const item of shopItems) {
    const row = document.createElement("div");
    row.className = "item-row";
    row.innerHTML = `
      <div>
        <strong>${item.label}</strong>
        <span>${item.detail}</span>
      </div>
      <div class="item-buy">
        <span>${snapshot.bonuses[item.bonus]}</span>
        <button class="menu-button compact-button" data-action="buy-bonus" data-bonus="${item.bonus}" type="button">${item.cost}</button>
      </div>
    `;
    row.querySelector("button").disabled = snapshot.profile.rays < item.cost;
    els.shopList.append(row);
  }
}

function renderLeaderboard(snapshot) {
  els.ratingValue.textContent = snapshot.profile.rating;
  els.ratingRays.textContent = snapshot.profile.rays;
  els.ratingBest.textContent = `x${Math.max(0, ...snapshot.moveHistory.map((move) => move.cascades ?? 0))}`;

  const rows = [
    ...rivals,
    { name: "You", rating: snapshot.profile.rating, record: `${snapshot.scores.player}-${snapshot.scores.ai}`, player: true },
  ].sort((a, b) => b.rating - a.rating);

  els.leaderboardList.innerHTML = "";
  rows.forEach((row, index) => {
    const item = document.createElement("div");
    item.className = `rank-row${row.player ? " is-player" : ""}`;
    item.innerHTML = `
      <span>${index + 1}</span>
      <strong>${row.name}</strong>
      <em>${row.record}</em>
      <b>${row.rating}</b>
    `;
    els.leaderboardList.append(item);
  });
}

function renderSettings() {
  els.settingSound.checked = uiPreferences.sound;
  els.settingSfx.checked = uiPreferences.sfx;
  els.settingAnimations.checked = uiPreferences.animations;
  els.settingMotion.value = String(uiPreferences.motion);
  els.settingMotionValue.textContent = `${uiPreferences.motion}%`;
  document.querySelectorAll("[data-setting]").forEach((button) => {
    button.classList.toggle("is-selected", uiPreferences[button.dataset.setting] === button.dataset.value);
  });
  document.body.classList.toggle("reduce-ui-motion", !uiPreferences.animations || uiPreferences.motion === 0);
}

function updatePreference(key, value) {
  uiPreferences = { ...uiPreferences, [key]: value };
  renderSettings();
}

function applySettings() {
  showToast("Settings applied.");
  openMainMenu();
}

function buyBonus(bonus) {
  const item = shopItems.find((candidate) => candidate.bonus === bonus);
  if (!item || state.profile.rays < item.cost) {
    showToast("Not enough Rays.");
    return;
  }

  state = {
    ...state,
    profile: {
      ...state.profile,
      rays: state.profile.rays - item.cost,
    },
    bonuses: {
      ...state.bonuses,
      [bonus]: state.bonuses[bonus] + 1,
    },
    events: [{ type: "ShopPurchase", message: `${item.label} purchased.` }],
  };
  render();
}

function clearPressedButtons() {
  document.querySelectorAll("button.is-pressed, button.is-touch-hover").forEach((button) => {
    button.classList.remove("is-pressed", "is-touch-hover");
  });
}

function formatTurn(snapshot) {
  if (snapshot.winner === Owner.Player) return "Victory";
  if (snapshot.winner === Owner.AI) return "Defeat";
  if (snapshot.winner === "draw") return "Draw";
  return snapshot.turn === Turn.Player ? `Player move - ${snapshot.legalMoves} options` : "AI thinking";
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
  button.classList.add("is-idle");
  if (!phase) return;

  const isSwapCell = phase.type === "swap" && isPosition(cell, phase.from, phase.to);
  const isMatchedCell = phase.matchedIds?.includes(cell.id);
  const isCapturedCell = phase.capturedIds?.includes(cell.id);
  const isMovedCell = phase.movedIds?.includes(cell.id);
  const isSpawnedCell = phase.spawnedIds?.includes(cell.id);
  const isRejectedCell = phase.type === "rejected" && isPosition(cell, phase.from, phase.to);
  const isMixedCell = phase.type === "mix" && phase.changedIds?.includes(cell.id);
  const isBonusCell = phase.type === "bonus" && phase.targetIds?.includes(cell.id);
  const isAffectedCell = isSwapCell || isMatchedCell || isCapturedCell || isMovedCell || isSpawnedCell || isRejectedCell || isMixedCell || isBonusCell;

  const actionOwner = phase.actor;
  button.classList.toggle("is-player-action", actionOwner === Owner.Player && isAffectedCell);
  button.classList.toggle("is-ai-action", actionOwner === Owner.AI && isAffectedCell);

  if (isSwapCell) {
    button.classList.add("is-swapping");
    button.classList.toggle("is-swap-from", isPosition(cell, phase.from));
    button.classList.toggle("is-swap-to", isPosition(cell, phase.to));
    button.classList.add(getSwapDirectionClass(cell, phase));
    button.classList.remove("is-idle");
  }

  if (phase.type === "match" && isMatchedCell) {
    button.classList.add("is-clearing");
    button.classList.add("is-destroying");
    button.classList.remove("is-idle");
  }

  if (phase.type === "refill" && isMovedCell) {
    button.classList.add("is-refill-moving");
    button.classList.add(phase.actor === Owner.Player ? "move-from-bottom" : "move-from-top");
    button.classList.remove("is-idle");
  }

  if (phase.type === "refill" && isSpawnedCell) {
    button.classList.add("is-spawning");
    button.classList.add(phase.actor === Owner.Player ? "move-from-bottom" : "move-from-top");
    button.classList.remove("is-idle");
  }

  if (phase.type === "advance" && isCapturedCell) {
    button.classList.add("is-captured");
  }

  if (isMixedCell) {
    button.classList.add("is-mixing");
    button.classList.remove("is-idle");
  }

  if (isBonusCell) {
    button.classList.add("is-bonus-target");
    button.classList.remove("is-idle");
  }

  if (isRejectedCell) {
    button.classList.add("is-rejected");
    button.classList.toggle("is-swap-from", isPosition(cell, phase.from));
    button.classList.toggle("is-swap-to", isPosition(cell, phase.to));
    button.classList.add(getSwapDirectionClass(cell, phase));
    button.classList.remove("is-idle");
  }
}

function getSwapDirectionClass(cell, phase) {
  const counterpart = isPosition(cell, phase.from) ? phase.to : phase.from;
  if (!counterpart) return "move-horizontal";
  const rowDelta = counterpart.row - cell.row;
  const colDelta = counterpart.col - cell.col;
  if (rowDelta > 0) return "move-from-top";
  if (rowDelta < 0) return "move-from-bottom";
  if (colDelta > 0) return "move-from-right";
  if (colDelta < 0) return "move-from-left";
  return "move-horizontal";
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
  if (phase.type === "swap") return 700;
  if (phase.type === "bonus") return 520;
  if (phase.type === "mix") return 620;
  if (phase.type === "match") return 760;
  if (phase.type === "refill") return 700;
  if (phase.type === "advance") return 760;
  if (phase.type === "rejected") return 380;
  if (phase.type === "turnEnd") return 240;
  return 240;
}
