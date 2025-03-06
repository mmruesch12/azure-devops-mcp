import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import * as azdev from 'azure-devops-node-api';
import { z } from 'zod';
import { McpTool } from '../types';

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
   */
  public register(server: McpServer, connection: azdev.WebApi | null): void {
    server.tool(
      this.name,
      {
        project: z
          .string()
          .optional()
          .describe('The project to list repositories from'),
      },
      async (args, _extras) => {
        try {
          if (!connection) {
            throw new Error('No connection to Azure DevOps');
          }

          // Get the Git API
          const gitApi = await connection.getGitApi();

          // Fetch repositories, optionally filtered by project
          const repositories = await gitApi.getRepositories(args.project);
          console.log('repositories', repositories);

          if (!repositories || repositories.length === 0) {
            return {
              content: [
                {
                  type: 'text',
                  text: args.project
                    ? `No repositories found in project '${args.project}'.`
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

          return {
            content: [
              {
                type: 'text',
                text: args.project
                  ? `Repositories in project '${args.project}':`
                  : 'All repositories in the organization:',
              },
              {
                type: 'text',
                text: JSON.stringify(formattedRepositories, null, 2),
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
