"""
WhatsApp Automation — Scheduler Service
Background scheduler for periodic automations (follow-up reminders, meeting reminders, daily reports).
Uses asyncio tasks with configurable intervals.
"""

import asyncio
import logging
from datetime import datetime

logger = logging.getLogger("whatsapp.scheduler")

# Track running scheduler tasks
_scheduler_tasks = {}
_scheduler_running = False


async def _run_periodic(name: str, coro_func, interval_seconds: int):
    """Run an async function periodically at the given interval."""
    logger.info(f"[Scheduler] Started periodic task: {name} (every {interval_seconds}s)")
    while True:
        try:
            await asyncio.sleep(interval_seconds)
            logger.info(f"[Scheduler] Executing: {name}")
            await coro_func()
        except asyncio.CancelledError:
            logger.info(f"[Scheduler] Cancelled: {name}")
            break
        except Exception as e:
            logger.error(f"[Scheduler] Error in {name}: {e}")


def start_schedulers():
    """
    Start all periodic automation schedulers.
    Called once during application startup.
    """
    global _scheduler_running
    if _scheduler_running:
        return
    
    from app.whatsapp.services.automation_service import (
        trigger_followup_reminders,
        trigger_meeting_reminders,
        trigger_daily_lead_report,
    )
    
    # Follow-up reminders every 6 hours
    _scheduler_tasks["followup_reminder"] = asyncio.create_task(
        _run_periodic("Follow-up Reminders", trigger_followup_reminders, 6 * 3600)
    )
    
    # Meeting reminders every 4 hours
    _scheduler_tasks["meeting_reminder"] = asyncio.create_task(
        _run_periodic("Meeting Reminders", trigger_meeting_reminders, 4 * 3600)
    )
    
    # Daily lead report every 24 hours
    _scheduler_tasks["daily_report"] = asyncio.create_task(
        _run_periodic("Daily Lead Report", trigger_daily_lead_report, 24 * 3600)
    )
    
    _scheduler_running = True
    logger.info("[Scheduler] All periodic automation tasks started.")


def stop_schedulers():
    """Cancel all running scheduler tasks."""
    global _scheduler_running
    for name, task in _scheduler_tasks.items():
        task.cancel()
        logger.info(f"[Scheduler] Stopping: {name}")
    _scheduler_tasks.clear()
    _scheduler_running = False


def get_scheduler_status() -> dict:
    """Return the status of all scheduler tasks."""
    return {
        "running": _scheduler_running,
        "tasks": {
            name: {
                "running": not task.done(),
                "cancelled": task.cancelled(),
            }
            for name, task in _scheduler_tasks.items()
        }
    }
