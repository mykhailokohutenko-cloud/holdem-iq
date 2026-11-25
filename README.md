# HoldemIQ — Official User & Technical Manual

**Local Poker Engine & UI (Texas Hold’em 2–15 Seats)**

---

## Chapter 1: Introduction & Product Philosophy

### 1.1. What is HoldemIQ?

**HoldemIQ** is an offline-first, real-time tactical co-pilot and analytical engine engineered specifically for live **Texas Hold’em** games. Designed to run locally on **Android** (via Capacitor), **Windows** (via Electron), and modern **Web** browsers without external servers, HoldemIQ transforms partial, fast-paced table observations into rigorous probabilistic outputs and actionable decisions in milliseconds.

Unlike conventional poker trackers built around online hand-history imports, bankroll graphs, or static GTO lookup charts, HoldemIQ is built for **live social and home-game environments** where:

- Table sizes range dynamically from heads-up (**2 seats**) to mega-tables (**15 seats**).
- Players join or leave mid-session, re-buy, or jump into a hand already in progress.
- Exact chip stacks and pot sizes are frequently uncounted, irregular, or irrelevant to casual play.
- Decisions must be made under strict time pressure (typically **1 to 2 seconds** per glance) without eye fatigue.

HoldemIQ acts as a hybrid **Operational & Analytical Dashboard**:

1. **Operational Layer:** Immediately surfaces a clear, unambiguous action verdict (**FOLD**, **CHECK**, **CALL**, **RAISE**, or **RAISE / ALL-IN**), Win/Tie/Lose probabilities, and a spatial interactive table map.
2. **Analytical Layer:** Provides a reactive **13×13** starting-hand matrix, dual strength-vs.-threat indicators (**S_me** and **T_opp**), combination breakdowns (`Mine / Table` via slash), exponentially decayed opponent dossiers (**Φ_i**), and a two-mode Summary & Showdown tracker.

### 1.2. Core Design Principles & Strict Domain Constraints

HoldemIQ is governed by five non-negotiable architectural and mathematical constraints that define both its user experience and its underlying engine:

#### 1. Zero-Currency / Bet-Size Agnostic Architecture

- **Rule:** HoldemIQ contains **no monetary bet amounts, chip denominations, stack depths, or pot sizes** anywhere in its UI or mathematical formulas.
- **Architectural Justification:** In live casual games, tracking exact chip counts for up to 15 players introduces high interaction overhead and input errors that stall the game. Instead of relying on Pot Odds, HoldemIQ models betting pressure structurally through **active player counts** (`N_active`), **positional turn order** (`PosScore`), **non-linear raise escalation streaks** (`Ψ_escal(m)`), **all-in state flags** (`isAllIn`), and **historical opponent tendencies** (`Φ_i`).

#### 2. Strict Non-Bluffing Policy

- **Rule:** HoldemIQ **never** recommends a "bluff" or "bluff-spot." Output actions are strictly constrained to the deterministic set:

$$
\mathcal{A}_{\text{verdict}} = \{\text{FOLD},\ \text{CHECK},\ \text{CALL},\ \text{RAISE}\}
$$

augmented only by the **ALL-IN** commitment indicator (`RAISE / ALL-IN` with a golden/yellow slash highlight) when Hero's effective equity exceeds the ultra-high commitment threshold, and visual escalation multipliers (**x2**, **x4**, **x8**, **x16**) reflecting street aggression streaks.

- **Mathematical Justification:** Pure bluffing relies heavily on unobservable physical tells, table image, and exact fold-equity estimates tied to bet sizing. Because HoldemIQ is bet-size agnostic, recommending speculative bluffs would introduce mathematically ungrounded variance. Every `RAISE` or `RAISE / ALL-IN` verdict in HoldemIQ is backed by genuine equity, draw equity, positional leverage, and opponent range modeling.

#### 3. Offline-First & Cross-Platform Local Execution

- **Rule:** All Monte Carlo simulations, exact enumerations, matrix evaluations, and session memory updates execute **100% locally on the client device**.
- **Privacy & Latency:** Zero network requests are required for gameplay. Session state persists locally via `localStorage` (`holdemiq_session_v1`), locale under `holdemiq_locale_v1`, and theme/trim settings locally, ensuring instant startup, deterministic sub-frame recalculation, and zero telemetry leakage.

#### 4. Incomplete Data Resilience & Mid-Hand Entry

- **Rule:** The engine **never blocks calculation** due to missing fields.
- **Graceful Degradation & Progressive Refinement:**
  - If only Hero's 2 hole cards (`H`) are entered, the engine immediately computes baseline equity against `N_opp = N_active - 1` neutral opponents.
  - Even if Hero's hole cards are incomplete (`|H| < 2`), the engine falls back to a safe baseline mode (`INCOMPLETE_HAND`) while keeping the **13×13** matrix and table state live.
  - When the user enters a hand already underway (**Mid-Hand Entry** on the Flop, Turn, or River) or logs opponent actions (`FOLD`, `CHECK_CALL`, `RAISE`, `ALL_IN`), the engine immediately narrows assumed opponent ranges (`G_opp`), adjusts table pressure (`Π_table`), and updates every metric instantaneously.

#### 5. Strict Deck Isolation Across Showdowns

- **Rule:** Cards revealed by opponents at showdown are recorded strictly for **historical logs and opponent style memory** (`Φ_i`)—they are **never** carried over into the `knownDeadCards` set of the subsequent hand.
- **Justification:** Between hands in live Texas Hold'em, the 52-card deck is shuffled. Polluting the next hand's deck with historical showdown cards would corrupt combinatorial probabilities. Within a single hand, however, duplicate card selection is strictly prevented across Hero's hand, the community board, and revealed showdown slots.

---

## Chapter 2: Getting Started & Interface Overview

### 2.1. Screen Layout & Workspace Architecture

HoldemIQ adapts its spatial layout to the host display while preserving a strict **Maximum Nesting Depth = 1** and **Single Active Surface** policy (at most one popover or bottom sheet may be open at any time, ensuring zero overlapping modals).

```text
+-----------------------------------------------------------------------------------+
| HEADER (52px): HoldemIQ | Table: [2..15] | In play: K/N | Stage | Reset | New Hand |
+----------------------------------------------------+------------------------------+
| LEFT COLUMN (Desktop wider zone)                   | RIGHT COLUMN (Desktop zone)  |
|                                                    |                              |
| +------------------------------------------------+ | +--------------------------+ |
| | TOP VERDICT & CARDS                            | | | REACTIVE 13x13 MATRIX    | |
| | [ FOLD | CHECK | CALL | RAISE xN / ALL-IN ]    | | | (169 cells live-colored) | |
| | Win % | Tie % | Lose %  +  [Me: 2] || [3|1|1]  | | +--------------------------+ |
| +------------------------------------------------+ | | TWO NUMBERS: S_me | T_opp| |
|                                                    | | Combos: Mine % / Table % | |
| +------------------------------------------------+ | +--------------------------+ |
| | INTERACTIVE POKER TABLE (2–15 Seats)           | | | TABS: [Dossier] [Summary]| |
| | Elliptical layout, BTN chip, SB/BB badges,     | | | - Player Phi_i profiles  | |
| | Seat status (In play / FOLD / ALL-IN / Out)    | | | - Live breakdown / Showd.| |
| +------------------------------------------------+ | +--------------------------+ |
|                                                    | | Chips / Cards & Ad (0px) | |
+----------------------------------------------------+------------------------------+
```

