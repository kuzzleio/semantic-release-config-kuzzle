import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { resetEnv, restoreEnv } from "./env";

describe("release channel", () => {
  beforeEach(() => {
    vi.resetModules();
    resetEnv();
  });

  afterAll(() => {
    restoreEnv();
  });

  it("uses RELEASE_CHANNEL when it is defined", async () => {
    process.env.GITHUB_REF_NAME = "develop";
    process.env.RELEASE_CHANNEL = "custom";

    const { getReleaseChannel } = await import("../lib/release-channel");

    expect(getReleaseChannel()).toBe("custom");
  });

  it("infers the channel from the current CI branch", async () => {
    process.env.GITHUB_REF = "refs/heads/feature/dependencies";

    const { getReleaseChannel, inferReleaseChannel } =
      await import("../lib/release-channel");

    expect(inferReleaseChannel()).toBe("dependencies");
    expect(getReleaseChannel()).toBe("dependencies");
  });

  it("falls back to the configured release branch", async () => {
    process.env.SEMANTIC_RELEASE_RELEASE_BRANCH = "production";

    const { getReleaseChannel } = await import("../lib/release-channel");

    expect(getReleaseChannel()).toBe("production");
  });
});
