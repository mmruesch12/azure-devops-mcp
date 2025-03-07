import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import * as azdev from 'azure-devops-node-api';
import { z } from 'zod';
import { McpTool } from '../types';
import { AzureDevOpsConfig } from '../../types/config';

/**
 * Tool for getting a pipeline from Azure DevOps
 */
export class GetPipelineTool implements McpTool {
  public name = 'get_pipeline';
  public description = 'Get a pipeline by ID';

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
        pipelineId: z.number().describe('The ID of the pipeline'),
        project: z
          .string()
          .optional()
          .describe(
            'The project containing the pipeline (uses default project if not specified)',
          ),
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
          console.log(`Getting pipeline ${args.pipelineId} in project ${project}`);
          
          // Get the pipeline
          const pipeline = await pipelinesApi.getPipeline(project, args.pipelineId);
          console.log('pipeline', pipeline);

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

          // Format the pipeline
          const formattedPipeline = {
            id: pipeline.id,
            name: pipeline.name,
            revision: pipeline.revision,
            folder: pipeline.folder,
            url: pipeline.url,
            configuration: pipeline.configuration?.type || 'Unknown',
          };

          // Build the response
          let responseText = `# Pipeline ${formattedPipeline.id}: ${formattedPipeline.name}

**Folder**: ${formattedPipeline.folder || 'Root'}
**Configuration Type**: ${formattedPipeline.configuration}
**Revision**: ${formattedPipeline.revision || 'Not specified'}
**URL**: ${formattedPipeline.url}
`;

          // Get pipeline runs if available
          try {
            const runs = await pipelinesApi.listRuns(project, args.pipelineId);
            
            if (runs && runs.length > 0) {
              responseText += `
## Recent Runs

`;
              
              // Display the 5 most recent runs
              const recentRuns = runs.slice(0, 5);
              for (const run of recentRuns) {
                const runDate = run.createdDate ? new Date(run.createdDate).toLocaleString() : 'Unknown';
                const runStatus = run.state || 'Unknown';
                const runResult = run.result || 'Not available';
                
                responseText += `- **Run ${run.name}**: ${runStatus} (${runResult}) - Created: ${runDate}\n`;
              }
            }
          } catch (error) {
            console.log('Error getting pipeline runs:', error);
            // Continue without runs information
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
          console.error('Error getting pipeline:', error);
          return {
            content: [
              {
                type: 'text',
                text: `Error getting pipeline: ${error.message}`,
              },
            ],
          };
        }
      },
    );
  }
}
