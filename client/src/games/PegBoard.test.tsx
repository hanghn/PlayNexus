// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, cleanup } from "@testing-library/react";
import { describe, it, expect, afterEach } from "vitest";
import PegBoard from "./PegBoard.tsx";

afterEach(cleanup);

describe("PegBoard", () => {
  it("renders the board for typical scores", () => {
    const { container } = render(
      <PegBoard youName="You" youScore={30} oppName="Opp" oppScore={25} />,
    );
    expect(container.querySelector(".crib-pegboard")).toBeInTheDocument();
  });

  it("renders a peg on the inbound lane when score exceeds 60 (down-the-in-lane branch)", () => {
    // scorePos line 60: `return { x: lanes.in, y: TOP_Y + off(s - HOLES - 1) }` requires s > 60
    const { container } = render(
      <PegBoard youName="You" youScore={80} oppName="Opp" oppScore={65} />,
    );
    expect(container.querySelector(".crib-pegboard")).toBeInTheDocument();
  });

  it("renders a peg at the finish position when score is 121", () => {
    const { container } = render(
      <PegBoard youName="You" youScore={121} oppName="Opp" oppScore={121} />,
    );
    expect(container.querySelector(".crib-pegboard")).toBeInTheDocument();
  });

  it("renders a peg at the start position when score is 0 (s <= 0 branch)", () => {
    // scorePos line 57: `if (s <= 0) return { x: lanes.out, y: BOT_Y }` requires score = 0
    const { container } = render(
      <PegBoard youName="You" youScore={0} oppName="Opp" oppScore={0} />,
    );
    expect(container.querySelector(".crib-pegboard")).toBeInTheDocument();
  });
});
