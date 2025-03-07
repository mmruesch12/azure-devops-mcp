import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import * as azdev from 'azure-devops-node-api';
import { z } from 'zod';
import { McpTool } from '../types';
import { AzureDevOpsConfig } from '../../types/config';

/**
 * Tool for running a pipeline in Azure DevOps
 */
export class RunPipelineTool implements McpTool {
  public name = 'run_pipeline';
  public description = 'Run a pipeline with optional parameters';

  /**
   * Register the tool with the MCP server
   *
   * @param server The MCP server
   * @param connection The Azure DevOps connection
   * @param config The Azure DevOps configuration
   */
  public register(
    server: McpServer,
    connection: azdev.WebApi | null,
    config: AzureDevOpsConfig,
  ): void {
    server.tool(
      this.name,
      {
        pipelineId: z.number().describe('The ID of the pipeline to run'),
        project: z
          .string()
          .optional()
          .describe(
            'The project containing the pipeline (uses default project if not specified)',
          ),
        branch: z
          .string()
          .optional()
          .describe('The branch to run the pipeline on (defaults to the default branch)'),
        parameters: z
          .record(z.string())
          .optional()
          .describe('Key-value pairs of pipeline parameters'),
        variables: z
          .record(z.string())
          .optional()
          .describe('Key-value pairs of pipeline variables'),
      },
      async (args, _extras) => {
        try {
          if (!connection) {
            throw new Error('No connection to Azure DevOps');
          }

          // Use provided project or fall back to default project
          const project = args.project || config.defaultProject;
          if (!project) {
            throw new Error(
              'No project specified and no default project configured',
            );
          }

          // Get the Pipelines API
          const pipelinesApi = await connection.getPipelinesApi();

          // Get the pipeline first to verify it exists
          const pipeline = await pipelinesApi.getPipeline(project, args.pipelineId);
          
          if (!pipeline) {
            return {
              content: [
                {
                  type: 'text',
                  text: `Pipeline ${args.pipelineId} not found.`,
                },
              ],
            };
          }

          // Prepare the run parameters
          const runParameters = {
            resources: {
              repositories: {
                self: {
                  refName: args.branch ? `refs/heads/${args.branch}` : undefined
                }
              }
            },
            templateParameters: args.parameters,
            variables: args.variables ? Object.entries(args.variables).reduce((acc, [key, value]) => {
              acc[key] = { value };
              return acc;
            }, {} as Record<string, { value: string }>) : undefined
          };

          // Run the pipeline
          const pipelineRun = await pipelinesApi.runPipeline(runParameters, project, args.pipelineId);
          console.log('pipelineRun', pipelineRun);

          if (!pipelineRun) {
            return {
              content: [
                {
                  type: 'text',
                  text: `Failed to run pipeline ${args.pipelineId}.`,
                },
              ],
            };
          }

          // Format the pipeline run
          const formattedRun = {
            id: pipelineRun.id,
            name: pipelineRun.name,
            state: pipelineRun.state,
            result: pipelineRun.result,
            createdDate: pipelineRun.createdDate,
            finishedDate: pipelineRun.finishedDate,
            url: pipelineRun.url,
            branch: args.branch || 'Default branch',
          };

          // Build the response
          let responseText = `# Pipeline Run Started

**Pipeline**: ${pipeline.name} (ID: ${args.pipelineId})
**Run Name**: ${formattedRun.name}
**Run ID**: ${formattedRun.id}
**State**: ${formattedRun.state || 'Not started'}
**Result**: ${formattedRun.result || 'Not available yet'}
**Created**: ${formattedRun.createdDate ? new Date(formattedRun.createdDate).toLocaleString() : 'Unknown'}
**Branch**: ${formattedRun.branch}
**URL**: ${formattedRun.url}
`;

          // Add parameters information if provided
          if (args.parameters && Object.keys(args.parameters).length > 0) {
            responseText += `
## Parameters

`;
            Object.entries(args.parameters).forEach(([key, value]) => {
              responseText += `- **${key}**: ${value}
`;
            });
          }

          // Add variables information if provided
          if (args.variables && Object.keys(args.variables).length > 0) {
            responseText += `
## Variables

`;
            Object.entries(args.variables).forEach(([key, value]) => {
              responseText += `- **${key}**: ${value}
`;
            });
          }

          return {
            content: [
              {
                type: 'text',
                text: responseText,
              },
            ],
          };
        } catch (error: any) {
          console.error('Error running pipeline:', error);
          return {
            content: [
              {
                type: 'text',
                text: `Error running pipeline: ${error.message}`,
              },
            ],
          };
        }
      },
    );
  }
}
