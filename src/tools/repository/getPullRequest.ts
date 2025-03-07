import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import * as azdev from 'azure-devops-node-api';
import { GitPullRequest, GitPullRequestCommentThread } from 'azure-devops-node-api/interfaces/GitInterfaces';
import { z } from 'zod';
import { McpTool } from '../types';
import { AzureDevOpsConfig } from '../../types/config';

/**
 * Tool for getting a single pull request from Azure DevOps with detailed information
 */
export class GetPullRequestTool implements McpTool {
  public name = 'get_pull_request';
  public description = 'Get a single pull request by ID with detailed information';

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

          // Get the pull request
          let pullRequest: GitPullRequest;
          
          try {
            // Use the default repository from environment configuration
            pullRequest = await gitApi.getPullRequest(
              repositoryId,
              args.pullRequestId,
              project,
              undefined,
              undefined,
              1, // includeCommits
              true, // includeWorkItemRefs
            );
          } catch (error) {
            // Try to find the pull request in other repositories if not found in the default one
            console.warn(`Pull request #${args.pullRequestId} not found in repository '${repositoryId}'. Searching in other repositories...`);
            
            // First, get repositories in the project
            const repositories = await gitApi.getRepositories(project);
            
            // Look for the pull request in each repository
            let foundPR: GitPullRequest | undefined;
            
            for (const repo of repositories) {
              if (repo.id === repositoryId) {
                // Skip the default repository, we already tried it
                continue;
              }
              
              try {
                const pr = await gitApi.getPullRequest(
                  repo.id!,
                  args.pullRequestId,
                  project,
                  undefined,
                  undefined,
                  1, // includeCommits
                  true, // includeWorkItemRefs
                );
                
                if (pr && pr.pullRequestId === args.pullRequestId) {
                  console.warn(`Found pull request #${args.pullRequestId} in repository '${repo.name}' instead of default repository '${repositoryId}'`);
                  foundPR = pr;
                  break;
                }
              } catch (error) {
                // Continue to next repository if pull request not found
                continue;
              }
            }
            
            if (!foundPR) {
              throw new Error(`Pull request #${args.pullRequestId} not found in project ${project}`);
            }
            
            pullRequest = foundPR;
          }

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

          // Get pull request details
          const reviewers = pullRequest.reviewers || [];
          const commits = pullRequest.commits || [];
          const workItems = pullRequest.workItemRefs || [];
          
          // Get pull request threads (comments)
          // Use getThreads instead of getPullRequestThreads
          let threads: GitPullRequestCommentThread[] = [];
          try {
            // Get threads for the pull request
            if (pullRequest.repository?.id) {
              threads = await gitApi.getThreads(
                pullRequest.repository.id,
                pullRequest.pullRequestId!,
                project
              );
            }
          } catch (error) {
            console.error('Error getting pull request threads:', error);
            // Continue with processing even if we can't get threads
          }

          // Format the pull request
          const formattedPR = {
            id: pullRequest.pullRequestId,
            title: pullRequest.title,
            status: pullRequest.status,
            createdBy: pullRequest.createdBy?.displayName,
            creationDate: pullRequest.creationDate,
            closedDate: pullRequest.closedDate,
            sourceRefName: pullRequest.sourceRefName,
            targetRefName: pullRequest.targetRefName,
            sourceBranch: pullRequest.sourceRefName?.replace('refs/heads/', ''),
            targetBranch: pullRequest.targetRefName?.replace('refs/heads/', ''),
            description: pullRequest.description,
            repository: pullRequest.repository?.name,
            isDraft: pullRequest.isDraft,
            mergeStatus: pullRequest.mergeStatus,
            autoCompleteSetBy: pullRequest.autoCompleteSetBy?.displayName,
            lastMergeCommit: pullRequest.lastMergeCommit?.commitId,
            url: `${connection.serverUrl}/${project}/_git/${pullRequest.repository?.name}/pullrequest/${pullRequest.pullRequestId}`,
          };

          // Create markdown output
          let markdown = `# Pull Request #${formattedPR.id}: ${formattedPR.title}\n\n`;
          
          // Basic information
          markdown += `**Status**: ${formattedPR.status === 1 ? 'Active' : formattedPR.status === 2 ? 'Abandoned' : formattedPR.status === 3 ? 'Completed' : 'Unknown'}${formattedPR.isDraft ? ' (Draft)' : ''}\n`;
          markdown += `**Created By**: ${formattedPR.createdBy || 'Unknown'} on ${formattedPR.creationDate ? new Date(formattedPR.creationDate).toLocaleString() : 'Unknown date'}\n`;
          
