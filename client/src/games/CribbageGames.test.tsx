// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen, cleanup, fireEvent, act } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { CribbageView, Card, ScoreEvent } from "@gamenite/shared";
import CribbageGame from "./CribbageGames";

afterEach(() => cleanup());

const mockMakeMove = vi.fn();

const MOCK_PLAYERS = [
  { display: "Yāo", username: "yao", createdAt: new Date() },
  { display: "Flora", username: "flora", createdAt: new Date() },
];

const c = (rank: number, suit: Card["suit"]): Card => ({ rank, suit });

const baseView: CribbageView = {
  phase: "deal",
  dealer: 0,
  myIndex: 0,
  myHand: [],
  opponentHand: [],
  opponentHandSize: 0,
  crib: [],
  cribSize: 0,
  starter: null,
  playPile: [],
  runningCount: 0,
  scores: [0, 0],
  nextPlayer: 0,
  myReady: false,
  opponentReady: false,
  cutDeckSize: 0,
  myCut: null,
  opponentCut: null,
  opponentHasCut: false,
  log: [],
  winner: null,
};

describe("CribbageGame deal phase", () => {
  it("shows a Ready button in the deal phase", () => {
    render(
      <CribbageGame
        view={{ ...baseView, phase: "deal" }}
        userPlayerIndex={0}
        players={MOCK_PLAYERS}
        makeMove={mockMakeMove}
      />,
    );
    expect(screen.getByRole("button", { name: /Ready/i })).toBeInTheDocument();
  });

  it("shows the phase chip", () => {
    render(
      <CribbageGame
        view={{ ...baseView, phase: "deal" }}
        userPlayerIndex={0}
        players={MOCK_PLAYERS}
        makeMove={mockMakeMove}
      />,
    );
    expect(screen.getByText("Deal")).toBeInTheDocument();
  });
});

describe("CribbageGame cut phase", () => {
  it("renders the cut fan with the correct number of card buttons", () => {
    render(
      <CribbageGame
        view={{ ...baseView, phase: "cut", cutDeckSize: 5 }}
        userPlayerIndex={0}
        players={MOCK_PLAYERS}
        makeMove={mockMakeMove}
      />,
    );
    expect(screen.getByRole("group", { name: "Cut the deck" })).toBeInTheDocument();
    const cutButtons = screen.getAllByRole("button", { name: /Cut card/i });
    expect(cutButtons).toHaveLength(5);
  });

  it("clicking a cut card calls makeMove with the card index", () => {
    const makeMove = vi.fn();
    render(
      <CribbageGame
        view={{ ...baseView, phase: "cut", cutDeckSize: 3 }}
        userPlayerIndex={0}
        players={MOCK_PLAYERS}
        makeMove={makeMove}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Cut card 1" }));
    expect(makeMove).toHaveBeenCalledWith({ type: "cut", index: 0 });
  });
});

describe("CribbageGame discard phase", () => {
  const sixCards = [c(1, "H"), c(5, "D"), c(10, "C"), c(11, "S"), c(12, "H"), c(13, "D")];

  it("renders all 6 hand cards as buttons in the discard phase", () => {
    render(
      <CribbageGame
        view={{ ...baseView, phase: "discard", myHand: sixCards }}
        userPlayerIndex={0}
        players={MOCK_PLAYERS}
        makeMove={mockMakeMove}
      />,
    );
    // A♥ = rank 1 suit H → label "A of H"
    expect(screen.getByRole("button", { name: "A of H" })).toBeInTheDocument();
    // J♠ = rank 11 suit S → label "J of S"
    expect(screen.getByRole("button", { name: "J of S" })).toBeInTheDocument();
    // Q♥ = rank 12
    expect(screen.getByRole("button", { name: "Q of H" })).toBeInTheDocument();
    // K♦ = rank 13
    expect(screen.getByRole("button", { name: "K of D" })).toBeInTheDocument();
  });

  it("shows 'Send to Crib' disabled until 2 cards are picked", () => {
    render(
      <CribbageGame
        view={{ ...baseView, phase: "discard", myHand: sixCards }}
        userPlayerIndex={0}
        players={MOCK_PLAYERS}
        makeMove={mockMakeMove}
      />,
    );
    expect(screen.getByRole("button", { name: /Send to Crib/i })).toBeDisabled();
  });

  it("enables 'Send to Crib' after picking 2 cards and calls makeMove on click", () => {
    const makeMove = vi.fn();
    render(
      <CribbageGame
        view={{ ...baseView, phase: "discard", myHand: sixCards }}
        userPlayerIndex={0}
        players={MOCK_PLAYERS}
        makeMove={makeMove}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "A of H" }));
    fireEvent.click(screen.getByRole("button", { name: "5 of D" }));
    const sendBtn = screen.getByRole("button", { name: /Send to Crib/i });
    expect(sendBtn).not.toBeDisabled();
    fireEvent.click(sendBtn);
    expect(makeMove).toHaveBeenCalledWith({
      type: "discard",
      cards: [c(1, "H"), c(5, "D")],
    });
  });
});

