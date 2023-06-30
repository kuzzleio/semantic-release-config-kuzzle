import { existsSync } from "fs";
import { BranchSpec, PluginSpec } from "semantic-release";

const branches: BranchSpec[] = [
  {
    name: process.env.SEMANTIC_RELEASE_RELEASE_BRANCH ?? "main",
  },
  {
    name: process.env.SEMANTIC_RELEASE_DEVELOP_BRANCH ?? "develop",
    prerelease: true,
  },
];

const publishPlugins: PluginSpec[] = [];

if (existsSync("package.json")) {
  if (process.env.SEMANTIC_RELEASE_NPM_PUBLISH === "true") {
    publishPlugins.push("@semantic-release/npm");
  } else {
    publishPlugins.push([
      "@semantic-release/npm",
      {
        npmPublish: false,
      },
    ]);
  }
} else {
  // eslint-disable-next-line no-console
  console.warn(
    "Could not infer package type, assuming publication is handled externally."
  );
}

const plugins: PluginSpec[] = [
  "@semantic-release/commit-analyzer",
  "@semantic-release/release-notes-generator",
  "@semantic-release/changelog",
  ...publishPlugins,
  "@semantic-release/github",
  "@semantic-release/git",
];

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
