"""Check production startup without contacting external services."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from tempfile import TemporaryDirectory
from threading import Thread
from urllib.parse import urlparse
import json

from playwright.sync_api import sync_playwright

dist = Path("dist").resolve()
if not (dist / "index.html").is_file():
    raise SystemExit("Build dist/index.html before running this check.")

diagnostics = Path("test-results/browser-smoke")
diagnostics.mkdir(parents=True, exist_ok=True)
errors = []
local_failures = []

with TemporaryDirectory() as site:
    # Match Vite's production base path instead of serving the app at /.
    (Path(site) / "escape-the-city").symlink_to(dist, target_is_directory=True)
    handler = partial(SimpleHTTPRequestHandler, directory=site)
    server = ThreadingHTTPServer(("127.0.0.1", 0), handler)
    thread = Thread(target=server.serve_forever, daemon=True)
    thread.start()
    origin = f"http://127.0.0.1:{server.server_port}"
    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch()
            context = browser.new_context(service_workers="block")
            # Keep the test independent of Supabase, maps, and external fonts.
            def route_request(route):
                url = route.request.url
                if url.startswith(origin + "/"):
                    route.continue_()
                else:
                    route.abort()

            context.route("**/*", route_request)
            page = context.new_page()
            page.on("pageerror", lambda error: errors.append(str(error)))
            page.on("response", lambda response: local_failures.append(
                f"{response.status} {response.url}"
            ) if response.url.startswith(origin + "/") and response.status >= 400 else None)
            page.on("requestfailed", lambda request: local_failures.append(
                f"{request.failure} {request.url}"
            ) if request.url.startswith(origin + "/") else None)
            try:
                page.goto(origin + "/escape-the-city/", wait_until="load")
                page.wait_for_function(
                    "document.querySelector('#root')?.children.length > 0",
                    timeout=15000,
                )
                # Observe delayed startup errors without waiting on blocked services.
                page.wait_for_timeout(3000)
                if errors or local_failures:
                    raise RuntimeError("Browser startup failed: " + "; ".join(errors + local_failures))
                print("Production app rendered with no uncaught JavaScript errors.")
            finally:
                (diagnostics / "errors.json").write_text(
                    json.dumps({"pageErrors": errors, "localAssetFailures": local_failures}, indent=2),
                    encoding="utf-8",
                )
                (diagnostics / "page.html").write_text(page.content(), encoding="utf-8")
                page.screenshot(path=str(diagnostics / "startup.png"), full_page=True)
                context.close()
                browser.close()
    finally:
        server.shutdown()
        server.server_close()
        thread.join()
