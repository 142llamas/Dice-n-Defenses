import Phaser from "phaser";
import { firebaseReady } from "../cloud/firebaseApp";
import {
  getViewport,
  onViewportResize,
  fixDomContainerAlignment,
  createOrnateButton,
  drawScreenBackdrop,
  spawnAmbientMotes,
  FONT_DISPLAY,
  FONT_BODY,
  type OrnateButtonHandle,
} from "./uiTheme";
import { initAuth, type AuthState } from "../cloud/AuthClient";
import { createSession, joinSession, subscribeToSession, deleteSession, startBattle } from "../cloud/CoopSessionSync";
import {
  MAX_COOP_PARTICIPANTS,
  SESSION_CODE_LENGTH,
  isSessionFull,
  isCoopBattleActive,
  type CoopSessionRecord,
} from "../systems/CoopSessionSystem";
import { defaultPartyBuilds, heroDefinitionFromBuild } from "../systems/CharacterBuildSystem";
import type { HeroDefinition } from "../data/heroes";

// Co-op has no per-hero picker UI yet, so it needs SOME valid party to hand
// to BattleScene — a small, fixed, deterministic set of fresh level-1 D&D
// builds, the same shape a real character-creation run would produce.
// Computed once at module load so `onStartBattle`'s hero-id list and
// `enterBattle`'s `heroDefinitions` always agree on the same four ids.
const DEFAULT_COOP_HERO_DEFINITIONS: HeroDefinition[] = defaultPartyBuilds(4).map(heroDefinitionFromBuild);

/**
 * CoopLobbyScene — Phase 12.2 (D-102): create-or-join UI for a cooperative
 * multiplayer LOBBY session. Reached from `MainMenuScene`'s "Co-op" button
 * (Firebase-only, same gating as "Browse Shared Maps").
 *
 * Scope is deliberately just the lobby (the design doc's "local-only stub"
 * framing for this sub-phase): create a session and get a shareable code,
 * or join one by code, and see who's in it update live.
 *
 * Phase 12.3 (D-103) adds "Start Battle" (host-only, once the session is
 * full): assigns hero ownership (`CoopSessionSystem.startCoopBattle`, an
 * alternating-slot split across `DEFAULT_COOP_HERO_DEFINITIONS` — no
 * per-hero picker UI yet, see that function's own comment) and flips the
 * session to `status: "battle"`. The guest's client detects that transition
 * via its
 * existing `subscribeToSession` and auto-navigates too. Both clients land
 * in `BattleScene` with a `coopSession` context that gates hero selection
 * to heroes you own — but the two clients' boards do NOT yet stay in sync
 * with each other's actions (no result-broadcast this sub-phase — see
 * `PHASE_HANDOFF.md`).
 *
 * This scene is also this project's FIRST use of a real HTML `<input>`
 * (a Phaser DOM Element) — the join-code field. Every other "name" in this
 * project cycles through a preset list; a 6-character invite code shared
 * over chat needs real paste support, which only a genuine form field
 * gives for free (see `PHASE_12_MULTIPLAYER_FEASIBILITY.md`'s own note on
 * this, and `main.ts`'s `dom.createContainer` config this scene relies on).
 */

type Mode = "choose" | "join" | "in-session";

export class CoopLobbyScene extends Phaser.Scene {
  private mode: Mode = "choose";
  private authState: AuthState = { uid: null, isAnonymous: true, displayName: null };
  private session: CoopSessionRecord | null = null;
  private statusMessage = "";
  private busy = false;
  private unsubscribeSession: (() => void) | null = null;

