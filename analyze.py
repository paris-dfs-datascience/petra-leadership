"""
Client Email Analyzer
Reads client email folders from blob, analyzes with Claude,
outputs React-ready weekly_report.json locally.
"""

import os
import json
import logging
from datetime import datetime, timezone
from collections import defaultdict
from dotenv import load_dotenv
from azure.storage.blob import BlobServiceClient
import anthropic

load_dotenv()

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger(__name__)

OUTPUT_DIR = "."

# ── Client Whitelist ──────────────────────────────────────────────────────────

CLIENT_WHITELIST = {
    "blackstone.com":           "Blackstone",
    "kkr.com":                  "KKR",
    "apollo.com":               "Apollo Global Management",
    "blackrock.com":            "BlackRock",
    "baincapital.com":          "Bain Capital",
    "silverlake.com":           "Silver Lake",
    "brookfield.com":           "Brookfield Asset Management",
    "oaktreecapital.com":       "Oaktree Capital",
    "vistaequitypartners.com":  "Vista Equity Partners",
    "hamiltonlane.com":         "Hamilton Lane",
    "harbourvest.com":          "HarbourVest Partners",
    "stepstonegroup.com":       "StepStone Group",
    "partnersgroup.com":        "Partners Group",
    "blueowl.com":              "Blue Owl Capital",
    "fortress.com":             "Fortress Investment Group",
    "golubcapital.com":         "Golub Capital",
    "newmountaincapital.com":   "New Mountain Capital",
    "centerbridge.com":         "Centerbridge Partners",
    "charlesbank.com":          "Charlesbank Capital",
    "lindsaygoldbergllc.com":   "Lindsay Goldberg",
}


# ── Blob ──────────────────────────────────────────────────────────────────────

def read_blob_json(blob_path: str):
    client = BlobServiceClient.from_connection_string(
        os.environ["AZURE_STORAGE_CONNECTION_STRING"]
    )
    blob = client.get_blob_client(
        container=os.environ["AZURE_STORAGE_CONTAINER_NAME"],
        blob=blob_path
    )
    return json.loads(blob.download_blob().readall())


def blob_exists(blob_path: str) -> bool:
    try:
        client = BlobServiceClient.from_connection_string(
            os.environ["AZURE_STORAGE_CONNECTION_STRING"]
        )
        blob = client.get_blob_client(
            container=os.environ["AZURE_STORAGE_CONTAINER_NAME"],
            blob=blob_path
        )
        blob.get_blob_properties()
        return True
    except Exception:
        return False


# ── Email Helpers ─────────────────────────────────────────────────────────────

def group_by_thread(emails: list) -> dict:
    """Group emails by conversationId."""
    threads = defaultdict(list)
    for email in emails:
        thread_id = email.get("conversationId") or email.get("id", "unknown")
        threads[thread_id].append(email)
    return dict(threads)


def get_date_range(emails: list) -> str:
    dates = []
    for e in emails:
        d = e.get("receivedDateTime") or e.get("sentDateTime")
        if d:
            dates.append(d)
    if not dates:
        return "Unknown"
    dates.sort()
    start = dates[0][:10]
    end = dates[-1][:10]
    return start if start == end else f"{start} to {end}"


def get_participants(emails: list, client_domain: str) -> list:
    addresses = set()
    for email in emails:
        sender = email.get("from", {}).get("emailAddress", {}).get("address", "")
        if sender and client_domain in sender:
            addresses.add(sender)
        for r in email.get("toRecipients", []):
            addr = r.get("emailAddress", {}).get("address", "")
            if addr and client_domain in addr:
                addresses.add(addr)
    return sorted(addresses)


def format_thread_for_claude(emails: list) -> str:
    """Format a thread into a readable block for Claude."""
    lines = []
    for email in sorted(emails, key=lambda e: e.get("receivedDateTime", "")):
        sender = email.get("from", {}).get("emailAddress", {}).get("address", "unknown")
        subject = email.get("subject", "(no subject)")
        date = (email.get("receivedDateTime") or "")[:10]
        body = email.get("bodyPreview", "").strip()
        lines.append(f"[{date}] FROM: {sender}\nSUBJECT: {subject}\nPREVIEW: {body}\n")
    return "\n---\n".join(lines)


# ── Claude Analysis ───────────────────────────────────────────────────────────

def analyze_thread(ai: anthropic.Anthropic, thread_emails: list, client_name: str) -> dict:
    """Analyze a single email thread with Claude."""
    thread_text = format_thread_for_claude(thread_emails)

    prompt = (
        f"You are analyzing email threads for the founder of Petra Funds Group, "
        f"a fund administration firm. This thread involves client: {client_name}.\n\n"
        f"Analyze this email thread and return ONLY a JSON object with these fields:\n"
        f'- "subject": the main subject/topic of the thread (string)\n'
        f'- "summary": 2-3 sentence summary of what this thread is about (string)\n'
        f'- "flag": one of "issue", "fyi", or "routine" (string)\n'
        f'  * "issue" = complaint, problem, escalation, missed deadline, unhappy client, urgent matter\n'
        f'  * "fyi" = notable update, question, or request that needs awareness but no urgent action\n'
        f'  * "routine" = normal operational email, scheduling, standard requests\n'
        f'- "severity": one of "high", "medium", "low" (string)\n'
        f'  * "high" = requires founder attention immediately\n'
        f'  * "medium" = should be reviewed this week\n'
        f'  * "low" = informational only\n'
        f'- "action_required": one sentence on what action is needed, or null if none (string or null)\n\n'
        f"Email thread:\n{thread_text}"
    )

    try:
        message = ai.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=1000,
            messages=[{"role": "user", "content": prompt}]
        )
        raw = message.content[0].text.strip()
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        return json.loads(raw.strip())
    except Exception as e:
        log.warning(f"  Thread analysis failed: {e}")
        return {
            "subject": thread_emails[0].get("subject", "Unknown"),
            "summary": "Analysis failed.",
            "flag": "routine",
            "severity": "low",
            "action_required": None
        }


