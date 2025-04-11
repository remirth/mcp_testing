import {
  CallToolRequestSchema,
  type CallToolResult,
  InitializeRequestSchema,
  type InitializeResult,
  type JSONRPCRequest,
  type JSONRPCResponse,
  ListToolsRequestSchema,
  type ListToolsResult,
} from '@modelcontextprotocol/sdk/types.js';
import {z} from 'zod';
import {type Tool} from './tool.ts';
import {zodToJsonSchema} from 'zod-to-json-schema';
import {
  type LanguageModelV1,
  type LanguageModelV1CallOptions,
  type LanguageModelV1Prompt,
} from 'ai';

const providerMetadata = {
  anthropic: {
    cacheControl: {
      type: 'ephemeral',
    },
  },
};

const RequestSchema = z.union([
  InitializeRequestSchema,
  ListToolsRequestSchema,
  CallToolRequestSchema,
]);
type RequestSchema = z.infer<typeof RequestSchema>;

type McpOptions = {
  tools: Array<Tool>;
  model: LanguageModelV1;
  systemPrompt: string;
};

export class MCP {
  #prompt: LanguageModelV1Prompt = [];
  #listTools: ListToolsResult;
  #input: McpOptions;

  resetHistory = () => {
    this.#prompt = [
      {
        role: 'system',
        content: this.#input.systemPrompt,
        providerMetadata,
      },
      {
        role: 'system',
        content: `The current date is ${new Date().toDateString()}`,
        providerMetadata,
      },
    ];
  };

  constructor(options: McpOptions) {
    this.#input = options;
    this.resetHistory();

    this.#listTools = {
      tools: this.#input.tools.map((tool) => ({
        name: tool.name,
        inputSchema: zodToJsonSchema(tool.args || (z.object({}) as any), 'args')
          .definitions!['args'] as any,
        description: tool.description,
      })),
    };
  }

  readonly prompt = async (msg: string) => {
    this.#prompt.push({
      role: 'user',
      content: [
        {
          type: 'text',
          text: msg,
          providerMetadata: this.#prompt.length === 1 ? providerMetadata : {},
        },
      ],
    });

    while (true) {
      const result = await this.#generate({
        prompt: this.#prompt,
        mode: {
          type: 'regular',
          tools: this.#listTools.tools.map((tool) => ({
            type: 'function',
            name: tool.name,
            description: tool.description,
            parameters: {
              ...tool.inputSchema,
            },
          })),
        },
        inputFormat: 'messages',
        temperature: 1,
      });

      if (result.text) {
        this.#prompt.push({
          role: 'assistant',
          content: [
            {
              type: 'text',
              text: result.text,
            },
          ],
        });

        console.log('AI:', result.text);
      }

      if (result.finishReason === 'stop') {
        break;
      }
      if (result.finishReason === 'tool-calls') {
        for (const item of result.toolCalls!) {
          console.log('calling tool', item.toolName, item.args);
          this.#prompt.push({
            role: 'assistant',
            content: [
              {
                type: 'tool-call',
                toolName: item.toolName,
                args: JSON.parse(item.args),
                toolCallId: item.toolCallId,
              },
            ],
          });

          const response = await this.callTool({
            jsonrpc: '2.0',
            id: '2',
            method: 'tools/call',
            params: {
              name: item.toolName,
              arguments: JSON.parse(item.args),
            },
          });

          if ('content' in response.result) {
            this.#prompt.push({
              role: 'tool',
              content: [
                {
                  type: 'tool-result',
                  toolName: item.toolName,
                  toolCallId: item.toolCallId,
                  result: response.result.content,
                },
              ],
            });
          } else break;
        }
      }
    }
  };

  readonly #generate = (options: LanguageModelV1CallOptions) => {
    return this.#input.model.doGenerate(options);
  };

  readonly callTool = async (msg: JSONRPCRequest) => {
    const parsed = RequestSchema.parse(msg);
    const result = await this.#processTool(parsed);

    return {
      jsonrpc: '2.0',
      id: msg.id,
      result,
    } satisfies JSONRPCResponse;
  };

  readonly #processTool = async (request: RequestSchema) => {
    switch (request.method) {
      case 'initialize':
        return {
          protocolVersion: '2024-11-05',
          capabilities: {
            tools: {},
          },
          serverInfo: {
            name: 'Buffa',
            version: '0.0.1',
          },
        } satisfies InitializeResult;
      case 'tools/list':
        return this.#listTools;

      case 'tools/call': {
        const tool = this.#input.tools.find(
          (tool) => tool.name === request.params.name,
        );
        if (!tool) throw new Error('tool not found');

        let args = request.params.arguments;
        if (tool.args) {
          const validated = await tool.args['~standard'].validate(args);
          if (validated.issues) {
            return {
              isError: true,
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(validated.issues),
                },
              ],
            } satisfies CallToolResult;
          }
          args = validated.value as any;
        }

        return tool
          .run(args)
          .catch(
            (error) =>
              ({
                isError: true,
                content: [
                  {
                    type: 'text',
                    text: error.message,
                  },
                ],
              }) satisfies CallToolResult,
          )
          .then(
            (result) =>
              ({
                content: [
                  {
                    type: 'text',
                    text: JSON.stringify(result, null, 2),
                  },
                ],
              }) satisfies CallToolResult,
          );
      }
      default: {
        throw new Error('not implemented');
      }
    }
  };
}
