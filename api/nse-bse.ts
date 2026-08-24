import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { NSE, BSE } from 'nse-bse-api';
import { nseTools } from '../src/tools/nse-tools.js';
import { bseTools } from '../src/tools/bse-tools.js';
import { documentTools } from '../src/tools/document-tools.js';
import { handleNseTool } from '../src/handlers/nse-handler.js';
import { handleBseTool } from '../src/handlers/bse-handler.js';
import { handleDocumentTool } from '../src/handlers/document-handler.js';

const nse = new NSE('/tmp/nse-bse-downloads');
const bse = new BSE({ downloadFolder: '/tmp/nse-bse-downloads' });

function createMcpServer() {
  const server = new Server(
    { name: 'nse-bse-mcp-server', version: '1.0.0-vercel' },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [...nseTools, ...bseTools, ...documentTools],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    try {
      if (name.startsWith('nse_')) {
        return await handleNseTool(name, args || {}, nse);
      }
      if (name.startsWith('bse_')) {
        return await handleBseTool(name, args || {}, bse);
      }
      if (name === 'download_document' || name === 'read_document_pages') {
        return await handleDocumentTool(name, args || {});
      }
      throw new Error(`Unknown tool: ${name}`);
    } catch (error: any) {
      return {
        content: [{ type: 'text', text: `Error: ${error?.message || String(error)}` }],
        isError: true,
      };
    }
  });

  return server;
}

export default async function handler(req: any, res: any) {
  if (req.method === 'GET') {
    return res.status(200).json({
      status: 'ok',
      server: 'nse-bse-mcp-server',
      endpoint: '/api/nse-bse',
      tools: nseTools.length + bseTools.length + documentTools.length,
    });
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const accept = String(req.headers.accept || '');
  if (!accept.includes('text/event-stream')) {
    req.headers.accept = 'application/json, text/event-stream';
  }

  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });

  res.on('close', () => {
    transport.close().catch(() => undefined);
  });

  const server = createMcpServer();
  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
}
