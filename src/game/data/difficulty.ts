/**
 * Difficulty tiers — Phase 11.4 (D-071, D-077): "flat-multiplier Easy/Normal/
 * Hard/Nightmare tiers." Real tuning is deferred to Kevin's in-browser play,
 * same as every other balance number in this project (KI-015/KI-022/KI-028) —
 * these starting multipliers are a first pass, not a tuned result.
 *
 * A second multiplier source, party-size scaling, lives alongside these: the
 * game's wave data was authored and balanced around a FOUR-hero party
 * (D-052/D-070), so a smaller freeform party fights proportionally
 * fewer/weaker enemies and a larger one (once maps support it — see D-071's
 * 11.7) would face proportionally more. `WaveSystem` combines both
 * multipliers (see `BattleScene`'s WaveSystem construction) — this file only
 * defines them.
 *
 * Phase 13.4 (D-088): each tier also carries a per-run Rest-charge budget
 * (`shortRestCharges`/`longRestCharges`, consumed by the new `RestSystem`) —
 * fewer charges at a harder tier, the same "harder = less recovery" lever
 * the enemy multipliers above already pull, first-pass/untuned like them.
 * A battle reached with no explicit difficulty (e.g. Co-op) always resolves
 * to `"normal"` (see `BattleScene`'s `difficultyId` default), so it always
 * gets this tier's Rest budget too.
 *
 * D-194: one more per-tier number, CAMPAIGN MODE ONLY (never read by Free
 * Play/manual Create Party, which stays fully free-pick per D-193) —
 * `companionDiscretionaryGearSlots` (how many of a campaign companion's
 * non-essential gear slots survive at this tier). Same first-pass/untuned
 * standing as every other number on this file. (A sibling field,
 * `startingGearPoints` — the campaign PC's point-buy budget — existed here
 * too until `CAMPAIGN_ECONOMY_REDESIGN_PLAN.md` Plan 5, D-246, retired it
 * in favor of a fixed per-class starting kit; see
 * `data/characterCreation.ts`'s `defaultStartingGearForClass`.)
 *
 * D-217 (item 3b): the threat-budget fields below (`eliteFraction` through
 * `cadenceMultiplier`) are the difficulty side of the progression redesign —
 * Difficulty no longer touches character level/XP at all (that's now
 * `LevelMilestoneSystem`'s job, driven by Run Length/campaign data, not
 * Difficulty); it only shapes enemy-wave PRESSURE, via
 * `systems/ThreatBudgetSystem.ts`. Same first-pass/untuned standing as
 * every other number on this file — Kevin tunes these in-browser.
 *
 * `CAMPAIGN_ECONOMY_REDESIGN_PLAN.md` Plan 1: two more CAMPAIGN-MODE-ONLY
 * fields, `startingCampaignGold` (a one-time starting kit budget, granted
 * once before Chapter 2 — see `CampaignArmoryScene`) and
 * `campaignGoldMultiplier` (a general "harder = more scarce" lever for gold
 * credited into `CampaignGoldSystem` during a run — kill/wave/region-bonus
 * gold, wired up by Plan 2/D-244).
 *
 * Plan 6 (D-247) is this doc's real tuning pass on `campaignGoldMultiplier`
 * — found via a first-pass numeric analysis (no in-browser playtest existed
 * yet, same standing every other number here carries) that the un-tuned
 * D-242 defaults let a Normal-difficulty player likely afford most of the
 * rare/veryRare gear ladder well before the mandatory campaign's missions
 * end (24/~21 at the time of this analysis, pre-D-253's 19-mandatory-chapter
 * restructure — the counts moved, the underlying gold-scarcity concern
 * didn't), because `ShopSystem.RARITY_LEVEL_THRESHOLD` unlocks EVERY rarity
 * tier by ~chapter 3 of the very FIRST region — gold, not level, is what
 * actually needs to gate late-campaign gear for most of the campaign.
 * D-242 had pinned Normal's multiplier to exactly 1.0 to match every other
 * Normal-tier lever (`enemyCountMultiplier`/`enemyHpMultiplier`/
 * `cadenceMultiplier` are all 1.0 there too) — confirmed with Kevin that
 * breaking that convention specifically for this lever is fine, since
 * Normal is the difficulty most players will actually pick, and leaving it
 * unscaled would leave the actual concern unaddressed for most players.
 * The tier-to-tier SHAPE is otherwise preserved (each step is still roughly
 * a quarter of Easy's value apart), only the absolute scale moved. See
 * `tests/difficulty.test.ts`'s own updated assertion for this.
 */

export type DifficultyId = "easy" | "normal" | "hard" | "nightmare";

