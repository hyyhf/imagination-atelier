#!/usr/bin/env python3
from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlsplit,unquote
import json,hashlib,zipfile
ROOT=Path(__file__).resolve().parent.parent
class Parse(HTMLParser):
 def __init__(self):super().__init__();self.paths=[];self.root=False
 def handle_starttag(self,tag,attrs):
  a=dict(attrs)
  if a.get('id')=='root':self.root=True
  if tag=='script' and a.get('src'):self.paths.append(a['src'])
  if tag=='link' and a.get('rel')=='stylesheet':self.paths.append(a['href'])

def main():
 dist=ROOT/'dist';parser=Parse();parser.feed((dist/'index.html').read_text())
 assert parser.root and parser.paths,'Missing actual React production output'
 for uri in parser.paths:
  url=urlsplit(uri);assert not url.scheme and not url.netloc,'Unexpected CDN dependency'
  path=unquote(url.path)
  if '/assets/' in path:path='assets/'+path.split('/assets/',1)[1]
  assert (dist/path.lstrip('/')).is_file(),f'Missing built asset: {uri}'
 catalog=json.loads((dist/'catalog.json').read_text());assert len(catalog)==30
 for w in catalog:
  assert hashlib.sha256((dist/w['entry']).read_bytes()).hexdigest()==w['source_sha256']
  for field in ['guide','prompt','record','preview']:assert (dist/w[field]).is_file()
 for filename in ['START.html','README.html','build-info.json','.nojekyll']:
  assert (dist/filename).is_file(),f'Missing {filename}'
 for filename in ['portfolio-source.zip','atelier-all-30.zip','atelier-science.zip','atelier-practical.zip','atelier-explore.zip','imagination-developer-v4.0.zip','imagination-developer.zip','imagination-atelier-creative-kit.zip']:
  with zipfile.ZipFile(dist/'downloads'/filename) as z:assert z.testzip() is None,filename
 with zipfile.ZipFile(dist/'downloads/imagination-atelier-creative-kit.zip') as z:
  assert z.read('meta-prompt.txt')==(ROOT/'prompts/full-meta-prompt.txt').read_bytes()
  assert z.read('imagination-developer/SKILL.md')==(ROOT/'skills/imagination-developer/SKILL.md').read_bytes()
 print('PASS: compiled React entry, all local assets, 30 verified artifacts, offline documentation and current creative kit.')
if __name__=='__main__':main()
