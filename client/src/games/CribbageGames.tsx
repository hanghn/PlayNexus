import type { CribbageView, CribbageMove, Card, ScoreEvent } from "@gamenite/shared";
import { cardValue } from "@gamenite/shared";
import type { GameProps } from "../util/types.ts";
import { useEffect, useState, useRef } from "react";
import type { ReactNode } from "react";
import GameResult from "../components/GameResult.tsx";
import useKeyboardNav from "../hooks/useKeyboardNav.ts";
import PegBoard from "./PegBoard.tsx";
import { announce } from "../lib/liveAnnounce.ts";
import "./Cribbage.css";

/* Card helpers */

function suitSymbol(suit: Card["suit"]): string {
  if (suit === "H") return "♥";
  if (suit === "D") return "♦";
  if (suit === "C") return "♣";
  return "♠";
}

const isRed = (suit: Card["suit"]) => suit === "H" || suit === "D";
const same = (a: Card, b: Card) => a.rank === b.rank && a.suit === b.suit;

/* Guarded localStorage access so non-browser environments (tests, SSR) don't
   crash when reading/writing the colour settings. */
function readStored(key: string, fallback: string): string {
  try {
    return (typeof localStorage !== "undefined" ? localStorage.getItem(key) : null) ?? fallback;
  } catch {
    return fallback;
  }
}
function writeStored(key: string, value: string): void {
  try {
    if (typeof localStorage !== "undefined") localStorage.setItem(key, value);
  } catch {
    /* ignore (private mode / unavailable) */
  }
}

function rankLabel(rank: number): string {
  if (rank === 1) return "A";
  if (rank === 11) return "J";
  if (rank === 12) return "Q";
  if (rank === 13) return "K";
  return String(rank);
}

function cardKey(c: Card) {
  return `${rankLabel(c.rank)}${c.suit}`;
}

function cardLabel(c: Card) {
  return `${rankLabel(c.rank)}${suitSymbol(c.suit)}`;
}

/* PlayingCard: a nice-looking card face (or a face-down back) */

type DealAnim = "up" | "down" | "play" | "none";

function dealClassFor(dealAnim: DealAnim): string {
  if (dealAnim === "up") return "crib-deal-up";
  if (dealAnim === "down") return "crib-deal-down";
  if (dealAnim === "play") return "crib-play-in";
  return "";
}

function CardBack({
  dealAnim = "none",
  dealIndex = 0,
}: {
  dealAnim?: DealAnim;
  dealIndex?: number;
}) {
  return (
    <div
      className={`crib-card crib-card--back ${dealClassFor(dealAnim)}`}
      style={{ ["--deal-i" as string]: dealIndex }}
      aria-hidden
    />
  );
}

function PlayingCard({
  card,
  onClick,
  picked = false,
  disabled = false,
  dealAnim = "none",
  dealIndex = 0,
  highlight = false,
}: {
  card: Card;
  onClick?: () => void;
  picked?: boolean;
  disabled?: boolean;
  dealAnim?: DealAnim;
  dealIndex?: number;
  highlight?: boolean;
}) {
  const color = isRed(card.suit) ? "#d40000" : "#111";
  const dealClass = dealClassFor(dealAnim);
  const hl = highlight ? "is-highlight" : "";
  const interactive = !!onClick && !disabled;
  const symbol = suitSymbol(card.suit);

  const corner = (cls: string) => (
    <span className={`crib-index ${cls}`} style={{ color }}>
      <span className="crib-index-rank">{rankLabel(card.rank)}</span>
    </span>
  );

  /* A big rank in the corners and a single suit symbol in the centre — clean
     and legible (the full pip grid felt cramped, especially for clubs). */
  const inner = (
    <>
      {corner("crib-index--tl")}
      {corner("crib-index--br")}
      <span className="crib-figure" style={{ color }}>
        {symbol}
      </span>
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={interactive ? onClick : undefined}
        disabled={disabled}
        aria-pressed={picked}
        aria-label={`${rankLabel(card.rank)} of ${card.suit}`}
        className={`crib-card ${dealClass} ${hl} ${picked ? "is-picked" : ""} ${interactive ? "is-clickable" : ""} ${disabled ? "is-disabled" : ""}`}
        style={{ ["--deal-i" as string]: dealIndex }}
      >
        {inner}
      </button>
    );
  }

  return (
    <div
      className={`crib-card ${dealClass} ${hl}`}
      style={{ ["--deal-i" as string]: dealIndex }}
      aria-label={`${rankLabel(card.rank)} of ${card.suit}`}
    >
      {inner}
    </div>
  );
}

