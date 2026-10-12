#!/usr/bin/env python3
from __future__ import annotations
import argparse,hashlib,json,time
from html.parser import HTMLParser
from urllib.request import Request,urlopen
from urllib.parse import urljoin,urlsplit

class Assets(HTMLParser):
    def __init__(self):super().__init__();self.items=[];self.has_root=False
    def handle_starttag(self,tag,attrs):
        attrs=dict(attrs)
        if attrs.get('id')=='root':self.has_root=True
        if tag=='script' and attrs.get('src'):self.items.append(attrs['src'])
        if tag=='link' and attrs.get('rel')=='stylesheet':self.items.append(attrs['href'])

def verify_live(base: str, sha: str, attempts: int = 1) -> dict:
    base=base.rstrip('/')+'/'
    if urlsplit(base).scheme not in ('https','http'):raise ValueError('Expected HTTP(S) URL')
    def read(path):
        target=urljoin(base,path)
        if urlsplit(target).netloc != urlsplit(base).netloc:raise ValueError('Refusing off-origin resource verification')
        req=Request(target,headers={'Cache-Control':'no-cache','User-Agent':'Imagination-Atelier-Release-Check'})
        with urlopen(req,timeout=40) as r:
            if r.status != 200:raise ValueError(f'Unexpected status {r.status}')
            return r.read()
    error=None
    for i in range(attempts):
        try:
            info=json.loads(read('build-info.json?revision='+sha))
            if info.get('sha')!=sha:raise ValueError('Live commit does not match the pushed commit')
            index=read('index.html').decode();parser=Assets();parser.feed(index)
            if not parser.has_root or not parser.items:raise ValueError('Missing React entry or compiled assets')
            for path in parser.items:
                data=read(path)
                if not data or data.lstrip().startswith(b'<!doctype'):raise ValueError('Asset returns empty data or fallback HTML')
            catalog=json.loads(read('catalog.json'))
            if sorted(w['number'] for w in catalog)!=list(range(1,31)):raise ValueError('Expected exactly cases 1–30')
            for item in catalog:
                data=read(item['entry'])
                if hashlib.sha256(data).hexdigest()!=item['source_sha256']:raise ValueError('Artifact hash mismatch: '+item['id'])
                image=read(item['preview'])
                suffix=urlsplit(item['preview']).path.rsplit('.',1)[-1].lower()
                valid_png=suffix=='png' and image.startswith(b'\x89PNG\r\n\x1a\n')
                valid_jpeg=suffix in ('jpg','jpeg') and image.startswith(b'\xff\xd8\xff') and image.endswith(b'\xff\xd9')
                if not (valid_png or valid_jpeg):raise ValueError('Invalid preview image or extension: '+item['id'])
            for path in ['START.html','README.html','downloads/meta-prompt.txt']:
                if not read(path):raise ValueError('Empty resource '+path)
            result={'sha':sha,'workCount':30,'assetCount':len(parser.items),'artifactHashes':'30/30 match','url':base}
            print(json.dumps(result,ensure_ascii=False,indent=2));return result
        except Exception as e:
            error=e
            if i+1<attempts:time.sleep(10)
    raise RuntimeError(f'Live verification failed: {error}')

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--url',required=True);p.add_argument('--sha',required=True);p.add_argument('--attempts',type=int,default=8);a=p.parse_args();verify_live(a.url,a.sha,a.attempts)
