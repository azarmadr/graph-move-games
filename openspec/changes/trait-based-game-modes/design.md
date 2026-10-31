## Context

See proposal.md — Why. This document covers only what is needed to explain the shape of the solution.

**Current state.** `crates/core` has `Board` (with `valid_moves`, `empty_positions`, `resolve_move`, `sample_spawn`) and `Engine` (which owns the `GraphStore` DAG, a `HashMap<GameId, GameInstance>`, and applies moves). `Engine::make_move` performs merge → node → spawn → node → two edges in one call, against one game id. `Board::sample_spawn` draws from thread-local `rand::rng()`.

**Constraints that shaped the approach.**

- The DAG is content-addressed: `BoardId = Fnv1a(rule, board content)`. Identical boards under the same rule are the same node regardless of which game or player produced them. This is the property that makes two cursors on one graph meaningful, and it must not be disturbed. The rule joins the hash because two boards with the same cells but different merge rules have different futures; without it they would collide.
- `Engine` derives `Serialize` and is exported wholesale via `export_graph`. Anything that must survive save and restore — including each agent's source of randomness — must therefore live inside `Engine`'s serialized form.
- `crates/tui` and `crates/merge-cli` call into the same engine API.
- The frontend reaches the engine only through JSON over the WASM bridge.

**Reference point.** The `board-game` crate (KarelPeeters) was considered as a dependency. Its `Board` trait conflates board and game — `next_player()` and `outcome()` live on the board — which is exactly what Survival Race cannot tolerate, since it needs two boards under one turn structure. Its three most useful patterns are borrowed instead: `available_moves()` split from `play()`, an RNG passed *into* the board rather than owned by it, and composition by wrapping (`MaxMovesBoard<B>`).

## Goals / Non-Goals

**Goals:**

- One board-level trait and one game-level trait, through which *every* gameplay runs — including today's single-player 2048, which must not be a special case.
- Tile rules and game modes compose independently: the same board plays 2048 or Threes by swapping its merge rule, and the same rule plays under any mode.
- Survival Race expressible as a composition of the same parts, with provably identical spawn placement across its boards whenever the boards permit it.
- Save/restore fidelity: an exported engine state restores to a playable continuation, with every agent's state intact.
- A bot that fills a seat indistinguishably from a human, so difficulty levels and per-seat handicaps are configuration rather than new plumbing.
- Spawn pressure that scales with the board, so larger grids stay interesting (fixed, or by empties).

**Non-Goals:**

- **Replayability.** Not a requirement and not a goal. A 2048 needs no reproducible randomization; if a game ever needs replaying, recording the command sequence is enough. The seed exists to cover the shared-bot scenario, not to reproduce matches.
- Difficulty levels beyond `RandomBot`.
- Networked multiplayer. Both modes are local.
- Any change to content-addressing, hash inputs, or the DAG's deduplication behaviour, apart from including the tile rule in the address so two rules never collide.
- Adding non-2048 boards. The traits must permit them; none ships here.
- Replacing the frontend's component structure.

## Design Model

The concrete shape of the solution — the types, the traits, and how they wire together. The Decisions section explains why each shape was chosen.

### The board and game traits

```rust
pub trait BoardGame: Clone + Eq {
    type Action: Clone + Eq;
    fn id(&self) -> BoardId;                            // content address, for the DAG
    fn valid_swipes(&self) -> Vec<Direction>;
    fn spawn_space(&self) -> SpawnSpace;
    fn apply(&self, action: &Self::Action) -> Result<(Self, ScoreDelta), ActionError>;
    fn is_terminal(&self) -> bool;
}

pub trait GameMode {
    type Board: BoardGame<Action = Action>;             // the bound: modes speak the shared board action

    fn seats(&self) -> &[Seat];
    fn obligations(&self) -> &[Obligation];
    fn board(&self, slot: BoardSlot) -> &Self::Board;

    fn candidates(&self, seat: SeatId, chosen: &[Pos]) -> Candidates;
    fn play(&mut self, action: Action) -> Result<TurnReport<Self::Board>, GameError>;
    fn outcome(&self) -> Option<Outcome>;
}

// one board type; the tile rule is data, so the same board plays 2048 or Threes
impl BoardGame for Board { type Action = Action; /* … */ }

// the modes differ in seating and spawn policy, not in the action vocabulary
impl GameMode for Single    { type Board = Board; /* … */ }
impl GameMode for Threes    { type Board = Board; /* … */ }
impl GameMode for Race      { type Board = Board; /* … */ }
impl GameMode for Crossfire { type Board = Board; /* … */ }
```

`type Board: BoardGame<Action = Action>` is a **bound**, not a supertrait. A supertrait (`trait GameMode: BoardGame`) would force the mode itself to answer `valid_swipes()` — meaningless for a mode holding three boards acted on by different seats. The `Action = Action` equality is what lets a mode accept the shared board action directly while `BoardGame` stays free to define a different action type for a board game that is not driven through a mode.

A bound only has teeth if the mode actually *uses* the type it bounds, which is why `board()` returns `&Self::Board`. Without that accessor a mode could declare a `Board`, never hold one, and still compile — the bound would constrain nothing but an unused alias. With it, a mode whose associated `Board` is not a board cannot implement the accessor, and does not compile. That is the connection made compiler-enforced.

There is deliberately no `legal_moves` on `GameMode` — and no enumeration of complete moves either. What a seat gets is a **candidate set**: the admissible *next* choice, derived at call time by intersecting three facts, holding nothing that could drift:

- the boards say what **exists** — `valid_swipes()`, `spawn_space()` (`board-actions`),
- the obligation says what is **due** — a swipe or a placement, now or at round end.

The shape of that set differs by action kind, and the difference is the point:

```rust
pub enum Candidates {
    Swipe(Vec<Direction>),                      // what the boards accept — at most four
    Place { next: Vec<Pos>, remaining: usize }, // admitted for the NEXT placement
}
```

