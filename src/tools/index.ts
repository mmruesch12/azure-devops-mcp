import { getProjectTools } from './project';
import { getWorkItemTools } from './workItem';
import { getRepositoryTools } from './repository';
import { getPipelineTools } from './pipeline';
import { ToolRegistry } from './types';

export { ToolRegistry } from './types';

/**
 * Get all tools
 *
 * @returns A tool registry with all tools registered
 */
export function getAllTools(): ToolRegistry {
  const registry = new ToolRegistry();

  // Register all tools
  getProjectTools().forEach((tool) => registry.registerTool(tool));
  getWorkItemTools().forEach((tool) => registry.registerTool(tool));
  getRepositoryTools().forEach((tool) => registry.registerTool(tool));
  getPipelineTools().forEach((tool) => registry.registerTool(tool));

  return registry;
}
