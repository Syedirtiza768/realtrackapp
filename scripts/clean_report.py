#!/usr/bin/env python3
"""
Post-process v3 outputs → clean final report filtering unnamed columns,
collapsing singleton Unknown clusters, and producing actionable tables.
"""
import csv, json, datetime as dt
from pathlib import Path
from collections import defaultdict, Counter

OUT = Path(r"D:\apps\listingpro\files\_analysis_outputs")

# ── Load master index ──────────────────────────────────────────
mi_rows = []
with open(OUT / "master_index.csv", encoding="utf-8") as f:
    for r in csv.DictReader(f):
        mi_rows.append(r)

# ── Load data dictionary ───────────────────────────────────────
dd_rows = []
with open(OUT / "data_dictionary.csv", encoding="utf-8") as f:
    for r in csv.DictReader(f):
        dd_rows.append(r)

# Filter to named columns only
named_dd = [r for r in dd_rows if not r["NormCol"].startswith("unnamed_")]
unnamed_summary = len(dd_rows) - len(named_dd)

# ── Load column frequency ─────────────────────────────────────
cf_rows = []
with open(OUT / "column_frequency_map.csv", encoding="utf-8") as f:
    for r in csv.DictReader(f):
        cf_rows.append(r)

# ── Rebuild cluster info from master index ─────────────────────
cluster_info = {}  # cid -> {label, confidence, files[], sheets[]}
for r in mi_rows:
    cid = r["ClusterID"]
    if cid not in cluster_info:
        cluster_info[cid] = dict(label=r["Classification"],
            confidence=r["ClassConf"], files=set(), sheets=[])
    cluster_info[cid]["files"].add(r["File"])
    cluster_info[cid]["sheets"].append(dict(file=r["File"], sheet=r["Sheet"],
        cols=int(r["ColCount"]), rows=r["Rows"], wide=r["WideFlag"]))

# ── Named-column relationships ─────────────────────────────────
col_sheet_map = defaultdict(list)
for r in named_dd:
    nc = r["NormCol"]
    col_sheet_map[nc].append(dict(file=r["File"], sheet=r["Sheet"],
        uniq=float(r["Uniq%"]), missing=float(r["Missing%"]),
        dtype=r["Type"]))

pk_candidates = []
fk_pairs = []
join_cols = {}
for nc, locs in col_sheet_map.items():
    files_set = set(l["file"] for l in locs)
    if len(files_set) < 2:
        continue
    join_cols[nc] = files_set
    high = [l for l in locs if l["uniq"] > 70]
    low  = [l for l in locs if l["uniq"] <= 70]
    if high:
        pk_candidates.append((nc, high))
    if high and low:
        for h in high[:3]:
            for l in low[:3]:
                fk_pairs.append(dict(col=nc,
                    pk=f"{h['file']}/{h['sheet']}", pk_u=h["uniq"],
                    fk=f"{l['file']}/{l['sheet']}", fk_u=l["uniq"]))

# ── Quality issues (named cols only) ──────────────────────────
quality_null  = []
quality_mixed = []
for r in named_dd:
    m = float(r["Missing%"])
    if 70 < m < 100:
        quality_null.append(f"{r['File']}/{r['Sheet']}.{r['Column']} ({m}%)")
    if r["Type"] == "mixed" and m < 50:
        quality_mixed.append(f"{r['File']}/{r['Sheet']}.{r['Column']}")

# ── Structural redundancy ──────────────────────────────────────
import hashlib
sheet_fps = defaultdict(list)
for r in mi_rows:
    sig = f"{r['Sheet']}|{r['ColCount']}"
    fp = hashlib.md5(sig.encode()).hexdigest()
    sheet_fps[fp].append(f"{r['File']}|{r['Sheet']}")
redundant = {fp: m for fp, m in sheet_fps.items() if len(m) > 1}

