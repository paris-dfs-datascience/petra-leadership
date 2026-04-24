"""
Domain Classifier
Reads domain folders from blob, classifies with Claude,
saves results locally as JSON files.
"""

import os
import json
import logging
from datetime import datetime, timezone
from dotenv import load_dotenv
from azure.storage.blob import BlobServiceClient
import anthropic

load_dotenv()

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger(__name__)

CHUNK_SIZE = 200
OUTPUT_DIR = "."


# ── Blob ──────────────────────────────────────────────────────────────────────

def get_all_domains() -> list:
    client = BlobServiceClient.from_connection_string(
        os.environ["AZURE_STORAGE_CONNECTION_STRING"]
    )
    container = client.get_container_client(os.environ["AZURE_STORAGE_CONTAINER_NAME"])
    blobs = list(container.list_blobs(name_starts_with="clients/"))
    log.info(f"Found {len(blobs)} blobs under clients/")

    domains = set()
    for b in blobs:
        parts = b.name.split("/")
        if len(parts) >= 2:
            domains.add(parts[1])

    return sorted(domains)


# ── Claude Classification ──────────────────────────────────────────────────────

def classify_domains(domains: list) -> dict:
    ai = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
    results = {}

    chunks = [domains[i:i + CHUNK_SIZE] for i in range(0, len(domains), CHUNK_SIZE)]
    log.info(f"Classifying {len(domains)} domains in {len(chunks)} chunks...")

    for i, chunk in enumerate(chunks):
        log.info(f"  Chunk {i + 1}/{len(chunks)} ({len(chunk)} domains)...")

        prompt = (
            "You are classifying email domains found in the email system of Petra Funds Group, "
            "a fund administration and back-office services firm that works exclusively with "
            "private equity firms, venture capital funds, family offices, hedge funds, and other "
            "alternative investment managers.\n\n"
            "Classify each domain into exactly one category:\n"
            '- "client" = private equity firms, venture capital firms, hedge funds, family offices, '
            "fund of funds, real estate investment firms, infrastructure funds, credit funds, asset managers, "
            "alternative investment managers, sovereign wealth funds, endowments, pension funds, or "
            "law/accounting firms that are likely PE/VC clients. When in doubt about a financial or "
            'investment-related domain, classify as "client".\n'
            '- "vendor" = software vendors, SaaS tools, fund accounting systems, HR platforms, IT services, '
            "office supplies, telecom, utilities, insurance, banks acting as service providers, custodians, prime brokers\n"
            '- "travel" = airlines, hotels, car rentals, travel agencies, booking platforms, rideshare\n'
            '- "spam" = marketing agencies, newsletters, job boards, social media platforms, PR firms, '
            "automated notifications, noreply senders, event ticketing\n"
            '- "unknown" = cannot determine from domain name alone\n\n'
            "Important: Petra Funds Group's own domain is petrafundsgroup.com — do NOT classify that as a client.\n\n"
            'Return ONLY a JSON object with no preamble or explanation. Format:\n'
            '{"domain.com": "client", "other.com": "vendor"}\n\n'
            "Domains to classify:\n"
            + "\n".join(chunk)
        )

        message = ai.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=4000,
            messages=[{"role": "user", "content": prompt}]
        )

        raw = message.content[0].text.strip()
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        raw = raw.strip()

        try:
            chunk_results = json.loads(raw)
            results.update(chunk_results)
            client_count = sum(1 for v in chunk_results.values() if v == "client")
            log.info(f"    → {client_count} clients in this chunk")
        except json.JSONDecodeError as e:
            log.error(f"  Failed to parse chunk {i + 1}: {e}")
            for domain in chunk:
                results[domain] = "unknown"

    return results


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    log.info("Reading domains from blob storage...")
    domains = get_all_domains()
    log.info(f"Found {len(domains)} unique domains")

    if not domains:
        log.error("No domains found — make sure ingest.py has run and blob has clients/ folders")
        return

    classifications = classify_domains(domains)

    clients = sorted([d for d, c in classifications.items() if c == "client"])
    vendors = sorted([d for d, c in classifications.items() if c == "vendor"])
    travel  = sorted([d for d, c in classifications.items() if c == "travel"])
    spam    = sorted([d for d, c in classifications.items() if c == "spam"])
    unknown = sorted([d for d, c in classifications.items() if c == "unknown"])

    log.info(f"\nResults: {len(clients)} clients | {len(vendors)} vendors | {len(travel)} travel | {len(spam)} spam | {len(unknown)} unknown")

    output = {
        "classified_at": datetime.now(timezone.utc).isoformat(),
        "total_domains": len(domains),
        "summary": {
            "clients": len(clients),
            "vendors": len(vendors),
            "travel": len(travel),
            "spam": len(spam),
            "unknown": len(unknown)
        },
        "clients": clients,
        "vendors": vendors,
        "travel": travel,
        "spam": spam,
        "unknown": unknown,
        "all": classifications
    }

    full_path = os.path.join(OUTPUT_DIR, "domain_classifications.json")
    with open(full_path, "w") as f:
        json.dump(output, f, indent=2)
    log.info(f"Saved full classifications → {full_path}")

    whitelist_path = os.path.join(OUTPUT_DIR, "client_whitelist.json")
    with open(whitelist_path, "w") as f:
        json.dump(clients, f, indent=2)
    log.info(f"Saved client whitelist → {whitelist_path}")

    log.info(f"\nClient domains ({len(clients)}):")
    for d in clients:
        log.info(f"  {d}")


if __name__ == "__main__":
    main()