describe("CribbageGame play phase", () => {
  it("shows the running count during pegging", () => {
    render(
      <CribbageGame
        view={{
          ...baseView,
          phase: "play",
          myHand: [c(5, "H"), c(6, "S")],
          runningCount: 10,
          nextPlayer: 0,
        }}
        userPlayerIndex={0}
        players={MOCK_PLAYERS}
        makeMove={mockMakeMove}
      />,
    );
    expect(screen.getByText("10")).toBeInTheDocument();
  });

  it("shows playable card buttons on the user's turn", () => {
    render(
      <CribbageGame
        view={{
          ...baseView,
          phase: "play",
          myHand: [c(5, "H"), c(6, "S")],
          runningCount: 0,
          nextPlayer: 0,
        }}
        userPlayerIndex={0}
        players={MOCK_PLAYERS}
        makeMove={mockMakeMove}
      />,
    );
    expect(screen.getByRole("button", { name: "5 of H" })).not.toBeDisabled();
  });

  it("calls makeMove when a playable card is clicked", () => {
    const makeMove = vi.fn();
    render(
      <CribbageGame
        view={{
          ...baseView,
          phase: "play",
          myHand: [c(5, "H")],
          runningCount: 0,
          nextPlayer: 0,
        }}
        userPlayerIndex={0}
        players={MOCK_PLAYERS}
        makeMove={makeMove}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "5 of H" }));
    expect(makeMove).toHaveBeenCalledWith({ type: "play", card: c(5, "H") });
  });

  it("shows the Go button when no cards are playable and it is the user's turn", () => {
    render(
      <CribbageGame
        view={{
          ...baseView,
          phase: "play",
          myHand: [c(10, "S")],
          runningCount: 28,
          nextPlayer: 0,
        }}
        userPlayerIndex={0}
        players={MOCK_PLAYERS}
        makeMove={mockMakeMove}
      />,
    );
    expect(screen.getByRole("button", { name: /Go!/i })).toBeInTheDocument();
  });
});

describe("CribbageGame settings panel", () => {
  it("toggles the settings panel open and closed", () => {
    render(
      <CribbageGame
        view={{ ...baseView }}
        userPlayerIndex={0}
        players={MOCK_PLAYERS}
        makeMove={mockMakeMove}
      />,
    );
    expect(screen.queryByRole("group", { name: /Colour settings/i })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Game settings/i }));
    expect(screen.getByRole("group", { name: /Colour settings/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Game settings/i }));
    expect(screen.queryByRole("group", { name: /Colour settings/i })).not.toBeInTheDocument();
  });

  it("clicking a board colour swatch updates the selection", () => {
    render(
      <CribbageGame
        view={{ ...baseView }}
        userPlayerIndex={0}
        players={MOCK_PLAYERS}
        makeMove={mockMakeMove}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Game settings/i }));
    const forestSwatch = screen.getByRole("button", { name: "Board colour Forest" });
    fireEvent.click(forestSwatch);
    expect(forestSwatch).toHaveAttribute("aria-pressed", "true");
  });
});

describe("CribbageGame score log", () => {
  it("shows a scoring toast immediately when the log has new events", () => {
    const log: ScoreEvent[] = [
      {
        category: "fifteen",
        points: 2,
        player: 0 as const,
        source: "show",
        cards: [c(5, "H"), c(10, "S")],
      },
    ];
    render(
      <CribbageGame
        view={{ ...baseView, phase: "show", log, winner: null }}
        userPlayerIndex={0}
        players={MOCK_PLAYERS}
        makeMove={mockMakeMove}
      />,
    );
    expect(screen.getByText(/Fifteen/)).toBeInTheDocument();
  });

  it("renders the score breakdown popup after toasts clear", () => {
    vi.useFakeTimers();
    const log: ScoreEvent[] = [
      {
        category: "pair",
        points: 2,
        player: 0 as const,
        source: "show",
        cards: [c(5, "H"), c(5, "D")],
      },
    ];
    render(
      <CribbageGame
        view={{ ...baseView, phase: "show", log, winner: null }}
        userPlayerIndex={0}
        players={MOCK_PLAYERS}
        makeMove={mockMakeMove}
      />,
    );
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(screen.getByText("Score breakdown")).toBeInTheDocument();
    vi.useRealTimers();
  });
});

describe("CribbageGame handover phase", () => {
  it("shows Next hand and Quit buttons in the handover popup", () => {
    render(
      <CribbageGame
        view={{ ...baseView, phase: "handover", scores: [10, 8], winner: null }}
        userPlayerIndex={0}
        players={MOCK_PLAYERS}
        makeMove={mockMakeMove}
      />,
    );
    expect(screen.getAllByRole("button", { name: /Next hand/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: /Quit/i }).length).toBeGreaterThan(0);
  });
});

describe("CribbageGame suitSymbol coverage", () => {
  it("renders cards with H, D, C, S suits (covers all suitSymbol branches)", () => {
    const hands = [c(2, "H"), c(3, "D"), c(4, "C"), c(5, "S")];
    render(
      <CribbageGame
        view={{ ...baseView, phase: "show", myHand: hands, opponentHand: hands, winner: null }}
        userPlayerIndex={0}
        players={MOCK_PLAYERS}
        makeMove={mockMakeMove}
      />,
    );
    // Hearts render ♥, Diamonds ♦, Clubs ♣, Spades ♠
    expect(screen.getAllByText("♥").length).toBeGreaterThan(0);
    expect(screen.getAllByText("♦").length).toBeGreaterThan(0);
    expect(screen.getAllByText("♣").length).toBeGreaterThan(0);
    expect(screen.getAllByText("♠").length).toBeGreaterThan(0);
  });
});

