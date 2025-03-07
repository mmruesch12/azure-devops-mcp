import { GetRepositoryTool } from './getRepository';
import { ListRepositoriesTool } from './listRepositories';
import { SearchRepositoryCodeTool } from './searchRepositoryCode';
import { GetPullRequestsTool } from './getPullRequests';
import { GetPullRequestTool } from './getPullRequest';
import { CreatePullRequestTool } from './createPullRequest';

export { 
  GetRepositoryTool, 
  ListRepositoriesTool, 
  SearchRepositoryCodeTool, 
  GetPullRequestsTool,
  GetPullRequestTool,
  CreatePullRequestTool
};

/**
 * Get all repository tools
 *
 * @returns Array of repository tools
 */
export function getRepositoryTools() {
  return [
    new GetRepositoryTool(),
    new ListRepositoriesTool(),
    new SearchRepositoryCodeTool(),
    new GetPullRequestsTool(),
    new GetPullRequestTool(),
    new CreatePullRequestTool(),
  ];
}
