"""
Gmail Poller - fetches unread emails with PDF attachments from supplier inbox.
Analyzes PDFs with LLM2000 and saves results to supplier_inbox_db.
"""

import os
import imaplib
import email
import base64
import logging
import importlib.util
from datetime import datetime, timedelta
from pathlib import Path
from email.header import decode_header

if os.environ.get("IS_LAMBDA") != "true":
    from dotenv import load_dotenv
    env_path = Path(__file__).resolve().parent.parent.parent.parent / ".env"
    load_dotenv(env_path)

logger = logging.getLogger("urbangroup.gmail_poller")

GMAIL_USER = os.getenv("SUPPLIER_INBOX_GMAIL_USER", os.getenv("GMAIL_USER", ""))
GMAIL_APP_PASSWORD = os.getenv("SUPPLIER_INBOX_GMAIL_APP_PASSWORD", os.getenv("GMAIL_APP_PASSWORD", ""))
IMAP_HOST = "imap.gmail.com"

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent.parent


def _load_llm2000():
    spec = importlib.util.spec_from_file_location(
        "llm2000_invoice_analyzer",
        PROJECT_ROOT / "agents" / "LLM" / "LLM2000-invoice-analyzer" / "LLM2000_invoice_analyzer.py"
    )
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def _load_inbox_db():
    spec = importlib.util.spec_from_file_location(
        "supplier_inbox_db",
        PROJECT_ROOT / "database" / "supplier_inbox" / "supplier_inbox_db.py"
    )
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def _decode_header_value(value):
    parts = decode_header(value or "")
    result = []
    for part, enc in parts:
        if isinstance(part, bytes):
            result.append(part.decode(enc or "utf-8", errors="replace"))
        else:
            result.append(part)
    return "".join(result)


def poll_once():
    """Connect to Gmail, fetch unread emails with PDFs, analyze and save.

    Returns:
        dict with counts: {"processed": N, "skipped": N, "errors": N}
    """
    if not GMAIL_USER or not GMAIL_APP_PASSWORD:
        return {"ok": False, "error": "GMAIL_USER or GMAIL_APP_PASSWORD not configured"}

    llm2000 = _load_llm2000()
    inbox_db = _load_inbox_db()

    stats = {"processed": 0, "skipped": 0, "errors": 0}

    try:
        mail = imaplib.IMAP4_SSL(IMAP_HOST)
        mail.login(GMAIL_USER, GMAIL_APP_PASSWORD)
        mail.select("inbox")
    except Exception as e:
        logger.error(f"Gmail login failed: {e}")
        return {"ok": False, "error": f"Gmail connection failed: {e}"}

    try:
        since_date = (datetime.now() - timedelta(days=7)).strftime("%d-%b-%Y")
        _, data = mail.search(None, f"SINCE {since_date}")
        uid_list = data[0].split()
        logger.info(f"Gmail poller: {len(uid_list)} emails in last 7 days")

        for uid in uid_list:
            try:
                _, msg_data = mail.fetch(uid, "(RFC822)")
                raw = msg_data[0][1]
                msg = email.message_from_bytes(raw)

                sender = _decode_header_value(msg.get("From", ""))
                subject = _decode_header_value(msg.get("Subject", ""))

                pdf_parts = []
                for part in msg.walk():
                    ct = part.get_content_type()
                    cd = part.get("Content-Disposition", "")
                    filename = part.get_filename() or ""
                    filename = _decode_header_value(filename)

                    if ct == "application/pdf" or (filename.lower().endswith(".pdf")):
                        payload = part.get_payload(decode=True)
                        if payload:
                            pdf_parts.append((filename or "invoice.pdf", payload))

                if not pdf_parts:
                    stats["skipped"] += 1
                    continue

                for pdf_filename, pdf_bytes in pdf_parts:
                    try:
                        result = llm2000.analyze_pdf(pdf_bytes)
                        if not result.get("ok"):
                            logger.warning(f"LLM2000 failed for {pdf_filename}: {result.get('error')}")
                            stats["errors"] += 1
                            continue

                        invoices = result.get("invoices", [])
                        if not invoices:
                            stats["skipped"] += 1
                            continue

                        pdf_b64 = base64.b64encode(pdf_bytes).decode("utf-8")

                        for inv in invoices:
                            inv_num = inv.get("invoiceNum", "")
                            if inbox_db.is_duplicate(sender, inv_num):
                                logger.info(f"Duplicate skipped: {inv_num} from {sender}")
                                stats["skipped"] += 1
                                continue

                            inbox_db.add_invoice(
                                email_from=sender,
                                email_subject=subject,
                                pdf_filename=pdf_filename,
                                pdf_base64=pdf_b64,
                                extracted=inv,
                            )
                            stats["processed"] += 1
                            logger.info(f"Saved invoice: {inv_num} from {sender}")

                    except Exception as e:
                        logger.error(f"Error processing PDF {pdf_filename}: {e}")
                        stats["errors"] += 1

                # (no need to mark as read — duplicate detection handles re-runs)

            except Exception as e:
                logger.error(f"Error processing email {uid}: {e}")
                stats["errors"] += 1

    finally:
        try:
            mail.logout()
        except Exception:
            pass

    return {"ok": True, **stats}


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    result = poll_once()
    print(result)
