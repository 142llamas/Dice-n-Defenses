# Content Sources

Tracks the source and license of every asset and every piece of rules content
that is not original to this project. Required by the Source of Truth's IP and
content guardrails.

| Content name | Source | License | Attribution required | Modified? | Where used |
| ------------ | ------ | ------- | -------------------- | --------- | ---------- |
| Six ability scores (STR/DEX/CON/INT/WIS/CHA) and the modifier formula `floor((score-10)/2)` | SRD 5.2.1 | CC BY 4.0 | Yes, before public release | No | `src/game/data/abilityScores.ts` |
| Proficiency bonus by level (+2 at 1-4, +1 every 4 levels, capped at +6) | SRD 5.2.1 | CC BY 4.0 | Yes, before public release | No | `src/game/systems/CharacterSystem.ts` |
| Fighter class: name, d10 hit die, STR/CON saving throw proficiencies, Extra Attack levels (5/11/20), and feature names/levels (Fighting Style, Second Wind, Action Surge, Martial Archetype, Ability Score Improvement, Indomitable) | SRD 5.2.1 | CC BY 4.0 | Yes, before public release | Feature DESCRIPTIONS are original wording, not copied SRD text; several features are recorded as data only and are inert in this game today (see `data/classes.ts`) | `src/game/data/classes.ts` |
| Wizard class: name, d6 hit die, INT/WIS saving throw proficiencies, INT casting ability, cantrips-known and spell-slots-by-level tables, and feature names/levels (Spellcasting, Arcane Tradition, Ability Score Improvement, Spell Mastery, Signature Spells) | SRD 5.2.1 | CC BY 4.0 | Yes, before public release | Feature DESCRIPTIONS are original wording, not copied SRD text; only Spellcasting is mechanically active today (see `data/classes.ts`) | `src/game/data/classes.ts` |
| Curated spell list: names, spell level (cantrip/1st), and school for Fire Bolt, Ray of Frost, Magic Missile, Burning Hands, Mage Armor | SRD 5.2.1 | CC BY 4.0 | Yes, before public release | Descriptions and all game numbers (damage, effects) are original, not copied SRD spell text; Magic Missile is castable as of Phase 13.7 (D-092, costs a spell slot); Burning Hands/Mage Armor remain data-only (no AoE-spell/self-buff mechanic to hook them into) | `src/game/data/spells.ts` |
| Rogue class: name, d8 hit die, DEX/INT saving throw proficiencies, and feature names/levels (Expertise, Sneak Attack, Cunning Action, Roguish Archetype, Uncanny Dodge, Evasion, Reliable Talent, Blindsense, Slippery Mind, Elusive, Stroke of Luck) | SRD 5.2.1 | CC BY 4.0 | Yes, before public release | Feature DESCRIPTIONS are original wording, not copied SRD text; Sneak Attack's flat per-level damage numbers are an original diceless conversion of the SRD's "Nd6" progression | `src/game/data/classes.ts` |
| Cleric class: name, d8 hit die, WIS/CHA saving throw proficiencies, WIS casting ability, and feature names/levels (Spellcasting, Divine Domain, Channel Divinity, Destroy Undead, Divine Intervention, Ability Score Improvement) | SRD 5.2.1 | CC BY 4.0 | Yes, before public release | Feature DESCRIPTIONS are original wording, not copied SRD text; shares the Wizard's cantrips-known/spell-slot tables (already logged above) | `src/game/data/classes.ts` |
| Cleric's curated spells: names, spell level, and school for Sacred Flame, Guidance, Cure Wounds, Bless, Shield of Faith | SRD 5.2.1 | CC BY 4.0 | Yes, before public release | Descriptions and all game numbers are original, not copied SRD spell text; Cure Wounds is castable as of Phase 13.7 (D-092, this game's first ally-targeted effect, costs a spell slot); Guidance/Bless/Shield of Faith remain data-only (no skill-check/ally-buff mechanic to hook them into) | `src/game/data/spells.ts` |
| Four starter races (Human, Elf, Dwarf, Halfling): names, the 25ft-vs-30ft speed split, and named trait titles (Darkvision, Fey Ancestry, Keen Senses, Dwarven Resilience, Stonecunning, Lucky, Brave, Halfling Nimbleness, Resourceful) | SRD 5.2.1 | CC BY 4.0 | Yes, before public release | Trait DESCRIPTIONS are original wording, not copied SRD text; only speed (mapped to tiles) is mechanically active today; **correction (D-170, KI-098 item 6)**: this row originally also listed Half-Elf/Half-Orc under SRD 5.2.1 and claimed the 25ft/30ft speed split was 5.2.1's own rule — a verification pass against the real SRD 5.2.1 species chapter found SRD 5.2.1 actually gives every species 30ft and dropped Half-Elf/Half-Orc as species entirely (see the next row and `data/races.ts`'s own module comment); no game data changed, attribution only | `src/game/data/races.ts` |
| Half-Elf and Half-Orc (names and named trait titles: Fey Ancestry, Skill Versatility, Relentless Endurance, Savage Attacks) — SRD 5.1 (2014) species, not present in SRD 5.2.1 at all | SRD 5.1 | CC BY 4.0 (also usable under OGL 1.0a) | Yes, before public release | Trait DESCRIPTIONS are original wording, not copied SRD text; both kept at the standard 30ft/3-tile speed, matching their real SRD 5.1 value | `src/game/data/races.ts` |
| Five more real SRD 5.2.1 species (Dragonborn, Gnome, Goliath, Orc, Tiefling): names, speed (all 30ft in SRD 5.2.1, Goliath's real 35ft flattened to the same 3-tile standard — no faster tile tier exists), and named trait titles (Draconic Ancestry, Breath Weapon, Damage Resistance, Draconic Flight, Gnomish Cunning, Gnomish Lineage, Giant Ancestry, Large Form, Powerful Build, Adrenaline Rush, Relentless Endurance, Fiendish Legacy, Otherworldly Presence, plus Darkvision, shared with several races above) | SRD 5.2.1 | CC BY 4.0 | Yes, before public release | Trait DESCRIPTIONS are original wording, not copied SRD text; every trait is inert (D-170, KI-098 item 6 — "pure content, no system work") | `src/game/data/races.ts` |
| Alert (name and general effect: proficiency-bonus-to-initiative/swap-initiative-with-an-ally) | SRD 5.2.1 | CC BY 4.0 | Yes, before public release | Description is original wording, not copied SRD text; inert (no per-unit-initiative system to hook into) (see `data/feats.ts`) | `src/game/data/feats.ts` |
| Tough, Lucky, Athlete (names and their classic PHB effect) | **NOT SRD content** — corrected Phase 18 (D-109) | N/A — original | N/A | Phase 11.3 (D-075) mistakenly logged these three as SRD 5.2.1. A Phase 18 verification pass against the actual SRD 5.2.1 PDF found the real SRD Feats chapter has only 17 entries, and these three are PHB-exclusive, not in the free document. Kevin's call: keep the already-shipped, balanced, tested mechanics as-is (Tough +2 HP/level, Lucky's reroll pool, Athlete inert) but stop claiming SRD sourcing — treat them as original content inspired by common tabletop feat concepts, same standing every other from-scratch balance number in this project already has | `src/game/data/feats.ts` |
| 13 more feats verified against the real SRD 5.2.1 Feats chapter (Magic Initiate, Savage Attacker, Skilled — Origin; Grappler — General; Archery/Defense/Great Weapon Fighting/Two-Weapon Fighting — Fighting Style; Boon of Combat Prowess/Dimensional Travel/Fate/Irresistible Offense/Spell Recall/the Night Spirit/Truesight — Epic Boon): names, categories, prerequisites, and general classic effect | SRD 5.2.1 | CC BY 4.0 | Yes, before public release | Descriptions are original wording, not copied SRD text; dice-based SRD mechanics (Savage Attacker's reroll, Great Weapon Fighting's reroll-1s-and-2s) become flat bonus numbers — this game's damage model has no dice to reroll (same diceless-conversion treatment as Sneak Attack/Colossus Slayer); Skilled and 3 Epic Boons (Dimensional Travel/the Night Spirit/Truesight) stay honestly inert (no skill-proficiency, reposition-after-acting, or lighting/invisibility-detection system exists); Two-Weapon Fighting was inert at first for the same "no dual-wielding" reason, but Phase 19 (D-110) built that system — see the new row below; Epic Boons are real content gated at level 19+ but practically unreachable in this game's current run lengths (see D-109) | `src/game/data/feats.ts` |
| Two-Weapon Fighting's base prerequisite (a Light melee weapon in each hand grants a bonus-action off-hand attack that skips the ability modifier) and Nick's real trigger (that off-hand attack instead rides the Attack action) — both already logged above/in the Phase 17 weapon row, now made mechanically real | SRD 5.2.1 | CC BY 4.0 | Yes, before public release | The dual-wielding mechanic itself (a Light weapon may occupy the existing `"shield"` slot as an off-hand weapon) is original engineering; the prerequisite/effect VALUES are the unmodified SRD rule (see D-110) | `src/game/entities/Hero.ts`, `src/game/scenes/BattleScene.ts` |
| `Hero.meetsFeatPrerequisites` — the first general feat-prerequisite check in this codebase (level, ability-score-any-of, Fighting-Style-class, spellcasting-class) | Original UI/mechanics logic, feat prerequisite DATA sourced from SRD 5.2.1 (CC BY 4.0) | CC BY 4.0 (data only) | Yes, before public release | The prerequisite VALUES (e.g. "level 4+, Str or Dex 13+" for Grappler) are the unmodified SRD rule; the checking function itself is original code | `src/game/entities/Hero.ts` |
| Ability Score Improvement: raise one ability score by 2, or two different scores by 1 each, capped at 20 | SRD 5.2.1 | CC BY 4.0 | Yes, before public release | The choice itself, and which ability(ies) to raise, are original UI/UX (`BattleScene`'s ASI overlay); the +2-one-or-+1-two split and the 20 cap are the unmodified SRD rule | `src/game/entities/Hero.ts` |
| Four subclasses (one per class): Champion (Fighter), School of Evocation (Wizard), Thief (Rogue), Life Domain (Cleric) — names and feature names/levels | SRD 5.2.1 | CC BY 4.0 | Yes, before public release | Feature DESCRIPTIONS are original wording, not copied SRD text; every feature is data-only/inert today (see `data/subclasses.ts`) | `src/game/data/subclasses.ts` |
| Attack roll mechanic: d20 + attack bonus vs. target Armor Class; a natural 20 always hits and is a critical hit (this project doubles flat damage rather than rolling extra damage dice); a natural 1 always misses | SRD 5.2.1 | CC BY 4.0 | Yes, before public release | The specific `attackBonus`/`armorClass` NUMBERS assigned to every hero/enemy/equipment item are original balance values, not SRD stat blocks | `src/game/systems/CombatSystem.ts` |
| Saving throw mechanic: d20 + ability modifier (+ proficiency bonus if proficient) vs. a DC; a natural 20 always succeeds, a natural 1 always fails (the general SRD "d20 Test" rule, same auto-succeed/fail treatment already given to attack rolls above); spell save DC formula (8 + proficiency + spellcasting ability modifier) | SRD 5.2.1 | CC BY 4.0 | Yes, before public release | The specific `savingThrowBonus` NUMBERS assigned to every enemy are original balance values, not SRD stat blocks | `src/game/systems/SavingThrowSystem.ts`, `src/game/systems/CharacterSystem.ts` |
| Eight skill names and their governing ability score (Athletics/STR, Acrobatics+Stealth/DEX, Investigation/INT, Perception+Insight/WIS, Persuasion+Intimidation/CHA) | SRD 5.2.1 | CC BY 4.0 | Yes, before public release | Descriptions are original wording, not copied SRD text; a slim 8-skill subset of the SRD's 18, and no proficiency concept — this game has no skill check for one to apply to | `src/game/data/skills.ts` |
| Concentration-check mechanic: a CON saving throw vs. a DC of half the damage taken (rounded down), minimum 10 | SRD 5.2.1 | CC BY 4.0 | Yes, before public release | The unmodified SRD formula; framework-only (Phase 13.7, D-092) — no spell in this game has an ongoing duration effect to protect yet, so nothing calls it outside its own tests | `src/game/systems/ConcentrationSystem.ts` |
| Barbarian class: name, d12 hit die, STR/CON saving throw proficiencies, Extra Attack level (5), and feature names/levels (Rage, Unarmored Defense, Reckless Attack, Danger Sense, Primal Path, Fast Movement, Feral Instinct, Brutal Critical, Relentless Rage, Persistent Rage, Indomitable Might, Primal Champion) | SRD 5.2.1 | CC BY 4.0 | Yes, before public release | Feature DESCRIPTIONS are original wording; Rage's specific damage-resistance/bonus-damage/duration/use-count NUMBERS are original balance values, an intentional simplification of the SRD's real numbers (Phase 13.8, D-093) | `src/game/data/classes.ts` |
| Bard class: name, d8 hit die, DEX/CHA saving throw proficiencies, CHA casting ability, and feature names/levels (Spellcasting, Bardic Inspiration, Jack of All Trades, Song of Rest, Bard College, Expertise, Font of Inspiration, Countercharm, Magical Secrets, Superior Inspiration) | SRD 5.2.1 | CC BY 4.0 | Yes, before public release | Feature DESCRIPTIONS are original wording; Bardic Inspiration's flat bonus amount/use-count are original balance values (Phase 13.8, D-093) | `src/game/data/classes.ts` |
| Druid class: name, d8 hit die, INT/WIS saving throw proficiencies, WIS casting ability, and feature names/levels (Druidic, Spellcasting, Wild Shape, Druid Circle, Timeless Body, Beast Spells, Archdruid) | SRD 5.2.1 | CC BY 4.0 | Yes, before public release | Feature DESCRIPTIONS are original wording; this game's Wild Shape is a simplified damage-resistance-plus-heal buff, not a real creature-stat-block transformation (Phase 13.8, D-093) | `src/game/data/classes.ts` |
| Monk class: name, d8 hit die, STR/DEX saving throw proficiencies, Extra Attack level (5), and feature names/levels (Martial Arts, Unarmored Defense, Ki, Unarmored Movement, Monastic Tradition, Deflect Missiles, Stunning Strike, Ki-Empowered Strikes, Evasion, Diamond Soul, Perfect Self) | SRD 5.2.1 | CC BY 4.0 | Yes, before public release | Feature DESCRIPTIONS are original wording; Martial Arts' DEX-for-melee rule is the real SRD mechanic, but its free bonus-action strike and Ki's other SRD uses are folded into one simplified Flurry-of-Blows mechanic (Phase 13.8, D-093) | `src/game/data/classes.ts` |
| Paladin class: name, d10 hit die, WIS/CHA saving throw proficiencies, CHA casting ability (half-caster), Extra Attack level (5), and feature names/levels (Divine Sense, Lay on Hands, Fighting Style, Spellcasting, Divine Smite, Divine Health, Sacred Oath, Aura of Protection, Aura of Courage, Improved Divine Smite, Cleansing Touch) | SRD 5.2.1 | CC BY 4.0 | Yes, before public release | Feature DESCRIPTIONS are original wording; Divine Smite's flat bonus-damage number is an original balance value, an intentional simplification of the SRD's scaling die-based version (Phase 13.8, D-093) | `src/game/data/classes.ts` |
| Ranger class: name, d10 hit die, STR/DEX saving throw proficiencies, WIS casting ability (half-caster), Extra Attack level (5), and feature names/levels (Favored Enemy, Natural Explorer, Fighting Style, Spellcasting, Ranger Conclave, Primeval Awareness, Land's Stride, Hide in Plain Sight, Vanish, Feral Senses, Foe Slayer) | SRD 5.2.1 | CC BY 4.0 | Yes, before public release | Feature DESCRIPTIONS are original wording; the half-caster spell-slot table is the unmodified SRD progression; Hunter's Mark's auto-target/flat-bonus-damage implementation is an original simplification (Phase 13.8, D-093) | `src/game/data/classes.ts` |
| Sorcerer class: name, d6 hit die, CON/CHA saving throw proficiencies, CHA casting ability, and feature names/levels (Spellcasting, Sorcerous Origin, Font of Magic, Metamagic, Sorcerous Restoration) | SRD 5.2.1 | CC BY 4.0 | Yes, before public release | Feature DESCRIPTIONS are original wording; only Metamagic: Quickened Spell is modeled, with an original Sorcery-Points-cost implementation (Phase 13.8, D-093) | `src/game/data/classes.ts` |
| Warlock class: name, d8 hit die, WIS/CHA saving throw proficiencies, CHA casting ability (Pact Magic), and feature names/levels (Otherworldly Patron, Pact Magic, Eldritch Invocations, Pact Boon, Mystic Arcanum, Eldritch Master) | SRD 5.2.1 | CC BY 4.0 | Yes, before public release | Feature DESCRIPTIONS are original wording; Pact Magic's slot COUNT/SHAPE is deliberately simplified to share the game's full-caster table (a documented simplification, not an SRD claim) — only its Short-Rest recharge cadence is the real, distinctive SRD mechanic (Phase 13.8, D-093) | `src/game/data/classes.ts` |
| Curated spells for the four new casters: Vicious Mockery, Healing Word (Bard); Produce Flame (Druid, shares Cure Wounds with the Cleric); Eldritch Blast (Warlock, shares Magic Missile with the Wizard/Sorcerer) — names, spell level, and school | SRD 5.2.1 | CC BY 4.0 | Yes, before public release | Descriptions and all game numbers are original, not copied SRD spell text (Phase 13.8, D-093) | `src/game/data/spells.ts` |
| Magic item rarity ladder (Common/Uncommon/Rare/Very Rare/Legendary) and the attunement mechanic (a creature may attune to at most 3 items at once) | SRD 5.2.1 | CC BY 4.0 | Yes, before public release | The rarity tier NAMES and the attunement cap (3) are the unmodified SRD concepts; every item name, description, and specific bonus/proc number is original (Phase 13.9, D-094) | `src/game/data/equipment.ts` |
| Eight more subclasses (one per remaining class): Path of the Berserker (Barbarian), College of Lore (Bard), Circle of the Land (Druid — corrected in Phase 14.1/D-098 from a mistaken Circle of the Moon, which was never SRD content), Way of the Open Hand (Monk), Oath of Devotion (Paladin), Hunter (Ranger), Draconic Bloodline (Sorcerer), The Fiend (Warlock) — names and feature names/levels | SRD 5.1/5.2.1 | CC BY 4.0 (and OGL 1.0a for the SRD 5.1 text) | Yes, before public release | Feature DESCRIPTIONS are original wording, not copied SRD text; four features are mechanically active (Draconic Resilience's HP bonus, Colossus Slayer, Dark One's Blessing — Phase 14, D-097; Circle of the Land's Natural Recovery — Phase 14.1, D-098), the rest are data-only/inert today (see `data/subclasses.ts`) | `src/game/data/subclasses.ts` |
| Twelve ORIGINAL subclasses (one per class, a second option alongside each SRD one above) — Path of the Ironhide (Barbarian), College of the Blade (Bard), Zeal Domain (Cleric), Circle of the Ashen Veil (Druid), Battle Tactician (Fighter), Way of the Iron Body (Monk), Oath of Retribution (Paladin), Beastbond Warden (Ranger), Shadowblade (Rogue), Wildsurge Origin (Sorcerer), Starbound Patron (Warlock), Spellblade Tradition (Wizard) | N/A — original content | N/A | No — not SRD-derived | Names, flavor text, and mechanics are entirely original (Phase 14.2, D-099) — verified directly that neither SRD 5.1 nor SRD 5.2.1 licenses more than one subclass per class before building these; general game-mechanic CONCEPTS aren't copyrightable, but nothing here reuses any real subclass's specific text or numbers regardless. One real mechanical hookup apiece, reusing existing systems only (see `data/subclasses.ts`) | `src/game/data/subclasses.ts` |
| The "Swarm" creature trait: can occupy another creature's space and vice versa; immune to charmed/frightened/grappled/paralyzed/petrified/prone/restrained/stunned; deals half damage once Bloodied (half HP or fewer); resistant to bludgeoning/piercing/slashing damage | SRD 5.2.1/2024 (verified directly against the real "Swarm of Insects" stat block text via two independent sources — a search-engine snippet quoting the SRD trait verbatim, and a second site's direct SRD-sourced stat-block quote — per this project's own "verify against the actual document, don't assume" policy, the same one the Phase 14.1/D-098 mistake exists because of) | CC BY 4.0 | Yes, before public release | Only the occupy-space, condition-immunity, and Bloodied-half-damage thirds of the real trait are mechanically modeled (Phase 21, D-112) — the bludgeoning/piercing/slashing damage RESISTANCE is honestly NOT modeled, since this game has no damage-type-aware resistance system for any attack to hook into yet. The condition-immunity list is mapped onto this game's own (smaller, invented) set of status ids — frightened/grappled/paralyzed/petrified/prone have no equivalent status here, so only charmed/restrained/stunned/toppled (this project's own Prone stand-in) are actually checked. The two enemies carrying this trait (Rat Swarm, Locust Swarm), their names, stats, and flavor are entirely ORIGINAL — only the mechanical RULE itself is sourced | `src/game/entities/Enemy.ts`, `src/game/systems/WaveSystem.ts`, `src/game/data/enemies.ts` |
| Everything else in Phase 21 (D-112) — the hero-side status-effect system, Berserker/Lifedrinker/Splitter/Carrier/Shielded/Reflector/Explosive/Gold Thief/Teleporter/Mimic/Healer/Anti-caster/Multi-Phase Boss archetypes, and 24 new enemies (Frenzied Cultist, Bloodrage Warlord, Bloodwisp, Crimson Leech, Living Splinter, Ooze Splitter, Fungal Splitter, The Husk, Warded Sentinel, Aegis Bearer, Cinder Wretch, Bomber Beetle, Pilferer, Coin Wraith, Blink Stalker, Rift Walker, Mimic Chest, Ambush Coffer, Battle Medic, Plague Warden, Hexbinder, Rat Swarm, Locust Swarm, Sundered King) | N/A — original content | N/A | No — not SRD-derived | Every mechanic, name, stat, and lore line is invented for this project; no D&D/SRD-derived names, lore, or mechanical rules beyond the one Swarm row above (see `DECISIONS.md` D-112 for the full method) | `src/game/entities/Hero.ts`, `src/game/entities/Enemy.ts`, `src/game/systems/WaveSystem.ts`, `src/game/systems/CombatSystem.ts`, `src/game/systems/EconomySystem.ts`, `src/game/data/enemies.ts`, `src/game/data/statusEffects.ts`, `src/game/scenes/BattleScene.ts`, `src/game/scenes/FreePlayScene.ts` |
| Full SRD spell-list catalogue addition: 304 further spells' names, spell level (0-9), and school, for the complete Bard/Cleric/Druid/Paladin/Ranger/Sorcerer/Warlock/Wizard class spell lists (Paladin/Ranger confirmed to have no cantrips and to top out at 5th level, matching their half-caster progression) | SRD 5.1 | CC BY 4.0 (or OGL 1.0a) | Yes, before public release | Descriptions and all flavor text are original wording, not copied SRD spell text; originally entirely data-only at Phase 15 (D-104) — as of Phase 16 (D-106), most now carry a real `abilityId` (mechanics and numbers are entirely original, see the new row below), ~120 stay data-only as genuinely non-combat | `src/game/data/spells.ts` |
| Four subclasses' bonus/always-prepared spell features: Life Domain's "Domain Spells" (levels 1/3/5/7/9), Oath of Devotion's "Oath Spells" (levels 3/5/9/13/17), The Fiend's "Expanded Spell List" (SRD spell levels 1st-5th), and Circle of the Land's terrain-typed "Circle Spells" (all 7 SRD terrains — arctic/coast/desert/forest/grassland/mountain/swamp — at Druid levels 3/5/7/9) — feature names, levels, and the exact spell each tier grants | SRD 5.1 | CC BY 4.0 (or OGL 1.0a) | Yes, before public release | Feature DESCRIPTIONS are original wording; every referenced spell reuses an id already logged in the row above (no new spell had to be added); all `mechanicallyActive: false` — this game's known-spell list is fixed per class, not per subclass, and Circle of the Land's terrain choice additionally has no character-creation UI yet (Phase 15 follow-up, D-105) | `src/game/data/subclasses.ts` |
| Phase 16 (D-106) "make all spells usable": five new status effect ids (poisoned, restrained, blinded, exposed, charmed), a new ally-buff system (blessed, warded, guided), three summon archetypes (Spectral Blade, Guardian Spirit, Elemental Servant), two spell-only structures (Spectral Wall, Web Patch), and the ~184 `AbilityDefinition` combat-number entries wired onto existing SRD-named spells (damage/duration/range/radius formulas, buff/status picks, summon/terrain choices) | N/A — original content | N/A | No — not SRD-derived | Every id, name, description, and NUMBER here is original to this project — only the pre-existing SPELL NAMES/levels/schools the new abilities attach to are SRD-derived (already logged in the rows above); general mechanic CONCEPTS (a status effect, a summoned ally, a buildable wall) aren't copyrightable, and nothing here reuses any real spell's specific SRD mechanical text | `src/game/data/statusEffects.ts`, `src/game/data/buffEffects.ts`, `src/game/data/summons.ts`, `src/game/data/structures.ts`, `src/game/data/abilities.ts` |
| Hellish Rebuke (Warlock): name, spell level (1st), and school (evocation) — a Phase 15 (D-104) catalogue omission found and fixed as a same-day Phase 16 follow-up (D-107) | SRD 5.1 | CC BY 4.0 (or OGL 1.0a) | Yes, before public release | Description and all game numbers (damage, range) are original, not copied SRD spell text; the SRD casts it as a reaction, deliberately simplified here to a normal action-cost attack since this game has no reaction economy for a caster to hook a damage-triggered spell into | `src/game/data/spells.ts` |
| Full weapon table (36 of the SRD's 38 core weapons — Musket/Pistol deliberately excluded, a fantasy-setting content-fit trim, not a completeness gap): names, category (Simple/Martial), type (Melee/Ranged), damage dice, damage type, and every property (Ammunition, Finesse, Heavy, Light, Loading, Reach, Thrown, Two-Handed, Versatile) | SRD 5.2.1 | CC BY 4.0 | Yes, before public release | This is 2024-rules-ONLY content (the 2014 SRD 5.1 this project's spell catalogue is sourced from has no weapon-mastery concept at all); damage dice were converted to a flat average via this project's existing `fixedHitDieGain`-style "round half up per die" convention, not rolled — no SRD text is reproduced verbatim | `src/game/data/weapons.ts` |
| The 8 real SRD Weapon Mastery properties (Cleave, Graze, Nick, Push, Sap, Slow, Topple, Vex) and the official per-weapon mastery assignment table | SRD 5.2.1 | CC BY 4.0 | Yes, before public release | Property NAMES and per-weapon ASSIGNMENTS are the unmodified SRD table (verified against 3+ independent sources, one transcription error caught and discarded — see D-108); the actual MECHANICAL IMPLEMENTATION (status effects, save DCs, damage numbers) is original engineering, not copied rules text. Mastery applies to whoever wields the weapon regardless of class — a deliberate simplification of the SRD's real "unlocked mastery slots" per-class rule. Nick is the one property left mechanically inert (needs a dual-wielding/off-hand-weapon system this game doesn't have) | `src/game/data/weapons.ts`, `src/game/scenes/BattleScene.ts` |
| Full armor table (all 3 light + 5 medium + 4 heavy armors, the SRD's complete list) and the Shield: names, base AC, Dex-modifier handling (full/capped-at-2/none), Strength requirement, and stealth-disadvantage flag | SRD 5.2.1 | CC BY 4.0 | Yes, before public release | The AC/Dex-mode/Str-requirement NUMBERS are the unmodified SRD table; Strength requirement and stealth disadvantage are recorded as real reference data but not yet mechanically enforced (no Strength-gated movement penalty or stealth-check system exists) | `src/game/data/armor.ts` |
| The `+1/+2/+3` weapon/armor/shield enchantment concept (a mundane item made magical by a flat bonus, no attunement required) | SRD 5.1 | CC BY 4.0 (or OGL 1.0a) | Yes, before public release | The CONCEPT and the three-tier progression are the unmodified SRD rule; the actual synthesis mechanism (`enchantedItemId`/`getEquipmentDefinition`'s on-demand generation from any mundane weapon/armor/shield) and every cost number are original engineering, not copied rules text (Phase 22, D-113) | `src/game/data/equipment.ts` |
| 14 real SRD magic items: Ring of Protection, Cloak of Protection, Bracers of Defense, Stone of Good Luck (Luckstone), Ring of Resistance, Ring of Free Action, Periapt of Proof against Poison, Boots of Striding and Springing, Boots of Speed, Bracers of Archery, Robe of the Archmagi, Flame Tongue, Frost Brand, Dagger of Venom — names, rarity, and general classic effect | SRD 5.1 | CC BY 4.0 (or OGL 1.0a) | Yes, before public release | Descriptions are original wording, not copied SRD item text; several mechanics are deliberately SIMPLIFIED for this game's systems (Ring of Resistance's damage-type resistance becomes a flat AC bonus — no damage-type system exists; Boots of Speed's "activate for 10 rounds" becomes always-on for the rest of the battle; Flame Tongue/Frost Brand's SRD-specific extra-damage-die numbers become flat `EquipmentProc` bonuses) — every flat bonus/proc NUMBER is an original balance value (Phase 22, D-113) | `src/game/data/magicItems.ts` |
| 4 potions across the real SRD "Potion of Healing" rarity-tiered potency rule (common/uncommon/rare/veryRare, healing amount scales with rarity), plus Potion of Heroism, Potion of Speed, Potion of Resistance, and Restorative Ointment — names and rarity | SRD 5.1 | CC BY 4.0 (or OGL 1.0a) | Yes, before public release | Descriptions and every heal/buff NUMBER are original, not copied SRD text; Potion of Speed/Resistance are simplified from the SRD's temporary-duration effects into always-on-for-the-rest-of-the-battle grants, the same treatment the original Vigor Tonic's `attackBuff` already established (Phase 22, D-113) | `src/game/data/potions.ts` |
| Phase 23 (D-114) map/terrain expansion: the "pit" tile type (an environmental hazard a pushed unit falls into and is instantly defeated by), hero-affecting terrain (an opt-in per-map flag extending the existing enemy-only terrain effects to heroes too), the DynamicTerrainSystem (wave-numbered, telegraphed mid-battle terrain changes), and four new maps (Shattered Causeway, The Drowning Vale, Cinderfall Rift, Frostbound Hollow) | N/A — original content | N/A | No — not SRD-derived | Every mechanic, tile type, map name, and layout here is invented for this project — the Source of Truth's own §2.3 lists "holes" as a carried-forward vision concept never previously built (see `SOURCE_OF_TRUTH.md`), but the specific pit mechanic (push-triggered instant defeat, not a standing hazard) is this project's own design, not SRD or any published rule | `src/game/data/testMap.ts`, `src/game/systems/GameMap.ts`, `src/game/systems/DynamicTerrainSystem.ts`, `src/game/data/causewayMap.ts`, `src/game/data/drowningValeMap.ts`, `src/game/data/cinderfallRiftMap.ts`, `src/game/data/frostboundHollowMap.ts` |
| Phase 24 (D-115): the "sand" tile type (a build-restricted, otherwise plain-floor tile), and five new structures — Palisade, Bulwark, Watchtower (the first `"any"`-audience platform), Frost Trap, and Bear Trap (the first `singleUse` trap) | N/A — original content | N/A | No — not SRD-derived | Every tile type, structure name, and NUMBER here is invented for this project; Frost Trap reuses the pre-existing "restrained" status id and Watchtower reuses the pre-existing platform-bonus mechanism, neither of which is SRD-derived to begin with (see the Phase 16/D-106 row above) | `src/game/data/testMap.ts`, `src/game/systems/GameMap.ts`, `src/game/systems/BuildSystem.ts`, `src/game/data/structures.ts`, `src/game/data/causewayMap.ts`, `src/game/data/cinderfallRiftMap.ts`, `src/game/data/drowningValeMap.ts` |
| Phase 25 (D-116): ten new structures bracketing existing ones (Wicket Gate, Portcullis, Snare Wire, Mangler Trap, Net Snare, Storm Lance, Sparring Post, War Dais, Low Perch, Sky Bastion), the opportunistic wall-bash enemy AI, and two new enemies — Saboteur and Warren Stalker (the `trapSense` mechanic) | N/A — original content | N/A | No — not SRD-derived | Every structure/enemy name and NUMBER here is invented for this project; every new structure reuses existing fields (`maxHp`, `damage`, `targets`, `heroBonus`) rather than introducing any new ones, and the two new mechanics (`opportunistic` wall-bash, `trapSense`) are original engineering built on top of the pre-existing, already-original siege/trap systems | `src/game/data/structures.ts`, `src/game/data/enemies.ts`, `src/game/systems/WaveSystem.ts`, `src/game/systems/BuildSystem.ts` |
| Two Google Fonts: **Cinzel** (display/headline text) and **EB Garamond** (body/button text), used for the new fantasy/parchment UI theme (Main Menu, Compendium, Bestiary) | Google Fonts (fonts.google.com) | SIL Open Font License 1.1 | No attribution required by the OFL for ordinary use (no endorsement claim made); credited in `README.md`/repository credits before public release as routine good practice | Not modified — loaded as-is via a Google Fonts `<link>` in `index.html`, not bundled/re-hosted | `index.html`, `src/game/scenes/uiTheme.ts` |
| Phase 26 (D-177): the 12-companion catalogue's names and one-line story hooks — Hollis Vane, Fenna Duskwater, Isolde Varnhall, Tamsin Rourke, Dorian Wick, Sorrel Thane (`CAMPAIGN_STORY_DESIGN.md` §6's original six "mirror" companions) and Brand Ashcairn, Wren Calloway, Perrin Holt, Mira Quill, Cass Ferrow, Ellery Vance (D-177's six new class-coverage recruits) | N/A — original content | N/A | No — not SRD-derived | Every name, hook, race/class/subclass pairing, and starting-item choice is invented for this project; the class/subclass/race MECHANICS these builds reference (e.g. Champion, Draconic Bloodline, the Dwarf/Tiefling/Dragonborn species) are already logged in the rows above — nothing new is added by this content beyond the pairing choices themselves | `src/game/data/companions.ts` |
| Phase 27 (D-179): Emberford Reach/Saltmere Shallows' 4-chapter region content — 8 new wave lists (`emberford-ch1..3`, `saltmere-ch1..3`; Ch4 in both reuses the existing flat finale unchanged), and one new enemy, **Tide-Wretch** (`data/enemies.ts`, miniboss tier) — Saltmere's Ch1 stand-in for `CAMPAIGN_STORY_DESIGN.md` §4's not-yet-buildable "returning miniboss" mechanic, deliberately with no `loreText` per that section's own documented fallback ("a wall, not a character") | N/A — original content | N/A | No — not SRD-derived | Every wave composition, enemy count/timing/gold number, and the new enemy's name/stat block/color are invented for this project; every enemy id referenced in the new waves (`marauder`, `blightcaller`, `cave-drake`, `frost-warden`, plus the existing roster) was already original content logged in earlier rows | `src/game/data/campaigns.ts`, `src/game/data/enemies.ts` |
| Phase 27 (D-180): the other four regions' 4-chapter content — Shattered Causeway, Cinderfall Rift, The Drowning Vale, Frostbound Hollow each get a brand-new flat 6-wave campaign (none existed before this pass) plus 3 new chapter wave lists apiece (12 new wave-list arrays total, 48 individual `WaveDefinition` entries), and four new curated loot pools | N/A — original content | N/A | No — not SRD-derived | Every wave composition, enemy count/timing/gold number, description, and loot-pool selection is invented for this project; every enemy id referenced (including the 8 miniboss/boss ids assigned per `CAMPAIGN_STORY_DESIGN.md` §3's table — Juggernaut, The Devourer, Gravemaw, Warlord Korrath, The Husk, Blightmother, Bloodrage Warlord, Sundered King) and every loot-pool item id was already original content logged in earlier rows; no new enemy or equipment was added | `src/game/data/campaigns.ts` |
| Phase 27 (D-181): `CAMPAIGN_STORY_DESIGN.md` §8's pre-region bonus-choice pools — 6 curated options per region (36 total across all 6 regions), plus the random-draw-3 rule | N/A — original content | N/A | No — not SRD-derived | Every option's name, description, and gold/HP number is invented for this project; every equipment/structure id referenced was already original content logged in the Phase 13.9/22 (equipment) and Phase 5/7/24/25 (structures) rows above — this adds no new item, only a new curated arrangement | `src/game/data/regionBonuses.ts`, `src/game/systems/RegionBonusSystem.ts` |
| Phase 27 (D-182): `CAMPAIGN_STORY_DESIGN.md` §4's returning-miniboss mechanic — the "Finish/Spare" modal's button/description copy, and 5 one-line "washed ashore" flavor strings logged when a spared miniboss reappears in Saltmere Ch1 (one per Basalt Colossus/Juggernaut/Gravemaw/The Husk/Bloodrage Warlord) | N/A — original content | N/A | No — not SRD-derived | Every line of copy is invented for this project; no new enemy, equipment, or structure — each returning miniboss reuses its existing enemy id/stat block (already logged in earlier rows) verbatim | `src/game/systems/ReturningMinibossSystem.ts` |
| D-188: `CAMPAIGN_STORY_DESIGN.md` §5's capstone, The Nameless Throne — one new hand-authored map (name, layout, flavor), a new 6-wave finale campaign, and 6 new enemy reskins (Ember Thane, Cinder Adept, Ashbound Honor Guard, Drowned Thane, Hollow Caller, Drowned Honor Captain), plus the capstone's own intro/ending epilogue copy | N/A — original content | N/A | No — not SRD-derived | Every map name/layout/flavor line, wave composition/gold number, enemy name/lore, and epilogue line is invented for this project; each reskin's donor stat block (Warden, Hexer, Gravemaw, Blightcaller, The Husk) was already original content logged in earlier rows — no new stats introduced; Ashen Sovereign/The Hollow Empress themselves were already logged under their own Phase 20 (D-111) row | `src/game/data/namelessThroneMap.ts`, `src/game/data/campaigns.ts`, `src/game/data/enemies.ts`, `src/game/systems/NamelessThroneSystem.ts` |
| D-189: `CAMPAIGN_STORY_DESIGN.md` §9's companion dialogue writing pass — a recruitment/arrival dialogue beat and a Chapter-4 "mirror boss defeated" reaction beat for each of the 6 original companions (Hollis Vane, Fenna Duskwater, Isolde Varnhall, Tamsin Rourke, Dorian Wick, Sorrel Thane; two of the reaction beats have separate "ashen"/"hollow" tone variants), plus real `introText`/`outroText` narration for all 24 region chapters (6 regions × 4) | N/A — original content | N/A | No — not SRD-derived | Every line of dialogue and chapter narration is invented for this project, explicitly a first-draft writing pass per Kevin's own "punch-up-able rough material" framing; no new enemy, equipment, or structure — this is pure narrative-copy content referencing only already-logged names (companions from the Phase 26/D-177 row above, region bosses from the Phase 27/D-179–D-180 rows above) | `src/game/data/companionDialogue.ts`, `src/game/data/campaigns.ts` |
| D-206: 4 real SRD 5.2.1 Backgrounds — Acolyte, Criminal, Sage, Soldier: names, 2 skill proficiencies apiece, tool proficiency, the 3-ability ability-score-improvement triad ("+2 to one and +1 to another, or +1 to all three"), and which single Origin Feat each grants. Verified directly against dndbeyond.com's own SRD changelog before writing any of this (the SRD contains exactly 4 backgrounds, not the full 2024 PHB's sixteen — same "verify real docs, don't assume" correction this project already made once for Tough/Lucky/Athlete, see the row below) | SRD 5.2.1 | CC BY 4.0 | Yes, before public release | Descriptions are original wording, not copied SRD text; the starting-equipment package is deliberately simplified to a real weapon (if the package includes one already in this game's catalogue) plus a flat starting-gold bonus — the rest (tools, books, parchment, clothes) stays flavor-only, since this game has no tool-check/crafting system to hook it into (the same honest treatment the Skilled feat already has, see the Phase 18/D-109 row above); 4 new skills (Religion, Sleight of Hand, Arcana, History) were added to `data/skills.ts` specifically because these 4 backgrounds reference them | `src/game/data/backgrounds.ts`, `src/game/data/skills.ts` |
| D-206: 6 original Backgrounds — Siege Engineer, Ashfall Scout, Harborhand, Hedge-Warden, Ledger-Keeper, Ember-Marked — built at Kevin's explicit direction once the real SRD count (4, not ~16) was verified, same treatment this project already gives the 12 original subclasses/companion catalogue | N/A — original content | N/A | No — not SRD-derived | Every name, description, skill pairing, and ability triad is invented for this project, deliberately grounded in this game's own world (the tower-defense/siege genre itself, and `CAMPAIGN_STORY_DESIGN.md`'s "Unremembering" throughline for Ember-Marked specifically) rather than reskinning any of the 12 real PHB backgrounds this project isn't licensed to use; each still grants only already-existing feats/weapons/skills — no new mechanic invented purely for flavor | `src/game/data/backgrounds.ts` |

**Status through Phase 7 (remaining vertical-slice content): no external assets and no SRD-derived content had been added.** Phase 11.1's first slice added the first SRD-derived content in the project — see the rows above and the "Rules for future chats" section below, which already anticipated this.

Phase 11.2 ("spellcasting engine," this chat) added the Wizard class table and
a curated 5-spell list (two cantrips, three 1st-level spells) — see the two
new rows above. Two of `src/game/data/abilities.ts`'s existing entries also
grew by two: **Fire Bolt** and **Ray of Frost**, the mechanical combat
numbers behind the two cantrips (their SRD names/levels are logged above;
their specific damage/effect numbers here are original, same treatment as
every other entry in that file). No new heroes, structures, or visuals —
this chat is entirely rules-engine plus the character-creation UI's
class-cycle button.

Phase 11.3 ("starter class/race/feat roster," this chat) added the Rogue and
Cleric class tables, six starter races, and a starter feat list — see the
five new rows above. `src/game/data/abilities.ts` grew by one more entry,
**Sacred Flame**, the Cleric's mechanically-active cantrip (SRD name/level
logged above; its damage/effect numbers here are original). No new heroes,
structures, or visuals — this chat is entirely rules-engine plus the
character-creation UI's new race-cycle button.

Phase 13.8 ("the remaining eight core SRD classes," this chat) added the
Barbarian, Bard, Druid, Monk, Paladin, Ranger, Sorcerer, and Warlock class
tables — see the nine new rows above. `src/game/data/abilities.ts` gained
four new mechanically-active cantrip entries: **Vicious Mockery** (Bard),
**Produce Flame** (Druid), **Eldritch Blast** (Warlock), and **Healing
Word** (Bard, 1st-level); their SRD names/levels are logged above, their
specific damage/heal numbers are original. No new subclasses, heroes,
structures, or visuals this chat — entirely rules-engine data plus small
`Hero`/`BattleScene` mechanics (Rage, Wild Shape, Ki/Flurry of Blows,
Bardic Inspiration, Divine Smite, Hunter's Mark, Metamagic: Quickened
Spell, Pact Magic's Short-Rest recharge), all of which use ORIGINAL flat
balance numbers, not SRD dice expressions.

Phase 13.9 ("loot/equipment expansion," a later chat) added the rarity
ladder and attunement mechanic — see the new row above — plus five new
equipment items: **Ring of Frostbite**, **Amulet of Withering**, **Signet
of Kinship**, **Greaves of the Berserker**, and **Aegis of the First
Ward**. All five names, descriptions, and every specific bonus/proc number
(Slowed's duration, the save DC, bonus damage, heal amount, costs) are
entirely original — none are SRD magic item names or stat blocks, only the
rarity-tier/attunement CONCEPTS logged above are SRD-derived.

Phase 13.10 ("enemy roster expansion," a later chat) added, all ORIGINAL,
invented for this project, nothing copied or adapted from any published
source:
- **Two new minions** in `src/game/data/enemies.ts`: **Marauder** (a
  flat-stat glass-cannon melee threat) and **Blightcaller** (this roster's
  first enemy with a real special attack — forces a saving throw instead
  of a to-hit roll; the SAVE mechanic itself reuses the already-logged
  saving-throw row above, not a new SRD concept).
- **A second miniboss**, **Gravemaw**, and a **third true boss**,
  **Blightmother** (sharing Blightcaller's forced-save attack at a harder
  DC), plus their placeholder colours and lore text.
- No new art, audio, or fonts — every new enemy renders as the existing
  coloured token/name-banner drawing code (the banner logic itself was
  fixed this chat to actually apply to the "boss" role tier, not extended
  with anything new).

Phase 11.3's subclass follow-up ("do subclasses now," this chat) added one
subclass per class — see the new row above. Pure rules-engine data only, no
scene/UI changes and no new heroes, structures, or visuals.

Phase 14 ("subclass roster expansion," a later chat) added one subclass for
each of the eight classes that had none — see the new row above. Feature
DESCRIPTIONS are original wording throughout. Three features are
mechanically active (Draconic Resilience's flat HP bonus, Colossus Slayer's
bonus damage, Dark One's Blessing's flat self-heal), each an original
balance number, not an SRD dice expression — same treatment as every other
mechanically-active feature already logged in this file. No new heroes,
structures, or visuals this chat.

Phase 14.1 ("Circle of the Land correction," a later chat) fixed a real
mistake in the Phase 14 row above: Druid's subclass was recorded as Circle
of the Moon, which has never been part of either SRD version — replaced
with the real SRD-licensed circle, Circle of the Land. Verified directly
against the actual SRD 5.1 and SRD 5.2.1 documents/mirrors (class page by
class page for all twelve classes) rather than assumed from general D&D
knowledge — see D-098 in `DECISIONS.md`.

Phase 14.2 ("a second, original subclass for every class," the same later
chat) added twelve entirely original subclasses — see the new row above.
Kevin asked whether more real D&D subclasses could be used with proper
attribution first; the SRD-verification above answered that directly: no,
both SRD versions cap out at one subclass per class, and the rest of the
real subclass roster (Battle Master, Totem Warrior, College of Valor, six
more Cleric domains, Circle of the Moon, Way of Shadow, Oath of Vengeance,
Beast Master, Assassin, Wild Magic, the other Warlock patrons, seven more
Wizard schools) is Player's Handbook-only content with no open license
covering it. These twelve are original names/flavor/mechanics instead,
following the same policy this file already applies to every other
original enemy/equipment/map: general game-mechanic concepts aren't
copyrightable, only a specific book's exact expression is, and nothing here
reuses any real subclass's specific text or numbers. This same
verify-before-assuming policy now applies to any future spell/item/creature
content too, per Kevin's own instruction. See D-099 in `DECISIONS.md`.

Phase 11.1 "finish it" slice (this chat) added a first-pass character-creation
UI (`CharacterCreationScene`) and its supporting pure logic
(`systems/CharacterBuildSystem.ts`, `data/characterCreation.ts`). No new
SRD-derived content beyond what the first 11.1 slice already logged above —
this slice only COMPOSES the existing ability-score/class rules into a
playable character. The twelve preset character names (Kael, Sable, Doran,
Lyra, Finn, Rue, Torin, Wynn, Briar, Odessa, Garrick, Nessa) are ORIGINAL,
invented for this project — deliberately not reusing Ash/Wren/Bram/Mira, so
a created character is never confused with the existing fixed roster. No
new abilities were invented; a created character picks from the project's
existing four (Cleave, Piercing Shot, Taunting Slam, Frost Bolt).

Phase 7 (remaining vertical-slice content — heroes 2→4, structures, status
effects, level-ups, equipment, wave preview) added, all ORIGINAL, invented for
this project, nothing copied or adapted from any published source:
- **Two new heroes** in `src/game/data/heroes.ts`: **Bram** (guardian) and
  **Mira** (frostcaller), plus their placeholder colours.
- **Two new hero abilities** in `src/game/data/abilities.ts`: **Taunting
  Slam** (Bram) and **Frost Bolt** (Mira).
- **Four new structures** in `src/game/data/structures.ts`: **Gate**, **Melee
  Platform**, **Ranged Perch**, and **Tangle Root**, plus their placeholder
  colours.
- **Three status effects** in `src/game/data/statusEffects.ts`: **Slowed**,
  **Stunned**, **Burning** — original mechanical concepts, not text or rules
  copied from any published game.
- **Three equipment items** in `src/game/data/equipment.ts`: **Iron Buckler**,
  **Whetstone Blade**, **Traveler's Cloak**.
- **Two level-up choices** in `src/game/systems/ProgressionSystem.ts`:
  **Vigor** and **Might**.
No new art, audio, or fonts — everything above renders with the existing
coloured-token/rectangle/text drawing code.

Phase 7 (roster + campaign, D-050/D-051) added five new enemy definitions in
`src/game/data/enemies.ts` — **Brute**, **Swarmling**, **Warden**, **Razorwing**,
and the miniboss **Basalt Colossus** — plus their placeholder colours, and
extended `src/game/data/waves.ts` to a **ten-wave campaign** (waves 6–10 are new;
1–5 unchanged). All names, stats, flavour, and the campaign composition are
original, invented for this project; nothing is copied or adapted from any
published source. No new art, audio, or fonts — the new enemies render as the
existing coloured tokens.

Phase 7 (flying + anti-air) added one new enemy — the **Wisp**
(`src/game/data/enemies.ts`), a flying unit — and one new structure — the **Sky
Snare** (`src/game/data/structures.ts`), an anti-air trap — plus their
placeholder colours and a cosmetic "flying" ring drawn in code. All names,
stats, and behaviour (including the trap-targeting rule) are original, invented
for this project; nothing is copied or adapted from any published source.

Phase 11.5 ("multi-slot equipment, potions, and a Compendium," this chat)
added, all ORIGINAL, invented for this project, nothing copied or adapted
from any published source:
- **Nine new equipment items** in `src/game/data/equipment.ts`: **Leather
  Cap**, **Circlet of Focus**, **Chainmail Vest**, **Swift Greaves**,
  **Band of Vigor**, **Amulet of Warding**, **Amulet of Fury**, **Boots of
  Striding**, **Boots of the Brawler** — alongside the three Phase 7 items
  (Iron Buckler, Traveler's Cloak, and Whetstone Blade, renamed **Whetstone
  Band**), now spread across seven slot instances instead of one.
- **Two potions** in `src/game/data/potions.ts`: **Healing Draught** and
  **Vigor Tonic**.
- The `CompendiumScene` UI adds no new named content — it only renders
  existing data files.
No new art, audio, or fonts — everything above renders with the existing
coloured-token/rectangle/text drawing code.

Phase 11.6 ("enemy/miniboss/boss roster design and the Bestiary," this chat)
added, all ORIGINAL, invented for this project, nothing copied or adapted
from any published source:
- **Two new minions** in `src/game/data/enemies.ts`: **Hexer** (a range-3
  back-line nuisance) and **Ravager** (the roster's fastest mover).
- **Two new TRUE BOSSES** (a new `"boss"` role tier, a step up from
  miniboss) in `src/game/data/enemies.ts`: **Cinderlord** (fire-themed) and
  **Tidelord** (water-themed), plus their placeholder colours — themed to
  match the fire/water terrain a later sub-phase (11.7) will add. Neither is
  used in any wave yet.
- **Lore text** (a new optional field, one or two original sentences) on
  Cinderlord, Tidelord, and (as a bonus) the existing miniboss **Basalt
  Colossus**.
- The new `BestiaryScene` UI adds no named content of its own — it only
  renders existing enemy data plus locked "???" placeholders for
  not-yet-encountered enemies.
No new art, audio, or fonts — everything above renders with the existing
coloured-token/rectangle/text drawing code.

Phase 11.7 ("map overhaul: terrain, shop/treasure tiles, proximity gating,"
same-day chat) added, all ORIGINAL, invented for this project, nothing
copied or adapted from any published source:
- **Two new maps** in `src/game/data/emberfordMap.ts`/`saltmereMap.ts`:
  **Emberford Reach** (volcanic — cliff/fire/acid terrain) and **Saltmere
  Shallows** (tidal — cliff/water terrain), each with a shop tile and a
  treasure tile. Neither was reachable from any scene until Phase 11.8
  wired them into its two campaigns.
- Four new terrain tile types (`"cliff"`/`"water"`/`"fire"`/`"acid"`) — new
  mechanical concepts (cliff = ground-impassable/flyable; water/fire/acid =
  walkable-but-hazardous), not text or rules copied from any published
  game; the fire/water effects reuse this project's EXISTING "burning"/
  "slowed" statuses rather than inventing new ones.
No new art, audio, or fonts — the new terrain renders with the existing
coloured-tile drawing code.

Phase 11.8 ("boss-themed campaigns," same-day chat) added, all ORIGINAL,
invented for this project, nothing copied or adapted from any published
source:
- **Two campaigns** in `src/game/data/campaigns.ts`: **Emberford Reach**
  (6 waves, finale boss Cinderlord) and **Saltmere Shallows** (6 waves,
  finale boss Tidelord) — names, descriptions, and wave composition are
  original; both reuse existing enemy/map data rather than inventing new
  creatures or terrain.
- The new `CampaignSelectScene` UI adds no named content of its own beyond
  the two campaigns' own name/description fields above.
No new art, audio, or fonts.

Phase 11.9 ("free-play mode," same-day chat) added no new named content —
`FreePlayScene`'s map/boss/wave-count/minion-source/difficulty pickers, and
the wave lists `FreePlayWaveGenerator` produces at runtime, are all
compositions of enemy/map/difficulty data already logged above. No new
art, audio, or fonts.

Phase 6 (integrated MVP) added no content — only integration, tests, and copy on
the title screen (original text). All prior data remains original to this project.

All visuals so far are original placeholder shapes and text drawn in code
(coloured rectangles/circles and labels). All game data — the enemy definitions
(Grunt, Runner, Wisp, Brute, Swarmling, Warden, Razorwing, Basalt Colossus,
Hexer, Ravager, Cinderlord, Tidelord) in `src/game/data/enemies.ts`, the ten wave definitions in
`src/game/data/waves.ts`, the four hero definitions and stats (Ash, Wren, Bram,
Mira) in `src/game/data/heroes.ts`, the four hero abilities (Cleave, Piercing
Shot, Taunting Slam, Frost Bolt) in `src/game/data/abilities.ts`, the seven
buildable structures (Barricade, Gate, Spike Trap, Sky Snare, Tangle Root,
Melee Platform, Ranged Perch) in `src/game/data/structures.ts`, the three
status effects (Slowed, Stunned, Burning) in
`src/game/data/statusEffects.ts`, the twelve equipment items (across seven
gear-slot instances) in `src/game/data/equipment.ts`, the two potions
(Healing Draught, Vigor Tonic) in `src/game/data/potions.ts`, the
level-up choices (Vigor, Might) in `src/game/systems/ProgressionSystem.ts`,
and the gold values (starting gold, kill/completion/time-bonus rewards, item
costs) — is original, invented for this project. The names, numbers,
ability/structure/status effects, and behaviour are not copied or adapted from
any published source. No images, audio, fonts, logos, or rules text from any
third party — including any Dungeons & Dragons / D&D material — have been
copied into the project.

Phase 15 ("full SRD spell-list catalogue," this chat) added 304 further
spells — see the new row above — bringing the catalogue from the 14 spells
curated through Phase 13.8 to 318 total. Kevin asked to "add as many spells
as possible from the sources we can use" and, given a choice between
cantrips-only, cantrips-through-3rd-level, or the complete SRD lists at
every level a class can eventually cast (this game's spell-slot tables
already run to 9th level for full casters), chose the complete lists. The
name/level/school for every spell was verified directly against two
independent SRD 5.1 mirrors (cross-checked against each other, and against
a third-party open-data spell API for school assignment) — not assumed from
general D&D knowledge, per this file's own Phase 14.1/14.2 policy. Every
added spell is DATA-ONLY: no new `abilityId`, no change to
`characterCreation.ts`'s known-spell-lists, no new game mechanic. Most of
these 304 spells describe effects this game has no system for yet (AoE at
range, ally buffs, summons, illusions, terrain/utility effects) — the same
honest "inert until a system exists" treatment already given to
Bless/Burning Hands/Mage Armor/Guidance/Shield of Faith. `CompendiumScene`
gained a per-level filter (Cantrip/1st/.../9th) plus Prev/Next paging for
the Spells tab, mirroring the existing Classes-tab pattern, since a flat
318-entry list would no longer fit on screen. See D-104 in `DECISIONS.md`.

Phase 15 follow-up ("subclass-granted expanded spell lists," this chat)
added, as a new row above, the real SRD "bonus spell" feature four
subclasses actually have — Life Domain's Domain Spells, Oath of Devotion's
Oath Spells, The Fiend's Expanded Spell List, and Circle of the Land's
Circle Spells — which the Phase 15 spell-catalogue chat had correctly
flagged as out of scope. Kevin asked to tackle it directly. Verified
against SRD 5.1 (research agent cross-checked 2-3 independent mirrors per
feature, catching and discarding one wrong WebSearch snippet for Oath of
Devotion along the way) rather than assumed. Every spell these four
features grant was already covered by Phase 15's own 318-entry catalogue
— nothing new had to be added to `spells.ts`. All four stay data-only
(`mechanicallyActive: false`): the first three because this game's known-
spell list is fixed per class rather than extended per subclass (and none
of the granted spells besides Cure Wounds, already known regardless of
domain, have a real `abilityId`); Circle of the Land for the additional
reason that choosing a terrain has no character-creation UI to make that
choice in yet. See D-105 in `DECISIONS.md`.

Phase 17 ("weapons, armor, and weapon mastery," this chat) added, as three
new rows above, the real SRD 5.2.1 weapon table (36 of 38 core weapons — the
two core firearms, Musket and Pistol, deliberately excluded as a fantasy-
setting content-fit trim, not a completeness gap), the real armor table (all
11 light/medium/heavy armors plus the Shield), and the 8 real Weapon Mastery
properties with their official per-weapon assignment. Kevin asked to add
"tons and tons" of source-accurate weapons/armor and to build real weapon
masteries; two scoping questions were answered toward the fuller/more real
option each time (build genuine mechanical hooks for all 7 mechanically-
modelable mastery properties rather than leave them data-only, and have an
equipped weapon REPLACE a hero's base attack damage/range rather than add a
small bonus on top). This is the project's first use of 2024-rules-ONLY
content with no 2014 SRD 5.1 equivalent at all (Weapon Mastery didn't exist
before the 2024 rules) — verified via a dedicated research pass cross-
checking 5+ independent sources (the official SRD's own legal-page text, a
full markdown conversion of the SRD, D&D Beyond's free-rules pages, and two
mastery-specific reference pages), which caught and discarded one source's
transcription error (a wrong Shortsword mastery assignment) and one
fabricated mastery-property name from an AI-generated search summary. Two
new status effects (**sapped**, **toppled** — `src/game/data/statusEffects.ts`)
back the Sap/Topple masteries' real mechanics, reusing "blinded"'s exact
shape; `Enemy` gained a generic `attacksWithDisadvantage` getter (checked by
`WaveSystem`) so any current or future disadvantage-imposing status works
without a new hardcoded check, the same generalization `armorClass` already
demonstrated for "exposed." See D-108 in `DECISIONS.md` for the full method
and every scope-fork answer.

Phase 18 ("add as many feats as we can from the source material, enforce
prerequisites," this chat) both corrected a real Phase 11.3 sourcing mistake
and added 13 net-new feats. A verification pass against the actual SRD 5.2.1
PDF (not memory) found the real Feats chapter has only 17 entries — not the
~50+ of the full 2024 PHB — and that 3 of the 4 starter feats already shipped
(Tough, Lucky, Athlete) are PHB-exclusive, incorrectly logged as SRD content
back in Phase 11.3. Kevin's call: keep the already-balanced mechanics exactly
as they were, just fix the attribution (see the corrected rows above). The
13 new feats (Magic Initiate/Savage Attacker/Skilled — Origin; Grappler —
General; Archery/Defense/Great Weapon Fighting/Two-Weapon Fighting —
Fighting Style; 7 Epic Boons) are real, freshly-verified SRD content (a
second research pass, cross-checked against an independent fan compilation
and a full-text search of the entire 364-page SRD to rule out any feat
existing elsewhere). This chat also added this codebase's first general
feat-prerequisite check (`Hero.meetsFeatPrerequisites`) — every earlier
class-gated feature hardcoded its own condition inline. See D-109 in
`DECISIONS.md` for the full method, every inert-vs-active call, and the
"Epic Boons are real but practically unreachable at this game's current run
lengths" note.

Phase 19 ("2 weapon fighting seems like it could be and should be
implemented," a later chat) built this game's first real dual-wielding
mechanic — a Light melee weapon may now occupy the existing `"shield"`
gear slot as an off-hand weapon (Shield and off-hand weapon are mutually
exclusive in the SRD anyway) — closing out Two-Weapon Fighting's inert
status from Phase 18 (D-109) AND Nick's inert status from Phase 17
(D-108) in the same pass, since both were blocked by the identical missing
system. No new SRD content was added; this phase made already-logged
content (both rows above) mechanically real. See D-110 in `DECISIONS.md`.

Phase 20 ("add tons of different enemies," this chat) added, all
ORIGINAL, invented for this project, nothing copied or adapted from any
published source:
- **21 new enemies** in `src/game/data/enemies.ts`: sixteen new minions
  (Siegebreaker, Battering Brute, Shadowfang, Nightblade, Sprinter, Bolt
  Runner, Ironhide, Hoarder, Gilded Carrier, Cultist Caller, Bone Summoner,
  Warcaptain, Battlepriest, Bannerbearer, Cave Drake, Frost Warden), one
  new miniboss (Juggernaut), two new true bosses (Warlord Korrath, The
  Devourer), and two new capstone threats (Ashen Sovereign, The Hollow
  Empress) — every name, stat block, lore paragraph, and placeholder
  colour is original to this project.
- **A new role tier, `"legendary"`** (`EnemyRole`), one step above the
  existing "boss" — an original engineering/data concept, not SRD-derived
  (D&D has no directly equivalent "legendary" creature ROLE tag in the
  SRD's free content; "legendary creature" as this project uses it is a
  generic tier label, not a reused SRD mechanic).
- **Six new mechanics** (siege/`siegeDamageMultiplier`, stealth/`stealth`,
  aura buff/`auraBuff`, reinforcements/`callsReinforcements`, treasure/
  `treasureBonusGold`, AoE-breath/`aoeAttack`, pure-runner/`ignoresHeroes`)
  are original engineering built for this project; none reuses an SRD name
  or reproduces SRD mechanical text. The underlying dice/saving-throw
  PRIMITIVES an AoE-plus-save enemy resolves through (`CombatSystem
  .attackArea`, `SavingThrowSystem`) were already logged as SRD-CONCEPT
  reuses in earlier rows (13.5/13.10) — nothing new to log there.
- No new art, audio, or fonts — every new enemy renders with the existing
  coloured-token/name-banner drawing code; the aura ring and the
  low-opacity "hidden" stealth token are new DRAWING CODE, not new assets.

Phase 22 ("magic-item expansion," this chat) added, as four new rows above,
the `+1/+2/+3` enchant CONCEPT, 14 real SRD magic items (`data/
magicItems.ts`), 4 tiers of the real "Potion of Healing" rarity rule plus
four more named potions, and one original item:
- **The Cape of Billowing is NOT SRD content.** A dedicated verification
  pass (per this project's own "verify against the actual document, don't
  assume" policy) confirmed the real published item this evokes — "Cloak of
  Billowing" — is from Xanathar's Guide to Everything, not the free SRD/OGL
  document, so no sourcing claim is made for it. Its name, flavor text, and
  numbers (a modest +1 AC) are entirely original to this project — the same
  correction-precedent treatment Tough/Lucky/Athlete already got after a
  real Phase 11.3 sourcing mistake (D-109). Its `visualEffect:
  "flowingCape"` field and the Phaser drawing code that reads it
  (`BattleScene.updateHeroCapes`) are original engineering, not an asset.
- **A dedicated research pass confirmed the real SRD 5.1 magic-item list is
  large** (hundreds of named items across weapons/armor/shields at
  `+1/+2/+3`, potions, rings, cloaks, boots, bracers, rods, staffs, and
  wands) — verified via two independent SRD mirror sites (one organized by
  type, one by rarity) rather than assumed from general D&D knowledge. Only
  a curated subset that maps onto this game's EXISTING mechanical hooks (a
  flat bonus, one of the four `EquipmentProc` kinds) was built this pass —
  see `DECISIONS.md` D-113 for the full list of real SRD items deliberately
  NOT added (ability-score-setting items, charge-based wands/rods/staffs,
  Cloak of Displacement, Ioun Stones) and exactly why each was deferred.
- **The loot-drop system itself** (`systems/LootSystem.ts`) and **the
  shop's level-gating rule** (`systems/ShopSystem.ts`) are both entirely
  ORIGINAL engineering — no SRD loot-table or shop-restocking rule is
  claimed or reused; only the RARITY TIER NAMES they key off of are the
  already-logged SRD concept from Phase 13.9 (D-094) above.
- No new art, audio, or fonts — the flowing-cape effect is new Phaser
  `Graphics` DRAWING CODE, not a new asset, the same treatment Phase 20's
  aura ring already established.

D-127 ("four foundational systems," this chat) added 6 more real SRD magic
items to `data/magicItems.ts` — three from each of the two families Phase 22
(D-113) explicitly deferred (see that row above):
- **Wand of Magic Missile, Wand of Web, Staff of Healing** — real SRD 5.1
  charge-based active items (CC BY 4.0), reusing the real Magic Missile/Web/
  Cure Wounds spells already in `data/spells.ts` (Phase 15/16, D-104/D-106).
  Charge counts (7/6/10) match the real SRD; the recharge cadence is
  simplified to "fully refills on a Long Rest" rather than the real SRD's
  daily partial-recharge dice roll, the same simplification this project
  already applies to every other per-rest resource.
- **Gauntlets of Ogre Power, Headband of Intellect, Amulet of Health** —
  real SRD 5.1 ability-score-setting items (CC BY 4.0), each setting one
  ability score to 19 while worn, matching the real SRD text (with no effect
  if the wearer's own score is already 19 or higher).
- The new `EquipmentDefinition.chargedSpell`/`setsAbilityScore` fields and
  every `Hero`-side mechanic reading them (`onGearChanged`,
  `effectiveAbilityScore`, `recomputeCombatStats`) are original engineering,
  not SRD content — only the six items' names/numbers/flavor above are
  SRD-derived.
- No new art, audio, or fonts — these render with the existing
  coloured-shape/name-label equipment presentation, same as every other
  magic item in this project.

D-131 ("a full damage-type mechanical engine," this chat) added no new
spells/items/enemies to the catalogue, but DOES record a new SRD-derived
FACT for existing content, the same treatment already given to spell names/
levels/schools above:
- **Per-spell `damageType`** on 47 of the ~198 castable spells
  (`data/abilities.ts`) — WHICH real damage type each real SRD spell deals
  (Fire Bolt is fire, Fireball is fire, Ray of Frost is cold, Sacred Flame
  is radiant, Eldritch Blast is force, etc.) is a verified fact about
  already-logged SRD content, not new copied SRD text — the same category
  of fact this file already tracks for spell name/level/school. A handful
  of real spells split damage across two types (Ice Storm: bludgeoning +
  cold; Flame Strike: fire + radiant; Meteor Swarm: fire + bludgeoning;
  Storm of Vengeance: thunder/lightning/bludgeoning across rounds) — this
  engine models one type per hit, so a single representative type was
  picked by judgment in each case, documented inline in `abilities.ts`.
  Prismatic Spray (genuinely random-per-ray) and Wish (caster picks any
  type) have no single real type to assign, so neither was tagged.
- **The full SRD damage-type taxonomy itself** (`data/weapons.ts`'s
  `DamageType` union — acid/bludgeoning/cold/fire/force/lightning/
  necrotic/piercing/poison/psychic/radiant/slashing/thunder) is the
  standard SRD 5e list, not original content.
- **Every enemy's new `damageResistances`/`damageVulnerabilities`/
  `damageImmunities` value is ORIGINAL content**, not SRD-derived — these
  are original monsters (see the Phase 7/11.6/13.10/20/21/23/24/25 rows
  above), so no real stat block exists to copy a resistance from; each tag
  is this project's own judgment call keyed off that enemy's own existing
  name/lore, same as every other original-content decision in this file.
  The one exception: the general CONCEPT of "resistance/vulnerability/
  immunity" and the specific real-5e patterns applied (undead commonly
  resist necrotic/are vulnerable to radiant; oozes are immune to acid;
  constructs lack organs to poison) are standard 5e monster-design
  knowledge, not copied text from any specific stat block.

## Rules for future chats

- Any asset (image, audio, font) or any rules text taken from outside this project
  must be added as a row above BEFORE it is committed.
- SRD-derived content is only allowed if confirmed present in **SRD 5.1 or SRD
  5.2.1** and used under **CC BY 4.0** (SRD 5.1 is also usable under **OGL 1.0a**,
  which WotC has confirmed remains valid and untouched — both licenses cover
  identical content, just released under different license terms at different
  times). Log it here and add the exact required attribution text to the game
  credits and repository before any public release.
- **Verify against the actual document, don't assume from general D&D knowledge**
  (added Phase 14.1/14.2, D-098/D-099, after a real mistake this way — Circle of
  the Moon was assumed to be Druid's SRD subclass and wasn't). Both SRD versions
  license exactly ONE subclass per class, ALL Wizard cantrips/cantrip-adjacent
  content actually printed there, etc. — check the real page/PDF (WebFetch/
  WebSearch) before logging a new SRD-derived row, especially for anything
  beyond what's already logged above. This same policy applies to spells, items,
  and creatures, not just subclasses.
- Do NOT use "Dungeons & Dragons" or "D&D" in the title, logo, domain, or branding.
- Do NOT use official D&D logos, trade dress, artwork, music, screenshots, UI assets,
  or Forgotten Realms setting material.
- If a source or license is unclear, treat it as "Prohibited pending review" and do
  not add it to the project.
