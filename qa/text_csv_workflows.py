"""HTTP user inputs and downloaded output acceptance; no application globals."""
import csv,io,json
from pathlib import Path
from playwright.sync_api import expect
ROOT=Path(__file__).resolve().parent.parent

def download(page,button,path):
 with page.expect_download() as event:button.click()
 event.value.save_as(path)
 assert path.is_file() and path.stat().st_size>0
 return path

def choose(page,button,path):
 with page.expect_file_chooser() as event:button.click()
 event.value.set_files(str(path))

def verify(page,base,output):
 page.set_viewport_size({'width':1440,'height':960})
 page.goto(base+'works/08-csv-cleaner/index.html',wait_until='load')
 page.get_by_role('button',name='导入 / 粘贴',exact=True).click()
 choose(page,page.get_by_role('button',name='选择 CSV / TSV 文件',exact=True),ROOT/'qa/fixtures/08-csv-cleaner/batch-a.csv')
 expect(page.locator('#valid')).to_have_text('3')
 page.get_by_role('button',name='查看原记录 2 batch-a.csv',exact=True).click()
 page.get_by_role('textbox',name='修正 邮箱',exact=True).fill('beta@example.com')
 page.get_by_role('textbox',name='修正 登记日期',exact=True).fill('2026/02/28')
 page.get_by_role('button',name='修正原值并重跑',exact=True).click()
 expect(page.locator('#valid')).to_have_text('4')
 exported=download(page,page.get_by_role('button',name='导出结果 CSV',exact=True),output/'own-cleaned.csv')
 rows=list(csv.DictReader(io.StringIO(exported.read_text(encoding='utf-8-sig'))))
 assert len(rows)==4 and rows[0]['编号']=='00123' and rows[0]['金额']=='1.01'
 assert rows[-1]['金额']=='9007199254740993.01' and '\n' in rows[0]['备注']
 assert rows[1]['邮箱']=='beta@example.com' and rows[1]['登记日期']=='2026-02-28'
 saved=download(page,page.get_by_role('button',name='保存方案',exact=True),output/'own-cleaning-plan.json')
 payload=json.loads(saved.read_text(encoding='utf-8'))
 assert payload['sources'][0]['rows'][1]['raw']['邮箱']=='beta-at-example.com'
 assert len(payload['rules'])==8 and payload['overrides']
 page.get_by_role('button',name='下一批，保留规则',exact=True).click()
 choose(page,page.get_by_role('button',name='选择 CSV / TSV 文件',exact=True),ROOT/'qa/fixtures/08-csv-cleaner/batch-b.csv')
 expect(page.locator('#valid')).to_have_text('2')
 nextfile=download(page,page.get_by_role('button',name='导出结果 CSV',exact=True),output/'next-cleaned.csv')
 nextrows=list(csv.DictReader(io.StringIO(nextfile.read_text(encoding='utf-8-sig'))))
 assert len(nextrows)==2 and nextrows[0]['编号']=='00701' and nextrows[0]['金额']=='2.68'
 choose(page,page.get_by_role('button',name='打开方案',exact=True),saved)
 expect(page.locator('#valid')).to_have_text('4')

 page.goto(base+'works/09-text-compare/index.html',wait_until='load')
 page.get_by_role('button',name='导入 / 粘贴两份文稿',exact=True).click()
 choose(page,page.get_by_role('button',name='选择原稿文件',exact=True),ROOT/'qa/fixtures/09-text-compare/draft-a.txt')
 choose(page,page.get_by_role('button',name='选择修订稿文件',exact=True),ROOT/'qa/fixtures/09-text-compare/revision-b.md')
 page.get_by_role('button',name='建立对比',exact=True).click()
 expect(page.locator('#pending')).to_have_text('4')
 expect(page.get_by_role('button',name='导出确认合稿',exact=True)).to_be_disabled()
 page.locator('#nav button').first.click()
 page.get_by_role('textbox',name='自定义合稿文字',exact=True).fill('交付：首稿在 5 天内发出，周末顺延。\n')
 page.get_by_role('textbox',name='审校备注',exact=True).fill('负责人确认五天。')
 page.get_by_role('button',name='采用自定义文字',exact=True).click()
 page.get_by_role('button',name='接受所有待审',exact=True).click()
 expect(page.locator('#pending')).to_have_text('0')
 merged=download(page,page.get_by_role('button',name='导出确认合稿',exact=True),output/'own-confirmed.txt')
 raw=merged.read_bytes();assert b'\r\n' in raw and b'\n' not in raw.replace(b'\r\n',b'')
 assert '5 天' in raw.decode() and '保存书面记录' in raw.decode() and '每轮需电话' not in raw.decode()
 plan=download(page,page.get_by_role('button',name='保存方案',exact=True),output/'own-review-plan.json')
 assert '负责人确认五天' in plan.read_text(encoding='utf-8')
 report=download(page,page.get_by_role('button',name='导出审校报告',exact=True),output/'own-review-report.html')
 assert '负责人确认五天' in report.read_text(encoding='utf-8') and 'A&amp;B &lt;团队&gt;' in report.read_text(encoding='utf-8')
 page.get_by_role('button',name='用合稿开始下一版',exact=True).click()
 choose(page,page.get_by_role('button',name='选择修订稿文件',exact=True),ROOT/'qa/fixtures/09-text-compare/revision-c.txt')
 page.get_by_role('button',name='建立对比',exact=True).click()
 page.get_by_role('button',name='接受所有待审',exact=True).click()
 nexttext=download(page,page.get_by_role('button',name='导出确认合稿',exact=True),output/'own-next-confirmed.txt')
 raw=nexttext.read_bytes();assert b'\r\n' in raw and b'\n' not in raw.replace(b'\r\n',b'')
 assert '保留两年' in raw.decode() and '校验清单' in raw.decode()
 choose(page,page.get_by_role('button',name='打开方案',exact=True),plan)
 expect(page.locator('#pending')).to_have_text('0')
 page.get_by_role('button',name='撤销',exact=True).click()
 assert '保留两年' in page.locator('#review').inner_text()
 return {'csvOwnInputsAndExactDecimals':True,'csvOriginalsAndCorrectionsRetained':True,'csvSecondBatchAndFileRestore':True,'textNativeInputsAndManualMerge':True,'textActualDownloadsAndCRLFAcrossRevisions':True,'textFileRestoreUndo':True,'scope':'HTTP UI and real downloaded files; not file protocol evidence'}
