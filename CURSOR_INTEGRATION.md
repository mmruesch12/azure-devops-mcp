# Cursor IDE Integration with Azure DevOps MCP Server

This guide helps you effectively use Cursor IDE with the Azure DevOps Model Context Protocol (MCP) server.

## Project Setup

### Prerequisites

- Node.js (LTS version recommended)
- npm or yarn package manager
- Azure DevOps account with valid Personal Access Token (PAT)

### First-Time Setup

1. Clone the repository
2. Copy `.env.example` to `.env` and configure your Azure DevOps settings
3. Install dependencies: `npm install`
4. Build the project: `npm run build`

## Environment Configuration

The `.env` file contains all necessary configuration. Key variables include:

```
AZURE_DEVOPS_ORG=your-organization
AZURE_DEVOPS_ORG_URL=https://dev.azure.com/your-organization
AZURE_DEVOPS_PAT=your-personal-access-token
AZURE_DEVOPS_PROJECT=your-project
AZURE_DEVOPS_DEFAULT_REPOSITORY=your-repository-id-or-name
```

### Repository Configuration

The `AZURE_DEVOPS_DEFAULT_REPOSITORY` setting is crucial for Cursor integration, as all repository tools default to this value if not explicitly overridden.

This can be set using either:
- Repository name (e.g., `ui-coe`)
- Repository ID (e.g., `858211a9-787a-4b23-90f4-ba415e4d105c`)

## Running the Server

1. Start the server: `npm start`
2. For development with auto-restart: `npm run dev`

## Available Tools

The MCP server exposes these Azure DevOps tools that Cursor can interact with:

### Repository Tools

| Tool Name | Description | Default Behavior |
|-----------|-------------|------------------|
| `get_repository` | Get repository details | Uses default repository from `.env` |
| `list_repositories` | List all repositories | Uses default project from `.env` |
| `get_pull_request` | Get pull request details | Searches in default repository first |
| `create_pull_request` | Create a new pull request | Creates in default repository |
| `search_repository_code` | Search code in repository | Searches in default repository |

## API Integration Points

Cursor IDE can interface with the MCP server through these endpoints:

- `POST /mcp0`: Main MCP server endpoint
- `GET /health`: Health check endpoint

## Request Format for Cursor

Cursor should format requests to the MCP server as follows:

```json
{
  "request": "use_tool",
  "tool": "[tool_name]",
  "args": {
    "[param1]": "[value1]",
    "[param2]": "[value2]"
  }
}
```

## Response Handling

Responses are formatted as Markdown-rich text that can be displayed directly in Cursor IDE.

### Example Tool Response

```json
{
  "content": [
    {
      "type": "text",
      "text": "# Repository Details\n\n...markdown formatted output..."
    }
  ]
}
```

## Error Handling

The server provides detailed error messages that should be displayed to the user in Cursor.

Common error scenarios:
- Authentication failures (invalid PAT)
- Repository not found (incorrect default repository)
- Permission issues (insufficient PAT scope)

## Debugging Tips

1. Enable debug logging: `DEBUG=mcp:* npm run dev`
2. Check `.env` file if tools cannot connect to Azure DevOps
3. Verify network connectivity to Azure DevOps API endpoints
4. Check for expired or invalid PAT tokens

## Development Workflow

### Making Changes to Tools

1. Modify files in `src/tools/repository/`
2. Run `npm run build` to compile TypeScript
3. Restart the server

### Testing Integration

Test tool integration by sending requests directly to the server:

```bash
curl -X POST http://localhost:3000/mcp0 \
  -H "Content-Type: application/json" \
  -d '{"request":"use_tool","tool":"list_repositories","args":{}}'  
```

## Troubleshooting Common Issues

### "Node not found" Error

Ensure Node.js is installed and in your PATH.

### Authentication Failures

Verify your PAT token has the following scopes:
- `Code (Read)`
- `Pull Request (Read & Write)`

### Default Repository Issues

If tools can't find the default repository:
1. List all repositories with `list_repositories` tool
2. Update `.env` with the correct repository name or ID

## Key Files for IDE Integration

- `src/index.ts`: Server entry point
- `src/tools/repository/`: All repository-related tools
- `src/types/config.ts`: Configuration interfaces

---

**Note**: This integration guide is specifically designed for using the Azure DevOps MCP server with Cursor IDE.
