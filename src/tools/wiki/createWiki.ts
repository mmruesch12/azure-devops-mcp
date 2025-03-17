import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import * as azdev from 'azure-devops-node-api';
import * as wiki from 'azure-devops-node-api/interfaces/WikiInterfaces';
import { z } from 'zod';
import { McpTool } from '../types';
import { AzureDevOpsConfig } from '../../types/config';

/**
 * Tool for creating a wiki in Azure DevOps
 */
export class CreateWikiTool implements McpTool {
  public name = 'create_wiki';
  public description = 'Create a new wiki';

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
        name: z.string().describe('Name of the wiki'),
        projectId: z
          .string()
          .optional()
          .describe('Project ID (uses default from .env if not specified)'),
        repositoryId: z
          .string()
          .optional()
          .describe('Repository ID for code wiki (if not specified, creates project wiki)'),
        mappedPath: z
          .string()
          .optional()
          .describe('Root path for code wiki (default: /)'),
      },
      async (args, _extras) => {
        try {
          if (!connection) {
            throw new Error('No connection to Azure DevOps');
          }

          const wikiApi = await connection.getWikiApi();
          const projectId = args.projectId || config.defaultProject;
          if (!projectId) {
            throw new Error('No project specified and no default project configured');
          }

          const wikiParams: wiki.WikiCreateParametersV2 = {
            name: args.name,
            projectId,
            type: args.repositoryId ? wiki.WikiType.CodeWiki : wiki.WikiType.ProjectWiki,
            repositoryId: args.repositoryId,
            mappedPath: args.mappedPath || '/',
          };

          const createdWiki = await wikiApi.createWiki(wikiParams, projectId);
          
          return {
            content: [
              {
                type: 'text',
                text: `Created wiki "${createdWiki.name}" (${createdWiki.type === wiki.WikiType.CodeWiki ? 'Code Wiki' : 'Project Wiki'})`,
              },
              {
                type: 'resource',
                resource: {
                  uri: createdWiki.remoteUrl || '',
                  blob: JSON.stringify({
                    id: createdWiki.id,
                    name: createdWiki.name,
                    type: createdWiki.type === wiki.WikiType.CodeWiki ? 'Code Wiki' : 'Project Wiki',
                    projectId: createdWiki.projectId,
                    repositoryId: createdWiki.repositoryId,
                  }),
                  mimeType: 'application/json',
                },
              },
            ],
          };
        } catch (error) {
          throw new Error(`Failed to create wiki: ${error instanceof Error ? error.message : String(error)}`);
        }
      },
    );
  }
}
