import {ChatOllama} from '@langchain/ollama';
import {Calculator} from '@langchain/community/tools/calculator';
import {DynamicTool} from '@langchain/core/tools';
import readline from 'node:readline';
import {AgentExecutor, createToolCallingAgent} from 'langchain/agents';
import {ChatPromptTemplate, MessagesPlaceholder} from '@langchain/core/prompts';
import {getSystemPrompt} from './system.ts';

export async function Ollama() {
  // Set up the local model through Ollama
  const model = new ChatOllama({
    baseUrl: 'http://localhost:11434',
    model: 'mistral',
    temperature: 0.2,
  });

  // Define tools
  const tools = [new Calculator()];

  const systemPrompt = await getSystemPrompt();

  // Create the agent prompt
  const prompt = ChatPromptTemplate.fromMessages([
    ['system', systemPrompt],
    ['human', '{input}'],
    new MessagesPlaceholder('agent_scratchpad'),
  ]);

  // Create the agent
  const agent = createToolCallingAgent({
    llm: model,
    tools,
    prompt,
  });

  // Create the executor
  const agentExecutor = new AgentExecutor({
    agent,
    tools,
    verbose: false,
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

    console.log('Contacting AI...');
    const res = await agentExecutor.invoke({input: line});
    console.log(res);
    process.stdout.write('\n> ');
  }
}
