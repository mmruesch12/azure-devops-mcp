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
        includeYaml: z
          .boolean()
          .optional()
          .describe('Whether to include the YAML content of the pipeline'),
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
            configuration: pipeline.configuration ? String(pipeline.configuration.type) : 'Unknown',
          };

          // Build the response
          let responseText = `# Pipeline ${formattedPipeline.id}: ${formattedPipeline.name}\n\n**Folder**: ${formattedPipeline.folder || 'Root'}\n**Configuration Type**: ${formattedPipeline.configuration}\n**Revision**: ${formattedPipeline.revision || 'Not specified'}\n**URL**: ${formattedPipeline.url}\n`;

          // Get pipeline runs if available
          try {
            const runs = await pipelinesApi.listRuns(project, args.pipelineId);
            
            if (runs && runs.length > 0) {
              responseText += `\n## Recent Runs\n\n`;
              
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

          // Get YAML content and extract parameters if requested
          if (args.includeYaml) {
            try {
              // Get the Git API to access the repository
              const gitApi = await connection.getGitApi();
              
              // Get the pipeline details
              const pipelineDetails = await pipelinesApi.getPipeline(project, args.pipelineId);
              
              // Check if this is a YAML pipeline by checking if configuration type is a string that equals 'yaml'
              if (pipelineDetails && pipelineDetails.configuration) {
                const configType = String(pipelineDetails.configuration.type).toLowerCase();
                if (configType === 'yaml') {
                  // For YAML pipelines, try to get the YAML content
                  // Safely access properties using type assertions
                  const config = pipelineDetails.configuration as any;
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
                        
                        const parameters = [];
                        for (const match of parameterMatches) {
                          parameters.push({
                            name: match[1]?.trim(),
                            type: match[2]?.trim() || 'string',
                            default: match[3]?.trim() || '',
                            displayName: match[4]?.trim() || match[1]?.trim()
                          });
                        }
                        
                        if (parameters.length > 0) {
                          responseText += `\n## Pipeline Parameters\n\n`;
                          
                          for (const param of parameters) {
                            responseText += `- **${param.name}** (${param.type}): ${param.displayName}\n  Default: ${param.default || 'None'}\n`;
                          }
                          
                          // Add example of how to run with parameters
                          const exampleCode = `run_pipeline({\n  pipelineId: ${args.pipelineId},\n  project: "${project}",\n  parameters: {`;

                          let parametersList = '';
                          for (const param of parameters) {
                            parametersList += `\n    ${param.name}: "${param.default || ''}", // ${param.displayName}`;
                          }

                          responseText += `\n### Example Usage with Parameters\n\n\`\`\`\n${exampleCode}${parametersList}\n  }\n});\n\`\`\`\n`;
                        }
                      }
                      
                      // Include full YAML content if it's not too long
                      if (yamlContent.length < 5000) {
                        responseText += `\n## Pipeline YAML\n\n\`\`\`yaml\n${yamlContent}\n\`\`\`\n`;
                      } else {
                        responseText += `\n## Pipeline YAML\n\nYAML content is too long to display in full (${yamlContent.length} characters). Here's the beginning:\n\n\`\`\`yaml\n${yamlContent.substring(0, 1000)}...\n\`\`\`\n`;
                      }
                    }
                  }
                }
              }
            } catch (error: any) {
              console.log('Error getting YAML content:', error);
              responseText += `\n## Pipeline YAML\n\nFailed to retrieve YAML content: ${error.message || 'Unknown error'}\n`;
            }
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
