import {
  CallToolRequestSchema,
  type CallToolResult,
  InitializeRequestSchema,
  type InitializeResult,
  type JSONRPCRequest,
  type JSONRPCResponse,
  ListToolsRequestSchema,
  type ListToolsResult,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { type Tool } from "./tool.ts";
import { zodToJsonSchema } from "zod-to-json-schema";

const RequestSchema = z.union([
  InitializeRequestSchema,
  ListToolsRequestSchema,
  CallToolRequestSchema,
]);
type RequestSchema = z.infer<typeof RequestSchema>;

export class MCP {
  constructor(private readonly input: { tools: Array<Tool> }) {}

  readonly process = async (msg: JSONRPCRequest) => {
    const parsed = RequestSchema.parse(msg);
    const result = await this.#process(parsed);

    return {
      jsonrpc: "2.0",
      id: msg.id,
      result,
    } satisfies JSONRPCResponse;
  };

  readonly #process = async (request: RequestSchema) => {
    switch (request.method) {
      case "initialize":
        return {
          protocolVersion: "2024-11-05",
          capabilities: {
            tools: {},
          },
          serverInfo: {
            name: "opencontrol",
            version: "0.0.1",
          },
        } satisfies InitializeResult;
      case "tools/list":
        return {
          tools: this.input.tools.map((tool) => ({
            name: tool.name,
            inputSchema: zodToJsonSchema(
              tool.args || (z.object({}) as any),
              "args",
            ).definitions!["args"] as any,
            description: tool.description,
          })),
        } satisfies ListToolsResult;

      case "tools/call": {
        const tool = this.input.tools.find(
          (tool) => tool.name === request.params.name,
        );
        if (!tool) throw new Error("tool not found");

        let args = request.params.arguments;
        if (tool.args) {
          const validated = await tool.args["~standard"].validate(args);
          if (validated.issues) {
            return {
              isError: true,
              content: [
                {
                  type: "text",
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
                    type: "text",
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
                    type: "text",
                    text: JSON.stringify(result, null, 2),
                  },
                ],
              }) satisfies CallToolResult,
          );
      }
      default: {
        throw new Error("not implemented");
      }
    }
  };
}
