declare namespace NodeJS {
  export interface ProcessEnv {
    SEMANTIC_RELEASE_DEVELOP_BRANCH?: string;
    SEMANTIC_RELEASE_NPM_PUBLISH?: string;
    SEMANTIC_RELEASE_RELEASE_BRANCH?: string;
    SEMANTIC_RELEASE_SLACK_WEBHOOK?: string;
  }
}
