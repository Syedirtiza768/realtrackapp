import csv
import json
import os
import re
from collections import Counter, defaultdict
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple

import chardet
import numpy as np
import pandas as pd


ROOT = Path(r"d:\apps\listingpro")
FILES_DIR = ROOT / "files"
OUT_DIR = FILES_DIR / "_analysis_outputs"
OUT_DIR.mkdir(parents=True, exist_ok=True)

SPREADSHEET_EXTS = {".xlsx", ".xls", ".csv", ".tsv", ".ods"}


SKU_RE = re.compile(r"^[A-Z0-9][A-Z0-9\-_]{4,}$")
VIN_RE = re.compile(r"^[A-HJ-NPR-Z0-9]{17}$")
EMAIL_RE = re.compile(r"^[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}$", re.IGNORECASE)
PHONE_RE = re.compile(r"^(?:\+?\d[\d\-\s\(\)]{7,}\d)$")
CURRENCY_RE = re.compile(r"[$€£¥]|\bUSD\b|\bEUR\b|\bGBP\b|\bAED\b", re.IGNORECASE)
ID_COL_RE = re.compile(r"\b(id|code|sku|vin|key|number|no)\b", re.IGNORECASE)
URL_RE = re.compile(r"^https?://", re.IGNORECASE)
IMAGE_EXT_RE = re.compile(r"\.(jpg|jpeg|png|webp|gif)(\?.*)?$", re.IGNORECASE)


@dataclass
class FileInventory:
    file_rel_path: str
    file_type: str
    file_size: int
    last_modified: str
    encoding: str
    delimiter: str
    sheet_count: int


@dataclass
class ColumnProfile:
    file_rel_path: str
    sheet_name: str
    column_original: str
    column_normalized: str
    inferred_type: str
    missing_pct: float
    sample_values: str
    top5_values: str
    unique_ratio: float
    non_null_count: int
    pattern_hits: Dict[str, int]


@dataclass
class SheetProfile:
    file_rel_path: str
    sheet_name: str
    row_count: int
    column_count: int
    header_confidence: float
    structure_signature: str
    likely_key_columns: List[str]


def normalize_col(name: Any) -> str:
    s = str(name).strip().lower()
    s = re.sub(r"\s+", "_", s)
    s = re.sub(r"[^a-z0-9_]+", "", s)
    return s or "unnamed"


def detect_encoding_and_delimiter(path: Path) -> Tuple[str, str]:
    raw = path.read_bytes()[:50000]
    enc_guess = chardet.detect(raw).get("encoding") or "utf-8"
    delimiter = ""
    try:
        txt = raw.decode(enc_guess, errors="replace")
        sample = "\n".join(txt.splitlines()[:10])
        dialect = csv.Sniffer().sniff(sample, delimiters=[",", "\t", ";", "|"])
        delimiter = dialect.delimiter
    except Exception:
        delimiter = "\t" if path.suffix.lower() == ".tsv" else ","
    return enc_guess, delimiter


def infer_type(series: pd.Series) -> str:
    non_null = series.dropna()
    if non_null.empty:
        return "mixed"

    as_str = non_null.astype(str).str.strip()
    bool_hits = as_str.str.lower().isin({"true", "false", "yes", "no", "0", "1"}).mean()

    numeric_conv = pd.to_numeric(as_str.str.replace(",", "", regex=False), errors="coerce")
    num_ratio = numeric_conv.notna().mean()

    date_conv = pd.to_datetime(as_str, errors="coerce", utc=False)
    date_ratio = date_conv.notna().mean()

    if bool_hits > 0.95:
        return "boolean"
    if date_ratio > 0.9 and num_ratio < 0.8:
        return "date"
    if num_ratio > 0.95:
        clean_vals = numeric_conv.dropna()
        if np.all(np.isclose(clean_vals % 1, 0)):
            return "numeric"
        return "decimal"
    if num_ratio > 0.25 and date_ratio > 0.25:
        return "mixed"
    return "string"