For a placement obligation, `candidates` answers *"where may the next tile go, given the `chosen` ones?"* — never *"what sequences are possible."* A spawn of k tiles on e empty positions has C(e, k) sequences, a degraded scope multiplies that across clusters, and spawn-count scaling (D10) is what makes k grow — enumerating them would be infeasible exactly when it matters. It is also pointless: neither decider works that way. A human places one tile at a time; a bot draws one position at a time from its own RNG. The reported set never grows past the board's empty positions, however many placements remain. `play` validates a submitted sequence by folding it through the same function, so the bridge cannot smuggle in a placement the policy would not have admitted.

The method exists so that a driver — the engine, the WASM bridge, a bot — has something to ask; what it must not do is cache the answer. A stored list would duplicate the boards' reports and disagree with them the moment a board changes.

### Grid, and the rule that merges two tiles

The grid operations and the merge policy are two different things, so they are two different pieces:

```rust
pub struct Grid<T> { /* rows, cols, cells: Vec<Option<T>> */ }

impl<T: Copy + Eq> Grid<T> {
    pub fn get(&self, p: Pos) -> Option<T>;
    pub fn set(&mut self, p: Pos, tile: Option<T>);
    pub fn rows(&self) -> u8;
    pub fn cols(&self) -> u8;
    pub fn positions(&self) -> impl Iterator<Item = Pos>;
    pub fn empties(&self) -> Vec<Pos>;
    pub fn line(&self, direction: Direction, index: u8) -> impl Iterator<Item = (Pos, Option<T>)>;
    pub fn slide(&mut self, direction: Direction, merges: impl Fn(T, T) -> Option<T>)
        -> Vec<T>;                                // returns the tiles produced by merging
    pub fn is_empty(&self) -> bool;
    pub fn is_full(&self) -> bool;
}

pub trait MergeRule<T>: Copy + Eq + Serialize + DeserializeOwned {
    fn merge(&self, a: T, b: T) -> Option<T>;         // Some(result) when the pair merges
    fn score_delta(&self, produced: &[T], grid: &Grid<T>) -> ScoreDelta;
}

pub enum Rule { EqualTiles, Threes }
impl MergeRule<u32> for Rule { /* dispatch to the two rules */ }

pub struct Board {
    pub grid: Grid<u32>,
    pub rule: Rule,
}
```

`Grid` owns every position, line, slide, and emptiness operation, and knows nothing about 2048, Threes, or any game. `Board` is the tile-sliding board: it delegates geometry to `Grid` and asks `rule.merge` whether two tiles combine. A different board game can implement `BoardGame` directly on top of the same `Grid` without inheriting any tile rule.

`Board` holds a concrete `Rule` rather than a generic `R: MergeRule<u32>` because the DAG stores boards by value and must serialize, hash, and compare them; an enum keeps `Board` a concrete `Eq + Serialize` type. The trait still keeps `Board`'s code rule-agnostic, and a future rule is a new `Rule` variant.

`MergeRule::merge` is the method the requirement asks for — *how two tiles merge* is a property of the rule, not of the board, the mode, or the tile's value. `EqualTiles` merges equal tiles and scores the produced value; `Threes` merges `1 + 2` and equal tiles ≥ 3, and scores the resulting board from its rarity table. Because the rule is a value on the board, the two axes are independent:

| mode \ rule | `Rule::EqualTiles` | `Rule::Threes` |
|---|---|---|
| `Single` | classic 2048 | 2048 seating and spawn, Threes merge and rarity score |
| `Threes` | Threes deck and opposite-edge entry, 2048 merge and running score | classic Threes |
| `Race` | Survival Race with 2048 tiles | Survival Race with Threes tiles |
| `Crossfire` | Crossfire with 2048 tiles | Crossfire with Threes tiles |

So "2048 with 3s tiles" is `Single` + `Rule::Threes`, and "3s with 2048 tiles" is `Threes` + `Rule::EqualTiles`. No mode has a board-type flag and no board has a mode flag.

### The types

Every type the change creates, grouped by where it lives. Fields are skimmed where the name says it — the shape is the point.

**Board and graph** (existing, renamed where noted):

```rust
pub struct Pos { pub r: u8, pub c: u8 }
pub struct Cell { pub pos: Pos, pub tile: u32 }

pub struct Grid<T> { /* rows, cols, cells: Vec<Option<T>> */ }   // all grid operations

pub trait MergeRule<T>: Copy + Eq + Serialize + DeserializeOwned {
    fn merge(&self, a: T, b: T) -> Option<T>;
    fn score_delta(&self, produced: &[T], grid: &Grid<T>) -> ScoreDelta;
}

pub enum Rule { EqualTiles, Threes }             // the two tile rules
impl MergeRule<u32> for Rule { /* … */ }

pub struct Board {                               // one board type, rule is data
    pub grid: Grid<u32>,
    pub rule: Rule,
}

pub enum ScoreDelta {
    Add(u64),                                    // 2048: merge value adds to the running score
    Set(u64),                                    // Threes: score is a function of the board's content
}

pub struct BoardId(u64);                         // Fnv1a(rule, content)
pub struct EdgeId(u64);
pub struct GameId(u64);

pub struct SpawnSpace(pub Vec<Pos>);             // positions only — no weights

pub enum Edge {
    Swipe(Direction),                            // was Edge::Move
    Spawn(Vec<Cell>),
}

pub struct GraphEdge { pub from: BoardId, pub to: BoardId, pub kind: Edge }

pub struct GraphStore {
    pub nodes: HashMap<BoardId, Board>,          // one board type; rule is part of the key
    pub edges: HashMap<EdgeId, GraphEdge>,
}
```

`BoardId` hashes the board's **rule** together with its cells, so two boards that share cell values but carry different rules never collide. `GraphStore` stays mode-oblivious: it stores boards and board actions, never modes, seats, or slots.

**Engine and the game wrapper:**

