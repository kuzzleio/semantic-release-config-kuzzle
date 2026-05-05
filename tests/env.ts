const originalEnv = { ...process.env };

const managedEnvKeys = [
  "BITBUCKET_BRANCH",
  "BRANCH_NAME",
  "CIRCLE_BRANCH",
  "CI_COMMIT_BRANCH",
  "CI_COMMIT_REF_NAME",
  "GITHUB_HEAD_REF",
  "GITHUB_REF",
  "GITHUB_REF_NAME",
  "GITHUB_TOKEN",
  "RELEASE_CHANNEL",
  "SEMANTIC_RELEASE_DEVELOP_BRANCH",
  "SEMANTIC_RELEASE_NPM_BUILD",
  "SEMANTIC_RELEASE_NPM_PUBLISH",
  "SEMANTIC_RELEASE_RELEASE_BRANCH",
  "SEMANTIC_RELEASE_SLACK_WEBHOOK",
  "TRAVIS_BRANCH",
] as const;

export function resetEnv() {
  process.env = { ...originalEnv };

  for (const key of managedEnvKeys) {
    delete process.env[key];
  }
}

export function restoreEnv() {
  process.env = { ...originalEnv };
}
