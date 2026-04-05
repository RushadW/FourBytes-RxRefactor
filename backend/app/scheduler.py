"""Background scheduler — weekly auto-scrape with change detection."""
from __future__ import annotations

import logging
import threading
import time
import uuid
from datetime import datetime

from app.database import (
    SessionLocal, ScrapeLogRecord, NotificationRecord, PolicyRecord,
)
from app.scraper import scrape_all_sources, store_fetched_docs
from app.ingest import ingest_file, diff_policies, summarize_changes

logger = logging.getLogger(__name__)

# Scrape interval: 7 days in seconds
SCRAPE_INTERVAL = 7 * 24 * 60 * 60  # 604800 seconds


def _run_scrape_cycle(trigger: str = "cron") -> dict:
    """Execute a full scrape + ingest cycle with change detection.

    Returns a summary dict with counts.
    """
    logger.info(f"[scheduler] Starting scrape cycle (trigger={trigger})")
    db = SessionLocal()

    try:
        all_docs = scrape_all_sources()
        total_fetched = 0
        total_updated = 0
        total_added = 0
        errors: list[str] = []

        for payer_id, docs in all_docs.items():
            stored_paths = store_fetched_docs(docs) if docs else []
            total_fetched += len(docs)

            for doc in docs:
                try:
                    # Snapshot old policy for diff
                    old_policy = None
                    if doc.drug_hint:
                        old_record = (
                            db.query(PolicyRecord)
                            .filter_by(payer_id=doc.payer_id, drug_id=doc.drug_hint)
                            .first()
                        )
                        if old_record:
                            old_policy = {
                                c.name: getattr(old_record, c.name)
                                for c in PolicyRecord.__table__.columns
                            }

                    # Ingest (creates or updates policy)
                    result = ingest_file(
                        db=db,
                        payer_id=doc.payer_id,
                        payer_name=doc.payer_name,
                        drug_id=doc.drug_hint or "unknown",
                        drug_name=doc.drug_hint.title() if doc.drug_hint else "Unknown Drug",
                        content=doc.content,
                        content_type=doc.content_type,
                        source_url=doc.source_url,
                    )

                    status = result.get("status", "")
                    policy_id = result.get("policy_id")

                    if status == "ingested" and old_policy and policy_id:
                        # Compare old vs new
                        new_record = db.query(PolicyRecord).get(policy_id)
                        if new_record:
                            new_data = {
                                c.name: getattr(new_record, c.name)
                                for c in PolicyRecord.__table__.columns
                            }
                            changes = diff_policies(old_policy, new_data)
                            if changes:
                                total_updated += 1
                                summary = summarize_changes(changes)
                                # Create notification
                                notif = NotificationRecord(
                                    id=str(uuid.uuid4()),
                                    type="policy_update",
                                    title=f"{doc.payer_name} updated {doc.drug_hint or 'policy'}",
                                    message=summary,
                                    policy_id=policy_id,
                                    payer_id=doc.payer_id,
                                    drug_id=doc.drug_hint,
                                )
                                db.add(notif)
                                logger.info(
                                    f"[scheduler] Policy updated: {doc.payer_id}/{doc.drug_hint} — {len(changes)} changes"
                                )
                            else:
                                logger.info(f"[scheduler] No changes for {doc.payer_id}/{doc.drug_hint}")
                    elif status == "ingested" and not old_policy:
                        total_added += 1
                        # Notification for new policy
                        notif = NotificationRecord(
                            id=str(uuid.uuid4()),
                            type="policy_update",
                            title=f"New policy: {doc.payer_name} — {doc.drug_hint or 'Unknown'}",
                            message=f"A new policy document was scraped and ingested from {doc.payer_name}.",
                            policy_id=policy_id,
                            payer_id=doc.payer_id,
                            drug_id=doc.drug_hint,
                        )
                        db.add(notif)

                except Exception as e:
                    err = f"{doc.payer_id}/{doc.filename}: {e}"
                    logger.warning(f"[scheduler] Ingest error: {err}")
                    errors.append(err)

        # Log the scrape run
        log_entry = ScrapeLogRecord(
            id=str(uuid.uuid4()),
            run_at=datetime.utcnow(),
            trigger=trigger,
            payers_scraped=len(all_docs),
            documents_fetched=total_fetched,
            policies_updated=total_updated,
            policies_added=total_added,
            errors=errors if errors else None,
            summary=f"Scraped {len(all_docs)} payers, fetched {total_fetched} docs, "
                    f"{total_updated} policies updated, {total_added} new policies added.",
        )
        db.add(log_entry)

        # Scrape-complete notification
        if total_fetched > 0:
            notif = NotificationRecord(
                id=str(uuid.uuid4()),
                type="scrape_complete",
                title="Automated scrape completed",
                message=log_entry.summary,
            )
            db.add(notif)

        db.commit()
        logger.info(f"[scheduler] Scrape cycle complete: {log_entry.summary}")

        return {
            "payers_scraped": len(all_docs),
            "documents_fetched": total_fetched,
            "policies_updated": total_updated,
            "policies_added": total_added,
            "errors": errors,
        }

    except Exception as e:
        logger.error(f"[scheduler] Scrape cycle failed: {e}")
        db.rollback()
        return {"error": str(e)}
    finally:
        db.close()


def _scheduler_loop():
    """Background thread that runs scrape cycles on a weekly interval."""
    while True:
        time.sleep(SCRAPE_INTERVAL)
        try:
            _run_scrape_cycle(trigger="cron")
        except Exception as e:
            logger.error(f"[scheduler] Cron cycle error: {e}")


_scheduler_thread: threading.Thread | None = None


def start_scheduler():
    """Start the weekly background scraper thread (daemon)."""
    global _scheduler_thread
    if _scheduler_thread is not None and _scheduler_thread.is_alive():
        logger.info("[scheduler] Already running")
        return
    _scheduler_thread = threading.Thread(target=_scheduler_loop, daemon=True, name="scrape-scheduler")
    _scheduler_thread.start()
    logger.info("[scheduler] Weekly auto-scraper started (interval: 7 days)")


def run_scrape_now(trigger: str = "manual") -> dict:
    """Run a scrape cycle immediately (for API calls)."""
    return _run_scrape_cycle(trigger=trigger)
