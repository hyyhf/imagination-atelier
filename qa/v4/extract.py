from pathlib import Path
from html.parser import HTMLParser
import json
ROOT=Path(__file__).resolve().parents[2]
class Parser(HTMLParser):
 def __init__(self):super().__init__(convert_charrefs=False);self.active=False;self.blocks=[];self.text=[];self.kind=''
 def handle_starttag(self,tag,attrs):
  if tag=='script':self.active=True;self.kind=dict(attrs).get('type','');self.text=[]
 def handle_data(self,data):
  if self.active:self.text.append(data)
 def handle_endtag(self,tag):
  if tag=='script'and self.active:self.blocks.append({'type':self.kind,'text':''.join(self.text)});self.active=False
for p in sorted((ROOT/'public/works').glob('*/index.html')):
 parser=Parser();parser.feed(p.read_text());out=ROOT/'.artifacts/v4-blocks'/p.parent.name;out.mkdir(parents=True,exist_ok=True);(out/'blocks-final.json').write_text(json.dumps(parser.blocks,ensure_ascii=False))
print('Extracted executable scripts from final 30 HTML files')
