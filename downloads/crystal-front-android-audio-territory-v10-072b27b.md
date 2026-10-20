# Crystal Front Android: training sound, territory progress, repeatable test training

[Download APK](./crystal-front-android-audio-territory-v10-072b27b.apk)

APK version: 1.0.9-debug (versionCode 10)
Visible menu version: v0.1.34 Android.10
Package: com.liber.crystalfront.debug
Source commit: 072b27b8029ae56a140196cd57e4c9d5526b17eb
Size: 13,941,952 bytes
SHA256: 6a563a92e022eb6730b018ea38dd4f9b37ad44731c1ec03a95f167393c1b99ba
Certificate SHA256: 6bef05e0a6a6c47a1a055fc3d09b795c6d934e2b3ee6e9f220445faa9c44219f

## Changes

Training uses the ordinary game sound controller, sample cache, phase effects and common Sound setting. Selection, swaps, matches, cascades and bonuses route through a validated frame/session bridge. Trusted Start calls real Audio.play synchronously. Completing a lesson preserves its last playing sample; leaving cancels delayed or stale effects. Existing effective Sound preference semantics are preserved.

Territory matches show the current owned percentage and target together in the existing goal card, in Russian or English. The current value comes from the domain territory calculation and updates with real player, AI and bonus states. Its integer display does not round up to a target before victory. Score mode keeps its existing goal display; no extra territory bar is added.

For this testing APK, EVERY main Start Match action opens training again, including after completion or Skip and with previous TrainingV3 preferences. This is gated by the exact native App.getInfo package com.liber.crystalfront.debug. Debug completion does not change the permanent training preference. The production package and unknown/error package info keep one-time training. The final button of a training session still opens match setup normally. Continue remains the normal saved-match action.

Profiles, Rays, inventory, consent, gameplay rules revision 3 and match-reset revision 1 are preserved. No browser production/LPA or release version settings were changed.

## Verification

Thirteen sound/HUD and existing regression suites passed. After adding debug replay, four affected suites were rerun successfully, plus twelve actual-main debug/release replay cases. Actual main audio tests verify six cases including mute/mixed preferences, shared engine, source/origin/session validation, a fresh synchronous Audio.play on Start and terminal cancellation. There are 174 actual RU/EN HUD renders across real player, AI and all four bonus traces. Test adapters replace DOM and native services; production application code executes in these tests.

A Chrome smoke test of the final web build at 390x844 opened training, skipped into match setup and started an 80-percent territory match. The RU goal card displayed Territory 50 percent and Target 80 percent over two lines without covering the board. This is a limited browser layout check, not an Android phone test; audible playback was not assessed by listening.

Real Gradle assembleDebug and SDK verification passed. Package, code 10, version name, original signing certificate, 16KB alignment and all 115 final web assets were verified. Explicit bundle checks cover shared/offline training audio, territory HUD and debug/release replay gating. The earlier unpublished code10 APK with SHA256 8ab145a781dae21ac9a4d1d90a6675b0b04428af5e478d09df3d96790006c50c is superseded by this file.
