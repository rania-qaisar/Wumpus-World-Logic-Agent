/**
 * Propositional Logic Engine
 * Implements CNF conversion and Resolution Refutation
 * for the Wumpus World Knowledge Base
 */

// ─── Literal helpers ────────────────────────────────────────────────────────
export function negLit(lit) {
  return lit.startsWith('~') ? lit.slice(1) : '~' + lit;
}
export function isNeg(lit) { return lit.startsWith('~'); }
export function atom(lit)  { return isNeg(lit) ? lit.slice(1) : lit; }

// ─── Clause helpers (clause = Set of literals) ──────────────────────────────
function clauseKey(clause) {
  return [...clause].sort().join('|');
}

function clausesEqual(a, b) {
  if (a.size !== b.size) return false;
  for (const l of a) if (!b.has(l)) return false;
  return true;
}

// Resolve two clauses on a complementary literal pair.
// Returns the resolvent Set, or null if more than one pair found (invalid).
function resolve(c1, c2) {
  const resolvents = [];
  for (const lit of c1) {
    if (c2.has(negLit(lit))) resolvents.push(lit);
  }
  if (resolvents.length !== 1) return null;
  const pivot = resolvents[0];
  const result = new Set([...c1, ...c2]);
  result.delete(pivot);
  result.delete(negLit(pivot));
  return result;
}

// ─── CNF Representation ─────────────────────────────────────────────────────
// We represent KB as an array of Sets (clauses).

export class KnowledgeBase {
  constructor() {
    this.clauses = [];   // Array<Set<string>>
    this.log     = [];   // inference trace
    this.steps   = 0;
  }

  /**
   * TELL: Add facts / rules to the KB.
   * Accepts pre-CNF clause arrays (each inner array = a clause).
   * e.g. tell([['~B_1_1', 'P_1_2', 'P_2_1'], ['~P_1_2', 'B_1_1'], ['~P_2_1', 'B_1_1']])
   */
  tell(clauses) {
    for (const c of clauses) {
      const s = new Set(c);
      if (!this._hasClause(s)) {
        this.clauses.push(s);
      }
    }
  }

  /**
   * TELL a unit clause (a single known literal).
   */
  tellUnit(lit) {
    this.tell([[lit]]);
  }

  _hasClause(s) {
    return this.clauses.some(c => clausesEqual(c, s));
  }

  /**
   * ASK (Resolution Refutation):
   * Returns true if KB ⊨ query (a positive literal string).
   * Adds ~query to KB copy, tries to derive ⊥ via resolution.
   */
  ask(queryLit) {
    this.steps++;
    // Working set = KB clauses + negated goal
    const working = this.clauses.map(c => new Set(c));
    working.push(new Set([negLit(queryLit)]));

    const seen = new Set(working.map(clauseKey));
    let changed = true;

    while (changed) {
      changed = false;
      const n = working.length;
      for (let i = 0; i < n && changed === false; i++) {
        for (let j = i + 1; j < n && changed === false; j++) {
          const res = resolve(working[i], working[j]);
          if (res === null) continue;
          if (res.size === 0) {
            // Contradiction found — KB entails query
            this.log.push(`Resolution: proved ${queryLit} (contradiction in ${this.steps} steps)`);
            return true;
          }
          const rk = clauseKey(res);
          if (!seen.has(rk)) {
            seen.add(rk);
            working.push(res);
            changed = true;
          }
        }
      }
    }
    this.log.push(`Resolution: could not prove ${queryLit}`);
    return false;
  }

  clauseCount() { return this.clauses.length; }
}

// ─── KB Builder: Wumpus-specific CNF rules ───────────────────────────────────
/**
 * Given that cell (r,c) has no breeze and no stench, assert:
 *   ∀ neighbour n: ¬Pit_n ∧ ¬Wumpus_n
 */
export function tellNoBreezeNoStench(kb, r, c, neighbours) {
  kb.tellUnit(`~B_${r}_${c}`);
  kb.tellUnit(`~S_${r}_${c}`);
  for (const [nr, nc] of neighbours) {
    kb.tellUnit(`~P_${nr}_${nc}`);
    kb.tellUnit(`~W_${nr}_${nc}`);
  }
}

/**
 * Breeze at (r,c) ↔ at least one adjacent pit.
 * CNF:  (¬B ∨ P_n1 ∨ P_n2 ∨ …) ∧ (¬P_n1 ∨ B) ∧ (¬P_n2 ∨ B) ∧ …
 */
export function tellBreeze(kb, r, c, neighbours) {
  kb.tellUnit(`B_${r}_${c}`);
  const forward = [`~B_${r}_${c}`, ...neighbours.map(([nr,nc]) => `P_${nr}_${nc}`)];
  kb.tell([forward]);
  for (const [nr, nc] of neighbours) {
    kb.tell([[`~P_${nr}_${nc}`, `B_${r}_${c}`]]);
  }
}

/**
 * Stench at (r,c) ↔ at least one adjacent wumpus.
 */
export function tellStench(kb, r, c, neighbours) {
  kb.tellUnit(`S_${r}_${c}`);
  const forward = [`~S_${r}_${c}`, ...neighbours.map(([nr,nc]) => `W_${nr}_${nc}`)];
  kb.tell([forward]);
  for (const [nr, nc] of neighbours) {
    kb.tell([[`~W_${nr}_${nc}`, `S_${r}_${c}`]]);
  }
}
