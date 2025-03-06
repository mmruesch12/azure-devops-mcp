import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import * as azdev from 'azure-devops-node-api';
import { z } from 'zod';
import { McpTool } from '../types';
import { AzureDevOpsConfig } from '../../types/config';

/**
 * Tool for getting a work item from Azure DevOps
 */
export class GetWorkItemTool implements McpTool {
  public name = 'get_work_item';
  public description = 'Get a work item by ID';

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
        workItemId: z.number().describe('The ID of the work item'),
        project: z
          .string()
          .optional()
          .describe(
            'The project containing the work item (uses default project if not specified)',
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

          // Get the Work Item Tracking API
          const witApi = await connection.getWorkItemTrackingApi();

          // Get the work item
          const workItem = await witApi.getWorkItem(args.workItemId);
          console.log('workItem', workItem);

          if (!workItem) {
            return {
              content: [
                {
                  type: 'text',
                  text: `Work item ${args.workItemId} not found.`,
                },
              ],
            };
          }

          // Format the work item
          const fields = workItem.fields || {};
          const formattedWorkItem = {
            id: workItem.id,
            title: fields['System.Title'],
            state: fields['System.State'],
            type: fields['System.WorkItemType'],
            description: fields['System.Description'],
            assignedTo: fields['System.AssignedTo']?.displayName,
            iterationPath: fields['System.IterationPath'],
            areaPath: fields['System.AreaPath'],
            createdBy: fields['System.CreatedBy']?.displayName,
            createdDate: fields['System.CreatedDate'],
            changedBy: fields['System.ChangedBy']?.displayName,
            changedDate: fields['System.ChangedDate'],
            priority: fields['Microsoft.VSTS.Common.Priority'],
            tags: fields['System.Tags'],
            url: `${connection.serverUrl}/${project}/_workitems/edit/${workItem.id}`,
          };

          return {
            content: [
              {
                type: 'text',
                text:
                  `# Work Item ${formattedWorkItem.id}: ${formattedWorkItem.title}

` +
                  `**Type**: ${formattedWorkItem.type}
` +
                  `**State**: ${formattedWorkItem.state}
` +
                  `**Assigned To**: ${formattedWorkItem.assignedTo || 'Unassigned'}
` +
                  `**Area Path**: ${formattedWorkItem.areaPath || 'Not specified'}
` +
                  `**Iteration**: ${formattedWorkItem.iterationPath}
` +
                  `**Priority**: ${formattedWorkItem.priority || 'Not specified'}
` +
                  `**Created By**: ${formattedWorkItem.createdBy || 'Unknown'} on ${formattedWorkItem.createdDate ? new Date(formattedWorkItem.createdDate).toLocaleString() : 'Unknown date'}
` +
                  `**Last Modified By**: ${formattedWorkItem.changedBy || 'Unknown'} on ${formattedWorkItem.changedDate ? new Date(formattedWorkItem.changedDate).toLocaleString() : 'Unknown date'}
` +
                  `**Tags**: ${formattedWorkItem.tags || 'None'}
` +
                  `**URL**: ${formattedWorkItem.url}

` +
                  (formattedWorkItem.description ? `## Description

${formattedWorkItem.description}
` : ''),
              },
            ],
          };
        } catch (error: any) {
          console.error('Error getting work item:', error);
          return {
            content: [
              {
                type: 'text',
                text: `Error getting work item: ${error.message}`,
              },
            ],
          };
        }
      },
    );
  }
}
