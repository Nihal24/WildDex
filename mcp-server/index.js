const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StreamableHTTPServerTransport } = require('@modelcontextprotocol/sdk/server/streamableHttp.js');
const express = require('express');
const { z } = require('zod');

const app = express();
app.use(express.json());

// Create MCP server with one tool: get_animal_info
function createServer() {
  const server = new McpServer({
    name: 'wilddex-mcp',
    version: '1.0.0',
  });

  server.tool(
    'get_animal_info',
    'Fetches information about an animal from Wikipedia',
    { animal_name: z.string().describe('The name of the animal to look up') },
    async ({ animal_name }) => {
      try {
        const query = encodeURIComponent(animal_name);
        const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${query}`;
        const res = await fetch(url, {
          headers: { 'User-Agent': 'WildDex/1.0 (wildlife identification app)' },
        });

        if (!res.ok) {
          return { content: [{ type: 'text', text: `No Wikipedia article found for "${animal_name}".` }] };
        }

        const data = await res.json();
        const text = [
          `Title: ${data.title}`,
          `Description: ${data.description || 'N/A'}`,
          `Summary: ${data.extract}`,
        ].join('\n\n');

        return { content: [{ type: 'text', text }] };
      } catch (e) {
        return { content: [{ type: 'text', text: `Error fetching animal info: ${e.message}` }] };
      }
    }
  );

  return server;
}

// Handle MCP requests over HTTP
app.post('/mcp', async (req, res) => {
  const server = createServer();
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  res.on('close', () => server.close());
  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`WildDex MCP server running on http://localhost:${PORT}`);
});
