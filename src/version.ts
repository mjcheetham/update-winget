import * as core from '@actions/core';

export class Version {
  readonly version: string;
  readonly components: string[];

  constructor(version: string) {
    this.version = version;
    this.components = version.split('.');

    if (!this.components) {
      return;
    }
  }

  toString(components?: number): string {
    if (components === undefined) {
      return this.version;
    }

    if (components < 1) {
      return '';
    }

    let result = this.components[0];
    for (let i = 1; i < components; i++) {
      result += `.${this.components[i]}`;
    }

    return result;
  }

  format(str: string): string {
    let result = str;
    const formatRegex = /{{version:.+}}/g;
    const specifiers = str.match(formatRegex);

    if (specifiers) {
      for (const specifier of specifiers) {
        core.debug(`Replacing version specifier: ${specifier}`);

        const substRegex = /s\/(?<search>.*)\/(?<replacement>.*)\//;
        const regexResult = substRegex.exec(specifier);
        if (regexResult && regexResult.groups?.search) {
          const searchRegex = new RegExp(regexResult.groups.search, 'g');
          core.debug(`  Search: ${searchRegex}`);

          const replacementPattern = regexResult.groups?.replacement || '';
          core.debug(`  Replace: ${replacementPattern}`);

          const versionStr = this.version.replace(
            searchRegex,
            replacementPattern
          );
          core.debug(`  Version => ${versionStr}`);

          result = result.replace(specifier, versionStr);
        }
      }
    }

    // Replace legacy format specifiers
    core.debug('Replacing legacy version specifiers');
    return result
      .replace(/{{version}}/g, this.version)
      .replace(/{{version\.major}}/g, this.toString(1))
      .replace(/{{version\.major_minor}}/g, this.toString(2))
      .replace(/{{version\.major_minor_patch}}/g, this.toString(3));
  }
}
