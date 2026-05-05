import { BranchSpec } from "semantic-release";

export const releaseBranchName =
  process.env.SEMANTIC_RELEASE_RELEASE_BRANCH ?? "main";

export const developBranchName =
  process.env.SEMANTIC_RELEASE_DEVELOP_BRANCH ?? "develop";

export const branches: BranchSpec[] = [
  {
    name: releaseBranchName,
  },
  {
    name: developBranchName,
    prerelease: true,
  },
];
