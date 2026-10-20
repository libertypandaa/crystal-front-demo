# Crystal Front Android: replay the updated training once

[Download APK](./crystal-front-android-training-v8-097af15.apk)

APK version: 1.0.7-debug (versionCode 8)
Visible menu version: v0.1.34 Android.8
Package: com.liber.crystalfront.debug
Source commit: 097af15d03b19ce04c0b6ec445d263a17d520dcd
Size: 13,873,882 bytes
SHA256: 85c0a1c400e2ba77e5d89612d1e021466203c4e007684595c446bea651db9c27
Certificate SHA256: 6bef05e0a6a6c47a1a055fc3d09b795c6d934e2b3ee6e9f220445faa9c44219f

## Behavior

Install over the previous debug APK. On the next New Match action, the existing first-training button opens the updated tutorial once, even if the previous training revision was completed or skipped. Completion and Skip save a separate crystalFrontTrainingV2 flag. Interruption does not mark it complete. After completion or Skip, normal one-time behavior resumes for this revision.

The previous TrainingV1 flag, saved match, profile, Rays, bonuses, analytics settings, public-profile consent and rules revision 3 are preserved. Continue still resumes the saved match. No extra menus or confirmation screens were added. Existing build 7 training visuals and Android safe-area fixes are retained.

The menu version is now Android.8, distinct from the identical Android.7 label used in APK versions 5 through 7. Release/Play version settings are unchanged.

## Verification

Actual Gradle assembleDebug succeeded. Ten suites passed, including behavior tests using the actual training host with old completed/skipped flags, cold reload, interruption, storage failures and preservation of checkpoints and unrelated preferences. SDK tools verified package, code 8, name 1.0.7-debug, compatible signing certificate and 16KB alignment. All 115 final web assets match the APK, including embedded TrainingV2 and the updated visible version.

Physical-phone testing and fresh browser visual verification were not completed. The historical cause of repeated training in earlier installations was not established; this change explicitly enables one replay of the updated revision.
