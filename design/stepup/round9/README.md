# StepUp Trail Athlete V5 — V3-based rebuild

**Integration status:** V3 remains the approved in-app character. V5 is a proposed replacement and needs visual review and Android testing.

- `rig/`: all 15 poses × light/dark × 96/200, original V3 pose filenames retained, external CSS only.
- `standalone/`: standalone animated pose and utility SVGs with embedded @keyframes.
- `silhouettes/`: 5 poses × 24/96, currentColor.
- `countdown/`: crouch ×3 then sprint, no digits; app supplies digits.
- `banners/`, `weather/`, `empty/`, `celebration/`, `share/`: character-bearing scenes.
- `utility/`: workout, alerts, loading, searching, guide states.
- `motion/`: trail-motion.css and motion.json.
- `contact-sheets/`: 24, 64, 96, 200 light/dark, scene sheets, original V3 sheets for comparison.
- `validation.json`: structural/render checks and pixel connectivity checks. Review reported failures before integration.

All artwork is original and dedicated CC0. No fonts, scripts or textual art. CSS animation and device behavior require integration testing. No external resources.
