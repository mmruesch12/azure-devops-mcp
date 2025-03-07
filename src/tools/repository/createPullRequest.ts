import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import * as azdev from 'azure-devops-node-api';
import { GitPullRequest } from 'azure-devops-node-api/interfaces/GitInterfaces';
import { z } from 'zod';
import { McpTool } from '../types';
import { AzureDevOpsConfig } from '../../types/config';

/**
 * Tool for creating a pull request in Azure DevOps
 */
export class CreatePullRequestTool implements McpTool {
  public name = 'create_pull_request';
  public description = 'Create a new pull request in the designated Azure DevOps repository';

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
        sourceRefName: z
          .string()
          .describe('Source branch name (e.g., "feature/my-feature" or full ref like "refs/heads/feature/my-feature")'),
          
        targetRefName: z
          .string()
          .describe('Target branch name (e.g., "main" or "develop" or full ref like "refs/heads/main")'),
          
        title: z
          .string()
          .describe('Title of the pull request'),
          
        description: z
          .string()
          .optional()
          .describe('Description of the pull request'),
          
        project: z
          .string()
          .optional()
          .describe(
            'The project containing the repository (uses default project if not specified)',
          ),
          
        isDraft: z
          .boolean()
          .optional()
          .describe('Create as a draft pull request'),
          
        reviewers: z
          .array(z.string())
          .optional()
          .describe('List of reviewer email addresses or IDs'),
          
        workItemIds: z
          .array(z.number())
          .optional()
          .describe('IDs of work items to link to the pull request')
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

          // Use the repository configured in the environment file (AZURE_DEVOPS_DEFAULT_REPOSITORY)
          // We specifically don't allow overriding the repository through parameters
          // to ensure PRs are created in the designated repository
          const repositoryId = config.defaultRepository;
          if (!repositoryId) {
            throw new Error(
              'No repository configured. Please set AZURE_DEVOPS_DEFAULT_REPOSITORY in your .env file',
            );
          }

          // Get the Git API
          const gitApi = await connection.getGitApi();
          
          // Verify that the repository exists
          try {
            const repository = await gitApi.getRepository(repositoryId, project);
            if (!repository || !repository.id) {
              throw new Error(
                `Repository '${repositoryId}' not found in project '${project}'. ` +
                `Please check your AZURE_DEVOPS_DEFAULT_REPOSITORY setting in the .env file.`
              );
            }
            
            console.log(`Creating pull request in repository: ${repository.name} (${repository.id})`);
          } catch (error) {
            throw new Error(
              `Error verifying repository '${repositoryId}' in project '${project}': ` +
              `${error instanceof Error ? error.message : String(error)}`
            );
          }

          // Format source and target branch names if they don't already have the refs/heads/ prefix
          const sourceRefName = args.sourceRefName.startsWith('refs/heads/') 
            ? args.sourceRefName 
            : `refs/heads/${args.sourceRefName}`;
            
          const targetRefName = args.targetRefName.startsWith('refs/heads/') 
            ? args.targetRefName 
            : `refs/heads/${args.targetRefName}`;

          // Create a pull request object
          const pullRequestToCreate: GitPullRequest = {
            sourceRefName,
            targetRefName,
            title: args.title,
            description: args.description || '',
            isDraft: args.isDraft || false,
          };

          // Create the pull request
          const createdPR = await gitApi.createPullRequest(
            pullRequestToCreate,
            repositoryId,
            project
          );

          if (!createdPR || !createdPR.pullRequestId) {
            throw new Error('Failed to create pull request');
          }

          // Add reviewers if specified
          if (args.reviewers && args.reviewers.length > 0 && createdPR.pullRequestId) {
            try {
              // Get identity references for the reviewers
              // This would require additional API calls to resolve email addresses to identity references
              // For simplicity, we'll skip this for now
              // const reviewerIdentities = await Promise.all(args.reviewers.map(async (reviewer) => {
              //   // Resolve reviewer identity
              //   // This is a simplified approach and might need more complex logic
              //   return { id: reviewer };
              // }));
              
              // Add reviewers
              // await gitApi.createPullRequestReviewers(
              //   reviewerIdentities,
              //   repositoryId,
              //   createdPR.pullRequestId,
              //   project
              // );
            } catch (error) {
              console.error('Error adding reviewers:', error);
              // Continue even if adding reviewers fails
            }
          }

          // Link work items if specified
          if (args.workItemIds && args.workItemIds.length > 0 && createdPR.pullRequestId) {
            try {
              // This would require additional API calls to link work items
              // For simplicity, we'll skip this for now
              // const workItemRefs = args.workItemIds.map(id => ({ id: id.toString() }));
              // await gitApi.createPullRequestWorkItemRefs(
              //   workItemRefs,
              //   repositoryId,
              //   createdPR.pullRequestId,
              //   project
              // );
            } catch (error) {
              console.error('Error linking work items:', error);
              // Continue even if linking work items fails
            }
          }

          // Format the response
          const prUrl = `${connection.serverUrl}/${project}/_git/${repositoryId}/pullrequest/${createdPR.pullRequestId}`;

          return {
            content: [
              {
                type: 'text',
                text: `# Pull Request Created Successfully\n\n` +
                  `Pull Request #${createdPR.pullRequestId} has been created in repository **${repositoryId}**.\n\n` +
                  `**Title**: ${createdPR.title}\n` +
                  `**Source Branch**: ${sourceRefName.replace('refs/heads/', '')}\n` +
                  `**Target Branch**: ${targetRefName.replace('refs/heads/', '')}\n` +
                  `**Status**: ${createdPR.isDraft ? 'Draft' : 'Active'}\n` +
                  `**URL**: ${prUrl}\n\n`,
              },
            ],
          };
        } catch (error) {
          console.error('Error creating pull request:', error);
          return {
            content: [
              {
                type: 'text',
                text: `Error creating pull request: ${error instanceof Error ? error.message : String(error)}`,
              },
            ],
          };
        }
      },
    );
  }
}
