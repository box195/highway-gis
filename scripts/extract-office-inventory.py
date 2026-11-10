"""Extract a browser-local GIS inventory from the asset ledger (openpyxl)."""
import argparse
from collections import defaultdict
import ipaddress
import json
from pathlib import Path
import re

from openpyxl import load_workbook


SHEET = "자산관리대장_자가통신망"
BRANCH_OFFICES = {
    "동서울지사": ("OFFICE-DONGSEOUL", {
        "성남영": "OFFICE-SEONGNAM",
        "토평영": "OFFICE-TOPYEONG",
        "구리남양주영": "OFFICE-GURI",
        "청계영": "OFFICE-CHEONGGYE",
        "광암터널": "OFFICE-GWANGAM",
    }),
    "경기광주지사": ("OFF_GWANGJU_MAIN", {
        "서이천영": "OFF_SEOICHUN_TG",
        "곤지암영": "OFF_GONJIAM_TG",
        "경기광주영": "OFF_GWANGJU_TG",
        "동서울영": "OFF_DONGSEOUL_TG",
        "하남영": "OFF_HANAM_TG",
    }),
}


def cell(value):
    return " ".join(str(value).split()) if value is not None else ""


def office_location(branch, location):
    prefix, separator, detail = location.partition("_")
    prefix = prefix.strip()
    detail = detail.strip()
    if branch in BRANCH_OFFICES:
        main, prefixes = BRANCH_OFFICES[branch]
        if not separator:
            return main, location
        if prefix in prefixes and detail:
            return prefixes[prefix], detail
    if branch == "수원지사" and separator and detail:
        gate = re.fullmatch(r"수원신갈\((입|입구|출구)\)영", prefix)
        if gate:
            return "OFFICE-SUWON-SINGAL", f"{'출구' if gate[1] == '출구' else '입구'} · {detail}"
    return None


def network_address(value):
    try:
        return str(ipaddress.ip_address(cell(value)))
    except ValueError:
        return ""


def extract(source):
    book = load_workbook(source, read_only=True, data_only=True)
    try:
        sheet = book[SHEET]
        header = next(sheet.iter_rows(min_row=4, max_row=4, values_only=True))
        required = {3: "지사", 4: "설치위치", 6: "시스템명", 7: "장비명", 8: "제조업체", 9: "IP", 16: "기기번호"}
        if any(cell(header[i]) != label for i, label in required.items()):
            raise ValueError("자산관리대장 열 제목이 예상과 다릅니다.")
        offices = defaultdict(list)
        for row_number, row in enumerate(sheet.iter_rows(min_row=5, max_col=20, values_only=True), 5):
            branch, location, system, model = map(cell, (row[3], row[4], row[6], row[7]))
            if not location or not system:
                continue
            target = office_location(branch, location)
            if target is None:
                if branch in BRANCH_OFFICES:
                    raise ValueError(f"{SHEET} {row_number}행: 거점을 확정할 수 없습니다.")
                continue
            office_id, place = target
            camera = system == "CCTV" and ("카메라" in model or cell(row[19]) == "카메라")
            # A numbered row is not required: the third Gwangam camera has no sequence number.
            offices[office_id].append({
                "kind": "camera" if camera else "equipment",
                "location": place,
                "system": system,
                "model": model,
                "maker": cell(row[8]),
                "asset_number": cell(row[16]),
                "ip": network_address(row[9]),
                "source_row": row_number,
            })
        if not offices:
            raise ValueError("자산관리대장에서 대상 거점 장비를 찾지 못했습니다.")
        return {"format": "HIGHWAY_OFFICE_INVENTORY_V1", "source": source.name, "sheet": SHEET, "offices": dict(offices)}
    finally:
        book.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("workbook", type=Path)
    parser.add_argument("local_pack", type=Path)
    args = parser.parse_args()
    source, target = args.workbook.resolve(), args.local_pack.resolve()
    checkout = Path(__file__).resolve().parents[1]
    if target.is_relative_to(checkout) or source == target or target.suffix.lower() != ".json":
        parser.error("저장소 외부에 .json 파일로 지정하세요. 엑셀 원본은 변경하지 않습니다.")
    data = extract(source)
    target.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    rows = [row for records in data["offices"].values() for row in records]
    cameras = sum(row["kind"] == "camera" for row in rows)
    print(f"거점 {len(data['offices'])}곳 · CCTV {cameras}대 · 기타 장비 {len(rows)-cameras}대 · IP 미기재 {sum(not row['ip'] for row in rows)}건")
