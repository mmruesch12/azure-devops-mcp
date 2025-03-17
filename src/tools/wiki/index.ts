import { McpTool } from '../types';
import { CreateWikiTool } from './createWiki';
import { EditWikiPageTool } from './editWikiPage';

/**
 * Get all wiki tools
 * 
 * @returns Array of wiki tools
 */
export function getWikiTools(): McpTool[] {
  return [
    new CreateWikiTool(),
    new EditWikiPageTool(),
  ];
}

export * from './createWiki';
export * from './editWikiPage';
