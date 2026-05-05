import { releaseBranchName } from "./branches";

export const inferReleaseChannel = () => {
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

export const getReleaseChannel = () =>
  process.env.RELEASE_CHANNEL || inferReleaseChannel() || releaseBranchName;

export const releaseChannel = getReleaseChannel();