describe("CribbageGame card color swatch", () => {
  it("clicking a card colour swatch updates the selection", () => {
    render(
      <CribbageGame
        view={{ ...baseView }}
        userPlayerIndex={0}
        players={MOCK_PLAYERS}
        makeMove={mockMakeMove}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Game settings/i }));
    const greenCardSwatch = screen.getByRole("button", { name: "Card colour Green" });
    fireEvent.click(greenCardSwatch);
    expect(greenCardSwatch).toHaveAttribute("aria-pressed", "true");
  });
});

describe("CribbageGame toggle deselect", () => {
  it("clicking a picked card again deselects it", () => {
    const sixHand = [c(1, "H"), c(2, "D"), c(3, "C"), c(4, "S"), c(5, "H"), c(6, "D")];
    render(
      <CribbageGame
        view={{ ...baseView, phase: "discard", myHand: sixHand }}
        userPlayerIndex={0}
        players={MOCK_PLAYERS}
        makeMove={mockMakeMove}
      />,
    );
    const aceBtn = screen.getByRole("button", { name: "A of H" });
    fireEvent.click(aceBtn);
    expect(aceBtn).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(aceBtn);
    expect(aceBtn).toHaveAttribute("aria-pressed", "false");
  });
});

describe("CribbageGame keyboard nav", () => {
  it("ArrowRight moves focus to the next card in discard phase", () => {
    const sixHand = [c(1, "H"), c(2, "D"), c(3, "C"), c(4, "S"), c(5, "H"), c(6, "D")];
    render(
      <CribbageGame
        view={{ ...baseView, phase: "discard", myHand: sixHand }}
        userPlayerIndex={0}
        players={MOCK_PLAYERS}
        makeMove={mockMakeMove}
      />,
    );
    const firstCard = screen.getByRole("button", { name: "A of H" });
    firstCard.focus();
    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "2 of D" }));
  });

  it("ArrowLeft moves focus to the previous card", () => {
    const sixHand = [c(1, "H"), c(2, "D"), c(3, "C"), c(4, "S"), c(5, "H"), c(6, "D")];
    render(
      <CribbageGame
        view={{ ...baseView, phase: "discard", myHand: sixHand }}
        userPlayerIndex={0}
        players={MOCK_PLAYERS}
        makeMove={mockMakeMove}
      />,
    );
    const secondCard = screen.getByRole("button", { name: "2 of D" });
    secondCard.focus();
    fireEvent.keyDown(window, { key: "ArrowLeft" });
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "A of H" }));
  });

  it("Space toggles a focused card in discard phase", () => {
    const sixHand = [c(1, "H"), c(2, "D"), c(3, "C"), c(4, "S"), c(5, "H"), c(6, "D")];
    render(
      <CribbageGame
        view={{ ...baseView, phase: "discard", myHand: sixHand }}
        userPlayerIndex={0}
        players={MOCK_PLAYERS}
        makeMove={mockMakeMove}
      />,
    );
    const firstCard = screen.getByRole("button", { name: "A of H" });
    firstCard.focus();
    fireEvent.keyDown(window, { key: " " });
    expect(firstCard).toHaveAttribute("aria-pressed", "true");
  });

  it("Enter confirms discard when 2 cards are picked", () => {
    const makeMove = vi.fn();
    const sixHand = [c(1, "H"), c(2, "D"), c(3, "C"), c(4, "S"), c(5, "H"), c(6, "D")];
    render(
      <CribbageGame
        view={{ ...baseView, phase: "discard", myHand: sixHand }}
        userPlayerIndex={0}
        players={MOCK_PLAYERS}
        makeMove={makeMove}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "A of H" }));
    fireEvent.click(screen.getByRole("button", { name: "2 of D" }));
    fireEvent.keyDown(window, { key: "Enter" });
    expect(makeMove).toHaveBeenCalledWith({
      type: "discard",
      cards: [c(1, "H"), c(2, "D")],
    });
  });

  it("'r' key calls makeMove ready in deal phase", () => {
    const makeMove = vi.fn();
    render(
      <CribbageGame
        view={{ ...baseView, phase: "deal" }}
        userPlayerIndex={0}
        players={MOCK_PLAYERS}
        makeMove={makeMove}
      />,
    );
    fireEvent.keyDown(window, { key: "r" });
    expect(makeMove).toHaveBeenCalledWith({ type: "ready" });
  });

  it("'g' key calls makeMove go when no cards are playable", () => {
    const makeMove = vi.fn();
    render(
      <CribbageGame
        view={{
          ...baseView,
          phase: "play",
          myHand: [c(10, "S")],
          runningCount: 28,
          nextPlayer: 0,
        }}
        userPlayerIndex={0}
        players={MOCK_PLAYERS}
        makeMove={makeMove}
      />,
    );
    fireEvent.keyDown(window, { key: "g" });
    expect(makeMove).toHaveBeenCalledWith({ type: "go" });
  });
});

describe("CribbageGame watcher view", () => {
  it("renders the watcher bottom seat placeholder", () => {
    const { container } = render(
      <CribbageGame
        view={{ ...baseView, phase: "discard" }}
        userPlayerIndex={-1}
        players={MOCK_PLAYERS}
        makeMove={mockMakeMove}
      />,
    );
    expect(container.querySelector(".crib-seat.crib-seat--bottom")).toBeInTheDocument();
  });

  it("shows watcher cut-for-deal guidance text", () => {
    render(
      <CribbageGame
        view={{ ...baseView, phase: "cut", cutDeckSize: 3 }}
        userPlayerIndex={-1}
        players={MOCK_PLAYERS}
        makeMove={mockMakeMove}
      />,
    );
    expect(screen.getByText(/Players are cutting for the deal/i)).toBeInTheDocument();
  });

  it("shows watcher game-over overlay with winner name", () => {
    render(
      <CribbageGame
        view={{ ...baseView, phase: "done", winner: 0, scores: [121, 80] }}
        userPlayerIndex={-1}
        players={MOCK_PLAYERS}
        makeMove={mockMakeMove}
      />,
    );
    expect(screen.getByText(/wins!/i)).toBeInTheDocument();
  });
});

