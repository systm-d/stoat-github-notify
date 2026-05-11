import { describe, expect, it } from "vitest";
import { readConfig } from "../src/config.js";

const baseEnv = {
  INPUT_WEBHOOK_URL: "https://example.test/webhook",
};

describe("readConfig", () => {
  it("defaults dryRun to false when INPUT_DRY_RUN is absent", () => {
    const config = readConfig({ ...baseEnv });

    expect(config.dryRun).toBe(false);
  });

  it("parses dryRun=true when INPUT_DRY_RUN is set to \"true\"", () => {
    const config = readConfig({ ...baseEnv, INPUT_DRY_RUN: "true" });

    expect(config.dryRun).toBe(true);
  });
});
