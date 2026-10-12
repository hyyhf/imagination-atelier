"""CI-only synchronous Playwright verification. Not run via local browser automation."""
from pathlib import Path
from urllib.parse import urljoin
import csv
import io
import json
import re
import zipfile
import xml.etree.ElementTree as ET


def _verify_archive(blob, expected_lengths, sheet_width):
    with zipfile.ZipFile(io.BytesIO(blob)) as archive:
        assert archive.testzip() is None
        files = {name: archive.read(name).decode('utf-8-sig') for name in archive.namelist()}
    project = json.loads(files['project.json'])
    rows = list(csv.DictReader(io.StringIO(files['parts.csv'])))
    assert sorted(float(row['成品长度_mm']) for row in rows) == expected_lengths
    ns = {'svg': 'http://www.w3.org/2000/svg'}
    paths_seen = []
    for name, text in files.items():
        if not name.startswith('sheet-'):
            continue
        svg = ET.fromstring(text)
        assert svg.attrib['width'] == f'{sheet_width}mm'
        assert svg.attrib['height'] == '400mm'
        assert not svg.findall('.//svg:text', ns)
        for contour in svg.findall('.//svg:path', ns):
            paths_seen.append(contour.attrib['id'])
            assert contour.attrib['d'].endswith(' Z')
            coords = list(map(float, re.findall(r'-?\d+(?:\.\d+)?', contour.attrib['d'])))
            xs, ys = coords[::2], coords[1::2]
            row = next(row for row in rows if row['编号'] == contour.attrib['id'])
            assert abs(max(xs) - min(xs) - float(row['成品长度_mm'])) < .001
            assert abs(max(ys) - min(ys) - float(row['高度_mm'])) < .001
    assert sorted(paths_seen) == ['A1', 'A2', 'B1']
    ET.fromstring(files['coupon.svg'])
    assert '补偿一次' in files['加工说明.txt']
    return project, files


def verify(page, base, output):
    """Accept a sync Playwright Page, site root URL, and evidence directory."""
    output = Path(output)
    output.mkdir(parents=True, exist_ok=True)
    page.goto(urljoin(base.rstrip('/') + '/', 'works/05-drawer/index.html'))
    page.locator('#plan').wait_for()
    fixture = dict(version=1, name='CI 自有抽屉', w=525, d=415, insideH=110,
                   h=80, t=4, c=1.5, fit=.2, sheetW=600, sheetH=400,
                   x=[180, 355], y=[235], items=[dict(id='caliper', name='卡尺盒',
                   w=90, d=220, h=35, x=50, y=115)])
    fixture_path = output / 'own-drawer.json'
    fixture_path.write_text(json.dumps(fixture, ensure_ascii=False), encoding='utf-8')
    page.locator('#file').set_input_files(str(fixture_path))
    page.get_by_text('方案已打开', exact=True).wait_for()
    assert page.locator('#w').input_value() == '525'
    assert page.locator('#fitCount').inner_text() == '1 / 1'
    assert '176.5' in page.locator('#cellReadout').inner_text()
    page.locator('#cellW').fill('190')
    page.locator('#cellW').press('Tab')
    assert '192 · 353.5' in page.locator('#partRows').inner_text()
    assert '净宽 190' in page.locator('#cellReadout').inner_text()
    top_action = page.locator('#packTop').bounding_box()
    assert top_action and top_action['y'] >= 0 and top_action['y'] + top_action['height'] < 711
    page.screenshot(path=str(output / 'plan-readable-dimensions.png'), full_page=True)
    page.locator('#threeTab').click()
    page.locator('#threeView canvas').wait_for()
    page.locator('#explode').press('End')
    page.screenshot(path=str(output / 'assembly.png'), full_page=True)

    def download(selector, filename):
        with page.expect_download() as event:
            page.locator(selector).click()
        result = event.value
        destination = output / filename
        result.save_as(str(destination))
        assert result.failure() is None
        return destination.read_bytes()

    first, first_files = _verify_archive(download('#packTop', 'first-cutting.zip'), [412, 412, 522], 600)
    assert first['w'] == 525
    download('#save', 'saved-project.json')
    csv_bytes = download('#csv', 'parts.csv')
    assert len(list(csv.DictReader(io.StringIO(csv_bytes.decode('utf-8-sig'))))) == 3
    svg_bytes = download('[data-sheet="0"]', 'sheet.svg')
    assert ET.fromstring(svg_bytes).attrib['width'] == '600mm'

    page.locator('#next').click()
    page.locator('#nextW').fill('640')
    page.locator('#nextD').fill('390')
    page.locator('#nextConfirm').click()
    assert page.locator('#fitCount').inner_text() == '0 / 0'
    assert page.locator('#t').input_value() == '4'
    assert page.locator('#fit').input_value() == '0.2'
    assert page.locator('#pack').is_disabled()
    assert page.locator('#packTop').is_disabled()
    page.locator('#sheetW').fill('750')
    page.locator('#sheetW').press('Tab')
    assert not page.locator('#packTop').is_disabled()
    page.locator('#addItem').click()
    for selector, value in [('#newItemName', '螺丝刀盒'), ('#newItemW', '200'), ('#newItemD', '70'), ('#newItemH', '45')]:
        page.locator(selector).fill(value)
    page.locator('#itemConfirm').click()
    assert page.locator('#fitCount').inner_text() == '1 / 1'
    second, _ = _verify_archive(download('#packTop', 'second-cutting.zip'), [387, 387, 637], 750)
    assert (second['w'], second['d']) == (640, 390)
    assert len(second['items']) == 1 and second['items'][0]['name'] == '螺丝刀盒'
    page.reload()
    page.locator('#plan').wait_for()
    assert page.locator('#w').input_value() == '640'
    assert page.locator('#fitCount').inner_text() == '1 / 1'
    page.locator('#file').set_input_files(str(output / 'saved-project.json'))
    page.get_by_text('方案已打开', exact=True).wait_for()
    assert page.locator('#w').input_value() == '525'
    assert '卡尺盒' in page.locator('#itemList').inner_text()
    assert '192 · 353.5' in page.locator('#partRows').inner_text()
    page.screenshot(path=str(output / 'restored-project.png'), full_page=True)
    return dict(tool='divider', downloads=5,
                checks='actual SVG/CSV/JSON/ZIP downloads; independent ZIP XML CSV dimensions; project restore; second drawer; stock blocking; WebGL; clear dimension readout and visible top export')
