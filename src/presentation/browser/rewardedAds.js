export const RewardedAdStatus = Object.freeze({
  Ready: "ready",
  Loading: "loading",
  Unavailable: "unavailable",
  Rewarded: "rewarded",
  Cancelled: "cancelled",
  Failed: "failed",
});

export class MockRewardedAdProvider {
  constructor({ delayMs = 3_200, ticks = 16 } = {}) {
    this.delayMs = delayMs;
    this.ticks = ticks;
    this.status = RewardedAdStatus.Ready;
  }

  isReady() {
    return this.status !== RewardedAdStatus.Loading;
  }

  async show({ onProgress } = {}) {
    if (!this.isReady()) {
      return { status: RewardedAdStatus.Unavailable, message: "Rewarded ad is already loading." };
    }

    this.status = RewardedAdStatus.Loading;
    const startedAt = Date.now();
    for (let tick = 0; tick <= this.ticks; tick += 1) {
      const elapsedMs = Date.now() - startedAt;
      onProgress?.({
        ratio: Math.min(1, elapsedMs / this.delayMs),
        remainingMs: Math.max(0, this.delayMs - elapsedMs),
      });
      if (tick < this.ticks) await wait(this.delayMs / this.ticks);
    }
    this.status = RewardedAdStatus.Ready;

    return {
      status: RewardedAdStatus.Rewarded,
      provider: "mock",
      message: "Browser demo rewarded ad completed.",
    };
  }
}

export class AdMobRewardedAdProvider {
  async show() {
    return {
      status: RewardedAdStatus.Unavailable,
      provider: "admob",
      message: "AdMob rewarded ads are available only in the Android build.",
    };
  }

  isReady() {
    return false;
  }
}

function wait(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
