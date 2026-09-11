import { describe, it, expect } from "vitest";
import { InitiativeSystem } from "../src/game/systems/InitiativeSystem";
import { RandomService } from "../src/game/systems/RandomService";

/**
 * Phase 13.5 (DECISIONS D-086 item 6, D-090): InitiativeSystem started as
 * "framework only," later given a real caller by D-175's
 * `WaveSystem.applyGroupInitiativeOrder` (see the module's own doc comment
 * and `tests/waveInitiative.test.ts`). These tests cover the pure roll math
 * on its own, same as any other system in this project.
 */

describe("InitiativeSystem.rollInitiative", () => {
  it("sorts candidates highest roll first", () => {
    const random = RandomService.fixed(10); // every d20 comes up 10
    const order = InitiativeSystem.rollInitiative(
      [
        { id: "a", bonus: 1 },
        { id: "b", bonus: 5 },
        { id: "c", bonus: 3 },
      ],
      random,
    );
    expect(order.map((e) => e.id)).toEqual(["b", "c", "a"]);
    expect(order[0].roll).toBe(15); // 10 + 5
  });

  it("breaks a tied total (equal bonus, same fixed roll) by id, so the order is always deterministic", () => {
    const random = RandomService.fixed(10);
    const order = InitiativeSystem.rollInitiative(
      [
        { id: "z", bonus: 2 },
        { id: "y", bonus: 2 },
      ],
      random,
    );
    expect(order.map((e) => e.id)).toEqual(["y", "z"]);
  });

  it("is a no-op on an empty candidate list", () => {
    expect(InitiativeSystem.rollInitiative([], RandomService.fixed(10))).toEqual([]);
  });
});
