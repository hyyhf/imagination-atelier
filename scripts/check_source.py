#!/usr/bin/env python3
from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlsplit,unquote
import hashlib,json,subprocess,shutil,zipfile,sys
ROOT=Path(__file__).resolve().parent.parent
class ScriptParser(HTMLParser):
 def __init__(self):super().__init__(convert_charrefs=False);self.scripts=[];self.kind=None;self.parts=[]
 def handle_starttag(self,tag,attrs):
  a=dict(attrs)
  if tag=='script' and not a.get('src') and a.get('type','').lower() in ('','text/javascript','application/javascript','module'):
   self.kind='module' if a.get('type')=='module' else 'commonjs';self.parts=[]
 def handle_data(self,data):
  if self.kind is not None:self.parts.append(data)
 def handle_endtag(self,tag):
  if tag=='script' and self.kind is not None:self.scripts.append((self.kind,''.join(self.parts)));self.kind=None

def main():
 items=json.loads((ROOT/'public/catalog.json').read_text())
 assert sorted(x['number'] for x in items)==list(range(1,31)),'Expected cases 1–30'
 assert len({x['entry'] for x in items})==30,'Duplicate artifacts'
 assert items==json.loads((ROOT/'src/catalog.json').read_text()),'UI catalog differs from release catalog'
 scripts=0;checks=[]
 for item in items:
  for key in ['entry','guide','prompt','record','preview']:
   p=ROOT/'public'/item[key];assert p.is_file() and p.stat().st_size>0,f'Missing {key}: {p}'
  preview=ROOT/'public'/item['preview'];image=preview.read_bytes()
  assert (preview.suffix=='.png' and image.startswith(b'\x89PNG\r\n\x1a\n')) or (preview.suffix in ('.jpg','.jpeg') and image.startswith(b'\xff\xd8\xff') and image.endswith(b'\xff\xd9')),f'Preview format differs from extension: {preview}'
  p=ROOT/'public'/item['entry'];actual=hashlib.sha256(p.read_bytes()).hexdigest()
  assert actual==item['source_sha256'],f'Artifact changed: {item["id"]}'
  text=p.read_text();assert '</html>' in text.lower(),f'Truncated HTML: {p}'
  parser=ScriptParser();parser.feed(text)
  for kind,body in parser.scripts:
   if not body.strip():continue
   if shutil.which('node'):
    result=subprocess.run(['node','--check',f'--input-type={kind}'],input=body,text=True,capture_output=True)
    assert result.returncode==0,f'{item["id"]}: {result.stderr[:500]}'
   scripts+=1
  checks.append({'id':item['id'],'sha256':actual,'integrity':'match'})
 for p in (ROOT/'public/downloads').glob('*.zip'):
  with zipfile.ZipFile(p) as z:assert z.testzip() is None,f'Corrupt download: {p.name}'
 for p in [ROOT/'package.json',ROOT/'package-lock.json',ROOT/'tsconfig.json']:json.loads(p.read_text())
 pkg=json.loads((ROOT/'package.json').read_text());lock=json.loads((ROOT/'package-lock.json').read_text())
 assert pkg['dependencies']==lock['packages']['']['dependencies'],'Locked dependencies differ'
 assert pkg['devDependencies']==lock['packages']['']['devDependencies'],'Locked dev dependencies differ'
 assert (ROOT/'skills/imagination-developer/SKILL.md').is_file()
 assert (ROOT/'LICENSE').read_text().startswith('MIT License')
 report={'workCount':30,'htmlSha256Matches':30,'inlineScriptsSyntaxChecked':scripts if shutil.which('node') else 0,
         'nodeSyntaxAvailable':bool(shutil.which('node')),'includes3D':sum('3D' in w['dimension'] for w in items),
         'buildExecuted':False,'deployed':False,'artifacts':checks}
 (ROOT/'.artifacts').mkdir(exist_ok=True);(ROOT/'.artifacts/source-checks.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
 print(f'PASS: 30 release HTML files (original hashes retained separately); {scripts} inline script blocks; assets, catalogs, locks, ZIP integrity.')

if __name__=='__main__':
 try:main()
 except Exception as e:print(f'FAIL: {e}',file=sys.stderr);sys.exit(1)