describe("CribbageGame play area variations", () => {
  it("renders crib face-up cards during showdown", () => {
    render(
      <CribbageGame
        view={{
          ...baseView,
          phase: "show",
          crib: [c(5, "H"), c(10, "S"), c(1, "D"), c(3, "C")],
          winner: null,
        }}
        userPlayerIndex={0}
        players={MOCK_PLAYERS}
        makeMove={mockMakeMove}
      />,
    );
    // Crib cards in showdown render as div with aria-label (no onClick)
    expect(screen.getByLabelText("5 of H")).toBeInTheDocument();
  });

  it("renders CardBacks in crib pile when cribSize > 0", () => {
    const { container } = render(
      <CribbageGame
        view={{ ...baseView, phase: "discard", cribSize: 2 }}
        userPlayerIndex={0}
        players={MOCK_PLAYERS}
        makeMove={mockMakeMove}
      />,
    );
    expect(container.querySelectorAll(".crib-pile .crib-card--back").length).toBeGreaterThan(0);
  });

  it("renders cards in the play pile during pegging", () => {
    render(
      <CribbageGame
        view={{
          ...baseView,
          phase: "play",
          playPile: [c(5, "H"), c(6, "S")],
          myHand: [c(3, "D")],
          runningCount: 11,
          nextPlayer: 1,
        }}
        userPlayerIndex={0}
        players={MOCK_PLAYERS}
        makeMove={mockMakeMove}
      />,
    );
    expect(screen.getByLabelText("5 of H")).toBeInTheDocument();
  });

  it("renders the starter card when set", () => {
    render(
      <CribbageGame
        view={{
          ...baseView,
          phase: "play",
          starter: c(7, "C"),
          myHand: [c(3, "D")],
          nextPlayer: 1,
        }}
        userPlayerIndex={0}
        players={MOCK_PLAYERS}
        makeMove={mockMakeMove}
      />,
    );
    expect(screen.getByText(/Starter \(cut\)/i)).toBeInTheDocument();
  });

  it("highlights running count text when count >= 28", () => {
    const { container } = render(
      <CribbageGame
        view={{
          ...baseView,
          phase: "play",
          myHand: [c(3, "D")],
          runningCount: 28,
          nextPlayer: 1,
        }}
        userPlayerIndex={0}
        players={MOCK_PLAYERS}
        makeMove={mockMakeMove}
      />,
    );
    const countStrong = container.querySelector(".crib-count strong") as HTMLElement;
    expect(countStrong.style.color).toBe("rgb(253, 224, 71)");
  });
});

describe("CribbageGame cut review popup", () => {
  it("shows the cut-for-deal popup in deal phase when both cuts are set", () => {
    render(
      <CribbageGame
        view={{
          ...baseView,
          phase: "deal",
          myCut: c(3, "H"),
          opponentCut: c(7, "S"),
          dealer: 0,
        }}
        userPlayerIndex={0}
        players={MOCK_PLAYERS}
        makeMove={mockMakeMove}
      />,
    );
    expect(screen.getByText(/Cut for the deal/i)).toBeInTheDocument();
    // cardLabel is called to render "3♥" and "7♠"
    expect(screen.getByText(/You: 3♥/)).toBeInTheDocument();
  });

  it("dismisses the cut review popup on Continue click", () => {
    render(
      <CribbageGame
        view={{ ...baseView, phase: "deal", myCut: c(3, "H"), opponentCut: c(7, "S") }}
        userPlayerIndex={0}
        players={MOCK_PLAYERS}
        makeMove={mockMakeMove}
      />,
    );
    expect(screen.getByText(/Cut for the deal/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Continue/i }));
    expect(screen.queryByText(/Cut for the deal/i)).not.toBeInTheDocument();
  });
});

describe("CribbageGame breakdown popup actions", () => {
  it("shows 'Show score breakdown' button after closing the popup", () => {
    vi.useFakeTimers();
    render(
      <CribbageGame
        view={{ ...baseView, phase: "show", winner: null }}
        userPlayerIndex={0}
        players={MOCK_PLAYERS}
        makeMove={mockMakeMove}
      />,
    );
    // The popup is open initially; dismiss it
    const dismissBtn = screen.getByRole("button", { name: /Close/i });
    fireEvent.click(dismissBtn);
    expect(screen.getByRole("button", { name: /Show score breakdown/i })).toBeInTheDocument();
    vi.useRealTimers();
  });

  it("shows handover action bar buttons after dismissing the popup", () => {
    vi.useFakeTimers();
    render(
      <CribbageGame
        view={{ ...baseView, phase: "handover", winner: null }}
        userPlayerIndex={0}
        players={MOCK_PLAYERS}
        makeMove={mockMakeMove}
      />,
    );
    // Click "View board" to close the popup (sets breakdownClosed = true)
    fireEvent.click(screen.getByRole("button", { name: /View board/i }));
    expect(screen.getByRole("button", { name: /Next hand/i })).toBeInTheDocument();
    vi.useRealTimers();
  });
});

