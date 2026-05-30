#!/usr/bin/env python3
"""
prepare_stitch_screenshot.py — Download Stitch screen HTML and serve it locally.

Downloads the HTML from a Stitch screen's htmlCode.downloadUrl using curl (handles
redirects, TLS/SNI, compression), saves it to a local file, and starts a lightweight
HTTP server so Playwright MCP can render it at full resolution (the Stitch
screenshot.downloadUrl only returns tiny thumbnails).

The script prints PID and URL to stdout. The agent then uses Playwright MCP tools
to navigate, check for errors, and take a screenshot. Kill the server via the PID
when done.

Usage:
  python scripts/prepare_stitch_screenshot.py --url <html_url> [--port 8765] [--output tests/screenshots/stitch.html]

  # Then in agent session:
  #   browser_navigate → http://localhost:8765/stitch.html
  #   browser_console_messages → check for errors
  #   browser_network_requests → check for failures
  #   browser_take_screenshot → save screenshot
  #   kill <PID>

Output (stdout):
  PID=<server_pid>
  URL=http://localhost:<port>/stitch.html
"""

import argparse
import http.server
import os
import signal
import socketserver
import subprocess
import sys
import threading
from pathlib import Path

# ── Defaults ──────────────────────────────────────────────────────────────────

DEFAULT_PORT = 8765
DEFAULT_OUTPUT = "tests/screenshots/stitch.html"

# ── Helpers ────────────────────────────────────────────────────────────────────


def download_html(url: str, output_path: str) -> None:
    """Download HTML from URL using curl (handles redirects, TLS/SNI, compression)."""
    out = Path(output_path)
    out.parent.mkdir(parents=True, exist_ok=True)

    print("Downloading HTML from URL...", file=sys.stderr)
    result = subprocess.run(
        [
            "curl", "-L", "-f", "-sS",
            "--connect-timeout", "10",
            "--compressed",
            "-o", str(out),
            url,
        ],
        capture_output=True,
        text=True,
    )

    if result.returncode != 0:
        print(f"Error: curl failed (exit {result.returncode}): {result.stderr}", file=sys.stderr)
        sys.exit(1)

    size = out.stat().st_size
    print(f"Saved {size} bytes to {output_path}", file=sys.stderr)


class ReusableTCPServer(socketserver.TCPServer):
    """HTTP server that allows port reuse (SO_REUSEADDR)."""
    allow_reuse_address = True


def make_handler(directory: str):
    """Create a SimpleHTTPRequestHandler subclass that serves from a fixed directory."""
    class Handler(http.server.SimpleHTTPRequestHandler):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, directory=directory, **kwargs)
    return Handler


def serve_directory(directory: str, port: int) -> http.server.HTTPServer:
    """Start an HTTP server serving directory on the given port. Returns the server."""
    handler = make_handler(directory)
    return ReusableTCPServer(("127.0.0.1", port), handler)


# ── CLI ─────────────────────────────────────────────────────────────────────────


def main():
    parser = argparse.ArgumentParser(
        description="Download Stitch screen HTML and serve it locally for Playwright MCP.",
    )
    parser.add_argument(
        "--url",
        required=True,
        help="HTML download URL from Stitch get_screen response (htmlCode.downloadUrl)",
    )
    parser.add_argument(
        "--port",
        type=int,
        default=DEFAULT_PORT,
        help=f"Local HTTP server port (default: {DEFAULT_PORT})",
    )
    parser.add_argument(
        "-o",
        "--output",
        default=DEFAULT_OUTPUT,
        help=f"Output path for downloaded HTML (default: {DEFAULT_OUTPUT})",
    )
    args = parser.parse_args()

    # Download
    download_html(args.url, args.output)

    # Figure out directory and filename for serving
    output = Path(args.output).resolve()
    serve_dir = str(output.parent)
    filename = output.name

    # Start HTTP server in background thread
    server = serve_directory(serve_dir, args.port)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()

    local_url = f"http://localhost:{args.port}/{filename}"
    pid = os.getpid()

    # Print machine-readable output to stdout
    print(f"PID={pid}")
    print(f"URL={local_url}")

    # Print human-readable info to stderr
    print(f"\nServing {filename} at {local_url}", file=sys.stderr)
    print(f"Server PID: {pid}", file=sys.stderr)
    print("Press Ctrl+C to stop the server.", file=sys.stderr)

    try:
        signal.pause()  # Wait forever until SIGINT
    except (KeyboardInterrupt, SystemExit):
        print("\nShutting down server...", file=sys.stderr)
        server.shutdown()


if __name__ == "__main__":
    main()