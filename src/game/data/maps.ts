import type { ParsedMap } from "./testMap";
import { TEST_MAP } from "./testMap";
import { EMBERFORD_MAP } from "./emberfordMap";
import { SALTMERE_MAP } from "./saltmereMap";
import { CAUSEWAY_MAP } from "./causewayMap";
import { DROWNING_VALE_MAP } from "./drowningValeMap";
import { CINDERFALL_RIFT_MAP } from "./cinderfallRiftMap";
import { FROSTBOUND_HOLLOW_MAP } from "./frostboundHollowMap";

/**
 * MAPS — a general-purpose "map id -> ParsedMap" registry (Phase 11.9,
 * D-071).
 *
 * `data/campaigns.ts` already has its own narrower `getCampaignMap` helper
 * (private `CAMPAIGN_MAPS`, only `EMBERFORD_MAP`/`SALTMERE_MAP` — the two
 * campaign maps). That helper is left exactly as-is (11.9's boundaries say
 * don't touch campaigns.ts's existing behavior). Free-play needs a THIRD map,
 * `TEST_MAP`, in the mix too, plus a lookup that doesn't imply "this is a
 * campaign" — so this is a small, separate, general registry rather than
 * widening `getCampaignMap`'s job. `BattleScene`'s free-play branch reads
 * `getMapById` from here; the classic and campaign paths are untouched and
 * keep using `TEST_MAP`/`getCampaignMap` directly, exactly as before.
 *
 * Phase 23 (D-114): four new maps join here, immediately playable via Free
 * Play with no campaign of their own needed (avoiding dead scaffolding) —
 * Shattered Causeway, The Drowning Vale, Cinderfall Rift, Frostbound Hollow.
 */
export const MAPS: Record<string, ParsedMap> = {
  [TEST_MAP.id]: TEST_MAP,
  [EMBERFORD_MAP.id]: EMBERFORD_MAP,
  [SALTMERE_MAP.id]: SALTMERE_MAP,
  [CAUSEWAY_MAP.id]: CAUSEWAY_MAP,
  [DROWNING_VALE_MAP.id]: DROWNING_VALE_MAP,
  [CINDERFALL_RIFT_MAP.id]: CINDERFALL_RIFT_MAP,
  [FROSTBOUND_HOLLOW_MAP.id]: FROSTBOUND_HOLLOW_MAP,
};

/** Look up any known map by id, throwing on an unknown id — matches `getEnemyDefinition`'s convention. */
export function getMapById(id: string): ParsedMap {
  const map = MAPS[id];
  if (!map) throw new Error(`Unknown map id "${id}".`);
  return map;
}
