// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import * as matchers from "@testing-library/jest-dom/matchers";
import CribbageHelp from "./CribbageHelp";

expect.extend(matchers);

afterEach(() => {
  cleanup();
});

function renderPage() {
  return render(
    <MemoryRouter>
      <CribbageHelp />
    </MemoryRouter>,
  );
}

describe("CribbageHelp", () => {
  it("renders the page title and intro", () => {
    renderPage();
    expect(
      screen.getByRole("heading", { level: 1, name: /how to play cribbage/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/First player to 121 points wins\./i)).toBeInTheDocument();
  });

  it("renders a back link to the games route", () => {
    renderPage();
    const back = screen.getByRole("link", { name: /back to games/i });
    expect(back).toBeInTheDocument();
    expect(back).toHaveAttribute("href", "/games");
  });

  it("renders all section headings", () => {
    renderPage();
    const headings = [
      "A hand, step by step",
      "Card values",
      "Scoring during the Play (pegging)",
      "Scoring in the Show",
      "Playing the computer: Easy vs Hard",
      "Keyboard controls",
    ];
    for (const h of headings) {
      expect(screen.getByRole("heading", { level: 2, name: h })).toBeInTheDocument();
    }
  });

  it("renders the step-by-step flow list with all six steps", () => {
    renderPage();
    for (const step of [
      "Deal.",
      "Discard.",
      "Cut the starter.",
      "The Play (pegging).",
      "The Show.",
      "Next hand.",
    ]) {
      expect(screen.getByText(step)).toBeInTheDocument();
    }
  });

  it("renders both scoring tables with their column headers", () => {
    renderPage();
    const tables = screen.getAllByRole("table");
    expect(tables).toHaveLength(2);
    expect(screen.getByRole("columnheader", { name: /^When$/i })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /^Notes$/i })).toBeInTheDocument();
    // "Combination" and "Points" appear in both tables.
    expect(screen.getAllByRole("columnheader", { name: /^Combination$/i })).toHaveLength(2);
    expect(screen.getAllByRole("columnheader", { name: /^Points$/i })).toHaveLength(2);
  });

  it("mentions the perfect 29 hand and both AI difficulties", () => {
    renderPage();
    expect(screen.getByText(/the perfect hand:/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: /^Easy$/ })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: /^Hard$/ })).toBeInTheDocument();
  });

  it("describes the keyboard controls", () => {
    renderPage();
    expect(screen.getByText(/play entirely by keyboard/i)).toBeInTheDocument();
    expect(screen.getByText("Space")).toBeInTheDocument();
    expect(screen.getByText("Enter")).toBeInTheDocument();
    expect(screen.getByText("G")).toBeInTheDocument();
    expect(screen.getByText("R")).toBeInTheDocument();
  });
});