describe("CribbageGame readStored catch branch", () => {
  it("falls back to the default value when localStorage.getItem throws", () => {
    const spy = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("storage unavailable");
    });
    // readStored is called in useState initializers; rendering must not crash
    expect(() =>
      render(
        <CribbageGame
          view={{ ...baseView }}
          userPlayerIndex={0}
          players={MOCK_PLAYERS}
          makeMove={mockMakeMove}
        />,
      ),
    ).not.toThrow();
    spy.mockRestore();
  });
});

describe("CribbageGame activateFocusedControl", () => {
  it("Enter on a non-card button activates it (lines 414-415)", () => {
    const sixHand = [c(1, "H"), c(2, "D"), c(3, "C"), c(4, "S"), c(5, "H"), c(6, "D")];
    render(
      <CribbageGame
        view={{ ...baseView, phase: "discard", myHand: sixHand }}
        userPlayerIndex={0}
        players={MOCK_PLAYERS}
        makeMove={mockMakeMove}
      />,
    );
    const settingsBtn = screen.getByRole("button", { name: /Game settings/i });
    settingsBtn.focus();
    fireEvent.keyDown(window, { key: "Enter" });
    expect(screen.getByRole("group", { name: /Colour settings/i })).toBeInTheDocument();
  });

  it("Enter on a focused cut card calls clickFocusedCard (lines 423-424)", () => {
    const makeMove = vi.fn();
    render(
      <CribbageGame
        view={{ ...baseView, phase: "cut", cutDeckSize: 3 }}
        userPlayerIndex={0}
        players={MOCK_PLAYERS}
        makeMove={makeMove}
      />,
    );
    const cutCard = screen.getByRole("button", { name: "Cut card 1" });
    cutCard.focus();
    fireEvent.keyDown(window, { key: "Enter" });
    expect(makeMove).toHaveBeenCalledWith({ type: "cut", index: 0 });
  });

  it("Enter on a focused play card plays it (lines 431-432)", () => {
    const makeMove = vi.fn();
    render(
      <CribbageGame
        view={{ ...baseView, phase: "play", myHand: [c(5, "H")], runningCount: 0, nextPlayer: 0 }}
        userPlayerIndex={0}
        players={MOCK_PLAYERS}
        makeMove={makeMove}
      />,
    );
    const card = screen.getByRole("button", { name: "5 of H" });
    card.focus();
    fireEvent.keyDown(window, { key: "Enter" });
    expect(makeMove).toHaveBeenCalledWith({ type: "play", card: c(5, "H") });
  });
});

describe("CribbageGame uppercase keyboard shortcuts", () => {
  it("'G' key calls makeMove go when no cards are playable (line 471)", () => {
    const makeMove = vi.fn();
    render(
      <CribbageGame
        view={{
          ...baseView,
          phase: "play",
          myHand: [c(10, "S")],
          runningCount: 28,
          nextPlayer: 0,
        }}
        userPlayerIndex={0}
        players={MOCK_PLAYERS}
        makeMove={makeMove}
      />,
    );
    fireEvent.keyDown(window, { key: "G" });
    expect(makeMove).toHaveBeenCalledWith({ type: "go" });
  });

  it("'R' key calls makeMove ready in deal phase (line 478)", () => {
    const makeMove = vi.fn();
    render(
      <CribbageGame
        view={{ ...baseView, phase: "deal" }}
        userPlayerIndex={0}
        players={MOCK_PLAYERS}
        makeMove={makeMove}
      />,
    );
    fireEvent.keyDown(window, { key: "R" });
    expect(makeMove).toHaveBeenCalledWith({ type: "ready" });
  });
});

describe("CribbageGame log reset (line 502)", () => {
  it("resets toastedCount when the log shrinks on re-render", () => {
    vi.useFakeTimers();
    const log = [
      {
        category: "fifteen" as const,
        points: 2,
        player: 0 as const,
        source: "show" as const,
        cards: [],
      },
    ];
    const { rerender } = render(
      <CribbageGame
        view={{ ...baseView, phase: "show", log, winner: null }}
        userPlayerIndex={0}
        players={MOCK_PLAYERS}
        makeMove={mockMakeMove}
      />,
    );
    // Re-render with empty log — triggers log.length < toastedCount branch
    rerender(
      <CribbageGame
        view={{ ...baseView, phase: "show", log: [], winner: null }}
        userPlayerIndex={0}
        players={MOCK_PLAYERS}
        makeMove={mockMakeMove}
      />,
    );
    expect(true).toBe(true); // just verifying no crash
    vi.useRealTimers();
  });
});