```rust
pub struct Engine {
    pub version: u32,
    pub graph: GraphStore,
    pub games: HashMap<GameId, AnyGame>,         // one enum at the storage boundary
    pub next_game_nonce: u64,
}

pub enum AnyGame {                               // the only place modes are matched on
    Single(Game<Single>),
    Threes(Game<Threes>),
    Race(Game<Race>),
    Crossfire(Game<Crossfire>),
}

pub struct Game<M: GameMode> {                   // the wrapper: identity + history around a mode
    pub id: GameId,
    pub mode: M,
    pub history: Vec<Action>,                    // the shared command log
}

// The state every mode shares — composition, not inheritance.
pub struct Table<B: BoardGame> {
    pub slots: Vec<Slot<B>>,
    pub seats: Vec<Seat>,
    pub obligations: Vec<Obligation>,
    pub agents: Vec<Agent>,
    pub round: u32,
}

pub struct Slot<B: BoardGame> {                  // a board's place at the table
    pub slot: BoardSlot,
    pub board: B,                                // serializes as its BoardId
    pub score: u64,
    pub pending: Option<ObligationId>,           // the next action/resolution owed here
    pub player: Option<PlayerId>,
}

pub struct BoardSlot(pub u8);                    // mode-local: b1, b2 — not a DAG id
pub struct PlayerId(pub u8);

// Each mode is a small struct over the shared table plus what makes it different.
pub struct Single    { pub table: Table<Board>, pub config: SingleConfig }
pub struct Threes    { pub table: Table<Board>, pub config: ThreesConfig,
                       pub entry: Option<EntryRule> }
pub struct Race      { pub table: Table<Board>, pub config: RaceConfig, pub policy: SpawnPolicy }
pub struct Crossfire { pub table: Table<Board>, pub config: CrossfireConfig, pub cursors: Vec<BoardSlot> }

pub struct SingleConfig    { /* grid, spawn_config, difficulty, rule */ }
pub struct RaceConfig      { /* grid, spawn_config, difficulty, per_slot_bots, rule */ }
pub struct CrossfireConfig { /* grid, spawn_config, target_strategy, rule */ }

pub struct ThreesConfig {                        // the Threes mode's spawn policy
    /* grid, deck, difficulty, rule */
    pub deck: Deck,
    pub difficulty: Difficulty,
    pub rule: Rule,                              // defaults to Rule::Threes, overridable
}

pub struct Deck { pub cards: Vec<u32>, pub cursor: usize }   // seeded shuffle, serialized

pub struct EntryRule {                           // the swipe that just happened
    pub direction: Direction,
    pub lines: Vec<u8>,                          // the rows/columns that changed
}
```

**Seats, obligations, agents:**

```rust
pub struct SeatId(pub u8);
pub struct AgentId(pub u8);

pub enum ActionKind { Swipe, Place }             // what an obligation asks for
pub enum Resolution { Immediate, EndOfRound }    // an option, not a mode constant

pub struct Seat {
    pub id: SeatId,
    pub agent: AgentId,                          // who holds it — human and bot are identical here
    pub scope: Vec<BoardSlot>,                   // the slots this seat may act on
    pub difficulty: Option<Difficulty>,          // per-seat handicap
}

pub struct ObligationId(pub u32);
pub struct Obligation {
    pub id: ObligationId,
    pub seat: SeatId,
    pub action: ActionKind,                      // what is owed: a swipe or a placement
    pub target: Option<BoardSlot>,               // the board it acts on (Crossfire's victim)
    pub resolves: Resolution,
}

pub struct Agent {
    pub id: AgentId,
    pub kind: AgentKind,
    pub rng: RngState,                           // seed + position — kept, and serialized
}

pub enum AgentKind {
    Human,
    Bot { difficulty: Difficulty },
}

pub struct Difficulty(pub u8);
pub struct RngState { pub seed: u64, pub draws: u64 }   // serialized, so a save resumes its stream
```

**Moves, choices, reports:**

```rust
// The board action is the only action vocabulary. The obligation says which kind is due;
// the seat's scope or the obligation's target says which board it lands on.
pub struct Swipe(pub Direction);

pub struct Place {                               // one spawn's worth of tiles
    pub cells: Vec<Cell>,                        // positions from spawn_space, values from weights/deck
}

pub enum Action {
    Swipe(Swipe),
    Place(Place),
}

pub enum Candidates {
    Swipe(Vec<Direction>),
    Place { next: Vec<Pos>, remaining: usize },
}

pub struct Transition<B: BoardGame> {
    pub slot: BoardSlot,
    pub before: BoardId,
    pub after: B,                                // the engine inserts this into the graph
    pub edge: Edge,
}

pub struct TurnReport<B: BoardGame> {
    pub transitions: Vec<Transition<B>>,
    pub score_deltas: Vec<(BoardSlot, ScoreDelta)>,
    pub created: Vec<ObligationId>,
    pub resolved: Vec<ObligationId>,
    pub pending: Vec<SeatId>,
}
```

**Spawn configuration and fairness:**

```rust
pub struct SpawnConfig {
    pub weights: HashMap<u32, u32>,              // tile value → weight (existing shape)
    pub count: SpawnCount,
}

pub enum SpawnCount {
    Fixed(u8),
    ByEmpties,                                   // ceil(ln(empties)), clamped to >= 1
}

pub struct SpawnPolicy {
    pub ledger: Vec<Shortfall>,                  // per-slot owed placements
    pub last: Vec<(BoardSlot, Pos)>,             // last round's placements
}

pub struct Shortfall { pub slot: BoardSlot, pub owed: u32 }
pub struct Divergence { pub round: u32, pub placements: Vec<(BoardSlot, Pos)> }

pub struct Outcome {
    pub ranking: Vec<(PlayerId, u64)>,
    pub winner: Option<PlayerId>,
}
```

**Errors:**

```rust
pub enum ActionError { InvalidForBoard }
pub enum GameError { NotYourTurn, NotPermitted, InvalidAction }
```