def detect_patterns(series: pd.Series) -> Dict[str, int]:
    non_null = series.dropna().astype(str).str.strip()
    if non_null.empty:
        return {k: 0 for k in ["sku_like", "vin_like", "currency", "email", "phone", "date_like", "id_incremental", "url", "image_url"]}

    sku_like = int(non_null.str.upper().str.match(SKU_RE).sum())
    vin_like = int(non_null.str.upper().str.match(VIN_RE).sum())
    currency = int(non_null.str.contains(CURRENCY_RE, regex=True).sum())
    email = int(non_null.str.match(EMAIL_RE).sum())
    phone = int(non_null.str.match(PHONE_RE).sum())
    url = int(non_null.str.match(URL_RE).sum())
    image_url = int(non_null.str.contains(IMAGE_EXT_RE, regex=True).sum())

    date_like = int(pd.to_datetime(non_null, errors="coerce").notna().sum())

    id_incremental = 0
    num_vals = pd.to_numeric(non_null, errors="coerce").dropna().sort_values().values
    if len(num_vals) > 5:
        diffs = np.diff(num_vals)
        if len(diffs) > 0 and (diffs == 1).mean() > 0.75:
            id_incremental = len(num_vals)

    return {
        "sku_like": sku_like,
        "vin_like": vin_like,
        "currency": currency,
        "email": email,
        "phone": phone,
        "date_like": date_like,
        "id_incremental": id_incremental,
        "url": url,
        "image_url": image_url,
    }


def mask_if_sensitive(value: str) -> str:
    v = str(value)
    if EMAIL_RE.match(v):
        parts = v.split("@")
        name = parts[0]
        domain = parts[1]
        masked_name = (name[:2] + "***") if len(name) > 2 else "***"
        return f"{masked_name}@{domain}"
    if PHONE_RE.match(v):
        digits = re.sub(r"\D", "", v)
        if len(digits) >= 4:
            return "*" * (len(digits) - 4) + digits[-4:]
        return "****"
    if VIN_RE.match(v.upper()):
        vv = v.upper()
        return vv[:3] + "********" + vv[-6:]
    return v


def header_confidence(df_preview: pd.DataFrame, row_idx: int) -> float:
    row = df_preview.iloc[row_idx]
    vals = row.astype(str).str.strip()
    non_empty = vals[vals != ""]
    if len(non_empty) == 0:
        return 0.0

    unique_ratio = non_empty.nunique() / max(1, len(non_empty))
    alpha_ratio = non_empty.str.contains(r"[A-Za-z]", regex=True).mean()
    below_has_values = 0.0
    if row_idx + 1 < len(df_preview):
        below = df_preview.iloc[row_idx + 1].astype(str).str.strip()
        below_has_values = (below != "").mean()

    score = 0.45 * unique_ratio + 0.35 * alpha_ratio + 0.20 * below_has_values
    return round(float(score), 4)


def detect_header_row(df_preview: pd.DataFrame) -> Tuple[int, float]:
    max_rows = min(8, len(df_preview))
    if max_rows == 0:
        return 0, 0.0

    scores = [(idx, header_confidence(df_preview, idx)) for idx in range(max_rows)]
    best = max(scores, key=lambda t: t[1])
    return best


def read_sheet_with_header(path: Path, sheet_name: Optional[str] = None) -> Tuple[pd.DataFrame, float]:
    ext = path.suffix.lower()
    if ext in {".csv", ".tsv"}:
        encoding, delimiter = detect_encoding_and_delimiter(path)
        preview = pd.read_csv(path, header=None, nrows=30, encoding=encoding, sep=delimiter, dtype=str, on_bad_lines="skip")
        hdr_idx, hdr_conf = detect_header_row(preview)
        df = pd.read_csv(path, header=hdr_idx, encoding=encoding, sep=delimiter, dtype=str, on_bad_lines="skip")
        return df, hdr_conf

    preview = pd.read_excel(path, sheet_name=sheet_name, header=None, nrows=30, dtype=str)
    if isinstance(preview, dict):
        preview = list(preview.values())[0]
    hdr_idx, hdr_conf = detect_header_row(preview)
    df = pd.read_excel(path, sheet_name=sheet_name, header=hdr_idx, dtype=str)
    if isinstance(df, dict):
        df = list(df.values())[0]
    return df, hdr_conf


def list_spreadsheets(root: Path) -> List[Path]:
    out = []
    for p in root.rglob("*"):
        if p.is_file() and p.suffix.lower() in SPREADSHEET_EXTS:
            out.append(p)
    return sorted(out)