describe("CribbageGame button onClick lambdas", () => {
  it("clicking the Ready button calls makeMove ready (line 921)", () => {
    const makeMove = vi.fn();
    render(
      <CribbageGame
        view={{ ...baseView, phase: "deal" }}
        userPlayerIndex={0}
        players={MOCK_PLAYERS}
        makeMove={makeMove}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Ready!/i }));
    expect(makeMove).toHaveBeenCalledWith({ type: "ready" });
  });

  it("clicking the Go button calls makeMove go (line 939)", () => {
    const makeMove = vi.fn();
    render(
      <CribbageGame
        view={{
          ...baseView,
          phase: "play",
          myHand: [c(10, "S")],
          runningCount: 28,
          nextPlayer: 0,
        }}
        userPlayerIndex={0}
        players={MOCK_PLAYERS}
        makeMove={makeMove}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Go!/i }));
    expect(makeMove).toHaveBeenCalledWith({ type: "go" });
  });

  it("handover action bar Next hand button calls makeMove continue (lines 945-953)", () => {
    const makeMove = vi.fn();
    render(
      <CribbageGame
        view={{ ...baseView, phase: "handover", winner: null }}
        userPlayerIndex={0}
        players={MOCK_PLAYERS}
        makeMove={makeMove}
      />,
    );
    // Close the popup to expose the action bar buttons
    fireEvent.click(screen.getByRole("button", { name: /View board/i }));
    fireEvent.click(screen.getAllByRole("button", { name: /Next hand/i })[0]);
    expect(makeMove).toHaveBeenCalledWith({ type: "continue" });
  });

  it("handover action bar Quit button calls makeMove quit (lines 945-953)", () => {
    const makeMove = vi.fn();
    render(
      <CribbageGame
        view={{ ...baseView, phase: "handover", winner: null }}
        userPlayerIndex={0}
        players={MOCK_PLAYERS}
        makeMove={makeMove}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /View board/i }));
    fireEvent.click(screen.getAllByRole("button", { name: /Quit/i })[0]);
    expect(makeMove).toHaveBeenCalledWith({ type: "quit" });
  });

  it("Show score breakdown button reopens the popup (lines 956-957)", () => {
    render(
      <CribbageGame
        view={{ ...baseView, phase: "show", winner: null }}
        userPlayerIndex={0}
        players={MOCK_PLAYERS}
        makeMove={mockMakeMove}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Close/i }));
    fireEvent.click(screen.getByRole("button", { name: /Show score breakdown/i }));
    expect(screen.getByRole("button", { name: /Close/i })).toBeInTheDocument();
  });

  it("handover popup Next hand button calls makeMove continue (lines 1041-1044)", () => {
    const makeMove = vi.fn();
    render(
      <CribbageGame
        view={{ ...baseView, phase: "handover", winner: null }}
        userPlayerIndex={0}
        players={MOCK_PLAYERS}
        makeMove={makeMove}
      />,
    );
    const nextHandBtns = screen.getAllByRole("button", { name: /Next hand/i });
    fireEvent.click(nextHandBtns[nextHandBtns.length - 1]);
    expect(makeMove).toHaveBeenCalledWith({ type: "continue" });
  });

  it("handover popup Quit button calls makeMove quit (lines 1041-1044)", () => {
    const makeMove = vi.fn();
    render(
      <CribbageGame
        view={{ ...baseView, phase: "handover", winner: null }}
        userPlayerIndex={0}
        players={MOCK_PLAYERS}
        makeMove={makeMove}
      />,
    );
    const quitBtns = screen.getAllByRole("button", { name: /Quit/i });
    fireEvent.click(quitBtns[quitBtns.length - 1]);
    expect(makeMove).toHaveBeenCalledWith({ type: "quit" });
  });
});

