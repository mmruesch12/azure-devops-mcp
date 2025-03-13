import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import * as azdev from 'azure-devops-node-api';
import { McpTool } from '../types';

/**
 * Tool for listing all projects in Azure DevOps
 */
export class ListProjectsTool implements McpTool {
  public name = 'list_projects';
  public description = 'List all projects';

  /**
   * Register the tool with the MCP server
   *
   * @param server The MCP server
   * @param connection The Azure DevOps connection
   */
  public register(server: McpServer, connection: azdev.WebApi | null): void {
    server.tool(this.name, {}, async (_args: unknown, _extras: unknown) => {
      try {
        if (!connection) {
          throw new Error('No connection to Azure DevOps');
        }

        // Get the Core API
        const coreApi = await connection.getCoreApi();

        // Fetch the projects
        const projects = await coreApi.getProjects();

        if (!projects || projects.length === 0) {
          return {
            content: [
              {
                type: 'text',
                text: 'No projects found in this organization.',
              },
            ],
          };
        }

        // Format the projects list
        const formattedProjects = projects.map((project) => {
          return {
            id: project.id,
            name: project.name,
            description: project.description,
            state: project.state,
            visibility: project.visibility,
            lastUpdateTime: project.lastUpdateTime,
            url: project.url,
          };
        });

        return {
          content: [
            {
              type: 'text',
              text: `# Projects\n\nFound ${projects.length} projects in this organization:\n\n${formattedProjects
                .map(
                  (p) =>
                    `## ${p.name}\n**ID**: ${p.id}\n**Description**: ${
                      p.description || 'No description'
                    }\n**State**: ${p.state}\n**Visibility**: ${
                      p.visibility
                    }\n**Last Updated**: ${
                      p.lastUpdateTime
                        ? new Date(p.lastUpdateTime).toLocaleString()
                        : 'Unknown'
                    }\n**URL**: ${p.url || 'N/A'}\n`,
                )
                .join('\n')}`,
            },
          ],
        };
      } catch (error: any) {
        console.error('Error fetching projects:', error);
        return {
          content: [
            {
              type: 'text',
              text: `Error fetching projects: ${error.message}`,
            },
          ],
        };
      }
    });
  }
}
