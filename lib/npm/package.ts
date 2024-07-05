import debuglog from 'debug';
import { readPackage, type NormalizedPackageJson } from 'read-pkg';
import { execa } from 'execa';
import semver from 'semver';
import { getError } from './error';
import { getRegistry } from './registry';
import type { AddChannelContext, PrepareContext, PublishContext } from 'semantic-release';

import type { PluginConfig, NpmReleaseInfo } from '../types';

const debug = debuglog('semantic-release:kuzzle:package');

/**
 * Get package.json content.
 *
 * @param pkgPath package.json path.
 *
 * @throws {SemanticReleaseError|Error}
 */
export async function getPkg(pkgPath: string): Promise<NormalizedPackageJson> {
  try {
    debug(`Read package from: ${pkgPath}`);
    const pkg = await readPackage({ cwd: pkgPath });

    if (!pkg.name) {
      throw getError('ENOPKGNAME', { pkgPath });
    }

    return pkg;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw getError('ENOPKG', { pkgPath });
    }

    throw error;
  }
}

/**
 * Get validated and normalized channel.
 *
 * @param channel channel name.
 */
export function getChannel(channel: string): string {
  // eslint-disable-next-line no-nested-ternary
  return channel ? (semver.validRange(channel) ? `release-${channel}` : channel) : 'latest';
}

/**
 * Format release info.
 *
 * @param pkg package.json content.
 * @param context semantic-release context.
 * @param distTag distribution tag.
 *
 */
export function getReleaseInfo(
  { name }: NormalizedPackageJson,
  { nextRelease }: AddChannelContext,
  distTag: string,
): NpmReleaseInfo {
  return {
    channel: distTag,
    name: `npm package ${name} ${nextRelease.name} (@${distTag} dist-tag)`,
  };
}

/**
 * Add distribution tag to release the package.
 *
 * @param npmrc npmrc path.
 * @param pluginConfig The plugin configuration.
 * @param pkg package.json content.
 * @param context semantic-release context.
 *
 * @returns {}
 */
export async function npmDistTag(
  npmrc: string,
  pluginConfig: PluginConfig,
  pkg: NormalizedPackageJson,
  context: AddChannelContext,
): Promise<NpmReleaseInfo | false> {
  const {
    cwd,
    env,
    nextRelease: { version, channel },
    logger,
  } = context;

  if (pluginConfig.npmPublish === false || pkg.private === true) {
    logger.log(
      `Skip adding to npm channel as ${
        pluginConfig.npmPublish === false ? 'npmPublish' : "package.json's private property"
      } is ${pluginConfig.npmPublish !== false}`,
    );
    return false;
  }
  const registry = getRegistry(pkg, context);
  const distTag = getChannel(channel);

  logger.log(`Adding version ${version} to npm registry on dist-tag ${distTag}`);

  const distTagResult = await execa(
    'npm',
    [
      'dist-tag',
      'add',
      `${pkg.name}@${version}`,
      distTag,
      '--userconfig',
      npmrc,
      '--registry',
      registry,
    ],
    {
      cwd,
      env,
      preferLocal: true,
    },
  );
  debug(`Add ${pkg.name}@${version} to dist-tag @${distTag}`, distTagResult);

  logger.log(`Added ${pkg.name}@${version} to dist-tag @${distTag} on ${registry}`);

  return getReleaseInfo(pkg, context, distTag);
}

/**
 * Update NPM package version.
 *
 * @param npmrc npmrc path.
 * @param pkg package.json content.
 * @param context semantic-release context.
 *
 * @returns {Promise<void>}
 */
export async function npmVersion(
  npmrc: string,
  { name }: NormalizedPackageJson,
  { cwd, env, nextRelease: { version }, logger }: PrepareContext,
): Promise<void> {
  logger.log(`Update "${name}" to ${version}`);

  const versionResult = await execa(
    'npm',
    ['version', version, '--userconfig', npmrc, '--no-git-tag-version', '--allow-same-version'],
    {
      cwd,
      env,
      preferLocal: true,
    },
  );
  debug(`Write version ${version} in ${cwd}`, versionResult);
}

/**
 * Publish NPM package to registry.
 *
 * @param npmrc npmrc path.
 * @param pluginConfig The plugin configuration.
 * @param pkg package.json content.
 * @param context semantic-release context.
 *
 * @returns {Promise<NpmReleaseInfo | false>}
 */
export async function npmPublish(
  npmrc: string,
  config: PluginConfig,
  pkg: NormalizedPackageJson,
  context: PublishContext,
): Promise<NpmReleaseInfo | false> {
  const {
    cwd,
    env,
    nextRelease: { version, channel },
    logger,
  } = context;

  if (config.npmPublish === false || pkg.private === true) {
    logger.log(
      `Skip publishing to npm registry as ${
        config.npmPublish === false ? 'npmPublish' : "package.json's private property"
      } is ${config.npmPublish !== false}`,
    );
    return false;
  }

  const registry = getRegistry(pkg, context);
  const distTag = getChannel(channel);

  logger.log(`Publishing version ${version} to npm registry on dist-tag ${distTag}`);

  const publishResult = await execa(
    'npm',
    ['publish', '--dry-run', '--userconfig', npmrc, '--tag', distTag, '--registry', registry],
    { cwd, env, preferLocal: true },
  );
  debug(`Publish ${pkg.name}@${version}`, publishResult);

  logger.log(`Published ${pkg.name}@${version} to dist-tag @${distTag} on ${registry}`);

  return getReleaseInfo(pkg, context, distTag);
}
