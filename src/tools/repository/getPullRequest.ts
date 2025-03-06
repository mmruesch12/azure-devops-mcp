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
        repositoryId: z
          .string()
          .optional()
          .describe('The ID of the repository containing the pull request'),
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

          // Get the Git API
          const gitApi = await connection.getGitApi();

          // Get the pull request
          let pullRequest: GitPullRequest;
          
          if (args.repositoryId || config.defaultRepository) {
            // If repository ID is provided or we have a default repository, use it
            const repoId = args.repositoryId || config.defaultRepository || '';
            pullRequest = await gitApi.getPullRequest(
              repoId,
              args.pullRequestId,
              project,
              undefined,
              undefined,
              1, // includeCommits
              true, // includeWorkItemRefs
            );
          } else {
            // Try to find the pull request without repository ID
            // First, get repositories in the project
            const repositories = await gitApi.getRepositories(project);
            
            // Look for the pull request in each repository
            let foundPR: GitPullRequest | undefined;
            
            for (const repo of repositories) {
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
            
            reviewers.forEach(reviewer => {
              const voteLabel = reviewer.vote === 10 ? '✅ Approved' : 
                               reviewer.vote === 5 ? '👍 Approved with suggestions' :
                               reviewer.vote === 0 ? '⏱️ No vote' :
                               reviewer.vote === -5 ? '🔍 Waiting for author' :
                               reviewer.vote === -10 ? '❌ Rejected' : 'Unknown';
              
              markdown += `- **${reviewer.displayName}**: ${voteLabel}\n`;
            });
            
            markdown += `\n`;
          }
          
          // Commits
          if (commits.length > 0) {
            markdown += `## Commits (${commits.length})\n\n`;
            
            commits.forEach(commit => {
              const authorDate = commit.author?.date ? new Date(commit.author.date).toLocaleString() : 'Unknown date';
              markdown += `- **${commit.commitId?.substring(0, 8)}**: ${commit.comment} by ${commit.author?.name || 'Unknown'} on ${authorDate}\n`;
            });
            
            markdown += `\n`;
          }
          
          // Work Items
          if (workItems.length > 0) {
            markdown += `## Work Items (${workItems.length})\n\n`;
            
            workItems.forEach(workItem => {
              const id = workItem.id;
              const url = workItem.url;
              markdown += `- [Work Item #${id}](${url})\n`;
            });
            
            markdown += `\n`;
          }
          
          // Comments
          if (threads && threads.length > 0) {
            const commentThreads = threads.filter((thread: GitPullRequestCommentThread) => 
              thread.comments && thread.comments.length > 0
            );
            
            if (commentThreads.length > 0) {
              markdown += `## Comments (${commentThreads.length} threads)\n\n`;
              
              commentThreads.forEach((thread: GitPullRequestCommentThread) => {
                if (thread.comments && thread.comments.length > 0) {
                  const fileName = thread.threadContext?.filePath || 'General comment';
                  const status = thread.status === 1 ? 'Active' : 
                                thread.status === 2 ? 'Fixed' :
                                thread.status === 3 ? 'Won\'t Fix' :
                                thread.status === 4 ? 'Closed' :
                                thread.status === 5 ? 'By Design' :
                                thread.status === 6 ? 'Pending' : 'Unknown';
                  
                  markdown += `### Comment Thread (${status}) on ${fileName}\n\n`;
                  
                  thread.comments.forEach((comment: any) => {
                    const author = comment.author?.displayName || 'Unknown';
                    const date = comment.publishedDate ? new Date(comment.publishedDate).toLocaleString() : 'Unknown date';
                    const content = comment.content || 'No content';
                    
                    markdown += `**${author}** on ${date}:\n${content}\n\n`;
                  });
                }
              });
            }
          }

          return {
            content: [
              {
                type: 'text',
                text: markdown,
              },
            ],
          };
        } catch (error: any) {
          console.error('Error getting pull request:', error);
          return {
            content: [
              {
                type: 'text',
                text: `Error getting pull request: ${error.message}`,
              },
            ],
          };
        }
      },
    );
  }
}
