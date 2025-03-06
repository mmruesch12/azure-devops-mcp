# Azure DevOps MCP (Model Context Protocol)

This project serves as a reference server implementation for the Model Context Protocol (MCP) integrated with Azure DevOps. It enables AI assistants to interact with Azure DevOps resources and perform operations programmatically.

## Features

- Azure DevOps integration using official Node.js SDK
- Support for Model Context Protocol (MCP)
- Project management operations
- Work item management
- Repository operations
- Code search capabilities

## Prerequisites

- Node.js (v18 or higher recommended)
- Azure DevOps account with appropriate permissions
- Azure DevOps Personal Access Token (PAT)

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd azure-devops-mcp
```

2. Install dependencies:
```bash
npm install
```

3. Configure environment variables:
   - Copy `.env.example` to `.env`
   - Fill in the required environment variables:
```bash
cp .env.example .env
```

## Add to Cursor

```bash
npm start
```

Then add to Cursor:

Make sure you use the path `http://localhost:3000/sse`. You can change ports by defining one in the env.

![Add to Cursor](add-to-cursor.png)

## Environment Configuration

The following environment variables need to be configured in your `.env` file:

- `AZURE_DEVOPS_ORG_URL`: Your Azure DevOps organization URL
- `AZURE_DEVOPS_PAT`: Personal Access Token for Azure DevOps
- `AZURE_DEVOPS_DEFAULT_PROJECT`: (Optional) Default project to use when not specified in API calls
- `AZURE_DEVOPS_DEFAULT_REPOSITORY`: (Optional) Default repository to use when not specified in API calls
- Additional configuration variables as specified in `.env.example`

## Available Scripts

- `npm run build` - Build the TypeScript project
- `npm run dev` - Run the server in development mode with hot reload
- `npm start` - Run the production server

## License

MIT
