// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import * as matchers from "@testing-library/jest-dom/matchers";
import UserChip from "./UserChip";

expect.extend(matchers);

function renderChip(props: Parameters<typeof UserChip>[0]) {
  return render(
    <MemoryRouter>
      <UserChip {...props} />
    </MemoryRouter>,
  );
}

describe("UserChip", () => {
  it("renders an initial avatar and name, and links to the profile by default", () => {
    const { container } = renderChip({
      user: { username: "alice", display: "Alice Smith" },
    });

    // Name shown
    expect(screen.getByText("Alice Smith")).toBeInTheDocument();

    // Initial derived from display name, uppercased
    const avatar = container.querySelector(".userChip-avatar");
    expect(avatar).not.toBeNull();
    expect(avatar?.textContent).toBe("A");
    // deterministic accent color applied as background
    expect((avatar as HTMLElement).style.background).toMatch(/var\(--/);

    // Links to the profile
    const link = container.querySelector("a.userChip-link");
    expect(link).toHaveAttribute("href", "/profile/alice");
  });

  it("uses the username initial when display is empty and falls back to '?'", () => {
    const { container: c1 } = renderChip({
      user: { username: "bob", display: "" },
    });
    expect(c1.querySelector(".userChip-avatar")?.textContent).toBe("B");

    const { container: c2 } = renderChip({
      user: { username: "", display: "" },
    });
    expect(c2.querySelector(".userChip-avatar")?.textContent).toBe("?");
  });

  it("renders an <img> avatar when avatarUrl is provided", () => {
    const { container } = renderChip({
      user: {
        username: "carol",
        display: "Carol",
        avatarUrl: "https://example.com/c.png",
      },
    });
    const img = container.querySelector("img.userChip-avatar--img");
    expect(img).toHaveAttribute("src", "https://example.com/c.png");
  });

  it("applies an accent ring via boxShadow when accentColor is set", () => {
    const { container } = renderChip({
      user: { username: "dave", display: "Dave", accentColor: "#ff0000" },
    });
    const avatar = container.querySelector(".userChip-avatar") as HTMLElement;
    expect(avatar.style.boxShadow).toContain("#ff0000");
  });

  it("respects size by setting width/height and hides the name when showName is false", () => {
    const { container } = renderChip({
      user: { username: "erin", display: "Erin" },
      size: 3,
      showName: false,
    });
    const avatar = container.querySelector(".userChip-avatar") as HTMLElement;
    expect(avatar.style.width).toBe("3rem");
    expect(avatar.style.height).toBe("3rem");
    expect(screen.queryByText("Erin")).toBeNull();
  });

  it("renders without a link when link is false", () => {
    const { container } = renderChip({
      user: { username: "frank", display: "Frank" },
      link: false,
    });
    expect(container.querySelector("a.userChip-link")).toBeNull();
    expect(container.querySelector(".userChip")).not.toBeNull();
  });

  it("produces deterministic accent colors for the same username", () => {
    const { container: a } = renderChip({ user: { username: "zoe", display: "Z" } });
    const { container: b } = renderChip({ user: { username: "zoe", display: "Z" } });
    const bgA = (a.querySelector(".userChip-avatar") as HTMLElement).style.background;
    const bgB = (b.querySelector(".userChip-avatar") as HTMLElement).style.background;
    expect(bgA).toBe(bgB);
  });
});
