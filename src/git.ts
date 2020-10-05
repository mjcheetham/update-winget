import { GitHub } from '@actions/github';

export class File {
  readonly path: string;
  readonly blob: string;
  readonly content: string;
  constructor(path: string, blob: string, content: string) {
    this.path = path;
    this.blob = blob;
    this.content = content;
  }
}

export class Branch {
  readonly name: string;
  readonly sha: string;
  readonly isProtected: boolean;
  constructor(name: string, sha: string, isProtected: boolean) {
    this.name = name;
    this.sha = sha;
    this.isProtected = isProtected;
  }
}

export class Commit {
  readonly sha: string;
  readonly url: string;
  constructor(sha: string, url: string) {
    this.sha = sha;
    this.url = url;
  }
}

export class PullRequest {
  readonly id: number;
  readonly url: string;
  constructor(id: number, url: string) {
    this.id = id;
    this.url = url;
  }
}

export class ReleaseAsset {
  readonly name: string;
  readonly url: string;
  readonly downloadUrl: string;
  constructor(name: string, url: string, downloadUrl: string) {
    this.name = name;
    this.url = url;
    this.downloadUrl = downloadUrl;
  }
}

export class Repository {
  readonly api: GitHub;
  readonly owner: string;
  readonly name: string;
  readonly defaultBranch: Branch;
  readonly canPush: boolean;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly req: any;

  private constructor(
    api: GitHub,
    owner: string,
    name: string,
    defaultBranch: Branch,
    canPush: boolean
  ) {
    this.api = api;
    this.owner = owner;
    this.name = name;
    this.defaultBranch = defaultBranch;
    this.canPush = canPush;
    this.req = { owner, repo: name };
  }

  static async createAsync(
    api: GitHub,
    owner: string,
    name: string
  ): Promise<Repository> {
    const req = { owner, repo: name };
    const { data: repoData } = await api.repos.get(req);
    const { data: branchData } = await api.repos.getBranch({
      ...req,
      branch: repoData.default_branch
    });

    const defaultBranch = new Branch(
      branchData.name,
      branchData.commit.sha,
      branchData.protected
    );

    return new Repository(
      api,
      owner,
      name,
      defaultBranch,
      repoData.permissions.push
    );
  }

  static splitRepoName(
    ownerAndName: string
  ): { owner: string; repoName: string } {
    const nameParts = ownerAndName.split('/');
    if (nameParts.length !== 2) {
      throw new Error(`invalid repo name '${ownerAndName}'`);
    }

    return { owner: nameParts[0], repoName: nameParts[1] };
  }

  async getFileAsync(
    filePath: string,
    branch: string | undefined
  ): Promise<File> {
    const { data, status } = await this.api.repos.getContents({
      ...this.req,
      path: filePath,
      ref: branch || this.defaultBranch.name
    });

    assertOk(
      status,
      `failed to download '${filePath}' @ '${branch ||
        this.defaultBranch.name}' from '${this.owner}/${this.name}'`
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const d = data as any;

    const content = Buffer.from(d.content, 'base64').toString();

    return new File(filePath, d.sha, content);
  }

  async commitFileAsync(
    branch: string,
    filePath: string,
    content: string,
    message: string,
    existingBlob?: string
  ): Promise<Commit> {
    const { status, data } = await this.api.repos.createOrUpdateFile({
      ...this.req,
      content: Buffer.from(content).toString('base64'),
      branch,
      path: filePath,
      message,
      sha: existingBlob
    });

    assertOk(
      status,
      `failed to create commit on branch '${branch}' in '${this.owner}/${this.name}'`
    );

    return new Commit(data.commit.sha, data.commit.html_url);
  }

  async getBranchAsync(name: string): Promise<Branch> {
    const { status: branchStatus, data } = await this.api.repos.getBranch({
      ...this.req,
      branch: name
    });

    assertOk(
      branchStatus,
      `failed to get branch information for '${name}' in '${this.owner}/${this.name}'`
    );

    return new Branch(name, data.commit.sha, data.protected);
  }

  async createBranchAsync(name: string, sha: string): Promise<Branch> {
    const { status: refStatus } = await this.api.git.createRef({
      ...this.req,
      sha,
      ref: `refs/heads/${name}`
    });

    assertOk(
      refStatus,
      `failed to create branch '${name}' at '${sha}' in '${this.owner}/${this.name}'`
    );

    return await this.getBranchAsync(name);
  }

  async createForkAsync(owner?: string): Promise<Repository> {
    const { status, data } = await this.api.repos.createFork({
      ...this.req,
      organization: owner
    });

    assertOk(
      status,
      `failed to fork repo '${this.owner}/${this.name}' into '${owner}'`
    );

    return await Repository.createAsync(this.api, data.owner.login, data.name);
  }

  async createPullRequestAsync(
    targetBranch: string,
    sourceBranch: string,
    title: string,
    body: string,
    sourceOwner?: string
  ): Promise<PullRequest> {
    const headRef = sourceOwner
      ? `${sourceOwner}:${sourceBranch}`
      : sourceBranch;

    const { status, data } = await this.api.pulls.create({
      ...this.req,
      head: headRef,
      base: targetBranch,
      title,
      body
    });

    assertOk(
      status,
      `failed to create pull request from '${headRef}' to '${targetBranch} in '${this.owner}/${this.name}'`
    );

    return new PullRequest(data.number, data.html_url);
  }

  async getReleaseAssetsAsync(tag: string): Promise<ReleaseAsset[]> {
    const tagName = tag.replace(/^(refs\/tags\/)/, '');

    const { status, data } = await this.api.repos.getReleaseByTag({
      ...this.req,
      tag: tagName
    });

    assertOk(
      status,
      `failed to locate release with tag '${tagName}' in '${this.owner}/${this.name}'`
    );

    return data.assets.map(
      x => new ReleaseAsset(x.name, x.url, x.browser_download_url)
    );
  }
}

function assertOk(status: number, errorMessage: string): void {
  if (status < 200 || status > 299) {
    throw new Error(errorMessage);
  }
}
