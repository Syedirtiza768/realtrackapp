#!/usr/bin/env python3
"""
Bulk import eBay File Exchange CSV into RealTrackApp catalog + listing_records,
with S3 image mirroring and optional eBay Browse API enrichment.

Loads .env from repo root (DB + AWS + eBay). A fresh run clears catalog tables first (same
order as backend clearAllCatalog). Use --resume --import-id to continue without wiping.

Usage:
  pip install -r scripts/requirements-bulk-import.txt
  python scripts/catalog_bulk_import.py --csv "F:\\path\\inventory-export.csv" --yes

  # Continue after interruption (same CSV; same import_id from prior Done. log):
  python scripts/catalog_bulk_import.py --csv "F:\\path\\inventory-export.csv" \\
    --resume --import-id "<uuid>"

Options:
  --yes              Required for a fresh run: acknowledge destructive catalog wipe + import
  --resume           Continue a prior run: no wipe; requires --import-id (same CSV layout)
  --import-id        UUID of the existing catalog_products.import_id to append to
  --no-browse        Skip eBay Browse API enrichment
  --no-mirror        Skip S3 mirroring (keep original PicURL strings)
  --logical-batch    Primary listing rows per DB commit (default 200)
  --mirror-workers   Parallel SKU image jobs per batch (default 6)
  --browse-workers   Parallel Browse API calls when enriching (default 8)
"""
from __future__ import annotations

import argparse
import base64
import csv
import json
import os
import re
import sys
import time
import uuid
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple
from urllib.parse import urlparse

import boto3
import psycopg2
import requests
from dotenv import load_dotenv
from psycopg2.extras import Json

try:
    from tqdm import tqdm
except ImportError:
    tqdm = None  # type: ignore

# --- Repo root: parent of scripts/ ---
ROOT = Path(__file__).resolve().parents[1]
load_dotenv(ROOT / ".env")

DEFAULT_COLUMN_MAP: Dict[str, str] = {
    "customlabel": "sku",
    "custom label (sku)": "sku",
    "*customlabel": "sku",
    "customlabelsku": "sku",
    "*title": "title",
    "title": "title",
    "*startprice": "price",
    "startprice": "price",
    "*quantity": "quantity",
    "quantity": "quantity",
    "picurl": "imageUrls",
    "*conditionid": "conditionId",
    "conditionid": "conditionId",
    "*description": "description",
    "description": "description",
    "*format": "format",
    "format": "format",
    "*duration": "duration",
    "duration": "duration",
    "*location": "location",
    "location": "location",
    "buyitnowprice": "buyItNowPrice",
    "*category": "categoryId",
    "category": "categoryId",
    "categoryname": "categoryName",
    "shippingprofilename": "shippingProfile",
    "returnprofilename": "returnProfile",
    "paymentprofilename": "paymentProfile",
    "*c:brand": "brand",
    "c:brand": "brand",
    "c:type": "partType",
    "c:placement on vehicle": "placement",
    "c:material": "material",
    "c:features": "features",
    "c:country of origin": "countryOfOrigin",
    "c:country/region of manufacture": "countryOfOrigin",
    "c:manufacturer part number": "mpn",
    "c:oe/oem part number": "oemPartNumber",
    "c:operatingmode": "operatingMode",
    "c:fueltype": "fuelType",
    "c:drivetype": "driveType",
    "sku": "sku",
    "mpn": "mpn",
    "manufacturer part number": "mpn",
    "upc": "upc",
    "ean": "ean",
    "epid": "epid",
    "p:upc": "upc",
    "p:epid": "epid",
    "brand": "brand",
    "price": "price",
    "ebayitemid": "ebayItemId",
    "ebay item id": "ebayItemId",
    "item id": "ebayItemId",
    "part type": "partType",
    "oem part number": "oemPartNumber",
    "image url": "imageUrls",
    "imageurl": "imageUrls",
    "imageurls": "imageUrls",
    "images": "imageUrls",
    "action": "action",
    "*action": "action",
}


def log(msg: str) -> None:
    print(f"[{time.strftime('%H:%M:%S')}] {msg}", flush=True)


def header_base_name(h: str) -> str:
    return h.replace("*", "").split("(")[0].strip().lower()


def auto_map_columns(headers: List[str]) -> Dict[str, str]:
    m: Dict[str, str] = {}
    for h in headers:
        key = h.lower().replace("*", "").strip()
        if key in DEFAULT_COLUMN_MAP:
            m[h] = DEFAULT_COLUMN_MAP[key]
        elif h.lower().strip() in DEFAULT_COLUMN_MAP:
            m[h] = DEFAULT_COLUMN_MAP[h.lower().strip()]
    return m