export interface DifficultyDefinition {
  id: DifficultyId;
  name: string;
  /** Multiplies each wave's per-group enemy spawn count (rounded, min 1). */
  enemyCountMultiplier: number;
  /** Multiplies every enemy's max HP (rounded, min 1). */
  enemyHpMultiplier: number;
  /** Phase 13.4 (D-088): per-run Short Rest charges (see `RestSystem`). */
  shortRestCharges: number;
  /** Phase 13.4 (D-088): per-run Long Rest charges — a much smaller pool, per D-086. */
  longRestCharges: number;
  /** D-194: campaign mode only — how many of a companion's discretionary gear slots (chest, then shield) survive at this tier; weapon and a caster's implement always survive regardless. See `companionStartingGearForDifficulty`. */
  companionDiscretionaryGearSlots: number;
  /** D-217: fraction of a scaled group's count converted to stat-boosted "elite" instances instead of regular ones (see `ThreatBudgetSystem`). */
  eliteFraction: number;
  /** D-217: hard ceiling on `eliteFraction` regardless of any future scaling — a safeguard against a disproportionate all-elite group. */
  eliteFractionCap: number;
  /** D-217: stat multiplier applied to an elite-flagged spawn instance, relative to the regular baseline. */
  eliteStatMultiplier: { hp: number; damage: number };
  /** D-217: chance (0-1) `ThreatBudgetSystem` adds one extra simultaneous spawn lane to a wave. */
  extraLaneChance: number;
  /** D-217: hard ceiling on distinct simultaneous spawn lanes a wave can have — a safeguard against unreadable spawn chaos. */
  maxSimultaneousLanes: number;
  /** D-217: multiplies each spawn group's `intervalTurns` — the primary "intensity, not duration" lever for harder tiers (`startTurn`/`turnLimit` are never touched by difficulty). */
  cadenceMultiplier: number;
  /** `CAMPAIGN_ECONOMY_REDESIGN_PLAN.md` Plan 1: campaign mode only — a flat persistent-gold starting kit budget, granted once at the first between-missions Armory visit (see `CampaignArmoryScene`/`CampaignGoldSystem`). */
  startingCampaignGold: number;
  /** `CAMPAIGN_ECONOMY_REDESIGN_PLAN.md` Plan 1/2: campaign mode only — multiplies gold credited into the persistent `CampaignGoldSystem` pool (kill/wave/region-bonus gold, wired by D-244). Plan 6 (D-247) is this file's real tuning pass on these values — see the module header comment above. */
  campaignGoldMultiplier: number;
}

export const DIFFICULTY_IDS: DifficultyId[] = ["easy", "normal", "hard", "nightmare"];

export const DIFFICULTY_DEFINITIONS: Record<DifficultyId, DifficultyDefinition> = {
  easy: {
    id: "easy",
    name: "Easy",
    enemyCountMultiplier: 0.75,
    enemyHpMultiplier: 0.85,
    shortRestCharges: 4,
    longRestCharges: 2,
    companionDiscretionaryGearSlots: 2,
    eliteFraction: 0.05,
    eliteFractionCap: 0.15,
    eliteStatMultiplier: { hp: 1.3, damage: 1.2 },
    extraLaneChance: 0,
    maxSimultaneousLanes: 1,
    cadenceMultiplier: 1.15,
    startingCampaignGold: 90,
    campaignGoldMultiplier: 0.65,
  },
  normal: {
    id: "normal",
    name: "Normal",
    enemyCountMultiplier: 1,
    enemyHpMultiplier: 1,
    shortRestCharges: 3,
    longRestCharges: 1,
    companionDiscretionaryGearSlots: 2,
    eliteFraction: 0.1,
    eliteFractionCap: 0.25,
    eliteStatMultiplier: { hp: 1.4, damage: 1.25 },
    extraLaneChance: 0.1,
    maxSimultaneousLanes: 2,
    cadenceMultiplier: 1,
    startingCampaignGold: 70,
    campaignGoldMultiplier: 0.5,
  },
  hard: {
    id: "hard",
    name: "Hard",
    enemyCountMultiplier: 1.25,
    enemyHpMultiplier: 1.15,
    shortRestCharges: 2,
    longRestCharges: 1,
    companionDiscretionaryGearSlots: 1,
    eliteFraction: 0.2,
    eliteFractionCap: 0.35,
    eliteStatMultiplier: { hp: 1.5, damage: 1.3 },
    extraLaneChance: 0.25,
    maxSimultaneousLanes: 2,
    cadenceMultiplier: 0.85,
    startingCampaignGold: 50,
    campaignGoldMultiplier: 0.4,
  },
  nightmare: {
    id: "nightmare",
    name: "Nightmare",
    enemyCountMultiplier: 1.5,
    enemyHpMultiplier: 1.35,
    shortRestCharges: 1,
    longRestCharges: 0,
    companionDiscretionaryGearSlots: 0,
    eliteFraction: 0.3,
    eliteFractionCap: 0.5,
    eliteStatMultiplier: { hp: 1.6, damage: 1.4 },
    extraLaneChance: 0.4,
    maxSimultaneousLanes: 3,
    cadenceMultiplier: 0.7,
    startingCampaignGold: 30,
    campaignGoldMultiplier: 0.25,
  },
};

export function getDifficultyDefinition(id: DifficultyId): DifficultyDefinition {
  return DIFFICULTY_DEFINITIONS[id];
}

/** D-16x: one-line summary for a Difficulty picker option — every scene that used to cycle through this list independently (Character Creation, Free Play, Browse Shared Maps) now shares this text. */
export function difficultyChoiceDescription(id: DifficultyId): string {
  const d = getDifficultyDefinition(id);
  const rests = `${d.shortRestCharges} short / ${d.longRestCharges} long rest${d.longRestCharges === 1 ? "" : "s"} per run`;
  return `Enemies ×${d.enemyCountMultiplier} count, ×${d.enemyHpMultiplier} HP · ${rests}`;
}

/** The party size the game's wave data is balanced around (the classic fixed roster). */
export const BALANCED_PARTY_SIZE = 4;

/**
 * How much to scale enemy count/HP for a party smaller (or, in the future,
 * larger) than the balanced size — linear against `BALANCED_PARTY_SIZE`, so a
 * solo hero faces a quarter of a full party's opposition. Combines
 * multiplicatively with the difficulty tier's own multiplier.
 */
export function partySizeScalingFactor(partySize: number): number {
  return partySize / BALANCED_PARTY_SIZE;
}
