# semantic-release-config-kuzzle

Shareable `semantic-release` configuration used by Kuzzle projects.

It provides:
- sensible default branches
- changelogs per release channel
- optional GitHub/NPM/Slack integrations
- workspace version bumping when using npm workspaces

## To use it in your project

Install:

```
npm install --save-dev semantic-release semantic-release-config-kuzzle
```

Create or update your release config:

```json
{
  "extends": [
    "semantic-release-config-kuzzle"
  ],
}
```

If you need custom branches, add them alongside `extends`. By default, this config uses:
- `main` as the release branch
- `develop` as the prerelease branch

Override those defaults with environment variables:
- `SEMANTIC_RELEASE_RELEASE_BRANCH` (default: `main`)
- `SEMANTIC_RELEASE_DEVELOP_BRANCH` (default: `develop`)

## Changelog behavior

Changelogs are written to `changelogs/CHANGELOG_<channel>.md`.
The channel is resolved as:
- `RELEASE_CHANNEL`, if set
- otherwise the current CI branch name
- otherwise the release branch name

## Optional integrations

Enable/disable features via environment variables:
- `GITHUB_TOKEN`: publish GitHub releases via `@semantic-release/github`
- `SEMANTIC_RELEASE_NPM_PUBLISH=true`: publish to npm; otherwise npm is configured with `npmPublish: false`
- `SEMANTIC_RELEASE_SLACK_WEBHOOK`: send release notifications to Slack

## Monorepo workspaces

If your root `package.json` defines `workspaces`, all workspace `package.json` files are detected and:
- versions are updated via `@semantic-release/exec`
- the updated files are committed via `@semantic-release/git`
