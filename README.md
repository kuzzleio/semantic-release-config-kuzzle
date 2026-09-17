# semantic-release-config-kuzzle

Shareable `semantic-release` configuration used by Kuzzle projects.

It provides:
- sensible default branches
- changelogs per release channel
- a `minor` release for `chore(deps):` commits
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

## Commit convention

Commits are parsed with the [`conventionalcommits`](https://github.com/conventional-changelog/conventional-changelog/tree/master/packages/conventional-changelog-conventionalcommits)
preset, extended so that `chore(deps):` commits land in a `Dependencies`
section of the release notes instead of being hidden with the other chores.

The preset is shipped with this package (`presets/conventionalcommits.mjs`) and
pinned by path, so you do not have to install it in your own project. Earlier
versions named it through the plugins' `preset` option instead, which only
resolved when your package manager happened to hoist it to your root
`node_modules/` and otherwise failed with `Cannot find module
'conventional-changelog-conventionalcommits'`.

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