**Why the wrapper, and why the slot owns its board.** `Game<M>` is a thin wrapper — identity plus a typed command log around a mode. It does **not** implement `GameMode`; the mode struct does, so no mode method ever matches on its own kind. `Engine` stores `AnyGame`, whose four variants are `Game<Single>`, `Game<Threes>`, `Game<Race>` and `Game<Crossfire>`: a heterogeneous map forces exactly one match, at the storage boundary, and that is the only one in the design. The alternative — `Engine<M>` generic — would mean one engine per mode, and an engine that cannot hold two kinds of game at once.

The state every mode shares is `Table<B>` (slots, seats, obligations, agents), embedded by composition; each mode adds only what makes it different (`policy`, `cursors`, its config). `Slot` owns its board at runtime so `board(slot)` can return `&B`; it serializes as its `BoardId`, so the exported payload stores each board once, in the graph. The serde impls add `M: Serialize + DeserializeOwned`; `Action` is serializable, so the history needs no per-mode bound.

**Who holds a seat.** The mode's `Table` owns its seat table; a seat names the agent that fills it, and an agent is not a seat. One agent may fill several seats — including on different boards — and acts on each when that seat's obligation comes due, like a chess player answering several boards at once. Nothing in the model binds an agent to a single board.

### Wiring

```
  Engine
    │  games: HashMap<GameId, AnyGame>
    ▼
  AnyGame ── the one match on mode ──▶ Game<Single> | Game<Threes> | Game<Race> | Game<Crossfire>
                                            │
                                            │  Game<M> = { id, history: Vec<Action>, mode: M }
                                            ▼
                                         M: GameMode ──── owns
                                            ├── Table<B>
                                            │     ├── slots        { board, score, pending }
                                            │     ├── seats        { agent, scope }
                                            │     ├── obligations  { seat, action, target, resolves }
                                            │     └── agents       { kind, rng }  ← bot state the engine keeps
                                            │
                                            │  candidates(seat) · play(Action) → TurnReport<B>
                                            ▼
                                        B: BoardGame (one per slot)
                                            └── Board
                                                  ├── grid: Grid<u32>   ← positions, lines, slide
                                                  └── rule: Rule        ← EqualTiles | Threes
                                            │
                                            │  TurnReport<B>.transitions { before, after, edge }
                                            ▼
                                        GraphStore — Board nodes; boards and board actions only
```

### The modes as seat tables

```
  Survival Race (N = 3)                      Crossfire (N = 3)

  p1  swipe  scope {b1}                      p1  swipe  scope {b1}
  p2  swipe  scope {b2}                      p1  spawn  scope {target} ─┐
  p3  swipe  scope {b3}                      p2  swipe  scope {b2}      │ one target
  bot spawn  scope {b1,b2,b3}                p2  spawn  scope {target} ─┤ per player,
        one decision → every slot            p3  swipe  scope {b3}      │ rotating
                                             p3  spawn  scope {target} ─┘

  Single (2048) = this table at N = 1        Crossfire's target chosen by a
  Threes        = the same one-slot table,   declared strategy
                  but the spawn obligation
                  draws from a deck and must
                  enter from the swiped edge

  The tile rule is orthogonal to all of this: every seat table above plays
  with Rule::EqualTiles or Rule::Threes, chosen at creation.
```

### Obligation timing

```
  Survival Race — EndOfRound
  (one decision must be made against every board's final state)

    p1 swipes b1 ─┐
    p2 swipes b2 ─┼──▶ every swipe seat has acted ─▶ ONE placement decision ─▶ every slot
    p3 swipes b3 ─┘

  Crossfire — Immediate
  (the counterattack is the reply; it does not wait for anyone)

    p1 swipes b1 ─▶ p1 spawns on the target ─▶ live before p2 has swiped
    p2 swipes b2 ─▶ p2 spawns on the target ─▶ live immediately
```

### One board, two tile rules, and why the split earns its keep

There is one `Board` type in this change, but two `MergeRule` values. The board owns geometry and purity; the rule owns the only two things that vary between 2048 and Threes on the board side:

| | `Rule::EqualTiles` — 2048 | `Rule::Threes` — Threes |
|---|---|---|
| **merge** | equal tiles | 1 + 2 = 3; equal tiles ≥ 3 |
| **score** | produced values add to the running score | the board's rarity total replaces the score |
| **termination** | no valid swipe | no valid swipe |

Everything else that differs between the games is mode-side, not board-side:

| | `Single` mode | `Threes` mode |
|---|---|---|
| **spawn value** | weighted draw from `SpawnConfig` | next card from the deck |
| **spawn position** | any empty cell | opposite edge of the lines the swipe changed |
| **spawn count** | `SpawnCount` (fixed / by empties) | one card per swipe |

So the split is: `Grid` + `MergeRule` = board; deck + entry rule + seats + obligations = mode. Neither knows the other's business: `Board::apply` never sees the deck, and `Threes::candidates` never re-implements a merge.

```rust
// board-side: pure, no randomness; geometry from Grid, merging from the rule
impl BoardGame for Board {
    type Action = Action;
    fn valid_swipes(&self) -> Vec<Direction> { /* any rule: a direction is valid iff the grid changes */ }
    fn spawn_space(&self) -> SpawnSpace { SpawnSpace(self.grid.empties()) }
    fn apply(&self, a: &Action) -> Result<(Self, ScoreDelta), ActionError> {
        // self.grid.slide(dir, |a, b| self.rule.merge(a, b)) → produced
        // self.rule.score_delta(&produced, &grid)
    }
    fn is_terminal(&self) -> bool { self.valid_swipes().is_empty() }
}

// mode-side: deck, entry rule, seating
impl GameMode for Threes {
    type Board = Board;
    fn candidates(&self, seat: SeatId, chosen: &[Pos]) -> Candidates {
        // after a swipe: opposite-edge cells on the lines that changed
        // before a swipe: the valid swipe directions
    }
    // ...
}
```

The point of separating the rule from the mode is the matrix in the Design Model: `Single` + `Rule::Threes` is 2048 with Threes tiles, and `Threes` + `Rule::EqualTiles` is Threes with 2048 tiles. A single `Board` type with a rule value gives that for free; a second board type would have hard-coded one pairing.

