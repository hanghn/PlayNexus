// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import SecuritySettings from "./SecuritySettings.tsx";
import type useSecuritySettings from "../hooks/useSecuritySettings.ts";

type HookValue = ReturnType<typeof useSecuritySettings>;

// The component is a pure view over the useSecuritySettings hook; mock the hook
// so we can deterministically drive every rendered branch and verify the wiring
// between controls and the actions the hook exposes.
const hookState = vi.hoisted(() => ({ current: {} as HookValue }));

vi.mock("../hooks/useSecuritySettings.ts", () => ({
  default: () => hookState.current,
}));

type Status = {
  mfaEnabled: boolean;
  email: string | null;
  rememberMe: boolean;
};

function makeHook(overrides: Partial<Record<string, unknown>> = {}): HookValue {
  return {
    status: { mfaEnabled: false, email: "user@example.com", rememberMe: false } as Status,
    error: null,
    busy: false,
    stage: "idle",
    email: "",
    setEmail: vi.fn(),
    code: "",
    setCode: vi.fn(),
    sendEnrollCode: vi.fn(),
    confirmEnroll: vi.fn(),
    cancelEnroll: vi.fn(),
    disable2FA: vi.fn(),
    toggleRemember: vi.fn(),
    signOutEverywhere: vi.fn(),
    ...overrides,
  } as HookValue;
}

function setHook(overrides: Partial<Record<string, unknown>> = {}) {
  hookState.current = makeHook(overrides);
  return hookState.current;
}

beforeEach(() => {
  setHook();
});

afterEach(() => {
  cleanup();
});

describe("SecuritySettings", () => {
  it("renders a loading state when status is not yet available", () => {
    setHook({ status: null });
    render(<SecuritySettings />);
    expect(screen.getByText("Security")).toBeInTheDocument();
    expect(screen.getByText("Loading…")).toBeInTheDocument();
    // None of the interactive controls should render while loading.
    expect(screen.queryByLabelText("Email for login codes")).not.toBeInTheDocument();
  });

  it("shows the email enrollment form in the idle stage and sends a code", () => {
    const hook = setHook({ stage: "idle", email: "me@x.com" });
    render(<SecuritySettings />);

    const input = screen.getByLabelText("Email for login codes");
    expect(input).toHaveValue("me@x.com");

    fireEvent.change(input, { target: { value: "new@x.com" } });
    expect(hook.setEmail).toHaveBeenCalledWith("new@x.com");

    const sendBtn = screen.getByRole("button", { name: "Send code" });
    expect(sendBtn).toBeEnabled();
    fireEvent.click(sendBtn);
    expect(hook.sendEnrollCode).toHaveBeenCalledTimes(1);
  });

  it("disables the Send code button when the email is blank or busy", () => {
    setHook({ stage: "idle", email: "   " });
    const { unmount } = render(<SecuritySettings />);
    expect(screen.getByRole("button", { name: "Send code" })).toBeDisabled();
    unmount();

    setHook({ stage: "idle", email: "ok@x.com", busy: true });
    render(<SecuritySettings />);
    expect(screen.getByRole("button", { name: "Send code" })).toBeDisabled();
  });

  it("shows the code-entry stage and verifies / cancels enrollment", () => {
    const hook = setHook({ stage: "codeSent", email: "me@x.com", code: "123456" });
    render(<SecuritySettings />);

    expect(screen.getByText(/Enter the code sent to me@x.com/)).toBeInTheDocument();

    const codeInput = screen.getByLabelText("6-digit code");
    expect(codeInput).toHaveValue("123456");
    fireEvent.change(codeInput, { target: { value: "000000" } });
    expect(hook.setCode).toHaveBeenCalledWith("000000");

    const verifyBtn = screen.getByRole("button", { name: /Verify & enable/ });
    expect(verifyBtn).toBeEnabled();
    fireEvent.click(verifyBtn);
    expect(hook.confirmEnroll).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(hook.cancelEnroll).toHaveBeenCalledTimes(1);
  });

  it("disables Verify when the code is blank", () => {
    setHook({ stage: "codeSent", email: "me@x.com", code: "  " });
    render(<SecuritySettings />);
    expect(screen.getByRole("button", { name: /Verify & enable/ })).toBeDisabled();
  });

  it("shows enabled 2FA with the email and a working Disable button", () => {
    const hook = setHook({
      status: { mfaEnabled: true, email: "two@fa.com", rememberMe: false },
    });
    render(<SecuritySettings />);

    expect(screen.getByText(/codes are sent to two@fa.com/)).toBeInTheDocument();
    // The enrollment form should not be shown when already enabled.
    expect(screen.queryByLabelText("Email for login codes")).not.toBeInTheDocument();

    const disableBtn = screen.getByRole("button", { name: "Disable" });
    fireEvent.click(disableBtn);
    expect(hook.disable2FA).toHaveBeenCalledTimes(1);
  });

  it("toggles the remember-me checkbox", () => {
    const hook = setHook({
      status: { mfaEnabled: false, email: null, rememberMe: false },
    });
    render(<SecuritySettings />);

    const checkbox = screen.getByLabelText<HTMLInputElement>("Stay signed in on this device");
    expect(checkbox.checked).toBe(false);
    fireEvent.click(checkbox);
    expect(hook.toggleRemember).toHaveBeenCalledWith(true);
  });

  it("reflects a checked remember-me state from status", () => {
    setHook({ status: { mfaEnabled: false, email: null, rememberMe: true } });
    render(<SecuritySettings />);
    const checkbox = screen.getByLabelText<HTMLInputElement>("Stay signed in on this device");
    expect(checkbox.checked).toBe(true);
  });

  it("signs out of all devices", () => {
    const hook = setHook();
    render(<SecuritySettings />);
    const btn = screen.getByRole("button", { name: "Sign out of all devices" });
    fireEvent.click(btn);
    expect(hook.signOutEverywhere).toHaveBeenCalledTimes(1);
  });

  it("disables action controls while busy", () => {
    setHook({ busy: true, stage: "idle", email: "ok@x.com" });
    render(<SecuritySettings />);
    expect(screen.getByLabelText("Stay signed in on this device")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Sign out of all devices" })).toBeDisabled();
  });

  it("renders an error message when error is present", () => {
    setHook({ error: "Something went wrong" });
    render(<SecuritySettings />);
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
  });

  it("does not render an error paragraph when there is no error", () => {
    setHook({ error: null });
    const { container } = render(<SecuritySettings />);
    expect(container.querySelector(".error-message")).toBeNull();
  });
});
