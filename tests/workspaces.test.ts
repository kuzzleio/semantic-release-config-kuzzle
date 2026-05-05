import { afterEach, describe, expect, it, vi } from "vitest";

async function loadWorkspaces(
  rootPackageJson: Record<string, unknown>,
  fastGlobResult = ["packages/api/package.json"],
) {
  vi.resetModules();

  const readFileSync = vi.fn().mockReturnValue(JSON.stringify(rootPackageJson));
  const sync = vi.fn().mockReturnValue(fastGlobResult);

  vi.doMock("node:fs", () => ({
    default: { readFileSync },
  }));

  vi.doMock("fast-glob", () => ({
    default: { sync },
  }));

  const module = await import("../lib/workspaces");

  return {
    getWorkspacePackageJsonFiles: module.getWorkspacePackageJsonFiles,
    readFileSync,
    sync,
  };
}

describe("workspaces", () => {
  afterEach(() => {
    vi.doUnmock("fast-glob");
    vi.doUnmock("node:fs");
    vi.resetModules();
  });

  it("finds package.json files from array workspaces", async () => {
    const { getWorkspacePackageJsonFiles, readFileSync, sync } =
      await loadWorkspaces({
        workspaces: ["packages/*", "apps/"],
      });

    expect(getWorkspacePackageJsonFiles()).toEqual([
      "packages/api/package.json",
    ]);
    expect(readFileSync).toHaveBeenCalledWith("package.json", "utf8");
    expect(sync).toHaveBeenCalledWith(
      ["packages/*/package.json", "apps/package.json"],
      {
        dot: false,
        followSymbolicLinks: true,
        onlyFiles: true,
        unique: true,
      },
    );
  });

  it("finds package.json files from npm object workspaces", async () => {
    const { getWorkspacePackageJsonFiles, sync } = await loadWorkspaces({
      workspaces: {
        packages: ["modules/*"],
      },
    });

    expect(getWorkspacePackageJsonFiles()).toEqual([
      "packages/api/package.json",
    ]);
    expect(sync).toHaveBeenCalledWith(["modules/*/package.json"], {
      dot: false,
      followSymbolicLinks: true,
      onlyFiles: true,
      unique: true,
    });
  });

  it("calls fast-glob with no patterns when no workspace is configured", async () => {
    const { getWorkspacePackageJsonFiles, sync } = await loadWorkspaces({}, []);

    expect(getWorkspacePackageJsonFiles()).toEqual([]);
    expect(sync).toHaveBeenCalledWith([], {
      dot: false,
      followSymbolicLinks: true,
      onlyFiles: true,
      unique: true,
    });
  });
});
