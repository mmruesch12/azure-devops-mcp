import { GetWorkItemTool } from './getWorkItem';
import { CreateWorkItemTool } from './createWorkItem';
import { QueryWorkItemsTool } from './queryWorkItems';

export { GetWorkItemTool, CreateWorkItemTool };

/**
 * Get all work item tools
 *
 * @returns Array of work item tools
 */
export function getWorkItemTools() {
  return [
    new GetWorkItemTool(),
    new CreateWorkItemTool(),
    new QueryWorkItemsTool(),
  ];
}
