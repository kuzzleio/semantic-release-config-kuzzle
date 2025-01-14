import kuzzlePlugin from "eslint-plugin-kuzzle";

export default [
  {
    ignores: ["dist/"],
  },
  ...kuzzlePlugin.configs.default,
  ...kuzzlePlugin.configs.node,
  ...kuzzlePlugin.configs.typescript,
  {
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: ["eslint.config.mjs"],
        },
      },
    },
  },
];
