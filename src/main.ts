import {z} from 'zod';
import {tool, type Tool} from './tool.ts';
import {createAnthropic} from '@ai-sdk/anthropic';
import {MCP} from './mcp.ts';
import {getSystemPrompt} from './system.ts';
import readline from 'node:readline';
import {queryWmi} from './wmi.ts';
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
    name: 'WQL-query',
    description: "Write a WQL query that queries the system's WMI",
    args: z.object({
      query: z.string().describe('The WQL Query'),
    }),
    run: async (args) => {
      return queryWmi(args.query);
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
  if (line === 'exit') {
    break;
  }

  console.log('Contacting AI...');
  await mcp.prompt(line);

  process.stdout.write('> ');
}
