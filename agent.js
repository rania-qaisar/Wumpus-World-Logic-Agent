import {
  KnowledgeBase,
  tellNoBreezeNoStench,
  tellBreeze,
  tellStench,
} from './logic.js';

// ─── Cell states ─────────────────────────────────────────────────────────────
export const CellState = {
  UNKNOWN:  'unknown',
  SAFE:     'safe',
  VISITED:  'visited',
  DANGER:   'danger',
  AGENT:    'agent',
};

// ─── World generator ──────────────────────────────────────────────────────────
export function generateWorld(rows, cols, pitProb = 0.15) {
  const cells = Array.from({ length: rows }, (_, r) =>
    Array.from({ length: cols }, (_, c) => ({
      pit:    false,
      wumpus: false,
      gold:   false,
      r, c,
    }))
  );

  // Start cell [rows-1][0] is always safe
  const start = { r: rows - 1, c: 0 };

  // Place pits
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (r === start.r && c === start.c) continue;
      if (Math.random() < pitProb) cells[r][c].pit = true;
    }
  }

  // Place wumpus (not on start, not on pit)
  let placed = false;
  let attempts = 0;
  while (!placed && attempts < 200) {
    attempts++;
    const wr = Math.floor(Math.random() * rows);
    const wc = Math.floor(Math.random() * cols);
    if ((wr === start.r && wc === start.c) || cells[wr][wc].pit) continue;
    cells[wr][wc].wumpus = true;
    placed = true;
  }

  // Place gold (not on start, not on pit/wumpus)
  attempts = 0;
  placed = false;
  while (!placed && attempts < 200) {
    attempts++;
    const gr = Math.floor(Math.random() * rows);
    const gc = Math.floor(Math.random() * cols);
    if ((gr === start.r && gc === start.c) || cells[gr][gc].pit || cells[gr][gc].wumpus) continue;
    cells[gr][gc].gold = true;
    placed = true;
  }

  return { cells, rows, cols, start };
}

// ─── Neighbour helper ─────────────────────────────────────────────────────────
export function getNeighbours(r, c, rows, cols) {
  const nb = [];
  if (r > 0)        nb.push([r - 1, c]);
  if (r < rows - 1) nb.push([r + 1, c]);
  if (c > 0)        nb.push([r, c - 1]);
  if (c < cols - 1) nb.push([r, c + 1]);
  return nb;
}

// ─── Agent ───────────────────────────────────────────────────────────────────
export class WumpusAgent {
  constructor(world) {
    this.world    = world;
    this.kb       = new KnowledgeBase();
    this.r        = world.start.r;
    this.c        = world.start.c;
    this.alive    = true;
    this.won      = false;
    this.hasGold  = false;

    // Cell knowledge maps
    this.visited  = new Set();          // "r,c"
    this.safeSet  = new Set();          // proven safe by resolution
    this.dangerSet= new Set();          // confirmed danger
    this.frontier = [];                 // [r,c] pairs to explore
    this.inferenceSteps = 0;
    this.actionLog = [];

    // Mark start
    this.safeSet.add(this._key(this.r, this.c));
    this._enterCell(this.r, this.c);
  }

  _key(r, c) { return `${r},${c}`; }
  _unkey(k)  { const [r,c]=k.split(','); return [+r,+c]; }

  // Percepts at current cell
  _percepts(r, c) {
    const nb = getNeighbours(r, c, this.world.rows, this.world.cols);
    const breeze = nb.some(([nr,nc]) => this.world.cells[nr][nc].pit);
    const stench = nb.some(([nr,nc]) => this.world.cells[nr][nc].wumpus);
    const glitter = this.world.cells[r][c].gold;
    const bump   = false;
    const scream  = false;
    return { breeze, stench, glitter, bump, scream };
  }

  // Enter a cell, update KB with percepts
  _enterCell(r, c) {
    const k = this._key(r, c);
    this.visited.add(k);
    const nb = getNeighbours(r, c, this.world.rows, this.world.cols);
    const { breeze, stench, glitter } = this._percepts(r, c);

    if (glitter && !this.hasGold) {
      this.hasGold = true;
      this._log(`🪙 Gold found at [${r},${c}]!`);
    }

    if (!breeze && !stench) {
      tellNoBreezeNoStench(this.kb, r, c, nb);
      // All unvisited neighbours are safe
      for (const [nr,nc] of nb) {
        const nk = this._key(nr, nc);
        if (!this.visited.has(nk)) {
          this.safeSet.add(nk);
          this._addFrontier(nr, nc);
        }
      }
      this._log(`[${r},${c}] Clear — all ${nb.length} neighbours proven safe`);
    } else {
      if (breeze) {
        tellBreeze(this.kb, r, c, nb);
        this._log(`[${r},${c}] 💨 Breeze — pit nearby`);
      }
      if (stench) {
        tellStench(this.kb, r, c, nb);
        this._log(`[${r},${c}] 💀 Stench — wumpus nearby`);
      }
      // Add unknown neighbours to frontier cautiously
      for (const [nr,nc] of nb) {
        const nk = this._key(nr, nc);
        if (!this.visited.has(nk) && !this.safeSet.has(nk)) {
          this._addFrontier(nr, nc);
        }
      }
    }
    this.inferenceSteps++;
  }

