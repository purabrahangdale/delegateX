"""
WhatsApp Automation — n8n Integration Service
HTTP client for triggering n8n webhook-based automation workflows.
Fire-and-forget with graceful error handling when n8n is unavailable.
"""

import os
import logging
from typing import Dict, Any, Optional
from datetime import datetime

logger = logging.getLogger("whatsapp.n8n")

# n8n webhook base URL from environment
N8N_WEBHOOK_BASE_URL = os.getenv("N8N_WEBHOOK_BASE_URL", "http://localhost:5678/webhook")


async def trigger_n8n_webhook(
    webhook_path: str,
    payload: Dict[str, Any],
    timeout: float = 5.0
) -> Dict[str, Any]:
    """
    Trigger an n8n webhook workflow.
    
    This is fire-and-forget — if n8n is unavailable, we log the error
    and continue. Business logic stays in FastAPI, n8n only orchestrates.
    
    Args:
        webhook_path: The webhook path (e.g., "welcome-message")
        payload: The JSON payload to send
        timeout: HTTP request timeout in seconds
        
    Returns:
        dict with keys: success (bool), response (dict or None), error (str or None)
    """
    url = f"{N8N_WEBHOOK_BASE_URL}/{webhook_path}"
    
    try:
        import httpx
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.post(url, json=payload)
            logger.info(f"[n8n] Triggered webhook {webhook_path}: HTTP {response.status_code}")
            return {
                "success": response.status_code in (200, 201, 204),
                "response": response.json() if response.status_code == 200 else None,
                "error": None
            }
    except ImportError:
        # httpx not installed — try with urllib
        logger.warning("[n8n] httpx not installed. Skipping n8n webhook trigger.")
        return {
            "success": False,
            "response": None,
            "error": "httpx not installed. n8n integration skipped."
        }
    except Exception as e:
        logger.warning(f"[n8n] Failed to trigger webhook {webhook_path}: {e}")
        return {
            "success": False,
            "response": None,
            "error": str(e)
        }


async def trigger_welcome_workflow(lead_data: dict) -> Dict[str, Any]:
    """Trigger the n8n welcome message workflow for a new lead."""
    return await trigger_n8n_webhook("welcome-message", {
        "event": "lead_created",
        "lead": lead_data,
        "timestamp": datetime.utcnow().isoformat(),
    })


async def trigger_followup_workflow(lead_data: dict) -> Dict[str, Any]:
    """Trigger the n8n follow-up reminder workflow."""
    return await trigger_n8n_webhook("followup-reminder", {
        "event": "followup_due",
        "lead": lead_data,
        "timestamp": datetime.utcnow().isoformat(),
    })


async def trigger_meeting_reminder_workflow(meeting_data: dict) -> Dict[str, Any]:
    """Trigger the n8n meeting reminder workflow."""
    return await trigger_n8n_webhook("meeting-reminder", {
        "event": "meeting_reminder",
        "meeting": meeting_data,
        "timestamp": datetime.utcnow().isoformat(),
    })


async def trigger_task_assignment_workflow(task_data: dict) -> Dict[str, Any]:
    """Trigger the n8n task assignment notification workflow."""
    return await trigger_n8n_webhook("task-assigned", {
        "event": "task_assigned",
        "task": task_data,
        "timestamp": datetime.utcnow().isoformat(),
    })


async def trigger_lead_status_workflow(lead_data: dict, new_status: str) -> Dict[str, Any]:
    """Trigger the n8n lead status update workflow."""
    return await trigger_n8n_webhook("lead-status-update", {
        "event": "lead_status_changed",
        "lead": lead_data,
        "new_status": new_status,
        "timestamp": datetime.utcnow().isoformat(),
    })
