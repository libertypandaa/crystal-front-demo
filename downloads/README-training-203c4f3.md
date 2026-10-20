# Crystal Front: Android training test

[Download the test APK](./crystal-front-android-training-203c4f3.apk)

Nine-step first-match training with manual Next/Skip, real bonus practice, factual score breakdown, and Russian/English text. Existing profile, consent, rating, currency and real bonus inventory stay separate from training.

- Package: com.liber.crystalfront.debug, version 1.0.4-debug / code 5 (existing debug version retained).
- Local Android source commit: 203c4f32c0e9574a01656b40105161d3d8bc2eba.
- Test package method: only assets/public replaced in a byte-verified unchanged native debug baseline; official SDK 36 zipalign 16KB and apksigner v2/v3 verification passed. This is **not a successful fresh Gradle build**.
- 115 public files match the final web bundle; 631 other APK entries are unchanged. Debug signing certificate matches the previous debug APK.
- 17 Node test suites passed. Integrated main menu→training→first crystal selection observed; full integrated walkthrough/Skip via UI blocked by browser-tool dispatch timeouts. No physical-device installation test.
- This is a test APK; no Google Play upload or release.

Size: 13,913,605 bytes.

SHA-256:

```text
9cd410d244bf80ab6035b089e494f0db302013c6489c63e5087b4d4d354f7725
```

Use the download link on your Android phone and allow installation from that browser if Android asks. This debug package is separate from the Google Play application.