/* Seat: a player's name plate plus their row of cards  */

function Seat({
  name,
  score,
  isDealer,
  isTurn,
  children,
  position,
  overlay,
  rowRef,
}: {
  name: string;
  score: number;
  isDealer: boolean;
  isTurn: boolean;
  children: ReactNode;
  position: "top" | "bottom";
  overlay?: ReactNode;
  rowRef?: React.Ref<HTMLDivElement>;
}) {
  const plate = (
    <div className="crib-nameplate">
      <span>{name}</span>
      <span className="crib-score">{score}</span>
      {isDealer && <span className="crib-dealer-chip">Dealer</span>}
      {isTurn && <span className="crib-turn-chip">Turn</span>}
    </div>
  );
  return (
    <div className={`crib-seat crib-seat--${position}`}>
      {position === "top" && plate}
      <div className="crib-row-wrap">
        <div className="crib-row" ref={rowRef}>
          {children}
        </div>
        {overlay}
      </div>
      {position === "bottom" && plate}
    </div>
  );
}

/* Friendly names for the real-time scoring callouts (15s, pairs, runs, flushes,
   his nobs, his heels, …) */
const scoreCalloutLabel: Record<ScoreEvent["category"], string> = {
  fifteen: "Fifteen",
  pair: "Pair",
  pairRoyal: "Three of a kind",
  doublePairRoyal: "Four of a kind",
  run: "Run",
  flush: "Flush",
  nob: "His Nobs",
  heels: "His Heels",
  go: "Go",
  thirtyOne: "Thirty-one",
  lastCard: "Last card",
};

/* A single scoring callout, absolutely centred over whatever region it is
   rendered inside (the scoring hand, the pegging pile, the crib, …). */
function ScoreToast({ event, mine }: { event: ScoreEvent; mine: boolean }) {
  return (
    <div className="crib-toast-anchor">
      <div className={`crib-toast crib-toast--${mine ? "you" : "opp"}`}>
        <span className="crib-toast-label">{scoreCalloutLabel[event.category]} for</span>
        <span className="crib-toast-num">{event.points}</span>
        <span className="crib-toast-unit">{event.points === 1 ? "point" : "points"}</span>
      </div>
    </div>
  );
}

/* Board (felt) and card-back colour options for the in-game settings. */
const BOARD_COLORS = [
  { name: "Green", value: "#1f7a3d" },
  { name: "Forest", value: "#176030" },
  { name: "Blue", value: "#1b4a8f" },
  { name: "Crimson", value: "#8f2330" },
  { name: "Teal", value: "#1f6b63" },
  { name: "Slate", value: "#3a4a5e" },
];
const CARD_COLORS = [
  { name: "Blue", value: "#1f3a93" },
  { name: "Green", value: "#1c6b3a" },
  { name: "Red", value: "#c8102e" },
];

/* Where a scoring event's callout should appear, by where the points came from. */
type ToastAnchor = "pile" | "starter" | "crib" | "myHand" | "oppHand";
function anchorFor(event: ScoreEvent, myIndex: number): ToastAnchor {
  if (event.source === "play") return "pile";
  if (event.source === "cut") return "starter";
  if (event.source === "crib") return "crib";
  return event.player === myIndex ? "myHand" : "oppHand"; // show
}

/* ScoreLog: renders the score breakdown grouped by source */

const sourceLabels: Record<ScoreEvent["source"], string> = {
  cut: "Cut",
  play: "Pegging",
  show: "Show",
  crib: "Crib",
};

