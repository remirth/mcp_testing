import path from 'node:path';
import fs from 'node:fs';

export async function getSystemPrompt() {
  console.log(import.meta.dirname);
  return fs.promises.readFile(path.join(import.meta.dirname, 'system.txt'), {
    encoding: 'utf8',
  });
}
