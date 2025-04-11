import {execAsync, parseJson} from './system.ts';

async function detectWmiCommand() {
  try {
    // Check if Get-WmiObject is available
    await execAsync(
      'powershell.exe -Command "Get-Command Get-WmiObject -ErrorAction Stop"',
      {},
    );
    return 'Get-WmiObject';
  } catch (e) {
    try {
      // Check if Get-CimInstance is available
      await execAsync(
        'powershell.exe -Command "Get-Command Get-CimInstance -ErrorAction Stop"',
        {},
      );
      return 'Get-CimInstance';
    } catch (e) {
      throw new Error(
        'Neither Get-WmiObject nor Get-CimInstance is available on this system',
      );
    }
  }
}
export async function queryWmi(wqlQuery: string) {
  const cmd = await detectWmiCommand();
  return execAsync(
    `powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -Command "${cmd} -Query '${wqlQuery}' | ConvertTo-Json -Depth 5"`,
    {maxBuffer: 1024 * 1024 * 1000},
  ).then(parseJson);
}

export async function pwshCommand(cmd: string) {
  const wrappedCommand = `$ExecutionContext.SessionState.LanguageMode = 'ConstrainedLanguage'; ${cmd}`;
  return execAsync(
    `powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -Command "${wrappedCommand}"`,
    {maxBuffer: 1024 * 1024 * 1000},
  );
}
