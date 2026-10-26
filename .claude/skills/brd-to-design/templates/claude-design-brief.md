---
product: <product name>
change:                # brownfield only: C-NN; the brief then covers new and changed screens only
written: <YYYY-MM-DD>
---

# Claude Design brief: <product name>

> How to use: open a new conversation in the Claude app, attach this file (or paste it) and write: "Work through this brief step by step." Claude creates the artifacts below, from its **Design** and **Design System** artifact types. You review and edit them there. At the end, Claude gives you the export files; put them in `docs/design/import/` in the repository and run `/brd-to-design` again.

## Instructions for Claude

You design the look of the product described below. Work in this order and wait for the user's choice where it says so.

1. **Directions.** Create one **Design** artifact named "<product> – directions" with 2–3 radically different visual directions (different layout and hierarchy, not only colours) for the key screens listed below. Use the real content from this brief, never lorem ipsum. Give an honest critique of each (strengths, weaknesses, fit with the personas) and a recommendation. **Wait for the user to choose or combine.** Do not use an existing design system unless "Brand assets" below names one.
2. **Design system.** Create one **Design System** artifact named "<product> – design system" from the chosen direction:
   - tokens named by role, never by value: `color.bg.default`, `color.text.primary`, `color.action.primary`, `color.status.error`, …; typography scale, spacing scale, radii, elevation, motion durations;
   - light and dark values for every colour token if "Theme" below says so;
   - contrast checked for every text/background and component/background pair against the accessibility target below (text 4.5:1, large text 3:1, input borders, focus ring and icons 3:1; AAA: 7:1 and 4.5:1 for text), in both themes; fix failures in the tokens, never by lowering the target;
   - WCAG 2.2 rules built into the components: a visible focus style never hidden by sticky bars, pointer targets ≥ 24 × 24 px on web (44 × 44 pt iOS, 48 × 48 dp Android), a button or menu alternative for every drag action, labels always visible (not only placeholders), errors in text and not only in colour, sign-in that works with password managers and paste;
   - only the components the screens below need, each with variants and states (default, hover, focus, pressed, disabled, loading, error) and accessibility notes.
   **Wait for the user's approval.**
3. **Screens.** In the Design artifact (a new page or section), design every screen in the list below with the design system, at the sizes of the platforms below. For each screen also show the states listed in its row. Name each artboard with the screen ID and name (`SC-03 List detail`).
4. **Gaps.** If a screen needs a decision this brief does not contain (a rule, a limit, a message), do not invent it: list it as an open question in the export.
5. **Export.** When the user approves, produce these files for download (exact names and formats; the repository checks them with a script):
   - `tokens.json` — all tokens in the W3C design-tokens format: nested groups, each token `{ "$type": "...", "$value": ... }`, top-level groups `color`, `typography`, `spacing`, `radius`, `elevation`, `motion`. Colour values are the **light** theme.
   - `tokens.dark.json` — only if there is a dark theme: the same colour token names with their dark values, same structure.
   - `design-system-export.md` — principles (3–5), components (used on which screens, variants, states, accessibility, do/don't), accessibility rules (focus style, target sizes, drag alternatives, motion), a table `## Contrast pairs` with the columns `| Foreground | Background | Use |` (token names; Use = `text`, `large-text` or `ui`) listing every pair the screens use, and the link to the Design System artifact.
   - `screens-export.md` — one section per screen: `## SC-xx <name>`, the link to the Design artifact and the artboard name, layout from top to bottom, components used, the states shown, copy (all texts), interactions, accessibility notes (focus order and where focus goes after each action, what is announced, headings, drag alternatives).
   - `open-questions.md` — open questions from step 4, or "none".

## Product

<Two or three sentences: what the product is, for whom, the problem it solves. From the BRD.>

**Personas:** <name: one line each>

**Tone:** <e.g. calm and practical; from the BRD or the user>

## Constraints

| Item | Value |
| --- | --- |
| Platforms (first first) | <web, iOS, Android> |
| Accessibility target | <WCAG 2.2 AA> |
| Theme | <light only / light + dark> |
| Languages | <pl, en; RTL: no> |
| Brand assets | <logo, colours, fonts, or "none: propose"> |
| Styling technology (for information) | <e.g. Tailwind on web, React Native StyleSheet on mobile> |

## Key screens for directions

<2–3 screen IDs from the list below that carry the product's character.>

## Screens

From `docs/design/ia.md`. Design all of them in step 3.

| ID | Screen | Purpose | Requirements | Platforms | Access | States to show |
| --- | --- | --- | --- | --- | --- | --- |
| SC-01 | <name> | <what the user does here> | F-01 | web, ios | signed-in | empty, loading, error, success, no permission |

## Navigation and journeys

<Copy the navigation description and the core journeys (J-xx) from ia.md, as text or Mermaid.>

## Real content

<Realistic sample data and texts for the screens: list names, item names, messages, numbers. From the BRD and your knowledge of the domain, marked as examples.>

## Business rules visible on screens

<Limits, validation rules, permissions and messages from the BRD that a screen must show, with their F-xx/N-xx IDs.>
