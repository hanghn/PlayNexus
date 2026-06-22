// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { describe, it, expect, afterEach } from "vitest";
import GameResult from "../../src/components/GameResult.tsx";

afterEach(cleanup);

describe("GameResult", () => {
  it("announces a win with the winning style", () => {
    render(<GameResult isWinner />);
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("🎉 You won!");
    expect(alert).toHaveStyle({ backgroundColor: "#d4edda", color: "#155724" });
  });

  it("announces a loss with the losing style", () => {
    render(<GameResult isWinner={false} />);
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("😔 You lost.");
    expect(alert).toHaveStyle({ backgroundColor: "#f8d7da", color: "#721c24" });
  });

  it("renders an optional message when provided", () => {
    render(<GameResult isWinner message={<span data-testid="msg">Final score 42</span>} />);
    expect(screen.getByTestId("msg")).toHaveTextContent("Final score 42");
  });

  it("omits the message block when none is given", () => {
    render(<GameResult isWinner={false} />);
    // Only the result line text is present; no extra message node.
    expect(screen.getByRole("alert").querySelector("div")).toBeNull();
  });
});
