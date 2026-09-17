import { PluginSpec } from "semantic-release";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { resetEnv, restoreEnv } from "./env";

type PluginTuple = [string, Record<string, unknown>];

async function loadPlugins({
  releaseChannel = "main",
  workspacePkgFiles = [],
  env = {},
}: {
  releaseChannel?: string;
  workspacePkgFiles?: string[];
  env?: NodeJS.ProcessEnv;
} = {}) {
  vi.resetModules();
  resetEnv();
  Object.assign(process.env, env);

  vi.doMock("../lib/release-channel", () => ({
    releaseChannel,
  }));

  vi.doMock("../lib/workspaces", () => ({
    getWorkspacePackageJsonFiles: () => workspacePkgFiles,
  }));

  const module = await import("../lib/plugins");

  return module.plugins;
}

function getPluginConfig(plugins: PluginSpec[], pluginName: string) {
  const plugin = plugins.find(
    (pluginConfig) =>
      Array.isArray(pluginConfig) && pluginConfig[0] === pluginName,
  );

  expect(plugin).toBeDefined();

  return plugin as PluginTuple;
}

describe("plugins", () => {
  beforeEach(() => {
    vi.resetModules();
    resetEnv();
  });

  afterAll(() => {
    restoreEnv();
  });

  it("configures the default semantic-release plugins", async () => {
    const plugins = await loadPlugins();

    expect(plugins).toEqual([
      [
        "@semantic-release/commit-analyzer",
        {
          config: expect.stringContaining("presets/conventionalcommits.mjs"),
          releaseRules: [{ type: "chore", scope: "deps", release: "minor" }],
        },
      ],
      [
        "@semantic-release/release-notes-generator",
        {
          config: expect.stringContaining("presets/conventionalcommits.mjs"),
        },
      ],
      [
        "@semantic-release/changelog",
        {
          changelogFile: "changelogs/CHANGELOG_main.md",
        },
      ],
      [
        "@semantic-release/npm",
        {
          npmPublish: false,
        },
      ],
      [
        "@semantic-release/git",
        {
          assets: [
            "changelogs/CHANGELOG_main.md",
            "package.json",
            "package-lock.json",
            "pnpm-lock.yaml",
            "yarn.lock",
          ],
        },
      ],
    ]);
  });

  it("enables optional GitHub and Slack plugins from environment variables", async () => {
    const plugins = await loadPlugins({
      env: {
        GITHUB_TOKEN: "secret",
        SEMANTIC_RELEASE_SLACK_WEBHOOK: "https://hooks.slack.test",
      },
    });

    expect(plugins).toContain("@semantic-release/github");
    expect(plugins).toContainEqual([
      "semantic-release-slack-bot",
      {
        notifyOnFail: false,
        notifyOnSuccess: true,
        slackWebhook: "https://hooks.slack.test",
      },
    ]);
    expect(plugins.at(-1)).toEqual(
      expect.arrayContaining(["@semantic-release/git"]),
    );
  });

  it("publishes through the npm plugin when npm publishing is enabled without workspaces", async () => {
    const plugins = await loadPlugins({
      env: {
        SEMANTIC_RELEASE_NPM_PUBLISH: "true",
      },
    });

    expect(plugins).toContain("@semantic-release/npm");
  });

  it("adds workspace versioning and publishing through the exec plugin", async () => {
    const plugins = await loadPlugins({
      releaseChannel: "develop",
      workspacePkgFiles: ["packages/api/package.json"],
      env: {
        SEMANTIC_RELEASE_NPM_BUILD: "true",
        SEMANTIC_RELEASE_NPM_PUBLISH: "true",
      },
    });

    expect(plugins).toContainEqual([
      "@semantic-release/npm",
      {
        npmPublish: false,
      },
    ]);
    expect(getPluginConfig(plugins, "@semantic-release/exec")).toEqual([
      "@semantic-release/exec",
      {
        prepareCmd:
          "npm version ${nextRelease.version} --workspaces --no-git-tag-version && npm run build",
        publishCmd: "npm publish --workspaces --if-present --tag develop",
      },
    ]);
    expect(plugins.at(-1)).toEqual([
      "@semantic-release/git",
      {
        assets: [
          "changelogs/CHANGELOG_develop.md",
          "package.json",
          "package-lock.json",
          "pnpm-lock.yaml",
          "yarn.lock",
          "packages/api/package.json",
        ],
      },
    ]);
  });

  it("publishes the stable channel under the latest npm tag", async () => {
    const plugins = await loadPlugins({
      releaseChannel: "main",
      workspacePkgFiles: ["packages/api/package.json"],
      env: {
        SEMANTIC_RELEASE_NPM_PUBLISH: "true",
      },
    });

    expect(getPluginConfig(plugins, "@semantic-release/exec")[1]).toMatchObject(
      {
        publishCmd: "npm publish --workspaces --if-present --tag latest",
      },
    );
  });

  it("follows a renamed release branch when tagging the stable channel", async () => {
    const plugins = await loadPlugins({
      releaseChannel: "master",
      workspacePkgFiles: ["packages/api/package.json"],
      env: {
        SEMANTIC_RELEASE_NPM_PUBLISH: "true",
        SEMANTIC_RELEASE_RELEASE_BRANCH: "master",
      },
    });

    expect(getPluginConfig(plugins, "@semantic-release/exec")[1]).toMatchObject(
      {
        publishCmd: "npm publish --workspaces --if-present --tag latest",
      },
    );
  });

  /**
   * The bug this guards against: both plugins look for a preset named through
   * `preset` in their own directory and in the consumer's cwd only, and neither
   * of them depends on conventional-changelog-conventionalcommits. Naming the
   * preset therefore only worked while npm happened to hoist our dependency to
   * the consumer's root node_modules/; when it nested it under this package
   * instead, releases failed with `Cannot find module`.
   *
   * Pinning `config` to the shipped wrapper has to keep working whatever the
   * consumer's tree looks like, so both plugins are driven here through their
   * public API with a cwd that resolves nothing at all.
   */
  describe("conventionalcommits preset, from a cwd that resolves nothing", () => {
    const cwd = "/semantic-release-config-kuzzle-nonexistent-cwd";

    const commit = (message: string, hash: string) => ({
      hash,
      message,
      subject: message.split("\n")[0],
      committerDate: "2026-01-01",
    });

    async function generate(commits: ReturnType<typeof commit>[]) {
      const plugins = await loadPlugins();
      const [, options] = getPluginConfig(
        plugins,
        "@semantic-release/release-notes-generator",
      );
      const { generateNotes } =
        await import("@semantic-release/release-notes-generator");

      return generateNotes(options, {
        commits,
        cwd,
        lastRelease: { gitTag: "v1.0.0" },
        nextRelease: { gitTag: "v1.1.0", version: "1.1.0" },
        options: {
          repositoryUrl:
            "https://github.com/kuzzleio/semantic-release-config-kuzzle.git",
        },
      });
    }

    async function analyze(commits: ReturnType<typeof commit>[]) {
      const plugins = await loadPlugins();
      const [, options] = getPluginConfig(
        plugins,
        "@semantic-release/commit-analyzer",
      );
      const { analyzeCommits } =
        await import("@semantic-release/commit-analyzer");

      return analyzeCommits(options, {
        commits,
        cwd,
        logger: { log: () => {} },
      });
    }

    it("analyzes commits with the conventionalcommits parser", async () => {
      // A `!` breaking marker is conventionalcommits, not angular: getting a
      // major here proves the preset was loaded rather than the default.
      await expect(
        analyze([commit("feat!: drop node 18", "aaa1111")]),
      ).resolves.toBe("major");
      await expect(analyze([commit("fix: a bug", "aaa2222")])).resolves.toBe(
        "patch",
      );
    });

    it("promotes dependency bumps to a minor release", async () => {
      await expect(
        analyze([commit("chore(deps): bump lodash", "bbb1111")]),
      ).resolves.toBe("minor");
    });

    it("surfaces dependency work in the release notes", async () => {
      const notes = await generate([
        commit("chore(deps): bump lodash", "ccc1111"),
      ]);

      // findTypeEntry returns the first match and only compares scope when the
      // entry declares one, so the scoped entry must come before the preset's
      // bare chore one or that one would hide it.
      expect(notes).toContain("Dependencies");
      expect(notes).toContain("bump lodash");
    });

    it("leaves the types the preset already shows untouched", async () => {
      const notes = await generate([
        commit("feat: a feature", "ddd1111"),
        commit("fix: a bug", "ddd2222"),
        commit("perf: faster", "ddd3333"),
        commit("chore: tidy up", "ddd4444"),
        commit("docs: a doc", "ddd5555"),
        commit("ci: a pipeline", "ddd6666"),
      ]);

      expect(notes).toContain("Features");
      expect(notes).toContain("Bug Fixes");
      expect(notes).toContain("Performance Improvements");

      expect(notes).not.toContain("Miscellaneous Chores");
      expect(notes).not.toContain("tidy up");
      expect(notes).not.toContain("Documentation");
      expect(notes).not.toContain("Continuous Integration");
    });
  });

  it("does not touch how the version is computed", async () => {
    const plugins = await loadPlugins();

    expect(
      getPluginConfig(plugins, "@semantic-release/commit-analyzer"),
    ).toEqual([
      "@semantic-release/commit-analyzer",
      {
        config: expect.stringContaining("presets/conventionalcommits.mjs"),
        releaseRules: [{ type: "chore", scope: "deps", release: "minor" }],
      },
    ]);
  });
});
