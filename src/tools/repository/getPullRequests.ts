import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import * as azdev from 'azure-devops-node-api';
import { GitPullRequestSearchCriteria, PullRequestStatus } from 'azure-devops-node-api/interfaces/GitInterfaces';
import { z } from 'zod';
import { McpTool } from '../types';
import { AzureDevOpsConfig } from '../../types/config';

/**
 * Tool for getting pull requests from Azure DevOps
 */
export class GetPullRequestsTool implements McpTool {
  public name = 'get_pull_requests';
  public description = 'Get pull requests from Azure DevOps';

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
          .describe(
            'The project containing the pull requests (uses default project if not specified)',
          ),
        repositoryId: z
          .string()
          .optional()
          .describe('The ID of the repository to filter pull requests by'),
        status: z
          .enum(['active', 'abandoned', 'completed', 'all'])
          .optional()
          .describe('The status of pull requests to retrieve (default: active)'),
        creatorId: z
          .string()
          .optional()
          .describe('Filter pull requests by creator ID'),
        reviewerId: z
          .string()
          .optional()
          .describe('Filter pull requests by reviewer ID'),
        limit: z
          .number()
          .optional()
          .describe('Maximum number of pull requests to return (default: 10)'),
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
          const repositoryId = args.repositoryId || config.defaultRepository || '';

          // Get the Git API
          const gitApi = await connection.getGitApi();

          // Map status string to PullRequestStatus enum
          let statusFilter: PullRequestStatus | undefined;
          if (args.status) {
            switch (args.status) {
              case 'active':
                statusFilter = PullRequestStatus.Active;
                break;
              case 'abandoned':
                statusFilter = PullRequestStatus.Abandoned;
                break;
              case 'completed':
                statusFilter = PullRequestStatus.Completed;
                break;
              case 'all':
                statusFilter = undefined;
                break;
            }
          } else {
            // Default to active pull requests
            statusFilter = PullRequestStatus.Active;
          }

          // Set up search criteria
          const searchCriteria: GitPullRequestSearchCriteria = {
            repositoryId: args.repositoryId,
            status: statusFilter,
            creatorId: args.creatorId,
            reviewerId: args.reviewerId,
          };

          // Get pull requests
          const pullRequests = await gitApi.getPullRequests(
            repositoryId,
            searchCriteria,
            project,
            undefined,
            undefined,
            args.limit || 10,
          );

          if (!pullRequests || pullRequests.length === 0) {
            return {
              content: [
                {
                  type: 'text',
                  text: 'No pull requests found matching the criteria.',
                },
              ],
            };
          }

          // Format the pull requests
          const formattedPRs = pullRequests.map((pr) => {
            return {
              id: pr.pullRequestId,
              title: pr.title,
              status: pr.status,
              createdBy: pr.createdBy?.displayName,
              creationDate: pr.creationDate,
              sourceRefName: pr.sourceRefName,
              targetRefName: pr.targetRefName,
              description: pr.description,
              repository: pr.repository?.name,
              url: `${connection.serverUrl}/${project}/_git/${pr.repository?.name}/pullrequest/${pr.pullRequestId}`,
            };
          });

          // Create markdown output
          let markdown = `# Pull Requests\n\n`;
          
          formattedPRs.forEach((pr) => {
            markdown += `## PR #${pr.id}: ${pr.title}\n`;
            markdown += `**Status**: ${pr.status === 1 ? 'Active' : pr.status === 2 ? 'Abandoned' : pr.status === 3 ? 'Completed' : 'Unknown'}\n`;
            markdown += `**Created By**: ${pr.createdBy || 'Unknown'} on ${pr.creationDate ? new Date(pr.creationDate).toLocaleString() : 'Unknown date'}\n`;
            markdown += `**Source**: ${pr.sourceRefName?.replace('refs/heads/', '')}\n`;
            markdown += `**Target**: ${pr.targetRefName?.replace('refs/heads/', '')}\n`;
            markdown += `**Repository**: ${pr.repository || 'Unknown'}\n`;
            markdown += `**URL**: ${pr.url}\n\n`;
            if (pr.description) {
              markdown += `**Description**:\n${pr.description}\n\n`;
            }
            markdown += `---\n\n`;
          });

          return {
            content: [
              {
                type: 'text',
                text: markdown,
              },
            ],
          };
        } catch (error: any) {
          console.error('Error getting pull requests:', error);
          return {
            content: [
              {
                type: 'text',
                text: `Error getting pull requests: ${error.message}`,
              },
            ],
          };
        }
      },
    );
  }
}