  private statusText!: Phaser.GameObjects.Text;
  private createButton!: OrnateButtonHandle;
  private joinButton!: OrnateButtonHandle;
  private joinCodeInput: Phaser.GameObjects.DOMElement | null = null;
  private joinSubmitButton: OrnateButtonHandle | null = null;
  private sessionCodeText: Phaser.GameObjects.Text | null = null;
  private participantsText: Phaser.GameObjects.Text | null = null;
  private startBattleButton: OrnateButtonHandle | null = null;
  private choiceObjects: Phaser.GameObjects.GameObject[] = [];
  private joinObjects: Phaser.GameObjects.GameObject[] = [];
  private sessionObjects: Phaser.GameObjects.GameObject[] = [];
  // D-154: every object in this scene is built ONCE in `create()` and only
  // ever toggled visible/text-updated afterward (never destroyed and
  // recreated) — this scene's join-code `<input>` is a real DOM element that
  // would drop whatever the player already typed (and keyboard focus) if
  // rebuilt from scratch, so unlike every other scene converted this
  // session, resize-reactivity here means REPOSITIONING existing objects in
  // place, not a destroy-and-recreate `rebuildLayout()`. Each entry is an
  // object centered at `viewportWidth / 2 + dx` at a fixed `y`.
  private centeredObjects: { obj: { setPosition(x: number, y: number): unknown }; dx: number; y: number }[] = [];

  constructor() {
    super("CoopLobbyScene");
  }

