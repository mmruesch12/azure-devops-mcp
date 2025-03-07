import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import * as azdev from 'azure-devops-node-api';
import { VersionControlChangeType } from 'azure-devops-node-api/interfaces/GitInterfaces';
import { z } from 'zod';
import { McpTool } from '../types';
import { AzureDevOpsConfig } from '../../types/config';

/**
 * Tool for getting the diff of a pull request in Azure DevOps
 */
export class GetPullRequestDiffTool implements McpTool {
  public name = 'get_pull_request_diff';
  public description = 'Get the diff of a pull request';

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
        pullRequestId: z.number().describe('The ID of the pull request'),
        project: z
          .string()
          .optional()
          .describe(
            'The project containing the pull request (uses default project if not specified)',
          ),
        top: z
          .number()
          .optional()
          .describe('Maximum number of changes to return (default: 100)'),
        skip: z
          .number()
          .optional()
          .describe('Number of changes to skip (default: 0)'),
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

          // Use the repository from the environment configuration
          const repositoryId = config.defaultRepository;
          if (!repositoryId) {
            throw new Error(
              'No default repository configured. Please set AZURE_DEVOPS_DEFAULT_REPOSITORY in your .env file',
            );
          }

          // Get the Git API
          const gitApi = await connection.getGitApi();

          // First, get the pull request to access source and target branches
          const pullRequest = await gitApi.getPullRequest(
            repositoryId,
            args.pullRequestId,
            project,
          );


          if (!pullRequest) {
            return {
              content: [
                {
                  type: 'text',
                  text: `Pull request #${args.pullRequestId} not found.`,
                },
              ],
            };
          }

          console.log('fetching PR diff')
          // Get the pull request diff
          const pullRequestDiff = await gitApi.getPullRequestIterationChanges(
            repositoryId,
            args.pullRequestId,
            0, // Use the latest iteration
            project,
          );

          console.log('pullRequestDiff', pullRequestDiff);

          if (!pullRequestDiff || !pullRequestDiff.changeEntries || pullRequestDiff.changeEntries.length === 0) {
            return {
              content: [
                {
                  type: 'text',
                  text: `No changes found in pull request #${args.pullRequestId}.`,
                },
              ],
            };
          }

          // Format the diff information
          const sourceRef = pullRequest.sourceRefName || '';
          const targetRef = pullRequest.targetRefName || '';
          
          let markdownOutput = `# Pull Request #${args.pullRequestId} Diff\n\n`;
          markdownOutput += `Comparing changes between ${sourceRef} \u2192 ${targetRef}\n\n`;
          markdownOutput += `Total changes: ${pullRequestDiff.changeEntries.length}\n\n`;

          // Group changes by change type
          const additions = pullRequestDiff.changeEntries.filter(change => change.changeType === VersionControlChangeType.Add);
          const edits = pullRequestDiff.changeEntries.filter(change => change.changeType === VersionControlChangeType.Edit);
          const deletes = pullRequestDiff.changeEntries.filter(change => change.changeType === VersionControlChangeType.Delete);
          const renames = pullRequestDiff.changeEntries.filter(change => change.changeType === VersionControlChangeType.Rename);

          // Summary of changes
          markdownOutput += `## Summary\n\n`;
          markdownOutput += `- Added: ${additions.length} files\n`;
          markdownOutput += `- Modified: ${edits.length} files\n`;
          markdownOutput += `- Deleted: ${deletes.length} files\n`;
          markdownOutput += `- Renamed: ${renames.length} files\n\n`;

          // List all changes
          markdownOutput += `## Changed Files\n\n`;
          markdownOutput += `| Change Type | Path | View in Browser |\n`;
          markdownOutput += `|------------|------|-----------------|\n`;

          // Process each change entry
          for (const change of pullRequestDiff.changeEntries) {
            const changeType = this.formatChangeType(change.changeType);
            const path = change.item?.path || '';
            
            // Create a link to view the file in the browser
            let viewLink = '';
            if (pullRequest.repository?.webUrl && path) {
              const encodedPath = encodeURIComponent(path);
              viewLink = `[View](${pullRequest.repository.webUrl}/commit/${pullRequest.lastMergeSourceCommit?.commitId}?path=${encodedPath}&_a=contents)`;
            }
            
            markdownOutput += `| ${changeType} | \`${path}\` | ${viewLink} |\n`;
          }

          // Add link to view the full diff in the browser
          if (pullRequest.repository?.webUrl) {
            markdownOutput += `\n\n[View full diff in browser](${pullRequest.repository.webUrl}/pullrequest/${pullRequest.pullRequestId}?_a=files)\n`;
          }

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
                text: `Error getting pull request diff: ${errorMessage}`,
              },
            ],
          };
        }
      },
    );
  }

  /**
   * Format the change type for display
   * 
   * @param changeType The change type from the API
   * @returns Formatted change type string
   */
  private formatChangeType(changeType: VersionControlChangeType | undefined): string {
    if (changeType === undefined) return 'Unknown';
    
    switch (changeType) {
      case VersionControlChangeType.Add:
        return '\u2795 Added';
      case VersionControlChangeType.Edit:
        return '\u270F\uFE0F Modified';
      case VersionControlChangeType.Delete:
        return '\uD83D\uDDD1\uFE0F Deleted';
      case VersionControlChangeType.Rename:
        return '\uD83D\uDD04 Renamed';
      default:
        return String(changeType);
    }
  }
}
