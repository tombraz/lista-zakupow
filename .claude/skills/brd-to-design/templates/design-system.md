---
status: draft          # draft | approved
approved:
source_direction: <variant chosen in design-decisions.md>
design_tool: repo       # repo | claude-design (same as design-decisions.md)
artifact:              # claude-design only: link to the Design System artifact
imported:              # claude-design only: date of the last import
---

# Design system

## Principles

<3–5 principles that settle disputes, e.g. "Content first: chrome never competes with data".>

## Tokens

Source of truth: `docs/design/tokens.json` (W3C design-tokens format: `$type`, `$value`; dark colour values in `tokens.dark.json`). Platform code consumes tokens; it never hard-codes values. `node scripts/design-check.mjs --scan <UI dirs>` enforces it.

### Colour (semantic)

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| color.bg.default | | | page background |
| color.text.primary | | | body text |
| color.action.primary | | | primary buttons, links |
| color.status.error | | | errors |

### Typography

| Token | Size / line height | Weight | Use |
| --- | --- | --- | --- |

### Spacing, radii, elevation, motion

<Scales with values and usage notes.>

## Components

### <Component name>
- **Used on:** SC-xx, SC-yy
- **Variants:** <primary, secondary, …>
- **States:** default, hover, focus, pressed, disabled, loading, error
- **Accessibility:** <role, keyboard behaviour, focus order, minimum touch target>
- **Do / Don't:** <short examples>

## Accessibility rules

- Target: <e.g. WCAG 2.2 AA> (checklist: `.claude/skills/brd-to-design/references/accessibility.md`)
- Focus style: <ring colour token, width, offset; visible on every interactive state; never hidden by sticky bars>
- Minimum target size: <web ≥ 24 × 24 CSS px; iOS 44 × 44 pt; Android 48 × 48 dp>
- Drag actions and their single-pointer alternatives: <list or "none">
- Motion: <durations; what is turned off with "reduce motion">
- Keyboard and screen-reader rules per component: in "Components" above

### Contrast pairs

Every text/background and component/background combination the screens use. `node scripts/design-check.mjs` computes each pair with the WCAG formula for the light theme and, if `tokens.dark.json` exists, the dark theme. Use: `text` (4.5:1; AAA 7:1), `large-text` (≥ 24 px or ≥ 18.66 px bold: 3:1; AAA 4.5:1), `ui` (input borders, focus ring, icons, chart lines: 3:1).

| Foreground | Background | Use |
| --- | --- | --- |
| color.text.primary | color.bg.default | text |
| color.border.input | color.bg.default | ui |

## Platform notes

<How tokens map to each platform's styling technology chosen in design-decisions.md.>

| Platform | Generated from tokens.json by | Output path (excluded from the hard-coded check with `--allow`) | UI source dirs (`--scan`) |
| --- | --- | --- | --- |
| web | <e.g. Style Dictionary build step> | <e.g. apps/web/src/theme/generated> | <apps/web/src> |
