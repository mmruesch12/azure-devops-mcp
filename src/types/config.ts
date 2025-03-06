/**
 * Azure DevOps configuration type definition
 */
export interface AzureDevOpsConfig {
  /**
   * The Azure DevOps organization URL (e.g., https://dev.azure.com/organization)
   */
  organizationUrl: string;
  
  /**
   * Personal Access Token for authentication
   */
  personalAccessToken: string;
  
  /**
   * Optional default project to use when not specified
   */
  defaultProject?: string;
  
  /**
   * Optional default repository to use when not specified
   */
  defaultRepository?: string;
  
  /**
   * Optional API version to use (defaults to latest)
   */
  apiVersion?: string;
} 