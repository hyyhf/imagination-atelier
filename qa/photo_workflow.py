"""CI-only browser workflow. Not executed locally. Requires Playwright and Pillow.
Call verify(page, 'http://127.0.0.1:4182', pathlib.Path(output_dir)).
The fixtures are original product renders, not camera photographs.
"""
from pathlib import Path
from io import BytesIO
import json
import zipfile
from PIL import Image
from playwright.sync_api import expect


def verify(page, base, output):
    output = Path(output)
    output.mkdir(parents=True, exist_ok=True)
    fixtures = Path(__file__).parent / 'fixtures/photo'
    page.goto(base.rstrip('/') + '/works/03-photo-batch/index.html')
    expect(page.locator('#photoCount')).to_have_text('2 张')
    expect(page.locator('#busy')).to_be_hidden()
    page.get_by_label('添加自己的照片', exact=True).set_input_files(
        [str(fixtures / 'mug.png'), str(fixtures / 'lamp.png')])
    expect(page.locator('#busy')).to_be_hidden()
    expect(page.locator('#photoCount')).to_have_text('2 张')
    assert page.locator('#photoList').get_by_text('示例渲染', exact=False).count() == 0
    page.get_by_text('精确调整主体范围', exact=True).click()
    for label, value in [('主体宽度 %', '60'), ('主体高度 %', '72'),
                         ('主体左侧 %', '20'), ('主体顶部 %', '15')]:
        field = page.get_by_label(label, exact=True)
        field.fill(value)
        field.press('Tab')
    page.get_by_role('button', name='微调横幅', exact=True).click()
    page.locator('#zoom').focus()
    page.locator('#zoom').press('Home')
    for _ in range(65):
        page.locator('#zoom').press('ArrowRight')
    expect(page.locator('#zoom')).to_have_value('115')
    expect(page.locator('#resultNotice')).to_contain_text('主体超出画面')
    # A format-specific edit must survive a shared pixel-size change.
    page.get_by_label('横幅宽像素', exact=True).fill('2400')
    page.get_by_label('横幅宽像素', exact=True).press('Tab')
    page.get_by_label('横幅高像素', exact=True).fill('800')
    page.get_by_label('横幅高像素', exact=True).press('Tab')
    expect(page.locator('#zoom')).to_have_value('115')
    page.get_by_role('button', name='恢复主体适配', exact=True).click()
    expect(page.locator('#resultNotice')).to_contain_text('保留完整主体')
    page.get_by_role('button', name='✓ 标记这张已检查', exact=True).click()
    with page.expect_download() as dl:
        page.locator('#export').click()
    first_zip = output / 'browser-batch-one.zip'
    dl.value.save_as(str(first_zip))
    assert dl.value.failure() is None
    validate_archive(first_zip, 6)
    with page.expect_download() as dl:
        page.get_by_role('button', name='保存项目', exact=True).click()
    project = output / 'browser-project.json'
    dl.value.save_as(str(project))
    saved = json.loads(project.read_text('utf-8'))
    assert len(saved['state']['photos']) == 2
    assert saved['state']['photos'][0]['roi']['w'] == 0.6
    assert saved['state']['photos'][0]['roi']['x'] == 0.2
    assert saved['state']['photos'][0]['roi']['y'] == 0.15
    assert saved['state']['photos'][0]['data'].startswith('data:image/png;base64,')
    page.get_by_role('button', name='开始下一批', exact=True).click()
    expect(page.locator('#photoCount')).to_have_text('0 张')
    expect(page.get_by_label('横幅宽像素', exact=True)).to_have_value('2400')
    page.get_by_label('添加自己的照片', exact=True).set_input_files(str(fixtures / 'lamp.png'))
    expect(page.locator('#busy')).to_be_hidden()
    expect(page.locator('#photoCount')).to_have_text('1 张')
    expect(page.locator('#summary')).to_contain_text('0 张已检查')
    with page.expect_download() as dl:
        page.locator('#export').click()
    second_zip = output / 'browser-batch-two.zip'
    dl.value.save_as(str(second_zip))
    validate_archive(second_zip, 3)
    # Restore the actual downloaded file, not a reconstructed JSON object.
    page.get_by_label('打开项目', exact=True).set_input_files(str(project))
    expect(page.locator('#busy')).to_be_hidden()
    expect(page.locator('#photoCount')).to_have_text('2 张')
    page.get_by_role('button', name='圈定主体', exact=True).click()
    expect(page.locator('#roiW')).to_have_value('60.0')
    expect(page.locator('#summary')).to_contain_text('1 张已检查')
    page.screenshot(path=str(output / 'browser-restored.png'), full_page=True)
    return {'first_images': 6, 'next_images': 3, 'project_download_restored': True,
            'transport': 'HTTP; file protocol not verified'}


def validate_archive(path, count):
    with zipfile.ZipFile(path) as archive:
        assert archive.testzip() is None
        images = [n for n in archive.namelist() if n.endswith('.jpg')]
        assert len(images) == count
        assert '检查清单.csv' in archive.namelist()
        for name in images:
            expected = tuple(map(int, Path(name).stem.rsplit('_', 1)[1].split('x')))
            with Image.open(BytesIO(archive.read(name))) as image:
                image.load()
                assert image.size == expected
                assert any(a != b for a, b in image.convert('RGB').getextrema())