def analyze_client(ai: anthropic.Anthropic, domain: str, client_name: str) -> dict:
    """Analyze all emails for a single client domain."""
    log.info(f"Analyzing {client_name} ({domain})...")

    blob_path = f"clients/{domain}/emails.json"
    if not blob_exists(blob_path):
        log.warning(f"  No email file found for {domain} — skipping")
        return None

    emails = read_blob_json(blob_path)
    if not emails:
        log.warning(f"  No emails for {domain} — skipping")
        return None

    log.info(f"  {len(emails)} emails — grouping into threads...")
    threads = group_by_thread(emails)
    log.info(f"  {len(threads)} threads to analyze")

    issues = []
    fyi = []
    routine = []

    for thread_id, thread_emails in threads.items():
        result = analyze_thread(ai, thread_emails, client_name)

        thread_obj = {
            "thread_id": thread_id,
            "subject": result.get("subject", "Unknown"),
            "flag": result.get("flag", "routine"),
            "severity": result.get("severity", "low"),
            "summary": result.get("summary", ""),
            "action_required": result.get("action_required"),
            "participants": get_participants(thread_emails, domain),
            "date_range": get_date_range(thread_emails),
            "email_count": len(thread_emails)
        }

        flag = result.get("flag", "routine")
        if flag == "issue":
            issues.append(thread_obj)
        elif flag == "fyi":
            fyi.append(thread_obj)
        else:
            routine.append(thread_obj)

    # Sort issues by severity
    severity_order = {"high": 0, "medium": 1, "low": 2}
    issues.sort(key=lambda x: severity_order.get(x["severity"], 3))
    fyi.sort(key=lambda x: severity_order.get(x["severity"], 3))

    # Overall client flag
    if any(t["severity"] == "high" for t in issues):
        client_flag = "issue"
        client_severity = "high"
    elif issues:
        client_flag = "issue"
        client_severity = "medium"
    elif fyi:
        client_flag = "fyi"
        client_severity = "low"
    else:
        client_flag = "routine"
        client_severity = "low"

    # Last activity date
    all_dates = [e.get("receivedDateTime", "") for e in emails if e.get("receivedDateTime")]
    last_activity = max(all_dates)[:10] if all_dates else "Unknown"

    log.info(f"  Done — {len(issues)} issues, {len(fyi)} FYI, {len(routine)} routine")

    return {
        "domain": domain,
        "client_name": client_name,
        "total_emails": len(emails),
        "total_threads": len(threads),
        "flag": client_flag,
        "severity": client_severity,
        "last_activity": last_activity,
        "issue_count": len(issues),
        "fyi_count": len(fyi),
        "routine_count": len(routine),
        "issues": issues,
        "fyi": fyi,
        "routine": routine
    }


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    ai = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])

    run_date = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    since_date = "last 7 days"

    log.info(f"Starting analysis for {len(CLIENT_WHITELIST)} clients...")

    client_results = []
    for domain, client_name in CLIENT_WHITELIST.items():
        result = analyze_client(ai, domain, client_name)
        if result:
            client_results.append(result)

    # Sort by severity: high issues first
    severity_order = {"high": 0, "medium": 1, "low": 2}
    flag_order = {"issue": 0, "fyi": 1, "routine": 2}
    client_results.sort(key=lambda x: (
        flag_order.get(x["flag"], 3),
        severity_order.get(x["severity"], 3)
    ))

    needs_attention = sum(
        1 for c in client_results
        if c["flag"] == "issue" and c["severity"] in ("high", "medium")
    )

    report = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "run_date": run_date,
        "date_range": since_date,
        "total_clients": len(client_results),
        "needs_attention": needs_attention,
        "clients": client_results
    }

    output_path = os.path.join(OUTPUT_DIR, "weekly_report.json")
    with open(output_path, "w") as f:
        json.dump(report, f, indent=2)

    log.info(f"\nDone. Report saved → {output_path}")
    log.info(f"Clients analyzed: {len(client_results)}")
    log.info(f"Needs attention: {needs_attention}")
    log.info(f"\nClient summary:")
    for c in client_results:
        flag_icon = "🔴" if c["flag"] == "issue" else "🟡" if c["flag"] == "fyi" else "🟢"
        log.info(f"  {flag_icon} {c['client_name']}: {c['issue_count']} issues, {c['fyi_count']} FYI, {c['routine_count']} routine")


if __name__ == "__main__":
    main()