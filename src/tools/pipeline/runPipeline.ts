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
          .describe('Key-value pairs of pipeline parameters defined in the YAML file'),
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

          // Check if this is a YAML pipeline and get parameter details if possible
          let yamlParameters = [];
          if (pipeline.configuration) {
            const configType = String(pipeline.configuration.type).toLowerCase();
            if (configType === 'yaml') {
              try {
                // Get the Git API to access the repository
                const gitApi = await connection.getGitApi();
                
                // Get the pipeline details to find the YAML file path
                const pipelineDetails = await pipelinesApi.getPipeline(project, args.pipelineId);
                
                // Safely access configuration properties using type assertion
                const config = pipelineDetails?.configuration as any;
                if (pipelineDetails && config && config.path) {
                  const yamlFilePath = config.path;
                  const repoId = config.repository?.id;
                  
                  if (yamlFilePath && repoId) {
                    // Get the YAML content from the repository
                    const fileContent = await gitApi.getItemContent(repoId, yamlFilePath);
                    
                    if (fileContent) {
                      // Convert buffer to string - handle the ReadableStream type
                      const buffer = await streamToBuffer(fileContent as any);
                      const yamlContent = buffer.toString('utf8');
                      
                      // Extract parameters section from YAML
                      const parametersMatch = yamlContent.match(/parameters:\s*([\s\S]*?)(?=\n\w|$)/m);
                      
                      if (parametersMatch && parametersMatch[1]) {
                        const parametersSection = parametersMatch[1];
                        
                        // Parse parameters section to extract parameter details
                        const parameterMatches = parametersSection.matchAll(/\s*-\s*name:\s*([^\n]+)[\s\S]*?(?:type:\s*([^\n]+))?[\s\S]*?(?:default:\s*([^\n]+))?[\s\S]*?(?:displayName:\s*([^\n]+))?/g);
                        
                        for (const match of parameterMatches) {
                          yamlParameters.push({
                            name: match[1]?.trim(),
                            type: match[2]?.trim() || 'string',
                            default: match[3]?.trim() || '',
                            displayName: match[4]?.trim() || match[1]?.trim()
                          });
                        }
                      }
                    }
                  }
                }
              } catch (error) {
                console.log('Error getting YAML parameters:', error);
                // Continue without parameter information
              }
            }
          }

          // Validate that all required parameters are provided
          if (yamlParameters.length > 0) {
            const missingParams = yamlParameters.filter(param => {
              // A parameter is considered required if it has no default value
              const isRequired = !param.default && param.default !== '';
              const isProvided = args.parameters && args.parameters[param.name] !== undefined;
              return isRequired && !isProvided;
            });
            
            if (missingParams.length > 0) {
              return {
                content: [
                  {
                    type: 'text',
                    text: `Error: Missing required parameters: ${missingParams.map(p => p.name).join(', ')}\n\nPlease provide values for these parameters when running the pipeline.`,
                  },
                ],
              };
            }
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
          let responseText = `# Pipeline Run Started\n\n**Pipeline**: ${pipeline.name} (ID: ${args.pipelineId})\n**Run Name**: ${formattedRun.name}\n**Run ID**: ${formattedRun.id}\n**State**: ${formattedRun.state || 'Not started'}\n**Result**: ${formattedRun.result || 'Not available yet'}\n**Created**: ${formattedRun.createdDate ? new Date(formattedRun.createdDate).toLocaleString() : 'Unknown'}\n**Branch**: ${formattedRun.branch}\n**URL**: ${formattedRun.url}\n`;

          // Add parameters information if provided
          if (args.parameters && Object.keys(args.parameters).length > 0) {
            responseText += `\n## Parameters\n\n`;
            Object.entries(args.parameters).forEach(([key, value]) => {
              // Find the parameter definition if available
              const paramDef = yamlParameters.find(p => p.name === key);
              const displayName = paramDef ? paramDef.displayName : key;
              
              responseText += `- **${key}**: ${value}${displayName !== key ? ` (${displayName})` : ''}\n`;
            });
          }

          // Add variables information if provided
          if (args.variables && Object.keys(args.variables).length > 0) {
            responseText += `\n## Variables\n\n`;
            Object.entries(args.variables).forEach(([key, value]) => {
              responseText += `- **${key}**: ${value}\n`;
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

/**
 * Helper function to convert a ReadableStream to a Buffer
 */
async function streamToBuffer(stream: any): Promise<Buffer> {
  // If it's already a Buffer, return it directly
  if (Buffer.isBuffer(stream)) {
    return stream;
  }
  
  // If it's a string, convert to Buffer
  if (typeof stream === 'string') {
    return Buffer.from(stream);
  }
  
  // If it's a ReadableStream, read it into a Buffer
  if (stream && typeof stream.on === 'function') {
    return new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];
      stream.on('data', (chunk: Buffer) => chunks.push(chunk));
      stream.on('end', () => resolve(Buffer.concat(chunks)));
      stream.on('error', reject);
    });
  }
  
  // If it's an ArrayBuffer or ArrayBufferView, convert to Buffer
  if (stream instanceof ArrayBuffer || ArrayBuffer.isView(stream)) {
    return Buffer.from(new Uint8Array(stream instanceof ArrayBuffer ? stream : stream.buffer));
  }
  
  // Default fallback
  return Buffer.from(String(stream));
}
