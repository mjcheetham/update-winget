import { createHash } from 'crypto';
import request from 'request';

export async function computeSha256Async(url: string): Promise<string> {
  const lowerUrl = url.toLowerCase();
  if (!lowerUrl.startsWith('https://') && !lowerUrl.startsWith('http://')) {
    throw new Error(`unknown scheme type in URL '${url}'`);
  }

  const sha256 = createHash('sha256');

  return new Promise<string>((resolve, reject) => {
    request(url)
      .on('error', err => {
        reject(
          new Error(`failed to download ${url}: [${err.name}] ${err.message}`)
        );
      })
      .on('complete', () => {
        sha256.end();
        resolve(sha256.digest('hex'));
      })
      .pipe(sha256);
  });
}