def find_headers(rows: List[List[str]]) -> Tuple[int, List[str]]:
    for i, cells in enumerate(rows[:20]):
        lowered = [c.lower() for c in cells]
        has_action = any("action" in c for c in lowered)
        has_title = any("title" in c for c in lowered)
        if has_action or has_title:
            return i, [c.strip() for c in cells]
    return 0, [c.strip() for c in rows[0]]


def col_index_by_base(headers: List[str], base: str) -> int:
    b = base.lower()
    for i, h in enumerate(headers):
        if header_base_name(h) == b:
            return i
    return -1


def is_fitment_continuation(cells: List[str], headers: List[str]) -> bool:
    ri = col_index_by_base(headers, "relationship")
    if ri < 0 or ri >= len(cells):
        return False
    rel = (cells[ri] or "").strip()
    if not re.match(r"^Compatibility$", rel, re.I):
        return False
    ci = col_index_by_base(headers, "customlabel")
    if ci >= 0 and ci < len(cells) and (cells[ci] or "").strip():
        return False
    action = (cells[0] or "").strip() if cells else ""
    if re.match(r"^(Add|Revise|Relist|Delete|End|Verify)", action, re.I):
        return False
    return True


def extract_relationship_details(cells: List[str], headers: List[str]) -> Optional[str]:
    di = col_index_by_base(headers, "relationshipdetails")
    if di < 0 or di >= len(cells):
        return None
    v = (cells[di] or "").strip()
    return v or None


def parse_fitment_pipe(details: str) -> Dict[str, str]:
    out: Dict[str, str] = {}
    for part in details.split("|"):
        eq = part.find("=")
        if eq > 0:
            k = part[:eq].strip()
            v = part[eq + 1 :].strip()
            if k:
                out[k] = v
    return out


def parse_row(cells: List[str], headers: List[str], colmap: Dict[str, str]) -> Dict[str, str]:
    mapped: Dict[str, str] = {}
    for i, header in enumerate(headers):
        field = colmap.get(header)
        if field and i < len(cells):
            v = (cells[i] or "").strip()
            if v:
                mapped[field] = v
    return mapped


def normalize_mpn(mpn: str) -> str:
    return re.sub(r"[\s\-_.\\/]+", "", mpn.upper()).strip()


def normalize_brand(brand: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"[\s\-_.]+", " ", brand.upper())).strip()


def normalize_title(title: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9\s]", "", title.lower())).strip()


def infer_brand_from_title(title: str) -> Optional[str]:
    t = title.lower()
    brands = [
        ("mercedes-benz", "Mercedes-Benz"),
        ("mercedes", "Mercedes-Benz"),
        ("bmw", "BMW"),
        ("audi", "Audi"),
        ("porsche", "Porsche"),
        ("volkswagen", "Volkswagen"),
        ("toyota", "Toyota"),
        ("honda", "Honda"),
        ("nissan", "Nissan"),
        ("mazda", "Mazda"),
        ("subaru", "Subaru"),
        ("lexus", "Lexus"),
        ("acura", "Acura"),
        ("infiniti", "Infiniti"),
        ("hyundai", "Hyundai"),
        ("kia", "Kia"),
        ("genesis", "Genesis"),
        ("ford", "Ford"),
        ("chevrolet", "Chevrolet"),
        ("chevy", "Chevrolet"),
        ("gmc", "GMC"),
        ("cadillac", "Cadillac"),
        ("dodge", "Dodge"),
        ("chrysler", "Chrysler"),
        ("jeep", "Jeep"),
        ("ram", "RAM"),
        ("tesla", "Tesla"),
        ("volvo", "Volvo"),
        ("land rover", "Land Rover"),
        ("jaguar", "Jaguar"),
        ("mini", "MINI"),
        ("fiat", "Fiat"),
        ("alfa romeo", "Alfa Romeo"),
        ("mitsubishi", "Mitsubishi"),
        ("suzuki", "Suzuki"),
    ]
    for needle, brand in brands:
        if needle in t:
            return brand
    return None


def iter_logical_rows(
    path: Path,
) -> Iterable[Tuple[int, Dict[str, str], List[str]]]:
    """Yield (source_row_number, mapped_data, raw_primary_cells) per logical listing."""
    with path.open(newline="", encoding="utf-8", errors="replace") as f:
        r = csv.reader(f)
        preview: List[List[str]] = []
        for _ in range(25):
            try:
                preview.append(next(r))
            except StopIteration:
                break
        hi, headers = find_headers(preview)
        colmap = auto_map_columns(headers)

        def physical_stream() -> Iterable[List[str]]:
            for row in preview[hi + 1 :]:
                yield row
            for row in r:
                yield row

        data_row_num = 0
        pending: Optional[Tuple[int, List[str], List[Dict[str, str]]]] = None

        for cells in physical_stream():
            data_row_num += 1
            if is_fitment_continuation(cells, headers):
                det = extract_relationship_details(cells, headers)
                if det and pending:
                    pending[2].append(parse_fitment_pipe(det))
                continue
            if pending:
                pr, primary_cells, fitments = pending
                data = parse_row(primary_cells, headers, colmap)
                if fitments:
                    data["_fitmentRecordsJson"] = json.dumps(fitments)
                yield pr, data, primary_cells
            pending = (data_row_num, cells, [])

        if pending:
            pr, primary_cells, fitments = pending
            data = parse_row(primary_cells, headers, colmap)
            if fitments:
                data["_fitmentRecordsJson"] = json.dumps(fitments)
            yield pr, data, primary_cells


