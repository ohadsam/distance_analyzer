# What is waiting for ChatGPT

| # | Prompt file | Covers | Blocks | Status |
|---|---|---|---|---|
| 1 | `docs/prompts/STYLE_SYSTEM_PROMPT.md` | design language, palette, base icons | - | ✅ returned as the "Momentum" kit; tokens + 54 UI icons integrated (0.2.0). Art, backgrounds, badges, widgets, brand mark were placeholders |
| 3 | `docs/prompts/ROUND3_PROMPT.txt` | significant upgrade: new solid two-tone logo (3 concepts), layered app icon, duotone icon family with a signature + states + pack variants, rich hero art/backgrounds/weather/badges/widgets, rhythm-coach visuals | all screens' look, launcher icon, widgets | **ready - owner to paste into the same ChatGPT conversation** (supersedes the open items of #2) |
| 2a | `stepup-final.zip` (answer to #2) | brand (symbol, wordmark, lockups, adaptive icon, notification, app-bleed), 32 replaced art/widget/badge/state/background SVGs, motion schema, themes | - | ✅ brand integrated (0.3.0). **Still missing from #2:** rhythm-coach visuals + `rhythm.json`, original redraw of the 54 UI icons, onboarding/empty-state illustrations, weather scenes, chart language, splash. Art is stored in `design/stepup/svg`, not yet used by screens |
| 2 | `docs/prompts/ROUND2_PROMPT.txt` | originality pass on icons, StepUp logo (3 concepts, wordmark, lockups, adaptive icon, splash), rhythm-coach visuals + motion spec, real illustrations/backgrounds/weather, widgets, badges, chart language | polish of every screen, widgets (phase 9), badges (phase 10), name in the logo | **ready - owner to paste into the same ChatGPT conversation** |

Flow: prompt written here → owner pastes it in ChatGPT → owner returns the results → validate, look at the sheets, integrate → update `DESIGN_LANGUAGE.md` and this list.
