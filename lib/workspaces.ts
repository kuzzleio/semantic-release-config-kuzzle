import fg from "fast-glob";
import fs from "node:fs";

/**
 * Returns package.json files declared by the root package workspaces.
 */
export function getWorkspacePackageJsonFiles(): string[] {
  const rootPkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
  let workspaces: string[] = [];

  if (Array.isArray(rootPkg.workspaces)) {
    workspaces = rootPkg.workspaces;
  } else if (rootPkg.workspaces && Array.isArray(rootPkg.workspaces.packages)) {
    workspaces = rootPkg.workspaces.packages;
  }

  const patterns = workspaces.map((ws) =>
    ws.endsWith("/") ? `${ws}package.json` : `${ws}/package.json`,
  );

  return fg.sync(patterns, {
    onlyFiles: true,
    unique: true,
    dot: false,
    followSymbolicLinks: true,
  });
}
