# Crystal Front Android: clean upgrade start and updated training

[Download APK](./crystal-front-android-clean-start-v9-616d8b2.apk)

APK version: 1.0.8-debug (versionCode 9)
Visible menu version: v0.1.34 Android.9
Package: com.liber.crystalfront.debug
Source commit: 616d8b2107178ac58c29c18aca59288913da4a48
Size: 13,873,982 bytes
SHA256: 23b1ab11c530b456a277d9e7a28d02db397938a333540f37051d986b722edf16
Certificate SHA256: 6bef05e0a6a6c47a1a055fc3d09b795c6d934e2b3ee6e9f220445faa9c44219f

## Behavior

Install over the previous debug APK. On first startup, old active and completed parties are retired once, including the previously restored result/rematch state. The app opens the normal initial menu with Continue disabled. The first Start Training Match opens the updated tutorial using a separate TrainingV3 completion flag.

The migration preserves player profile, Rays, rating, inventory, preferences and reward receipt. It stamps matchResetRevision 1 independently from gameplay rules revision 3. New parties with this marker survive subsequent launches. A legacy fallback checkpoint passes through the same migration before restore; migration must be saved and read back before startup becomes ready.

TrainingV1 and V2 preferences remain intact. V3 completes only on completion or Skip, not opening or interruption. No new screens, menus, prompts or changes to browser production/LPA were added. Release/Play version settings are unchanged.

## Verification

The actual main.js startup regression first reproduced the build 8 bug: an old party remained resumable. The same expectations pass on build 9. The final test runs real application/core/save-store/training modules with native adapters and DOM/clock stubs: eight active/completed, A/B and corrupt-fallback cases; failed persistence and actual bootstrap retry; initial menu, disabled Continue, Start to V3; preservation of profile/inventory/preferences; new active and completed parties surviving cold startup. Test SHA256: 4caff2946e756762f1a77585a9d5d277a9ca4246f0ae3bc185041b93d5799246. Ten additional targeted suites passed.

Actual native Gradle assembleDebug succeeded. SDK tools verified package, code 9, name 1.0.8-debug, compatible signing certificate and 16KB alignment. All 115 final web assets match the APK; bundled UI Android.9, TrainingV3 and matchResetRevision 1 were explicitly verified.

No physical-phone or fresh browser visual verification was completed. The full startup checks above are Node execution with native/DOM stubs, not an Android device test.
