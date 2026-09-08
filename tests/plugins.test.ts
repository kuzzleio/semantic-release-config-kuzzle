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
          preset: "conventionalcommits",
          releaseRules: [{ type: "chore", scope: "deps", release: "minor" }],
        },
      ],
      [
        "@semantic-release/release-notes-generator",
        { preset: "conventionalcommits" },
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
});
