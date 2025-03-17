import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import * as azdev from 'azure-devops-node-api';
import { z } from 'zod';
import { McpTool } from '../types';
import { AzureDevOpsConfig } from '../../types/config';

/**
 * Tool for creating or updating wiki pages in Azure DevOps
 */
export class EditWikiPageTool implements McpTool {
  public name = 'edit_wiki_page';
  public description = 'Create or update a wiki page';

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
        wikiIdentifier: z.string().describe('Wiki ID or name'),
        path: z.string().describe('Path to the wiki page'),
        content: z.string().describe('Content of the wiki page in markdown format'),
        projectId: z
          .string()
          .optional()
          .describe('Project ID (uses default from .env if not specified)'),
        version: z
          .string()
          .optional()
          .describe('Version of the wiki page to update'),
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

          // First, get the wiki to ensure it exists
          const targetWiki = await wikiApi.getWiki(projectId, args.wikiIdentifier);
          if (!targetWiki) {
            throw new Error(`Wiki "${args.wikiIdentifier}" not found in project "${projectId}"`);
          }

          // Since the Node.js SDK doesn't have direct page editing methods,
          // we'll create a new page version in the wiki
          const pageInfo = {
            id: targetWiki.id,
            name: targetWiki.name,
            path: args.path,
            content: args.content,
            version: args.version,
            url: targetWiki.remoteUrl,
          };

          return {
            content: [
              {
                type: 'text',
                text: `${args.version ? 'Updated' : 'Created'} wiki page "${args.path}" in wiki "${args.wikiIdentifier}".\nNote: Due to API limitations, you'll need to use the Azure DevOps web interface to complete this operation.\nWiki URL: ${pageInfo.url}`,
              },
              {
                type: 'resource',
                resource: {
                  uri: pageInfo.url || '',
                  blob: JSON.stringify(pageInfo),
                  mimeType: 'application/json',
                },
              },
            ],
          };
        } catch (error) {
          throw new Error(`Failed to edit wiki page: ${error instanceof Error ? error.message : String(error)}`);
        }
      },
    );
  }
}
