import Phaser from "phaser";
import { GAME_WIDTH } from "../config";
import { firebaseReady } from "../cloud/firebaseApp";
import { initAuth, type AuthState } from "../cloud/AuthClient";
import { createSession, joinSession, subscribeToSession, deleteSession, startBattle } from "../cloud/CoopSessionSync";
import {
  MAX_COOP_PARTICIPANTS,
  SESSION_CODE_LENGTH,
  isSessionFull,
  isCoopBattleActive,
  type CoopSessionRecord,
} from "../systems/CoopSessionSystem";
import { HERO_DEFINITIONS } from "../data/heroes";

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
 * alternating-slot split across the classic fixed roster — no per-hero
 * picker UI yet, see that function's own comment) and flips the session to
 * `status: "battle"`. The guest's client detects that transition via its
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
  private createButton!: Phaser.GameObjects.Rectangle;
  private joinButton!: Phaser.GameObjects.Rectangle;
  private joinCodeInput: Phaser.GameObjects.DOMElement | null = null;
  private joinSubmitButton: Phaser.GameObjects.Rectangle | null = null;
  private sessionCodeText: Phaser.GameObjects.Text | null = null;
  private participantsText: Phaser.GameObjects.Text | null = null;
  private startBattleButton: Phaser.GameObjects.Rectangle | null = null;
  private startBattleLabel: Phaser.GameObjects.Text | null = null;
  private choiceObjects: Phaser.GameObjects.GameObject[] = [];
  private joinObjects: Phaser.GameObjects.GameObject[] = [];
  private sessionObjects: Phaser.GameObjects.GameObject[] = [];

  constructor() {
    super("CoopLobbyScene");
  }

  create(): void {
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
    this.startBattleLabel = null;
    this.choiceObjects = [];
    this.joinObjects = [];
    this.sessionObjects = [];

    this.cameras.main.setBackgroundColor("#0e0e14");

    this.add
      .text(GAME_WIDTH / 2, 40, "Cooperative Play", {
        fontFamily: "system-ui, Arial, sans-serif",
        fontSize: "36px",
        color: "#e8e8f0",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    this.buildSmallButton(110, 40, 160, 44, "Back (Esc)", 0x2a2a3a, () => this.leave());
    this.input.keyboard?.on("keydown-ESC", () => this.leave());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.teardown());

    if (!firebaseReady) {
      this.add
        .text(GAME_WIDTH / 2, 200, "Cooperative play needs a configured Firebase project.", {
          fontFamily: "system-ui, Arial, sans-serif",
          fontSize: "16px",
          color: "#e0a860",
        })
        .setOrigin(0.5);
      return;
    }

    this.statusText = this.add
      .text(GAME_WIDTH / 2, 130, "Connecting…", {
        fontFamily: "system-ui, Arial, sans-serif",
        fontSize: "16px",
        color: "#8a8aa0",
      })
      .setOrigin(0.5);

    initAuth((state) => {
      this.authState = state;
      this.refresh();
    });

    this.buildChoiceSection();
    this.buildJoinSection();
    this.buildSessionSection();
    this.refresh();
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

  /** Small button+label pair, matching this project's simple rectangle-button style. */
  private buildSmallButton(
    x: number,
    y: number,
    w: number,
    h: number,
    text: string,
    color: number,
    onClick: () => void,
  ): { rect: Phaser.GameObjects.Rectangle; label: Phaser.GameObjects.Text } {
    const rect = this.add
      .rectangle(x, y, w, h, color)
      .setStrokeStyle(1, 0x4a4a5a)
      .setInteractive({ useHandCursor: true });
    const label = this.add
      .text(x, y, text, { fontFamily: "system-ui, Arial, sans-serif", fontSize: "14px", color: "#e8e8f0" })
      .setOrigin(0.5);
    rect.on("pointerover", () => rect.setFillStyle(color === 0x4caf72 ? 0x66c98c : 0x3a3a4a));
    rect.on("pointerout", () => rect.setFillStyle(color));
    rect.on("pointerdown", onClick);
    return { rect, label };
  }

  private buildChoiceSection(): void {
    const y = 220;
    const { rect: createRect, label: createLabel } = this.buildSmallButton(
      GAME_WIDTH / 2 - 170,
      y,
      300,
      54,
      "Create Session",
      0x4caf72,
      () => this.onCreateSession(),
    );
    this.createButton = createRect;

    const { rect: joinRect, label: joinLabel } = this.buildSmallButton(
      GAME_WIDTH / 2 + 170,
      y,
      300,
      54,
      "Join Session",
      0x2a2a3a,
      () => {
        this.mode = "join";
        this.refresh();
      },
    );
    this.joinButton = joinRect;

    this.choiceObjects = [createRect, createLabel, joinRect, joinLabel];
  }

  private buildJoinSection(): void {
    const y = 310;
    const inputDom = this.add
      .dom(GAME_WIDTH / 2 - 100, y)
      .createFromHTML(
        `<input type="text" maxlength="${SESSION_CODE_LENGTH}" placeholder="CODE" style="
          width: 160px; height: 44px; font-size: 22px; font-family: monospace;
          text-align: center; letter-spacing: 4px; text-transform: uppercase;
          background: #1a1a24; color: #e8e8f0; border: 1px solid #4a4a5a;
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

    const { rect, label } = this.buildSmallButton(GAME_WIDTH / 2 + 110, y, 160, 44, "Join", 0x4caf72, () =>
      this.onSubmitJoinCode(),
    );
    this.joinSubmitButton = rect;

    this.joinObjects = [inputDom, rect, label];
  }

  private buildSessionSection(): void {
    this.sessionCodeText = this.add
      .text(GAME_WIDTH / 2, 260, "", {
        fontFamily: "monospace",
        fontSize: "48px",
        color: "#e8e8f0",
        fontStyle: "bold",
        letterSpacing: 6,
      } as Phaser.Types.GameObjects.Text.TextStyle)
      .setOrigin(0.5);

    this.participantsText = this.add
      .text(GAME_WIDTH / 2, 340, "", {
        fontFamily: "system-ui, Arial, sans-serif",
        fontSize: "18px",
        color: "#c8c8d8",
        align: "center",
      })
      .setOrigin(0.5);

    const { rect: startRect, label: startLabel } = this.buildSmallButton(
      GAME_WIDTH / 2,
      400,
      260,
      48,
      "Start Battle",
      0x4caf72,
      () => this.onStartBattle(),
    );
    this.startBattleButton = startRect;
    this.startBattleLabel = startLabel;

    const { rect, label } = this.buildSmallButton(GAME_WIDTH / 2, 460, 220, 44, "Leave", 0x8a3a3a, () =>
      this.onLeaveSession(),
    );

    this.sessionObjects = [this.sessionCodeText, this.participantsText, startRect, startLabel, rect, label];
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
    startBattle(this.session.id, HERO_DEFINITIONS.map((def) => def.id), Date.now())
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
    if (enabled) {
      this.createButton?.setInteractive({ useHandCursor: true });
      this.joinButton?.setInteractive({ useHandCursor: true });
      this.joinSubmitButton?.setInteractive({ useHandCursor: true });
    } else {
      this.createButton?.disableInteractive();
      this.joinButton?.disableInteractive();
      this.joinSubmitButton?.disableInteractive();
    }

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
      this.startBattleButton?.setVisible(isHost && full);
      this.startBattleLabel?.setVisible(isHost && full).setText(this.busy ? "Starting…" : "Start Battle");
      if (isHost && full && enabled) this.startBattleButton?.setInteractive({ useHandCursor: true });
      else this.startBattleButton?.disableInteractive();
    }
  }
}
