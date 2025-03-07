import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import * as azdev from 'azure-devops-node-api';
import { z } from 'zod';
import { McpTool } from '../types';
import { AzureDevOpsConfig } from '../../types/config';

/**
 * Tool for listing repositories in Azure DevOps
 */
export class ListRepositoriesTool implements McpTool {
  public name = 'list_repositories';
  public description = 'List all repositories';

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
        project: z
          .string()
          .optional()
          .describe('The project to list repositories from (uses default project if not specified)'),
      },
      async (args, _extras) => {
        try {
          if (!connection) {
            throw new Error('No connection to Azure DevOps');
          }

          // Use provided project or fall back to default project
          const project = args.project || config.defaultProject;

          // Get the Git API
          const gitApi = await connection.getGitApi();

          // Fetch repositories, optionally filtered by project
          const repositories = await gitApi.getRepositories(project);

          if (!repositories || repositories.length === 0) {
            return {
              content: [
                {
                  type: 'text',
                  text: project
                    ? `No repositories found in project '${project}'.`
                    : 'No repositories found in this organization.',
                },
              ],
            };
          }

          // Format the repositories list
          const formattedRepositories = repositories.map((repo) => {
            return {
              id: repo.id,
              name: repo.name,
              project: {
                id: repo.project?.id,
                name: repo.project?.name,
              },
              defaultBranch: repo.defaultBranch,
              size: repo.size,
              remoteUrl: repo.remoteUrl,
              webUrl: repo.webUrl,
              isDisabled: repo.isDisabled,
            };
          });

          // Highlight the default repository if it exists
          const defaultRepoIndex = formattedRepositories.findIndex(
            (repo) => repo.id === config.defaultRepository || repo.name === config.defaultRepository
          );

          let markdownOutput = project
            ? `# Repositories in project '${project}'\n\n`
            : '# All repositories in the organization\n\n';

          // Add a note about the default repository
          if (config.defaultRepository) {
            if (defaultRepoIndex >= 0) {
              markdownOutput += `Default repository: **${formattedRepositories[defaultRepoIndex].name}** (configured in .env)\n\n`;
            } else {
              markdownOutput += `Note: Default repository '${config.defaultRepository}' configured in .env not found in the results.\n\n`;
            }
          }

          // Format repositories as markdown table
          markdownOutput += `| Name | ID | Default Branch | Web URL |\n`;
          markdownOutput += `| ---- | -- | -------------- | ------- |\n`;

          formattedRepositories.forEach((repo, index) => {
            const isDefault = index === defaultRepoIndex;
            const name = isDefault ? `**${repo.name}** (Default)` : repo.name;
            markdownOutput += `| ${name} | ${repo.id} | ${repo.defaultBranch || 'N/A'} | [View](${repo.webUrl}) |\n`;
          });

          return {
            content: [
              {
                type: 'text',
                text: markdownOutput,
              },
            ],
          };
        } catch (error: unknown) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          return {
            content: [
              {
                type: 'text',
                text: `Error listing repositories: ${errorMessage}`,
              },
            ],
          };
        }
      },
    );
  }
}
