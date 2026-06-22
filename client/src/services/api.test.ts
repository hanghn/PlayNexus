// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { AxiosError } from "axios";
import { api, apiErrorMessage } from "./api";

describe("api service", () => {
  describe("api instance", () => {
    it("is an axios instance configured with credentials", () => {
      expect(api).toBeDefined();
      expect(typeof api.get).toBe("function");
      expect(typeof api.post).toBe("function");
      expect(api.defaults.withCredentials).toBe(true);
    });

    it("registers request and response interceptors", () => {
      // The module installs one request and one response interceptor.
      const reqHandlers = (
        api.interceptors.request as unknown as {
          handlers: unknown[];
        }
      ).handlers;
      const resHandlers = (
        api.interceptors.response as unknown as {
          handlers: unknown[];
        }
      ).handlers;
      expect(reqHandlers.length).toBeGreaterThanOrEqual(1);
      expect(resHandlers.length).toBeGreaterThanOrEqual(1);
    });

    it("passes through config in the request interceptor success handler", () => {
      const handlers = (
        api.interceptors.request as unknown as {
          handlers: { fulfilled: (c: unknown) => unknown }[];
        }
      ).handlers;
      const config = { url: "/x" };
      expect(handlers[0].fulfilled(config)).toBe(config);
    });

    it("passes through response in the response interceptor success handler", () => {
      const handlers = (
        api.interceptors.response as unknown as {
          handlers: { fulfilled: (r: unknown) => unknown }[];
        }
      ).handlers;
      const response = { data: 1 };
      expect(handlers[0].fulfilled(response)).toBe(response);
    });

    it("rejects in the request interceptor error handler", async () => {
      const handlers = (
        api.interceptors.request as unknown as {
          handlers: { rejected: (e: unknown) => Promise<unknown> }[];
        }
      ).handlers;
      const err = new AxiosError("boom");
      await expect(handlers[0].rejected(err)).rejects.toBe(err);
    });

    it("rejects in the response interceptor error handler", async () => {
      const handlers = (
        api.interceptors.response as unknown as {
          handlers: { rejected: (e: unknown) => Promise<unknown> }[];
        }
      ).handlers;
      const err = new AxiosError("boom");
      await expect(handlers[0].rejected(err)).rejects.toBe(err);
    });
  });

  describe("apiErrorMessage", () => {
    it("prefers the server's { error } string from an AxiosError response", () => {
      const err = new AxiosError("Request failed");
      err.response = {
        data: { error: "User not found" },
        status: 404,
        statusText: "Not Found",
        headers: {},
        config: {} as never,
      };
      expect(apiErrorMessage(err)).toBe("User not found");
    });

    it("falls back to the default when AxiosError data.error is not a string", () => {
      const err = new AxiosError("Request failed");
      err.response = {
        data: { error: 123 },
        status: 500,
        statusText: "Error",
        headers: {},
        config: {} as never,
      };
      expect(apiErrorMessage(err)).toBe("Something went wrong");
    });

    it("falls back to the default when AxiosError has no response", () => {
      const err = new AxiosError("Network Error");
      expect(apiErrorMessage(err)).toBe("Something went wrong");
    });

    it("uses a custom fallback when provided", () => {
      const err = new AxiosError("Network Error");
      expect(apiErrorMessage(err, "Custom fallback")).toBe("Custom fallback");
    });

    it("uses a plain Error's message", () => {
      expect(apiErrorMessage(new Error("oops"))).toBe("oops");
    });

    it("falls back to default for a plain Error with no message", () => {
      expect(apiErrorMessage(new Error(""))).toBe("Something went wrong");
    });

    it("falls back to default for non-error values", () => {
      expect(apiErrorMessage("a string")).toBe("Something went wrong");
      expect(apiErrorMessage(undefined)).toBe("Something went wrong");
      expect(apiErrorMessage(null)).toBe("Something went wrong");
      expect(apiErrorMessage({ random: true })).toBe("Something went wrong");
    });
  });
});
