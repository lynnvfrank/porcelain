"""
Lightweight relay server for remote access (away from home WiFi).
Tunnels connections back to Locus via WebSocket.

Runs on port 9999 by default (configurable via LOCUS_RELAY_PORT).
Clients away from home connect to: home_public_ip:9999
Relay tunnels back to localhost:11435 (Locus)
"""
import asyncio
import json
import logging
import os
from pathlib import Path
from typing import Dict, Set

# Configure logging to file (silent startup mode)
LOG_DIR = Path(__file__).parent.parent / ".data" / "logs"
LOG_DIR.mkdir(parents=True, exist_ok=True)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(LOG_DIR / "relay.log", encoding="utf-8"),
    ]
)

logger = logging.getLogger(__name__)

try:
    import websockets
    from websockets.server import WebSocketServerProtocol
except ImportError:
    websockets = None
    WebSocketServerProtocol = None


RELAY_PORT = int(os.environ.get("LOCUS_RELAY_PORT", "9999"))
RELAY_TOKEN = os.environ.get("LOCUS_RELAY_TOKEN", "")  # Generated at startup
LOCUS_HOST = "127.0.0.1"
LOCUS_PORT = int(os.environ.get("CLAUDIA_PWA_PORT", "11435"))

# Track active relay sessions
ACTIVE_SESSIONS: Dict[str, asyncio.StreamWriter] = {}


async def handle_relay_client(websocket: WebSocketServerProtocol, path: str):
    """
    Handle incoming relay client connection.
    Client connects with token in first message.
    Relay tunnels HTTP/WebSocket traffic back to Locus.
    """
    session_id = None
    locus_reader = None
    locus_writer = None

    try:
        # First message: authentication with token
        first_msg = await websocket.recv()
        try:
            auth_data = json.loads(first_msg)
            token = auth_data.get("token", "").strip()
            device_name = auth_data.get("device", "unknown")
        except json.JSONDecodeError:
            # Fallback: treat as raw HTTP request, accept all
            token = RELAY_TOKEN or "any"
            device_name = "legacy"

        # Validate token
        if RELAY_TOKEN and token != RELAY_TOKEN:
            await websocket.send(json.dumps({"error": "invalid_token"}))
            return

        session_id = f"{device_name}_{id(websocket)}"
        ACTIVE_SESSIONS[session_id] = websocket

        # Connect to Locus
        locus_reader, locus_writer = await asyncio.open_connection(LOCUS_HOST, LOCUS_PORT)

        # Send success
        await websocket.send(
            json.dumps({
                "status": "connected",
                "session": session_id,
                "device": device_name,
            })
        )

        # Bidirectional relay loop
        relay_task = asyncio.create_task(
            relay_from_websocket_to_locus(websocket, locus_writer)
        )
        locus_task = asyncio.create_task(relay_from_locus_to_websocket(locus_reader, websocket))

        await asyncio.gather(relay_task, locus_task)

    except websockets.exceptions.ConnectionClosed:
        pass
    except Exception as e:
        try:
            await websocket.send(json.dumps({"error": str(e)}))
        except Exception:
            pass
    finally:
        if session_id and session_id in ACTIVE_SESSIONS:
            del ACTIVE_SESSIONS[session_id]
        if locus_writer:
            locus_writer.close()
            await locus_writer.wait_closed()


async def relay_from_websocket_to_locus(
    websocket: WebSocketServerProtocol, locus_writer
):
    """Forward messages from WebSocket client to Locus TCP connection."""
    try:
        async for message in websocket:
            if isinstance(message, bytes):
                locus_writer.write(message)
            else:
                locus_writer.write(message.encode("utf-8"))
            await locus_writer.drain()
    except Exception:
        pass


async def relay_from_locus_to_websocket(locus_reader, websocket: WebSocketServerProtocol):
    """Forward data from Locus TCP connection back to WebSocket client."""
    try:
        while True:
            data = await locus_reader.readexactly(1024)
            if not data:
                break
            await websocket.send(data)
    except asyncio.IncompleteReadError:
        pass
    except Exception:
        pass


async def start_relay_server(token: str):
    """Start the relay server. Call from Locus startup."""
    global RELAY_TOKEN
    RELAY_TOKEN = token

    if not websockets:
        print(
            f"  {chr(27)}[93m⚠  Relay server skipped (websockets not installed){chr(27)}[0m"
        )
        return None

    try:
        server = await websockets.serve(handle_relay_client, "0.0.0.0", RELAY_PORT)
        return server
    except Exception as e:
        print(f"  {chr(27)}[91m✗ Relay server failed: {e}{chr(27)}[0m")
        return None


def relay_is_available() -> bool:
    """Check if relay server can start (websockets installed)."""
    return websockets is not None
