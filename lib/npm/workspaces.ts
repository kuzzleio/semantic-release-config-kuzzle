import path from 'node:path';
import { Options, globby } from 'globby';
import { NormalizedPackageJson } from 'read-pkg';

export interface WorkspacesContext {
  /**
   * Note that glob patterns can only contain forward-slashes, not backward-slashes, so if you want to construct a glob pattern from path components, you need to use `path.posix.join()` instead of `path.join()`.
   *
   * @see [supported glob patterns](https://github.com/sindresorhus/globby#globbing-patterns)
   */
  patterns?: string[];
  /**
   * @default process.cwd
   */
  cwd?: string;
  /**
   * An array of glob patterns to exclude matches. This is an alternative way to use negative patterns.
   *
   * @see [fast-glob ignore](https://github.com/mrmlnc/fast-glob?tab=readme-ov-file#ignore)
   */
  ignore?: Options['ignore'];
}

async function getPkgWorkspaces(
  workspaces: NormalizedPackageJson['workspaces'],
): Promise<string[] | undefined> {
  if (workspaces === undefined) {
    return;
  }

  const paths = Array.isArray(workspaces) ? workspaces : workspaces.packages;

  if (!Array.isArray(paths)) {
    return;
  }

  // ? Glob only directories for npm paths (respect npm logic)
  return await globby(paths, {
    absolute: true,
    onlyDirectories: true,
  });
}

export async function getWorkspaces(
  pkg: NormalizedPackageJson,
  ctx: WorkspacesContext = {},
): Promise<string[]> {
  const cwd = ctx.cwd ?? process.cwd();
  if (ctx.patterns === undefined || pkg.workspaces !== undefined) {
    const npmWorkspaces = await getPkgWorkspaces(pkg.workspaces);
    return Array.isArray(npmWorkspaces) ? npmWorkspaces : [cwd];
  }

  // ? Glob custom paths
  const globResult = await globby(ctx.patterns, {
    absolute: true,
    cwd,
    ignore: ctx.ignore ?? ['node_modules'],
  });

  const paths: string[] = [];
  for (const entry of globResult) {
    if (!entry.endsWith('package.json')) {
      continue;
    }
    paths.push(path.dirname(entry));
  }

  return paths;
}
