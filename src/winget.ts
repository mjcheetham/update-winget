import * as core from '@actions/core';
import { GitHub } from '@actions/github';
import * as Git from './git';

export interface UploadManifestOptions {
  manifest: string;
  filePath: string;
  message: string;
  forkOwner?: string;
  alwaysUsePullRequest: boolean;
}

export class ManifestRepo {
  private repo: Git.Repository;
  private branch: Git.Branch;

  private constructor(repo: Git.Repository, branch: Git.Branch) {
    this.repo = repo;
    this.branch = branch;
  }

  static async createAsync(
    api: GitHub,
    name: string,
    branch?: string
  ): Promise<ManifestRepo> {
    const nameParts = Git.Repository.splitRepoName(name);

    const tapOwner = nameParts.owner;
    const tapRepoName = nameParts.repoName;

    const repo = await Git.Repository.createAsync(api, tapOwner, tapRepoName);
    const tapBranch = branch
      ? await repo.getBranchAsync(branch)
      : repo.defaultBranch;

    return new ManifestRepo(repo, tapBranch);
  }

  async uploadManifestAsync(
    options: UploadManifestOptions
  ): Promise<Git.Commit | Git.PullRequest> {
    let commitRepo: Git.Repository;
    let commitBranch: Git.Branch;
    let createPull: boolean;

    core.debug(
      `canPush=${this.repo.canPush}, isProtected=${this.branch.isProtected}, alwaysUsePullRequest=${options.alwaysUsePullRequest}`
    );

    if (
      this.repo.canPush &&
      (this.branch.isProtected || options.alwaysUsePullRequest)
    ) {
      core.debug('updating via PR in repo');
      // Need to update via a PR in this repo
      commitRepo = this.repo;
      commitBranch = await this.repo.createBranchAsync(
        `update-${Date.now().toString()}`,
        this.branch.sha
      );
      createPull = true;
    } else if (
      this.repo.canPush &&
      !this.branch.isProtected &&
      !options.alwaysUsePullRequest
    ) {
      core.debug('updating via commit in repo');
      // Commit directly to the branch in this repo
      commitRepo = this.repo;
      commitBranch = this.branch;
      createPull = false;
    } else {
      core.debug('updating via PR in fork repo');
      // Need to update via PR from a fork
      const fork = await this.repo.createForkAsync(options.forkOwner);
      commitRepo = fork;
      commitBranch = fork.defaultBranch;
      createPull = true;
    }

    // Create the commit
    core.debug('creating commit...');
    const commit = await commitRepo.commitFileAsync(
      commitBranch.name,
      options.filePath,
      options.manifest,
      options.message
    );

    if (!createPull) {
      return commit;
    }

    core.debug('generating pull request message...');
    let pullTitle: string;
    let pullBody: string;
    const msgParts = options.message.split('\n');

    if (msgParts.length === 1) {
      pullTitle = options.message;
      pullBody = '';
    } else if (msgParts.length > 1) {
      pullTitle = msgParts[0];
      pullBody = msgParts.slice(1).join('\n');
    } else {
      pullTitle = `Update ${options.filePath}`;
      pullBody = '';
    }

    core.debug(`PR message is: ${pullTitle}\n${pullBody}`);

    core.debug('creating pull request...');
    return await this.repo.createPullRequestAsync(
      this.branch.name,
      commitBranch.name,
      pullTitle,
      pullBody,
      commitRepo.owner
    );
  }
}