*Alternative considered:* two board types (`Board`, `ThreesBoard`). Rejected — it fixes the rule to the type, so the two cross combinations are unreachable without duplicating a board. It also duplicates the grid operations in both types.

### Beyond Threes: other board games

Nothing in the model is 2048- or Threes-specific except the board's own rules. `Grid` is general over cell type, so a chess board could reuse it for geometry and implement `BoardGame` with its own action type and legal-move generator; a mode would then decide whose turn that ply belongs to. The candidate-space framing still holds, because the explosion is in sequences, not in one ply.

Seats become sides; an obligation becomes "the side to move must act"; `Resolution::Immediate` describes the alternating turn order. Spawn has no chess analogue, so the mode simply declares no placement obligation. A multi-board variant (bughouse) is exactly the Survival Race shape: several slots, seats spanning them, one obligation graph over all of them.

## Decisions

### D1. Board and Game are separate traits

`BoardGame` describes what one board can do. `GameMode` describes who acts on which board, in what order. This is the split the `board-game` crate refuses to make, and it is the precondition for composing two boards under one turn structure. The connection between them is expressed as a bound (`type Board: BoardGame`), not a supertrait — see Design Model.

The split earns its keep twice over. First, a mode holds N boards under one turn structure, which a board-level `next_player()` cannot express. Second, the board's own rules are themselves two layers: `Grid` supplies the operations and `MergeRule` supplies the merge and the score. That layering is what lets the same board play 2048 or Threes, and is why one board type with a rule value is enough here — the variation that matters is a value, not a type.

*Alternative considered:* adopt `board-game` as a dependency. Rejected — its `Board` carries `next_player()`/`outcome()`, so a second board has nowhere to live. Its traits also assume deterministic two-player games with no randomness, which does not fit a spawn.

### D2. `BoardGame` reports board facts, not a unified action enum

Returning `Vec<Action>` where `Action = Swipe | Place` would make the board report *which kind of action is due*, which is game-level knowledge. A board mid-placement is indistinguishable from one mid-swipe; only the mode knows. The board reports what exists (`valid_swipes`, `spawn_space`), never what is owed.

`apply` is pure and holds no RNG. Sampling moves to the agent (D11), matching `board-game`'s `random_available_move(&self, rng)`.

*Alternative considered:* a single `action_space()` returning both kinds. Rejected for the reason above; it also forced the board to carry phase state.

### D3. Seats bind an agent to a scope; obligations carry the action kind

The question of whether "the spawning side chokes the swiping side" deserves a trait is answered by separating two things. The *choking* is emergent — a spawn fills a cell, so a board given more spawns than swipes dies sooner — and is a balance parameter of the mode, not a trait. The *wiring* is what gets formalized: the seat table shown in the Design Model (`agent + scope`), with the obligation naming what is owed (`action: Swipe | Place`).

Survival Race declares four seats for N = 3: `p1 → [b1]`, `p2 → [b2]`, `p3 → [b3]`, `bot → [b1, b2, b3]`; the first three owe swipes, the bot owes placements.

The mode owns the seat table; a seat names the agent that fills it. This is what makes a bot interchangeable with a human: a seat holds an agent, and from the seat's perspective there is no difference between the two. There is no separate `Capability` enum: the action kind lives on the obligation, which is the thing that says an action is due.

### D4. The placement seat's scope is a set — fairness is structural

The placement seat spans *all* board slots. This single choice is what makes "same tile, same empty space" true rather than approximately true.

*Alternate kept, not rejected:* one bot per board with an identical seed ships as an in-game alternate (`survival-race` spec). It is easier to implement, and it is honest about what it gives: identical seeds resolve against different empty sets, so placement diverges as soon as the boards differ — the divergence is recorded (`spawn-fairness`) rather than claimed away. The shared seat remains the default because it is the only shape where identical placement is structural rather than coincidental.

### D5. Two distinct id spaces

```rust
struct BoardSlot(u8);   // local to the mode: b1, b2 — "my board"
struct BoardId(u64);    // global, content-addressed — DAG node
```

A slot *points at* a content id and moves through the DAG as play progresses. Conflating them would let a mode address DAG nodes directly, which would break D12. These must be distinct types, not aliases.

### D6. One `Action` vocabulary; the obligation resolves the target

`Action` is `Swipe(Direction) | Place(Vec<Cell>)`, and it is the same type for every mode. `GameMode::play` takes an `Action`, and `Game<M>.history` is `Vec<Action>`. The seat's scope or the obligation's `target` says which board the action lands on, so no move type has to encode it.

This replaces the earlier `Targeted<A>` / `Scoped<A>` split. Those shapes existed to distinguish "one named board" from "the seat's whole scope", but that distinction is already present in the obligation: a swipe obligation has a single target, a shared placement obligation spans its scope. Encoding it again in a move type duplicated the same fact and forced a mode-associated `Move` for no gain.

*Alternative considered:* keep `M::Move` and the two wrappers. Rejected — all four modes use the same two actions; the only thing that varied was the target, and the obligation already carries that.

### D7. Obligations replace `whose_turn()`; the trait states seating and obligations explicitly

`GameMode` exposes `seats()` and `obligations()` — the seating arrangement and what each seat owes are part of the trait's surface, not hidden inside an implementation.

An action has an immediate effect and may create an obligation, on another seat or on the acting seat itself. Resolution timing is an option carried by the obligation — a mode ships a default and a match may override it:

