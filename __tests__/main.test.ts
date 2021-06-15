//import * as process from 'process';
//import * as cp from 'child_process';
//import * as path from 'path';
import { Version } from '../src/version';

test('version format specifiers', async () => {
  const version = new Version('2.30.0.abc.8.9');

  const expected =
    'The full version is 2.30.0.abc.8.9.\n' +
    'The major version is 2.\n' +
    'The major.minor version is 2.30.\n' +
    'The major.minor.patch version is 2.30.0.\n' +
    'Simple substitution is 2.30.0.xyz.8.9.\n' +
    'Regex substitution 1 is 2-30-0-8-9_abc.\n' +
    'Regex substitution 2 is 2.30.\n' +
    'Empty substitution is 2.30.0.8.9.';

  const actual = version.format(
    'The full version is {{version}}.\n' +
      'The major version is {{version.major}}.\n' +
      'The major.minor version is {{version.major_minor}}.\n' +
      'The major.minor.patch version is {{version.major_minor_patch}}.\n' +
      'Simple substitution is {{version:s/abc/xyz/}}.\n' +
      'Regex substitution 1 is {{version:s/(\\d+)\\.(\\d+)\\.(\\d+)\\.(.+)\\.(\\d+)\\.(\\d+)/$1-$2-$3-$5-$6_$4/}}.\n' +
      'Regex substitution 2 is {{version:s/^(\\d+)\\.(\\d+).*/$1.$2/}}.\n' +
      'Empty substitution is {{version:s/\\.abc//}}.'
  );

  expect(actual).toBe(expected);
});
