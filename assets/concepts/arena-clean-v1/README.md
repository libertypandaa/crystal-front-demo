# Arena Clean v1 Asset Notes

This folder contains the first generated Arena Clean asset pack.

## Applied in demo

- `source/arena-background.png`
  - Used as the current battle screen background.

## Approval sheets

- `source/board-frame-hud-chromakey.png`
- `source/crystals-tiles-frontier-chromakey.png`
- `source/bonus-system-icons-chromakey.png`
- `alpha/board-frame-hud-alpha.png`
- `alpha/crystals-tiles-frontier-alpha.png`
- `alpha/bonus-system-icons-alpha.png`
- `arena-clean-v1-preview.png`

These sheets are for style approval and should not be sliced directly into final game assets without review.

## Animation direction

- Crystals should be regenerated as simple single-gem sprites, not decorative clusters.
- Each crystal needs a stable base frame plus animation-ready variants: idle shimmer, selected, swap motion support, clear/break, spawn.
- The frontier strip should be a layered animated effect: static base gradient plus moving energy highlight.
- Bonus button backplates should stay static. Bonus icon energy should animate separately.

