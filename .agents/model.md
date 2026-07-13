# 2048 Game Graph Model

## Core Types

### Board
Board := { dim:(rows, cols), grid:Array[rows][cols] of u32 }

### Node
Node := { nodeId, board:Board }

### Edge

Edge := { from:NodeId, to:NodeId, kind:EdgeKind }
EdgeKind := Move{ direction:Direction } | Spawn{ cells:Set<(r,c,u32)> }
Direction := Up | Down | Left | Right

### GameInstance
GameInstance := { sourceNodeId, currentNodeId, score:u64, isTerminated:bool }

### GraphDelta
GraphDelta := { isTerminated:bool, nodes?:Vec<Node>, edges?:Vec<Edge>, currentNodeId?:NodeId, scoreDelta?:u64 }

### Graph
Graph := { nodes:Map<BoardHash, Node>, edges:Vec<Edge> }

### Configuration

SpawnConfig := { spawns:Vec<(value:u32, probability:f64)> }
GameConfig := { boardDim:(rows, cols), spawnConfig:SpawnConfig }

---

## Graph Semantics

- Nodes represent unique board states (enforced via deduplication)
- Edges represent atomic transitions: moves followed by spawns
- Convergence: Multiple move sequences leading to the same board state converge to a single node
- DAG Property: No cycles; a board state cannot be revisited once left behind
- Termination: A node is terminal if no valid moves exist from its board state

---

## Transition Logic (extend_path)

Input: GameInstance G, Direction d, GameConfig config

Output: (GameInstance G', GraphDelta Δ)

### Case 1: Game Already Terminated
if G.isTerminated:
  return (G, Δ{ isTerminated: true })

### Case 2: Invalid Move
if ¬valid_move(board(G.currentNodeId), d):
  return (G, Δ{ isTerminated: G.isTerminated })

### Case 3: Valid Move
1. Bm = apply_merge(board(G.currentNodeId), d)
2. ms = merge_score(board(G.currentNodeId), d)
3. n1 = nodes.get_or_create(Bm)
4. spawned_cells = sample_spawn(Bm, config.spawnConfig)
5. Bn = apply_spawn(Bm, spawned_cells)
6. n2 = nodes.get_or_create(Bn)
7. canTerminate = ¬∃d' ∈ {Up, Down, Left, Right} : valid_move(Bn, d')
8. G' = GameInstance{ sourceNodeId: G.sourceNodeId, currentNodeId: n2, score: G.score + ms, isTerminated: canTerminate }
9. Δ = GraphDelta{ isTerminated: canTerminate, nodes: [n1, n2] \ existing_nodes, edges: [Edge{ from: G.currentNodeId, to: n1, kind: Move{d} }, Edge{ from: n1, to: n2, kind: Spawn{spawned_cells} }], currentNodeId: n2, scoreDelta: ms }
10. return (G', Δ)

---

## Key Constraints

- Valid Move: A move in direction d is valid iff apply_merge(board, d) ≠ board
- Deterministic Spawn: Given a board and SpawnConfig, valid spawn outcomes are deterministic; the actual outcome is random but bounded
- Node Deduplication: No two nodes have identical board states
- Termination Check: Performed after both merge and spawn
- Score Delta: Only merge operations contribute to score; spawns do not
- Configurable Dimensions: Board size is specified in GameConfig and may vary (not limited to 4×4)
