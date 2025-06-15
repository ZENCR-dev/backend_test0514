# Build on Stripe with LLMs

Use LLMs in your Stripe integration workflow.

You can use large language models (LLMs) to assist in the building of Stripe integrations. We provide a set of tools and best practices if you use LLMs during development.

## Plain text docs 

You can access all of our documentation as plain text markdown files by adding `.md` to the end of any url. For example, you can find the plain text version of this page itself at [https://docs.stripe.com/building-with-llms.md](https://docs.stripe.com/building-with-llms.md).

This helps AI tools and agents consume our content and allows you to copy and paste the entire contents of a doc into an LLM. This format is preferable to scraping or copying from our HTML and JavaScript-rendered pages because:

* Plain text contains fewer formatting tokens.
* Content that isn’t rendered in the default view (for example, it’s hidden in a tab) of a given page is rendered in the plain text version.
* LLMs can parse and understand markdown hierarchy.

We also host an [/llms.txt file](https://docs.stripe.com/llms.txt.md) which instructs AI tools and agents how to retrieve the plain text versions of our pages. The `/llms.txt` file is an [emerging standard](https://llmstxt.org/) for making websites and content more accessible to LLMs.

## Stripe Model Context Protocol (MCP) Server 

You can use the Stripe Model Context Protocol (MCP) server if you use code editors that use AI, such as Cursor or Windsurf, or general purpose tools such as Claude Desktop. The MCP server provides AI agents a set of tools you can use to call the Stripe API and search our knowledge base (documentation, support articles, and so on).

### Local server 

If you prefer or require a local setup, you can run the [local Stripe MCP server](https://github.com/stripe/agent-toolkit/tree/main/modelcontextprotocol).

[Click here](https://cursor.com/install-mcp?name=stripe&config=eyJjb21tYW5kIjoibnB4IC15IEBzdHJpcGUvbWNwIC0tdG9vbHM9YWxsIiwiZW52Ijp7IlNUUklQRV9TRUNSRVRfS0VZIjoiIn19) to open Cursor and automatically add the Stripe MCP.

Alternatively, add the following to your `~/.cursor/mcp.json` file.

```json
{
  "mcpServers": {
    "stripe": {
      "command": "npx",
      "args": ["-y", "@stripe/mcp", "--tools=all"],
      "env": {
        "STRIPE_SECRET_KEY": "<<secret key>>"
      }
    }
  }
}
```

The code editor agent automatically detects all the available tools and calls the relevant tool when you post a related question in the chat. See the [Cursor documentation](https://docs.cursor.com/context/model-context-protocol) for more details.

[Click here](https://vscode.dev/redirect/mcp/install?name=stripe&inputs=%5B%7B%22type%22%3A%22promptString%22%2C%22id%22%3A%22stripe_secret_key%22%2C%22description%22%3A%22Stripe%20secret%20API%20key%22%2C%22password%22%3Atrue%7D%5D&config=%7B%22command%22%3A%22npx%22%2C%22args%22%3A%5B%22-y%22%2C%22%40stripe%2Fmcp%22%2C%22--tools%3Dall%22%5D%2C%22env%22%3A%7B%22STRIPE_SECRET_KEY%22%3A%22%24%7Binput%3Astripe_secret_key%7D%22%7D%7D) to open VS Code and automatically add the Stripe MCP.

Alternatively, add the following to your `.vscode/mcp.json` file in your workspace. See the [VS Code documentation](https://code.visualstudio.com/docs/copilot/chat/mcp-servers) for more details.

```json
{
  "servers": {
    "stripe": {
      "command": "npx",
      "args": ["-y", "@stripe/mcp", "--tools=all"],
      "env": {
        "STRIPE_SECRET_KEY": "<<secret key>>"
      }
    }
  }
}
```

Add the following to your `~/.codeium/windsurf/mcp_config.json` file. See the [Windsurf documentation](https://docs.windsurf.com/windsurf/cascade/mcp) for more details.

```json
{
  "mcpServers": {
    "stripe": {
      "command": "npx",
      "args": ["-y", "@stripe/mcp", "--tools=all"],
      "env": {
        "STRIPE_SECRET_KEY": "<<secret key>>"
      }
    }
  }
}
```

Add the following to your `claude_desktop_config.json` file. See the [Claude Desktop documentation](https://modelcontextprotocol.io/quickstart/user) for more details.

```json
{
  "mcpServers": {
    "stripe": {
      "command": "npx",
      "args": ["-y", "@stripe/mcp", "--tools=all"],
      "env": {
        "STRIPE_SECRET_KEY": "<<secret key>>"
      }
    }
  }
}
```

Run the following command to start the MCP server locally.

```bash
npx -y @stripe/mcp --tools=all --api-key=<<secret key>>
```

The MCP server uses either the passed in `--api-key` or the `STRIPE_SECRET_KEY` environment variable.

### Remote server  

Stripe also hosts a remote MCP server, available at `https://mcp.stripe.com`. To interact with the remote server, you need to pass your Stripe API key as a bearer token in the request header. We recommend using [restricted API keys](https://docs.stripe.com/keys.md#create-restricted-api-secret-key) to limit access to the functionality your agent requires.

```bash
curl https://mcp.stripe.com/ \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <<secret key>>" \
  -d '{
      "jsonrpc": "2.0",
      "method": "tools/call",
      "params": {
        "name": "create_customer",
        "arguments": {"name": "Jenny Rosen", "email": "jenny.rosen@example.com" }
      },
      "id": 1
  }'
```

Currently, this remote server only supports bearer token authentication. OAuth isn’t supported. To avoid phishing attacks, verify that you only use trusted MCP clients, and that the URL you’re using is the official `https://mcp.stripe.com` server.

## VS Code AI Assistant

If you’re a Visual Studio Code user, you can install the [Stripe VS Code extension](https://docs.stripe.com/stripe-vscode.md) to access our AI Assistant.

With the Stripe AI Assistant, you can:

* Get immediate answers about the Stripe API and products
* Receive code suggestions tailored to your integration
* Ask follow-up questions for more detailed information
* Access knowledge from the Stripe documentation and the Stripe developer community

To get started with the Stripe AI assistant:

1. Make sure you have the Stripe VS Code extension installed.
1. Navigate to the Stripe extension UI
1. Under **AI Assistant** click **Ask a question**.
   - If you’re a Copilot user, this opens the Copilot chat where you can @-mention `@stripe`. In the input field, talk to the Stripe-specific assistant using `@stripe` followed by your question.
   - If you’re not a Copilot user, it opens a chat UI where you can talk to the Stripe LLM directly.

## Stripe Agent Toolkit SDK

If you’re building agentic software, we provide an SDK for adding Stripe functionality to your agent’s capabilities. For example, using the SDK you can:

* Create Stripe objects
* Charge for agent usage
* Use with popular frameworks such as OpenAI’s Agent SDK, Vercel’s AI SDK, Langchain, and CrewAI

Learn more in our [agents documentation](https://docs.stripe.com/agents.md).

## See Also

* [Stripe for Visual Studio Code](https://docs.stripe.com/stripe-vscode.md)
* [Add Stripe to your agentic workflows](https://docs.stripe.com/agents.md)
