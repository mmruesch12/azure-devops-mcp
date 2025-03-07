import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import * as azdev from 'azure-devops-node-api';
import { z } from 'zod';
import { McpTool } from '../types';
import { AzureDevOpsConfig } from '../../types/config';

/**
 * Tool for getting repository details from Azure DevOps
 */
export class GetRepositoryTool implements McpTool {
  public name = 'get_repository';
  public description = 'Get repository details';

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
        repositoryId: z
          .string()
          .optional()
          .describe('The ID or name of the repository (uses default repository if not specified)'),
        project: z
          .string()
          .optional()
          .describe('The project containing the repository (uses default project if not specified)'),
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

          // Use provided repository ID or fall back to default repository
          const repositoryId = args.repositoryId || config.defaultRepository;
          if (!repositoryId) {
            throw new Error(
              'No repository specified and no default repository configured',
            );
          }

          // Get the Git API
          const gitApi = await connection.getGitApi();

          // Fetch the repository details
          let repository;

          try {
            // First try to get by ID (if it's a valid GUID)
            repository = await gitApi.getRepository(
              repositoryId,
              project,
            );
          } catch (error) {
            // If that fails, try to find by name
            const repositories = await gitApi.getRepositories(project);
            repository = repositories.find(
              (repo) =>
                repo.name?.toLowerCase() === repositoryId.toLowerCase(),
            );

            if (!repository) {
              throw new Error(
                `Repository '${repositoryId}' not found${project ? ` in project '${project}'` : ''}`,
              );
            }
          }

          // Get additional repository information
          const repoId = repository.id || '';
          const refs = await gitApi.getRefs(repoId);

          // Format the repository details
          const formattedRepository = {
            id: repository.id,
            name: repository.name,
            project: {
              id: repository.project?.id,
              name: repository.project?.name,
            },
            defaultBranch: repository.defaultBranch,
            size: repository.size,
            remoteUrl: repository.remoteUrl,
            webUrl: repository.webUrl,
            isDisabled: repository.isDisabled,
            isInMaintenance: repository.isInMaintenance,
            branches: refs
              .filter((ref) => ref.name?.startsWith('refs/heads/'))
              .map((ref) => ({
                name: ref.name?.replace('refs/heads/', ''),
                objectId: ref.objectId,
                creator: ref.creator,
                url: ref.url,
              })),
          };

          return {
            content: [
              {
                type: 'text',
                text: `Repository details for '${repository.name}':`,
              },
              {
                type: 'text',
                text: JSON.stringify(formattedRepository, null, 2),
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
                text: `Error retrieving repository: ${errorMessage}`,
              },
            ],
          };
        }
      },
    );
  }
}
