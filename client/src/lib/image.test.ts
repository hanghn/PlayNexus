// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fileToAvatarDataUrl } from "./image";

/**
 * jsdom does not implement <canvas> 2D contexts, nor does it fire image
 * onload/onerror for data URLs. We stub FileReader, Image, and the canvas
 * getContext/toDataURL so the pure geometry/branch logic in image.ts can run
 * deterministically.
 */

type ReaderResult = { result?: string; fail?: boolean };

const readerBehavior: ReaderResult = {};
const imageBehavior = { fail: false, width: 800, height: 400 };

class MockFileReader {
  result: string | null = null;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  readAsDataURL(_file: unknown): void {
    setTimeout(() => {
      if (readerBehavior.fail) {
        this.onerror?.();
        return;
      }
      this.result = readerBehavior.result ?? "data:image/png;base64,AAAA";
      this.onload?.();
    }, 0);
  }
}

class MockImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  width = 0;
  height = 0;
  private _src = "";
  set src(value: string) {
    this._src = value;
    setTimeout(() => {
      if (imageBehavior.fail) {
        this.onerror?.();
        return;
      }
      this.width = imageBehavior.width;
      this.height = imageBehavior.height;
      this.onload?.();
    }, 0);
  }
  get src(): string {
    return this._src;
  }
}

const drawImage = vi.fn();
const toDataURL = vi.fn(() => "data:image/jpeg;base64,RESULT");
let getContextReturnsNull = false;

beforeEach(() => {
  readerBehavior.result = undefined;
  readerBehavior.fail = false;
  imageBehavior.fail = false;
  imageBehavior.width = 800;
  imageBehavior.height = 400;
  getContextReturnsNull = false;
  drawImage.mockClear();
  toDataURL.mockClear();

  vi.stubGlobal("FileReader", MockFileReader);
  vi.stubGlobal("Image", MockImage);

  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(() =>
    getContextReturnsNull ? null : ({ drawImage } as unknown as CanvasRenderingContext2D),
  );
  vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockImplementation(toDataURL);

  vi.useFakeTimers();
});

afterEach(() => {
  vi.runOnlyPendingTimers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function makeFile(type: string): File {
  return { type } as File;
}

describe("fileToAvatarDataUrl", () => {
  it("rejects non-image files before any IO", async () => {
    await expect(fileToAvatarDataUrl(makeFile("text/plain"))).rejects.toThrow(
      "Please choose an image file.",
    );
  });

  it("produces a JPEG data URL for a wide image, cropping height", async () => {
    imageBehavior.width = 800;
    imageBehavior.height = 400;
    const promise = fileToAvatarDataUrl(makeFile("image/png"), 256);
    await vi.runAllTimersAsync();
    await expect(promise).resolves.toBe("data:image/jpeg;base64,RESULT");

    // scale = max(256/800, 256/400) = 0.64; w = 512, h = 256
    expect(drawImage).toHaveBeenCalledTimes(1);
    const [, dx, dy, dw, dh] = drawImage.mock.calls[0];
    expect(dw).toBeCloseTo(512);
    expect(dh).toBeCloseTo(256);
    expect(dx).toBeCloseTo((256 - 512) / 2);
    expect(dy).toBeCloseTo(0);
    expect(toDataURL).toHaveBeenCalledWith("image/jpeg", 0.85);
  });

  it("crops width for a tall image and honors a custom size", async () => {
    imageBehavior.width = 200;
    imageBehavior.height = 1000;
    const promise = fileToAvatarDataUrl(makeFile("image/jpeg"), 100);
    await vi.runAllTimersAsync();
    await promise;

    // scale = max(100/200, 100/1000) = 0.5; w = 100, h = 500
    const [, dx, dy, dw, dh] = drawImage.mock.calls[0];
    expect(dw).toBeCloseTo(100);
    expect(dh).toBeCloseTo(500);
    expect(dx).toBeCloseTo(0);
    expect(dy).toBeCloseTo((100 - 500) / 2);
  });

  it("uses the default size of 256 when none is given", async () => {
    const promise = fileToAvatarDataUrl(makeFile("image/png"));
    await vi.runAllTimersAsync();
    await promise;
    const [, , , dw, dh] = drawImage.mock.calls[0];
    // square-cover of 800x400 into 256 => w=512, h=256
    expect(Math.max(dw, dh)).toBeCloseTo(512);
  });

  it("throws when the canvas 2D context is unavailable", async () => {
    getContextReturnsNull = true;
    const promise = fileToAvatarDataUrl(makeFile("image/png"));
    const expectation = expect(promise).rejects.toThrow("Could not process the image.");
    await vi.runAllTimersAsync();
    await expectation;
  });

  it("rejects when the file cannot be read", async () => {
    readerBehavior.fail = true;
    const promise = fileToAvatarDataUrl(makeFile("image/png"));
    const expectation = expect(promise).rejects.toThrow("Could not read the file.");
    await vi.runAllTimersAsync();
    await expectation;
  });

  it("rejects when the data is not a valid image", async () => {
    imageBehavior.fail = true;
    const promise = fileToAvatarDataUrl(makeFile("image/png"));
    const expectation = expect(promise).rejects.toThrow("That file isn't a valid image.");
    await vi.runAllTimersAsync();
    await expectation;
  });
});
