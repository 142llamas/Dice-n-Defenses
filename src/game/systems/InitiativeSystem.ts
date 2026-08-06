import { RandomService } from "./RandomService";

/**
 * InitiativeSystem — Phase 13.5 (DECISIONS D-086 item 6, D-090). Built
 * "framework only," per Kevin's explicit scoping: this exists so a real
 * per-unit turn order is available "if we need it in the future," WITHOUT
 * rebuilding `TurnSystem`'s Player Phase/Enemy Phase block structure around
 * it. Nothing in `BattleScene` calls this yet — heroes still act as one
 * block, then enemies as one block, exactly as before this sub-phase.
 *
 * Deliberately entity-agnostic (like `CombatSystem`): it takes a plain
 * `{id, bonus}` list rather than importing `Hero`/`Enemy`, so it adds no new
 * fields to either entity until an actual consumer needs one.
 */

export interface InitiativeCandidate {
  id: string;
  /** This combatant's initiative bonus (SRD: a Dexterity modifier). */
  bonus: number;
}

export interface InitiativeEntry {
  id: string;
  roll: number;
}

export class InitiativeSystem {
  /**
   * Roll initiative (d20 + bonus) for every candidate and return them sorted
   * highest-to-lowest — the SRD turn order. Ties break on bonus (higher
   * first), then id, so the result is fully deterministic for a given set of
   * rolls (no two candidates ever compare as equal).
   */
  static rollInitiative(candidates: ReadonlyArray<InitiativeCandidate>, random: RandomService): InitiativeEntry[] {
    return candidates
      .map((c) => ({ id: c.id, roll: random.rollD20() + c.bonus, bonus: c.bonus }))
      .sort((a, b) => {
        if (b.roll !== a.roll) return b.roll - a.roll;
        if (b.bonus !== a.bonus) return b.bonus - a.bonus;
        return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
      })
      .map(({ id, roll }) => ({ id, roll }));
  }
}
