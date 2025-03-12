import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import * as azdev from 'azure-devops-node-api';
import * as wit from 'azure-devops-node-api/interfaces/WorkItemTrackingInterfaces';
import { IWorkItemTrackingApi } from 'azure-devops-node-api/WorkItemTrackingApi';
import { z } from 'zod';
import { McpTool } from '../types';
import { AzureDevOpsConfig } from '../../types/config';

/**
 * Tool for creating a work item in Azure DevOps
 */
export class CreateWorkItemTool implements McpTool {
  public name = 'create_work_item';
  public description = 'Create a new work item';

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
            'The project to create the work item in (uses default project if not specified)',
          ),
        title: z.string().describe('The title of the work item'),
        workItemType: z
          .string()
          .describe('The type of work item (e.g., Bug, Task, User Story)'),
        description: z
          .string()
          .optional()
          .describe('The description of the work item'),
        assignedTo: z
          .string()
          .optional()
          .describe('The user to assign the work item to'),
        parentId: z
          .number()
          .optional()
          .describe('The ID of the parent work item to link this work item to'),
        linkType: z
          .string()
          .optional()
          .default('System.LinkTypes.Hierarchy-Reverse')
          .describe('The type of link to create when linking to parent (default: System.LinkTypes.Hierarchy-Reverse)'),
        relatedWorkItemId: z
          .number()
          .optional()
          .describe('The ID of a related work item to link this work item to (e.g., a Feature for a User Story)'),
        relatedWorkItemLinkType: z
          .string()
          .optional()
          .default('Related')
          .describe('The type of link to create when linking to related work item (e.g., Related, Dependency, Feature)'),
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

          // Get the Work Item Tracking API with timeout
          const witApi = await Promise.race([
            connection.getWorkItemTrackingApi(),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Timeout getting Work Item Tracking API')), 30000)
            )
          ]) as IWorkItemTrackingApi;

          // Create the work item
          const patchDocument = [
            {
              op: 'add',
              path: '/fields/System.Title',
              value: args.title,
            },
          ];

          if (args.description) {
            patchDocument.push({
              op: 'add',
              path: '/fields/System.Description',
              value: args.description,
            });
          }

          if (args.assignedTo) {
            patchDocument.push({
              op: 'add',
              path: '/fields/System.AssignedTo',
              value: args.assignedTo,
            });
          }

          const workItem = await Promise.race([
            witApi.createWorkItem(
              undefined,
              patchDocument,
              project,
              args.workItemType,
            ),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Timeout creating work item')), 30000)
            )
          ]) as wit.WorkItem;

          if (!workItem) {
            return {
              content: [
                {
                  type: 'text',
                  text: 'Failed to create work item.',
                },
              ],
            };
          }
          
          // If a parent ID was provided, link the work item to the parent
          let parentWorkItem = null;
          if (args.parentId) {
            try {
              // First, check if the parent work item exists
              parentWorkItem = await Promise.race([
                witApi.getWorkItem(args.parentId, undefined, undefined, undefined, project),
                new Promise((_, reject) => 
                  setTimeout(() => reject(new Error(`Timeout getting parent work item ${args.parentId}`)), 15000)
                )
              ]) as wit.WorkItem;
              
              if (!parentWorkItem) {
                console.warn(`Parent work item with ID ${args.parentId} not found.`);
              } else {
                // Create the patch document to add the link
                const linkPatchDocument = [
                  {
                    op: 'add',
                    path: '/relations/-',
                    value: {
                      rel: args.linkType || 'System.LinkTypes.Hierarchy-Reverse',
                      url: parentWorkItem.url,
                    },
                  },
                ];

                // Update the work item to add the link to the parent
                if (workItem.id) {
                  await Promise.race([
                    witApi.updateWorkItem(
                      undefined,
                      linkPatchDocument,
                      workItem.id,
                      project,
                    ),
                    new Promise((_, reject) => 
                      setTimeout(() => reject(new Error('Timeout linking work items')), 15000)
                    )
                  ]) as wit.WorkItem;
                  
                  console.log(`Linked work item ${workItem.id} to parent ${args.parentId} with relationship type ${args.linkType || 'System.LinkTypes.Hierarchy-Reverse'}.`);
                }
                

              }
            } catch (error) {
              console.error('Error linking work item to parent:', error);
              // Continue without failing the entire operation
            }
          }

          // If a related work item ID was provided, link the work item to the related work item
          let relatedWorkItem = null;
          if (args.relatedWorkItemId) {
            try {
              // First, check if the related work item exists
              relatedWorkItem = await Promise.race([
                witApi.getWorkItem(args.relatedWorkItemId, undefined, undefined, undefined, project),
                new Promise((_, reject) => 
                  setTimeout(() => reject(new Error(`Timeout getting related work item ${args.relatedWorkItemId}`)), 15000)
                )
              ]) as wit.WorkItem;
              
              if (!relatedWorkItem) {
                console.warn(`Related work item with ID ${args.relatedWorkItemId} not found.`);
              } else {
                // Create the patch document to add the link
                const linkPatchDocument = [
                  {
                    op: 'add',
                    path: '/relations/-',
                    value: {
                      rel: args.relatedWorkItemLinkType || 'Related',
                      url: relatedWorkItem.url,
                    },
                  },
                ];

                // Update the work item to add the link to the related work item
                if (workItem.id) {
                  await Promise.race([
                    witApi.updateWorkItem(
                      undefined,
                      linkPatchDocument,
                      workItem.id,
                      project,
                    ),
                    new Promise((_, reject) => 
                      setTimeout(() => reject(new Error('Timeout linking work items')), 15000)
                    )
                  ]) as wit.WorkItem;
                  
                  console.log(`Linked work item ${workItem.id} to related work item ${args.relatedWorkItemId} with relationship type ${args.relatedWorkItemLinkType || 'Related'}.`);
                }
                

              }
            } catch (error) {
              console.error('Error linking work item to related work item:', error);
              // Continue without failing the entire operation
            }
          }

          // Format the work item
          const fields = workItem.fields || {};
          const formattedWorkItem = {
            id: workItem.id,
            title: fields['System.Title'],
            state: fields['System.State'],
            type: fields['System.WorkItemType'],
            assignedTo: fields['System.AssignedTo']?.displayName,
            url: `${connection.serverUrl}/${project}/_workitems/edit/${workItem.id}`,
          };

          // Build the response text
          let responseText = `# Work Item Created\n\n` +
            `**ID**: ${formattedWorkItem.id}\n` +
            `**Title**: ${formattedWorkItem.title}\n` +
            `**Type**: ${formattedWorkItem.type}\n` +
            `**State**: ${formattedWorkItem.state}\n` +
            `**Assigned To**: ${formattedWorkItem.assignedTo || 'Unassigned'}\n` +
            `**URL**: ${formattedWorkItem.url}\n`;
            
          // Add parent information if applicable
          if (parentWorkItem) {
            const parentFields = parentWorkItem.fields || {};
            responseText += `\n## Parent Work Item\n` +
              `**ID**: ${parentWorkItem.id}\n` +
              `**Title**: ${parentFields['System.Title']}\n` +
              `**Type**: ${parentFields['System.WorkItemType']}\n` +
              `**Relationship**: ${args.linkType || 'Child'}\n`;
          }
          
          // Add related work item information if applicable
          if (relatedWorkItem) {
            const relatedFields = relatedWorkItem.fields || {};
            responseText += `\n## Related Work Item\n` +
              `**ID**: ${relatedWorkItem.id}\n` +
              `**Title**: ${relatedFields['System.Title']}\n` +
              `**Type**: ${relatedFields['System.WorkItemType']}\n` +
              `**Relationship**: ${args.relatedWorkItemLinkType || 'Related'}\n`;
          }
          
          return {
            content: [
              {
                type: 'text',
                text: responseText,
              },
            ],
          };
        } catch (error: any) {
          console.error('Error creating work item:', error);
          return {
            content: [
              {
                type: 'text',
                text: `Error creating work item: ${error.message}`,
              },
            ],
          };
        }
      },
    );
  }
}
