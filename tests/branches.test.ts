import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { resetEnv, restoreEnv } from "./env";

describe("branches", () => {
  beforeEach(() => {
    vi.resetModules();
    resetEnv();
  });

  afterAll(() => {
    restoreEnv();
  });

  it("uses main and develop as default branches", async () => {
    const { branches, developBranchName, releaseBranchName } =
      await import("../lib/branches");

    expect(releaseBranchName).toBe("main");
    expect(developBranchName).toBe("develop");
    expect(branches).toEqual([
      { name: "main" },
      { name: "develop", prerelease: true },
    ]);
  });

  it("uses branch names from environment variables", async () => {
    process.env.SEMANTIC_RELEASE_RELEASE_BRANCH = "production";
    process.env.SEMANTIC_RELEASE_DEVELOP_BRANCH = "next";

    const { branches, developBranchName, releaseBranchName } =
      await import("../lib/branches");

    expect(releaseBranchName).toBe("production");
    expect(developBranchName).toBe("next");
    expect(branches).toEqual([
      { name: "production" },
      { name: "next", prerelease: true },
    ]);
  });
});
