import debuglog from 'debug';
import { execa, Options } from 'execa';

const debug = debuglog('semantic-release:kuzzle:git');

/**
 * Add a list of file to the Git index. `.gitignore` will be ignored.
 *
 * @param files Array of files path to add to the index.
 * @param [execaOpts] Options to pass to `execa`.
 */
export async function add(files: string[], execaOptions: Options) {
  const shell = await execa('git', ['add', '--force', '--ignore-errors', ...files], {
    ...execaOptions,
    reject: false,
  });
  debug('add file to git index', shell);
}
