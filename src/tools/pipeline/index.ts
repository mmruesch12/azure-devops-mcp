import { GetPipelineTool } from './getPipeline.js';
import { RunPipelineTool } from './runPipeline.js';

export { GetPipelineTool, RunPipelineTool };

/**
 * Get all pipeline tools
 *
 * @returns Array of pipeline tools
 */
export function getPipelineTools() {
  return [
    new GetPipelineTool(),
    new RunPipelineTool(),
  ];
}
