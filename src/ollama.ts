import {ChatOllama} from '@langchain/ollama';
import {Calculator} from '@langchain/community/tools/calculator';
import * as agents from '@langchain/langgraph/prebuilt';
import {DynamicStructuredTool} from '@langchain/core/tools';
import readline from 'node:readline';
import {execAsync, getSystemPrompt} from './system.ts';
import {z} from 'zod';
import {pwshCommand} from './wmi.ts';
import {MemorySaver, type Messages} from '@langchain/langgraph';
import prexit from 'prexit';
import {AIMessage} from '@langchain/core/messages';
import util from 'node:util';

export async function Ollama() {
  const modelName = 'qwen2.5:14b';
  // Set up the local model through Ollama
  const model = new ChatOllama({
    baseUrl: 'http://localhost:11434',
    model: modelName,
    temperature: 1,
  });
  prexit(() => execAsync(`ollama stop ${modelName}`, {}).catch(console.warn));

  // Define tools
  const tools = [
    new Calculator(),
    new DynamicStructuredTool({
      name: 'read-process-env',
      description:
        'Returns an object containing all environment variables for the running process. Use this to read the system environment. You can optionally provide a key to a read a specific variable',
      schema: z.object({
        key: z
          .string()
          .optional()
          .describe('An optional key to read a specific variable.'),
      }),
      func: async (args) => {
        if (args.key) {
          return process.env[args.key] ?? '';
        }

        return JSON.stringify(process.env);
      },
    }),
    new DynamicStructuredTool({
      name: 'read-only-powershell-command',
      description:
        'Run a command on the users computer in powershell with -LanguageMode ConstrainedLanguage. Use this to answer questions about the users system.',
      schema: z.object({
        command: z.string().describe('The command to run'),
      }),
      func: async (args) => {
        try {
          const result = await pwshCommand(args.command);
          return result;
        } catch (e) {
          console.error(e);
          throw e;
        }
      },
    }),
  ];

  const systemPrompt = await getSystemPrompt();

  // Create the agent
  const memory = new MemorySaver();
  const agent = agents.createReactAgent({
    llm: model,
    tools,
    prompt: systemPrompt,
    checkpointSaver: memory,
  });

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.clear();
  console.log('Welcome to this local MCP test');
  console.log('State your prompt.');
  process.stdout.write('> ');
  for await (const line of rl) {
    if (line === 'exit') {
      process.exit(0);
    }

    if (line === 'reset') {
      console.clear();
      process.stdout.write('> ');
      continue;
    }

    if (!line.replaceAll('\s', '')) {
      process.stdout.write('> ');
      continue;
    }

    const messages: Messages = [{role: 'human', content: line}];
    const config = {configurable: {thread_id: '1'}};
    console.log('Contacting AI...');
    const stream = await agent.stream(
      {messages},
      {...config, streamMode: 'values'},
    );

    for await (const {messages} of stream) {
      let msg = messages.at(-1);

      if (!(msg instanceof AIMessage)) continue;
      if (msg?.content) {
        console.log(msg.content);
      } else if (msg.tool_calls?.length) {
        console.log(
          util.inspect(
            msg.tool_calls.map((tc) => ({[tc.name]: tc.args})),
            {depth: 5},
          ),
        );
      }

      console.log('-----\n');
    }
    process.stdout.write('\n> ');
  }
}
