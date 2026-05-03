# Wumpus-World-Logic-Agent

A web-based Knowledge-Based Agent that navigates a Wumpus World-style grid using Propositional Logic and Resolution Refutation to deduce safe cells in real time.

## Features
- Dynamic grid sizing (3×3 up to 8×8)
- Random Pit and Wumpus placement every episode
- Propositional Logic Knowledge Base with CNF conversion
- Resolution Refutation inference engine
- Breeze / Stench / Glitter percept system
- Step-by-step or auto-run exploration
- Real-time metrics dashboard and live KB clause viewer
- Color-coded grid visualization

## How It Works
1. **TELL** — Agent updates the KB with percept-based biconditional rules converted to CNF
2. **ASK** — Resolution Refutation adds ¬query to the KB and derives ⊥ to prove a cell is safe
3. **Move** — Agent always prefers resolution-proven safe cells over risky frontier cells

## How to Use

| Action | How |
|---|---|
| Set grid size | Rows / Cols dropdowns |
| Set pit density | Pit % slider |
| New world | Click **New World** |
| Step once | Click **Step** |
| Auto-run | Click **▶ Run** |
| View KB | Click **▸ Show KB Clauses** |

## Author
**Rania Qaisar**
