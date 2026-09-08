import { PluginSpec } from "semantic-release";

import { releaseBranchName } from "./branches";
import { releaseChannel } from "./release-channel";
import { getWorkspacePackageJsonFiles } from "./workspaces";

const workspacePkgFiles = getWorkspacePackageJsonFiles();

/**
 * Default plugins configuration.
 * Main thing here is to use a different changelog file depending on the release channel.
 */
/**
 * The conventionalcommits preset hides `chore` from the release notes, while
 * this config promotes `chore(deps)` to a minor release. A dependency bump
 * therefore ships a minor whose notes say nothing about it, and a release made
 * only of dependency work gets an empty changelog entry.
 *
 * Two constraints shape the list below. `findTypeEntry` returns the first
 * match and only compares `scope` when the entry declares one, so the scoped
 * entry has to come before the bare `chore` one. And passing `types` replaces
 * the preset's list instead of extending it, which is why the defaults are
 * restated: the preset is ESM-only, so its DEFAULT_COMMIT_TYPES cannot be
 * imported from this CommonJS build.
 */
const commitTypes = [
  { scope: "deps", section: "Dependencies", type: "chore" },
  { section: "Features", type: "feat" },
  { section: "Features", type: "feature" },
  { section: "Bug Fixes", type: "fix" },
  { section: "Performance Improvements", type: "perf" },
  { section: "Reverts", type: "revert" },
  { hidden: true, section: "Documentation", type: "docs" },
  { hidden: true, section: "Styles", type: "style" },
  { hidden: true, section: "Miscellaneous Chores", type: "chore" },
  { hidden: true, section: "Code Refactoring", type: "refactor" },
  { hidden: true, section: "Tests", type: "test" },
  { hidden: true, section: "Build System", type: "build" },
  { hidden: true, section: "Continuous Integration", type: "ci" },
];

const plugins: PluginSpec[] = [
  [
    "@semantic-release/commit-analyzer",
    {
      preset: "conventionalcommits",
      releaseRules: [{ type: "chore", scope: "deps", release: "minor" }],
    },
  ],
  [
    "@semantic-release/release-notes-generator",
    {
      preset: "conventionalcommits",
      // Only the notes generator is configured: the commit analyzer keeps its
      // own preset and releaseRules, so how the version is computed is
      // untouched.
      presetConfig: { types: commitTypes },
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
