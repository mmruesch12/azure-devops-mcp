import * as dotenv from 'dotenv';
import { AzureDevOpsServer } from './server';
import { AzureDevOpsConfig } from './types/config';
import { SSEManager } from './sse-server';

// Load environment variables
dotenv.config();

// Log version info
console.log('Azure DevOps MCP Server - Starting up');
// Skip version logging to avoid linter errors
console.log('Starting server...');

// Create the server configuration from environment variables
const config: AzureDevOpsConfig = {
  organizationUrl: process.env.AZURE_DEVOPS_ORG_URL || '',
  personalAccessToken: process.env.AZURE_DEVOPS_PAT || '',
  defaultProject: process.env.AZURE_DEVOPS_DEFAULT_PROJECT,
  defaultRepository: process.env.AZURE_DEVOPS_DEFAULT_REPOSITORY,
  apiVersion: process.env.AZURE_DEVOPS_API_VERSION,
};

// Get server configuration
const port = parseInt(process.env.PORT || '3000', 10);
const host = process.env.HOST || '0.0.0.0';

// Validate the required configuration
if (!config.organizationUrl) {
  console.error('Error: AZURE_DEVOPS_ORG_URL environment variable is required');
  process.exit(1);
}

if (!config.personalAccessToken) {
  console.error('Error: AZURE_DEVOPS_PAT environment variable is required');
  process.exit(1);
}

// Create and initialize the server
const server = new AzureDevOpsServer(config);

// Run the server
async function runServer() {
  // Test the connection to Azure DevOps
  const connectionSuccessful = await server.testConnection();

  if (!connectionSuccessful) {
    console.error('Error: Failed to connect to Azure DevOps API');
    process.exit(1);
  }

  console.log('Successfully connected to Azure DevOps API');
  console.log(`Organization URL: ${config.organizationUrl}`);

  if (config.defaultProject) {
    console.log(`Default Project: ${config.defaultProject}`);
  }

  if (config.defaultRepository) {
    console.log(`Default Repository: ${config.defaultRepository}`);
  }

  // Create and start the SSE manager
  const sseManager = new SSEManager(server, port, host);
  await sseManager.start();

  console.log('Azure DevOps MCP Server running with SSE');
  console.log(`Server is available at http://${host}:${port}`);
  console.log(
    `Connect to http://${host}:${port}/sse to establish an SSE connection`,
  );

  // Handle process termination
  process.on('SIGINT', async () => {
    console.log('Shutting down...');
    await sseManager.stop();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('Shutting down...');
    await sseManager.stop();
    process.exit(0);
  });
}

// Start the server
runServer().catch((error) => {
  console.error('Fatal error in main():', error);
  process.exit(1);
});
