export const RewardedAdStatus = Object.freeze({
  Ready: "ready",
  Loading: "loading",
  Unavailable: "unavailable",
  Rewarded: "rewarded",
  Cancelled: "cancelled",
  Failed: "failed",
});

export class MockRewardedAdProvider {
  constructor({ delayMs = 800 } = {}) {
    this.delayMs = delayMs;
    this.status = RewardedAdStatus.Ready;
  }

  isReady() {
    return this.status !== RewardedAdStatus.Loading;
  }

  async show() {
    if (!this.isReady()) {
      return { status: RewardedAdStatus.Unavailable, message: "Rewarded ad is already loading." };
    }

    this.status = RewardedAdStatus.Loading;
    await wait(this.delayMs);
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
