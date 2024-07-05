import path from 'node:path';
import {
  AddChannelContext,
  GlobalConfig,
  PrepareContext,
  PublishContext,
  VerifyConditionsContext,
} from 'semantic-release';
import { temporaryFile } from 'tempy';
import { NormalizedPackageJson } from 'read-pkg';

import type { PluginConfig } from './types';
import SemanticReleaseError from '@semantic-release/error';

import { getChannel, getError, getPkg, getReleaseInfo, getWorkspaces, npmDistTag, npmPublish, npmVersion, verifyNpmAuth } from './npm';
import { add } from './git';

interface OptionsContext {
  options: GlobalConfig;
}

// Workflow state
let verified = false;
let prepared = false;

// Store
const npmrc = temporaryFile({ name: '.npmrc' });
let rootPkg: NormalizedPackageJson;
const pkgs = new Map<string, NormalizedPackageJson>();

/**
 * Check if the plugin is defined before the plugin `@semantic-release/git` if it's defined.
 *
 * @param context semantic-release context.
 */
function checkPluginsOrder(context: VerifyConditionsContext & OptionsContext) {
  const pluginsList = context.options.plugins.map((plugin) =>
    Array.isArray(plugin) ? plugin[0] : plugin,
  );
  const gitPluginIndex = pluginsList.indexOf('@semantic-release/git');

  if (gitPluginIndex === -1) {
    return;
  }

  const pluginIndex = pluginsList.findIndex((plugin) =>
    plugin.includes('semantic-release-config-kuzzle/plugin'),
  );

  if (pluginIndex > gitPluginIndex) {
    throw new SemanticReleaseError(
      'This plugin should be defined before plugin `@semantic-release/git`',
      'EINVALIDSETUP',
    );
  }
}

/**
 *  Get parsed package.json for workspaces packages
 *
 * @param pluginConfig pluginConfig The plugin configuration.
 * @param context semantic-release context.
 */
async function getPackages(
  pluginConfig: PluginConfig,
  context: VerifyConditionsContext & OptionsContext,
): Promise<void> {
  if (pluginConfig.npmPublish === false) {
    return;
  }

  rootPkg = await getPkg(context.cwd ?? process.cwd());
  const workspaces = await getWorkspaces(rootPkg);

  const errors = [];

  for (const workspace of workspaces) {
    try {
      const pkg = await getPkg(workspace);
      await verifyNpmAuth(npmrc, pkg, context);
      pkgs.set(workspace, pkg);
    } catch (error) {
      errors.push(error);
    }
  }

  if (errors.length > 0) {
    throw new AggregateError(errors);
  }
}

/**
 * Verify the npm configuration and plugin setup:
 * - `npmPublish` config should be valid
 * - The plugin should be define before the plugin `@semantic-release/git` if it's defined.
 * - If `npmPublish=true` all workspaces packages should be can connect to npm repository
 *
 * @param pluginConfig pluginConfig The plugin configuration.
 * @param context semantic-release context.
 */
export async function verifyConditions(
  pluginConfig: PluginConfig,
  context: VerifyConditionsContext & OptionsContext,
) {
  const errors = [];

  try {
    checkPluginsOrder(context);
  } catch (error) {
    errors.push(error);
  }

  // ? Check if `npmPublish` is boolean or undefined
  if (
    pluginConfig.npmPublish !== undefined &&
    pluginConfig.npmPublish !== true &&
    pluginConfig.npmPublish !== false
  ) {
    errors.push(getError('EINVALIDNPMPUBLISH', pluginConfig));
  }

  try {
    await getPackages(pluginConfig, context);
  } catch (error) {
    errors.push(...(error as AggregateError).errors);
  }

  if (errors.length > 0) {
    throw new AggregateError(errors);
  }

  verified = true;
}

/**
 * Prepare the npm package for release
 *
 * @param pluginConfig The plugin configuration.
 * @param context semantic-release context.
 */
export async function prepare(
  pluginConfig: PluginConfig,
  context: PrepareContext & OptionsContext,
) {
  if (!verified) {
    await getPackages(pluginConfig, context);
  }

  const { env, cwd } = context;
  for (const [workspace, pkg] of pkgs) {
    await npmVersion(npmrc, pkg, { ...context, cwd: workspace });
    await add([path.join(workspace, 'package.json')], { env, cwd });
  }

  prepared = true;
}

/**
 * Publish the npm package to the registry
 *
 * @param pluginConfig The plugin configuration.
 * @param context semantic-release context.
 */
export async function publish(
  pluginConfig: PluginConfig,
  context: PublishContext & OptionsContext,
) {
  if (pluginConfig.npmPublish === false) {
    context.logger.log(`Skip publishing to npm registry as npmPublish is false`);
    return false;
  }

  if (!verified) {
    await getPackages(pluginConfig, context);
  }

  if (!prepared) {
    await prepare(pluginConfig, context);
  }

  for (const [workspace, pkg] of pkgs) {
    await npmPublish(npmrc, pluginConfig, pkg, { ...context, cwd: workspace });
  }

  const distTag = getChannel(context.nextRelease.channel);
  return getReleaseInfo(rootPkg, context, distTag);
}

/**
 * Tag npm published version with release channel (eg: `beta`) or `latest` for main releases
 *
 * @param pluginConfig The plugin configuration.
 * @param context semantic-release context.
 */
export async function addChannel(pluginConfig: PluginConfig, context: AddChannelContext & OptionsContext) {
  for (const [, pkg] of pkgs) {
    await npmDistTag(npmrc, pluginConfig, pkg, context);
  }

  const distTag = getChannel(context.nextRelease.channel);
  return getReleaseInfo(rootPkg, context, distTag);
}
