import type { CharacterBuild } from "../systems/CharacterBuildSystem";

/**
 * Companion catalogue — engine scaffolding only (D-118), currently EMPTY.
 * `CAMPAIGN_STORY_DESIGN.md` §6 names six companions (Hollis Vane, Fenna
 * Duskwater, Isolde Varnhall, Tamsin Rourke, Dorian Wick, Sorrel Thane) and
 * their region relationships, but that content is a separate, not-yet-done
 * writing pass (see that doc's own "still open" §9) — deliberately not
 * authored here, same "declared, not yet consumed" treatment
 * `data/spriteManifest.ts` gave hero art.
 *
 * Per the design doc's own framing: "each companion is just a named
 * `HeroDefinition` with a preset starting build the player can keep
 * customizing after recruitment — this reuses the existing custom-build
 * hero system entirely." A `CompanionDefinition` is therefore a thin wrapper
 * around a `CharacterBuild` (the exact type `CharacterCreationScene`/
 * `CharacterBuildSystem.heroDefinitionFromBuild` already knows how to turn
 * into a playable `HeroDefinition`) plus the story metadata
 * `CompanionRosterSystem`/a future recruitment scene would need.
 *
 * To add a real companion later: add an entry to `COMPANIONS` with a real
 * `CharacterBuild` (any valid race/class/ability-score combination) and log
 * it in `CONTENT_SOURCES.md` as original content, per that folder's own
 * README — no engine code needs to change.
 */
export interface CompanionDefinition {
  id: string;
  name: string;
  /** A complete, valid starting build — the same shape a player-built hero uses. */
  build: CharacterBuild;
  /** True for the starting trio (in the party from Region 1 Ch1); false for the recruitable trio (join when their own region is reached). CAMPAIGN_STORY_DESIGN.md §6. */
  startsInParty: boolean;
  /** The region (campaign id) this companion is narratively tied to — their "homecoming" (starting trio) or recruitment region (recruitable trio). Undefined until regions have real ids of their own. */
  homeRegionId?: string;
}

export const COMPANIONS: CompanionDefinition[] = [];

/** Look up a companion, throwing on an unknown id — matches `getCampaignDefinition`'s convention. */
export function getCompanionDefinition(id: string): CompanionDefinition {
  const def = COMPANIONS.find((c) => c.id === id);
  if (!def) throw new Error(`Unknown companion id "${id}".`);
  return def;
}
