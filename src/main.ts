import {z} from 'zod';
import {tool, type Tool} from './tool.ts';
import {createAnthropic} from '@ai-sdk/anthropic';
import {MCP} from './mcp.ts';
import {getSystemPrompt} from './system.ts';
import readline from 'node:readline';
import {pwshCommand, queryWmi} from './wmi.ts';
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
  tool({
    name: 'WQL-query',
    description:
      "Write a WQL query that queries the system's WMI. An error will be thrown if the result is too many tokens.",
    args: z.object({
      query: z.string().describe('The WQL Query.'),
      function: z
        .string()
        .describe(
          "A string that, if specified, will be used to construct a Javascript new Function() call and be called with the result of the WMI query as a javascript object with the parameter name 'value'. The second parameter is called metadata and is in the shape {isArray: boolean, isObject: boolean, isNull: boolean} Use this to format the result and reduce the amount of tokens used.",
        ),
    }),
    run: async (args) => {
      let result = await queryWmi(args.query);
      const metadata = {
        isNull: result == null,
        isObject: typeof result === 'object',
        isArray: Array.isArray(result),
      };

      if (args.function) {
        try {
          const fn = new Function('value', 'metadata', args.function);
          return fn(result, metadata);
        } catch (e) {
          const error = e as any;
          error.metadata = metadata;
          throw error;
        }
      }

      if (JSON.stringify(result).length > 20_000) {
        throw new Error(
          'WQL result exceeds 20000 characters, please be more specific!',
        );
      }

      return result;
    },
  }),
];

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
