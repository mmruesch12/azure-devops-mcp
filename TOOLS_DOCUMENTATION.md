# Azure DevOps MCP Tools Documentation

This document provides comprehensive documentation for all tools available in the Azure DevOps Model Context Protocol (MCP) server.

## Table of Contents

- [Repository Tools](#repository-tools)
- [Project Tools](#project-tools)
- [Work Item Tools](#work-item-tools)

## Repository Tools

Tools for interacting with Azure DevOps Git repositories.

### get_repository

Retrieve details about a specific repository.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `repository` | string | No | Repository ID or name (uses default from `.env` if not specified) |

**Response:**

Returns detailed information about the repository in markdown format, including:
- Repository ID
- Name
- Default branch
- Project information
- URLs (remote and web)
- Size

**Example Request:**
```json
{
  "request": "use_tool",
  "tool": "get_repository",
  "args": {}
}
```

**Default Behavior:**
Uses the repository specified in `AZURE_DEVOPS_DEFAULT_REPOSITORY` from the environment configuration.

---

### list_repositories

List all repositories in a project or organization.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `project` | string | No | Project to list repositories from (uses default project if not specified) |

**Response:**

Returns a markdown table of repositories with the following information:
- Name
- ID
- Default branch
- Web URL

The default repository (from `.env`) is highlighted in the output.

**Example Request:**
```json
{
  "request": "use_tool",
  "tool": "list_repositories",
  "args": {}
}
```

**Default Behavior:**
Uses the project specified in `AZURE_DEVOPS_PROJECT` or `AZURE_DEVOPS_DEFAULT_PROJECT` from the environment configuration.

---

### get_pull_request

Retrieve details about a specific pull request.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | number | Yes | Pull request ID |

**Response:**

Returns detailed information about the pull request in markdown format, including:
- Title and description
- Status
- Source and target branches
- Creator information
- Creation and update dates
- Reviewers and their vote status
- Related work items

**Example Request:**
```json
{
  "request": "use_tool",
  "tool": "get_pull_request",
  "args": {
    "id": 123
  }
}
```

**Default Behavior:**
Searches for the pull request in the default repository specified in `AZURE_DEVOPS_DEFAULT_REPOSITORY`. If not found, will search across all repositories in the project.

---

### get_pull_request_diff

Retrieve the diff (changes) for a specific pull request.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `pullRequestId` | number | Yes | Pull request ID |
| `project` | string | No | Project containing the pull request (uses default project if not specified) |
| `top` | number | No | Maximum number of changes to return (default: 100) |
| `skip` | number | No | Number of changes to skip (default: 0) |

**Response:**

Returns a markdown formatted diff of the pull request, including:
- Summary of changes (added, modified, deleted, renamed files)
- List of all changed files with their change types
- Links to view each file in the browser
- Link to view the full diff in the browser

**Example Request:**
```json
{
  "request": "use_tool",
  "tool": "get_pull_request_diff",
  "args": {
    "pullRequestId": 123
  }
}
```

**Default Behavior:**
Uses the repository specified in `AZURE_DEVOPS_DEFAULT_REPOSITORY` from the environment configuration.

---

### get_pull_requests

List pull requests with optional filtering.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `repository` | string | No | Repository ID or name (uses default from `.env` if not specified) |
| `status` | string | No | Filter by status: 'active', 'abandoned', 'completed', 'all' (default: 'active') |
| `creatorId` | string | No | Filter by creator's ID |
| `reviewerId` | string | No | Filter by reviewer's ID |
| `sourceRefName` | string | No | Filter by source branch name |
| `targetRefName` | string | No | Filter by target branch name |
| `top` | number | No | Maximum number of pull requests to return (default: 10) |

**Response:**

Returns a markdown table of pull requests with the following information:
- ID
- Title
- Status
- Creator
- Creation date
- Source and target branches

**Example Request:**
```json
{
  "request": "use_tool",
  "tool": "get_pull_requests",
  "args": {
    "status": "active",
    "top": 5
  }
}
```

**Default Behavior:**
Uses the repository specified in `AZURE_DEVOPS_DEFAULT_REPOSITORY` from the environment configuration.

---

### create_pull_request

Create a new pull request.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `title` | string | Yes | Title of the pull request |
| `description` | string | No | Description of the pull request |
| `sourceRefName` | string | Yes | Source branch name (e.g., 'refs/heads/feature/my-feature') |
| `targetRefName` | string | Yes | Target branch name (e.g., 'refs/heads/main') |
| `isDraft` | boolean | No | Whether to create as a draft pull request (default: false) |
| `reviewers` | string[] | No | Array of reviewer IDs or email addresses |
| `workItemIds` | number[] | No | Array of work item IDs to link to the pull request |

**Response:**

Returns detailed information about the created pull request in markdown format, including:
- Title and description
- Status
- Source and target branches
- Creator information
- Creation date
- Web URL for viewing the pull request

**Example Request:**
```json
{
  "request": "use_tool",
  "tool": "create_pull_request",
  "args": {
    "title": "Add new feature",
    "description": "This PR adds the new search functionality",
    "sourceRefName": "refs/heads/feature/search",
    "targetRefName": "refs/heads/main",
    "isDraft": true
  }
}
```

**Default Behavior:**
Creates the pull request in the repository specified in `AZURE_DEVOPS_DEFAULT_REPOSITORY` from the environment configuration.

---

### search_repository_code

Search for code in a repository.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `searchText` | string | Yes | Text to search for in the code |
| `top` | number | No | Maximum number of results to return (default: 100) |

**Response:**

Returns search results in markdown format, including:
- File path
- Line number
- Code snippet with highlighted match
- Link to view the file in the web UI

**Example Request:**
```json
{
  "request": "use_tool",
  "tool": "search_repository_code",
  "args": {
    "searchText": "function getRepository",
    "top": 10
  }
}
```

**Default Behavior:**
Searches in the repository specified in `AZURE_DEVOPS_DEFAULT_REPOSITORY` from the environment configuration.

## Project Tools

Tools for interacting with Azure DevOps projects.

### get_project

Retrieve details about a specific project.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `project` | string | No | Project ID or name (uses default from `.env` if not specified) |

**Response:**

Returns detailed information about the project in markdown format, including:
- Project ID
- Name
- Description
- State
- Visibility
- Last update time
- URLs (API and web)

**Example Request:**
```json
{
  "request": "use_tool",
  "tool": "get_project",
  "args": {}
}
```

**Default Behavior:**
Uses the project specified in `AZURE_DEVOPS_PROJECT` or `AZURE_DEVOPS_DEFAULT_PROJECT` from the environment configuration.

---

### list_projects

List all projects in the organization.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `state` | string | No | Filter by state: 'all', 'createPending', 'deleted', 'deleting', 'new', 'unchanged', 'wellFormed' (default: 'all') |
| `top` | number | No | Maximum number of projects to return (default: 100) |

**Response:**

Returns a markdown table of projects with the following information:
- Name
- ID
- Description
- State
- Visibility
- Last update time

The default project (from `.env`) is highlighted in the output.

**Example Request:**
```json
{
  "request": "use_tool",
  "tool": "list_projects",
  "args": {
    "state": "wellFormed",
    "top": 10
  }
}
```

## Work Item Tools

Tools for interacting with Azure DevOps work items.

### get_work_item

Retrieve details about a specific work item.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `workItemId` | number | Yes | Work item ID |
| `project` | string | No | The project containing the work item (uses default project if not specified) |
| `includeRelations` | boolean | No | Whether to include parent and child linked items (default: false) |

**Response:**

Returns detailed information about the work item in markdown format, including:
- ID and title
- Type
- State
- Assigned to
- Created by
- Creation and update dates
- Description
- Priority
- Parent work items (when `includeRelations` is true)
- Child work items (when `includeRelations` is true)

**Example Request:**
```json
{
  "request": "use_tool",
  "tool": "get_work_item",
  "args": {
    "workItemId": 123,
    "includeRelations": true
  }
}
```

---

### query_work_items

Query work items using WIQL (Work Item Query Language).

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | string | Yes | WIQL query string |
| `project` | string | No | Project ID or name (uses default from `.env` if not specified) |

**Response:**

Returns a markdown table of work items matching the query with the following information:
- ID
- Type
- Title
- State
- Assigned to
- Created date

**Example Request:**
```json
{
  "request": "use_tool",
  "tool": "query_work_items",
  "args": {
    "query": "SELECT [System.Id], [System.Title], [System.State] FROM WorkItems WHERE [System.State] = 'Active' ORDER BY [System.Id]"
  }
}
```

**Default Behavior:**
Uses the project specified in `AZURE_DEVOPS_PROJECT` or `AZURE_DEVOPS_DEFAULT_PROJECT` from the environment configuration.

---

### create_work_item

Create a new work item.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `project` | string | No | Project ID or name (uses default from `.env` if not specified) |
| `type` | string | Yes | Work item type (e.g., 'Bug', 'Task', 'User Story', 'Feature') |
| `title` | string | Yes | Title of the work item |
| `description` | string | No | Description of the work item |
| `assignedTo` | string | No | Email or ID of the person to assign the work item to |
| `priority` | number | No | Priority of the work item |
| `tags` | string | No | Comma-separated list of tags |
| `additionalFields` | object | No | Additional fields to set on the work item |

**Response:**

Returns detailed information about the created work item in markdown format, including:
- ID and title
- Type
- State
- Assigned to
- Created by
- Creation date
- Description
- Priority
- Web URL for viewing the work item

**Example Request:**
```json
{
  "request": "use_tool",
  "tool": "create_work_item",
  "args": {
    "type": "Bug",
    "title": "Fix search functionality",
    "description": "The search feature is not returning correct results",
    "priority": 2,
    "tags": "bug,search,critical"
  }
}
```

**Default Behavior:**
Creates the work item in the project specified in `AZURE_DEVOPS_PROJECT` or `AZURE_DEVOPS_DEFAULT_PROJECT` from the environment configuration.

## Error Handling

All tools follow a consistent error handling pattern. When an error occurs, the response will include:

```json
{
  "content": [
    {
      "type": "text",
      "text": "Error: [detailed error message]"
    }
  ]
}
```

Common error scenarios include:
- Authentication failures (invalid PAT)
- Resource not found (incorrect IDs or names)
- Permission issues (insufficient PAT scope)
- Invalid parameters (missing required fields or incorrect formats)

## Environment Variables

The following environment variables affect tool behavior:

| Variable | Description | Used By |
|----------|-------------|----------|
| `AZURE_DEVOPS_ORG` | Organization name | All tools |
| `AZURE_DEVOPS_ORG_URL` | Full organization URL | All tools |
| `AZURE_DEVOPS_PAT` | Personal Access Token | All tools |
| `AZURE_DEVOPS_PROJECT` | Default project | Project and Work Item tools |
| `AZURE_DEVOPS_DEFAULT_PROJECT` | Fallback project | Project and Work Item tools |
| `AZURE_DEVOPS_DEFAULT_REPOSITORY` | Default repository | Repository tools |
| `AZURE_DEVOPS_API_VERSION` | API version to use | All tools |

## Required PAT Permissions

The Personal Access Token (PAT) used for authentication requires the following scopes:

- For Repository tools: `Code (Read & Write)`
- For Project tools: `Project and Team (Read)`
- For Work Item tools: `Work Items (Read & Write)`
- For Pull Request operations: `Pull Request Contributor`
