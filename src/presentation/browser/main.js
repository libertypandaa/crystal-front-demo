import { Bonus, Owner, Turn, VictoryMode } from "../../core/constants.js";
import { createGame, getSnapshot, restart, runAiTurnWithTrace, runComputerTurnWithTrace, selectBonus, selectCell, submitBonusTurn, submitSwapTurn } from "../../core/game.js";
import { MockRewardedAdProvider, RewardedAdStatus } from "./rewardedAds.js";

const APP_VERSION = "0.1.19";
const PROGRESS_STORAGE_KEY = "crystalFrontProgressV1";
const AD_REWARD_RAYS = 40;
const AD_COOLDOWN_MS = 60_000;

const persistedProgress = loadPersistedProgress();
let state = hydrateProgress(createGame(271828), persistedProgress);
let isAnimating = false;
let isClaimingAdReward = false;
let appView = "main";
let hasStartedMatch = false;
let pendingSettings = { ...state.settings };
let setupReturnView = "main";
let duelAssistSide = Owner.Player;
let duelSpeedIndex = 1;
const duelSpeeds = [0.5, 1, 2, 4];
let uiPreferences = {
  sound: true,
  sfx: true,
  animations: true,
  motion: 100,
};

const shopItems = [
  { bonus: Bonus.Bomb, label: "Bomb", detail: "Clears a 3x3 strike zone.", cost: 35 },
  { bonus: Bonus.Line, label: "Line", detail: "Clears one row and column.", cost: 45 },
  { bonus: Bonus.Mix, label: "Mix", detail: "Shuffles a local 5x5 area.", cost: 30 },
  { bonus: Bonus.Color, label: "Color", detail: "Clears one crystal color.", cost: 60 },
];

const rayPacks = [
  { id: "spark", label: "Spark Pack", rays: 250, price: "$1.99" },
  { id: "beacon", label: "Beacon Pack", rays: 700, price: "$4.99" },
  { id: "lighthouse", label: "Lighthouse Pack", rays: 1800, price: "$9.99" },
];

let shopState = {
  lastAdClaimAt: persistedProgress?.shop?.lastAdClaimAt ?? 0,
};
const rewardedAds = new MockRewardedAdProvider();

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
  victoryModeButtons: [...document.querySelectorAll("[data-victory-mode]")],
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
  duelAssistPanel: document.querySelector("#duelAssistPanel"),
  duelAssistButtons: [...document.querySelectorAll("[data-assist-side]")],
  duelSpeedButtons: [...document.querySelectorAll("[data-duel-speed-step]")],
  duelSpeedValue: document.querySelector("#duelSpeedValue"),
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

  if (state.selectedBonus && (state.turn === Turn.Player || state.settings.victoryMode === VictoryMode.AiDuel)) {
    const actor = state.settings.victoryMode === VictoryMode.AiDuel ? duelAssistSide : Owner.Player;
    await commitAnimatedTurn(submitBonusTurn(state, state.selectedBonus, position, actor));
    if (state.settings.victoryMode === VictoryMode.AiDuel) {
      await maybeRunAiDuel();
    } else {
      await maybeRunAi();
    }
    return;
  }

  if (state.settings.victoryMode === VictoryMode.AiDuel) return;

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
    if (state.settings.victoryMode === VictoryMode.AiDuel) {
      const bonus = button.dataset.bonus;
      if (state.bonuses[bonus] <= 0) {
        showToast("No bonus charges left.");
        return;
      }
      state = {
        ...state,
        selected: null,
        selectedBonus: state.selectedBonus === bonus ? null : bonus,
      };
    } else {
      state = selectBonus(state, button.dataset.bonus);
    }
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
  const versionLabel = event.target.closest("[data-version-check]");
  if (versionLabel) {
    checkForLatestVersion();
    return;
  }

  const actionButton = event.target.closest("[data-action]");
  if (!actionButton || actionButton.disabled) return;
  handleMenuAction(actionButton.dataset.action, actionButton);
});