def condition_label(condition_id: Optional[str]) -> Optional[str]:
    if not condition_id:
        return None
    cid = condition_id.split("-")[0]
    cmap = {
        "1000": "New",
        "1500": "New other",
        "2000": "Certified refurbished",
        "2500": "Seller refurbished",
        "3000": "Used",
        "4000": "Very Good",
        "5000": "Good",
        "6000": "Acceptable",
        "7000": "For parts or not working",
    }
    return cmap.get(cid, condition_id)


def map_catalog_row(
    data: Dict[str, str],
    import_id: str,
    source_row: int,
    source_file: str,
) -> Dict[str, Any]:
    title = (data.get("title") or "").strip()
    brand = (data.get("brand") or "").strip() or None
    if not brand and title:
        brand = infer_brand_from_title(title)
    mpn = (data.get("mpn") or "").strip() or None
    if not title and brand and mpn:
        title = f"{brand} {mpn}".strip()
    if not title and (data.get("sku") or "").strip():
        title = f"Listing {data['sku'].strip()}"
    if not title:
        title = "Untitled listing"

    image_urls: List[str] = []
    if data.get("imageUrls"):
        image_urls = [u.strip() for u in data["imageUrls"].split("|") if u.strip()]

    price = None
    if data.get("price"):
        try:
            price = float(data["price"].replace(",", "").replace("$", ""))
        except ValueError:
            pass
    qty = None
    if data.get("quantity"):
        try:
            qty = int(float(data["quantity"]))
        except ValueError:
            pass

    cid = (data.get("conditionId") or "").strip() or None
    cid_base = re.sub(r"-.*", "", cid) if cid else None

    fitment_data = None
    raw = (data.get("_fitmentRecordsJson") or "").strip()
    if raw:
        try:
            parsed = json.loads(raw)
            if isinstance(parsed, list) and parsed:
                fitment_data = parsed
        except json.JSONDecodeError:
            pass

    return {
        "sku": (data.get("sku") or "").strip() or None,
        "mpn": mpn,
        "mpn_normalized": normalize_mpn(mpn) if mpn else None,
        "upc": (data.get("upc") or "").strip() or None,
        "ean": (data.get("ean") or "").strip() or None,
        "ebay_item_id": (data.get("ebayItemId") or "").strip() or None,
        "epid": (data.get("epid") or "").strip() or None,
        "title": title,
        "title_normalized": normalize_title(title),
        "description": (data.get("description") or "").strip() or None,
        "brand": brand,
        "brand_normalized": normalize_brand(brand) if brand else None,
        "part_type": (data.get("partType") or "").strip() or None,
        "placement": (data.get("placement") or "").strip() or None,
        "material": (data.get("material") or "").strip() or None,
        "features": (data.get("features") or "").strip() or None,
        "country_of_origin": (data.get("countryOfOrigin") or "").strip() or None,
        "oem_part_number": (data.get("oemPartNumber") or "").strip() or None,
        "price": price,
        "quantity": qty,
        "condition_id": cid_base,
        "condition_label": condition_label(cid),
        "category_id": (data.get("categoryId") or "").strip() or None,
        "category_name": (data.get("categoryName") or "").strip() or None,
        "image_urls": image_urls,
        "location": (data.get("location") or "").strip() or None,
        "format": (data.get("format") or "").strip() or None,
        "duration": (data.get("duration") or "").strip() or None,
        "shipping_profile": (data.get("shippingProfile") or "").strip() or None,
        "return_profile": (data.get("returnProfile") or "").strip() or None,
        "payment_profile": (data.get("paymentProfile") or "").strip() or None,
        "fitment_data": fitment_data,
        "source_file": source_file,
        "source_row": source_row,
        "import_id": import_id,
    }


