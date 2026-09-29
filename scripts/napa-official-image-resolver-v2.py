#!/usr/bin/env python3
import csv
import json
import os
import re
import time
import urllib.parse
from concurrent.futures import ThreadPoolExecutor, as_completed

import requests

INPUT = "/home/ubuntu/realtrackapp/output/ebay-pipeline/napa_ebay_shopify_listings.seo-enriched.csv"
OUTPUT = "/home/ubuntu/realtrackapp/output/ebay-pipeline/napa_official_image_matches_v2.json"
STATUS = f"{OUTPUT}.status.json"

with open(INPUT, encoding="utf-8-sig", newline="") as handle:
    rows = [row for row in csv.DictReader(handle) if row.get("Brand", "").lower() == "napa" and not row.get("Image URL")]


def compact(value):
    return re.sub(r"[^A-Za-z0-9]", "", value or "").upper()


def add_unique(values, value):
    if value and value not in values:
        values.append(value)


def candidate_codes(row):
    mpn = compact(row.get("MPN"))
    product_type = row.get("Product Type", "")
    codes = []
    if product_type == "Brake Caliper":
        for prefix in ("ADC", "ACA", "UP_", "SEB"):
            add_unique(codes, prefix + mpn)
    elif product_type == "Disc Brake Rotor":
        for prefix in ("NB", "NBR", "UP_", "VLR"):
            add_unique(codes, prefix + mpn)
    elif product_type == "Wheel Bearing":
        for prefix in ("PGB", "BRG", "NBR", "SKF"):
            add_unique(codes, prefix + mpn)
    elif product_type == "Brake Pads":
        for prefix in ("ADO", "FNP", "UP_", "SS"):
            add_unique(codes, prefix + mpn)
    elif product_type == "Brake Shoes":
        for prefix in ("NBS", "NUP", "UP_", "SS"):
            add_unique(codes, prefix + mpn)
    elif product_type == "Disc Brake Hardware Kit":
        for prefix in ("UP_", "UP", "NAPA"):
            add_unique(codes, prefix + mpn)
    elif product_type == "Brake Hose":
        for prefix in ("UP_", "UP", "NCH", "BH"):
            add_unique(codes, prefix + mpn)
    elif product_type == "Slave Cylinder":
        for prefix in ("NCF", "UP_", "SC"):
            add_unique(codes, prefix + mpn)
    elif product_type == "Ball Joint":
        for prefix in ("PCC", "NCP", "NCT", "ATM"):
            add_unique(codes, prefix + mpn)
    elif product_type in {
        "Control Arm", "Control Arm Bushing", "Knuckle Bushing", "Stabilizer Bar Link",
        "Stabilizer Bar Bushing", "Stabilizer Bar Bushing Kit", "Suspension Track Bar",
        "Trailing Arm Bushing", "Mounting Kit", "Camber Kit (set Of 2)",
    }:
        for prefix in ("NCP", "NCT", "NCQ", "PCC", "ATM"):
            add_unique(codes, prefix + mpn)
    elif product_type in {"Tie Rod End", "Tie Rod"}:
        for prefix in ("NCD", "NCP", "PCC"):
            add_unique(codes, prefix + mpn)
    elif product_type in {"Shock Absorber", "Suspension Strut"}:
        for prefix in ("NPS", "NS", "NSS", "NCA", "NAPA"):
            add_unique(codes, prefix + mpn)
    elif product_type in {"Steering Shaft", "Steering Rack & Pinion", "Power Steering Pump", "Power Steering Pulley"}:
        for prefix in ("NPS", "NCP", "NCA", "PCC"):
            add_unique(codes, prefix + mpn)
    elif product_type in {"Starter Motor", "Alternator"}:
        for prefix in ("RAY", "NAD", "NAA", "NAPA"):
            add_unique(codes, prefix + mpn)
    elif product_type in {"Air Filter", "Cabin Filter", "Oil Filter"}:
        for prefix in ("FIL", "NAPA"):
            add_unique(codes, prefix + mpn)
    elif product_type == "Water Pump":
        for prefix in ("TFW", "NWP", "NAPA"):
            add_unique(codes, prefix + mpn)
    elif product_type == "Fuel Pump":
        for prefix in ("NEP", "NFP", "EFP", "NAPA"):
            add_unique(codes, prefix + mpn)
    elif product_type == "Thermostat Housing Assembly":
        for prefix in ("NOE", "ATM", "NAPA"):
            add_unique(codes, prefix + mpn)
    elif product_type in {"Power Window Switch", "Positive Battery Terminal"}:
        for prefix in ("EWS", "NPS", "ECH", "NOE"):
            add_unique(codes, prefix + mpn)
    else:
        for prefix in ("NCP", "NPS", "NOE", "RAY", "ATM", "NAPA"):
            add_unique(codes, prefix + mpn)
    add_unique(codes, mpn)
    return codes


