import { existsSync } from 'node:fs';
import { BranchSpec, PluginSpec } from 'semantic-release';

export const branches: BranchSpec[] = [
  {
    name: process.env.SEMANTIC_RELEASE_RELEASE_BRANCH ?? 'main',
  },
  {
    name: process.env.SEMANTIC_RELEASE_DEVELOP_BRANCH ?? 'develop',
    prerelease: true,
  },
];

const publishPlugins: PluginSpec[] = [];

if (existsSync('package.json')) {
  const npmPublish = process.env.SEMANTIC_RELEASE_NPM_PUBLISH === 'true';
  publishPlugins.push(['semantic-release-config-kuzzle/plugin', { npmPublish }]);
} else {
  // eslint-disable-next-line no-console
  console.warn('Could not infer package type, assuming publication is handled externally.');
}

if (process.env.GITHUB_TOKEN) {
  publishPlugins.push('@semantic-release/github');
}

const hookPlugins: PluginSpec[] = [];

if (process.env.SEMANTIC_RELEASE_SLACK_WEBHOOK) {
  hookPlugins.push([
    'semantic-release-slack-bot',
    {
      notifyOnFail: false,
      notifyOnSuccess: true,
      slackWebhook: process.env.SEMANTIC_RELEASE_SLACK_WEBHOOK,
    },
  ]);
}

export const plugins: PluginSpec[] = [
  '@semantic-release/commit-analyzer',
  '@semantic-release/release-notes-generator',
  '@semantic-release/changelog',
  ...publishPlugins,
  '@semantic-release/git',
  ...hookPlugins,
];