def classify_cluster(header_tokens: Counter, pattern_totals: Counter) -> Tuple[str, float, str]:
    tokens = set(header_tokens.keys())

    has_date = any(t in tokens for t in ["date", "created_at", "updated_at", "timestamp"])
    has_numeric_metric = any(t in tokens for t in ["qty", "quantity", "amount", "price", "cost", "value", "stock"])
    has_code_desc = ("code" in tokens and "description" in tokens) or ("name" in tokens and "code" in tokens)
    has_debit_credit = "debit" in tokens and "credit" in tokens
    has_sku_inventory = any(t in tokens for t in ["sku", "part_number", "partnumber"]) and any(t in tokens for t in ["qty", "quantity", "stock", "location", "warehouse"])
    has_media = pattern_totals["image_url"] > 0 or any(t in tokens for t in ["image", "image_url", "thumbnail", "url"])
    has_product = any(t in tokens for t in ["sku", "title", "name", "brand", "price", "part_number", "mpn"])
    has_mapping = any(t in tokens for t in ["mapping", "relation", "parent_id", "child_id", "fitment", "vehicle"]) and len(tokens) <= 12
    wide_export = len(tokens) >= 20

    if has_debit_credit:
        return "Financial Ledger Pattern – Debit/Credit columns", 92.0, "Detected both debit and credit semantics"
    if has_sku_inventory:
        return "Inventory Snapshot – SKU + Quantity + Location", 88.0, "Detected SKU/part identifier with stock quantity/location signals"
    if has_code_desc:
        return "Reference Lookup – Code/Description mapping", 82.0, "Detected compact code-description schema"
    if has_date and has_numeric_metric:
        return "Time-Series Data – Date + Numeric metrics", 80.0, "Detected date-oriented fields paired with numeric metrics"
    if has_media:
        return "Media Mapping – URL/Image-heavy structure", 79.0, "Detected URL/image-heavy columns or values"
    if has_mapping:
        return "Relational Mapping – Many-to-many style structure", 76.0, "Detected identifier mapping style schema"
    if wide_export and has_product:
        return "Export Format – Flattened wide table", 74.0, "Detected broad denormalized product-like field set"
    if has_product:
        return "Entity Table – Product-like structure", 72.0, "Detected product-entity style identifiers and descriptors"
    return "Unknown – insufficient signals", 45.0, "Insufficient consistent structural signals across cluster"


def jaccard(a: set, b: set) -> float:
    if not a and not b:
        return 1.0
    return len(a & b) / max(1, len(a | b))


def detect_sensitive_col(col_name_norm: str, patt: Dict[str, int]) -> bool:
    if re.search(r"email|phone|mobile|contact", col_name_norm):
        return True
    if patt.get("email", 0) > 0 or patt.get("phone", 0) > 0:
        return True
    return False


