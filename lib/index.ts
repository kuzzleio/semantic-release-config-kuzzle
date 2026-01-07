import { BranchSpec, PluginSpec } from "semantic-release";

/**
 * Default semantic-release configuration for Kuzzle projects.
 */
const releaseBranchName = process.env.SEMANTIC_RELEASE_RELEASE_BRANCH ?? "main";
const developBranchName =
  process.env.SEMANTIC_RELEASE_DEVELOP_BRANCH ?? "develop";

const branches: BranchSpec[] = [
  {
    name: releaseBranchName,
  },
  {
    name: developBranchName,
    prerelease: true,
  },
];

/**
 * Default plugins configuration.
 * Main thing here is to use a different changelog file depending on the release channel.
 */
const inferReleaseChannel = () => {
  const ref =
    process.env.GITHUB_REF_NAME ||
    process.env.GITHUB_HEAD_REF ||
    process.env.CI_COMMIT_BRANCH ||
    process.env.CI_COMMIT_REF_NAME ||
    process.env.BITBUCKET_BRANCH ||
    process.env.CIRCLE_BRANCH ||
    process.env.TRAVIS_BRANCH ||
    process.env.BRANCH_NAME ||
    process.env.GITHUB_REF;

  if (!ref) {
    return;
  }

  const normalizedRef = ref.startsWith("refs/heads/")
    ? ref.slice("refs/heads/".length)
    : ref;

  return normalizedRef.split("/").pop();
};

const releaseChannel =
  process.env.RELEASE_CHANNEL || inferReleaseChannel() || releaseBranchName;

const plugins: PluginSpec[] = [
  ["@semantic-release/commit-analyzer", { preset: "conventionalcommits" }],
  [
    "@semantic-release/release-notes-generator",
    { preset: "conventionalcommits" },
  ],
  [
    "@semantic-release/changelog",
    {
      changelogFile: `changelogs/CHANGELOG_${releaseChannel}.md`,
    },
  ],
  [
    "@semantic-release/git",
    {
      assets: [`changelogs/CHANGELOG_${releaseChannel}.md`],
    },
  ],
];

if (process.env.GITHUB_TOKEN) {
  plugins.push("@semantic-release/github");
}

if (process.env.SEMANTIC_RELEASE_NPM_PUBLISH === "true") {
  plugins.push("@semantic-release/npm");
} else {
  plugins.push([
    "@semantic-release/npm",
    {
      npmPublish: false,
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

export { branches, plugins };
