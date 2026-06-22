// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { SecurityStatus } from "@gamenite/shared";
import SecuritySettings from "../../src/components/SecuritySettings.tsx";

const securityState = vi.hoisted(() => ({
  status: null as SecurityStatus | null,
  error: null as string | null,
  busy: false,
  stage: "idle",
  email: "",
  code: "",
  setEmail: vi.fn(),
  setCode: vi.fn(),
  sendEnrollCode: vi.fn(),
  confirmEnroll: vi.fn(),
  cancelEnroll: vi.fn(),
  disable2FA: vi.fn(),
  toggleRemember: vi.fn(),
  signOutEverywhere: vi.fn(),
}));

vi.mock("../../src/hooks/useSecuritySettings.ts", () => ({
  default: () => ({ ...securityState }),
}));

beforeEach(() => {
  securityState.status = null;
  securityState.error = null;
  securityState.busy = false;
  securityState.stage = "idle";
  securityState.email = "";
  securityState.code = "";
  securityState.setEmail.mockReset();
  securityState.setCode.mockReset();
  securityState.sendEnrollCode.mockReset();
  securityState.confirmEnroll.mockReset();
  securityState.cancelEnroll.mockReset();
  securityState.disable2FA.mockReset();
  securityState.toggleRemember.mockReset();
  securityState.signOutEverywhere.mockReset();
});

afterEach(() => {
  cleanup();
});

describe("SecuritySettings", () => {
  it("shows the loading state until security data is available", () => {
    render(<SecuritySettings />);
    expect(screen.getByText("Loading…")).toBeTruthy();
  });

  it("renders the enrollment flow and wires each action", () => {
    securityState.status = { mfaEnabled: false, rememberMe: false };
    securityState.stage = "idle";
    securityState.email = "bob@example.com";

    render(<SecuritySettings />);

    expect(screen.getByLabelText("Email for login codes")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Send code" }));
    expect(securityState.sendEnrollCode).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("checkbox", { name: "Stay signed in on this device" }));
    expect(securityState.toggleRemember).toHaveBeenCalledWith(true);

    fireEvent.click(screen.getByRole("button", { name: "Sign out of all devices" }));
    expect(securityState.signOutEverywhere).toHaveBeenCalledTimes(1);
  });

  it("shows the enabled-2FA branch and its disable action", () => {
    securityState.status = {
      mfaEnabled: true,
      email: "bob@example.com",
      rememberMe: true,
    };

    render(<SecuritySettings />);

    expect(screen.getByText(/Enabled — codes are sent to bob@example.com/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Disable" }));
    expect(securityState.disable2FA).toHaveBeenCalledTimes(1);
  });
});