def extract_images(text):
    urls = re.findall(
        r"https?://media\.(?:napaonline|napacanada)\.com/is/image/GenuinePartsCompany/\d+/?[^\s)\]]*",
        text,
        flags=re.I,
    )
    clean = []
    for url in urls:
        url = url.replace("&amp;", "&").rstrip(".,;'")
        url = re.sub(r"[?&]preset=[^&\s]+", "", url)
        url = re.sub(r"[?&]format=[^&\s]+", "", url)
        url = url.rstrip("?&")
        url = url.replace("media.napacanada.com", "media.napaonline.com")
        url = f"{url}?format=webp&preset=webproofxlarge"
        if url not in clean:
            clean.append(url)
    return clean


def resolve(row):
    needle = compact(row.get("MPN"))
    session = requests.Session()
    session.headers.update({"User-Agent": "Mozilla/5.0 (compatible; RealTrackCatalogBot/1.0)"})
    for code in candidate_codes(row):
        url = "https://r.jina.ai/http://www.napacanada.com/en/p/" + urllib.parse.quote(code, safe="_")
        text = ""
        for attempt in range(2):
            try:
                response = session.get(url, timeout=25)
                text = response.text or ""
                if response.status_code == 200 and text:
                    break
            except requests.RequestException:
                pass
            time.sleep(1.5 * (attempt + 1))
        first = text.splitlines()[0] if text else ""
        if "Page Not Found" in first or "Security verification" in first:
            continue
        if needle and needle not in compact(text):
            continue
        images = extract_images(text)
        if not images:
            continue
        image = images[0]
        try:
            validation = session.head(image, timeout=25, allow_redirects=True)
            if validation.status_code >= 400 or not validation.headers.get("content-type", "").lower().startswith("image/"):
                continue
        except requests.RequestException:
            continue
        return {
            "sku": row.get("Custom Label (SKU)", ""),
            "mpn": row.get("MPN", ""),
            "productType": row.get("Product Type", ""),
            "code": code,
            "productUrl": f"https://www.napacanada.com/en/p/{code}",
            "imageUrl": image,
            "title": first.replace("Title: ", "")[:300],
            "source": "Official NAPA Canada product page and NAPA CDN",
        }
    return {"sku": row.get("Custom Label (SKU)", ""), "noMatch": True}


try:
    with open(OUTPUT, encoding="utf-8") as handle:
        saved = json.load(handle)
except (FileNotFoundError, json.JSONDecodeError):
    saved = []
by_sku = {item["sku"]: item for item in saved}
todo = [row for row in rows if row.get("Custom Label (SKU)") not in by_sku]
done = len(rows) - len(todo)

with ThreadPoolExecutor(max_workers=12) as executor:
    future_rows = {executor.submit(resolve, row): row for row in todo}
    for future in as_completed(future_rows):
        row = future_rows[future]
        try:
            result = future.result()
        except Exception as error:
            result = {"sku": row.get("Custom Label (SKU)", ""), "noMatch": True, "error": str(error)}
        by_sku[result["sku"]] = result
        done += 1
        if done % 10 == 0:
            with open(OUTPUT, "w", encoding="utf-8") as handle:
                json.dump(sorted(by_sku.values(), key=lambda item: item["sku"]), handle, indent=2)
                handle.write("\n")
            matches = sum(not item.get("noMatch") for item in by_sku.values())
            print(f"[napa-official-v2] {done}/{len(rows)} matches={matches}", flush=True)

with open(OUTPUT, "w", encoding="utf-8") as handle:
    json.dump(sorted(by_sku.values(), key=lambda item: item["sku"]), handle, indent=2)
    handle.write("\n")
matches = [item for item in by_sku.values() if not item.get("noMatch")]
summary = {"rows": len(rows), "processed": len(by_sku), "matches": len(matches), "missing": len(rows) - len(matches), "output": OUTPUT}
with open(STATUS, "w", encoding="utf-8") as handle:
    json.dump(summary, handle, indent=2)
    handle.write("\n")
print(json.dumps(summary, indent=2))
