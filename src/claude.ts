import {z} from 'zod';
import {tool, type Tool} from './tool.ts';
import {createAnthropic} from '@ai-sdk/anthropic';
import {MCP} from './mcp.ts';
import {getSystemPrompt} from './system.ts';
import readline from 'node:readline';
import {pwshCommand} from './wmi.ts';
import assert from 'node:assert';

const tools: Array<Tool> = [
  tool({
    name: 'sum',
    description: 'Add two numbers together',
    args: z.object({
      x: z.number().describe('The left number'),
      y: z.number().describe('The right number'),
    }),
    run: async (args) => {
      return args.x + args.y;
    },
  }),
  tool({
    name: 'Read-only-powershell-command',
    description:
      'Run a command in powershell with -LanguageMode ConstrainedLanguage',
    args: z.object({
      command: z.string().describe('The command to run'),
    }),
    run: async (args) => {
      try {
        const result = await pwshCommand(args.command);
        return result;
      } catch (e) {
        console.error(e);
        throw e;
      }
    },
  }),
  tool({
    name: 'case-insensitive-character-count',
    description:
      'Count how many times a character occurs in a string, case insensitive',
    args: z.object({
      text: z.string().describe('The text to count characters in'),
      character: z.string().describe('The character to count'),
    }),
    run: async (args) => {
      const text = args.text.toLowerCase();
      const matchChar = args.character.toLowerCase();

      let i = 0;
      for (const char of text) {
        if (char === matchChar) {
          i++;
        }
      }

      return {count: i};
    },
  }),
];

export async function Claude() {
  const apiKey = process.env['ANTHROPIC_API_KEY'];
  assert(apiKey, 'NO API KEY IN ENV');

  const model = createAnthropic({apiKey})('claude-3-7-sonnet-20250219');
  const systemPrompt = await getSystemPrompt();

  const mcp = new MCP({tools, model, systemPrompt});
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.clear();
  console.log('Welcome to this MCP test');
  console.log('State your prompt.');
  process.stdout.write('> ');
  for await (const line of rl) {
    mcp.resetHistory();
    if (line === 'exit') {
      process.exit(0);
    }

    if (line === 'reset') {
      mcp.resetHistory();
      console.clear();
      process.stdout.write('> ');
      continue;
    }

    if (!line.replaceAll('\s', '')) {
      process.stdout.write('> ');
      continue;
    }

    console.log('Contacting AI...');
    await mcp.prompt(line);
    process.stdout.write('> ');
  }
}
