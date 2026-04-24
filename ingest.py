"""
Teams & Outlook Weekly Ingestion Script
- Pulls last 7 days of Outlook emails
- Filters out internal (petrafundsgroup.com) and junk domains
- Buckets remaining emails by external domain
- Saves to blob: clients/{domain}/emails.json
- Run weekly — overwrites previous pull with latest 7 days
"""

import os
import json
import logging
import time
from datetime import datetime, timedelta, timezone
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed
from dotenv import load_dotenv
from msal import ConfidentialClientApplication
import requests
from azure.storage.blob import BlobServiceClient

load_dotenv()

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger(__name__)

PARALLEL_WORKERS = 5
INTERNAL_DOMAIN = "petrafundsgroup.com"

# Domains to always exclude — not real clients
JUNK_DOMAINS = {
    # Generic email providers
    "gmail.com", "yahoo.com", "hotmail.com", "outlook.com",
    "icloud.com", "me.com", "aol.com", "protonmail.com",
    # Automated/notification senders
    "noreply.com", "no-reply.com", "donotreply.com",
    # Common SaaS notification domains
    "notifications.google.com", "mail.notion.so",
    "em.servicenow.com", "salesforce.com", "hubspot.com",
    "mailchimp.com", "sendgrid.net", "amazonses.com",
    "bounce.linkedin.com", "linkedin.com",
    "docusign.net", "docusign.com",
    "zoom.us", "zoomgov.com",
    "microsoft.com", "microsoftonline.com", "office365.com",
    "sharepoint.com", "teams.microsoft.com",
    # Ads / marketing
    "googleadservices.com", "doubleclick.net",
}

# Also filter any sender address containing these strings
JUNK_SENDER_PATTERNS = [
    "noreply", "no-reply", "donotreply", "do-not-reply",
    "notifications@", "alerts@", "mailer@", "bounce@",
    "support@", "newsletter@", "updates@", "info@",
    "postmaster@", "mailer-daemon",
]


# ── Auth ──────────────────────────────────────────────────────────────────────

def get_access_token() -> str:
    log.info(f"Authenticating with tenant {os.environ['AZURE_TENANT_ID']}")
    app = ConfidentialClientApplication(
        client_id=os.environ["AZURE_CLIENT_ID"],
        client_credential=os.environ["AZURE_CLIENT_SECRET"],
        authority=f"https://login.microsoftonline.com/{os.environ['AZURE_TENANT_ID']}"
    )
    result = app.acquire_token_for_client(
        scopes=["https://graph.microsoft.com/.default"]
    )
    if "access_token" not in result:
        raise RuntimeError(f"Auth failed: {result.get('error_description')}")
    return result["access_token"]


def graph_get(token: str, url: str, params: dict = None) -> list:
    """Handles pagination and 429 retries with exponential backoff."""
    headers = {"Authorization": f"Bearer {token}"}
    items = []
    while url:
        for attempt in range(5):
            resp = requests.get(url, headers=headers, params=params, timeout=30)
            if resp.status_code == 429:
                retry_after = int(resp.headers.get("Retry-After", 2 ** attempt))
                log.warning(f"Rate limited (429) — waiting {retry_after}s (attempt {attempt + 1}/5)")
                time.sleep(retry_after)
                continue
            resp.raise_for_status()
            break
        else:
            raise RuntimeError(f"Failed after 5 retries: {url}")
        data = resp.json()
        items.extend(data.get("value", []))
        url = data.get("@odata.nextLink")
        params = None
    return items


# ── Blob Storage ───────────────────────────────────────────────────────────────

def upload_blob(data: list, blob_path: str):
    client = BlobServiceClient.from_connection_string(
        os.environ["AZURE_STORAGE_CONNECTION_STRING"]
    )
    container = os.environ["AZURE_STORAGE_CONTAINER_NAME"]
    blob = client.get_blob_client(container=container, blob=blob_path)
    blob.upload_blob(
        json.dumps(data, indent=2),
        overwrite=True,
        content_type="application/json"
    )
    log.info(f"Uploaded {len(data)} records → {blob_path}")


# ── Domain Helpers ─────────────────────────────────────────────────────────────

def extract_domain(email_address: str) -> str:
    if not email_address or "@" not in email_address:
        return "unknown"
    return email_address.split("@")[-1].lower().strip()


def is_junk_sender(email: dict) -> bool:
    """Returns True if the sender looks automated/junk."""
    sender = email.get("from", {}).get("emailAddress", {}).get("address", "").lower()
    for pattern in JUNK_SENDER_PATTERNS:
        if pattern in sender:
            return True
    return False


