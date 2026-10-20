# CrystalFront Android test build 6

Version: 1.0.5-debug (code 6), package com.liber.crystalfront.debug.

- Gameplay analytics starts automatically; the old statistics switch is removed. Public nickname and leaderboard publication still require separate consent.
- All matches saved under the previous rules are discarded on upgrade, including completed matches. Nickname, profile, Rays and bonuses are preserved. New matches can still be resumed.
- Native Android system-bar and display-cutout insets reserve safe space around the game, including tutorial controls. System bars hide and can be shown by swipe.

Install this APK over the previous debug build. The signing certificate is unchanged.

Built with Gradle, including new native Java/DEX. Migration and analytics regression suites passed. APK manifest, signature, 16 KB ZIP alignment, all 115 final web assets and changed DEX were verified. Physical-device UI behavior has not yet been verified.

Source commit: dcde757389cb95ce52854f2a81fb9aed727c589a (separate local Android project).

APK size: 13,936,357 bytes.

SHA256: cec00ca2dfb573dddb8c82b2cc9cdd9e037d6d4337f19bf72986fa08b0e5cd6a

Privacy policy: https://crystalfront-privacy.mysticapple32.chatgpt.site
