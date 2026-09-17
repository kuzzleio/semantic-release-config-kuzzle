import path from "node:path";

import { PluginSpec } from "semantic-release";

import { releaseBranchName } from "./branches";
import { releaseChannel } from "./release-channel";
import { getWorkspacePackageJsonFiles } from "./workspaces";

const workspacePkgFiles = getWorkspacePackageJsonFiles();

/**
 * Absolute path to the pre-configured `conventionalcommits` preset shipped with
 * this package. Passing it through the plugins' `config` option, rather than
 * naming the preset through `preset`, keeps the preset resolvable from this
 * package instead of from the consumer's `node_modules/` layout. See
 * `presets/conventionalcommits.mjs` for the full reasoning.
 *
 * `lib/` and `dist/` both sit one level below the package root, so the same
 * relative path works from the sources and from the build.
 */
const conventionalCommitsPreset = path.join(
  __dirname,
  "..",
  "presets",
  "conventionalcommits.mjs",
);

/**
 * Default plugins configuration.
 * Main thing here is to use a different changelog file depending on the release channel.
 */
const plugins: PluginSpec[] = [
  [
    "@semantic-release/commit-analyzer",
    {
      config: conventionalCommitsPreset,
      releaseRules: [{ type: "chore", scope: "deps", release: "minor" }],
    },
  ],
  [
    "@semantic-release/release-notes-generator",
    {
      config: conventionalCommitsPreset,
    },
  ],
  [
    "@semantic-release/changelog",
    {
      changelogFile: `changelogs/CHANGELOG_${releaseChannel}.md`,
    },
  ],
];

if (process.env.GITHUB_TOKEN) {
  plugins.push("@semantic-release/github");
}

const shouldPublishToNpm = process.env.SEMANTIC_RELEASE_NPM_PUBLISH === "true";

if (shouldPublishToNpm && workspacePkgFiles.length === 0) {
  plugins.push("@semantic-release/npm");
} else {
  plugins.push([
    "@semantic-release/npm",
    {
      npmPublish: false,
    },
  ]);
}

/**
 * Add the exec plugin to update the version of workspaces
 * only if there are actual workspaces to update.
 */
if (workspacePkgFiles.length > 0) {
  const shouldBuildPkg = process.env.SEMANTIC_RELEASE_NPM_BUILD === "true";

  /**
   * Sometimes we want to build the package after the version bump
   * So the only way we can do that is by executing the build command
   * After the npm version happened
   */
  let prepareCmdString =
    "npm version ${nextRelease.version} --workspaces --no-git-tag-version";

  if (shouldBuildPkg) {
    prepareCmdString += " && npm run build";
  }

  /**
   * The stable channel has to land on npm's default tag. Publishing it under
   * the branch name instead would leave `npm install <pkg>` on the previous
   * release, which is what the plain @semantic-release/npm path already gets
   * right for non-workspace repositories.
   */
  const npmTag =
    releaseChannel === releaseBranchName ? "latest" : releaseChannel;
  plugins.push([
    "@semantic-release/exec",
    {
      prepareCmd: prepareCmdString,
      publishCmd: shouldPublishToNpm
        ? `npm publish --workspaces --if-present --tag ${npmTag}`
        : undefined,
    },
  ]);
}

if (process.env.SEMANTIC_RELEASE_SLACK_WEBHOOK) {
  plugins.push([
    "semantic-release-slack-bot",
    {
      notifyOnFail: false,
      notifyOnSuccess: true,
      slackWebhook: process.env.SEMANTIC_RELEASE_SLACK_WEBHOOK,
    },
  ]);
}

/**
 * Git plugin must be in last position because it looks for files changed by
 * previous plugins and commits them.
 */
plugins.push([
  "@semantic-release/git",
  {
    assets: [
      `changelogs/CHANGELOG_${releaseChannel}.md`,
      "package.json",
      "package-lock.json",
      "pnpm-lock.yaml",
      "yarn.lock",
      ...workspacePkgFiles,
    ],
  },
]);

export { plugins };