function ScoreLog({
  log,
  myIndex,
  myName,
  oppName,
}: {
  log: ScoreEvent[];
  myIndex: number;
  myName: string;
  oppName: string;
}) {
  if (log.length === 0) return null;

  const grouped = log.reduce<Record<string, ScoreEvent[]>>((acc, e) => {
    const key = e.source;
    if (!acc[key]) acc[key] = [];
    acc[key].push(e);
    return acc;
  }, {});

  const order: ScoreEvent["source"][] = ["cut", "play", "show", "crib"];

  return (
    <div className="spacedSection">
      <h3>Score breakdown</h3>
      {order.map((source) => {
        const events = grouped[source];
        if (!events?.length) return null;
        return (
          <div key={source} style={{ marginBottom: "0.5rem" }}>
            <strong>{sourceLabels[source]}</strong>
            <ul style={{ margin: "0.2rem 0 0 1rem", padding: 0 }}>
              {events.map((e, i) => {
                const who =
                  myIndex === -1
                    ? `Player ${e.player + 1}`
                    : e.player === myIndex
                      ? myName
                      : oppName;
                return (
                  <li key={i}>
                    {who} +{e.points}{" "}
                    <span style={{ textTransform: "capitalize" }}>{e.category}</span>
                    {e.details ? ` (${e.details})` : ""}
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

/* Main component */

export default function CribbageGame({
  view,
  players,
  userPlayerIndex,
  makeMove,
}: GameProps<CribbageView, CribbageMove>) {
  const [picked, setPicked] = useState<Card[]>([]);
  /* Board (felt) + card-back colour settings, persisted in localStorage (guarded
     so non-browser environments — e.g. tests — don't crash). */
  const [showSettings, setShowSettings] = useState(false);
  const [boardColor, setBoardColor] = useState(() => readStored("cribBoardColor", "#1b4a8f"));
  const [cardColor, setCardColor] = useState(() => readStored("cribCardColor", "#c8102e"));
  const pickBoard = (c: string) => {
    setBoardColor(c);
    writeStored("cribBoardColor", c);
  };
  const pickCard = (c: string) => {
    setCardColor(c);
    writeStored("cribCardColor", c);
  };
  /* The end-of-hand score breakdown shows as a dismissible popup */
  const [breakdownClosed, setBreakdownClosed] = useState(false);
  /* Track showdown transitions so the popup re-opens for each new hand */
  const [wasShowdown, setWasShowdown] = useState(false);
  /* The cut-for-deal result popup can be dismissed */
  const [cutReviewClosed, setCutReviewClosed] = useState(false);
  /* Real-time scoring callouts: how many log events we have already surfaced,
     and the toasts currently on screen. */
  const [toastedCount, setToastedCount] = useState(0);
  const [toasts, setToasts] = useState<{ id: number; event: ScoreEvent }[]>([]);

  const myIndex = userPlayerIndex; /* -1 for watchers */
  const isWatcher = myIndex === -1 || myIndex >= players.length;

  /* Resolve display names */
  const myName = isWatcher ? "Watcher" : (players[myIndex]?.display ?? "You");
  const oppIndex = isWatcher ? 1 : 1 - myIndex;
  const oppName = players[oppIndex]?.display ?? "Opponent";

  const amDealer = !isWatcher && view.dealer === myIndex;
  const myTurn = !isWatcher && myIndex === view.nextPlayer;
  const canPlayCard = (c: Card) => cardValue(c.rank) <= 31 - view.runningCount;

  const toggle = (card: Card) =>
    setPicked((p) =>
      p.some((c) => same(c, card))
        ? p.filter((c) => !same(c, card))
        : p.length < 2
          ? [...p, card]
          : p,
    );

  // Keyboard navigation support
  const myHandRef = useRef<HTMLDivElement>(null);
  const cutFanRef = useRef<HTMLDivElement>(null);

  // The element that holds the focusable cards for the current phase: the cut
  // fan while cutting for deal, otherwise your own hand.
  function activeCardsRoot(): HTMLDivElement | null {
    return view.phase === "cut" ? cutFanRef.current : myHandRef.current;
  }

  function getActiveButtons(): HTMLButtonElement[] {
    const root = activeCardsRoot();
    if (!root) return [];
    return Array.from(root.querySelectorAll<HTMLButtonElement>("button:not(:disabled)"));
  }

  function moveFocus(dir: 1 | -1) {
    const buttons = getActiveButtons();
    if (buttons.length === 0) return;
    const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
    const next = current === -1 ? 0 : Math.max(0, Math.min(buttons.length - 1, current + dir));
    buttons[next]?.focus();
  }

  /** Activate the focused card if it's in the current phase's card group. */
  function clickFocusedCard() {
    const focused = document.activeElement as HTMLButtonElement | null;
    if (focused && activeCardsRoot()?.contains(focused)) focused.click();
  }

  function toggleFocused() {
    clickFocusedCard();
  }

  /**
   * If a non-card button/link has keyboard focus (Leave / Abandon, Quit, Deal,
   * Ready, Settings…), activate it. The game binds Enter/Space at the window
   * level and preventDefaults them, which would otherwise swallow the native
   * activation of these controls. Returns true if it handled the key.
   */
  function activateFocusedControl(): boolean {
    const focused = document.activeElement as HTMLElement | null;
    if (
      focused &&
      (focused.tagName === "BUTTON" || focused.tagName === "A") &&
      !activeCardsRoot()?.contains(focused)
    ) {
      focused.click();
      return true;
    }
    return false;
  }

  function confirmAction() {
    if (activateFocusedControl()) return;
    if (view.phase === "cut") {
      clickFocusedCard();
      return;
    }
    if (view.phase === "discard" && picked.length === 2) {
      makeMove({ type: "discard", cards: [picked[0], picked[1]] });
      setPicked([]);
      return;
    }
    if (view.phase === "play" && myTurn) {
      clickFocusedCard();
    }
  }

  const phaseLabel: Record<string, string> = {
    cut: "Cut for deal",
    deal: "Deal",
    discard: "Discard",
    play: "Pegging",
    show: "Show",
    handover: "Hand complete",
    done: "Done",
  };

  const isCut = view.phase === "cut";
  const isDeal = view.phase === "deal";
  const isHandover = view.phase === "handover";
  const isShowdown = view.phase === "show" || isHandover || view.phase === "done";
  const gameOver = view.winner !== null;

  // Keyboard navigation bindings
  const isInteractivePhase =
    !isWatcher &&
    (view.phase === "discard" || view.phase === "play" || view.phase === "deal" || isCut);

  useKeyboardNav(
    {
      ["ArrowLeft"]: () => moveFocus(-1),
      ["ArrowRight"]: () => moveFocus(1),
      [" "]: () => {
        if (activateFocusedControl()) return;
        if (view.phase === "discard" || isCut) toggleFocused();
      },
      ["Enter"]: () => confirmAction(),
      ["g"]: () => {
        if (view.phase === "play" && myTurn && !view.myHand.some(canPlayCard))
          makeMove({ type: "go" });
      },
      ["G"]: () => {
        if (view.phase === "play" && myTurn && !view.myHand.some(canPlayCard))
          makeMove({ type: "go" });
      },
      ["r"]: () => {
        if (isDeal && !view.myReady) makeMove({ type: "ready" });
      },
      ["R"]: () => {
        if (isDeal && !view.myReady) makeMove({ type: "ready" });
      },
    },
    isInteractivePhase,
  );

  /* The cut-for-deal result shows once, as a dismissible popup on the deal */
  const showCutReview = isDeal && !isWatcher && view.myCut !== null && view.opponentCut !== null;

  /* Re-open the breakdown popup whenever a new showdown begins (render-time
     state sync — the recommended alternative to a setState-in-effect). */
  if (wasShowdown !== isShowdown) {
    setWasShowdown(isShowdown);
    setBreakdownClosed(false);
  }

  /* Surface each newly-logged scoring event as a real-time callout. New events
     only ever get appended to the log, so the slice past `toastedCount` is the
     set we have not shown yet. */
  if (view.log.length > toastedCount) {
    const fresh = view.log.slice(toastedCount).map((event, i) => ({ id: toastedCount + i, event }));
    setToastedCount(view.log.length);
    setToasts((cur) => [...cur, ...fresh]);
  } else if (view.log.length < toastedCount) {
    setToastedCount(view.log.length); // a fresh game reset the log
  }

  /* Drop the oldest callout on a timer so they flash and clear on their own. */
  useEffect(() => {
    if (toasts.length === 0) return undefined;
    const timer = setTimeout(() => setToasts((cur) => cur.slice(1)), 1500);
    return () => clearTimeout(timer);
  }, [toasts]);

  /* Screen-reader: announce each new scoring event (non-visual pair to the
     on-board callout). */
  const announcedLog = useRef(0);
  useEffect(() => {
    if (view.log.length <= announcedLog.current) {
      announcedLog.current = view.log.length; // a fresh hand reset the log
      return;
    }
    for (let i = announcedLog.current; i < view.log.length; i += 1) {
      const e = view.log[i];
      const who = isWatcher ? `Player ${e.player + 1}` : e.player === myIndex ? "You" : "Opponent";
      announce(`${who} scored ${e.points} for ${scoreCalloutLabel[e.category]}.`);
    }
    announcedLog.current = view.log.length;
  }, [view.log, isWatcher, myIndex]);

  /* Screen-reader: announce when it becomes the player's turn. */
  const wasMyTurn = useRef(false);
  useEffect(() => {
    const nowMyTurn = view.phase === "play" && myTurn;
    if (nowMyTurn && !wasMyTurn.current) announce("Your turn.", true);
    wasMyTurn.current = nowMyTurn;
  }, [view.phase, myTurn]);

  /* The callout currently on screen, and where it should be anchored */
  const currentToast = toasts[0] ?? null;
  const currentMine = !!currentToast && !isWatcher && currentToast.event.player === myIndex;
  const currentAnchor = currentToast && !isWatcher ? anchorFor(currentToast.event, myIndex) : null;
  const toastAt = (where: ToastAnchor) =>
    currentToast && currentAnchor === where ? (
      <ScoreToast key={currentToast.id} event={currentToast.event} mine={currentMine} />
    ) : null;

  /* The exact cards that produced the current callout — highlighted on the
     board so you can see what scored. Cards are unique, so matching by key is
     safe wherever they are rendered. */
  const highlightKeys = new Set((currentToast?.event.cards ?? []).map(cardKey));
  const hot = (c: Card) => highlightKeys.has(cardKey(c));

  /* How many face-down cards to draw for the opponent */
  const oppCardCount =
    view.opponentHandSize || (view.phase === "deal" ? 6 : view.phase === "discard" ? 6 : 4);

  /* Top seat (opponent): face-up at showdown, otherwise a fan of card backs */
  const opponentCards =
    isShowdown && view.opponentHand
      ? view.opponentHand.map((c, i) => (
          <PlayingCard key={cardKey(c)} card={c} dealIndex={i} highlight={hot(c)} />
        ))
      : Array.from({ length: oppCardCount }, (_, i) => (
          <CardBack key={i} dealAnim={isDeal ? "down" : "none"} dealIndex={i} />
        ));

  /* Bottom seat (you): your hand, interactive depending on the phase */
  function myHandCards() {
    return view.myHand.map((c, i) => {
      /* Discard phase: cards are pickable (toggle into the crib selection) */
      if (view.phase === "discard" && view.myHand.length > 4) {
        return (
          <PlayingCard
            key={cardKey(c)}
            card={c}
            picked={picked.some((x) => same(x, c))}
            onClick={() => toggle(c)}
            dealIndex={i}
          />
        );
      }
      /* Play phase: clickable when it's your turn and the card is legal */
      if (view.phase === "play") {
        const playable = myTurn && canPlayCard(c);
        return (
          <PlayingCard
            key={cardKey(c)}
            card={c}
            disabled={!playable}
            onClick={playable ? () => makeMove({ type: "play", card: c }) : undefined}
            dealIndex={i}
          />
        );
      }
      /* Deal / showdown: just display the card (deal phase animates in) */
      return (
        <PlayingCard
          key={cardKey(c)}
          card={c}
          dealAnim={isDeal ? "up" : "none"}
          dealIndex={i}
          highlight={hot(c)}
        />
      );
    });
  }

  /* Step-by-step guidance shown at the bottom of the window */
  let guidance: string;
  if (isWatcher) {
    guidance = isCut
      ? "Players are cutting for the deal…"
      : gameOver
        ? "Game over."
        : "You are watching this game.";
  } else if (isCut) {
    guidance =
      view.myCut !== null
        ? `You cut ${cardLabel(view.myCut)}. Waiting for ${oppName} to cut…`
        : "Click a card. The lower card deals first and takes the first crib.";
  } else if (isDeal) {
    guidance = view.myReady
      ? view.opponentReady
        ? "Both players ready. Dealing the hand…"
        : `Waiting for ${oppName} to be ready…`
      : "Step 1 of 3: Look over your 6 cards, then click Ready. (Shortcut: R)";
  } else if (view.phase === "discard") {
    guidance =
      view.myHand.length > 4
        ? `Step 2 of 3: Tap 2 cards to send to ${amDealer ? "your" : oppName + "’s"} crib (${picked.length}/2 chosen), then Send to Crib. (← → to move, Space to pick, Enter to confirm)`
        : `Discarded. Waiting for ${oppName} to choose…`;
  } else if (view.phase === "play") {
    guidance = !myTurn
      ? `Waiting for ${oppName} to play…`
      : !view.myHand.some(canPlayCard)
        ? "Step 3 of 3: Nothing fits under 31. Click Go to pass. (Shortcut: G)"
        : `Step 3 of 3: Your turn. Tap a card to play it (count ${view.runningCount}/31). (← → to move, Enter to play)`;
  } else if (isHandover) {
    guidance = "Hand complete. Deal the next hand to play on toward 121, or quit to end the game.";
  } else {
    guidance = gameOver
      ? "Game over. Final scores are in."
      : "Hand scored. Review the breakdown, then the next hand deals.";
  }

  return (
    <div
      className="content spacedSection crib-content"
      style={{ ["--crib-felt" as string]: boardColor, ["--crib-back" as string]: cardColor }}
    >
      {/* Phase badge + settings */}
      <div className="crib-topbar">
        <span className="crib-phase-chip">{phaseLabel[view.phase] ?? view.phase}</span>
        <div className="crib-topbar-right">
          <a className="crib-help-link" href="/help/cribbage" target="_blank" rel="noreferrer">
            How to play
          </a>
          <button
            type="button"
            className="crib-settings-btn"
            onClick={() => setShowSettings((s) => !s)}
            aria-expanded={showSettings}
            aria-label="Game settings (board and card colour)"
            title="Settings"
          >
            <span aria-hidden="true">⚙</span>
            <span>Settings</span>
          </button>
        </div>
      </div>

      {showSettings && (
        <div className="crib-settings-panel" role="group" aria-label="Colour settings">
          <div className="crib-settings-section">
            <div className="crib-settings-title">Board Color</div>
            <div className="crib-swatch-row">
              {BOARD_COLORS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  className={`crib-swatch${boardColor === c.value ? " is-selected" : ""}`}
                  style={{ background: c.value }}
                  onClick={() => pickBoard(c.value)}
                  aria-pressed={boardColor === c.value}
                  aria-label={`Board colour ${c.name}`}
                />
              ))}
            </div>
          </div>
          <div className="crib-settings-section">
            <div className="crib-settings-title">Card Color</div>
            <div className="crib-swatch-row">
              {CARD_COLORS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  className={`crib-swatch${cardColor === c.value ? " is-selected" : ""}`}
                  style={{ background: c.value }}
                  onClick={() => pickCard(c.value)}
                  aria-pressed={cardColor === c.value}
                  aria-label={`Card colour ${c.name}`}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Watchers can't anchor to a hand, so their callout stays centred */}
      {isWatcher && currentToast && <ScoreToast event={currentToast.event} mine={false} />}

      {/* Play area: the table on the left, the peg board on the right */}
      <div className={`crib-play-area${isCut ? " crib-play-area--cut" : ""}`}>
        {/* The table — opponent on top, you on the bottom (opposite sides)   */}
        <div className="crib-table">
          {isCut ? (
            /* CUT FOR DEAL: every face-down card laid out in a wrapping grid —
               click any one to cut. Each card is its own button, so the click
               is always reliable and the grid wraps to fit (no overflow). */
            <div className="crib-cut">
              {view.myCut ? (
                <div className="crib-labelled">
                  <PlayingCard card={view.myCut} />
                  <span className="crib-mini-label">You cut</span>
                </div>
              ) : (
                <div
                  className="crib-cut-fan"
                  role="group"
                  aria-label="Cut the deck"
                  ref={cutFanRef}
                >
                  {Array.from({ length: view.cutDeckSize }, (_, i) => (
                    <button
                      key={i}
                      type="button"
                      className="crib-card crib-card--back crib-cut-pick"
                      disabled={isWatcher}
                      onClick={() => makeMove({ type: "cut", index: i })}
                      aria-label={`Cut card ${i + 1}`}
                      style={{
                        /* Inset the centres by half a card so the first/last
                           cards sit fully inside — nothing is cut off. */
                        left:
                          view.cutDeckSize > 1
                            ? `calc(var(--cut-w) / 2 + ${
                                i / (view.cutDeckSize - 1)
                              } * (100% - var(--cut-w)))`
                            : "50%",
                        zIndex: i,
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          ) : (
            <>
              {/* TOP: opponent */}
              <Seat
                name={oppName}
                score={view.scores[oppIndex]}
                isDealer={view.dealer === oppIndex}
                isTurn={view.phase === "play" && view.nextPlayer === oppIndex}
                position="top"
                overlay={toastAt("oppHand")}
              >
                {opponentCards}
              </Seat>

              {/* CENTER: deck / cut / count / pile / crib */}
              <div className="crib-center">
                {/* Deck (visible while cards are being dealt / chosen) */}
                {(isDeal || view.phase === "discard") && (
                  <div className="crib-labelled">
                    <div className="crib-deck">
                      <CardBack />
                      <CardBack />
                      <CardBack />
                    </div>
                    <span className="crib-mini-label">Deck</span>
                  </div>
                )}

                {/* Crib zone — a fixed, labelled spot so you always see where the
                  crib is and watch it fill (revealed face-up at the showdown) */}
                {!isDeal && (
                  <div className="crib-labelled crib-anchor">
                    {isShowdown && view.crib && view.crib.length > 0 ? (
                      <div className="crib-row">
                        {view.crib.map((c, i) => (
                          <PlayingCard key={cardKey(c)} card={c} dealIndex={i} highlight={hot(c)} />
                        ))}
                      </div>
                    ) : (
                      /* A face-down pile so it reads as a stack of cards, not a
                         drag-and-drop target (you click cards to send them). */
                      <div className="crib-labelled">
                        <div className="crib-pile">
                          {view.cribSize > 0 ? (
                            Array.from({ length: Math.min(view.cribSize, 3) }, (_, i) => (
                              <CardBack key={i} />
                            ))
                          ) : (
                            <div className="crib-slot-empty" aria-hidden="true" />
                          )}
                        </div>
                        <span className="crib-mini-label">
                          {amDealer ? "Your" : `${oppName}'s`} crib · {view.cribSize}/4
                        </span>
                      </div>
                    )}
                    {toastAt("crib")}
                  </div>
                )}

                {/* Running count + pile during pegging */}
                {view.phase === "play" && (
                  <>
                    <div className="crib-count">
                      <strong style={{ color: view.runningCount >= 28 ? "#fde047" : undefined }}>
                        {view.runningCount}
                      </strong>
                      <span className="crib-mini-label">count / 31</span>
                    </div>
                    <div className="crib-labelled crib-anchor">
                      <div className="crib-row">
                        {view.playPile.length === 0 ? (
                          <span className="crib-mini-label">(empty)</span>
                        ) : (
                          view.playPile.map((c) => (
                            <PlayingCard
                              key={cardKey(c)}
                              card={c}
                              dealAnim="play"
                              highlight={hot(c)}
                            />
                          ))
                        )}
                      </div>
                      <span className="crib-mini-label">play pile</span>
                      {toastAt("pile")}
                    </div>
                  </>
                )}

                {/* The cut / starter card, once revealed */}
                {view.starter && (
                  <div className="crib-labelled crib-anchor">
                    <PlayingCard card={view.starter} highlight={hot(view.starter)} />
                    <span className="crib-mini-label">Starter (cut)</span>
                    {toastAt("starter")}
                  </div>
                )}
              </div>

              {/* BOTTOM: you */}
              {!isWatcher ? (
                <Seat
                  name="You"
                  score={view.scores[myIndex]}
                  isDealer={amDealer}
                  isTurn={view.phase === "play" && myTurn}
                  position="bottom"
                  overlay={toastAt("myHand")}
                  rowRef={myHandRef}
                >
                  {myHandCards()}
                </Seat>
              ) : (
                <div className="crib-seat crib-seat--bottom" />
              )}
            </>
          )}
        </div>

        <PegBoard
          youName={isWatcher ? "Player 1" : "You"}
          youScore={view.scores[isWatcher ? 0 : myIndex]}
          oppName={isWatcher ? "Player 2" : oppName}
          oppScore={view.scores[oppIndex]}
        />

        {/* Minimized window: labelled You / opponent score bars (toward 121) in
            place of the full peg board, so it's clear who's who. */}
        <div className="crib-mini-progress" aria-hidden="true">
          <div className="crib-mini-col">
            <span className="crib-mini-cap crib-mini-cap--you">You</span>
            <span className="crib-mini-score">{view.scores[isWatcher ? 0 : myIndex]}</span>
            <div className="crib-mini-track">
              <div
                className="crib-mini-fill crib-mini-fill--you"
                style={{
                  height: `${Math.min(100, (view.scores[isWatcher ? 0 : myIndex] / 121) * 100)}%`,
                }}
              />
            </div>
          </div>
          <div className="crib-mini-col">
            <span className="crib-mini-cap crib-mini-cap--opp">
              {isWatcher ? "P2" : oppName.split(" ")[0]}
            </span>
            <span className="crib-mini-score">{view.scores[oppIndex]}</span>
            <div className="crib-mini-track">
              <div
                className="crib-mini-fill crib-mini-fill--opp"
                style={{ height: `${Math.min(100, (view.scores[oppIndex] / 121) * 100)}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Step-by-step guidance + the one action for this phase, pinned to the
          bottom of the game window */}
      <div className="crib-guidance">
        <p className="crib-guidance-text">{guidance}</p>
        <div className="crib-actions">
          {!isWatcher && isDeal && (
            <button
              className="primary narrow"
              disabled={view.myReady}
              onClick={() => makeMove({ type: "ready" })}
            >
              {view.myReady ? "✓ Ready" : "Ready! (R)"}
            </button>
          )}
          {!isWatcher && view.phase === "discard" && view.myHand.length > 4 && (
            <button
              className="primary narrow"
              disabled={picked.length !== 2}
              onClick={() => {
                makeMove({ type: "discard", cards: [picked[0], picked[1]] });
                setPicked([]);
              }}
            >
              Send to Crib ({picked.length} / 2) (Enter)
            </button>
          )}
          {!isWatcher && view.phase === "play" && myTurn && !view.myHand.some(canPlayCard) && (
            <button className="primary narrow" onClick={() => makeMove({ type: "go" })}>
              Go! (G)
            </button>
          )}
          {/* Handover with the popup dismissed: keep the play-on / quit choice
              reachable from the action bar. */}
          {!isWatcher && isHandover && breakdownClosed && (
            <>
              <button className="primary narrow" onClick={() => makeMove({ type: "continue" })}>
                ▶ Next hand
              </button>
              <button className="primary narrow" onClick={() => makeMove({ type: "quit" })}>
                ✖ Quit
              </button>
            </>
          )}
          {/* Once dismissed, the breakdown stays reachable from here */}
          {isShowdown && breakdownClosed && (
            <button className="primary narrow" onClick={() => setBreakdownClosed(false)}>
              Show score breakdown
            </button>
          )}
        </div>
      </div>

      {/* Cut-for-deal result popup, shown once at the start of the first hand */}
      {showCutReview && !cutReviewClosed && view.myCut && view.opponentCut && (
        <div className="crib-result-overlay">
          <div className="crib-result-card">
            <h3 style={{ marginTop: 0 }}>Cut for the deal</h3>
            <div
              style={{
                display: "flex",
                gap: "1.5rem",
                justifyContent: "center",
                margin: "0.5rem 0",
              }}
            >
              <div className="crib-labelled">
                <PlayingCard card={view.myCut} />
                <span style={{ fontSize: "0.8rem" }}>You: {cardLabel(view.myCut)}</span>
              </div>
              <div className="crib-labelled">
                <PlayingCard card={view.opponentCut} />
                <span style={{ fontSize: "0.8rem" }}>
                  {oppName}: {cardLabel(view.opponentCut)}
                </span>
              </div>
            </div>
            <p style={{ fontWeight: 700, margin: "0.5rem 0" }}>
              {amDealer
                ? "You cut lower. You deal first and take the first crib."
                : `${oppName} cut lower. They deal first and take the first crib.`}
            </p>
            <button
              className="primary narrow"
              style={{ marginTop: "0.25rem" }}
              onClick={() => setCutReviewClosed(true)}
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {/* End-of-hand popup: result + score breakdown (after the callouts flash) */}
      {isShowdown && !breakdownClosed && toasts.length === 0 && (
        <div className="crib-result-overlay">
          <div className="crib-result-card">
            {gameOver && !isWatcher && (
              <GameResult
                isWinner={view.winner === myIndex}
                message={`Final score · You ${view.scores[myIndex]}, ${oppName} ${view.scores[oppIndex]}`}
              />
            )}
            {gameOver && isWatcher && (
              <div style={{ fontWeight: 800, fontSize: "1.3rem", textAlign: "center" }}>
                🏆 {players[view.winner ?? 0]?.display ?? `Player ${(view.winner ?? 0) + 1}`} wins!
              </div>
            )}
            {!gameOver && (
              <h3 style={{ marginTop: 0 }}>
                Hand complete · {view.scores[isWatcher ? 0 : myIndex]} to {view.scores[oppIndex]}
              </h3>
            )}
            <ScoreLog
              log={view.log}
              myIndex={myIndex}
              myName={isWatcher ? "Player 1" : myName}
              oppName={isWatcher ? "Player 2" : oppName}
            />
            {/* Handover: play on toward 121, or stop here. Watchers just wait. */}
            {isHandover && !isWatcher ? (
              <div
                style={{
                  display: "flex",
                  gap: "0.6rem",
                  justifyContent: "center",
                  flexWrap: "wrap",
                  marginTop: "0.75rem",
                }}
              >
                <button className="primary narrow" onClick={() => makeMove({ type: "continue" })}>
                  ▶ Next hand
                </button>
                <button className="primary narrow" onClick={() => makeMove({ type: "quit" })}>
                  ✖ Quit &amp; end game
                </button>
                <button className="primary narrow" onClick={() => setBreakdownClosed(true)}>
                  View board
                </button>
              </div>
            ) : (
              <button
                className="primary narrow"
                style={{ marginTop: "0.75rem" }}
                onClick={() => setBreakdownClosed(true)}
              >
                Close
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
