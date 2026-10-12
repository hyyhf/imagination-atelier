"""HTTP UI acceptance for three standalone tools, called by qa/browser_smoke.py.

Only uses Python's standard library and the supplied synchronous Playwright Page.
Does not launch a browser, server, subprocess, or inspect application globals.
All file imports use native file choosers. All output checks read files saved from
real Playwright download events, never a page's JSON preview or hidden state.

Required original fixtures (relative to the repository root):
  qa/fixtures/02-production/user-batch.csv
  qa/fixtures/02-production/second-batch.csv
  qa/fixtures/10-product-studio/studio-mug.obj
  qa/fixtures/10-product-studio/studio-mug.mtl
  qa/fixtures/10-product-studio/studio-lamp.glb
  qa/fixtures/01-assembly/flange-a.obj

Normal CI integration, after starting the site's HTTP server:
  report['newWorkflows'] = imported_module.verify(page, base, output)
This file was authored from the actual delivered DOM/source and Browser records;
it is not a claim that these new CI workflows have already run in this session.
"""
from __future__ import annotations

import base64
import csv
import hashlib
import json
import math
import re
import struct
import zlib
from datetime import datetime, timezone
from decimal import Decimal, ROUND_CEILING
from pathlib import Path
from urllib.parse import urljoin, urlparse

CASE_IDS = {
    "production": "02-production",
    "assembly": "01-assembly",
    "product": "10-product-studio",
}
REQUIRED_FIXTURES = {
    "02-production": ("user-batch.csv", "second-batch.csv"),
    "10-product-studio": ("studio-mug.obj", "studio-mug.mtl", "studio-lamp.glb"),
    "01-assembly": ("flange-a.obj",),
}


def _repository_root():
    for candidate in Path(__file__).resolve().parents:
        if (candidate / "qa" / "browser_smoke.py").is_file():
            return candidate
    raise AssertionError("Cannot locate repository qa/browser_smoke.py")


def _choose(page, control, paths):
    """An actual chooser event, including labels for visually hidden inputs."""
    with page.expect_file_chooser(timeout=15000) as event:
        control.click()
    event.value.set_files([str(Path(p).resolve()) for p in paths])


def _download(page, control, destination):
    with page.expect_download(timeout=45000) as event:
        control.click()
    received = event.value
    assert received.failure() is None, "Browser download failed: " + str(received.failure())
    received.save_as(str(destination))
    assert destination.is_file() and destination.stat().st_size > 0, destination
    return destination


def _json(path):
    with path.open(encoding="utf-8-sig") as stream:
        return json.load(stream)


def _csv(path):
    with path.open(encoding="utf-8-sig", newline="") as stream:
        return list(csv.DictReader(stream))


def _input(page, selector, value):
    control = page.locator(selector)
    control.fill(str(value))
    control.press("Tab")


def _wait_text(page, selector, text, timeout=45000):
    page.locator(selector).filter(has_text=text).first.wait_for(state="visible", timeout=timeout)