def map_listing_row(
    data: Dict[str, str],
    source_row: int,
    source_file: str,
    csv_path: str,
    sheet_name: str,
) -> Dict[str, Any]:
    def norm_num(v: Optional[str]) -> Optional[str]:
        if not v:
            return None
        c = re.sub(r"[$,\s]", "", v)
        return c if re.match(r"^-?\d+(\.\d+)?$", c) else None

    def norm_int(v: Optional[str]) -> Optional[str]:
        if not v:
            return None
        c = re.sub(r"[\s,]", "", v)
        return c if re.match(r"^-?\d+$", c) else None

    sp = norm_num(data.get("price"))
    qn = norm_int(data.get("quantity"))
    binp = norm_num(data.get("buyItNowPrice"))
    spn = float(sp) if sp else None
    qnn = int(qn) if qn else None
    bnn = float(binp) if binp else None

    return {
        "sourceFileName": source_file,
        "sourceFilePath": csv_path,
        "sheetName": sheet_name,
        "sourceRowNumber": source_row,
        "action": (data.get("action") or "Add").strip(),
        "customLabelSku": (data.get("sku") or "").strip() or None,
        "categoryId": (data.get("categoryId") or "").strip() or None,
        "categoryName": (data.get("categoryName") or "").strip() or None,
        "title": (data.get("title") or "").strip() or None,
        "pUpc": (data.get("upc") or "").strip() or None,
        "pEpid": (data.get("epid") or "").strip() or None,
        "startPrice": sp,
        "quantity": qn,
        "itemPhotoUrl": (data.get("imageUrls") or "").strip() or None,
        "conditionId": (data.get("conditionId") or "").strip() or None,
        "description": (data.get("description") or "").strip() or None,
        "format": (data.get("format") or "").strip() or None,
        "duration": (data.get("duration") or "").strip() or None,
        "buyItNowPrice": binp,
        "location": (data.get("location") or "").strip() or None,
        "shippingProfileName": (data.get("shippingProfile") or "").strip() or None,
        "returnProfileName": (data.get("returnProfile") or "").strip() or None,
        "paymentProfileName": (data.get("paymentProfile") or "").strip() or None,
        "cBrand": (data.get("brand") or "").strip() or None,
        "cType": (data.get("partType") or "").strip() or None,
        "cFeatures": (data.get("features") or "").strip() or None,
        "cManufacturerPartNumber": (data.get("mpn") or "").strip() or None,
        "cOeOemPartNumber": (data.get("oemPartNumber") or "").strip() or None,
        "cOperatingMode": (data.get("operatingMode") or "").strip() or None,
        "cFuelType": (data.get("fuelType") or "").strip() or None,
        "cDriveType": (data.get("driveType") or "").strip() or None,
        "startPriceNum": spn,
        "quantityNum": qnn,
        "buyItNowPriceNum": bnn,
    }


def clear_catalog(conn) -> None:
    cur = conn.cursor()
    cur.execute("SET LOCAL statement_timeout = '5min'")
    stmts = [
        'UPDATE "motors_products" SET "catalogProductId" = NULL WHERE "catalogProductId" IS NOT NULL',
        'UPDATE "motors_products" SET "listingId" = NULL WHERE "listingId" IS NOT NULL',
        'UPDATE "master_products" SET "listing_record_id" = NULL WHERE "listing_record_id" IS NOT NULL',
        'DELETE FROM "listing_revisions"',
        'DELETE FROM "compliance_audit_logs"',
        'DELETE FROM "catalog_import_rows"',
        'DELETE FROM "catalog_imports"',
        'DELETE FROM "catalog_products"',
        'DELETE FROM "listing_records"',
    ]
    for sql in stmts:
        try:
            cur.execute(sql)
        except Exception as e:
            log(f"clear step skipped ({e.__class__.__name__}): {sql[:60]}...")
    conn.commit()
    log("Catalog cleared (motors unlinked, imports wiped, products + listings deleted).")


def load_existing_identifiers(conn) -> Tuple[set, set, set]:
    """Lowercased sku/upc/ebay_item_id from DB for dedupe (matches unique indexes)."""
    cur = conn.cursor()
    cur.execute(
        """
        SELECT lower(trim("sku")) FROM catalog_products
        WHERE "sku" IS NOT NULL AND btrim("sku") <> ''
        """
    )
    seen_sku = {r[0] for r in cur.fetchall() if r[0]}
    cur.execute(
        """
        SELECT lower(trim("upc")) FROM catalog_products
        WHERE "upc" IS NOT NULL AND btrim("upc") <> ''
        """
    )
    seen_upc = {r[0] for r in cur.fetchall() if r[0]}
    cur.execute(
        """
        SELECT lower(trim("ebay_item_id")) FROM catalog_products
        WHERE "ebay_item_id" IS NOT NULL AND btrim("ebay_item_id") <> ''
        """
    )
    seen_ebay = {r[0] for r in cur.fetchall() if r[0]}
    cur.close()
    return seen_sku, seen_upc, seen_ebay


