import * as core from '@actions/core';
import { ManifestRepo } from './winget';
import { Repository, Commit, PullRequest, ReleaseAsset } from './git';
import { Version } from './version';
import { GitHub } from '@actions/github';
import { computeSha256Async } from './hash';

function formatMessage(
  format: string,
  id: string,
  filePath: string,
  version: Version
): string {
  return version
    .format(format)
    .replace(/{{id}}/g, id)
    .replace(/{{file}}/g, filePath);
}

async function run(): Promise<void> {
  try {
    const token = core.getInput('token');
    const gitHub = new GitHub(token);

    const repoStr = core.getInput('repo') || 'microsoft/winget-pkgs';
    const repoBranch = core.getInput('branch');
    const manifestRepo = await ManifestRepo.createAsync(
      gitHub,
      repoStr,
      repoBranch
    );

    const id = core.getInput('id', { required: true });
    let manifestText = core.getInput('manifestText', { required: true });
    const versionStr = core.getInput('version');
    let sha256 = core.getInput('sha256');
    const url = core.getInput('url');
    const message = core.getInput('message');
    const releaseRepo =
      core.getInput('releaseRepo') || process.env.GITHUB_REPOSITORY!;
    const releaseTag = core.getInput('releaseTag') || process.env.GITHUB_REF!;
    const releaseAsset = core.getInput('releaseAsset');
    const alwaysUsePullRequest =
      core.getInput('alwaysUsePullRequest') === 'true';

    core.debug(`repo=${repoStr}`);
    core.debug(`repoBranch=${repoBranch}`);
    core.debug(`id=${id}`);
    core.debug(`manifestText=${manifestText}`);
    core.debug(`version=${versionStr}`);
    core.debug(`sha256=${sha256}`);
    core.debug(`url=${url}`);
    core.debug(`message=${message}`);
    core.debug(`releaseRepo=${releaseRepo}`);
    core.debug(`releaseTag=${releaseTag}`);
    core.debug(`releaseAsset=${releaseAsset}`);
    core.debug(`alwaysUsePullRequest=${alwaysUsePullRequest}`);

    core.debug(
      `process.env.GITHUB_REPOSITORY=${process.env.GITHUB_REPOSITORY}`
    );
    core.debug(`process.env.GITHUB_REF=${process.env.GITHUB_REF}`);

    if (!versionStr && !releaseAsset) {
      throw new Error(
        "must specify either the 'version' parameter OR 'releaseAsset' parameters."
      );
    }

    if (versionStr && releaseAsset) {
      core.warning(
        "'version' parameter specified as well as 'releaseAsset' parameter; using 'version' parameter only"
      );
    }

    let asset: ReleaseAsset | undefined;
    let version: Version;
    let fullUrl: string;

    // locate asset if we need to compute either the version or url
    if (!versionStr || !url) {
      core.debug(
        `locating release asset in repo '${releaseRepo}' @ '${releaseTag}'`
      );
      const repoName = Repository.splitRepoName(releaseRepo);
      const sourceRepo = await Repository.createAsync(
        gitHub,
        repoName.owner,
        repoName.repoName
      );
      const assets = await sourceRepo.getReleaseAssetsAsync(releaseTag);
      const nameRegex = new RegExp(releaseAsset);
      asset = assets.find(x => nameRegex.test(x.name));
      if (!asset) {
        throw new Error(
          `unable to find an asset matching '${releaseAsset}' in repo '${releaseRepo}'`
        );
      }
    }

    // if we have an explicit version string, format and use that
    if (versionStr) {
      version = new Version(versionStr);
    } else {
      // compute the version from the asset
      if (!asset) {
        throw new Error('missing asset to compute version number from');
      }

      core.debug(
        `computing new manifest version number from asset in repo '${releaseRepo}' @ '${releaseTag}'`
      );

      const nameRegex = new RegExp(releaseAsset);
      const matches = asset.name.match(nameRegex);
      if (!matches || matches.length < 2) {
        throw new Error(
          `unable to match at least one capture group in asset name '${asset.name}' with regular expression '${nameRegex}'`
        );
      }

      if (matches.groups?.version) {
        core.debug(
          `using 'version' named capture group for new package version: ${matches.groups?.version}`
        );
        version = new Version(matches.groups.version);
      } else {
        core.debug(
          `using first capture group for new package version: ${matches[1]}`
        );
        version = new Version(matches[1]);
      }
    }

    if (url) {
      // if we have an explicit url, format and use that
      fullUrl = version.format(url);
    } else {
      // use the download URL of the asset
      if (!asset) {
        throw new Error('missing asset to compute URL from');
      }

      core.debug(
        `computing new manifest URL from asset in repo '${releaseRepo}' @ '${releaseTag}'`
      );

      fullUrl = asset.downloadUrl;
    }

    // if we have an explicit sha256 checksum, use that!
    // otherwise compute it from the download URL
    if (!sha256) {
      if (!fullUrl) {
        throw new Error('missing URL to compute checksum from');
      }

      core.debug(`computing SHA256 hash of data from asset at '${fullUrl}'...`);

      sha256 = await computeSha256Async(fullUrl);
      core.debug(`sha256=${sha256}`);
    }

    core.debug('generating manifest...');

    core.debug('setting id...');
    manifestText = manifestText.replace('{{id}}', id);

    core.debug('setting sha256...');
    manifestText = manifestText.replace('{{sha256}}', sha256);

    core.debug('setting url...');
    manifestText = manifestText.replace('{{url}}', fullUrl);

    core.debug('setting version...');
    manifestText = manifestText.replace('{{version}}', version.toString());
    manifestText = manifestText.replace(
      '{{version.major}}',
      version.toString(1)
    );
    manifestText = manifestText.replace(
      '{{version.major_minor}}',
      version.toString(2)
    );
    manifestText = manifestText.replace(
      '{{version.major_minor_patch}}',
      version.toString(3)
    );

    core.debug('computing manifest file path...');
    const manifestFilePath = `manifests/${id.charAt(0).toLowerCase().trim()}
    /${id.replace('.', '/')}/${version}.yaml`;
    core.debug(`manifest file path is: ${manifestFilePath}`);

    core.debug(`final manifest is:`);
    core.debug(manifestText);

    const fullMessage = formatMessage(message, id, manifestFilePath, version);

    core.debug('publishing manifest...');
    const uploadOptions = {
      manifest: manifestText,
      filePath: manifestFilePath,
      message: fullMessage,
      alwaysUsePullRequest
    };
    const result = await manifestRepo.uploadManifestAsync(uploadOptions);
    if (result instanceof Commit) {
      core.info(`Created commit '${result.sha}': ${result.url}`);
    } else if (result instanceof PullRequest) {
      core.info(`Created pull request '${result.id}': ${result.url}`);
    } else {
      core.warning('unknown type of package update');
    }
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