- **Immediate** (Crossfire's default) — your swipe obliges your own placement seat, and the tile lands without waiting for anyone. A counterattack that waits for the other players is not a reply.
- **EndOfRound** (Survival Race's default) — one decision spans every slot, so it must be made against the round's final boards. Resolving earlier would place against boards that are about to change, and would hand later-acting seats a window in which their deferred effect is live while the earlier-acting seats' is not — a silent first-mover asymmetry that would invalidate the fairness claim the mode rests on.

The two modes differ only in which option they default to; the mechanism is the same.

Obligations generalise past both modes: a mode may declare arbitrary obligation graphs, including seats owing two actions or obligations that expire.

### D8. Fairness is a partition, expressed as a ladder

Given the **fillable** board slots — those with at least one empty cell — with empty sets E₁…Eₙ, fairness is how finely the fillable set is partitioned:

```
Level 2  INTERSECTION  ∩E ≠ ∅ → all n fillable slots get the same cell
                            │  ∩E = ∅
                            ▼
Level 1  CLUSTER       group slots by identical empty set; one draw per group
                            │
                            ▼
Level 0  INDEPENDENT   each slot draws for itself
```

The ladder's input is fillable slots only, and this ordering matters: an unfillable slot has an empty set of ∅, and ∅ in the intersection collapses every other slot to Level 0 — one board one merge away from opening cells would destroy the sharing for all the rest. Excluding unfillable slots *before* the intersection is computed is what keeps the guarantee meaningful.

Level 1 is unreachable through a pairwise API and is the interesting middle: two slots whose empty sets happen to be identical still share perfectly even when a third has diverged.

The policy is N-way and stateful — it keeps a per-slot ledger under one rule: **nothing is skipped unless it is unfillable.**

- A slot with at least one empty cell receives its placement in the same round, always.
- A slot with no empty cells is *unfillable*: it receives nothing and is owed nothing — it is not skipped, it has nowhere to place. It takes no part in the fairness computation above, and re-enters the ledger the moment its owner's merge opens a cell.
- If a fillable slot ever receives nothing — a degraded path, a defect — the ledger records the shortfall, the next round repays that slot first, and the repayment is recorded as divergence rather than absorbed silently.

Why stateful at all: fillability changes from round to round (merges open cells, spawns fill them), so "was any fillable slot served?" is a question about history, not about the current boards. Round-robin bookkeeping over n boards is not a pure function of what the boards look like right now.

### D9. The policy fixes the candidate set; the agent chooses within it

Fairness must be structural, or a human holding the placement seat simply plays unfair. The policy computes the fair candidate set (the intersection at Level 2, degraded as in D8) — the same set `candidates()` reports to whoever holds the seat; whatever agent that is selects among those candidates. This mirrors chess: the rules define legal moves, the player picks.

The consequence worth stating plainly — holding the placement seat confers placement choice but not fairness discretion. That is the point of the mode.

### D10. Spawn count is configuration, not a trait; rounded up, scaled logarithmically

`SpawnCount::{Fixed(u8), ByEmpties}` rides in the mode's spawn settings, extending the `SpawnConfig` that already exists. It is not a trait because there is nothing to implement differently per board: it is one rule the placement policy applies.

The rounding is a ceiling — simple, and it never rounds a fillable slot to zero before the clamp. `ByEmpties` scales with the **natural logarithm** of the empty cells, `ceil(ln(empties))`: doubling the room should not double the pressure. On a 3×3 that is 3 tiles at nine empties and 1 at one empty; on a 5×5 it stays 3 at sixteen empties and reaches 4 at twenty-five. There is no base knob: `e` is the scale, and a mode that wants a different pressure uses `Fixed`.

The count is always clamped to the empty positions actually available — a full board takes none, a board with one empty takes one.

### D11. The bot owns the seed; the engine drives it and keeps its state

`Board::sample_spawn`'s `rand::rng()` is thread-local and outside `Engine`'s serialized form — placement randomness lives nowhere in the game state: it cannot be owned by a bot, shared across boards, or saved.

Under the new shape the agent holds the random source (`Agent.rng`), the game owns the agent, and `Engine` serializes the game. The engine is also the **driver**: after every applied action it resolves whatever obligation is now due and held by an automated agent, until nothing more can proceed without external input. Human-held obligations surface as pending instead. So a restored save resumes with its agents intact, and one shared bot draws from one stream for every board — the shared-bot scenario the seed exists for. The same-seed alternate (D4) is the easy version: N bots, one seed.

Replayability is explicitly not the point (Goals); if a replay is ever wanted, record the commands — which the game already keeps in `history`.

### D12. `GraphStore` stays mode-oblivious; score and pending live on the slot

```
  mode (Table<B>) ── TurnReport<B>.transitions { before, after, edge } ──▶  GraphStore
  owns seats, slots, agents, obligations                     owns content-addressed DAG
  slot owns { board, score, pending }                        sees board nodes and
                                                             board actions only
```

Score belongs to the board's seat at the table, not to the DAG node: identical content can be reached with different scores, so it cannot live on a content-addressed board. It lives on the slot, next to the board pointer and the obligation that slot owes next. The store must never see a seat, a slot, a mode, or a score.

### D13. Both modes are seat tables over the same slots

Neither mode is a special case — each is just a different binding of the same ingredients:

| Mode | Swipe seats | Placement seat scope | Who places |
|---|---|---|---|
| **Survival Race** | one per player, on their own slot | one shared seat, scope = every slot | one bot, shared by all (default); per-slot bots with one seed (alternate) |
| **Crossfire** | one per player, on their own slot | one seat per player, scope = one rotating target | the players themselves |
| **Single-player** | one, held by the player | the sole slot | one bot |

Placement behaviour falls out of **scope size**, not from a mode setting: a scope spanning several slots has to reconcile them, which is where the intersection ladder (D8) applies; a scope of one needs no reconciliation and the agent simply picks.

This also resolves the falsification test rather than deferring it. At N = 1 Survival Race is one swipe seat held by the player plus a placement seat scoped to their single slot — which is exactly today's 2048, with a bot placing tiles per swipe. If that needs a special case, the abstraction is wrong (Risks). Crossfire at N = 1 has no target to rotate through, so it requires N ≥ 2.

### D14. `Edge::Move` is renamed to `Edge::Swipe`

"Move" no longer names anything in the game model — a turn is an `Action` (D6) — while the edge carries a board-level swipe. Keeping the old name would overload a word the design has retired. The serialized kind tag is unchanged (still `0`), so `EdgeId` hashing is unaffected; the variant name and the JSON key change, which is why `graph-model` and `graph-rendering` are both listed as modified capabilities.

### D15. Every slot plays out, and terminated slots leave the scope

When the boards terminate on different rounds — which they almost always will — play continues on the live slots until *every* slot is terminated, and only then are players ranked by score. Ending a match at first termination would reward whoever happened to be ahead at an arbitrary moment rather than whoever survived longest, and "survival race" implies the latter.

A terminated slot leaves the placement seat's scope immediately. This needs no rule to enforce it: a terminated board is full, and a board with at least one tile and an empty cell always admits at least one slide, so termination implies no empty positions and `spawn_space` reports none (`board-actions`). Scope shrinkage falls out of the board's own reporting, which is the property D13 depends on.

The same shrinkage applies to the **round gate**. A terminated slot's swipe seat can never act again, so if it were still counted toward "every swipe seat has applied its action", the round would never complete and the surviving players would stop receiving placements — a deadlock in the most common late-game state. A swipe seat whose scope contains no live slot is therefore excluded from the round-completion condition, exactly as its slot left the spawn scope.

The same applies to Crossfire — a terminated slot is neither swiped by its owner nor targeted by anyone's rotation.

### D16. A match begins with a spawn, not a seeded tile

Creation inserts empty boards and the opening spawn obligation; resolving it is the game's first action. In Crossfire that is one obligation per player, resolved in seat order and each aimed at that player's first rotation target. Today `create_game` special-cases a single starting tile, which is a second code path for placing tiles. Starting from a spawn removes it: every tile in a match, including the first, arrives through the same policy — and every slot in a multi-board mode starts identical for free.

### D17. `Game<M>` is a generic wrapper; `AnyGame` is the single dispatch point

```rust
pub struct Game<M: GameMode> {
    pub id: GameId,
    pub history: Vec<Action>,
    pub mode: M,
}

pub enum AnyGame {
    Single(Game<Single>),
    Threes(Game<Threes>),
    Race(Game<Race>),
    Crossfire(Game<Crossfire>),
}
```

`Game` is a wrapper, not the mode: it holds identity and the command log, and delegates every mode operation to `M`, which implements `GameMode` directly — `Game::play` appends the action to `history`, then calls `mode.play`. So no mode method matches on a mode tag — the matching happens once, in `AnyGame`, where the heterogeneous `HashMap<GameId, AnyGame>` forces it. The enum's methods are the *verbs* the bridge calls, and each variant builds the shared `Action`:

```rust
impl AnyGame {
    fn seats(&self) -> &[Seat] { match self { /* one arm per variant, delegating */ } }
    fn candidates(&self, seat: SeatId, chosen: &[Pos]) -> Candidates { /* … */ }
    fn swipe(&mut self, graph: &mut GraphStore, seat: SeatId, dir: Direction)
        -> Result<(), GameError>;   // builds Action::Swipe, calls mode.play, records the report
    fn place(&mut self, graph: &mut GraphStore, seat: SeatId, cells: Vec<Cell>)
        -> Result<(), GameError>;
}
```

Those two verbs cover every mode: each builds an `Action` and calls `mode.play`; the mode resolves the target from the due obligation, or from the seat's scope when the obligation names none. Each arm receives a concrete `TurnReport<B>`, inserts its boards into the graph, applies the score deltas to the slots, and returns nothing type-erased. The bridge never names a mode-specific type, and no mode ever inspects which mode it is.

This is the composability seam. `Table<B>` composes the shared state; `BoardGame` is the board bound; `SpawnPolicy` and the target strategy are plain structs the modes hold; `GameMode` is the contract. A new mode is a new struct plus its `impl GameMode`, plus one `AnyGame` variant — no existing mode changes.

*Alternatives considered:* `Engine<M>` generic — rejected, one engine per mode, so an engine cannot hold a single-player game and a Race at once. `Box<dyn GameMode>` — rejected, an object-safe trait cannot have the associated `Board` type the design needs.

### D18. Threes is the second tile rule, and the first real test of the rule/mode split

A second rule is added now, not deferred, because the split's justification is otherwise unobservable. Threes differs from 2048 in four independent places, and each one lands on a different layer:

- **merge** — `1 + 2 = 3`, then equal tiles ≥ 3; 1+1 and 2+2 do not merge. → `MergeRule::merge`, board-side.
- **score** — a rarity table over the board, not the produced tile's face value. → `MergeRule::score_delta`, board-side.
- **value source** — a shuffled deck, not a weighted draw. → `Threes` mode state (`ThreesConfig.deck`).
- **placement** — the next card enters from the edge opposite the swipe, in a line the swipe actually changed. → `Threes` mode state (`EntryRule`).

The rule is a value (`Rule::Threes`), not a type, so the two cross combinations are reachable: `Single` + `Rule::Threes` is 2048 with Threes tiles, and `Threes` + `Rule::EqualTiles` is Threes with 2048 tiles. That is the composability claim made concrete.

`Threes` is still its own `GameMode` impl rather than `Single` with a flag: it holds a deck and an entry rule that `Single` has no business carrying. A new mode is a new struct and its `impl GameMode`, not a new branch in an existing mode.

`BoardId` includes the rule, so two boards with identical cells but different rules coexist in one graph without collision. The store remains mode-oblivious; it now knows boards and their rules, which is still board-level.

*Alternative considered:* two board types (`Board`, `ThreesBoard`). Rejected — it hard-codes one rule per type, so the two cross combinations need a duplicated board, and the grid operations are duplicated with it. A rule value plus one board gives the matrix for free.

## Risks / Trade-offs

- **The abstraction serves one mode and costs a lot.** → `Single` expressed as `Race` with scope 1 (D13) is the falsification test. If it needs a special case, the design is wrong and should be revisited before Survival Race is built on top of it.
- **Deferred obligation resolution makes the turn feel unresponsive** — after p1 swipes, nothing visibly lands until p2 acts. → Race's pending state waits on *other players*; Crossfire's waits on the acting player's own follow-up placement, which is a prompt, not a delay. For Race, this is the moment the graph is for: both spawns landing simultaneously is where divergence reveals itself. Both need an explicit pending state rather than silence.
- **Exported engine JSON gains fields and old exports stop deserializing.** → `Engine::version` already exists; bump it and reject or migrate older versions explicitly rather than failing on a parse error. The check must read the version from a staged parse *before* the graph — including `Edge` — is deserialized, and it must land with the first breaking change (the rename, migration step 3), not wait for step 9.
- **`crates/tui` and `crates/merge-cli` break against the decomposed API.** → `tui`'s whole game loop *is* `Engine::make_move`, so it must be ported to the mode-facing API. `merge-cli` never calls `make_move`, but it constructs `GameInstance` field by field and rebuilds `Engine` from parts — any per-game state added (mode, agents, obligations, policy) breaks it at compile time, and state it fails to carry would be **silently dropped** from merged exports. Both are named in the proposal's impact; verify in the task breakdown rather than assuming.
- **The fairness ledger can mask real asymmetry** if it compensates too eagerly. → Keep the ledger's effect visible: a compensation is itself a divergence event and should be marked as one, not silently absorbed.
- **Fixing `valid_swipes` changes `is_terminated` for some boards.** → It should not: emptiness is currently correct by accident. The equivalence test is the guard, and it should be written *before* the fix so the before/after behaviour is observed rather than assumed.
- **Spawn count rules change the feel drastically between grid sizes.** → Keep the rule explicit in the game config and visible to the player rather than buried in a default.
- **`SpawnPolicy` state must survive export/import.** → The policy is part of the serialized game state, same as the bot's seed. Anything affecting placement must be inside the exported payload.

## Migration Plan

1. `valid_swipes` property test, written first, then the fix — a simple bug, tracked in tasks. Independent of everything else; no API change.
2. Extract `Grid<T>` from `Board` and introduce `MergeRule`/`Rule::EqualTiles`. `Board` becomes `{ grid, rule }`, with `BoardGame` implemented once. `sample_spawn` splits into a board-side apply and an agent-side sample. `Engine::make_move` calls the new pieces internally and keeps its fused signature. No external contract change yet.
3. `Edge::Move` → `Edge::Swipe`, with the WASM payload and frontend updated together. `Engine::version` is bumped **here**, with a version check staged before the graph is deserialized, so pre-rename exports are rejected with a clear message instead of failing on a parse error.
4. `Agent` + seeded RNG, moved into serialized game state. New fields deserialize with defaults so step-2 exports still parse until the version gate rejects them. Export/import test asserts agent state round-trips.
5. `Game<M>` wrapper, `AnyGame`, and the `GameMode` impls — seats, slots, obligations explicit on the trait; the match opens with a spawn (D16). `Single` expressed as the scope-1 composition — the D13 falsification test.
6. Threes: `Rule::Threes`, the `Threes` mode, deck + entry rule, and the rule in `BoardId` — the second tile rule and the rule/mode split's proof (D18).
7. `SpawnPolicy`, the fairness ladder, and spawn-count rules — ceiling rounding, natural-log-scaled by empties.
8. Survival Race as a composition of the same parts — shared seat default, same-seed alternate.
9. Crossfire — immediate counterattack, target chosen by a declared strategy.
10. WASM bridge: `candidates` query, `makeMove` (swipe + drive automated seats), `applySpawn` (validated against the candidate set), and the `mode` + `rule` fields on create.

Rollback is per-step: steps 1–4 leave the external contract intact apart from step 3, where the rename is paired with the version bump and staged version check — old exports are rejected explicitly rather than mis-parsed. Steps 5–9 are internal until step 10 exposes them.

## Open Questions

**Resolved during spec writing (recorded for traceability, not open):**

- Match outcome — every slot plays out, then score decides; terminated slots leave the placement seat's scope. Now D15 and the `survival-race` / `crossfire` specs.
- Spawner ownership — Survival Race is one bot spanning all slots by default; Crossfire has each player spawning on a single rotating target. Now D13.
- Difficulty — match-wide by default, per-seat override allowed as an explicit handicap. Now the `agent` spec.
- Bots filling player seats — allowed; agents are replaceable by bots by definition. Now the `agent` spec.
- Who drives the bot — the engine drives every automated seat after each applied move; the agent's state is kept in the mode's `Table.agents` and serialized. Now D11/D17.
- Resolution timing — an option (`Immediate | EndOfRound`), not a mode constant; each mode ships a default. Now D7.
- Where score lives — on the slot, with the pending obligation; never on the content-addressed board. Now D12.
- Move shape — the shared `Action`, with the obligation resolving the target; `Targeted`/`Scoped` and the mode-associated `Move` were dropped. Now D6.
- Engine storage — `HashMap<GameId, AnyGame>`; `Game<M>` is a wrapper around the mode, and the enum is the only match on mode. Now D17.
- Second tile rule — Threes, with its own merge and score, and its own mode; the rule is a value so it composes with every mode. Now D18 and the `threes-board` spec.
- Capability — removed; a seat holds an agent and a scope, and the obligation carries the action kind. Now D3.
- Starting a match — no seeded tile; the opening spawn is the first action. Now D16.
- Spawn count — ceiling rounding, scaled by the natural logarithm of empty cells. Now D10.
- `SpawnSpace` — positions only; tile weights stay in the spawn configuration. Now the `board-actions` spec.

**Possible ways (todo, not blocking):**

- Crossfire's target selector: rotation ships as the default strategy; first-come-first-served — players claiming a target in the order they act — is an equally valid strategy. Swapping changes one requirement, not the design.
- Finer spawn-count rules (scaling with remaining life rather than empties) would drop into the same config slot.

**Deferrable without changing the specs, approach, or task breakdown:**

- Whether shortfall records in the ledger need a cap, or accumulate for the whole match.