  _addFrontier(r, c) {
    const k = this._key(r, c);
    if (!this.frontier.some(([fr,fc]) => this._key(fr,fc) === k)) {
      this.frontier.push([r, c]);
    }
  }

  _log(msg) { this.actionLog.push(msg); }

  // Resolution query: is cell (r,c) safe?
  _askSafe(r, c) {
    this.inferenceSteps++;
    const pitSafe    = this.kb.ask(`~P_${r}_${c}`);
    const wumpusSafe = this.kb.ask(`~W_${r}_${c}`);
    return pitSafe && wumpusSafe;
  }

  // One step of the agent loop
  step() {
    if (!this.alive || this.won) return false;
    if (this.frontier.length === 0) {
      this._log('No frontier left — exploration complete.');
      return false;
    }

    // Partition frontier into proven-safe and risky
    const provenSafe = [];
    const risky      = [];

    for (const [fr,fc] of this.frontier) {
      const fk = this._key(fr,fc);
      if (this.safeSet.has(fk) || this._askSafe(fr,fc)) {
        this.safeSet.add(fk);
        provenSafe.push([fr,fc]);
      } else {
        risky.push([fr,fc]);
      }
    }

    let chosen, safe;
    if (provenSafe.length > 0) {
      chosen = provenSafe[0];
      safe   = true;
    } else if (risky.length > 0) {
      // No proven-safe cell — pick least risky (heuristic: fewest danger neighbours)
      chosen = risky[0];
      safe   = false;
      this._log(`⚠ No proven-safe frontier. Moving cautiously to [${chosen[0]},${chosen[1]}].`);
    } else {
      return false;
    }

    // Remove from frontier
    this.frontier = this.frontier.filter(
      ([fr,fc]) => !(fr===chosen[0] && fc===chosen[1])
    );

    // Move agent
    this.r = chosen[0];
    this.c = chosen[1];
    const cell = this.world.cells[this.r][this.c];

    if (cell.pit) {
      this.alive = false;
      this.dangerSet.add(this._key(this.r, this.c));
      this._log(`☠ Fell into pit at [${this.r},${this.c}]! Game over.`);
      return false;
    }
    if (cell.wumpus) {
      this.alive = false;
      this.dangerSet.add(this._key(this.r, this.c));
      this._log(`☠ Eaten by Wumpus at [${this.r},${this.c}]! Game over.`);
      return false;
    }

    if (safe) this._log(`✔ Resolution proved [${this.r},${this.c}] safe — moving.`);
    this._enterCell(this.r, this.c);
    return true;
  }

  // Snapshot for rendering
  snapshot() {
    const { rows, cols, cells } = this.world;
    const grid = [];

    for (let r = 0; r < rows; r++) {
      const row = [];
      for (let c = 0; c < cols; c++) {
        const k = this._key(r, c);
        let state = CellState.UNKNOWN;
        if (!this.alive && this.dangerSet.has(k)) state = CellState.DANGER;
        else if (r === this.r && c === this.c && this.alive) state = CellState.AGENT;
        else if (this.visited.has(k))  state = CellState.VISITED;
        else if (this.safeSet.has(k))  state = CellState.SAFE;
        else if (this.dangerSet.has(k))state = CellState.DANGER;

        const { breeze, stench } = this._percepts(r, c);
        // Only reveal percepts for visited cells
        const revealPercept = this.visited.has(k);

        row.push({
          r, c, state,
          pit:    cells[r][c].pit,
          wumpus: cells[r][c].wumpus,
          gold:   cells[r][c].gold,
          breeze: revealPercept ? breeze : false,
          stench: revealPercept ? stench : false,
          isStart: r === this.world.start.r && c === this.world.start.c,
          visited: this.visited.has(k),
        });
      }
      grid.push(row);
    }

    return {
      grid,
      agentR: this.r,
      agentC: this.c,
      alive:  this.alive,
      won:    this.won || this.hasGold,
      inferenceSteps: this.inferenceSteps,
      kbSteps:    this.kb.steps,
      clauseCount: this.kb.clauseCount(),
      visitedCount: this.visited.size,
      log:    [...this.actionLog],
      percepts: this._percepts(this.r, this.c),
    };
  }
}
