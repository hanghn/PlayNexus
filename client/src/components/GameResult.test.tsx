// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import GameResult from "./GameResult";

describe("GameResult", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders the winner message and green styling when isWinner is true", () => {
    render(<GameResult isWinner={true} />);

    const alert = screen.getByRole("alert");
    expect(alert).toBeInTheDocument();
    expect(alert).toHaveTextContent("🎉 You won!");
    expect(alert).toHaveAttribute("aria-live", "assertive");
    expect(alert).toHaveStyle({ backgroundColor: "#d4edda", color: "#155724" });
  });

  it("renders the loser message and red styling when isWinner is false", () => {
    render(<GameResult isWinner={false} />);

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("😔 You lost.");
    expect(alert).toHaveStyle({ backgroundColor: "#f8d7da", color: "#721c24" });
  });

  it("does not render the optional message container when message is omitted", () => {
    render(<GameResult isWinner={true} />);
    // The alert has no nested message div when message is omitted.
    const alert = screen.getByRole("alert");
    expect(alert.querySelector("div")).toBeNull();
  });

  it("renders the optional message node when provided", () => {
    render(<GameResult isWinner={false} message={<span>Better luck next time</span>} />);

    expect(screen.getByText("Better luck next time")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("😔 You lost.");
  });

  it("renders a plain string message", () => {
    render(<GameResult isWinner={true} message="Score: 42" />);

    expect(screen.getByText("Score: 42")).toBeInTheDocument();
  });
});
