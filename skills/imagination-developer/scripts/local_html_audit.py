#!/usr/bin/env python3
"""Static evidence for a finished local HTML artifact; never a browser test.

Usage: python3 local_html_audit.py path/to/index.html [more HTML files]
Only Python's standard library is required. Node, if available, checks JS syntax.
The audit reads files but does not execute application code or access the network.
"""
from __future__ import annotations

import argparse
import collections
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import shutil
import subprocess
import sys
from urllib.parse import unquote, urlsplit


class Document(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.ids = []
        self.refs = []
        self.scripts = []
        self.styles = []
        self.lang = None
        self.title = []
        self.doctype = False
        self.html = False
        self.body = False
        self.active = None
        self.parts = []

    def handle_decl(self, decl):
        if decl.lower().startswith('doctype html'):
            self.doctype = True

    def handle_starttag(self, tag, attributes):
        a = dict(attributes)
        if 'id' in a:
            self.ids.append(a['id'])
        if tag == 'html':
            self.html, self.lang = True, a.get('lang')
        if tag == 'body':
            self.body = True
        if tag == 'script':
            self.active, self.parts = ('script', a), []
        elif tag == 'style' or (tag == 'title' and not self.body):
            self.active, self.parts = (tag, a), []
        if a.get('style'):
            self.styles.append(a['style'])
        for attr in ('src', 'poster', 'href'):
            if a.get(attr):
                # Links to source material are citations, not runtime dependencies.
                dependency = not (tag == 'a' and attr == 'href')
                self.refs.append((tag, attr, a[attr], dependency))

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        self.handle_endtag(tag)

    def handle_data(self, data):
        if self.active:
            self.parts.append(data)

    def handle_endtag(self, tag):
        if self.active and self.active[0] == tag:
            text = ''.join(self.parts)
            if tag == 'script':
                self.scripts.append((self.active[1], text))
            elif tag == 'style':
                self.styles.append(text)
            elif tag == 'title':
                self.title.append(text)
            self.active, self.parts = None, []


def audit(path: Path, node: str | None):
    result = {'file': str(path), 'errors': [], 'review': [], 'checks': {}}
    errors, review, checks = result['errors'], result['review'], result['checks']
    try:
        content = path.read_text(encoding='utf-8-sig')
    except (OSError, UnicodeError) as exc:
        errors.append(f'Cannot read UTF-8 HTML: {exc}')
        return result
    doc = Document()
    doc.feed(content)
    checks['bytes'] = path.stat().st_size
    checks['html_document'] = doc.doctype and doc.html and doc.body
    if not checks['html_document']:
        errors.append('Missing HTML document structure: doctype, html or body.')
    if not doc.lang:
        review.append('No document language declared.')
    checks['title'] = ''.join(doc.title).strip()
    if not checks['title']:
        review.append('Missing meaningful document title.')
    duplicates = [k for k, n in collections.Counter(doc.ids).items() if n > 1]
    checks['duplicate_ids'] = duplicates
    if duplicates:
        errors.append('Duplicate element IDs: ' + ', '.join(duplicates))

    for style in doc.styles:
        for match in re.finditer(r'url\(\s*([\'"]?)(.*?)\1\s*\)', style, re.I | re.S):
            doc.refs.append(('css', 'url', match.group(2).strip(), True))
        if re.search(r'@import\b', style, re.I):
            review.append('CSS @import exists; resolve and inspect its dependencies.')

    external = []
    local = []
    for tag, attr, ref, dependency in doc.refs:
        if ref.startswith('#'):
            continue
        parsed = urlsplit(ref)
        scheme = parsed.scheme.lower()
        if scheme in ('data', 'mailto', 'tel'):
            continue
        if scheme in ('http', 'https') or parsed.netloc:
            if dependency:
                external.append(ref)
            continue
        if scheme:
            review.append(f'Review nonportable or dynamic URL in {tag}.{attr}: {scheme}:')
            continue
        name = unquote(parsed.path)
        if not name:
            continue
        if name.startswith('/') or '\\' in name:
            review.append(f'Review nonportable path in {tag}.{attr}: {name}')
        resolved = path.parent / name
        if not resolved.is_file():
            errors.append(f'Missing relative file in {tag}.{attr}: {name}')
        else:
            local.append(str(resolved.resolve()))
    checks['external_resource_urls'] = sorted(set(external))
    checks['relative_files_found'] = sorted(set(local))
    if external:
        review.append('Remote resources exist. This is not evidence of offline availability.')

    js = []
    for number, (attrs, body) in enumerate(doc.scripts, 1):
        kind = attrs.get('type', '').lower().strip()
        if kind and kind not in ('module', 'text/javascript', 'application/javascript'):
            continue
        if kind == 'module':
            review.append(f'Script {number} is a module; verify the exact final file:// delivery.')
        if attrs.get('src'):
            src = urlsplit(attrs['src'])
            if not src.scheme and not src.netloc:
                script_path = path.parent / unquote(src.path)
                if script_path.is_file():
                    body = script_path.read_text(encoding='utf-8-sig')
                else:
                    continue
            else:
                continue
        if not body.strip():
            continue
        entry = {'script': number, 'syntax': 'not_run'}
        if node:
            args = [node, '--check']
            if kind == 'module':
                args += ['--input-type=module']
            proc = subprocess.run(args, input=body, text=True, capture_output=True, timeout=30)
            entry['syntax'] = 'pass' if proc.returncode == 0 else 'fail'
            if proc.returncode:
                entry['detail'] = proc.stderr.strip()
                errors.append(f'JavaScript syntax error in script {number}.')
        hints = []
        for label, pattern in (
            ('network_or_local_fetch', r'\b(?:fetch|XMLHttpRequest|WebSocket|EventSource)\b'),
            ('dynamic_import', r'\bimport\s*\('),
            ('browser_storage', r'\b(?:localStorage|sessionStorage|indexedDB)\b'),
            ('device_audio_or_graphics', r'\b(?:AudioContext|webkitAudioContext|getUserMedia|webgl)\b'),
            ('dynamic_worker', r'\b(?:Worker|serviceWorker)\b'),
        ):
            if re.search(pattern, body):
                hints.append(label)
        entry['textual_hints_for_review'] = hints
        js.append(entry)
    checks['javascript'] = js
    checks['node_syntax_available'] = bool(node)
    if not node:
        review.append('Node unavailable: JavaScript syntax was not checked.')
    result['static_status'] = 'issues_found' if errors else 'no_detected_errors'
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('html', nargs='+', type=Path)
    args = parser.parse_args()
    results = [audit(p.resolve(), shutil.which('node')) for p in args.html]
    print(json.dumps({
        'scope': 'Static structure and optional JS syntax only. No browser, visual, accessibility, offline-runtime or functional certification. Textual hints can include comments or inactive code.',
        'artifacts': results,
    }, ensure_ascii=False, indent=2))
    return 1 if any(r['errors'] for r in results) else 0


if __name__ == '__main__':
    sys.exit(main())
