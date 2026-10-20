# Crystal Front Android training fixes

[Download APK](./crystal-front-android-training-v7-3571b5c.apk)

Version: 1.0.6-debug (versionCode 7)
Package: com.liber.crystalfront.debug
Source commit: 3571b5c314ada625e3d9e3a2d0dbae134284674d
Size: 13,873,886 bytes
SHA256: b646f120dab029c581b53f9db89a02af566d39e241b40538aa9216afd480d006
Certificate SHA256: 6bef05e0a6a6c47a1a055fc3d09b795c6d934e2b3ee6e9f220445faa9c44219f

## Changes

- The existing arena background fills the Android window. Transparent system bars and display-cutout handling replace native padding that exposed white bands. Interactive content stays inside the safe area; panel and board sizes use its height.
- Territory percentages have a gold highlight only during their lesson. It clears on subsequent steps and exit.
- The current crystal or bonus icon animates to guide selection, then the target changes to the next required cell. Guidance stops after the action and respects reduced-motion preferences.
- Training reuses 64 board cells and 320 crystal spans. Instrumented swap and all four bonus traces create no additional cells or spans. Full-page localization runs once rather than on every render; hidden parent animations pause during training.
- Existing nine manual steps, square board, fixed hint panel, Skip/Next controls, TrainingV1 completion flag and rules revision 3 are preserved. Player profile, currency, inventory and public-profile consent are preserved.

## Verification

Actual native Gradle assembleDebug succeeded. Android SDK tools confirmed the APK package/version, the existing signing certificate, 16KB alignment, all 115 final web assets and changed native DEX compared with build 6. Ten Node suites passed, including expanded state, target cleanup, native DPR2/3, API guards and asymmetric safe-area regressions. Both CSS files parsed successfully.

Physical-phone testing, fresh browser visual verification and FPS measurements were not completed. Performance results above are allocation counts, not measured frame rates. Same package and certificate allow installation over the previous debug APK without uninstalling it.
