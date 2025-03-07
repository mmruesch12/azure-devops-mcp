import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import * as azdev from 'azure-devops-node-api';
import { z } from 'zod';
import { McpTool } from '../types';
import { AzureDevOpsConfig } from '../../types/config';

interface CodeSearchMatch {
  charOffset?: number;
  length?: number;
  line?: string;
  lineNumber?: number;
  text?: string;
}

interface CodeSearchMatches {
  content?: CodeSearchMatch[];
  fileName?: CodeSearchMatch[];
}

interface CodeSearchResult {
  fileName?: string;
  path?: string;
  matches?: CodeSearchMatches;
  repository?: {
    name?: string;
    id?: string;
    webUrl?: string;
  };
  project?: {
    name?: string;
    id?: string;
  };
  versions?: Array<{
    branchName?: string;
    changeId?: string;
  }>;
}

interface CodeSearchResponse {
  count: number;
  results: CodeSearchResult[];
}

interface FormattedSearchResult {
  fileName: string;
  path: string;
  repository: string | undefined;
  project: string | undefined;
  branch: string;
  matches: number;
  webUrl: string | null;
  snippets: Array<{
    line: string | undefined;
    content: string | undefined;
    lineNumber: number | undefined;
  }>;
}

/**
 * Tool for searching code in Azure DevOps repositories
 */
export class SearchRepositoryCodeTool implements McpTool {
  public name = 'search_repository_code';
  public description = 'Search for code in repositories';

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
        searchText: z.string().describe('The text to search for in the code'),
        project: z
          .string()
          .optional()
          .describe('The project containing the repositories to search (uses default project if not specified)'),
        repository: z
          .string()
          .optional()
          .describe('The specific repository to search in (uses default repository if not specified)'),
        path: z
          .string()
          .optional()
          .describe('The path within the repository to search (e.g., "/src")'),
        branch: z
          .string()
          .optional()
          .describe('The branch to search in (defaults to the default branch)'),
        fileExtension: z
          .string()
          .optional()
          .describe('Filter by file extension (e.g., ".ts", ".cs")'),
        maxResults: z
          .number()
          .optional()
          .describe('Maximum number of results to return (default: 20)'),
      },
      async (args, _extras) => {
        try {
          if (!connection) {
            throw new Error('No connection to Azure DevOps');
          }

          // Get the organization URL from the connection
          const orgUrl = connection.serverUrl;
          if (!orgUrl) {
            throw new Error('Unable to determine organization URL');
          }

          // Extract organization name from URL
          const orgMatch = orgUrl.match(/https:\/\/dev\.azure\.com\/([^/]+)/i);
          const organization = orgMatch ? orgMatch[1] : null;

          if (!organization) {
            throw new Error('Unable to determine organization name from URL');
          }

          // Use provided project or fall back to default project
          const project = args.project || config.defaultProject;
          
          // Use provided repository or fall back to default repository
          const repository = args.repository || config.defaultRepository;

          // Prepare the search request
          const searchRequest = {
            searchText: args.searchText,
            $skip: 0,
            $top: args.maxResults || 20,
            filters: {
              Project: project ? [project] : undefined,
              Repository: repository ? [repository] : undefined,
              Path: args.path ? [args.path] : undefined,
              Branch: args.branch ? [args.branch] : undefined,
              Extension: args.fileExtension
                ? [
                    args.fileExtension.startsWith('.')
                      ? args.fileExtension
                      : `.${args.fileExtension}`,
                  ]
                : undefined,
            },
            includeFacets: false,
          };

          // Get the personal access token from environment variables
          const pat = process.env.AZURE_DEVOPS_PAT;
          if (!pat) {
            throw new Error(
              'Unable to get authentication token. Please set AZURE_DEVOPS_PAT environment variable.',
            );
          }

          // Make the REST API call
          const projectScope = project || '';
          const searchUrl = `https://almsearch.dev.azure.com/${organization}/${projectScope}/_apis/search/codesearchresults?api-version=5.1-preview.1`;

          const response = await fetch(searchUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Basic ${Buffer.from(`:${pat}`).toString('base64')}`,
            },
            body: JSON.stringify(searchRequest),
          });

          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(
              `Search API request failed: ${response.status} ${response.statusText} - ${errorText}`,
            );
          }

          const searchResults = (await response.json()) as CodeSearchResponse;

          if (
            !searchResults ||
            !searchResults.results ||
            !searchResults.count
          ) {
            return {
              content: [
                {
                  type: 'text',
                  text: 'No results found.',
                },
              ],
            };
          }

          // Format the results
          const formattedResults: FormattedSearchResult[] =
            searchResults.results.map((result) => ({
              fileName: result.fileName || '',
              path: result.path || '',
              repository: result.repository?.name,
              project: result.project?.name,
              branch: result.versions?.[0]?.branchName || 'unknown',
              matches: result.matches?.content?.length || 0,
              webUrl: result.repository?.webUrl
                ? `${result.repository.webUrl}/blob/${
                    result.versions?.[0]?.branchName || 'master'
                  }${result.path}`
                : null,
              snippets: (result.matches?.content || []).map((match) => ({
                line: match.lineNumber?.toString(),
                content: match.line,
                lineNumber: match.lineNumber,
              })),
            }));

          // Convert to markdown
          let markdown = `# Code Search Results\n\n`;
          markdown += `Found ${searchResults.count} result(s) for query: **${args.searchText}**\n\n`;

          if (repository) {
            markdown += `Repository: **${repository}**\n\n`;
          }

          if (project) {
            markdown += `Project: **${project}**\n\n`;
          }

          formattedResults.forEach((result) => {
            markdown += `## ${result.fileName}\n`;
            markdown += `**Path**: ${result.path}\n`;
            markdown += `**Repository**: ${result.repository || 'Unknown'}\n`;
            markdown += `**Project**: ${result.project || 'Unknown'}\n`;
            markdown += `**Branch**: ${result.branch}\n`;

            if (result.webUrl) {
              markdown += `**Link**: [View in Azure DevOps](${result.webUrl})\n\n`;
            } else {
              markdown += `\n`;
            }

            markdown += `### Matches (${result.matches})\n\n`;

            result.snippets.forEach((snippet) => {
              markdown += `Line ${snippet.lineNumber}: \`${snippet.content?.trim() || ''}\`\n\n`;
            });

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
          console.error('Error searching code:', error);
          return {
            content: [
              {
                type: 'text',
                text: `Error searching code: ${error.message}`,
              },
            ],
          };
        }
      },
    );
  }
}
