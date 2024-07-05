import fs from 'node:fs/promises';
import debuglog from 'debug';
import type { NormalizedPackageJson } from 'read-pkg';
import type { VerifyConditionsContext } from 'semantic-release';
import getRegistryUrl from 'registry-auth-token/registry-url.js';
import getAuthToken from 'registry-auth-token';
import nerfDart from 'nerf-dart';
import { execa } from 'execa';
import { getError } from './error';
import { readRC } from './npmRc';

const debug = debuglog('semantic-release:kuzzle:package');

/**
 * Get NPM registry for package
 *
 * @param pkg package.json content
 * @param context process context
 * @returns registry URL
 */
export function getRegistry(
  { publishConfig: { registry } = {}, name }: NormalizedPackageJson,
  context: VerifyConditionsContext,
): string {
  return (
    registry ||
    context.env.NPM_CONFIG_REGISTRY ||
    getRegistryUrl(name.split('/')[0], readRC(context) as Pick<getAuthToken.AuthOptions, 'npmrc'>)
  );
}

/**
 * Set npmrc auth
 *
 * @param npmrc npmrc path
 * @param pkg package.json content
 * @param context process context
 *
 * @throws {SemanticReleaseError}
 */
export async function setNpmrcAuth(
  npmrc: string,
  registry: string,
  context: VerifyConditionsContext,
): Promise<void> {
  const {
    env: { NPM_TOKEN },
    logger,
  } = context;

  logger.log('Verify authentication for registry %s', registry);
  const { configs, ...rcConfig } = readRC(context);

  if (configs) {
    logger.log('Reading npm config from %s', configs.join(', '));
  }

  const currentConfig = configs
    ? (await Promise.all(configs.map((config) => fs.readFile(config)))).join('\n')
    : '';

  if (getAuthToken(registry, { npmrc: rcConfig as getAuthToken.AuthOptions['npmrc'] })) {
    debug('write npmrc', currentConfig);
    await fs.writeFile(npmrc, currentConfig);
    return;
  }

  if (NPM_TOKEN) {
    const content = `${currentConfig ? `${currentConfig}\n` : ''}${nerfDart(
      registry,
    )}:_authToken = \${NPM_TOKEN}`;

    debug('write npmrc', content);
    await fs.writeFile(npmrc, content);
    logger.log(`Wrote NPM_TOKEN to ${npmrc}`);
  } else {
    throw getError('ENONPMTOKEN', { registry });
  }
}

/**
 * Verify authentication to NPM registry for package
 *
 * @param npmrc npmrc path
 * @param pkg package.json content
 * @param context process context
 *
 * @throws {SemanticReleaseError}
 */
export async function verifyNpmAuth(
  npmrc: string,
  pkg: NormalizedPackageJson,
  context: VerifyConditionsContext,
) {
  const {
    cwd,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- useful to define default value
    env: { DEFAULT_NPM_REGISTRY = 'https://registry.npmjs.org/', ...env },
  } = context;
  const registry = getRegistry(pkg, context);

  await setNpmrcAuth(npmrc, registry, context);

  try {
    const whoamiResult = await execa(
      'npm',
      ['whoami', '--userconfig', npmrc, '--registry', registry],
      {
        cwd,
        env,
        preferLocal: true,
      },
    );
    debug('npm auth', whoamiResult);
  } catch {
    throw getError('EINVALIDNPMTOKEN', { registry });
  }
}