document.addEventListener("pointerdown", (event) => {
  const button = event.target.closest("button");
  if (!button || button.disabled) return;
  updateButtonPointer(button, event);
  button.classList.add("is-pressed");
  if (button.classList.contains("menu-button")) {
    button.classList.remove("is-rippling");
    window.cancelAnimationFrame(button.rippleFrame);
    button.rippleFrame = requestAnimationFrame(() => {
      if (button.classList.contains("is-pressed")) button.classList.add("is-rippling");
    });
  }
});

document.addEventListener("pointerup", clearPressedButtons);
document.addEventListener("pointercancel", clearPressedButtons);

document.addEventListener("animationend", (event) => {
  if (event.animationName === "menu-button-ripple" && event.target.classList.contains("menu-button")) {
    event.target.classList.remove("is-rippling");
  }
});

document.addEventListener("pointermove", (event) => {
  document.querySelectorAll("button.is-touch-hover").forEach((button) => button.classList.remove("is-touch-hover"));
  const button = document.elementFromPoint(event.clientX, event.clientY)?.closest("button");
  if (button && !button.disabled) {
    updateButtonPointer(button, event);
    button.classList.add("is-touch-hover");
  }
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

els.victoryModeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    pendingSettings = {
      ...pendingSettings,
      victoryMode: button.dataset.victoryMode,
    };
    renderSetupValues();
  });
});

els.duelAssistButtons.forEach((button) => {
  button.addEventListener("click", () => {
    duelAssistSide = button.dataset.assistSide === Owner.AI ? Owner.AI : Owner.Player;
    renderDuelAssist();
  });
});

els.duelSpeedButtons.forEach((button) => {
  button.addEventListener("click", () => {
    duelSpeedIndex = Math.max(0, Math.min(duelSpeeds.length - 1, duelSpeedIndex + Number(button.dataset.duelSpeedStep)));
    renderDuelAssist();
  });
});

els.settingSound.addEventListener("change", () => updatePreference("sound", els.settingSound.checked));
els.settingSfx.addEventListener("change", () => updatePreference("sfx", els.settingSfx.checked));
els.settingAnimations.addEventListener("change", () => updatePreference("animations", els.settingAnimations.checked));
els.settingMotion.addEventListener("input", () => updatePreference("motion", Number(els.settingMotion.value)));