def get_client_domain(email: dict) -> str | None:
    """
    Returns the external client domain for this email, or None if it should be skipped.
    Uses the sender domain if external, otherwise looks at recipients for external domains.
    """
    sender = email.get("from", {}).get("emailAddress", {}).get("address", "")
    sender_domain = extract_domain(sender)

    # If sender is external and not junk — that's the client domain
    if sender_domain != INTERNAL_DOMAIN and sender_domain not in JUNK_DOMAINS and sender_domain != "unknown":
        return sender_domain

    # If sender is internal, find external recipients
    all_recipients = (
        email.get("toRecipients", []) +
        email.get("ccRecipients", [])
    )
    for r in all_recipients:
        addr = r.get("emailAddress", {}).get("address", "")
        domain = extract_domain(addr)
        if domain != INTERNAL_DOMAIN and domain not in JUNK_DOMAINS and domain != "unknown":
            return domain

    return None  # purely internal or junk


# ── Outlook Ingestion ──────────────────────────────────────────────────────────

def fetch_user_emails(token: str, user: dict, since_str: str) -> list:
    user_id = user["id"]
    display_name = user.get("displayName", user_id)
    try:
        emails = graph_get(
            token,
            f"https://graph.microsoft.com/v1.0/users/{user_id}/messages",
            params={
                "$filter": f"receivedDateTime gt {since_str}",
                "$select": "id,subject,bodyPreview,from,toRecipients,ccRecipients,"
                           "receivedDateTime,sentDateTime,conversationId,importance,hasAttachments,isRead"
            }
        )
        for email in emails:
            email["_user_id"] = user_id
            email["_user_name"] = display_name
        if emails:
            log.info(f"  {display_name}: {len(emails)} emails")
        return emails
    except Exception as e:
        log.warning(f"  Skipped {display_name}: {e}")
        return []


def ingest_outlook(token: str, since: datetime):
    log.info("Fetching users...")
    users = graph_get(token, "https://graph.microsoft.com/v1.0/users")
    log.info(f"Found {len(users)} users — processing with {PARALLEL_WORKERS} workers")

    since_str = since.strftime("%Y-%m-%dT%H:%M:%SZ")
    all_emails = []

    with ThreadPoolExecutor(max_workers=PARALLEL_WORKERS) as executor:
        futures = {executor.submit(fetch_user_emails, token, user, since_str): user for user in users}
        for future in as_completed(futures):
            try:
                all_emails.extend(future.result())
            except Exception as e:
                log.warning(f"User fetch error: {e}")

    log.info(f"Total emails fetched: {len(all_emails)} — filtering and bucketing...")

    # ── Filter and bucket ──────────────────────────────────────────────────────
    buckets = defaultdict(list)
    skipped_internal = 0
    skipped_junk = 0

    for email in all_emails:
        if is_junk_sender(email):
            skipped_junk += 1
            continue
        domain = get_client_domain(email)
        if domain is None:
            skipped_internal += 1
            continue
        buckets[domain].append(email)

    log.info(f"Skipped {skipped_internal} internal-only, {skipped_junk} junk/automated")
    log.info(f"Saving {len(buckets)} client domain folders...")

    # ── Upload one file per domain ─────────────────────────────────────────────
    for domain, emails in sorted(buckets.items()):
        blob_path = f"clients/{domain}/emails.json"
        upload_blob(emails, blob_path)

    return buckets


# ── Main ───────────────────────────────────────────────────────────────────────

def main():
    since = datetime.now(timezone.utc) - timedelta(days=7)
    run_date = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    log.info(f"Starting ingestion — last 7 days since {since.isoformat()}")

    token = get_access_token()
    buckets = ingest_outlook(token, since)

    total_emails = sum(len(v) for v in buckets.values())

    # Save manifest so you know what ran
    manifest = {
        "run_date": run_date,
        "since": since.isoformat(),
        "client_domains": len(buckets),
        "total_emails_stored": total_emails,
        "domains": {domain: len(emails) for domain, emails in sorted(buckets.items())},
        "completed_at": datetime.now(timezone.utc).isoformat()
    }
    upload_blob([manifest], f"manifests/{run_date}.json")

    log.info(f"Done. {total_emails} emails across {len(buckets)} client domains.")
    log.info("Domains found:")
    for domain, emails in sorted(buckets.items(), key=lambda x: -len(x[1])):
        log.info(f"  {domain}: {len(emails)} emails")


if __name__ == "__main__":
    main()