  create(): void {
    // D-211: same root-caused DOM-container alignment fix as
    // `CharacterCreationScene` — this scene's join-code field (KI-062) is
    // this project's other real DOM `<input>`, subject to the identical
    // `ScaleManager`/flexbox-centering mismatch. See `fixDomContainerAlignment`'s
    // own doc comment in `uiTheme.ts` for the mechanism.
    this.scale.refresh();
    fixDomContainerAlignment(this);
    onViewportResize(this, () => fixDomContainerAlignment(this));

    this.mode = "choose";
    this.authState = { uid: null, isAnonymous: true, displayName: null };
    this.session = null;
    this.statusMessage = "";
    this.busy = false;
    this.unsubscribeSession = null;
    this.joinCodeInput = null;
    this.joinSubmitButton = null;
    this.sessionCodeText = null;
    this.participantsText = null;
    this.startBattleButton = null;
    this.choiceObjects = [];
    this.joinObjects = [];
    this.sessionObjects = [];
    this.centeredObjects = [];

    drawScreenBackdrop(this);
    spawnAmbientMotes(this, 12);
    const cx = getViewport(this).width / 2;

    const title = this.add
      .text(cx, 40, "Cooperative Play", {
        fontFamily: FONT_DISPLAY,
        fontSize: "36px",
        color: "#f0dfa8",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setDepth(1);
    this.centeredObjects.push({ obj: title, dx: 0, y: 40 });

    createOrnateButton(this, 110, 40, 160, 44, "Back (Esc)", () => this.leave(), { variant: "tool", depth: 10 });
    this.input.keyboard?.on("keydown-ESC", () => this.leave());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.teardown());
    onViewportResize(this, () => this.repositionLayout());

    if (!firebaseReady) {
      const notice = this.add
        .text(cx, 200, "Cooperative play needs a configured Firebase project.", {
          fontFamily: FONT_BODY,
          fontSize: "16px",
          color: "#e0a860",
        })
        .setOrigin(0.5)
        .setDepth(1);
      this.centeredObjects.push({ obj: notice, dx: 0, y: 200 });
      return;
    }

    this.statusText = this.add
      .text(cx, 130, "Connecting…", {
        fontFamily: FONT_BODY,
        fontSize: "16px",
        color: "#b8a074",
      })
      .setOrigin(0.5)
      .setDepth(1);
    this.centeredObjects.push({ obj: this.statusText, dx: 0, y: 130 });

    initAuth((state) => {
      this.authState = state;
      this.refresh();
    });

    this.buildChoiceSection(cx);
    this.buildJoinSection(cx);
    this.buildSessionSection(cx);
    this.refresh();
  }

  /**
   * D-211: a one-time correction plus resize-event reapplication went stale
   * against live browser zoom/resize churn in `CharacterCreationScene`
   * (confirmed via a Kevin screenshot — the fix's math was right, but its
   * timing wasn't) — re-running it every frame instead is self-healing
   * regardless of what caused the drift. Same fix applied here since this
   * scene's join-code field is subject to the identical mechanism. Cheap
   * for a non-battle scene.
   */
  update(): void {
    fixDomContainerAlignment(this);
  }

  // D-154: moves every registered object back to `viewportWidth / 2 + dx` at
  // its own fixed `y` — safe to call anytime (including on the DOM `<input>`,
  // which keeps its typed value and focus since it's never rebuilt).
  private repositionLayout(): void {
    const cx = getViewport(this).width / 2;
    for (const { obj, dx, y } of this.centeredObjects) obj.setPosition(cx + dx, y);
  }

  private teardown(): void {
    this.unsubscribeSession?.();
    this.unsubscribeSession = null;
    this.input.removeAllListeners();
    this.input.keyboard?.removeAllListeners();
  }

  private leave(): void {
    this.scene.start("MainMenuScene");
  }

  private buildChoiceSection(cx: number): void {
    const y = 220;
    const createHandle = createOrnateButton(
      this,
      cx - 170,
      y,
      300,
      54,
      "Create Session",
      () => this.onCreateSession(),
      { variant: "secondary", depth: 10 },
    );
    this.createButton = createHandle;
    this.centeredObjects.push({ obj: createHandle.container, dx: -170, y });

    const joinHandle = createOrnateButton(
      this,
      cx + 170,
      y,
      300,
      54,
      "Join Session",
      () => {
        this.mode = "join";
        this.refresh();
      },
      { variant: "secondary", depth: 10 },
    );
    this.joinButton = joinHandle;
    this.centeredObjects.push({ obj: joinHandle.container, dx: 170, y });

    this.choiceObjects = [createHandle.container, joinHandle.container];
  }

  private buildJoinSection(cx: number): void {
    const y = 310;
    const inputDom = this.add
      .dom(cx - 100, y)
      .createFromHTML(
        `<input type="text" maxlength="${SESSION_CODE_LENGTH}" placeholder="CODE" style="
          width: 160px; height: 44px; font-size: 22px; font-family: 'Courier New', monospace;
          text-align: center; letter-spacing: 4px; text-transform: uppercase;
          background: #e8d8ae; color: #2a1a10; border: 2px solid #9a7a3e;
          border-radius: 4px; outline: none; box-sizing: border-box;
        " />`,
      )
      .setOrigin(0.5);
    const node = inputDom.node.querySelector("input") as HTMLInputElement;
    node.addEventListener("input", () => {
      node.value = node.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, SESSION_CODE_LENGTH);
    });
    node.addEventListener("keydown", (e: KeyboardEvent) => {
      e.stopPropagation(); // don't let typing leak into this scene's own hotkeys (e.g. Esc)
      if (e.key === "Enter") this.onSubmitJoinCode();
    });
    this.joinCodeInput = inputDom;
    this.centeredObjects.push({ obj: inputDom, dx: -100, y });

    const submitHandle = createOrnateButton(this, cx + 110, y, 160, 44, "Join", () => this.onSubmitJoinCode(), {
      variant: "tool",
      depth: 10,
    });
    this.joinSubmitButton = submitHandle;
    this.centeredObjects.push({ obj: submitHandle.container, dx: 110, y });

    this.joinObjects = [inputDom, submitHandle.container];
  }

