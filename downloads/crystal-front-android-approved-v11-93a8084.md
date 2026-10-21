# Crystal Front Android.11: approved HUD and one-time training

[Download APK](./crystal-front-android-approved-v11-93a8084.apk)

21 October 2026. APK 1.0.10-debug, versionCode 11, visible version v0.1.34 Android.11.
Package: com.liber.crystalfront.debug.
Source commit: 93a8084425d994594e962f413db85d2ee6f4729d.
Size: 13,876,314 bytes.
SHA256: 2c059064ecab94cd31c09b2082d0cf19ef5f1e772bcce2995a3daa0e98d73257.
Certificate SHA256: 6bef05e0a6a6c47a1a055fc3d09b795c6d934e2b3ee6e9f220445faa9c44219f.

Training uses the same sounds and Sound setting as the game. Training is offered once using the existing TrainingV3 completion/skip marker. After completion or Skip, Start Match opens normal match setup. APK updates do not trigger training. Existing completed/skipped V3 markers are preserved. The legacy match reset remains the existing one-time revision 1; no new reset was introduced.

Territory mode displays Current / Target (Сейчас / Цель) and the current/target percentages in the existing goal card. The approved value uses 11px and nowrap. The original V9 panel, button geometry, padding and boundaries are restored. Score mode remains unchanged. Profiles, Rays, inventory and consent decisions are preserved.

Seven targeted regression suites passed, including 24 package-independent once-training cases, actual startup migration/failure/retry, six shared audio cases, 174 RU/EN domain-based territory HUD renders and localization. A strict CSS check verifies the original V9 CSS with only the two approved Territory typography declarations appended. The user approved the browser-rendered visual candidate.

Native Gradle assembleDebug and SDK verification passed: version, original certificate, 16KB alignment and all 115 packaged web assets verified. The final APK hash was independently checked before publication. This APK has not been installed or listened to on a physical Android device by the agent. Publication is a downloadable GitHub testing APK, not a Google Play rollout. Browser production and LPA were not changed.
