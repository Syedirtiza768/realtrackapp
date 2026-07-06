#!/usr/bin/env python3
"""Decrypt a password-protected eBay MVL workbook to stdout (binary xlsx)."""
from __future__ import annotations

import io
import os
import sys

import msoffcrypto


def main() -> int:
    if len(sys.argv) < 2:
        print("usage: decrypt_xlsx.py <path-to-xlsx>", file=sys.stderr)
        return 2

    path = sys.argv[1]
    password = os.environ.get("MVL_PASSWORD") or os.environ.get(
        "EBAY_MVL_WORKBOOK_PASSWORD", "VehicleList"
    )

    with open(path, "rb") as src:
        office = msoffcrypto.OfficeFile(src)
        office.load_key(password=password)
        out = io.BytesIO()
        office.decrypt(out)
        sys.stdout.buffer.write(out.getvalue())

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