  private buildSessionSection(cx: number): void {
    this.sessionCodeText = this.add
      .text(cx, 260, "", {
        fontFamily: "monospace",
        fontSize: "48px",
        color: "#e8c25a",
        fontStyle: "bold",
        letterSpacing: 6,
      } as Phaser.Types.GameObjects.Text.TextStyle)
      .setOrigin(0.5)
      .setDepth(1);
    this.centeredObjects.push({ obj: this.sessionCodeText, dx: 0, y: 260 });

    this.participantsText = this.add
      .text(cx, 340, "", {
        fontFamily: FONT_BODY,
        fontSize: "18px",
        color: "#e8d8ae",
        align: "center",
      })
      .setOrigin(0.5)
      .setDepth(1);
    this.centeredObjects.push({ obj: this.participantsText, dx: 0, y: 340 });

    const startHandle = createOrnateButton(this, cx, 400, 260, 48, "Start Battle", () => this.onStartBattle(), {
      variant: "secondary",
      depth: 10,
    });
    this.startBattleButton = startHandle;
    this.centeredObjects.push({ obj: startHandle.container, dx: 0, y: 400 });

    const leaveHandle = createOrnateButton(this, cx, 460, 220, 44, "Leave", () => this.onLeaveSession(), {
      variant: "tool",
      depth: 10,
    });
    this.centeredObjects.push({ obj: leaveHandle.container, dx: 0, y: 460 });

    this.sessionObjects = [this.sessionCodeText, this.participantsText, startHandle.container, leaveHandle.container];
  }

  private currentParticipant(joinedAt: number): { uid: string; displayName: string | null; joinedAt: number } {
    return { uid: this.authState.uid ?? "", displayName: this.authState.displayName, joinedAt };
  }

  private onCreateSession(): void {
    if (this.busy || !this.authState.uid) return;
    this.busy = true;
    this.statusMessage = "Creating session…";
    this.refresh();
    createSession(this.currentParticipant(Date.now()))
      .then((record) => {
        this.busy = false;
        if (!record) {
          this.statusMessage = "Could not create a session.";
          this.refresh();
          return;
        }
        this.enterSession(record);
      })
      .catch((err) => {
        console.error("Failed to create coop session:", err);
        this.busy = false;
        this.statusMessage = "Could not create a session — please try again.";
        this.refresh();
      });
  }

  private onSubmitJoinCode(): void {
    if (this.busy || !this.authState.uid || !this.joinCodeInput) return;
    const node = this.joinCodeInput.node.querySelector("input") as HTMLInputElement;
    const code = node.value.trim().toUpperCase();
    if (code.length !== SESSION_CODE_LENGTH) {
      this.statusMessage = `Enter the full ${SESSION_CODE_LENGTH}-character code.`;
      this.refresh();
      return;
    }
    this.busy = true;
    this.statusMessage = "Joining…";
    this.refresh();
    joinSession(code, this.currentParticipant(Date.now()))
      .then((result) => {
        this.busy = false;
        if (result.outcome === "joined" || result.outcome === "already-in-session") {
          if (result.record) this.enterSession(result.record);
          return;
        }
        this.statusMessage = {
          "not-found": "No session found with that code.",
          full: "That session already has two players.",
          "version-mismatch": "That session was created by a different game version.",
        }[result.outcome];
        this.refresh();
      })
      .catch((err) => {
        console.error("Failed to join coop session:", err);
        this.busy = false;
        this.statusMessage = "Could not join that session — please try again.";
        this.refresh();
      });
  }

  private onStartBattle(): void {
    if (this.busy || !this.session || !this.authState.uid) return;
    if (this.authState.uid !== this.session.hostUid || !isSessionFull(this.session)) return;
    this.busy = true;
    this.statusMessage = "Starting battle…";
    this.refresh();
    startBattle(this.session.id, DEFAULT_COOP_HERO_DEFINITIONS.map((def) => def.id), Date.now())
      .then((record) => {
        this.busy = false;
        if (!record) {
          this.statusMessage = "Could not start the battle — please try again.";
          this.refresh();
          return;
        }
        this.enterBattle(record);
      })
      .catch((err) => {
        console.error("Failed to start coop battle:", err);
        this.busy = false;
        this.statusMessage = "Could not start the battle — please try again.";
        this.refresh();
      });
  }

