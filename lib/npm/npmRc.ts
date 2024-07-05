import path from 'node:path';
import debuglog from 'debug';
import rc from 'rc';
import type { VerifyConditionsContext } from 'semantic-release';

const debug = debuglog('semantic-release:kuzzle:npmrc');

let npmrc: ReturnType<typeof rc>;
/**
 *
 * @param context
 */
export function readRC({ cwd, env }: VerifyConditionsContext): typeof npmrc {
  if (npmrc === undefined) {
    const NPM_CONFIG_USERCONFIG = env.NPM_CONFIG_USERCONFIG ?? env.npm_config_userconfig;
    const config = NPM_CONFIG_USERCONFIG || path.resolve(cwd ?? process.cwd(), '.npmrc');
    debug(`read ${config}`);
    npmrc = rc('npm', { registry: 'https://registry.npmjs.org/' }, { config });
  }

  return npmrc;
}
