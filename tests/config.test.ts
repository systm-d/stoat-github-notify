import { describe, expect, it } from "vitest";
import { readConfig } from "../src/config.js";

const baseEnv = {
  INPUT_WEBHOOK_URL: "https://example.test/webhook",
};

describe("readConfig", () => {
  it("returns dryRun:true when INPUT_DRY_RUN=true", () => {
    const config = readConfig({ ...baseEnv, INPUT_DRY_RUN: "true" });

    expect(config.dryRun).toBe(true);
  });

  it("defaults dryRun to false when INPUT_DRY_RUN is absent", () => {
    const config = readConfig({ ...baseEnv });

    expect(config.dryRun).toBe(false);
  });

  it("throws on invalid INPUT_DRY_RUN", () => {
    expect(() => readConfig({ ...baseEnv, INPUT_DRY_RUN: "maybe" })).toThrow(
      "Invalid boolean input for dry_run: maybe",
    );
  });
});
