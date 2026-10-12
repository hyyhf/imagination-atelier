#!/usr/bin/env python3
"""Real Chromium checks. Initial artifact loading is NOT exhaustive interaction testing."""
from __future__ import annotations
import argparse,functools,json,re,shutil,threading,time
from pathlib import Path
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from datetime import datetime,timezone
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parent.parent
class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*args):pass

def main():
 p=argparse.ArgumentParser();p.add_argument('--site',type=Path);p.add_argument('--artifacts',action='store_true');p.add_argument('--offline',action='store_true');p.add_argument('--start',type=int,default=1);p.add_argument('--end',type=int,default=30);a=p.parse_args()
 output=ROOT/'.artifacts/browser';output.mkdir(parents=True,exist_ok=True)
 host=None;server_thread=None;site=None
 if a.site:
  site=(ROOT/a.site).resolve();host=ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(site)))
  server_thread=threading.Thread(target=host.serve_forever,daemon=True);server_thread.start();base=f'http://127.0.0.1:{host.server_port}/'
 else:site=ROOT/'public';base=site.as_uri()+'/'
 items=json.loads((ROOT/'public/catalog.json').read_text());report={'time':datetime.now(timezone.utc).isoformat(),'browser':'Chromium','scope':'initial artifact loading; offline catalog; optional built React gallery interactions','siteTests':None,'artifacts':[]}
 with sync_playwright() as pw:
  exe=shutil.which('chromium') or shutil.which('chromium-browser')
  kwargs={'headless':True,'args':['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']}
  if exe:kwargs['executable_path']=exe
  browser=pw.chromium.launch(**kwargs)
  try:
   page=browser.new_page(viewport={'width':1440,'height':1000},device_scale_factor=1,reduced_motion='reduce',locale='zh-CN')
   if a.offline:
    page.context.set_offline(True)
    page.goto(base+'START.html',wait_until='load');page.locator('.work-card').last.wait_for()
    assert page.locator('.work-card:visible').count()==30
    page.get_by_role('button',name=re.compile('科学实验室')).click();assert page.locator('.work-card:visible').count()==10
    page.get_by_role('button',name=re.compile('全部作品')).click()
    page.get_by_role('searchbox',name='搜索作品').fill('数据会说话');assert page.locator('.work-card:visible').count()==1
    page.get_by_role('searchbox',name='搜索作品').fill('')
    page.screenshot(path=str(output/'offline-catalog-desktop.jpg'),type='jpeg',quality=86)
    page.set_viewport_size({'width':390,'height':844});page.screenshot(path=str(output/'offline-catalog-mobile.jpg'),type='jpeg',quality=86)
    assert page.evaluate('document.documentElement.scrollWidth <= window.innerWidth+1'),'Horizontal overflow on offline mobile catalog'
    report['siteTests']={'mode':'offline-catalog','allCards':30,'seriesFilter':10,'searchResult':1,'mobileOverflow':False}
   elif a.site:
    errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto(base,wait_until='networkidle');page.locator('.work-card').first.wait_for()
    assert page.locator('.work-card').count()==30,'Expected all works by default'
    page.get_by_role('button',name=re.compile('科学实验室')).click();assert page.locator('.work-card').count()==10
    page.get_by_role('button',name=re.compile('全部作品')).click();assert page.locator('.work-card').count()==30
    page.get_by_role('searchbox',name='搜索作品').fill('数据会说话');assert page.locator('.work-card').count()==1
    page.get_by_role('button',name='查看数据会说话',exact=True).click()
    page.get_by_role('dialog').wait_for();page.get_by_role('tab',name='制作提示词',exact=True).click()
    page.get_by_role('textbox',name='独立制作提示词',exact=True).wait_for()
    assert len(page.get_by_role('textbox',name='独立制作提示词',exact=True).input_value())>100
    page.get_by_role('button',name='关闭案例',exact=True).click()
    page.get_by_role('searchbox',name='搜索作品').fill('')
    page.screenshot(path=str(output/'react-gallery-desktop.jpg'),type='jpeg',quality=86)
    page.set_viewport_size({'width':390,'height':844});page.screenshot(path=str(output/'react-gallery-mobile.jpg'),type='jpeg',quality=86)
    assert page.evaluate('document.documentElement.scrollWidth <= window.innerWidth+1'),'Horizontal overflow'
    assert not errors,'React page exceptions: '+repr(errors)
    report['siteTests']={'mode':'built-react','defaultCards':30,'scienceCards':10,'allCards':30,'search':True,'modal':True,'promptLoaded':True,'mobileOverflow':False,'pageErrors':errors}
   page.close()
   if a.artifacts:
    for item in items:
     if not a.start<=item['number']<=a.end:continue
     page=browser.new_page(viewport={'width':1440,'height':960},device_scale_factor=1,reduced_motion='reduce',locale='zh-CN')
     errors=[];page.on('pageerror',lambda error:errors.append(str(error)))
     if a.offline:page.context.set_offline(True)
     entry={'id':item['id'],'number':item['number']};started=time.monotonic()
     try:
      page.goto(base+item['entry'],wait_until='load',timeout=30000)
      page.wait_for_timeout(1400)
      body=page.locator('body').inner_text();assert len(body.strip())>35,'Empty application body'
      entry.update({'title':page.title(),'textLength':len(body),'canvasCount':page.locator('canvas').count(),'pageErrors':errors,'initialLoad':'pass' if not errors else 'fail'})
      path=output/f'{item["id"]}-browser.jpg';page.screenshot(path=str(path),type='jpeg',quality=84);entry['screenshot']=path.name
     except Exception as e:entry.update({'initialLoad':'fail','error':str(e)[:1000],'pageErrors':errors})
     entry['seconds']=round(time.monotonic()-started,2);report['artifacts'].append(entry);page.close()
     print(item['id'],entry['initialLoad'],entry.get('pageErrors',[]),flush=True)
     (output/f'report-{a.start}-{a.end}.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
  finally:
   browser.close()
   if host:host.shutdown();host.server_close()
 report['pass']=all(x['initialLoad']=='pass' for x in report['artifacts'])
 (output/f'report-{a.start}-{a.end}.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
 if not report['pass']:raise SystemExit('Artifact startup errors found; see report')

if __name__=='__main__':main()