def _minute(text):
    return int(datetime.fromisoformat(text.replace(" ", "T")).replace(tzinfo=timezone.utc).timestamp() // 60)


def _clock(text):
    hours, minutes = map(int, text.split(":"))
    return hours * 60 + minutes


def _production_check(snapshot, expected_input):
    """Independent conservation, dependencies and every occupied calendar minute."""
    assert snapshot["type"] == "production-plan" and snapshot["schemaVersion"] == 1
    project, plan = snapshot["project"], snapshot["plan"]
    inputs = _csv(expected_input)
    expected_ids = {r["operation_id"] for r in inputs}
    orders = {o["id"]: o for o in project["orders"]}
    operations = {o["id"]: o for o in project["operations"]}
    assignments = {a["id"]: a for a in plan["assignments"]}
    assert set(operations) == set(assignments) == expected_ids
    assert len(assignments) == len(plan["assignments"]), "Duplicate scheduled operations"
    assert not plan["unplanned"], plan["unplanned"]
    assert set(orders) == {r["order_id"] for r in inputs}
    for row in inputs:
        order, op = orders[row["order_id"]], operations[row["operation_id"]]
        assert order["product"] == row["product"] and order["qty"] == int(row["quantity"])
        assert order["release"] == row["release"] and order["due"] == row["due"]
        assert order["priority"] == int(row["priority"])
        assert op["orderId"] == row["order_id"] and op["name"] == row["operation"]
        assert Decimal(str(op["setupMin"])) == Decimal(row["setup_min"])
        assert Decimal(str(op["cycleMin"])) == Decimal(row["cycle_min"])
        assert op["batchSize"] == int(row["batch_size"])
        assert op["transferMin"] == int(row["transfer_min"])
        assert op["machineIds"] == row["machines"].split("|")
        assert op["predecessors"] == list(filter(None, row["predecessors"].split("|")))
    machines = {m["id"]: m for m in project["rules"]["machines"]}
    shifts = {s["id"]: s for s in project["rules"]["shifts"]}
    occupied = set()
    required_minutes = {}
    for ident, op in operations.items():
        a, order = assignments[ident], orders[op["orderId"]]
        batches = (order["qty"] + op["batchSize"] - 1) // op["batchSize"]
        required = int((Decimal(str(op["setupMin"])) + batches * Decimal(str(op["cycleMin"]))).to_integral_value(rounding=ROUND_CEILING))
        required_minutes[ident] = required
        assert a["machineId"] in op["machineIds"]
        machine = machines[a["machineId"]]
        assert 1 <= a["lane"] <= machine["capacity"]
        assert a["start"] >= _minute(order["release"])
        assert a["start"] == a["segments"][0]["start"]
        assert a["end"] == a["segments"][-1]["end"]
        assert sum(s["end"] - s["start"] for s in a["segments"]) == required
        for before in op["predecessors"]:
            assert a["start"] >= assignments[before]["end"] + op["transferMin"]
        for segment in a["segments"]:
            assert segment["end"] > segment["start"]
            shift = shifts[segment["shiftId"]]
            assert shift["id"] in machine["shiftIds"]
            for minute in range(segment["start"], segment["end"]):
                stamp = datetime.fromtimestamp(minute * 60, tz=timezone.utc)
                date = stamp.date().isoformat()
                clock = stamp.hour * 60 + stamp.minute
                assert date == segment["date"]
                assert (stamp.weekday() + 1) % 7 in project["rules"]["days"]
                assert date not in project["rules"].get("closedDates", [])
                assert _clock(shift["start"]) <= clock < _clock(shift["end"])
                assert not any(_minute(d["start"]) <= minute < _minute(d["end"]) for d in machine.get("downtimes", []))
                key = (machine["id"], a["lane"], minute)
                assert key not in occupied, "Device capacity collision: " + str(key)
                occupied.add(key)
    return required_minutes


def _dispatch_check(path, snapshot, required):
    project, assignments = snapshot["project"], snapshot["plan"]["assignments"]
    ops = {o["id"]: o for o in project["operations"]}
    orders = {o["id"]: o for o in project["orders"]}
    rows = _csv(path)
    assert len(rows) == sum(len(a["segments"]) for a in assignments)
    totals, setups = {}, {}
    for row in rows:
        ident = row["工序编号"]
        op = ops[ident]
        order = orders[op["orderId"]]
        assert row["检查状态"] == "可执行" and not row["问题"]
        assert row["订单"] == order["id"] and row["产品"] == order["product"]
        assert int(row["订单数量"]) == order["qty"]
        duration = _minute(row["结束"]) - _minute(row["开始"])
        assert duration == int(row["本段分钟"]) > 0
        assert int(row["工序总分钟"]) == required[ident]
        totals[ident] = totals.get(ident, 0) + duration
        setups[ident] = setups.get(ident, Decimal(0)) + Decimal(row["准备分钟（整工序计一次）"])
    assert totals == required
    for ident, amount in setups.items():
        assert amount == Decimal(str(ops[ident]["setupMin"]))
    return len(rows)


def _production(page, base, output, fixtures):
    page.goto(urljoin(base, f"works/{CASE_IDS['production']}/index.html"), wait_until="load")
    page.get_by_role("heading", name="生产订单排程工具", exact=True).wait_for()
    user_csv, second_csv = fixtures / "user-batch.csv", fixtures / "second-batch.csv"

    def import_file(path):
        page.get_by_role("button", name="↥ 导入订单", exact=True).click()
        _choose(page, page.get_by_role("button", name="选择 CSV / JSON 文件", exact=True), [path])
        # Wait on a public form value before committing the asynchronous file read.
        page.locator("#importText").wait_for(state="visible")
        page.wait_for_function("() => document.querySelector('#importText').value.length > 10")
        page.get_by_role("button", name="校验并导入", exact=True).click()
        page.locator("#dialog").wait_for(state="hidden")

    def plan():
        page.get_by_role("button", name="重新排程", exact=True).click()
        _wait_text(page, ".statusbar", "检查通过")

    def save(name):
        path = _download(page, page.get_by_role("button", name="保存计划", exact=True), output / name)
        page.get_by_role("button", name="完成", exact=True).click()
        return path

    def dispatch(name):
        page.get_by_role("button", name="导出派工单 ↗", exact=True).click()
        path = _download(page, page.get_by_role("button", name=re.compile(r"^设备 / 班次派工明细")), output / name)
        page.get_by_role("button", name="关闭弹窗", exact=True).click()
        return path

    import_file(user_csv)
    plan()
    _wait_text(page, "#main", "7 道完整工序")
    baseline_file = save("production-baseline.json")
    _production_check(_json(baseline_file), user_csv)
    page.get_by_role("button", name=re.compile(r"^USR-202 定位法兰")).click()
    _input(page, "#moveStart", "2026-10-12T08:00")
    page.get_by_role("button", name="应用时间 / 设备并锁定", exact=True).click()
    _wait_text(page, ".problem", "与 U1-10 占用同一设备位置")
    _wait_text(page, ".problem", "开始早于订单投产时间")
    draft = dispatch("production-conflict-draft.csv")
    draft_rows = _csv(draft)
    assert any(r["工序编号"] == "U2-10" and r["检查状态"] == "待修正" and "投产" in r["问题"] for r in draft_rows)
    assert any(r["工序编号"] == "U1-10" and "U2-10" in r["问题"] for r in draft_rows)
    page.get_by_role("button", name="解除本工序锁定", exact=True).click()
    plan()

    page.get_by_role("button", name="方案比较", exact=True).click()
    _input(page, "#scenarioName", "CI 用户原交期")
    page.get_by_role("button", name="保存当前为对照方案", exact=True).click()
    page.get_by_role("button", name="订单与工序", exact=True).click()
    _input(page, '[data-order-row="USR-101"] [data-field="due"]', "2026-10-12T08:01")
    page.locator('[data-save-order="USR-101"]').click()
    page.get_by_role("button", name="方案比较", exact=True).click()
    _wait_text(page, "#main", "逾期 6.6 h")
    page.get_by_role("button", name="应用方案", exact=True).click()
    page.get_by_role("button", name="设备与班次", exact=True).click()
    qc_row = page.locator(".machinerow").filter(has=page.locator('[data-mf="id"][value="QC-01"]'))
    qc_row.locator('[data-mf="capacity"]').fill("3")
    _input(page, "#closedDates", "2026-10-16")
    page.get_by_role("button", name="保存全部规则", exact=True).click()
    page.get_by_role("button", name="排程工作台", exact=True).click()
    page.get_by_role("button", name=re.compile(r"^U1-30 检验交付 终检台")).click()
    _input(page, "#moveLane", 2)
    page.get_by_role("button", name="应用时间 / 设备并锁定", exact=True).click()
    _wait_text(page, ".statusbar", "检查通过")
    saved_file = save("production-user-plan.json")
    saved = _json(saved_file)
    required = _production_check(saved, user_csv)
    assert saved["scenarios"][0]["name"] == "CI 用户原交期"
    qc = next(m for m in saved["project"]["rules"]["machines"] if m["id"] == "QC-01")
    assert qc["capacity"] == 3
    assert saved["project"]["rules"]["closedDates"] == ["2026-10-16"]
    locked = next(a for a in saved["plan"]["assignments"] if a["id"] == "U1-30")
    assert locked["lane"] == 2 and locked["locked"] is True
    dispatch_file = dispatch("production-user-dispatch.csv")
    rows = _dispatch_check(dispatch_file, saved, required)

    page.get_by_role("button", name="新一批 · 保留规则", exact=True).click()
    import_file(second_csv)
    plan()
    second_file = save("production-second-plan.json")
    second = _json(second_file)
    _production_check(second, second_csv)
    assert second["project"]["rules"] == saved["project"]["rules"]
    assert {o["id"] for o in second["project"]["orders"]} == {"NEXT-301"}
    assert not second["scenarios"]
    import_file(saved_file)
    _wait_text(page, "#main", "1 道锁定")
    restored_file = save("production-restored-plan.json")
    restored = _json(restored_file)
    assert restored == saved, "Actual downloaded plan did not fully restore"
    page.screenshot(path=str(output / "production-user-http.png"), full_page=True)
    return {"actualCSVFileChooser": True, "manualConflictDraftDownloaded": True,
            "comparisonDueChange": True, "dispatchRows": rows, "savedPlanRoundtrip": True,
            "secondBatchRetainsRules": True, "downloads": [p.name for p in (baseline_file, draft, saved_file, dispatch_file, second_file, restored_file)]}


def _paeth(a, b, c):
    prediction = a + b - c
    da, db, dc = abs(prediction - a), abs(prediction - b), abs(prediction - c)
    return a if da <= db and da <= dc else b if db <= dc else c


def _inspect_png(path, width=800, height=1000, require_teal=False):
    """Decode real PNG bytes with only stdlib; CRC, filters, alpha and variation."""
    data = path.read_bytes()
    assert data[:8] == b"\x89PNG\r\n\x1a\n", "Not a PNG download"
    position, idat, ihdr, ended = 8, bytearray(), None, False
    while position < len(data):
        assert position + 12 <= len(data), "Truncated PNG chunk"
        length = struct.unpack_from(">I", data, position)[0]
        kind = data[position + 4:position + 8]
        payload = data[position + 8:position + 8 + length]
        assert len(payload) == length and position + 12 + length <= len(data)
        expected_crc = struct.unpack_from(">I", data, position + 8 + length)[0]
        assert zlib.crc32(kind + payload) & 0xffffffff == expected_crc
        if kind == b"IHDR":
            ihdr = struct.unpack(">IIBBBBB", payload)
        elif kind == b"IDAT":
            idat.extend(payload)
        elif kind == b"IEND":
            ended = True
        position += length + 12
    assert ended and ihdr and idat
    w, h, depth, color_type, compression, filtering, interlace = ihdr
    assert (w, h) == (width, height), (w, h)
    assert (depth, color_type, compression, filtering, interlace) == (8, 6, 0, 0, 0), "Expected browser canvas RGBA8 PNG"
    raw = zlib.decompress(idat)
    stride, bpp = w * 4, 4
    assert len(raw) == h * (stride + 1)
    previous = bytearray(stride)
    opaque, clear, teal, tones = 0, 0, 0, set()
    for y in range(h):
        offset = y * (stride + 1)
        filter_type = raw[offset]
        assert filter_type in range(5)
        row = bytearray(raw[offset + 1:offset + 1 + stride])
        for i in range(stride):
            left = row[i - bpp] if i >= bpp else 0
            up = previous[i]
            upper_left = previous[i - bpp] if i >= bpp else 0
            predictor = (0, left, up, (left + up) // 2, _paeth(left, up, upper_left))[filter_type]
            row[i] = (row[i] + predictor) & 255
        for x in range(w):
            i = x * bpp
            red, green, blue, alpha = row[i:i + 4]
            clear += alpha == 0
            if alpha > 32:
                opaque += 1
                if green > red + 5 and blue > red + 5:
                    teal += 1
                if w // 5 < x < 4 * w // 5 and h // 5 < y < 4 * h // 5:
                    tones.add((red // 8, green // 8, blue // 8))
        if y in (0, h - 1):
            assert row[3] == 0 and row[-1] == 0, "Transparent output has opaque corners"
        previous = row
    assert opaque > 500 and clear > w * h * 0.1, "Empty or nontransparent product image"
    assert len(tones) > 8, "Flat/blank central image"
    if require_teal:
        assert teal > 100, "Imported ceramic MTL color was not observed in rendered pixels"
    return {"width": w, "height": h, "opaquePixels": opaque, "transparentPixels": clear,
            "centralColorBins": len(tones), "sha256": hashlib.sha256(data).hexdigest()}


def _asset_check(snapshot, paths):
    assets = snapshot["product"]["assets"]
    assert snapshot["version"] == 1 and snapshot["product"]["kind"] == "import"
    assert {a["name"] for a in assets} == {p.name for p in paths}
    for path in paths:
        asset = next(a for a in assets if a["name"] == path.name)
        assert asset["data"].startswith("data:") and ";base64," in asset["data"]
        assert base64.b64decode(asset["data"].split(",", 1)[1], validate=True) == path.read_bytes()


def _close_values(a, b):
    if isinstance(a, (int, float)) and isinstance(b, (int, float)):
        return math.isclose(a, b, rel_tol=1e-8, abs_tol=1e-8)
    if isinstance(a, dict) and isinstance(b, dict):
        return a.keys() == b.keys() and all(_close_values(a[k], b[k]) for k in a)
    if isinstance(a, list) and isinstance(b, list):
        return len(a) == len(b) and all(_close_values(x, y) for x, y in zip(a, b))
    return a == b


def _product(page, base, output, fixtures):
    page.goto(urljoin(base, f"works/{CASE_IDS['product']}/index.html"), wait_until="load")
    _wait_text(page, "#status", "准备就绪")
    mug, mtl, lamp = (fixtures / name for name in ("studio-mug.obj", "studio-mug.mtl", "studio-lamp.glb"))
    chooser_control = page.locator('label[for="importFiles"]')
    _choose(page, chooser_control, [mug, mtl])
    _wait_text(page, "#productName", "studio-mug")
    page.locator("body:not(.busy)").wait_for(state="visible")
    _wait_text(page, "#productKind", "自有模型")
    assert page.locator("#surface option").count() == 2
    page.locator("#presetLight").select_option("dramatic")
    focal = page.get_by_label("镜头焦距", exact=True)
    for _ in range(3):
        focal.press("ArrowRight")
    focal.press("Tab")
    page.get_by_role("button", name="海报", exact=True).click()
    _input(page, '[data-state="poster.title"]', "CI 自有陶杯")
    page.locator('[data-state="poster.enabled"]').uncheck()
    page.get_by_role("button", name="出图", exact=True).click()
    _input(page, '[data-state="output.width"]', 800)
    _input(page, '[data-state="output.height"]', 1000)
    page.locator('[data-state="output.transparent"]').check()
    _input(page, '[data-state="name"]', "CI-MUG-800")

    def render(name, teal=False):
        page.locator("#renderImage").click()
        page.locator("#result[open]").wait_for(state="visible", timeout=60000)
        _wait_text(page, "#resultInfo", "800 × 1000 px")
        path = _download(page, page.locator("#downloadPng"), output / name)
        result = _inspect_png(path, require_teal=teal)
        page.locator("#closeResult").click()
        return path, result

    def save(name):
        page.locator("#saveProject").click()
        page.locator("#projectResult[open]").wait_for(state="visible")
        path = _download(page, page.locator("#downloadProject"), output / name)
        page.locator("#closeProject").click()
        return path

    mug_png, mug_pixels = render("product-mug-800x1000.png", teal=True)
    saved_file = save("product-user-mug.json")
    saved = _json(saved_file)
    _asset_check(saved, [mug, mtl])
    assert saved["name"] == "CI-MUG-800" and saved["poster"]["title"] == "CI 自有陶杯"
    assert saved["poster"]["enabled"] is False
    assert saved["output"] == {"width": 800, "height": 1000, "transparent": True}
    assert math.isclose(saved["camera"]["focal"], 58, abs_tol=1e-8)
    assert saved["studio"]["key"] == 100 and saved["studio"]["fill"] == 5
    _input(page, '[data-state="output.width"]', 640)
    page.get_by_role("button", name="海报", exact=True).click()
    _input(page, '[data-state="poster.title"]', "临时修改，不应留在恢复结果")
    _choose(page, page.locator('label[for="loadProject"]'), [saved_file])
    _wait_text(page, "#status", "摄影方案已恢复")
    assert page.locator('[data-state="poster.title"]').input_value() == "CI 自有陶杯"
    page.get_by_role("button", name="出图", exact=True).click()
    assert page.locator('[data-state="output.width"]').input_value() == "800"
    restored_file = save("product-restored-mug.json")
    restored = _json(restored_file)
    assert _close_values(restored, saved), "Downloaded photography project did not restore"
    _choose(page, chooser_control, [lamp])
    _wait_text(page, "#productName", "studio-lamp")
    page.locator("body:not(.busy)").wait_for(state="visible")
    lamp_png, lamp_pixels = render("product-second-lamp-800x1000.png")
    assert lamp_pixels["sha256"] != mug_pixels["sha256"]
    second_file = save("product-second-lamp.json")
    second = _json(second_file)
    _asset_check(second, [lamp])
    for section in ("studio", "camera", "poster", "output"):
        assert _close_values(second[section], saved[section]), "Second model lost " + section
    assert second["name"] == "studio-lamp"
    page.screenshot(path=str(output / "product-second-http.png"))
    return {"actualOBJAndMTLChooser": True, "firstPNG": mug_pixels, "secondPNG": lamp_pixels,
            "embeddedAssetBytesMatch": True, "projectDownloadRoundtrip": True,
            "secondModelRetainsPhotographyRules": True,
            "downloads": [p.name for p in (mug_png, saved_file, restored_file, lamp_png, second_file)]}


def _obj_reference(path):
    names, faces = [], 0
    for line in path.read_text(encoding="utf-8").splitlines():
        fields = line.split()
        if fields and fields[0] == "o":
            names.append(" ".join(fields[1:]))
        elif fields and fields[0] == "f":
            faces += len(fields) - 3
    assert names and faces > 0
    return names, faces


def _assembly_check(snapshot, names, triangles):
    assert snapshot["format"] == "assembly-workbench" and snapshot["version"] == 1
    assert len(snapshot["parts"]) == len(names)
    assert snapshot["title"] == "CI 自有法兰装配"
    parts = {p["name"]: p for p in snapshot["parts"]}
    assert len({p["id"] for p in snapshot["parts"]}) == len(names)
    housing, bushing = parts["CI 法兰座"], parts["CI 青铜套"]
    assert housing["code"] == "QA-FL-01" and housing["group"] == "CI 用户装配"
    assert housing["materialLabel"] == "6061 铝合金"
    assert housing["position"][0] == 12.5 and housing["explode"][2] == 45
    assert housing["note"] == '装配前清洁，"定位"检查。\n扭矩由工艺单确认。'
    assert bushing["parentId"] == housing["id"] and bushing["joint"] == "轴孔配合"
    assert bushing["step"] == 2 and bushing["code"] == "QA-BUSH-02"
    actual_triangles = 0
    for part in snapshot["parts"]:
        assert all(math.isfinite(v) for vector in ("position", "rotation", "scale", "explode") for v in part[vector])
        assert all(v > 0 for v in part["scale"])
        for mesh in part["meshes"]:
            geometry = mesh["geometry"]
            positions, indices = geometry["position"], geometry.get("index")
            assert len(positions) >= 9 and len(positions) % 3 == 0
            assert all(math.isfinite(v) for v in positions)
            if indices:
                assert len(indices) % 3 == 0
                assert all(isinstance(i, int) and 0 <= i < len(positions) // 3 for i in indices)
                actual_triangles += len(indices) // 3
            else:
                assert len(positions) % 9 == 0
                actual_triangles += len(positions) // 9
    assert actual_triangles == triangles, "Imported OBJ triangles lost in saved project"


def _assembly(page, base, output, fixtures):
    source = fixtures / "flange-a.obj"
    names, triangles = _obj_reference(source)
    assert names == ["Flange_housing", "Bronze_bushing", "Location_shaft"], names
    page.goto(urljoin(base, f"works/{CASE_IDS['assembly']}/index.html"), wait_until="load")
    page.locator("#new").wait_for(state="visible")
    page.locator("#new").click()
    assert page.locator("#part-list .part-row").count() == 0
    page.locator("#units").select_option("1")
    _choose(page, page.locator("#import"), [source])
    page.get_by_role("button", name="选择 Flange_housing", exact=True).wait_for(state="visible", timeout=45000)
    assert page.locator("#part-list .part-row").count() == 3
    page.get_by_role("button", name="选择 Flange_housing", exact=True).click()
    _input(page, '[data-field="name"]', "CI 法兰座")
    _input(page, '[data-field="code"]', "QA-FL-01")
    _input(page, '[data-field="group"]', "CI 用户装配")
    _input(page, '[data-field="materialLabel"]', "6061 铝合金")
    _input(page, '[data-vector="position"][data-axis="0"]', 12.5)
    _input(page, '[data-vector="explode"][data-axis="2"]', 45)
    page.get_by_label("装配备注", exact=True).fill('装配前清洁，"定位"检查。\n扭矩由工艺单确认。')
    page.locator("#apply-properties").click()
    page.get_by_role("button", name="选择 Bronze_bushing", exact=True).click()
    _input(page, '[data-field="name"]', "CI 青铜套")
    _input(page, '[data-field="code"]', "QA-BUSH-02")
    page.locator("#parent-part").select_option(label="CI 法兰座")
    page.get_by_label("连接形式", exact=True).select_option(label="轴孔配合")
    _input(page, '[data-field="step"]', 2)
    page.get_by_label("装配备注", exact=True).fill("压入后复核内径")
    page.locator("#apply-properties").click()
    _input(page, "#project-title", "CI 自有法兰装配")
    page.locator("#apply-project").click()

    def save(name):
        page.locator("#save").click()
        page.locator("#project-download").wait_for(state="visible")
        path = _download(page, page.locator("#project-download"), output / name)
        page.locator("#modal-close").click()
        return path

    def bom(name):
        page.locator("#bom").click()
        page.locator("#csv-download").wait_for(state="visible")
        path = _download(page, page.locator("#csv-download"), output / name)
        page.locator("#modal-close").click()
        return path

    project_file = save("assembly-user-project.json")
    saved = _json(project_file)
    _assembly_check(saved, names, triangles)
    bom_file = bom("assembly-user-bom.csv")
    rows = _csv(bom_file)
    assert len(rows) == 3 and [int(r["序号"]) for r in rows] == [1, 2, 3]
    housing_row = next(r for r in rows if r["零件名称"] == "CI 法兰座")
    bushing_row = next(r for r in rows if r["零件名称"] == "CI 青铜套")
    assert housing_row["代号"] == "QA-FL-01" and housing_row["材料"] == "6061 铝合金"
    assert housing_row["装配备注"] == '装配前清洁，"定位"检查。\n扭矩由工艺单确认。'
    assert bushing_row["安装到"] == "CI 法兰座" and bushing_row["连接形式"] == "轴孔配合" and bushing_row["步骤"] == "2"
    page.locator("#new").click()
    assert page.locator("#part-list .part-row").count() == 0
    _choose(page, page.locator("#open"), [project_file])
    page.get_by_role("button", name="选择 CI 法兰座", exact=True).wait_for(state="visible", timeout=45000)
    assert page.locator("#project-title").input_value() == "CI 自有法兰装配"
    assert page.locator("#part-list .part-row").count() == 3
    page.get_by_role("button", name="选择 CI 法兰座", exact=True).click()
    assert page.get_by_label("position X", exact=True).input_value() == "12.5"
    assert page.get_by_label("explode Z", exact=True).input_value() == "45"
    assert page.get_by_label("装配备注", exact=True).input_value() == housing_row["装配备注"]
    restored_file = save("assembly-restored-project.json")
    restored = _json(restored_file)
    _assembly_check(restored, names, triangles)
    assert restored["parts"] == saved["parts"]
    restored_bom = bom("assembly-restored-bom.csv")
    assert _csv(restored_bom) == rows
    page.screenshot(path=str(output / "assembly-restored-http.png"))
    return {"actualIndependentOBJChooser": True, "parts": 3, "triangles": triangles,
            "coordinateIdentityMaterialRelationshipEdits": True, "actualBOMDownload": True,
            "actualProjectDownloadAndFileChooserRestore": True,
            "downloads": [p.name for p in (project_file, bom_file, restored_file, restored_bom)]}


def verify(page, base, output):
    """Run real public UI workflows on an already created HTTP Playwright page."""
    parsed = urlparse(base)
    assert parsed.scheme in ("http", "https"), "These workflows require HTTP; file:// is never used"
    base = base.rstrip("/") + "/"
    root, output = _repository_root(), Path(output).resolve()
    output.mkdir(parents=True, exist_ok=True)
    for ident, names in REQUIRED_FIXTURES.items():
        for name in names:
            assert (root / "qa" / "fixtures" / ident / name).is_file(), "Missing original fixture: qa/fixtures/" + ident + "/" + name
    page.set_viewport_size({"width": 1440, "height": 1000})
    errors = []
    listener = lambda error: errors.append(str(error))
    page.on("pageerror", listener)
    try:
        report = {
            "scope": "HTTP native file chooser and real downloaded-file inspection; no hidden application state; not offline cold-start or physical execution evidence",
            "production": _production(page, base, output, root / "qa" / "fixtures" / CASE_IDS["production"]),
            "productStudio": _product(page, base, output, root / "qa" / "fixtures" / CASE_IDS["product"]),
            "assembly": _assembly(page, base, output, root / "qa" / "fixtures" / CASE_IDS["assembly"]),
            "pageErrors": errors,
        }
        assert not errors, "Workflow browser exceptions: " + repr(errors)
        (output / "new-workflows-report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
        return report
    finally:
        page.remove_listener("pageerror", listener)
