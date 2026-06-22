// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import * as matchers from "@testing-library/jest-dom/matchers";

expect.extend(matchers);

afterEach(() => {
  cleanup();
});
import { type FallbackProps } from "react-error-boundary";
import fallback from "./fallback";

describe("fallback", () => {
  it("renders the generic error message", () => {
    const props = { error: new Error("boom"), resetErrorBoundary: () => {} } as FallbackProps;
    render(fallback(props));
    expect(
      screen.getByText("There was an unexpected error in the application!"),
    ).toBeInTheDocument();
  });

  it("renders error name, message, stack, and console hint for an Error", () => {
    const err = new Error("kaboom");
    err.name = "MyError";
    err.stack = "stack-trace-line-1\nstack-trace-line-2";
    const props = { error: err, resetErrorBoundary: () => {} } as FallbackProps;
    const { container } = render(fallback(props));

    expect(screen.getByText(/Unexpected error MyError: kaboom/)).toBeInTheDocument();
    expect(
      screen.getByText("There may be more details if you check the developer console"),
    ).toBeInTheDocument();

    const pre = container.querySelector("pre");
    expect(pre).not.toBeNull();
    expect(pre).toHaveTextContent("stack-trace-line-1");
    expect(pre).toHaveStyle({ fontFamily: "monospace" });
  });

  it("does not render error details when error is not an Error instance", () => {
    const props = {
      error: "just a string",
      resetErrorBoundary: () => {},
    } as unknown as FallbackProps;
    const { container } = render(fallback(props));

    expect(
      screen.getByText("There was an unexpected error in the application!"),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Unexpected error/)).not.toBeInTheDocument();
    expect(container.querySelector("pre")).toBeNull();
    expect(
      screen.queryByText("There may be more details if you check the developer console"),
    ).not.toBeInTheDocument();
  });
});