function handleMenuAction(action, sourceButton) {
  clearButtonFeedback({ includeRipple: true });
  if (action === "start") startNewMatch();
  if (action === "continue") continueMatch();
  if (action === "setup") openSetupMenu();
  if (action === "shop") openShopMenu();
  if (action === "leaderboard") openLeaderboardMenu();
  if (action === "settings") openSettingsMenu();
  if (action === "buy-bonus") buyBonus(sourceButton.dataset.bonus);
  if (action === "claim-ad-reward") claimAdReward();
  if (action === "iap-unavailable") showToast("IAP is disabled in this browser demo.");
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

async function maybeRunAiDuel() {
  if (appView !== "battle" || state.winner || state.settings.victoryMode !== VictoryMode.AiDuel || state.turn === Turn.Ended || isAnimating || state.selectedBonus) return;
  await wait(620 / getDuelSpeed());
  if (appView !== "battle" || state.winner || state.settings.victoryMode !== VictoryMode.AiDuel || isAnimating || state.selectedBonus) return;
  await commitAnimatedTurn(runComputerTurnWithTrace(state, state.turn === Turn.Player ? Owner.Player : Owner.AI));
  await maybeRunAiDuel();
}

async function commitAnimatedTurn(result) {
  isAnimating = true;
  document.body.classList.add("is-animating");

  for (const phase of result.trace) {
    if (phase.cells) render(makeSnapshot(phase.cells), phase);
    await wait(getPhaseDuration(phase) / getDuelAnimationSpeed());
  }

  state = result.state;
  persistLastMoves();
  persistProgress();
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
  els.targetScore.textContent = snapshot.settings.victoryMode === VictoryMode.TargetScore
    ? snapshot.settings.targetScore
    : snapshot.settings.victoryMode === VictoryMode.LastMove
      ? "LAST"
      : "DUEL";

  for (const bonus of Object.values(Bonus)) {
    const count = document.querySelector(`#bonus-${bonus}`);
    const button = document.querySelector(`[data-bonus="${bonus}"]`);
    count.textContent = snapshot.bonuses[bonus];
    button.classList.toggle("is-selected", snapshot.selectedBonus === bonus);
    button.disabled = snapshot.bonuses[bonus] <= 0 || snapshot.winner || isAnimating || appView !== "battle" || (snapshot.turn !== Turn.Player && snapshot.settings.victoryMode !== VictoryMode.AiDuel);
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
  renderDuelAssist(snapshot);
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
  maybeRunAiDuel();
}

function startNewMatch() {
  state = hydrateProgress(createGame(Date.now(), pendingSettings));
  hasStartedMatch = true;
  appView = "battle";
  render();
  maybeRunAiDuel();
}

function restartMatch() {
  if (isAnimating) return;
  state = hydrateProgress(restart(state));
  hasStartedMatch = true;
  appView = "battle";
  render();
  maybeRunAiDuel();
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
  els.setupTargetScore.disabled = pendingSettings.victoryMode !== VictoryMode.TargetScore;
  els.victoryModeButtons.forEach((button) => {
    button.classList.toggle("is-selected", button.dataset.victoryMode === pendingSettings.victoryMode);
  });
}

function renderShop(snapshot) {
  const now = Date.now();
  const rewardReadyAt = shopState.lastAdClaimAt + AD_COOLDOWN_MS;
  const rewardSeconds = Math.max(0, Math.ceil((rewardReadyAt - now) / 1000));
  const rewardDisabled = rewardSeconds > 0 || isClaimingAdReward;

  els.shopList.innerHTML = "";
  const balance = document.createElement("section");
  balance.className = "shop-section shop-balance";
  balance.innerHTML = `
    <div>
      <span>BALANCE</span>
      <strong>${snapshot.profile.rays}</strong>
    </div>
  `;
  els.shopList.append(balance);

  const bonusSection = document.createElement("section");
  bonusSection.className = "shop-section";
  bonusSection.innerHTML = `<h3>Combat Bonuses</h3>`;
  for (const item of shopItems) {
    const row = document.createElement("div");
    row.className = "item-row shop-item";
    row.innerHTML = `
      <div>
        <strong>${item.label}</strong>
        <span>${item.detail}</span>
      </div>
      <div class="item-buy">
        <span>Owned ${snapshot.bonuses[item.bonus]}</span>
        <button class="menu-button compact-button" data-action="buy-bonus" data-bonus="${item.bonus}" type="button">${item.cost} Rays</button>
      </div>
    `;
    row.querySelector("button").disabled = snapshot.profile.rays < item.cost;
    bonusSection.append(row);
  }
  els.shopList.append(bonusSection);

  const rewardSection = document.createElement("section");
  rewardSection.className = "shop-section";
  rewardSection.innerHTML = `
    <h3>Free Rays</h3>
    <div class="item-row shop-item shop-reward">
      <div>
        <strong>Rewarded Ad</strong>
        <span>${isClaimingAdReward ? "Showing test ad..." : rewardSeconds > 0 ? `Ready in ${rewardSeconds}s` : "Test reward for the browser demo."}</span>
      </div>
      <div class="item-buy">
        <span>+${AD_REWARD_RAYS}</span>
        <button class="menu-button compact-button primary" data-action="claim-ad-reward" type="button">${isClaimingAdReward ? "..." : rewardSeconds > 0 ? "Wait" : "Claim"}</button>
      </div>
    </div>
  `;
  rewardSection.querySelector("button").disabled = rewardDisabled;
  els.shopList.append(rewardSection);

  const packSection = document.createElement("section");
  packSection.className = "shop-section";
  packSection.innerHTML = `<h3>Ray Packs</h3>`;
  for (const pack of rayPacks) {
    const row = document.createElement("div");
    row.className = "item-row shop-item shop-pack";
    row.innerHTML = `
      <div>
        <strong>${pack.label}</strong>
        <span>${pack.rays} Lighthouse Rays</span>
      </div>
      <div class="item-buy">
        <span>${pack.price}</span>
        <button class="menu-button compact-button" data-action="iap-unavailable" data-pack="${pack.id}" type="button">IAP</button>
      </div>
    `;
    packSection.append(row);
  }
  els.shopList.append(packSection);
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
  document.body.classList.toggle("reduce-ui-motion", !uiPreferences.animations || uiPreferences.motion === 0);
}

function renderDuelAssist(snapshot = getSnapshot(state)) {
  const isAiDuel = snapshot.settings.victoryMode === VictoryMode.AiDuel && appView === "battle";
  els.duelAssistPanel.hidden = !isAiDuel;
  els.duelSpeedValue.textContent = `${getDuelSpeed()}x`;
  els.duelAssistButtons.forEach((button) => {
    button.classList.toggle("is-selected", button.dataset.assistSide === duelAssistSide);
  });
  els.duelSpeedButtons.forEach((button) => {
    const nextIndex = duelSpeedIndex + Number(button.dataset.duelSpeedStep);
    button.disabled = nextIndex < 0 || nextIndex >= duelSpeeds.length;
  });
  document.body.classList.toggle("is-ai-duel", isAiDuel);
}

function getDuelSpeed() {
  return duelSpeeds[duelSpeedIndex] ?? 1;
}

function getDuelAnimationSpeed() {
  return state.settings.victoryMode === VictoryMode.AiDuel ? getDuelSpeed() : 1;
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
  persistProgress();
  render();
}

async function claimAdReward() {
  if (isClaimingAdReward) return;
  const now = Date.now();
  if (now - shopState.lastAdClaimAt < AD_COOLDOWN_MS) {
    const seconds = Math.ceil((shopState.lastAdClaimAt + AD_COOLDOWN_MS - now) / 1000);
    showToast(`Reward ready in ${seconds}s.`);
    return;
  }

  showToast("Showing rewarded ad...");
  isClaimingAdReward = true;
  render();
  const result = await rewardedAds.show();
  isClaimingAdReward = false;
  if (result.status !== RewardedAdStatus.Rewarded) {
    showToast(result.message || "Rewarded ad is unavailable.");
    render();
    return;
  }

  shopState = { ...shopState, lastAdClaimAt: now };
  state = {
    ...state,
    profile: {
      ...state.profile,
      rays: state.profile.rays + AD_REWARD_RAYS,
    },
    events: [{ type: "ShopReward", message: `+${AD_REWARD_RAYS} Rays claimed via ${result.provider}.` }],
  };
  persistProgress();
  render();
}

function hydrateProgress(gameState, progress = loadPersistedProgress()) {
  if (!progress) return gameState;
  return {
    ...gameState,
    profile: {
      ...gameState.profile,
      ...sanitizeProfile(progress.profile),
    },
    bonuses: {
      ...gameState.bonuses,
      ...sanitizeBonuses(progress.bonuses),
    },
  };
}

function sanitizeProfile(profile = {}) {
  return {
    rating: sanitizeNumber(profile.rating, 1200),
    rays: sanitizeNumber(profile.rays, 260),
  };
}

function sanitizeBonuses(bonuses = {}) {
  return {
    [Bonus.Bomb]: sanitizeNumber(bonuses[Bonus.Bomb], 3),
    [Bonus.Line]: sanitizeNumber(bonuses[Bonus.Line], 3),
    [Bonus.Mix]: sanitizeNumber(bonuses[Bonus.Mix], 2),
    [Bonus.Color]: sanitizeNumber(bonuses[Bonus.Color], 2),
  };
}

function sanitizeNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.floor(number) : fallback;
}

function loadPersistedProgress() {
  try {
    const raw = window.localStorage.getItem(PROGRESS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function persistProgress() {
  try {
    window.localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify({
      version: APP_VERSION,
      profile: state.profile,
      bonuses: state.bonuses,
      shop: shopState,
    }));
  } catch {
    // Progress persistence is best-effort in private or restricted browser modes.
  }
}

function clearPressedButtons() {
  clearButtonFeedback();
}

function clearButtonFeedback({ includeRipple = false } = {}) {
  const selector = includeRipple
    ? "button"
    : "button.is-pressed, button.is-touch-hover";
  document.querySelectorAll(selector).forEach((button) => {
    window.cancelAnimationFrame(button.rippleFrame);
    button.classList.remove("is-pressed", "is-touch-hover");
    if (includeRipple) {
      button.classList.remove("is-rippling");
      button.style.removeProperty("--press-x");
      button.style.removeProperty("--press-y");
    }
  });
}

function updateButtonPointer(button, event) {
  const rect = button.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / rect.width) * 100;
  const y = ((event.clientY - rect.top) / rect.height) * 100;
  button.style.setProperty("--press-x", `${Math.max(0, Math.min(100, x))}%`);
  button.style.setProperty("--press-y", `${Math.max(0, Math.min(100, y))}%`);
}

function formatTurn(snapshot) {
  if (snapshot.winner === Owner.Player) return "Victory";
  if (snapshot.winner === Owner.AI) return "Defeat";
  if (snapshot.winner === "draw") return "Draw";
  if (snapshot.settings.victoryMode === VictoryMode.AiDuel) {
    return snapshot.turn === Turn.Player
      ? `Blue AI - ${snapshot.playableMoves.player} options`
      : `Red AI - ${snapshot.playableMoves.ai} options`;
  }
  if (snapshot.settings.victoryMode === VictoryMode.LastMove) {
    return snapshot.turn === Turn.Player
      ? `Player move - ${snapshot.playableMoves.player} options`
      : `AI thinking - ${snapshot.playableMoves.ai} options`;
  }
  return snapshot.turn === Turn.Player ? `Player move - ${snapshot.legalMoves} options` : "AI thinking";
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add("is-visible");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => els.toast.classList.remove("is-visible"), 1800);
}

async function checkForLatestVersion() {
  showToast("Checking version...");
  try {
    const latestVersion = await fetchLatestVersion();
    if (!latestVersion) {
      showToast("Could not read latest version.");
      return;
    }

    if (compareVersions(latestVersion, APP_VERSION) <= 0) {
      showToast(`Latest version: v${APP_VERSION}.`);
      return;
    }

    showToast(`Updating to v${latestVersion}...`);
    window.setTimeout(() => reloadWithVersion(latestVersion), 420);
  } catch {
    showToast("Version check failed.");
  }
}

async function fetchLatestVersion() {
  const checkUrl = new URL("./index.html", window.location.href);
  checkUrl.searchParams.set("cache-check", String(Date.now()));
  const response = await fetch(checkUrl.href, {
    cache: "no-store",
    headers: { "Cache-Control": "no-cache" },
  });
  if (!response.ok) return null;
  const html = await response.text();
  return readLatestVersionFromHtml(html);
}

function readLatestVersionFromHtml(html) {
  const assetVersion = html.match(/main\.js\?v=([0-9]+(?:\.[0-9]+){1,3})/i)?.[1];
  const labelVersion = html.match(/v([0-9]+(?:\.[0-9]+){1,3})/)?.[1];
  return assetVersion ?? labelVersion ?? null;
}

function reloadWithVersion(version) {
  const nextUrl = new URL(window.location.href);
  nextUrl.searchParams.set("v", version);
  nextUrl.searchParams.set("refresh", String(Date.now()));
  window.location.replace(nextUrl.href);
}

function compareVersions(left, right) {
  const leftParts = String(left).split(".").map((part) => Number(part));
  const rightParts = String(right).split(".").map((part) => Number(part));
  const length = Math.max(leftParts.length, rightParts.length);
  for (let index = 0; index < length; index += 1) {
    const diff = (leftParts[index] || 0) - (rightParts[index] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
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
