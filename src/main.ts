import {z} from 'zod';
import {tool, type Tool} from './tool.ts';
import {createAnthropic} from '@ai-sdk/anthropic';
import {MCP} from './mcp.ts';
import {getSystemPrompt} from './system.ts';
import readline from 'node:readline';

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
];

const apiKey = process.env['ANTHROPIC_API_KEY'];
if (!apiKey) throw new Error('NO API KEY');

const model = createAnthropic({apiKey})('claude-3-7-sonnet-20250219');
const systemPrompt = await getSystemPrompt();

const mcp = new MCP({tools, model, systemPrompt});
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

console.log('Welcome to MCP Test, enter your prompt');
process.stdout.write('> ');
for await (const line of rl) {
  if (line === 'exit') {
    break;
  }

  console.log('Contacting AI...');
  await mcp.prompt(line);

  process.stdout.write('> ');
}
