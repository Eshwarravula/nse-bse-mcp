from mcp.server.transport_security import TransportSecuritySettings
from nsekit_mcp.server_async import mcp

app = mcp.streamable_http_app(
    streamable_http_path="/api/nsekit",
    stateless_http=True,
    json_response=True,
    transport_security=TransportSecuritySettings(
        enable_dns_rebinding_protection=False,
    ),
)
