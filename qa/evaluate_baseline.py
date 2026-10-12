"""CI-only real-download acceptance of the frozen same-task baseline."""
import asyncio
import functools
import importlib.util
import json
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import threading
from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parent.parent
BASELINE = ROOT / 'qa/evaluations/photo-baseline'


class Quiet(SimpleHTTPRequestHandler):
    def log_message(self, *_args):
        pass


async def main():
    host = ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Quiet, directory=str(BASELINE)))
    threading.Thread(target=host.serve_forever, daemon=True).start()
    spec = importlib.util.spec_from_file_location('baseline_verify', BASELINE / 'verify_browser.py')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    try:
        async with async_playwright() as pw:
            browser = await pw.chromium.launch(headless=True)
            try:
                page = await browser.new_page(viewport={'width':1280,'height':800}, locale='zh-CN')
                errors = []
                page.on('pageerror', lambda error: errors.append(str(error)))
                result = await module.verify(page, f'http://127.0.0.1:{host.server_port}', ROOT / '.artifacts/baseline-browser')
                assert not errors, errors
                print(json.dumps(result, ensure_ascii=False))
            finally:
                await browser.close()
    finally:
        host.shutdown()


if __name__ == '__main__':
    asyncio.run(main())
