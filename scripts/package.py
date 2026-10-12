#!/usr/bin/env python3
"""Create a complete, verified source ZIP without credentials or recursion."""
import argparse,json,hashlib,zipfile
from pathlib import Path
from datetime import datetime,timezone
from publish import ROOT, source_files
from prepare import main as prepare

def main():
 parser=argparse.ArgumentParser();parser.add_argument('--output',type=Path);a=parser.parse_args()
 prepare()
 # Include generated offline docs and the all-30 collection in the distributable,
 # not the recursive website-source ZIP or dependency/build directories.
 files=set(source_files())
 for directory in ['public/docs','public/skills','public/prompts']:
  files.update(p for p in (ROOT/directory).rglob('*') if p.is_file() and '__pycache__' not in p.parts)
 for name in ['public/README.html','public/build-info.json','public/downloads/atelier-all-30.zip',
              'public/downloads/imagination-developer.zip','public/downloads/imagination-atelier-creative-kit.zip']:
  files.add(ROOT/name)
 destination=a.output or ROOT/'public/downloads/portfolio-source.zip';destination=destination.resolve();destination.parent.mkdir(parents=True,exist_ok=True)
 files.discard(destination)
 entries=[]
 for p in sorted(files):
  rel=p.relative_to(ROOT).as_posix();entries.append((p,rel))
 with zipfile.ZipFile(destination,'w',zipfile.ZIP_DEFLATED,compresslevel=9) as z:
  for p,rel in entries:
   mode=0o100755 if rel.endswith('.command') else 0o100644
   info=zipfile.ZipInfo('imagination-atelier/'+rel,(2026,10,12,0,0,0));info.compress_type=zipfile.ZIP_DEFLATED;info.external_attr=mode<<16;z.writestr(info,p.read_bytes())
 with zipfile.ZipFile(destination) as z:
  assert z.testzip() is None
  assert len([n for n in z.namelist() if n.startswith('imagination-atelier/public/works/') and n.endswith('/index.html')])==30
  assert 'imagination-atelier/src/App.tsx' in z.namelist()
 report={'file':destination.name,'size':destination.stat().st_size,'sha256':hashlib.sha256(destination.read_bytes()).hexdigest(),'fileCount':len(entries),'artifactCount':30,'crcVerified':True}
 print(json.dumps(report,ensure_ascii=False,indent=2))
 destination.with_suffix('.zip.sha256').write_text(report['sha256']+'  '+destination.name+'\n')
if __name__=='__main__':main()
