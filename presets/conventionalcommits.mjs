/**
 * The `conventionalcommits` preset, pre-configured and resolved from *this*
 * package instead of from the consumer project.
 *
 * `@semantic-release/commit-analyzer` and `@semantic-release/release-notes-generator`
 * both load a preset named through their `preset` option from only two places:
 * their own directory, and the consumer's `cwd`. Neither plugin depends on
 * `conventional-changelog-conventionalcommits`, so `preset: "conventionalcommits"`
 * only ever worked because npm happened to hoist our dependency to the
 * consumer's root `node_modules/`. When it nested it under this package
 * instead, both lookups failed with `Cannot find module`.
 *
 * Their `config` option goes through the same loader, but a `config` value that
 * looks like a path is imported as a file rather than resolved through
 * `node_modules`. Pointing it at this file therefore pins the preset to this
 * package: the bare specifier below resolves from `presets/`, walking up into
 * our own dependencies, hoisted or not.
 *
 * Note that the `config` branch calls the preset with no arguments, so
 * `presetConfig` is silently ignored and the commit types have to be baked in
 * here.
 */
import preset, {
  DEFAULT_COMMIT_TYPES,
} from "conventional-changelog-conventionalcommits";

/**
 * The preset hides `chore` from the release notes, while this config promotes
 * `chore(deps)` to a minor release. A dependency bump would otherwise ship a
 * minor whose notes say nothing about it, and a release made only of dependency
 * work would get an empty changelog entry.
 *
 * `findTypeEntry` returns the first match and only compares `scope` when the
 * entry declares one, so the scoped entry has to come before the preset's bare
 * `chore` one.
 */
const types = [
  { scope: "deps", section: "Dependencies", type: "chore" },
  ...DEFAULT_COMMIT_TYPES,
];

export default () => preset({ types });
