export class Version {
  readonly version: string;
  readonly major: string | undefined;
  readonly minor: string | undefined;
  readonly patch: string | undefined;

  constructor(version: string) {
    this.version = version;
    const regex = /^(\d+)(?:\.(\d+))?(?:\.(\d+))?/;
    const matches = version.match(regex);

    if (!matches) {
      return;
    }

    if (matches.length > 1) {
      this.major = matches[1];
    }

    if (matches.length > 2) {
      this.minor = matches[2];
    }

    if (matches.length > 3) {
      this.patch = matches[3];
    }
  }

  toString(components?: number): string {
    if (!components) {
      return this.version;
    }

    if (components > 2 && this.patch) {
      return `${this.major}.${this.minor}.${this.patch}`;
    }

    if (components > 1 && this.minor) {
      return `${this.major}.${this.minor}`;
    }

    if (components > 0 && this.major) {
      return this.major;
    }

    return this.version;
  }

  format(format: string): string {
    return format
      .replace(/{{version}}/g, this.version)
      .replace(/{{version.major}}/g, this.toString(1))
      .replace(/{{version.major_minor}}/g, this.toString(2))
      .replace(/{{version.major_minor_patch}}/g, this.toString(3));
  }
}