def load_imported_source_rows(conn, source_file: str, sheet_name: str) -> set:
    """sourceRowNumber already committed for this File Exchange sheet (resume skip)."""
    cur = conn.cursor()
    cur.execute(
        """
        SELECT "sourceRowNumber" FROM listing_records
        WHERE "sourceFileName" = %s AND "sheetName" = %s
        """,
        (source_file, sheet_name),
    )
    rows = {int(r[0]) for r in cur.fetchall() if r[0] is not None}
    cur.close()
    return rows


def ebay_app_token() -> str:
    client_id = os.environ.get("EBAY_CLIENT_ID", "").strip()
    client_secret = os.environ.get("EBAY_CLIENT_SECRET", "").strip()
    env = os.environ.get("EBAY_ENVIRONMENT", "PRODUCTION").strip().upper()
    sandbox = os.environ.get("EBAY_SANDBOX", "").lower() == "true" or env != "PRODUCTION"
    base = "https://api.sandbox.ebay.com" if sandbox else "https://api.ebay.com"
    basic = base64.b64encode(f"{client_id}:{client_secret}".encode()).decode()
    r = requests.post(
        f"{base}/identity/v1/oauth2/token",
        data="grant_type=client_credentials&scope=https://api.ebay.com/oauth/api_scope",
        headers={
            "Content-Type": "application/x-www-form-urlencoded",
            "Authorization": f"Basic {basic}",
        },
        timeout=60,
    )
    r.raise_for_status()
    return r.json()["access_token"]


def browse_enrich_row(data: Dict[str, str], token: str, marketplace: str = "EBAY_US") -> None:
    legacy = (data.get("ebayItemId") or "").strip()
    if not legacy or not re.match(r"^\d{9,}$", legacy):
        return
    env = os.environ.get("EBAY_ENVIRONMENT", "PRODUCTION").strip().upper()
    sandbox = os.environ.get("EBAY_SANDBOX", "").lower() == "true" or env != "PRODUCTION"
    base = "https://api.sandbox.ebay.com" if sandbox else "https://api.ebay.com"
    url = f"{base}/buy/browse/v1/item/get_item_by_legacy_id"
    r = requests.get(
        url,
        params={"legacy_item_id": legacy},
        headers={
            "Authorization": f"Bearer {token}",
            "X-EBAY-C-MARKETPLACE-ID": marketplace,
        },
        timeout=45,
    )
    if not r.ok:
        return
    item = r.json()
    if not (data.get("title") or "").strip() and item.get("title"):
        data["title"] = item["title"]
    if not (data.get("brand") or "").strip():
        b = item.get("brand")
        if not b:
            for asp in item.get("localizedAspects") or []:
                if (asp.get("name") or "").lower() == "brand":
                    b = asp.get("value")
                    break
        if b:
            data["brand"] = b
    if not (data.get("imageUrls") or "").strip():
        img = (item.get("image") or {}).get("imageUrl")
        if img:
            data["imageUrls"] = img


def ext_from_url_or_mime(url: str, content_type: str) -> str:
    try:
        path = urlparse(url).path
        m = re.search(r"\.([a-zA-Z0-9]+)$", path)
        if m:
            return "." + m.group(1).lower()
    except Exception:
        pass
    ct = (content_type or "").split(";")[0].strip().lower()
    if "jpeg" in ct or "jpg" in ct:
        return ".jpg"
    if "png" in ct:
        return ".png"
    if "webp" in ct:
        return ".webp"
    if "gif" in ct:
        return ".gif"
    return ".bin"


def public_s3_url(bucket: str, region: str, key: str) -> str:
    if region == "us-east-1":
        return f"https://{bucket}.s3.amazonaws.com/{key}"
    return f"https://{bucket}.s3.{region}.amazonaws.com/{key}"


def mirror_urls_for_sku(
    urls: List[str],
    bucket: str,
    region: str,
    prefix: str,
    import_id: str,
    sku_safe: str,
    parallel: int,
    session: requests.Session,
    s3,
) -> List[str]:
    out = list(urls)
    bucket_prefix = prefix.strip("/")
    if bucket_prefix:
        bucket_prefix += "/"

    def one(idx: int, raw: str) -> Tuple[int, str]:
        u = (raw or "").strip()
        if not u or not re.match(r"^https?://", u, re.I):
            return idx, u
        host = urlparse(u).hostname or ""
        if bucket.lower() in host.lower() and ".s3" in host.lower():
            return idx, u
        try:
            res = session.get(u, timeout=120, headers={"User-Agent": "RealTrackApp-bulk-import/1.0"})
            if not res.ok:
                return idx, u
            ctype = res.headers.get("content-type", "application/octet-stream").split(";")[0].strip()
            ext = ext_from_url_or_mime(u, ctype)
            key = f"{bucket_prefix}catalog-images/{import_id}/{sku_safe}/{idx:03d}{ext}"
            s3.put_object(Bucket=bucket, Key=key, Body=res.content, ContentType=ctype)
            return idx, public_s3_url(bucket, region, key)
        except Exception:
            return idx, u

    indices = [i for i, u in enumerate(urls) if u and re.match(r"^https?://", u.strip(), re.I)]
    for start in range(0, len(indices), max(1, parallel)):
        chunk = indices[start : start + parallel]
        with ThreadPoolExecutor(max_workers=len(chunk)) as ex:
            futs = [ex.submit(one, i, urls[i]) for i in chunk]
            for fut in as_completed(futs):
                idx, val = fut.result()
                out[idx] = val
    return out


