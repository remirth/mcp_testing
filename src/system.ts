import path from 'node:path';
import fs from 'node:fs';
import sh from 'node:child_process';

export async function getSystemPrompt() {
  console.log(import.meta.dirname);
  return fs.promises.readFile(path.join(import.meta.dirname, 'system.txt'), {
    encoding: 'utf8',
  });
}

export function parseJson(buffer: string | Buffer): unknown {
  return JSON.parse(buffer as never);
}

export async function execAsync(...params: Parameters<typeof sh.exec>) {
  return new Promise<string | Buffer<ArrayBufferLike>>((resolve, reject) => {
    // Increase the maxBuffer value to handle larger outputs
    sh.exec(params[0], params[1], (error, stdout, stderr) => {
      if (error) {
        reject(error);
        return;
      }
      if (stderr) {
        console.error('PowerShell stderr:', stderr);
      }
      try {
        resolve(stdout);
      } catch (e) {
        reject(new Error(`Failed to parse JSON: ${(e as Error).message}`));
      }
    });
  });
}