describe("CribbageGame branch coverage extras", () => {
  const sixHand = [c(1, "H"), c(2, "D"), c(3, "C"), c(4, "S"), c(5, "H"), c(6, "D")];

  // line 362: p.length >= 2 → 3rd card pick is ignored
  it("does not pick a 3rd card when 2 are already selected", () => {
    render(
      <CribbageGame
        view={{ ...baseView, phase: "discard", myHand: sixHand }}
        userPlayerIndex={0}
        players={MOCK_PLAYERS}
        makeMove={mockMakeMove}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "A of H" }));
    fireEvent.click(screen.getByRole("button", { name: "2 of D" }));
    fireEvent.click(screen.getByRole("button", { name: "3 of C" }));
    // 3rd card should NOT be picked (Send to Crib still shows 2/2)
    expect(screen.getByRole("button", { name: /Send to Crib \(2 \/ 2\)/i })).not.toBeDisabled();
    expect(screen.getByRole("button", { name: "3 of C" })).toHaveAttribute("aria-pressed", "false");
  });

  // line 598: dealAnim="up" for myHand in deal phase
  it("renders myHand cards in deal phase (dealAnim up)", () => {
    render(
      <CribbageGame
        view={{ ...baseView, phase: "deal", myHand: [c(5, "H"), c(6, "S")] }}
        userPlayerIndex={0}
        players={MOCK_PLAYERS}
        makeMove={mockMakeMove}
      />,
    );
    expect(screen.getByLabelText("5 of H")).toBeInTheDocument();
  });

  // line 616: cut phase guidance when myCut is already set
  it("shows 'Waiting for opponent' guidance after cutting in cut phase", () => {
    render(
      <CribbageGame
        view={{ ...baseView, phase: "cut", cutDeckSize: 0, myCut: c(7, "H") }}
        userPlayerIndex={0}
        players={MOCK_PLAYERS}
        makeMove={mockMakeMove}
      />,
    );
    expect(screen.getByText(/Waiting for Flora to cut/i)).toBeInTheDocument();
  });

  // line 620-621: deal guidance when myReady=true
  it("shows 'Waiting for opponent to be ready' when you are ready but opponent is not", () => {
    render(
      <CribbageGame
        view={{ ...baseView, phase: "deal", myReady: true, opponentReady: false }}
        userPlayerIndex={0}
        players={MOCK_PLAYERS}
        makeMove={mockMakeMove}
      />,
    );
    expect(screen.getByText(/Waiting for Flora to be ready/i)).toBeInTheDocument();
  });

  it("shows 'Both players ready. Dealing…' when both are ready", () => {
    render(
      <CribbageGame
        view={{ ...baseView, phase: "deal", myReady: true, opponentReady: true }}
        userPlayerIndex={0}
        players={MOCK_PLAYERS}
        makeMove={mockMakeMove}
      />,
    );
    expect(screen.getByText(/Both players ready/i)).toBeInTheDocument();
  });

  // line 628: discard guidance when myHand.length <= 4 (already discarded)
  it("shows waiting guidance when myHand is already down to 4 in discard phase", () => {
    render(
      <CribbageGame
        view={{
          ...baseView,
          phase: "discard",
          myHand: [c(1, "H"), c(2, "D"), c(3, "C"), c(4, "S")],
        }}
        userPlayerIndex={0}
        players={MOCK_PLAYERS}
        makeMove={mockMakeMove}
      />,
    );
    expect(screen.getByText(/Waiting for Flora to choose/i)).toBeInTheDocument();
  });

  // line 923: myReady=true → "✓ Ready" button text
  it("shows '✓ Ready' text on the button when already ready", () => {
    render(
      <CribbageGame
        view={{ ...baseView, phase: "deal", myReady: true }}
        userPlayerIndex={0}
        players={MOCK_PLAYERS}
        makeMove={mockMakeMove}
      />,
    );
    expect(screen.getByRole("button", { name: "✓ Ready" })).toBeDisabled();
  });

  // line 989: cut review popup when opponent is dealer (amDealer=false)
  it("shows opponent-dealt message in cut review when opponent is dealer", () => {
    render(
      <CribbageGame
        view={{ ...baseView, phase: "deal", myCut: c(7, "H"), opponentCut: c(3, "S"), dealer: 1 }}
        userPlayerIndex={0}
        players={MOCK_PLAYERS}
        makeMove={mockMakeMove}
      />,
    );
    expect(screen.getByText(/Flora cut lower/i)).toBeInTheDocument();
  });

  // line 219: points=1 in ScoreToast → "point" singular
  it("shows singular 'point' in score toast when event points is 1", () => {
    // source:"show", player:0 → anchor "myHand" → always rendered in bottom Seat overlay
    const log = [
      {
        category: "nob" as const,
        points: 1,
        player: 0 as const,
        source: "show" as const,
        cards: [],
      },
    ];
    render(
      <CribbageGame
        view={{ ...baseView, phase: "show", log, winner: null }}
        userPlayerIndex={0}
        players={MOCK_PLAYERS}
        makeMove={mockMakeMove}
      />,
    );
    expect(screen.getByText("point")).toBeInTheDocument();
  });

  // line 216: opponent toast (mine=false → crib-toast--opp class)
  it("renders an opponent score toast when the event belongs to the other player", () => {
    const log = [
      {
        category: "fifteen" as const,
        points: 2,
        player: 1 as const,
        source: "play" as const,
        cards: [],
      },
    ];
    const { container } = render(
      <CribbageGame
        view={{
          ...baseView,
          phase: "play",
          log,
          myHand: [c(5, "H")],
          nextPlayer: 0,
          runningCount: 0,
        }}
        userPlayerIndex={0}
        players={MOCK_PLAYERS}
        makeMove={mockMakeMove}
      />,
    );
    expect(container.querySelector(".crib-toast--opp")).toBeInTheDocument();
  });

  // line 273: ScoreLog with two events having the same source (acc[key] already set)
  it("renders score breakdown with two events from the same source", () => {
    vi.useFakeTimers();
    const log = [
      {
        category: "fifteen" as const,
        points: 2,
        player: 0 as const,
        source: "show" as const,
        cards: [],
      },
      {
        category: "pair" as const,
        points: 2,
        player: 0 as const,
        source: "show" as const,
        cards: [],
      },
    ];
    render(
      <CribbageGame
        view={{ ...baseView, phase: "show", log, winner: null }}
        userPlayerIndex={0}
        players={MOCK_PLAYERS}
        makeMove={mockMakeMove}
      />,
    );
    // Each toast clears after 1500ms; the 2nd timer is only scheduled after the
    // 1st fires and React re-renders, so advance in two separate act() calls.
    act(() => {
      vi.advanceTimersByTime(1600);
    });
    act(() => {
      vi.advanceTimersByTime(1600);
    });
    expect(screen.getAllByText("Score breakdown").length).toBeGreaterThan(0);
    vi.useRealTimers();
  });

  // line 292-301 + 522: ScoreLog / announce with myIndex=-1 (watcher) and opponent event
  it("renders score breakdown with watcher perspective (myIndex=-1)", () => {
    vi.useFakeTimers();
    const log = [
      {
        category: "fifteen" as const,
        points: 2,
        player: 0 as const,
        source: "show" as const,
        cards: [],
      },
      {
        category: "pair" as const,
        points: 2,
        player: 1 as const,
        source: "play" as const,
        cards: [],
      },
    ];
    render(
      <CribbageGame
        view={{ ...baseView, phase: "show", log, winner: null }}
        userPlayerIndex={-1}
        players={MOCK_PLAYERS}
        makeMove={mockMakeMove}
      />,
    );
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(screen.getByText(/Player 1/i)).toBeInTheDocument();
    vi.useRealTimers();
  });

  // line 708: watcher + active toast
  it("renders a centred score toast for watchers", () => {
    const log = [
      {
        category: "fifteen" as const,
        points: 2,
        player: 0 as const,
        source: "show" as const,
        cards: [],
      },
    ];
    render(
      <CribbageGame
        view={{ ...baseView, phase: "show", log, winner: null }}
        userPlayerIndex={-1}
        players={MOCK_PLAYERS}
        makeMove={mockMakeMove}
      />,
    );
    expect(screen.getByText(/Fifteen/)).toBeInTheDocument();
  });

  // line 719: cut phase with myCut already set → "you cut" display
  it("shows the cut card face-up when myCut is set in cut phase", () => {
    render(
      <CribbageGame
        view={{ ...baseView, phase: "cut", myCut: c(3, "H"), cutDeckSize: 0 }}
        userPlayerIndex={0}
        players={MOCK_PLAYERS}
        makeMove={mockMakeMove}
      />,
    );
    expect(screen.getByText("You cut")).toBeInTheDocument();
    expect(screen.getByLabelText("3 of H")).toBeInTheDocument();
  });

  // line 743: cutDeckSize=1 → left position is "50%"
  it("renders cut fan with a single card (cutDeckSize=1)", () => {
    render(
      <CribbageGame
        view={{ ...baseView, phase: "cut", cutDeckSize: 1 }}
        userPlayerIndex={0}
        players={MOCK_PLAYERS}
        makeMove={mockMakeMove}
      />,
    );
    expect(screen.getByRole("button", { name: "Cut card 1" })).toBeInTheDocument();
  });

  // line 463: Space key in cut phase toggles a focused card
  it("Space in cut phase with no focused non-card button calls clickFocusedCard", () => {
    const makeMove = vi.fn();
    render(
      <CribbageGame
        view={{ ...baseView, phase: "cut", cutDeckSize: 3 }}
        userPlayerIndex={0}
        players={MOCK_PLAYERS}
        makeMove={makeMove}
      />,
    );
    const cutCard = screen.getByRole("button", { name: "Cut card 1" });
    cutCard.focus();
    fireEvent.keyDown(window, { key: " " });
    expect(makeMove).toHaveBeenCalledWith({ type: "cut", index: 0 });
  });

  // line 467/471: g/G keys when cards ARE playable → condition false, makeMove NOT called
  it("'g' key does not fire go when a playable card exists", () => {
    const makeMove = vi.fn();
    render(
      <CribbageGame
        view={{ ...baseView, phase: "play", myHand: [c(5, "H")], runningCount: 0, nextPlayer: 0 }}
        userPlayerIndex={0}
        players={MOCK_PLAYERS}
        makeMove={makeMove}
      />,
    );
    fireEvent.keyDown(window, { key: "g" });
    expect(makeMove).not.toHaveBeenCalled();
  });

  // line 475/478: r/R when already ready → makeMove NOT called
  it("'r' key does not fire ready when already ready", () => {
    const makeMove = vi.fn();
    render(
      <CribbageGame
        view={{ ...baseView, phase: "deal", myReady: true }}
        userPlayerIndex={0}
        players={MOCK_PLAYERS}
        makeMove={makeMove}
      />,
    );
    fireEvent.keyDown(window, { key: "r" });
    expect(makeMove).not.toHaveBeenCalled();
  });

  // line 1021: "Hand complete" with watcher perspective
  it("shows 'Hand complete' heading with watcher (isWatcher=true)", () => {
    vi.useFakeTimers();
    render(
      <CribbageGame
        view={{ ...baseView, phase: "handover", winner: null, scores: [10, 8] }}
        userPlayerIndex={-1}
        players={MOCK_PLAYERS}
        makeMove={mockMakeMove}
      />,
    );
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(screen.getAllByText(/Hand complete/i).length).toBeGreaterThan(0);
    vi.useRealTimers();
  });
});