def insert_batch(
    conn,
    rows_cat: List[Dict[str, Any]],
    rows_list: List[Dict[str, Any]],
) -> List[Tuple[str, Optional[str], List[str], int, str]]:
    """Returns list of (product_id, sku, image_urls, source_row, source_file) for mirroring."""
    cur = conn.cursor()
    ids_out: List[Tuple[str, Optional[str], List[str], int, str]] = []
    for c, l in zip(rows_cat, rows_list):
        pid = str(uuid.uuid4())
        lid = str(uuid.uuid4())
        cur.execute(
            """
            INSERT INTO "catalog_products" (
              "id", "sku", "mpn", "mpn_normalized", "upc", "ean", "ebay_item_id", "epid",
              "title", "title_normalized", "description", "brand", "brand_normalized",
              "part_type", "placement", "material", "features", "country_of_origin", "oem_part_number",
              "price", "quantity", "condition_id", "condition_label", "category_id", "category_name",
              "image_urls", "location", "format", "duration", "shipping_profile", "return_profile", "payment_profile",
              "fitment_data", "source_file", "source_row", "import_id"
            ) VALUES (
              %s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s
            )
            """,
            (
                pid,
                c["sku"],
                c["mpn"],
                c["mpn_normalized"],
                c["upc"],
                c["ean"],
                c["ebay_item_id"],
                c["epid"],
                c["title"],
                c["title_normalized"],
                c["description"],
                c["brand"],
                c["brand_normalized"],
                c["part_type"],
                c["placement"],
                c["material"],
                c["features"],
                c["country_of_origin"],
                c["oem_part_number"],
                c["price"],
                c["quantity"],
                c["condition_id"],
                c["condition_label"],
                c["category_id"],
                c["category_name"],
                c["image_urls"],
                c["location"],
                c["format"],
                c["duration"],
                c["shipping_profile"],
                c["return_profile"],
                c["payment_profile"],
                Json(c["fitment_data"]) if c["fitment_data"] is not None else None,
                c["source_file"],
                c["source_row"],
                c["import_id"],
            ),
        )
        cur.execute(
            """
            INSERT INTO "listing_records" (
              "id", "organization_id", "sourceFileName", "sourceFilePath", "sheetName", "sourceRowNumber",
              "action", "customLabelSku", "categoryId", "categoryName", "title", "pUpc", "pEpid",
              "startPrice", "quantity", "itemPhotoUrl", "conditionId", "description", "format", "duration",
              "buyItNowPrice", "location", "shippingProfileName", "returnProfileName", "paymentProfileName",
              "cBrand", "cType", "cFeatures", "cManufacturerPartNumber", "cOeOemPartNumber",
              "cOperatingMode", "cFuelType", "cDriveType",
              "startPriceNum", "quantityNum", "buyItNowPriceNum", "version"
            ) VALUES (
              %s,NULL,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s
            )
            """,
            (
                lid,
                l["sourceFileName"],
                l["sourceFilePath"],
                l["sheetName"],
                l["sourceRowNumber"],
                l["action"],
                l["customLabelSku"],
                l["categoryId"],
                l["categoryName"],
                l["title"],
                l["pUpc"],
                l["pEpid"],
                l["startPrice"],
                l["quantity"],
                l["itemPhotoUrl"],
                l["conditionId"],
                l["description"],
                l["format"],
                l["duration"],
                l["buyItNowPrice"],
                l["location"],
                l["shippingProfileName"],
                l["returnProfileName"],
                l["paymentProfileName"],
                l["cBrand"],
                l["cType"],
                l["cFeatures"],
                l["cManufacturerPartNumber"],
                l["cOeOemPartNumber"],
                l["cOperatingMode"],
                l["cFuelType"],
                l["cDriveType"],
                l["startPriceNum"],
                l["quantityNum"],
                l["buyItNowPriceNum"],
                1,
            ),
        )
        ids_out.append((pid, c["sku"], list(c["image_urls"] or []), c["source_row"], l["sourceFileName"]))
    cur.close()
    conn.commit()
    return ids_out


