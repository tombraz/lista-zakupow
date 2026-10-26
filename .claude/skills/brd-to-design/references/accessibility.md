# Accessibility checklist (WCAG 2.2)

Used by `/brd-to-design` (design), `/implement-task` (build and tests), `/qa-task` (verification) and `/tech-architecture` (test tools). The target level comes from `docs/design/design-decisions.md` (default **WCAG 2.2 AA**). Criterion numbers refer to [WCAG 2.2](https://www.w3.org/TR/WCAG22/); read the "Understanding" page of a criterion when in doubt, do not quote requirements from memory.

Automated tools find only part of the problems. Every UI task still gets the manual checks at the end.

## Design (screens, design system)

| Check | Criterion | Level |
| --- | --- | --- |
| Text contrast ≥ 4.5:1, large text (≥ 24 px, or ≥ 18.66 px bold) ≥ 3:1; AAA: 7:1 and 4.5:1 | 1.4.3 / 1.4.6 | AA / AAA |
| Contrast of UI components and meaningful graphics (borders of inputs, focus ring, icons, chart lines) ≥ 3:1 against neighbours | 1.4.11 | AA |
| Information is never carried by colour alone (errors, statuses, chart series, links in text) | 1.4.1 | A |
| Visible focus indicator in every interactive component state | 2.4.7 | AA |
| Focused element is not hidden by sticky headers, footers, cookie bars or bottom sheets | 2.4.11 | AA (new in 2.2) |
| Pointer targets ≥ 24 × 24 CSS px (or enough spacing); on mobile follow the platform: 44 × 44 pt iOS, 48 × 48 dp Android | 2.5.8 | AA (new in 2.2) |
| Every drag action (reorder, slider, swipe to delete) has a single-pointer alternative (buttons, menu) | 2.5.7 | AA (new in 2.2) |
| Layout works at 320 CSS px width and at 200 % text size without loss of content or two-way scrolling | 1.4.10 / 1.4.4 | AA |
| Every input has a visible label (not only a placeholder); errors say what is wrong and how to fix it | 3.3.2 / 3.3.1 / 3.3.3 | A / AA |
| Sign-in without a cognitive test: password managers and paste work, no "retype these characters" without an alternative | 3.3.8 | AA (new in 2.2) |
| Data the user already entered in the same flow is not asked for again (or is prefilled / selectable) | 3.3.7 | A (new in 2.2) |
| Help (contact, FAQ, chat) sits in the same place on every screen that has it | 3.2.6 | A (new in 2.2) |
| Headings and labels describe their content; one clear page title per screen | 2.4.6 / 2.4.2 | AA / A |
| Content shown on hover or focus can be dismissed and does not vanish when the pointer moves onto it | 1.4.13 | AA |
| Nothing flashes more than 3 times per second; respect "reduce motion" for non-essential animation | 2.3.1 / good practice | A |
| Works in both orientations unless one is essential | 1.3.4 | AA |
| Time limits can be extended or turned off | 2.2.1 | A |
| Video has captions, audio has a transcript (only if the product has media) | 1.2.x | A / AA |

Write the design decisions into the design system: the contrast pairs table (checked by `scripts/design-check.mjs`), focus style, minimum target size per platform, motion rules.

## Build (code)

| Check | Criterion |
| --- | --- |
| Native elements first (`button`, `a`, `label`, `input`); custom widgets get the right role, name and state (ARIA on web, accessibility traits / semantics on mobile) | 4.1.2 / 1.3.1 |
| Everything works with the keyboard alone, in a logical order, without traps; on mobile with a screen reader and with a switch/keyboard | 2.1.1 / 2.1.2 / 2.4.3 |
| The accessible name contains the visible label text | 2.5.3 |
| Inputs have programmatic labels and `autocomplete` for personal data (name, email, address, one-time code) | 1.3.1 / 1.3.5 |
| Status messages (saved, error, items loaded) are announced without moving focus (`role="status"` / live regions; announcements on mobile) | 4.1.3 |
| Language of the page (and of parts in another language) is set | 3.1.1 / 3.1.2 |
| Images: meaningful ones have a text alternative, decorative ones are hidden from assistive technology | 1.1.1 |
| Focus is managed on route changes, dialogs (trap inside, return on close) and after deleting an item | 2.4.3 |
| Text scales with system settings (Dynamic Type on iOS, font scale on Android); no fixed heights that clip text | 1.4.4 |
| Colours, sizes and focus styles come from design tokens only | — |

## Automated tests (part of TDD for every task that touches UI)

| Platform | Tool | What it catches |
| --- | --- | --- |
| Web | `@axe-core/playwright` (`AxeBuilder`) in end-to-end tests, one scan per screen state; `eslint-plugin-jsx-a11y` (React) or the equivalent for the framework | missing names and roles, contrast of rendered text, invalid ARIA, missing labels |
| Web, unit/component | Testing Library queries by role and label (`getByRole("button", { name: … })`) | a test that cannot find the element by role and name is an accessibility bug |
| iOS | XCUITest `performAccessibilityAudit()` (Xcode 15+) | contrast, hit region size, missing labels, Dynamic Type clipping |
| Android | Espresso `AccessibilityChecks.enable()` (Views); accessibility checks in Compose UI tests (check the API of your Compose version) | touch target size, missing labels, contrast |
| React Native | Testing Library queries by role and label; `eslint-plugin-react-native-a11y` | missing roles and labels; contrast and target size need manual checks |
| Flutter | `meetsGuideline(textContrastGuideline / androidTapTargetGuideline / iOSTapTargetGuideline / labeledTapTargetGuideline)` | contrast, target size, labels |

A violation found by these tools fails the test. Allow-listing a rule needs a reason in the test and a line in the task's Evidence.

## Manual checks (QA, every UI task)

1. Keyboard only: reach and operate everything, focus always visible and never hidden.
2. Screen reader on each touched platform (VoiceOver on iOS/macOS, TalkBack on Android, NVDA or VoiceOver on web): names, roles, states, announcements, reading order.
3. Zoom to 200 % and a 320 px wide viewport (web); largest system text size (mobile).
4. Reduce motion on; dark mode if supported.
5. Every new criterion from WCAG 2.2 in the Design table that the screen touches (targets, dragging, focus not obscured, authentication, redundant entry).

## Law (EU)

The European Accessibility Act applies since 28 June 2025 to many consumer products and services, among them e-commerce, consumer banking, e-books, electronic communications and passenger transport services; microenterprises providing services are exempt. Public-sector websites and apps fall under separate national law. The harmonised standard is EN 301 549, which builds on WCAG. Whether a product falls under these rules is a legal question: `/concept-to-brd` asks it and records the answer; it does not decide it.