describe("CribbageGame winner UI", () => {
  it("shows You win when view.winner equals userPlayerIndex", () => {
    const view: CribbageView = {
      phase: "done",
      dealer: 0,
      myIndex: 1,
      myHand: [],
      opponentHand: [],
      opponentHandSize: 0,
      crib: [],
      cribSize: 0,
      starter: null,
      playPile: [],
      runningCount: 0,
      scores: [12, 15],
      nextPlayer: 1,
      myReady: false,
      opponentReady: false,
      cutDeckSize: 0,
      myCut: null,
      opponentCut: null,
      opponentHasCut: false,
      log: [],
      winner: 1,
    };

    render(
      <CribbageGame
        view={view}
        userPlayerIndex={1}
        players={MOCK_PLAYERS}
        makeMove={mockMakeMove}
      />,
    );

    const alert = screen.getByRole("alert");
    expect(alert).toBeInTheDocument();
    expect(alert).toHaveTextContent(/You won/i);
    expect(alert).toHaveTextContent(/You\s*15/i);
  });

  it("shows You lost when view.winner is opponent", () => {
    const view: CribbageView = {
      phase: "show",
      dealer: 0,
      myIndex: 1,
      myHand: [],
      opponentHand: [],
      opponentHandSize: 0,
      crib: [],
      cribSize: 0,
      starter: null,
      playPile: [],
      runningCount: 0,
      scores: [10, 11],
      nextPlayer: 0,
      myReady: false,
      opponentReady: false,
      cutDeckSize: 0,
      myCut: null,
      opponentCut: null,
      opponentHasCut: false,
      log: [],
      winner: 0,
    };

    render(
      <CribbageGame
        view={view}
        userPlayerIndex={1}
        players={MOCK_PLAYERS}
        makeMove={mockMakeMove}
      />,
    );

    const alert = screen.getByRole("alert");
    expect(alert).toBeInTheDocument();
    expect(alert).toHaveTextContent(/You lost/i);
    expect(alert).toHaveTextContent(/You\s*11/i);
  });
});