  /** Both the host (right after `onStartBattle` succeeds) and the guest (via `subscribeToSession`, once `status` flips) land here. */
  private enterBattle(record: CoopSessionRecord): void {
    const localUid = this.authState.uid;
    if (!localUid) return;
    const partner = record.participants.find((p) => p.uid !== localUid);
    this.unsubscribeSession?.();
    this.unsubscribeSession = null;
    this.scene.start("BattleScene", {
      heroDefinitions: DEFAULT_COOP_HERO_DEFINITIONS,
      coopSession: {
        code: record.id,
        localUid,
        heroOwners: record.heroOwners,
        partnerName: partner?.displayName ?? "your partner",
      },
    });
  }

  private onLeaveSession(): void {
    const code = this.session?.id;
    const wasHost = !!this.session && this.session.hostUid === this.authState.uid;
    this.unsubscribeSession?.();
    this.unsubscribeSession = null;
    this.session = null;
    this.mode = "choose";
    this.statusMessage = "";
    this.refresh();
    if (code && wasHost) {
      deleteSession(code).catch((err) => console.error("Failed to delete coop session:", err));
    }
  }

  private enterSession(record: CoopSessionRecord): void {
    this.session = record;
    this.mode = "in-session";
    this.statusMessage = "";
    this.unsubscribeSession?.();
    this.unsubscribeSession = subscribeToSession(record.id, (updated) => {
      if (!updated) return; // deleted (e.g. the host left) — this client just keeps its last-known view
      this.session = updated;
      // Phase 12.3 (D-103): the GUEST's path into battle — the host's own
      // client instead transitions directly from `onStartBattle`'s success
      // callback, without waiting for this same round-trip.
      if (isCoopBattleActive(updated) && updated.hostUid !== this.authState.uid) {
        this.enterBattle(updated);
        return;
      }
      this.refresh();
    });
    this.refresh();
  }

  private refresh(): void {
    if (!firebaseReady) return;

    const signedIn = this.authState.uid !== null;
    this.statusText.setText(!signedIn ? "Connecting…" : this.statusMessage);

    this.choiceObjects.forEach((o) => (o as { setVisible?: (v: boolean) => void }).setVisible?.(this.mode === "choose"));
    this.joinObjects.forEach((o) => (o as { setVisible?: (v: boolean) => void }).setVisible?.(this.mode === "join"));
    this.sessionObjects.forEach((o) =>
      (o as { setVisible?: (v: boolean) => void }).setVisible?.(this.mode === "in-session"),
    );

    const enabled = signedIn && !this.busy;
    this.createButton?.setDisabled(!enabled);
    this.joinButton?.setDisabled(!enabled);
    this.joinSubmitButton?.setDisabled(!enabled);

    if (this.mode === "in-session" && this.session) {
      this.sessionCodeText?.setText(this.session.id);
      const names = this.session.participants.map((p) => {
        const you = p.uid === this.authState.uid ? " (you)" : "";
        const role = p.uid === this.session!.hostUid ? "Host" : "Guest";
        return `${role}: ${p.displayName ?? "Anonymous"}${you}`;
      });
      const waitingFor = MAX_COOP_PARTICIPANTS - this.session.participants.length;
      const status =
        waitingFor > 0
          ? `\nWaiting for ${waitingFor} more player${waitingFor === 1 ? "" : "s"}…`
          : "\nBoth players are here!";
      this.participantsText?.setText(names.join("\n") + status);

      // Phase 12.3 (D-103): the host starts the battle once full; a guest
      // just watches (their client auto-navigates via `enterSession`'s
      // subscription once `status` flips, so this button is never theirs to
      // click).
      const isHost = this.session.hostUid === this.authState.uid;
      const full = isSessionFull(this.session);
      this.startBattleButton?.container.setVisible(isHost && full);
      this.startBattleButton?.setLabel(this.busy ? "Starting…" : "Start Battle");
      this.startBattleButton?.setDisabled(!(isHost && full && enabled));
    }
  }
}
