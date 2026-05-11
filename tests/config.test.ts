import { describe, expect, it } from "vitest";
import { readConfig } from "../src/config.js";

const baseEnv = {
  INPUT_WEBHOOK_URL: "https://example.test/webhook",
};

describe("config", () => {
  it("defaults dryRun to false when INPUT_DRY_RUN is absent", () => {
    const config = readConfig({ ...baseEnv });

    expect(config.dryRun).toBe(false);
  });

  it("parses INPUT_DRY_RUN=true as dryRun:true", () => {
    const config = readConfig({ ...baseEnv, INPUT_DRY_RUN: "true" });

    expect(config.dryRun).toBe(true);
  });

  it("parses INPUT_DRY_RUN=false as dryRun:false", () => {
    const config = readConfig({ ...baseEnv, INPUT_DRY_RUN: "false" });

    expect(config.dryRun).toBe(false);
  });

  it("throws on an invalid boolean value for INPUT_DRY_RUN", () => {
    expect(() => readConfig({ ...baseEnv, INPUT_DRY_RUN: "maybe" })).toThrow(
      /Invalid boolean input for dry_run/,
    );
  });
});