          if (formattedPR.closedDate) {
            markdown += `**Closed On**: ${new Date(formattedPR.closedDate).toLocaleString()}\n`;
          }
          
          markdown += `**Source Branch**: ${formattedPR.sourceBranch}\n`;
          markdown += `**Target Branch**: ${formattedPR.targetBranch}\n`;
          markdown += `**Repository**: ${formattedPR.repository || 'Unknown'}\n`;
          
          if (formattedPR.mergeStatus) {
            markdown += `**Merge Status**: ${formattedPR.mergeStatus}\n`;
          }
          
          if (formattedPR.autoCompleteSetBy) {
            markdown += `**Auto-Complete Set By**: ${formattedPR.autoCompleteSetBy}\n`;
          }
          
          if (formattedPR.lastMergeCommit) {
            markdown += `**Last Merge Commit**: ${formattedPR.lastMergeCommit}\n`;
          }
          
          markdown += `**URL**: ${formattedPR.url}\n\n`;
          
          // Description
          if (formattedPR.description) {
            markdown += `## Description\n\n${formattedPR.description}\n\n`;
          }
          
          // Reviewers
          if (reviewers.length > 0) {
            markdown += `## Reviewers\n\n`;
            reviewers.forEach((reviewer) => {
              const vote = reviewer.vote;
              let voteText = '⬜ Not voted';
              if (vote === 10) voteText = '✅ Approved';
              if (vote === 5) voteText = '✅ Approved with suggestions';
              if (vote === -5) voteText = '⚠️ Waiting for author';
              if (vote === -10) voteText = '❌ Rejected';
              
              markdown += `- ${reviewer.displayName} (${voteText})\n`;
            });
            markdown += `\n`;
          }
          
          // Commits
          if (commits.length > 0) {
            markdown += `## Commits\n\n`;
            commits.forEach((commit) => {
              const author = commit.author?.name || 'Unknown';
              const message = commit.comment || 'No message';
              const date = commit.author?.date ? new Date(commit.author.date).toLocaleString() : 'Unknown date';
              const id = commit.commitId?.slice(0, 8) || 'Unknown';
              
              markdown += `- ${message} (${author}, ${date}, ${id})\n`;
            });
            markdown += `\n`;
          }
          
          // Work Items
          if (workItems.length > 0) {
            markdown += `## Work Items\n\n`;
            workItems.forEach((workItem) => {
              const id = workItem.id;
              const url = workItem.url;
              markdown += `- [Work Item #${id}](${url})\n`;
            });
            markdown += `\n`;
          }
          
          // Threads (Comments)
          if (threads.length > 0) {
            markdown += `## Comments\n\n`;
            
            threads.forEach((thread) => {
              if (!thread.comments || thread.comments.length === 0) return;
              
              // Skip system messages
              if (thread.comments[0].commentType === 1) return;
              
              const fileName = thread.threadContext?.filePath || 'General';
              const lineNumber = thread.threadContext?.rightFileStart?.line || '';
              const filePosition = lineNumber ? ` (Line ${lineNumber})` : '';
              
              markdown += `### ${fileName}${filePosition}\n\n`;
              
              thread.comments?.forEach((comment) => {
                const author = comment.author?.displayName || 'Unknown';
                const date = comment.publishedDate ? new Date(comment.publishedDate).toLocaleString() : 'Unknown date';
                const content = comment.content || 'No content';
                
                markdown += `**${author}** (${date}):\n${content}\n\n`;
              });
              
              // Thread status
              if (thread.status) {
                let statusText = '';
                if (thread.status === 1) statusText = 'Active';
                if (thread.status === 2) statusText = 'Fixed';
                if (thread.status === 3) statusText = 'Won\'t Fix';
                if (thread.status === 4) statusText = 'Closed';
                if (thread.status === 5) statusText = 'By Design';
                if (thread.status === 6) statusText = 'Pending';
                
                markdown += `*Status: ${statusText}*\n\n`;
              }
              
              markdown += `---\n\n`;
            });
          }

          return {
            content: [
              {
                type: 'text',
                text: markdown,
              },
            ],
          };
        } catch (error) {
          console.error('Error getting pull request:', error);
          return {
            content: [
              {
                type: 'text',
                text: `Error getting pull request: ${error instanceof Error ? error.message : String(error)}`,
              },
            ],
          };
        }
      },
    );
  }
}
