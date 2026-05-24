"""
supplier_inbox_db - local JSON storage for supplier invoices received via email.

Each record:
  id            - UUID
  status        - "pending" / "approved" / "rejected"
  received_at   - ISO timestamp
  email_from    - sender address
  email_subject - email subject
  pdf_filename  - original PDF filename
  pdf_base64    - PDF bytes in base64 (for preview)
  supplier_name - extracted by LLM2000 (company ID / name)
  invoice_num   - extracted invoice number
  date          - extracted date (YYYY-MM-DD)
  amount_no_vat - extracted amount before VAT
  amount_with_vat - extracted amount including VAT
  description   - extracted description
  supname       - Priority supplier code (filled by accountant at approval)
  branch        - Priority branch (filled by accountant at approval)
  sku           - Priority part number for line item (filled at approval)
  priority_ivnum - Priority invoice number after creation
"""

import os
import json
import uuid
import logging
from datetime import datetime

logger = logging.getLogger("tact.supplier_inbox_db")

_DATA_FILE = os.path.join(os.path.dirname(__file__), "inbox_data.json")


def _load():
    if not os.path.isfile(_DATA_FILE) or os.path.getsize(_DATA_FILE) == 0:
        return []
    try:
        with open(_DATA_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
            return data if isinstance(data, list) else []
    except Exception as e:
        logger.error(f"supplier_inbox load failed: {e}")
        return []


def _save(rows):
    tmp = _DATA_FILE + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(rows, f, ensure_ascii=False, indent=2)
    os.replace(tmp, _DATA_FILE)


def add_invoice(email_from, email_subject, pdf_filename, pdf_base64, extracted):
    """Add a new pending invoice from email."""
    rows = _load()
    record = {
        "id": str(uuid.uuid4()),
        "status": "pending",
        "received_at": datetime.now().isoformat(),
        "email_from": email_from,
        "email_subject": email_subject,
        "pdf_filename": pdf_filename,
        "pdf_base64": pdf_base64,
        "supplier_name": extracted.get("companyId", ""),
        "invoice_num": extracted.get("invoiceNum", ""),
        "date": extracted.get("date", ""),
        "amount_no_vat": extracted.get("amountNoVat", ""),
        "amount_with_vat": extracted.get("amountWithVat", ""),
        "description": extracted.get("description", ""),
        "supname": "",
        "branch": "",
        "sku": "",
        "priority_ivnum": "",
    }
    rows.append(record)
    _save(rows)
    return record


def list_pending():
    """Return all pending invoices (without pdf_base64 for performance)."""
    rows = _load()
    result = []
    for r in rows:
        if r.get("status") == "pending":
            item = {k: v for k, v in r.items() if k != "pdf_base64"}
            result.append(item)
    return result


def list_all():
    """Return all invoices (without pdf_base64)."""
    rows = _load()
    return [{k: v for k, v in r.items() if k != "pdf_base64"} for r in rows]


def get_invoice(invoice_id):
    """Return a single invoice including pdf_base64."""
    for r in _load():
        if r["id"] == invoice_id:
            return r
    return None


def approve_invoice(invoice_id, supname, branch, sku, priority_ivnum):
    """Mark invoice as approved and store Priority result."""
    rows = _load()
    for r in rows:
        if r["id"] == invoice_id:
            r["status"] = "approved"
            r["supname"] = supname
            r["branch"] = branch
            r["sku"] = sku
            r["priority_ivnum"] = priority_ivnum
            r["approved_at"] = datetime.now().isoformat()
            _save(rows)
            return r
    return None


def reject_invoice(invoice_id, reason=""):
    """Mark invoice as rejected."""
    rows = _load()
    for r in rows:
        if r["id"] == invoice_id:
            r["status"] = "rejected"
            r["reject_reason"] = reason
            r["rejected_at"] = datetime.now().isoformat()
            _save(rows)
            return r
    return None


def is_duplicate(email_from, invoice_num):
    """Check if this invoice number from this sender already exists."""
    if not invoice_num:
        return False
    for r in _load():
        if r.get("email_from") == email_from and r.get("invoice_num") == invoice_num:
            return True
    return False