def main() -> None:
    files = list_spreadsheets(FILES_DIR)

    inventories: List[FileInventory] = []
    sheet_profiles: List[SheetProfile] = []
    col_profiles: List[ColumnProfile] = []

    # for relationship and clustering
    sheet_header_sets: Dict[Tuple[str, str], set] = {}
    key_candidates: Dict[Tuple[str, str, str], set] = {}
    schema_types: Dict[str, set] = defaultdict(set)
    redundant_signatures: Dict[str, List[Tuple[str, str]]] = defaultdict(list)

    for file_path in files:
        rel_path = str(file_path.relative_to(ROOT)).replace("\\", "/")
        ext = file_path.suffix.lower()
        stat = file_path.stat()

        encoding = ""
        delimiter = ""
        sheet_names: List[str] = []

        if ext in {".csv", ".tsv"}:
            encoding, delimiter = detect_encoding_and_delimiter(file_path)
            sheet_names = ["Sheet1"]
            sheet_count = 1
        else:
            try:
                xls = pd.ExcelFile(file_path)
                sheet_names = xls.sheet_names
                sheet_count = len(sheet_names)
            except Exception:
                sheet_names = ["Sheet1"]
                sheet_count = 1

        inventories.append(
            FileInventory(
                file_rel_path=rel_path,
                file_type=ext.replace(".", ""),
                file_size=stat.st_size,
                last_modified=datetime.fromtimestamp(stat.st_mtime).isoformat(timespec="seconds"),
                encoding=encoding,
                delimiter=delimiter,
                sheet_count=sheet_count,
            )
        )

        for sheet_name in sheet_names:
            try:
                if ext in {".csv", ".tsv"}:
                    df, hdr_conf = read_sheet_with_header(file_path)
                else:
                    df, hdr_conf = read_sheet_with_header(file_path, sheet_name=sheet_name)
            except Exception:
                continue

            if df is None:
                continue

            df = df.copy()
            df.columns = [str(c) if c is not None else "" for c in df.columns]
            normalized_cols = [normalize_col(c) for c in df.columns]

            row_count = int(df.shape[0])
            col_count = int(df.shape[1])

            signature = "|".join(normalized_cols)
            sheet_key = (rel_path, sheet_name)
            sheet_header_sets[sheet_key] = set(normalized_cols)

            likely_keys = []
            for c_orig, c_norm in zip(df.columns, normalized_cols):
                ser = df[c_orig]
                non_null = ser.dropna().astype(str).str.strip()
                if non_null.empty:
                    continue
                unique_ratio = non_null.nunique() / len(non_null)
                id_like = bool(ID_COL_RE.search(c_norm)) or non_null.str.match(r"^[A-Z0-9\-]{6,}$", case=False).mean() > 0.6
                if unique_ratio > 0.8 and id_like:
                    likely_keys.append(c_norm)
                    key_candidates[(rel_path, sheet_name, c_norm)] = set(non_null.head(5000).tolist())

            sheet_profiles.append(
                SheetProfile(
                    file_rel_path=rel_path,
                    sheet_name=sheet_name,
                    row_count=row_count,
                    column_count=col_count,
                    header_confidence=round(hdr_conf * 100, 2),
                    structure_signature=signature,
                    likely_key_columns=likely_keys,
                )
            )

            hash_df = pd.util.hash_pandas_object(df.fillna(""), index=False).sum()
            red_sig = f"{signature}__{row_count}__{int(hash_df)}"
            redundant_signatures[red_sig].append((rel_path, sheet_name))

            for c_orig, c_norm in zip(df.columns, normalized_cols):
                ser = df[c_orig]
                non_null = ser.dropna().astype(str).str.strip()
                inferred = infer_type(ser)
                missing_pct = float((ser.isna() | (ser.astype(str).str.strip() == "")).mean() * 100)

                patt = detect_patterns(ser)
                top_vals = []
                if len(non_null) > 0:
                    vc = non_null.value_counts(dropna=True).head(5)
                    top_vals = [f"{mask_if_sensitive(idx)} ({int(val)})" for idx, val in vc.items()]

                samples = [mask_if_sensitive(v) for v in non_null.head(5).tolist()]
                unique_ratio = float(non_null.nunique() / max(1, len(non_null))) if len(non_null) else 0.0

                schema_types[c_norm].add(inferred)

                col_profiles.append(
                    ColumnProfile(
                        file_rel_path=rel_path,
                        sheet_name=sheet_name,
                        column_original=str(c_orig),
                        column_normalized=c_norm,
                        inferred_type=inferred,
                        missing_pct=round(missing_pct, 2),
                        sample_values=" | ".join(samples),
                        top5_values=" | ".join(top_vals),
                        unique_ratio=round(unique_ratio, 4),
                        non_null_count=int(len(non_null)),
                        pattern_hits=patt,
                    )
                )

            if ext in {".csv", ".tsv"}:
                break

    # cluster files by structural similarity using sheet header sets
    file_to_headers: Dict[str, set] = defaultdict(set)
    for (f, s), headers in sheet_header_sets.items():
        file_to_headers[f].update(headers)

    unassigned = set(file_to_headers.keys())
    clusters: List[List[str]] = []
    while unassigned:
        seed = next(iter(unassigned))
        group = [seed]
        unassigned.remove(seed)
        seed_headers = file_to_headers[seed]

        to_add = []
        for other in list(unassigned):
            sim = jaccard(seed_headers, file_to_headers[other])
            if sim >= 0.55:
                to_add.append(other)

        for f in to_add:
            unassigned.remove(f)
            group.append(f)

        clusters.append(group)

    cluster_details = []
    file_classification: Dict[str, Tuple[str, float, str, int]] = {}

    for idx, cluster_files in enumerate(sorted(clusters, key=len, reverse=True), 1):
        token_counter = Counter()
        pattern_totals = Counter()
        evidence_cols = Counter()

        cluster_col_profiles = [cp for cp in col_profiles if cp.file_rel_path in cluster_files]
        for cp in cluster_col_profiles:
            token_counter[cp.column_normalized] += 1
            evidence_cols[cp.column_normalized] += 1
            for k, v in cp.pattern_hits.items():
                pattern_totals[k] += v

        label, conf, reason = classify_cluster(token_counter, pattern_totals)
        top_evidence = [k for k, _ in evidence_cols.most_common(10)]

        cluster_details.append(
            {
                "cluster_id": f"C{idx}",
                "file_count": len(cluster_files),
                "files": cluster_files,
                "classification": label,
                "confidence": conf,
                "evidence_columns": top_evidence,
                "pattern_totals": dict(pattern_totals),
                "reason": reason,
            }
        )

        for f in cluster_files:
            file_classification[f] = (label, conf, reason, idx)

    # relationships
    recurring_columns = Counter(cp.column_normalized for cp in col_profiles)

    fk_relationships = []
    key_items = list(key_candidates.items())
    for i in range(len(key_items)):
        (f1, s1, c1), vals1 = key_items[i]
        if len(vals1) < 10:
            continue
        for j in range(i + 1, len(key_items)):
            (f2, s2, c2), vals2 = key_items[j]
            if f1 == f2 and s1 == s2:
                continue
            inter = vals1 & vals2
            if not inter:
                continue
            overlap_ratio = len(inter) / min(len(vals1), len(vals2))
            if overlap_ratio >= 0.1 and len(inter) >= 10:
                fk_relationships.append(
                    {
                        "left": f"{f1}::{s1}::{c1}",
                        "right": f"{f2}::{s2}::{c2}",
                        "overlap_count": len(inter),
                        "overlap_ratio": round(overlap_ratio, 4),
                    }
                )

    fk_relationships = sorted(fk_relationships, key=lambda x: x["overlap_count"], reverse=True)[:250]

    # quality risks
    null_heavy = [
        cp for cp in col_profiles if cp.missing_pct > 70
    ]

    # duplicate rows per sheet
    duplicate_summary = []
    for sp in sheet_profiles:
        rel = sp.file_rel_path
        ext = Path(rel).suffix.lower()
        full_path = ROOT / rel
        try:
            if ext in {".csv", ".tsv"}:
                df, _ = read_sheet_with_header(full_path)
            else:
                df, _ = read_sheet_with_header(full_path, sp.sheet_name)
            dupes = int(df.duplicated().sum()) if len(df) else 0
            duplicate_summary.append({
                "file": rel,
                "sheet": sp.sheet_name,
                "duplicate_rows": dupes,
            })
        except Exception:
            continue

    # currency/date inconsistencies by normalized column
    currency_cols = defaultdict(set)
    date_cols = defaultdict(set)
    for cp in col_profiles:
        if cp.pattern_hits.get("currency", 0) > 0:
            samples = cp.sample_values.split(" | ") if cp.sample_values else []
            symbols = set()
            for s in samples:
                m = re.findall(r"[$€£¥]|USD|EUR|GBP|AED", s, flags=re.IGNORECASE)
                symbols.update(sym.upper() for sym in m)
            if symbols:
                currency_cols[cp.column_normalized].update(symbols)

        if cp.inferred_type in {"date", "mixed"} and cp.pattern_hits.get("date_like", 0) > 0:
            samples = cp.sample_values.split(" | ") if cp.sample_values else []
            fmt_hits = set()
            for s in samples:
                if re.search(r"\d{4}[-/]\d{1,2}[-/]\d{1,2}", s):
                    fmt_hits.add("Y-M-D")
                if re.search(r"\d{1,2}[-/]\d{1,2}[-/]\d{2,4}", s):
                    fmt_hits.add("D/M/Y or M/D/Y")
                if re.search(r"[A-Za-z]{3,}\s+\d{1,2}", s):
                    fmt_hits.add("Mon DD")
            if fmt_hits:
                date_cols[cp.column_normalized].update(fmt_hits)

    inconsistent_currency = {k: sorted(v) for k, v in currency_cols.items() if len(v) > 1}
    mixed_date_formats = {k: sorted(v) for k, v in date_cols.items() if len(v) > 1}

    schema_inconsistencies = [
        {"column": c, "types": sorted(list(tset))}
        for c, tset in schema_types.items()
        if len(tset) > 1
    ]

    identifier_collisions = []
    for (f, s, c), vals in key_candidates.items():
        if len(vals) == 0:
            continue
        normalized = [str(v).strip().upper() for v in vals if str(v).strip()]
        if not normalized:
            continue
        if len(set(normalized)) < len(normalized):
            identifier_collisions.append({
                "file": f,
                "sheet": s,
                "column": c,
                "collision_count": len(normalized) - len(set(normalized)),
            })

    redundant_files = [
        {"signature": sig, "members": members}
        for sig, members in redundant_signatures.items()
        if len(members) > 1
    ]

    # deliverables
    master_rows = []
    for sp in sheet_profiles:
        cls = file_classification.get(sp.file_rel_path, ("Unknown – insufficient signals", 40.0, "No cluster assignment", 0))
        master_rows.append(
            {
                "File": sp.file_rel_path,
                "Sheet": sp.sheet_name,
                "Rows": sp.row_count,
                "Columns": sp.column_count,
                "Detected structure type": cls[0],
                "Confidence score": cls[1],
            }
        )

    pd.DataFrame(master_rows).to_csv(OUT_DIR / "master_index.csv", index=False)

    dict_rows = []
    for cp in col_profiles:
        sensitive = detect_sensitive_col(cp.column_normalized, cp.pattern_hits)
        sample_vals = cp.sample_values
        if sensitive and sample_vals:
            sample_vals = " | ".join(mask_if_sensitive(v) for v in sample_vals.split(" | "))

        dict_rows.append(
            {
                "File": cp.file_rel_path,
                "Sheet": cp.sheet_name,
                "Column": cp.column_original,
                "Inferred Type": cp.inferred_type,
                "Missing %": cp.missing_pct,
                "Sample Values": sample_vals,
            }
        )

    pd.DataFrame(dict_rows).to_csv(OUT_DIR / "data_dictionary.csv", index=False)

    inv_rows = [vars(i) for i in inventories]
    pd.DataFrame(inv_rows).to_csv(OUT_DIR / "file_inventory.csv", index=False)

    # markdown report
    lines = []
    lines.append("# Spreadsheet Classification Report")
    lines.append("")
    lines.append(f"Generated: {datetime.now().isoformat(timespec='seconds')}")
    lines.append("")
    lines.append("## Scope")
    lines.append(f"- Files scanned: {len(inventories)}")
    lines.append(f"- Sheets profiled: {len(sheet_profiles)}")
    lines.append(f"- Columns profiled: {len(col_profiles)}")
    lines.append("")

    lines.append("## Cluster Groups")
    for c in cluster_details:
        lines.append(f"### {c['cluster_id']} — {c['classification']} ({c['confidence']:.1f}%)")
        lines.append(f"- Files: {c['file_count']}")
        lines.append(f"- Evidence columns: {', '.join(c['evidence_columns'][:12])}")
        lines.append(f"- Pattern totals: {json.dumps(c['pattern_totals'])}")
        lines.append(f"- Reasoning: {c['reason']}")
        lines.append("")

    lines.append("## Structural Similarities")
    signature_counts = Counter(sp.structure_signature for sp in sheet_profiles)
    for sig, cnt in signature_counts.most_common(10):
        lines.append(f"- Shared signature in {cnt} sheet(s): {sig[:250]}")
    lines.append("")

    lines.append("## Relationship Graph Summary")
    lines.append(f"- Recurring columns (appearing in >=3 places): {sum(1 for _, c in recurring_columns.items() if c >= 3)}")
    lines.append(f"- Likely key candidates: {len(key_candidates)}")
    lines.append(f"- Potential FK/joins detected: {len(fk_relationships)}")
    for rel in fk_relationships[:30]:
        lines.append(f"- {rel['left']} ↔ {rel['right']} (overlap={rel['overlap_count']}, ratio={rel['overlap_ratio']})")
    lines.append("")

    lines.append("## Suggested Entity Map")
    if fk_relationships:
        lines.append("- Entities inferred from joinable keys across files/sheets; use recurring key columns as hub entities.")
        hubs = Counter()
        for rel in fk_relationships:
            hubs[rel["left"].split("::")[-1]] += 1
            hubs[rel["right"].split("::")[-1]] += 1
        lines.append(f"- Strong hub identifiers: {', '.join([k for k, _ in hubs.most_common(8)])}")
    else:
        lines.append("- Insufficient strong key overlap to propose a stable normalized map.")
    lines.append("")

    lines.append("## Data Quality Issues")
    lines.append(f"- Null-heavy columns (>70% missing): {len(null_heavy)}")
    for cp in sorted(null_heavy, key=lambda x: x.missing_pct, reverse=True)[:30]:
        lines.append(f"- {cp.file_rel_path}::{cp.sheet_name}::{cp.column_original} — {cp.missing_pct:.2f}% missing")

    high_dupes = [d for d in duplicate_summary if d["duplicate_rows"] > 0]
    lines.append(f"- Sheets with duplicate rows: {len(high_dupes)}")
    for d in sorted(high_dupes, key=lambda x: x["duplicate_rows"], reverse=True)[:30]:
        lines.append(f"- {d['file']}::{d['sheet']} — duplicates={d['duplicate_rows']}")

    lines.append(f"- Inconsistent currency formats: {len(inconsistent_currency)} columns")
    for col, syms in list(inconsistent_currency.items())[:20]:
        lines.append(f"- {col}: {', '.join(syms)}")

    lines.append(f"- Mixed date formats: {len(mixed_date_formats)} columns")
    for col, fmts in list(mixed_date_formats.items())[:20]:
        lines.append(f"- {col}: {', '.join(fmts)}")

    lines.append(f"- Schema inconsistencies (same column, different inferred types): {len(schema_inconsistencies)}")
    for s in schema_inconsistencies[:30]:
        lines.append(f"- {s['column']}: {', '.join(s['types'])}")

    lines.append(f"- Identifier collisions detected: {len(identifier_collisions)}")
    for c in identifier_collisions[:20]:
        lines.append(f"- {c['file']}::{c['sheet']}::{c['column']} collisions={c['collision_count']}")

    lines.append(f"- Redundant structurally identical datasets: {len(redundant_files)}")
    for r in redundant_files[:20]:
        members = [f"{m[0]}::{m[1]}" for m in r["members"]]
        lines.append(f"- {len(members)} matches: {', '.join(members)}")

    lines.append("")
    lines.append("## Risk Summary")
    lines.append("- Sensitive fields were identified via content patterns (email/phone) and sample values are masked in outputs.")
    lines.append("- Mixed schemas and date/currency inconsistencies can break downstream joins and aggregations.")
    lines.append("- Null-heavy fields and duplicate rows indicate potential ingestion and standardization issues.")

    (OUT_DIR / "classification_report.md").write_text("\n".join(lines), encoding="utf-8")

    # detailed json for auditability
    details = {
        "inventories": inv_rows,
        "sheet_profiles": [
            {
                "file": sp.file_rel_path,
                "sheet": sp.sheet_name,
                "rows": sp.row_count,
                "columns": sp.column_count,
                "header_confidence": sp.header_confidence,
                "structure_signature": sp.structure_signature,
                "likely_key_columns": sp.likely_key_columns,
            }
            for sp in sheet_profiles
        ],
        "column_profiles": [
            {
                "file": cp.file_rel_path,
                "sheet": cp.sheet_name,
                "column_original": cp.column_original,
                "column_normalized": cp.column_normalized,
                "inferred_type": cp.inferred_type,
                "missing_pct": cp.missing_pct,
                "top5_values": cp.top5_values,
                "sample_values": cp.sample_values,
                "unique_ratio": cp.unique_ratio,
                "non_null_count": cp.non_null_count,
                "pattern_hits": cp.pattern_hits,
            }
            for cp in col_profiles
        ],
        "cluster_details": cluster_details,
        "relationships": fk_relationships,
        "schema_inconsistencies": schema_inconsistencies,
        "inconsistent_currency": inconsistent_currency,
        "mixed_date_formats": mixed_date_formats,
        "redundant_files": redundant_files,
    }
    (OUT_DIR / "analysis_details.json").write_text(json.dumps(details, indent=2), encoding="utf-8")

    print(f"Analysis complete. Output written to: {OUT_DIR}")


if __name__ == "__main__":
    main()