#### Desktop Dual-Column Dashboard

On desktop monitors, HoldemIQ avoids vertical page scrolling by splitting the viewport into two synchronized columns:

1. **Top System Bar (52px):** Displays the HoldemIQ brand mark, table seat selector (`N_table ∈ [2, 15]`), live active counter (`In play: K/N`), street escalation indicator (`x2` / `x4` / `x8`), theme selector and pulse trim toggle (`Trim: on / off`), language selector (`EN`, `UK`, `RU`, `DE`, `ES`), **Full Reset**, and the primary **New Hand (BTN →)** button.
2. **Left Column — Operational Command Zone:**
   - **Top Verdict & Cards:** Houses the high-contrast action badge, one-line localized decision driver explanation, tabular Win / Tie / Lose percentages, position readout (`BTN`, `SB`, `BB`), and street-grouped card slots (`2 || 3 | 1 | 1` with `6px` intra-group gaps, `12px` inter-street gaps, and a `16px` divider separating Hero's hand from the board).
   - **Interactive Poker Table:** Occupies the remaining vertical space (`flex-1`), rendering an elliptical table with dynamically scaled seat capsules for **2 to 15** players, a dealer button (`BTN`), `SB` / `BB` badges, and Hero's highlighted seat (`Me`).
3. **Right Column — Analytical Zone:**
   - **Upper Fixed Panel:** Always-visible **Reactive 13×13 Matrix**, the **Two Numbers** bar (`S_me` vs. `T_opp`), and a compact **Combinations** breakdown (`Mine % / Table %` via slash).
   - **Lower Tabbed Panel:** In-page tabs for **Dossier** (opponent `Φ_i` profiles and re-buy controls) and **Summary** (in-game tactical breakdown & post-hand showdown logger), paired with the **Chips / Cards** module and an offline-safe ad container that collapses to `0px` when offline.

#### Mobile Single-Column Ergonomics

On smartphones, HoldemIQ prioritizes one-handed thumb reach and above-the-fold visibility:

- **Above the Fold (No Scroll Required):** Compact header (`46px`), Verdict + Card slots (`2 || 3 | 1 | 1`), elliptical interactive table (**2 to 15** seats with expanded `48×48 dp` touch hit-boxes), and a thumb-accessible **New Hand (BTN →)** bar.
- **Below the Fold:** Tabbed analytical drawer switching cleanly between **Matrix 13×13**, **Dossier**, and **Summary**.
- **Partial Bottom Sheets:** Tapping a card slot or player seat opens a non-blocking bottom sheet (~25% screen height) so the user continues to see the live Verdict, probabilities, and board cards update in real time as they tap.

### 2.2. Design System, Themes & Multi-Language Localization

#### The "Obsidian Pulse" / "Obsidian & Emerald" Design System

Inspired by high-frequency financial terminals and modern dark UIs, HoldemIQ uses layered low-luminance surfaces, `1px` translucent borders, `tabular-nums` typography for jitter-free percentage updates, theme-reactive scrollbars (`--op-*` tokens), and a four-color deck (**♠** slate/white, **♥** coral-red, **♦** sky-blue, **♣** emerald-green) for instant peripheral suit recognition.

Users can switch between **6 curated visual themes** (`data-pulse-theme`) and toggle the subtle animated **Pulse Trim** (`Trim: on / off`):

| Theme ID | Display Name | Visual Character & Palette Base | Recommended Environment |
| :--- | :--- | :--- | :--- |
| `graphite-emerald` | **Graphite** | Deep neutral charcoal (`#0B0E13`) with muted emerald (`#10B981`) and coral accents. | Default all-purpose mode; zero eye strain over 4+ hour sessions. |
| `obsidian-prism` | **Obsidian** | Ultra-dark OLED-friendly slate-black (`#07080A`) with crisp `1px` borders. | Low-light rooms, home games, and OLED Android devices. |
| `burgundy-brown` | **Burgundy** | Dark wine-infused charcoal/brown base with warm burgundy/rose surface undertones. | Warm indoor lighting; classic cardroom atmosphere. |
| `espresso-oak` | **Espresso** | Rich dark roasted-coffee neutral tones with soft amber highlights. | Evening play with reduced blue-light emission. |
| `pastel-sand` | **Sand** | Warm light-parchment / sandstone surface palette with high-contrast dark ink. | Daylight outdoor play or brightly lit rooms. |
| `pastel-sage` | **Sage** | Muted botanical mineral-green light/mid surface palette. | High-ambient-light environments favoring soft green contrast. |

#### Multi-Language Localization (5 Languages)

HoldemIQ automatically detects the device locale on first launch (`detectInitialLocale()`) and allows instant switching in the header across **5 languages** (`EN`, `UK`, `RU`, `DE`, `ES`), persisted under `holdemiq_locale_v1`, with circular SVG country flags (avoiding duplicate letter codes) and localized verdict text, situation breakdowns, and default player names:

- **English (`en`)** — `FOLD`, `CHECK`, `CALL`, `RAISE`
- **Ukrainian (`uk`)** — `ПАС`, `ЧЕК`, `КОЛЛ`, `РЕЙЗ`
- **Russian (`ru`)** — `ПАС`, `ЧЕК`, `КОЛЛ`, `РЕЙЗ`
- **German (`de`)** — `FOLD`, `CHECK`, `CALL`, `RAISE`
- **Spanish (`es`)** — `FOLD`, `CHECK`, `CALL`, `RAISE`

### 2.3. Setting Up the Table

#### 1. Configuring Table Size (`N_table ∈ [2, 15]`)

Use the **Table** selector in the top bar to set the total number of physical seats at the table, from **2** (Heads-Up) up to **15** (Mega-Table).

- Changing `N_table` dynamically recalculates the elliptical seat coordinates around the table and scales seat capsule dimensions so cards never overlap, even at 15 players.
- **Table Invariant:** `N_table` represents total seats at the table and **remains constant** when players fold during a hand; only `N_active` decreases upon `FOLD`.

#### 2. Assigning "Me" and Dealer Button (`BTN`)

Tap any seat on the interactive table to open its contextual seat menu and configure roles:

- **I sit here:** Assigns `mySeat` to that physical seat, highlighting it with Hero's dedicated border ring and badge (`Me`).
- **Set BTN:** Places the Dealer Button (`BTN`) on that seat.

#### 3. Automatic SB / BB Calculation & Heads-Up Separation

Whenever `btnSeat` is set or shifted—or when players are eliminated/resumed—HoldemIQ automatically computes the Small Blind (`sbSeat`) and Big Blind (`bbSeat`) clockwise across **non-eliminated** seats:

- **Standard Table** (`N_non-elim >= 3`):

$$
\text{sbSeat} = \text{nextNonEliminated}(\text{btnSeat}, +1), \qquad \text{bbSeat} = \text{nextNonEliminated}(\text{btnSeat}, +2)
$$

- **Heads-Up / Two Active Seats** (`N_non-elim = 2`):
  In accordance with official Texas Hold'em rules, the Dealer Button posts the Small Blind, and the other seat posts the Big Blind, preventing `BTN` and `BB` from colliding on the same seat:

$$
\text{sbSeat} = \text{btnSeat}, \qquad \text{bbSeat} = \text{nextNonEliminated}(\text{btnSeat}, +1)
$$

---

## Chapter 3: User Guide — Step-by-Step Gameplay Workflow

### 3.1. Card Selection & Streets

HoldemIQ tracks Texas Hold'em hands across four progressive betting streets (`Pre`, `Flop`, `Turn`, `River`) plus the terminal `Showdown` phase, using **2 Hole Cards** for Hero (`Me`) and **0, 3, 4, or 5 Community Cards** on the board.

#### 1. The Vertical Scroll-Drum Card Picker

Tapping any empty or occupied card slot in the top bar (`Me: 2` or `Board: 3 | 1 | 1`) opens the **Vertical Scroll-Drum Picker**:

- **Rank Drum:** Smoothly scroll or tap ranks from **A** down to **2** (`A, K, Q, J, T, 9, 8, 7, 6, 5, 4, 3, 2`).
- **Four-Color Suit Selector:** Tap one of the four high-contrast suits (**♠** Slate/White, **♥** Coral-Red, **♦** Sky-Blue, **♣** Emerald-Green).
- **Auto-Advance Chain:**
  - Selecting Hero's first hole card (`Slot 0`) automatically advances focus to Hero's second hole card (`Slot 1`).
  - Selecting the first Flop card (`Board 0`) automatically advances focus to `Board 1`, and then to `Board 2`, eliminating extra taps during live dealing.
- **Collision & Duplicate Prevention:** Cards already assigned to Hero's hand or any board slot are automatically disabled/locked in the picker so an impossible duplicate card can never enter the deck state.

#### 2. Mid-Hand Entry

Live sessions frequently require entering a hand after action has already started on the Flop, Turn, or River. HoldemIQ supports frictionless **Mid-Hand Entry** without requiring you to reconstruct earlier preflop action histories:

1. Tap the **Mid-Hand Entry** control (or directly populate **3, 4, or 5 board cards**).
2. HoldemIQ automatically infers the active street from the board card count:
   - **0 cards** → `Pre`
   - **3 cards** → `Flop` (2 cards remaining to come)
   - **4 cards** → `Turn` (1 card remaining to come)
   - **5 cards** → `River` (0 cards remaining; draw probability `P_draw+ = 0`)
3. Tap **FOLD** on any seats that have already mucked their cards. `N_active` decreases accordingly while `N_table` stays intact.
4. The engine immediately computes equity, positional leverage, and the **13×13** matrix using the current board, current `N_active`, seat roles (`BTN` / `SB` / `BB` / `Me`), and accumulated session profiles (`Φ_i`) of the remaining active opponents.

### 3.2. Tracking Table Actions & Player Lifecycles

Tapping any player capsule on the elliptical poker table opens their single-surface contextual action menu.

#### 1. Recording Actions (Zero-Currency Model)

During an active street, you record opponent and Hero actions using strictly four non-monetary event types:

- **FOLD:** Marks the player as `folded` for the current hand, decrements `N_active` by `1` (down to a minimum floor of `N_active >= 2`), and logs whether they folded facing a raise (`foldedFacingRaise`).
- **CHECK / CALL:** Logs passive continuation (`CHECK_CALL`) on the current street without escalating street aggression.
- **RAISE:** Logs an aggressive raise on the current street, increments the street raise counter (`m ← m + 1`), updates the escalation multiplier (`x2`, `x4`, `x8`, `x16`), and sets `facingRaise = 1` for subsequent actors.
- **ALL-IN:** Places the player into the locked all-in commitment state (`status = 'active'`, `isAllIn = true`).
  - **Visual & Turn Behavior:** An all-in player's capsule turns muted slate-gray with a **golden/yellow border** and a bold **`ALL-IN`** badge. They remain counted inside `N_active` through showdown, but are **automatically skipped** in future betting turns on the current and subsequent streets (they cannot raise, call, or fold again).

#### 2. Player Lifecycle States: Active, Folded, Eliminated & Re-buy

HoldemIQ distinguishes between folding a single hand and leaving the table:

- **Active (`active`):** Currently competing in the ongoing hand.
- **Folded (`folded`):** Out of the current hand; automatically returns to `active` when **New Hand (`BTN →`)** is pressed.
- **Eliminated (`eliminated`):** Out of chips or sitting out across hands.
  - Eliminated players are excluded from `N_active` and skipped automatically when shifting `BTN`, `SB`, and `BB`.
  - **Minimum Table Guard:** HoldemIQ enforces a strict invariant of at least **2 non-eliminated players** at the table (`canEliminate` disables when non-eliminated count is `2`).
- **Re-buy / Resume:** When an eliminated player buys back in or returns to their seat, tapping **Resume** restores them to `active` status.
  - **Memory Preservation Rule:** By default, resuming a seat **preserves their historical EWMA style profile** (`Φ_i`) accumulated earlier in the session. If a brand-new person takes over the physical seat, use **Reset Profile** to zero out the player's memory struct.

### 3.3. Reading the Engine Output

Every tap triggers an instant, synchronous recalculation of the top operational readout:

#### 1. Primary Action Verdict & Escalation Indicators

The central verdict banner displays one of four deterministic recommendations—never a bluff:

- **FOLD** — Coral-red accent; effective equity `E_eff` falls below the call threshold `θ_call^ai`.
- **CHECK** — Neutral slate accent; displayed when facing no raise (`facingRaise = 0`) and `E_eff < θ_raise^ai`.
- **CALL** — Sky-blue / amber accent; displayed when facing a raise/all-in (`facingRaise = 1`) and `θ_call^ai <= E_eff < θ_raise^ai`.
- **RAISE** — Theme-linked primary accent (`--op-accent-primary`); displayed when `E_eff >= θ_raise^ai`.
- **RAISE / ALL-IN (Golden Slash Extension):** When Hero's effective equity exceeds the ultra-high commitment threshold (`E_eff >= θ_all-in`) or an opponent all-in forces a binary commit decision at high equity, HoldemIQ appends **`/ ALL-IN`** in luminous **gold** next to `RAISE`.
- **Street Escalation Multipliers (`x2`, `x4`, `x8`, `x16`):** Whenever **1 or more** raises occur on the current street (`m >= 1`), a badge displays the structural aggression tier (`x2` on 1st raise, `x4` on 2nd raise, `x8` on 3rd raise, `x16` on 4th+ raise) as a pure intensity indicator—with zero monetary amounts.

#### 2. Probabilities & Combination Breakdown

- **Win % / Tie % / Lose %:** Displayed in `tabular-nums` directly beside the verdict, reflecting opponent-range-adjusted showdown equity (`P_win_adj`, `P_tie`, `P_lose_adj`).
- **Combinations (`Mine / Table`):** Lists poker hand classes (`Pair`, `Two pair`, `Three of a kind`, `Straight`, `Flush`, `Full house`, `Four of a kind`, `Straight flush`), comparing Hero's probability against the table/opponent probability in a single cell separated by a slash (`Mine % / Table %`).

### 3.4. Analytical Tabs & End-of-Hand Routine

#### 1. Reactive 13×13 Matrix & "Two Numbers"

- **169-Cell Grid:** Diagonal cells represent pocket pairs (`AA`–`22`), upper-right cells represent suited hands (`AKs`–`32s`), and lower-left cells represent offsuit hands (`AKo`–`32o`).
- **Live Zone Coloring & Wave Mode:** Before calculations begin (no hole/board cards and no logged moves), the matrix displays a calm wave across cells, transitioning to a brief final wave when calculations start and then updating reactively on every card, fold, raise, all-in, or position change:
  - **Raise Zone:** Hands exceeding `θ_raise^ai` in the current spot.
  - **Call/Check Zone:** Hands viable for calling or checking (`>= θ_call^ai`).
  - **Fold/Block Zone:** Hands below `θ_call^ai` or blocked because required cards are already in Hero's hand, on the board, or in current-hand dead cards.
- **The "Two Numbers" Readout:** Directly beneath the matrix:
  1. **Primary Number (Larger, Left — `S_me`):** Hero's composite made-hand strength and draw potential percentage on the current street.
  2. **Secondary Number (Compact, Right — `T_opp`):** Estimated probability that **at least one** active opponent currently holds a strong made hand or dangerous draw given the board, `N_active`, raises/all-ins, and opponent style indices `Φ_j`.

#### 2. Player Dossiers

Displays a list of all opponents at the table showing their seat, current hand status (`In play`, `FOLD`, `ALL-IN`, `Eliminated`), decayed effective sample size (`n_hands_decayed`), style index `Φ_i ∈ [-1, +1]`, behavioral tag (`TIGHT_AGG`, `TIGHT_PASSIVE`, `LOOSE_PASSIVE`, `LOOSE_AGG`, `NEUTRAL`), and one-tap **Resume** or **Reset Profile** actions.

#### 3. Summary Tab in Two Modes

The **Summary** tab automatically adapts to the phase of the hand:

- **Mode A — In-Game Live Tactical Breakdown:** During active play (`Pre`, `Flop`, `Turn`, `River`), displays a structured three-layer offline explanation of *why* the current verdict was chosen (combining Hero's hand/draws, opponent threat `T_opp` and `Φ_i` profiles, and street aggression/active player count), alongside a live round checklist (who is in `ALL-IN`, who raised on the street, who folded `FOLD`, and who acts after Hero).
- **Mode B — Post-Hand / Showdown Logger:** At the end of a round or showdown, allows you to mark the **Winner(s)**, toggle **Showdown / No showdown**, optionally record **Revealed Opponent Cards** (which immediately update their `Φ_i` quality score without entering the next hand's deck), review updated player profiles, and commit the result or start the next hand.

#### 4. Next Hand (`BTN →`) & Full Reset

- **New Hand (`BTN →`):** Clears `myCards`, `boardCards`, `knownDeadCards`, and `events` (guaranteeing **zero contamination** from previous showdown cards), resets `folded` players to `active`, preserves `eliminated` seats and all `Φ_i` session profiles, increments `handId`, and advances `BTN` clockwise to the next non-eliminated seat (updating `SB` and `BB`).
- **Full Reset:** Wipes the entire session (`localStorage` key `holdemiq_session_v1`), resets all `Φ_i` memories, sets `handId = 1` with `BTN` at Seat 0, and **automatically focuses the first preflop action slot at `BB + 1`** (skipping any eliminated seat) so you can immediately log preflop action from Under-the-Gun (UTG).

---

## Chapter 4: Mathematical Foundations — Deck, Equity & Combinatorics

### 4.1. Remaining Deck & Strict Card Isolation

Let `D` denote the standard 52-card Texas Hold'em deck (`|D| = 52`), defined as the Cartesian product of 13 ranks and 4 suits:

$$
D = \{2, 3, 4, 5, 6, 7, 8, 9, \text{T}, \text{J}, \text{Q}, \text{K}, \text{A}\} \times \{\spadesuit, \heartsuit, \diamondsuit, \clubsuit\}
$$

At any decision point within hand `h`, let:

- `H ⊆ D` be Hero's known hole cards (`|H| ∈ {0, 1, 2}`).
- `B ⊆ D` be the exposed community board cards (`|B| ∈ {0, 3, 4, 5}`).
- `K_known^(h) ⊆ D` be any known dead/exposed cards *strictly within hand* `h`.

The **Remaining Unseen Deck** `D_rem^(h)` available for unknown board runouts and active opponent hole cards is:

$$
D_{\text{rem}}^{(h)} = D \setminus \left( H \cup B \cup K_{\text{known}}^{(h)} \right)
$$

with cardinality:

$$
|D_{\text{rem}}^{(h)}| = 52 - |H \cup B \cup K_{\text{known}}^{(h)}|
$$

#### Theorem 1 (Inter-Hand Deck Isolation Invariant)

Let `R^(h-1)` denote the set of opponent hole cards revealed at showdown in hand `h - 1`. Upon transitioning to hand `h`:

$$
K_{\text{known}}^{(h)} = \emptyset, \qquad \mathcal{R}^{(h-1)} \cap K_{\text{known}}^{(h)} = \emptyset
$$

*Proof & Justification:* Between consecutive hands in live Texas Hold'em, all 52 cards are gathered and shuffled. Allowing `R^(h-1)` to persist in `K_known^(h)` would remove valid cards from `D_rem^(h)`, biasing combinatorial frequencies and artificially blocking cells in the **13×13** matrix. Therefore, `R^(h-1)` is routed exclusively to the EWMA showdown quality accumulator and archival `showdownHistory`, never to `D_rem^(h)`.

#### Deck Capacity Guard for Large Tables (`N_table <= 15`)

To guarantee mathematical feasibility under arbitrary dead-card inputs at tables up to **15 seats**, the engine caps effective simulated opponents by:

$$
N_{\text{opp, max}} = \left\lfloor \frac{|D_{\text{rem}}^{(h)}| - (5 - |B|)}{2} \right\rfloor, \qquad N_{\text{active, eff}} = \min\Big(N_{\text{active}},\ N_{\text{opp, max}} + 1\Big)
$$

### 4.2. Hand Evaluation & Outcome Simulation

#### 1. 7-Card Combinatorial Evaluator

For any 7-card completion `C_7 = H_j ∪ B_final` (`|C_7| = 7`), the evaluator finds the maximum 5-card poker hand across all `C(7, 5) = 21` subsets, returning a deterministic total-order rank score and one of 9 equivalence classes from `HIGH_CARD` up to `STRAIGHT_FLUSH`.

#### 2. Deterministic Seeded Monte Carlo Simulation

Let `N_opp = N_active_eff - 1` be the number of active opponents in the hand and `m_board = 5 - |B|` be the number of community cards still to be dealt.

- The exact sample space size is:

$$
\Omega = \binom{|D_{\text{rem}}|}{m_{\text{board}}} \times \prod_{j=1}^{N_{\text{opp}}} \binom{|D_{\text{rem}}| - m_{\text{board}} - 2(j-1)}{2}
$$

For preflop or multi-way pots (`N_opp >= 2`), `|Ω|` exceeds `10^12`, making full enumeration impossible within sub-frame latency budgets.

- HoldemIQ executes `M = 900` partial Fisher-Yates shuffles over `D_rem^(h)` using a deterministic **Mulberry32 PRNG** seeded by the exact state tuple:

$$
\text{seed} = 1009 \cdot h + 97 \cdot N_{\text{table}} + 31 \cdot N_{\text{active, eff}} + 13 \cdot |B| + 7 \cdot |\mathcal{E}_h|
$$

*Why Deterministic Seeding?* A deterministic seed eliminates UI flicker ("number jitter") when re-rendering identical states while ensuring every distinct card or action state produces an unbiased, reproducible sample.

In simulation trial `t ∈ {1, ..., M}`:

1. Sample `m_board` cards to form `B^(t) = B ∪ B_runout^(t)`.
2. Deal `2` disjoint cards to each opponent `j ∈ {1, ..., N_opp}` to form `H_j^(t)`.
3. Evaluate Hero score `V_0^(t)` and maximum opponent score `V_opp*^(t) = max_{1 <= j <= N_opp} V_j^(t)`.
4. Classify outcome indicators:

$$
I_{\text{win}}^{(t)} = \mathbb{I}\!\left(V_0^{(t)} > V_{\text{opp}}^{*(t)}\right), \qquad I_{\text{tie}}^{(t)} = \mathbb{I}\!\left(V_0^{(t)} = V_{\text{opp}}^{*(t)}\right), \qquad I_{\text{lose}}^{(t)} = \mathbb{I}\!\left(V_0^{(t)} < V_{\text{opp}}^{*(t)}\right)
$$

Raw outcome probabilities and draw potential are computed as:

$$
P_{\text{win, raw}} = \frac{1}{M} \sum_{t=1}^{M} I_{\text{win}}^{(t)}, \qquad P_{\text{tie}} = \frac{1}{M} \sum_{t=1}^{M} I_{\text{tie}}^{(t)}, \qquad P_{\text{lose, raw}} = 1 - P_{\text{win, raw}} - P_{\text{tie}}
$$

On pre-river streets (`|B| ∈ {3, 4}`), **Draw Potential** `P_draw+` measures the conditional probability of improving from a weak current made hand (`K_now <= PAIR`) to at least `TWO_PAIR` or better by the River:

$$
P_{\text{draw+}} = \frac{1}{M} \sum_{t=1}^{M} \mathbb{I}\!\Big(\mathcal{K}(H \cup B) \le \text{PAIR} \ \wedge\ \mathcal{K}(H \cup B^{(t)}) \ge \text{TWO\_PAIR}\Big)
$$

#### 3. Incomplete Hand Fallback (`|H| < 2`)

If Hero has entered **0 or 1** hole cards, the engine does not crash or stall. It assigns uniform random completions for the missing hole card(s) from `D_rem^(h)`, sets `P_win_raw ≈ 1 / N_active`, and keeps the **13×13** matrix fully active as an exploratory range guide.

### 4.3. Scaling Equity Across 2–15 Players

In a symmetric `N_active`-player showdown with uniform random hands, every player's baseline win probability is inversely proportional to the number of active contenders:

$$
E_{\text{fair}}(N_{\text{active}}) = \frac{1}{N_{\text{active}}}
$$

| Active Players (`N_active`) | Opponents (`N_opp`) | Fair-Share Baseline (`1 / N_active`) | Practical Implications |
| :--- | :--- | :--- | :--- |
| **2** (Heads-Up) | 1 | `50.0%` | Top pair and high-card hands carry high showdown value. |
| **6** (6-Max) | 5 | `16.7%` | Standard medium-table equilibrium. |
| **9** (Full Ring) | 8 | `11.1%` | Suited connectors and pocket pairs gain implied multi-way value; weak offsuit broadways lose value. |
| **15** (Mega-Table) | 14 | `6.7%` | Severe equity dilution; marginal top-pair hands face high probability of being outdrawn or dominated. |

**Mathematical Proof of Dynamic Baseline Necessity:**
If a decision engine used a static call threshold (for example, `0.40` derived from heads-up play), then at a 12-player table where `E_fair = 8.3%`, even premium hands like `AKo` preflop would fall below `0.40` and erroneously recommend `FOLD`. Anchoring thresholds to `E_fair(N_active) = 1 / N_active` preserves scale invariance across all `N_active ∈ [2, 15]`.

---

## Chapter 5: Contextual Adjustments — Position, Pressure & Aggression

### 5.1. Positional Advantage (`PosScore`)

Position dictates information asymmetry: acting later allows Hero to observe opponents' actions before committing to the hand.

#### 1. Turn-Order Mapping

Let `S_active` be the clockwise ordered list of non-eliminated seats starting from:

- **Preflop (`Pre`):** First actor is `UTG = nextNonEliminated(bbSeat, +1)`; last actor is `BB`.
- **Postflop (`Flop`, `Turn`, `River`):** First actor is `SB` (or first non-eliminated seat clockwise from `btnSeat`); last actor is `BTN`.

If Hero's seat (`mySeat`) is assigned at index `k ∈ {0, ..., |S_active| - 1}` in the street's acting order, the normalized positional score is:

$$
\text{PosScore} = \begin{cases} \dfrac{k}{\max(1, |S_{\text{active}}| - 1)} \in [0, 1], & \text{if } \text{mySeat} \neq \text{null} \\[10pt] 0.50, & \text{if } \text{mySeat} = \text{null} \end{cases}
$$

- `PosScore = 0.0` corresponds to earliest position (`UTG` preflop / first-to-act postflop).
- `PosScore = 1.0` corresponds to absolute last position (`BB` preflop / `BTN` postflop).
- Each opponent action event is tagged with relative turn order (`BEFORE_ME`, `AFTER_ME`, `UNKNOWN`) by comparing the actor's clockwise acting index against Hero's acting index.

### 5.2. Table Pressure Index (`Π_table`) & Recurring Raise Escalation (`Ψ_escal`)

Because HoldemIQ operates **without monetary bet amounts or pot sizes**, betting intensity must be reconstructed from structural action sequences.

#### 1. Non-Linear Recurring Raise Escalation (`Ψ_escal(m)`)

Suppose on the current street `u`, opponents have made `m >= 1` aggressive actions (`RAISE` or `ALL_IN`). In real Texas Hold'em, a 3-bet (`m = 2`) or 4-bet (`m = 3`) represents a geometric narrowing of opponent hand ranges far steeper than a linear count (`1, 2, 3`). HoldemIQ models this via a geometric escalation multiplier:

$$
\Psi_{\text{escal}}(m) = \begin{cases} 0, & m = 0 \\[6pt] 1 + \kappa_{\text{re}} \Big( (1 + \delta_{\text{re}})^{m - 1} - 1 \Big), & m \ge 1 \end{cases}
$$

with calibrated parameters `κ_re = 0.65` and `δ_re = 0.85`:

- **1st Raise (`m = 1`, Open-Raise):** `Ψ_escal(1) = 1.00` — UI badge displays **`x2`**
- **2nd Raise (`m = 2`, 3-Bet):** `Ψ_escal(2) = 1 + 0.65 × (1.85^1 - 1) = 1.5525` — UI badge displays **`x4`**
- **3rd Raise (`m = 3`, 4-Bet):** `Ψ_escal(3) = 1 + 0.65 × (1.85^2 - 1) = 2.5746` — UI badge displays **`x8`**
- **General m-th Raise:** UI badge displays **`x`** followed by `2^min(m, 4)` (`x2`, `x4`, `x8`, `x16`) as an intuitive structural pressure indicator without referencing currency or chip counts.

#### 2. Opponent Range Tightening Factor (`G_opp`) & Pressure Index (`Π_table`)

Let `E_u^opp` denote opponent events on the current street `u` (strictly excluding Hero's own raises so Hero never penalizes themselves for their own aggression). Each aggressive event `e_r` (`r = 1, ..., m`) carries a style-modulated weight:

$$
w_{\text{re}}(e_r) = \Psi_{\text{escal}}(r) \cdot \exp\!\left(\eta_{\text{raise}} \cdot \Phi_{i_r}\right)
$$

where `η_raise = 0.45` and `Φ_{i_r} ∈ [-1, +1]` is the session style index of opponent `i_r`. Aggregate **Table Pressure** `Π_table ∈ [0, 1]` and **Assumed Opponent Range Factor** `G_opp` are computed as:

$$
\Pi_{\text{table}} = \text{clip}\!\left( 0.22 \sum_{r=1}^{m} w_{\text{re}}(e_r) + 0.05 \, n_{\text{cc, opp}} + 0.03 \, (N_{\text{active}} - 2) + 0.28 \, n_{\text{ai, opp}},\ 0,\ 1 \right)
$$

$$
G_{\text{opp}} = \text{clip}\!\left( 1 + 0.35 \ln\!\left(1 + \sum_{r=1}^{m} w_{\text{re}}(e_r)\right) + \bar{g}_{\text{prior}}(u) + 0.40 \, n_{\text{ai, opp}},\ 0.70,\ 3.20 \right)
$$

where `g_bar_prior(u) = ρ(u) * (1 / N_opp) * ∑ max(0, Φ_j)` with street weights `ρ(Pre) = 0.05`, `ρ(Flop) = 0.10`, `ρ(Turn) = 0.15`, `ρ(River) = 0.20`.

#### 3. Range-Adjusted Win Probability (`P_win_adj`)

Because `P_win_raw` assumes opponents hold uniform random hands, strong opponent ranges (`G_opp > 1`) compress Hero's realized win probability via a monotonic power-law contraction:

$$
\widetilde{P}_{\text{win}} = \left( P_{\text{win, raw}} \right)^{G_{\text{opp}}^{\alpha_u}}, \qquad \alpha_u \in [0.35, 0.55]
$$

$$
\widetilde{P}_{\text{lose}} = \max\!\left(0,\ 1 - \widetilde{P}_{\text{win}} - P_{\text{tie}}\right)
$$

### 5.3. All-In Mechanics (`ALL-IN`)

An `ALL_IN` event represents maximum structural commitment and removes all future fold equity on subsequent streets. HoldemIQ tracks two state variables:

- `n_ai_opp ∈ {0, 1, ..., N_opp}`: Number of active opponents currently all-in.
- `ai_me ∈ {0, 1}`: Binary flag indicating whether Hero (`Me`) has already moved all-in.

#### Case 1: Hero is Already All-In (`ai_me = 1`)

Once Hero moves all-in, Hero has zero remaining betting decisions until the hand concludes at Showdown:

- The engine locks the decision state (`isLockedAllIn = true`), bypasses further `FOLD` / `RAISE` evaluation for Hero, and continues updating `P_win_adj`, `P_tie`, `P_lose_adj`, `S_me`, and `T_opp` live as the Turn and River cards are dealt.

#### Case 2: One or More Opponents Move All-In (`n_ai_opp >= 1`, `ai_me = 0`)

When an opponent moves all-in, `facingRaise` is forced to `1`, and two mathematical adjustments occur:

1. **Draw Realization Penalty:** Because Hero faces immediate commitment without cheap turn/river realization, draw equity is scaled by `0.45` when `n_ai_opp >= 1`.
2. **Threshold Elevation (`Δθ_ai`):** Both the call threshold `θ_call` and re-raise/all-in commitment threshold `θ_raise` shift upward to protect Hero against strong all-in ranges, adjusted by the average style index `Φ_bar_ai` of all-in opponents:

$$
\Delta\theta_{\text{ai}} = \text{clip}\!\Big( 0.085 + 0.045 \, (n_{\text{ai, opp}} - 1) + 0.05 \, \bar{\Phi}_{\text{ai}},\ 0.04,\ 0.22 \Big)
$$

$$
\theta_{\text{call}}^{\text{ai}} = \text{clip}\!\left(\theta_{\text{call}} + \Delta\theta_{\text{ai}},\ 0.12,\ 0.82\right)
$$

$$
\theta_{\text{raise}}^{\text{ai}} = \text{clip}\!\left(\theta_{\text{raise}} + 1.15 \, \Delta\theta_{\text{ai}},\ \theta_{\text{call}}^{\text{ai}} + 0.08,\ 0.92\right)
$$

When Hero's effective equity satisfies `E_eff >= θ_raise^ai`, the engine outputs **`RAISE / ALL-IN`** with the golden slash highlight.

---

## Chapter 6: Session Memory & Opponent Modeling (`Φ_i`)

### 6.1. Exponentially Weighted Moving Average (EWMA) Counters

In live poker games, opponent tendencies evolve over a session. Rather than treating early hands and recent hands with equal weight, HoldemIQ maintains an **Exponentially Weighted Moving Average (EWMA)** memory model for every non-Hero seat `i`.

#### 1. Decay Factors (`γ_mem = 0.985` and `γ_sd = 0.95`)

HoldemIQ separates **action/street memory** from **showdown memory** using two distinct decay constants:

- **Action & Participation Decay Factor:** `γ_mem = 0.985` per hand completion (half-life ≈ **45.85 hands**).
- **Showdown & Revealed-Hand Decay Factor:** `γ_sd = 0.95` per recorded showdown/hand completion (half-life ≈ **13.51 showdowns**).

#### 2. Decayed Counters & Showdown Quality Accumulation

When a hand `h` finishes (`completeHand`), for each opponent `i`:

1. Decayed action and street-reach counters update with factor `γ_mem = 0.985`:

$$
\tilde{n}_{\text{hands}, i}^{(h)} = \gamma_{\text{mem}} \, \tilde{n}_{\text{hands}, i}^{(h-1)} + \mathbb{I}(\text{participated}_i)
$$

$$
\tilde{n}_{\text{flop}, i}^{(h)} = \gamma_{\text{mem}} \, \tilde{n}_{\text{flop}, i}^{(h-1)} + \mathbb{I}(\text{reached Flop}_i)
$$

$$
\tilde{n}_{\text{turn}, i}^{(h)} = \gamma_{\text{mem}} \, \tilde{n}_{\text{turn}, i}^{(h-1)} + \mathbb{I}(\text{reached Turn}_i)
$$

$$
\tilde{n}_{\text{river}, i}^{(h)} = \gamma_{\text{mem}} \, \tilde{n}_{\text{river}, i}^{(h-1)} + \mathbb{I}(\text{reached River}_i)
$$

$$
\tilde{n}_{\text{raise}, i}^{(h)} = \gamma_{\text{mem}} \, \tilde{n}_{\text{raise}, i}^{(h-1)} + n_{\text{raise}, i}^{(h)}
$$

$$
\tilde{n}_{\text{cc}, i}^{(h)} = \gamma_{\text{mem}} \, \tilde{n}_{\text{cc}, i}^{(h-1)} + n_{\text{cc}, i}^{(h)}
$$

$$
\tilde{n}_{\text{fold}, i}^{(h)} = \gamma_{\text{mem}} \, \tilde{n}_{\text{fold}, i}^{(h-1)} + \mathbb{I}(\text{folded}_i)
$$

$$
\tilde{n}_{\text{ftr}, i}^{(h)} = \gamma_{\text{mem}} \, \tilde{n}_{\text{ftr}, i}^{(h-1)} + \mathbb{I}(\text{folded facing raise}_i)
$$

2. Showdown counters update with factor `γ_sd = 0.95` and a normalized revealed-hand quality score `q_rev,i^(h) ∈ [-1, +1]`:

$$
\tilde{n}_{\text{rev}, i}^{(h)} = \gamma_{\text{sd}} \, \tilde{n}_{\text{rev}, i}^{(h-1)} + \mathbb{I}(\text{has revealed cards}_i), \qquad \tilde{S}_{q, i}^{(h)} = \gamma_{\text{sd}} \, \tilde{S}_{q, i}^{(h-1)} + q_{\text{rev}, i}^{(h)}
$$

#### 3. Elimination & Resume Behavior

When an opponent is marked **Eliminated**, their memory record is **retained untouched**. When **Resume** is pressed, their seat becomes active again while keeping their EWMA counters and `Φ_i` intact—unless the user explicitly triggers **Reset Profile** or **Full Reset**.

### 6.2. Bayesian Smoothing & Small-Sample Protection

HoldemIQ applies **empirical Bayes shrinkage** using prior rates and virtual pseudo-count weights (`r_0 = 0.45`, `M_flop = 6.0`, `a_0 = 0.28`, `M_act = 5.0`, `M_sd = 4.0`):

$$
\hat{r}_{\text{flop}, i} = \frac{\tilde{n}_{\text{flop}, i} + M_{\text{flop}} \, r_0}{\tilde{n}_{\text{hands}, i} + M_{\text{flop}}}, \qquad \hat{a}_{\text{agg}, i} = \frac{\tilde{n}_{\text{raise}, i} + M_{\text{act}} \, a_0}{\tilde{n}_{\text{raise}, i} + \tilde{n}_{\text{cc}, i} + M_{\text{act}}}, \qquad \hat{q}_{\text{sd}, i} = \frac{\tilde{S}_{q, i}}{\tilde{n}_{\text{rev}, i} + M_{\text{sd}}}
$$

When a player has zero observations, `Φ_i` evaluates strictly to `0` (`NEUTRAL`), preventing false style classifications from small-sample noise.

### 6.3. Style Index (`Φ_i ∈ [-1, +1]`) & Profile-Adjusted Factors

HoldemIQ combines the smoothed behavioral deviations into a bounded **Style Index** `Φ_i ∈ [-1, +1]` using weights `w_1 = 0.80`, `w_2 = 0.50`, and `w_3 = 0.90`:

$$
\Phi_i = \text{clip}\!\Big( w_1 (r_0 - \hat{r}_{\text{flop}, i}) + w_2 (\hat{a}_{\text{agg}, i} - a_0) + w_3 \hat{q}_{\text{sd}, i},\ -1,\ +1 \Big)
$$

Each logged opponent action `e_t` is modulated by `Φ_{i_t}` via `μ(i_t, a_t)`:

$$
\mu(i_t, a_t) = \begin{cases} \exp(\eta_{\text{raise}} \, \Phi_{i_t}), & a_t \in \{\text{RAISE},\ \text{ALL\_IN}\} \\ \exp(\eta_{\text{cc}} \, \Phi_{i_t}), & a_t = \text{CHECK\_CALL} \\ 1, & \text{otherwise} \end{cases}
$$

with `η_raise = 0.45` and `η_cc = 0.25`. Across active opponents `O_active`, the profile-adjusted opponent range tightening factor `G_tilde_opp` and profile-adjusted table pressure `Π_tilde_table` are:

$$
\widetilde{G}_{\text{opp}} = \sum_{\substack{t:\ a_t \in \{\text{CHECK\_CALL},\ \text{RAISE},\ \text{ALL\_IN}\} \\ i_t \in \mathcal{O}_{\text{active}}}} \gamma(a_t, u_t, \text{rel}_t) \cdot \mu(i_t, a_t) + \sum_{i \in \mathcal{O}_{\text{active}}} g_{\text{prior}, i}(u)
$$

$$
\widetilde{\Pi}_{\text{table}} = w_{\text{street}}(u) \cdot \left( \alpha_1 \sum_{t \in \text{Raise}(u)} \mu(i_t, \text{RAISE}) + \alpha_2 \sum_{t \in \text{Raise}_{\text{after}}(u)} \mu(i_t, \text{RAISE}) + \alpha_3 \frac{k_{\text{after}}(u)}{\max(1, N_{\text{table}} - 1)} \right)
$$

---

## Chapter 7: Decision Engine, Reactive Matrix & Dual Metrics

### 7.1. Dynamic Decision Thresholds (`θ_call^ai` and `θ_raise^ai`)

Combining raw Monte Carlo outcomes, draw potential `P_draw+`, positional advantage `PosScore ∈ [0, 1]`, range factor `G_tilde_opp`, and table pressure `Π_tilde_table`:

$$
\text{Adj}_{\text{win}} = \exp\!\Big(-\beta_{\text{opp}} \, \widetilde{G}_{\text{opp}} - \beta_{\text{press}} \, \widetilde{\Pi}_{\text{table}} + \beta_{\text{pos}} \, (\text{PosScore} - 0.5)\Big)
$$

$$
\widetilde{P}_{\text{win}} = \text{clip}\!\Big(P_{\text{win, raw}} \cdot \text{Adj}_{\text{win}},\ 0,\ 1 - P_{\text{tie}}\Big), \qquad \widetilde{P}_{\text{lose}} = \max\!\Big(0,\ 1 - \widetilde{P}_{\text{win}} - P_{\text{tie}}\Big)
$$

Base multi-way equity and draw-boosted effective equity are:

$$
E_{\text{base}} = \widetilde{P}_{\text{win}} + \frac{P_{\text{tie}}}{N_{\text{active}}}
$$

$$
\lambda_{\text{eff}}(u, n_{\text{ai, opp}}) = \lambda(u) \cdot \begin{cases} 0.45, & n_{\text{ai, opp}} \ge 1 \\ 1.00, & n_{\text{ai, opp}} = 0 \end{cases}
$$

$$
E_{\text{eff}} = \text{clip}\!\Big(E_{\text{base}} + \lambda_{\text{eff}}(u, n_{\text{ai, opp}}) \, P_{\text{draw+}} \, (1 - E_{\text{base}}),\ 0,\ 1\Big)
$$

Dynamic thresholds scale with `N_active`, `Π_tilde_table`, `PosScore`, and all-in elevation `Δθ_ai`:

$$
\theta_{\text{call}} = \text{clip}\!\left(\frac{k_{\text{call}}}{N_{\text{active}}} + c_1 \, \widetilde{\Pi}_{\text{table}} - c_2 \, (\text{PosScore} - 0.5),\ 0.08,\ 0.65\right)
$$

$$
\theta_{\text{raise}} = \text{clip}\!\left(\frac{k_{\text{raise}}}{N_{\text{active}}} + c_3 \, \widetilde{\Pi}_{\text{table}} - c_4 \, (\text{PosScore} - 0.5),\ \theta_{\text{call}} + 0.12,\ 0.85\right)
$$

$$
\theta_{\text{call}}^{\text{ai}} = \text{clip}\!\left(\theta_{\text{call}} + \Delta\theta_{\text{ai}},\ 0.12,\ 0.82\right), \qquad \theta_{\text{raise}}^{\text{ai}} = \text{clip}\!\left(\theta_{\text{raise}} + 1.15 \, \Delta\theta_{\text{ai}},\ \theta_{\text{call}}^{\text{ai}} + 0.08,\ 0.92\right)
$$

$$
\theta_{\text{all-in}} = \min\!\left(0.95,\ \theta_{\text{raise}}^{\text{ai}} + 0.14\right)
$$

### 7.2. Reactive 13×13 Matrix Algorithm

The **13×13** matrix enumerates all **169** ordered rank pairs across ranks `A, K, ..., 2`. On **every state change**, each cell `(r, c)` is evaluated against `D_rem^(h)`, Hero's hand/board cards, current-hand dead cards, `N_active`, `PosScore`, raise escalation, opponent all-ins, and thresholds `(θ_call^ai, θ_raise^ai)`, placing it into `RAISE_ZONE`, `CALL_CHECK_ZONE`, `FOLD_ZONE`, or `BLOCKED` (with explicit CSS grid `repeat(13, minmax(0, 1fr))` so columns never overflow).

### 7.3. The "Two Numbers" Formula (`S_me` and `T_opp`)

Beneath the **13×13** matrix, HoldemIQ displays **Two Numbers**—a larger primary figure on the left for Hero (`S_me`) and a compact comparative figure on the right for the table/opponents (`T_opp`):

$$
S_{\text{me}} = \text{round}\!\left( 100 \cdot \text{clip}\!\Big( 0.65 \, \widetilde{P}_{\text{win}} + 0.25 \, E_{\text{eff}} + 0.10 \, P_{\text{draw+}},\ 0,\ 1 \Big) \right)
$$

For each active opponent `j ∈ O_active`, individual threat probability `p_threat,j` and multi-opponent threat `P_any_threat` are:

$$
p_{\text{threat}, j} = \text{clip}\!\Big( 0.14 + 0.08 \, \mathbb{I}(|B| \ge 3) + 0.06 \, \mathbb{I}(|B| \ge 4) + 0.05 \, \mathbb{I}(|B| = 5) + 0.12 \, \widetilde{\Pi}_{\text{table}} + 0.08 \, \max(0, \Phi_j),\ 0.05,\ 0.88 \Big)
$$

$$
P_{\text{any threat}} = 1 - \prod_{j \in \mathcal{O}_{\text{active}}} \left(1 - p_{\text{threat}, j}\right)
$$

$$
T_{\text{opp}} = \text{round}\!\left( 100 \cdot \text{clip}\!\Big( 0.55 \, P_{\text{any threat}} + 0.45 \, \text{clip}\!\big(1 - \widetilde{P}_{\text{win}} - P_{\text{tie}},\ 0,\ 1\big),\ 0,\ 100 \Big) \right)
$$

---

## Chapter 8: System Architecture, Offline-Safe Ad Slot & Local Build Pipeline

### 8.1. Three-Layer State Architecture & Event Flow

HoldemIQ enforces strict unidirectional data flow across three decoupled layers:

1. **Layer 1 — `SessionState`:** Persisted locally in `localStorage` (`holdemiq_session_v1`); holds `nTable` in `[2, 15]`, seat mappings, EWMA player memories and style indices `Φ_i`, and archival `showdownHistory`.
2. **Layer 2 — `HandState`:** Ephemeral per hand; holds `handId`, `street` (`Pre` | `Flop` | `Turn` | `River` | `Showdown`), `btnSeat`, `mySeat`, `myCards[2]`, `boardCards[0..5]`, current-hand `knownDeadCards`, participant states (`active` | `folded` | `eliminated`, `isAllIn`), and street `events`.
3. **Layer 3 — `EngineOutput`:** Pure deterministic derived projection recomputed synchronously on every state change (`nActive`, `nOpp`, `nAiOpp`, `aiMe`, street raise escalation `x2` / `x4` / `x8` / `x16`, positions, probabilities, `matrix13x13`, `verdict`, `playerInsights`, and `twoNumbers` `S_me` and `T_opp`).

### 8.2. Offline-Safe Ad Slot (`0px` Offline Collapse)

Whenever the device is offline or no ad creative is available, the ad slot collapses cleanly to **`0px` height** (`height: 0px`, zero margin/padding, `overflow: hidden`) so the Poker Table and analytical panels reclaim full viewport space without blank or broken boxes.

### 8.3. Local Build Pipeline for Web, Windows & Android

```bash
npm install
npm run typecheck
npx vitest run
npm run build
```

- **Windows (Electron):** Build the web bundle (`npm run build`) and package the local Windows desktop app using the configured Electron build script / `electron-builder` with a matching desktop icon.
- **Android (Capacitor):** Sync the compiled web bundle and open/build the Android project:

```bash
npm run build
npx cap sync android
npx cap open android
```