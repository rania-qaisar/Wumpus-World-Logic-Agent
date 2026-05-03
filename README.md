# Wumpus-World-Logic-Agent
A web-based Knowledge-Based Agent that navigates a Wumpus World-style grid using Propositional Logic and Resolution Refutation to deduce safe cells in real time.

Features
Dynamic grid sizing (3×3 up to 8×8)
Random Pit and Wumpus placement every episode
Propositional Logic Knowledge Base with CNF conversion
Resolution Refutation inference engine
Breeze / Stench / Glitter percept system
Step-by-step or auto-run exploration
Real-time metrics dashboard and live KB clause viewer
Color-coded grid visualization

How It Works
TELL — Agent updates the KB with percept-based biconditional rules converted to CNF
ASK — Resolution Refutation adds ¬query to the KB and derives ⊥ to prove a cell is safe
Move — Agent always prefers resolution-proven safe cells over risky frontier cells
How to Use
ActionHowSet grid sizeRows / Cols dropdownsSet pit densityPit % sliderNew worldClick New WorldStep onceClick StepAuto-runClick ▶ RunView KBClick ▸ Show KB Clauses

Author
Rania
