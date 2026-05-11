"""
Network utilities for Locus: IP detection, mDNS service advertisement
"""
import asyncio
import json
import socket
from pathlib import Path

try:
    from zeroconf import IPVersion, ServiceInfo, Zeroconf
except ImportError:
    ServiceInfo = None
    Zeroconf = None


def get_local_ip() -> str | None:
    """Get local LAN IP (192.168.x.x, 10.x.x.x, etc.)"""
    try:
        # Connect to a public DNS to determine local IP
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip if not ip.startswith("127.") else None
    except Exception:
        return None


def get_public_ip() -> str | None:
    """
    Detect public IP by calling a lightweight external service.
    Falls back to local IP if unavailable.
    """
    import httpx

    try:
        # Try to get public IP from ifconfig.me (lightweight, fast)
        with httpx.Client(timeout=3) as client:
            resp = client.get("https://ifconfig.me/ip", follow_redirects=True)
            if resp.status_code == 200:
                ip = resp.text.strip()
                if ip and not ip.startswith("127."):
                    return ip
    except Exception:
        pass

    # Fallback to local IP
    return get_local_ip()


def advertise_mdns(port: int, hostname: str = "locus") -> Zeroconf | None:
    """
    Advertise Locus on local network via mDNS.
    Users can access at: http://locus.local:port
    """
    if not Zeroconf:
        return None

    try:
        local_ip = get_local_ip()
        if not local_ip:
            return None

        # Service: _locus._tcp.local
        service_name = f"{hostname}._locus._tcp.local."
        info = ServiceInfo(
            "_locus._tcp.local.",
            service_name,
            addresses=[socket.inet_aton(local_ip)],
            port=port,
            properties={
                "version": "1.0",
                "path": "/",
                "description": "Locus creative workspace",
            },
            server=f"{hostname}.local.",
        )

        zeroconf = Zeroconf(ip_version=IPVersion.V4Only)
        zeroconf.register_service(info)
        return zeroconf
    except Exception as e:
        print(f"  mDNS registration failed: {e}")
        return None


async def wait_for_public_ip(timeout: int = 5) -> str | None:
    """
    Async wrapper for IP detection with timeout.
    Tries to get public IP, falls back to local IP.
    """
    try:
        loop = asyncio.get_event_loop()
        return await asyncio.wait_for(
            loop.run_in_executor(None, get_public_ip), timeout=timeout
        )
    except asyncio.TimeoutError:
        return get_local_ip()
    except Exception:
        return None