def update_mirrored(
    conn,
    product_id: str,
    urls: List[str],
    source_file: str,
    sheet_name: str,
    source_row: int,
) -> None:
    cur = conn.cursor()
    cur.execute(
        'UPDATE "catalog_products" SET "image_urls" = %s WHERE "id" = %s',
        (urls, product_id),
    )
    joined = "|".join([u for u in urls if u])
    cur.execute(
        """
        UPDATE "listing_records" SET "itemPhotoUrl" = %s
        WHERE "sourceFileName" = %s AND "sheetName" = %s AND "sourceRowNumber" = %s
        """,
        (joined, source_file, sheet_name, source_row),
    )
    cur.close()
    conn.commit()


def enrich_parallel(rows: List[Dict[str, str]], token: str, workers: int) -> None:
    if not rows:
        return

    def job(d: Dict[str, str]) -> None:
        browse_enrich_row(d, token)

    with ThreadPoolExecutor(max_workers=max(1, workers)) as ex:
        list(ex.map(job, rows))


def main() -> int:
    ap = argparse.ArgumentParser(description="Bulk catalog import with S3 mirroring")
    ap.add_argument("--csv", type=Path, default=ROOT / "docs" / "inventory-export-2026-05-11.csv")
    ap.add_argument("--yes", action="store_true", help="Confirm destructive clear + import")
    ap.add_argument(
        "--resume",
        action="store_true",
        help="Skip catalog wipe; append to existing import_id (requires --import-id)",
    )
    ap.add_argument(
        "--import-id",
        dest="import_id",
        type=str,
        default="",
        help="catalog_products.import_id UUID to continue (with --resume)",
    )
    ap.add_argument("--no-browse", action="store_true")
    ap.add_argument("--no-mirror", action="store_true")
    ap.add_argument("--logical-batch", type=int, default=200)
    ap.add_argument("--mirror-workers", type=int, default=6)
    ap.add_argument("--browse-workers", type=int, default=8)
    args = ap.parse_args()

    if args.resume:
        if not (args.import_id or "").strip():
            log("--resume requires --import-id <uuid from prior Done. log line>")
            return 2
        try:
            uuid.UUID(args.import_id.strip())
        except ValueError:
            log(f"Invalid --import-id: {args.import_id!r}")
            return 2
    elif not args.yes:
        log(
            "Refusing to run without --yes (clears entire catalog). "
            "To continue a partial import use: --resume --import-id <uuid> --csv …"
        )
        return 2

    csv_path = args.csv.resolve()
    if not csv_path.is_file():
        log(f"CSV not found: {csv_path}")
        return 1

    db_host = os.environ.get("DB_HOST", "localhost")
    db_port = int(os.environ.get("DB_PORT", "5432"))
    db_user = os.environ.get("DB_USER", "postgres")
    db_pass = os.environ.get("DB_PASSWORD", "postgres")
    db_name = os.environ.get("DB_NAME", "listingpro")

    bucket = os.environ.get("AWS_S3_BUCKET", os.environ.get("S3_BUCKET", "")).strip()
    region = os.environ.get("AWS_S3_REGION", os.environ.get("S3_REGION", "us-east-1")).strip()
    key_prefix = os.environ.get("AWS_S3_PREFIX", os.environ.get("S3_PREFIX", "")).strip()

    conn = psycopg2.connect(
        host=db_host,
        port=db_port,
        user=db_user,
        password=db_pass,
        dbname=db_name,
    )
    conn.autocommit = False

    log(f"Connecting DB {db_user}@{db_host}:{db_port}/{db_name}")
    source_file = csv_path.name
    abs_csv = str(csv_path)

    if args.resume:
        run_import_id = str(uuid.UUID(args.import_id.strip()))
        sheet_name = f"Python bulk {run_import_id[:8]}"
        cur = conn.cursor()
        cur.execute(
            'SELECT COUNT(*) FROM catalog_products WHERE "import_id" = %s',
            (run_import_id,),
        )
        n_existing = cur.fetchone()[0]
        cur.execute(
            """
            SELECT COUNT(*) FROM listing_records
            WHERE "sourceFileName" = %s AND "sheetName" = %s
            """,
            (source_file, sheet_name),
        )
        n_listings = cur.fetchone()[0]
        cur.close()
        if n_existing == 0:
            log(f"No catalog_products with import_id={run_import_id}; nothing to resume.")
            conn.close()
            return 2
        if n_listings == 0:
            log(
                f"No listing_records for file={source_file!r} sheet={sheet_name!r}; "
                "import_id exists but sheet/file do not match this CSV name or prior run."
            )
            conn.close()
            return 2
        log(
            f"Resume: catalog not cleared; import_id={run_import_id} sheet={sheet_name!r} "
            f"(existing products={n_existing} listings={n_listings})"
        )
    else:
        clear_catalog(conn)
        run_import_id = str(uuid.uuid4())
        sheet_name = f"Python bulk {run_import_id[:8]}"

    token: Optional[str] = None
    if not args.no_browse:
        try:
            token = ebay_app_token()
            log("eBay application token acquired.")
        except Exception as e:
            log(f"Browse API disabled ({e}); continuing without enrich.")
            token = None

    s3 = boto3.client(
        "s3",
        region_name=region,
        aws_access_key_id=os.environ.get("AWS_ACCESS_KEY_ID") or None,
        aws_secret_access_key=os.environ.get("AWS_SECRET_ACCESS_KEY") or None,
    )
    http = requests.Session()

    if args.resume:
        seen_sku, seen_upc, seen_ebay = load_existing_identifiers(conn)
        seen_source_rows = load_imported_source_rows(conn, source_file, sheet_name)
        log(
            f"Dedupe primed: sku={len(seen_sku)} upc={len(seen_upc)} ebay={len(seen_ebay)} "
            f"already_imported_source_rows={len(seen_source_rows)}"
        )
    else:
        seen_sku = set()
        seen_upc = set()
        seen_ebay = set()
        seen_source_rows = set()

    inserted = 0
    skipped_resume = 0
    skipped_dup = 0
    skipped_bad = 0

    batch_cat: List[Dict[str, Any]] = []
    batch_list: List[Dict[str, Any]] = []

    staging: List[Tuple[int, Dict[str, str]]] = []

    def flush_batch() -> None:
        nonlocal inserted, batch_cat, batch_list
        if not batch_cat:
            return
        mirror_targets = insert_batch(conn, batch_cat, batch_list)

        if not args.no_mirror and bucket:
            def mirror_job(meta: Tuple[str, Optional[str], List[str], int, str]) -> None:
                pid, sku, urls, srow, sf = meta
                if not urls:
                    return
                sku_safe = re.sub(r"[^a-zA-Z0-9_-]", "_", sku or pid)[:120]
                mirrored = mirror_urls_for_sku(
                    urls,
                    bucket,
                    region,
                    key_prefix,
                    run_import_id,
                    sku_safe,
                    args.mirror_workers,
                    http,
                    s3,
                )
                update_mirrored(conn, pid, mirrored, sf, sheet_name, srow)

            with ThreadPoolExecutor(max_workers=max(1, args.mirror_workers)) as pool:
                list(pool.map(mirror_job, mirror_targets))
        inserted += len(batch_cat)
        batch_cat = []
        batch_list = []

    def flush_staging() -> None:
        nonlocal staging
        if not staging:
            return
        if token and not args.no_browse:
            enrich_parallel([d for _, d in staging], token, args.browse_workers)
        for sr, d in staging:
            c = map_catalog_row(d, run_import_id, sr, source_file)
            l = map_listing_row(d, sr, source_file, abs_csv, sheet_name)
            if not l.get("title"):
                l["title"] = c["title"]
            if not l.get("cBrand") and c.get("brand"):
                l["cBrand"] = c["brand"]
            batch_cat.append(c)
            batch_list.append(l)
            if len(batch_cat) >= args.logical_batch:
                flush_batch()
                log(
                    f"Progress: inserted={inserted} skipped_resume={skipped_resume} "
                    f"skipped_dup={skipped_dup} skipped_bad={skipped_bad}"
                )
        staging.clear()

    it = iter_logical_rows(csv_path)
    pbar = tqdm(desc="Listings", unit="row") if tqdm else None

    for source_row, data, _cells in it:
        if pbar is not None:
            pbar.update(1)

        if source_row in seen_source_rows:
            skipped_resume += 1
            continue

        sku_k = (data.get("sku") or "").strip().lower() or None
        upc_k = (data.get("upc") or "").strip().lower() or None
        ebay_k = (data.get("ebayItemId") or "").strip().lower() or None

        if sku_k and sku_k in seen_sku:
            skipped_dup += 1
            continue
        if upc_k and upc_k in seen_upc:
            skipped_dup += 1
            continue
        if ebay_k and ebay_k in seen_ebay:
            skipped_dup += 1
            continue

        title_ok = bool((data.get("title") or "").strip())
        brand_mpn_ok = bool((data.get("brand") or "").strip() and (data.get("mpn") or "").strip())
        if not title_ok and not brand_mpn_ok:
            skipped_bad += 1
            continue

        if sku_k:
            seen_sku.add(sku_k)
        if upc_k:
            seen_upc.add(upc_k)
        if ebay_k:
            seen_ebay.add(ebay_k)

        staging.append((source_row, data))
        if len(staging) >= max(1, args.browse_workers):
            flush_staging()

    flush_staging()
    flush_batch()

    if pbar is not None:
        pbar.close()

    log(
        f"Done. inserted={inserted} skipped_resume={skipped_resume} skipped_dup={skipped_dup} "
        f"skipped_bad={skipped_bad} import_id={run_import_id} sheet={sheet_name}"
    )
    conn.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
