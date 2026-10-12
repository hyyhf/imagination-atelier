"""Run only in CI using Playwright. Tests real file-picker and download boundaries.
Usage: await verify(page, 'http://127.0.0.1:8766', pathlib.Path('results'))
Dependencies: playwright, Pillow. This script is not run by the local agent.
"""
from pathlib import Path
import io, json, zipfile
from PIL import Image

async def verify(page, base, output):
    output = Path(output)
    output.mkdir(parents=True, exist_ok=True)
    fixtures = Path(__file__).resolve().parents[2] / 'fixtures/photo'
    await page.goto(base.rstrip('/') + '/index.html')
    async with page.expect_file_chooser() as chooser:
        await page.get_by_role('button', name='选择这一批照片', exact=True).click()
    await (await chooser.value).set_files([str(fixtures/'mug.png'), str(fixtures/'lamp.png')])
    await page.get_by_text('2 张照片 × 3 种规格 = 6 张图片', exact=True).wait_for()
    await page.get_by_role('button', name='裁切铺满', exact=True).click()
    for _ in range(30):
        await page.locator('#zoom').press('ArrowRight')
    for _ in range(40):
        await page.locator('#panX').press('ArrowRight')
    await page.get_by_label('方图宽度', exact=True).fill('1000')
    await page.get_by_label('方图宽度', exact=True).press('Tab')
    assert await page.locator('#zoom').input_value() == '130'
    assert await page.locator('#panX').input_value() == '40'
    await page.locator('#format').select_option('png')
    await page.locator('#batchName').fill('第一批验证')
    async with page.expect_download() as download:
        await page.locator('#exportBtn').click()
    zipped=await download.value
    zip_path=output/'first-batch.zip'
    await zipped.save_as(zip_path)
    entries=[]
    with zipfile.ZipFile(zip_path) as z:
        assert z.testzip() is None
        pictures=[n for n in z.namelist() if n.endswith('.png')]
        assert len(pictures)==6, pictures
        expected={(1000,1200):2,(1200,1600):2,(1920,1080):2}
        actual={}
        for n in pictures:
            im=Image.open(io.BytesIO(z.read(n)))
            im.load()
            actual[im.size]=actual.get(im.size,0)+1
            entries.append({'name':n,'size':im.size,'format':im.format})
        assert actual==expected,(actual,expected)
    async with page.expect_download() as download:
        await page.get_by_role('button',name='保存工程',exact=True).click()
    project=await download.value
    project_path=output/'first-project.json'
    await project.save_as(project_path)
    saved=json.loads(project_path.read_text('utf-8'))
    assert saved['photos'][0]['settings']['square']['zoom']==1.3
    assert saved['photos'][0]['settings']['square']['x']==.4
    assert saved['specs'][0]['w']==1000
    await page.get_by_role('button',name='换下一批 →',exact=True).click()
    await page.get_by_role('button',name='开始下一批',exact=True).click()
    await page.get_by_role('button',name='选择这一批照片',exact=True).wait_for()
    assert await page.get_by_label('方图宽度',exact=True).input_value()=='1000'
    async with page.expect_file_chooser() as chooser:
        await page.get_by_role('button',name='选择这一批照片',exact=True).click()
    await (await chooser.value).set_files(str(fixtures/'transparent.png'))
    await page.get_by_text('1 张照片 × 3 种规格 = 3 张图片',exact=True).wait_for()
    assert await page.locator('#zoom').input_value()=='100'
    await page.get_by_label('背景方式',exact=True).select_option('transparent')
    async with page.expect_download() as download:
        await page.get_by_role('button',name='导出当前图',exact=True).click()
    transparent=await download.value
    transparent_path=output/'transparent-output.png'
    await transparent.save_as(transparent_path)
    im=Image.open(transparent_path).convert('RGBA')
    assert im.size==(1000,1200)
    assert im.getpixel((0,0))[3]==0
    assert im.getextrema()[3][1]>0
    await page.get_by_role('button',name='打开工程',exact=True).click()
    async with page.expect_file_chooser() as chooser:
        await page.get_by_role('button',name='选择工程',exact=True).click()
    await (await chooser.value).set_files(str(project_path))
    await page.get_by_text('2 张照片 × 3 种规格 = 6 张图片',exact=True).wait_for()
    assert await page.locator('#zoom').input_value()=='130'
    assert await page.locator('#panX').input_value()=='40'
    assert await page.get_by_label('方图宽度',exact=True).input_value()=='1000'
    await page.screenshot(path=str(output/'restored-desktop.png'),full_page=True)
    await page.set_viewport_size({'width':390,'height':844})
    await page.screenshot(path=str(output/'mobile.png'),full_page=True)
    assert await page.evaluate('document.documentElement.scrollWidth <= innerWidth')
    report={'result':'PASS','output_files':entries,'project_restore':True,'next_batch':True,'alpha':True,'responsive_no_overflow':True}
    (output/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),'utf-8')
    return report