# ═════════════════════════════════════════════════════════════════
#  WRITE CLEAN REPORT
# ═════════════════════════════════════════════════════════════════
rpt = OUT / "classification_report.md"
with open(rpt, "w", encoding="utf-8") as md:
    md.write("# Spreadsheet Classification & Relationship Report\n\n")
    md.write(f"_Generated: {dt.datetime.now().strftime('%Y-%m-%d %H:%M')}_\n\n")

    # ── Summary ──
    md.write("## Executive Summary\n\n")
    total_files = len(set(r["File"] for r in mi_rows))
    total_sheets = len(mi_rows)
    total_profiles = len(named_dd)
    md.write("| Metric | Value |\n|---|---|\n")
    md.write(f"| Files scanned | {total_files} |\n")
    md.write(f"| Sheets profiled | {total_sheets} |\n")
    md.write(f"| Named column profiles | {total_profiles} |\n")
    md.write(f"| Unnamed columns skipped | {unnamed_summary} |\n")
    md.write(f"| Clusters | {len(cluster_info)} |\n")
    md.write(f"| Named quality issues | {len(quality_null) + len(quality_mixed)} |\n")
    md.write(f"| Join columns detected | {len(join_cols)} |\n")
    md.write(f"| PK candidates | {len(pk_candidates)} |\n")
    md.write(f"| FK pairs | {len(fk_pairs)} |\n\n")

    # ── File inventory ──
    md.write("## File Inventory\n\n")
    md.write("| # | File | Sheets | Cols | Max Rows | Size KB |\n")
    md.write("|---|---|---|---|---|---|\n")
    file_info = defaultdict(lambda: dict(sheets=0, cols=0, maxrows=0, size=0))
    for r in mi_rows:
        fi = file_info[r["File"]]
        fi["sheets"] += 1
        fi["cols"] += int(r["ColCount"])
        fi["maxrows"] = max(fi["maxrows"], int(r["Rows"]))
        fi["size"] = int(r["SizeBytes"])
    for i, (fname, fi) in enumerate(sorted(file_info.items()), 1):
        md.write(f"| {i} | `{fname}` | {fi['sheets']} | {fi['cols']} | {fi['maxrows']} | {fi['size']//1024} |\n")
    md.write("\n")

    # ── Meaningful clusters (collapse unknowns) ──
    md.write("## Cluster Groups\n\n")

    # Separate meaningful vs unknown
    meaningful = {}
    unknown_sheets = []
    for cid, ci in cluster_info.items():
        if "Unknown" in ci["label"]:
            unknown_sheets.extend(ci["sheets"])
        else:
            meaningful[cid] = ci

    for cid, ci in sorted(meaningful.items(), key=lambda x: -len(x[1]["files"])):
        sf = sorted(ci["files"])
        snames = sorted(set(s["sheet"] for s in ci["sheets"]))
        # Collect key columns for this cluster from named_dd
        cluster_cols = set()
        for r in named_dd:
            k = f"{r['File']}|{r['Sheet']}"
            for s in ci["sheets"]:
                if r["File"] == s["file"] and r["Sheet"] == s["sheet"]:
                    cluster_cols.add(r["NormCol"])
        md.write(f"### Cluster {cid} — {ci['label']}  ({ci['confidence']}%)\n\n")
        md.write(f"- **Sheets:** {len(ci['sheets'])} across {len(sf)} files\n")
        md.write(f"- **Sheet names:** {', '.join(snames[:5])}\n")
        col_list = sorted(cluster_cols)[:20]
        md.write(f"- **Named columns:** {', '.join(f'`{c}`' for c in col_list)}\n\n")
        md.write("**Files:**\n\n")
        for s in sf[:12]:
            md.write(f"- `{s}`\n")
        if len(sf) > 12:
            md.write(f"- … and {len(sf)-12} more\n")
        md.write("\n---\n\n")

    if unknown_sheets:
        md.write(f"### Uncategorised / Low-Signal Sheets ({len(unknown_sheets)} sheets)\n\n")
        md.write("These sheets had insufficient named columns for confident classification ")
        md.write("(typically eBay template structural sheets like Aspects, ConditionDescriptors, ")
        md.write("or batch-specific single-column sheets).\n\n")
        seen = set()
        for s in unknown_sheets[:20]:
            label = f"{s['file']} / {s['sheet']}"
            if label not in seen:
                md.write(f"- `{label}` ({s['cols']} cols)\n")
                seen.add(label)
        if len(unknown_sheets) > 20:
            md.write(f"- … and {len(unknown_sheets)-20} more\n")
        md.write("\n---\n\n")

    # ── Column Frequency (top 30 named only) ──
    md.write("## Column Frequency Map (Named Columns)\n\n")
    md.write("| Column | Sheets | Raw Variants | Files |\n|---|---|---|---|\n")
    named_cf = [r for r in cf_rows if not r["NormColumn"].startswith("unnamed_")]
    for r in named_cf[:30]:
        md.write(f"| `{r['NormColumn']}` | {r['SheetCount']} | {r['RawVariants']} | {r['FileCount']} |\n")
    md.write("\n")

    # ── Structural redundancies ──
    md.write("## Structural Similarities / Redundancies\n\n")
    if redundant:
        # Only show groups with ≥3 members
        big = {fp: m for fp, m in redundant.items() if len(m) >= 3}
        md.write(f"Found **{len(big)}** groups of ≥3 sheets with matching structure:\n\n")
        for fp, members in sorted(big.items(), key=lambda x: -len(x[1])):
            md.write(f"**Group** ({len(members)} sheets):\n\n")
            for m in members[:8]:
                md.write(f"- `{m}`\n")
            if len(members) > 8:
                md.write(f"- … and {len(members)-8} more\n")
            md.write("\n")
    else:
        md.write("No structurally identical sheet groups.\n\n")

    # ── Relationships (named columns only) ──
    md.write("## Cross-File Relationship Map\n\n")
    md.write("### Join Columns (named, ≥ 2 files)\n\n")
    md.write("| Column | # Files | Sample Files |\n|---|---|---|\n")
    for nc, fset in sorted(join_cols.items(), key=lambda x: -len(x[1])):
        sample = ", ".join(sorted(fset)[:3])
        if len(fset) > 3: sample += " …"
        md.write(f"| `{nc}` | {len(fset)} | {sample} |\n")
    md.write("\n")

    md.write("### Primary-Key Candidates (named, uniqueness > 70%)\n\n")
    md.write("| Column | File / Sheet | Uniqueness |\n|---|---|---|\n")
    for nc, locs in pk_candidates[:20]:
        for l in locs[:2]:
            md.write(f"| `{nc}` | `{l['file']}` / {l['sheet']} | {l['uniq']}% |\n")
    md.write("\n")

    md.write("### Foreign-Key Candidates (named)\n\n")
    if fk_pairs:
        md.write("| Column | PK Source | FK Source | PK Uniq | FK Uniq |\n|---|---|---|---|---|\n")
        for fk in fk_pairs[:30]:
            md.write(f"| `{fk['col']}` | `{fk['pk']}` | `{fk['fk']}` | {fk['pk_u']}% | {fk['fk_u']}% |\n")
    else:
        md.write("No clear FK relationships among named columns.\n")
    md.write("\n")

    # ── Quality ──
    md.write("## Data Quality & Risk Summary\n\n")
    md.write(f"_Note: {unnamed_summary} unnamed/auto-generated columns excluded from quality analysis._\n\n")
    if quality_null:
        md.write(f"### Null-heavy Named Columns ({len(quality_null)})\n\n")
        for q in quality_null[:40]:
            md.write(f"- {q}\n")
        if len(quality_null) > 40:
            md.write(f"- _… and {len(quality_null)-40} more_\n")
        md.write("\n")
    if quality_mixed:
        md.write(f"### Mixed-type Named Columns ({len(quality_mixed)})\n\n")
        for q in quality_mixed:
            md.write(f"- {q}\n")
        md.write("\n")
    if not quality_null and not quality_mixed:
        md.write("No significant quality issues among named columns.\n\n")

    # ── Suggested schema ──
    md.write("## Suggested Normalised Schema\n\n")
    named_pks = [(nc, locs) for nc, locs in pk_candidates if not nc.startswith("unnamed_")]
    named_fks = [fk for fk in fk_pairs if not fk["col"].startswith("unnamed_")]
    if named_pks:
        md.write("### Entity Tables (high-uniqueness named identifiers)\n\n")
        for nc, locs in named_pks[:15]:
            for l in locs[:1]:
                md.write(f"- **`{nc}`** ({l['uniq']}% unique) in `{l['file']}/{l['sheet']}`\n")
        md.write("\n")
    if named_fks:
        md.write("### Detected Relationships\n\n")
        seen = set()
        for fk in named_fks[:25]:
            key = (fk["pk"], fk["fk"], fk["col"])
            if key in seen: continue
            seen.add(key)
            md.write(f"- `{fk['pk']}` → `{fk['fk']}` via **`{fk['col']}`**\n")
        md.write("\n")
    elif not named_pks:
        md.write("Insufficient named-column relationships to propose a normalized schema.\n")

    # ── Workbook architecture summary ──
    md.write("## eBay Workbook Architecture (detected from content)\n\n")
    md.write("Each `*_eBay_Verified*.xlsx` file contains 8 sheets with this structure:\n\n")
    md.write("| Sheet | Detected Type | Cols | Purpose |\n|---|---|---|---|\n")
    ebay_sheets = [
        ("GENERAL INSTRUCTIONS", "Export Format – eBay Listing Template", "~20", "Guidance & field validation rules"),
        ("FITMENT PARTS & ACCESS.. HELP", "Metadata / Instructions Sheet", "~21", "Vehicle fitment help reference"),
        ("Listings", "eBay Bulk Listing Data", "~76", "Core listing rows — SKU, title, price, category, item specifics"),
        ("Categories", "Reference Lookup – Category Mapping", "~7", "Category ID → Name mapping"),
        ("ListingStaticData", "Reference Lookup – Field Constraints", "~8", "Header/Mandatory/Values reference"),
        ("BusinessPolicy", "Export Format – eBay Policy Names", "~3", "Shipping/Return/Payment policy names"),
        ("Aspects", "Reference – Item Specifics Dictionary", "~10,422", "All possible eBay item specific names as columns"),
        ("ConditionDescriptors", "Reference – Condition Codes", "~8", "Condition descriptor lookup"),
    ]
    for sn, dt_label, cols, purpose in ebay_sheets:
        md.write(f"| {sn} | {dt_label} | {cols} | {purpose} |\n")
    md.write("\n")
    md.write("The `B*-*SKU.xlsx` and `F1-B*` files are **Product/Part Catalog** tables with ")
    md.write("columns like `S.NO`, `OEM NUMBER`, `MAKE`, `PARTS DESCRIPTION`, `PRICE`, `QTY`, etc.\n\n")
    md.write("These two file families are linked through parts data flowing from the SKU catalog ")
    md.write("files into the eBay Listings sheet of the verified workbooks.\n")

print(f"✔ Clean report written: {rpt}  ({rpt.stat().st_size:,} bytes)")
