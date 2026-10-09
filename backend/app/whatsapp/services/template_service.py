"""
WhatsApp Automation — Template Service (shared template source of truth)

Lifecycle:
  DRAFT (local only) → submit → PENDING (Meta review) → APPROVED / REJECTED / PAUSED / DISABLED ...
Statuses other than DRAFT only ever come from Meta (submit response, sync, or the
`message_template_status_update` webhook). A template is sendable only when Meta reports APPROVED.

Local template bodies use named placeholders ({{client_name}}). On submission they are converted to
Meta positional parameters ({{1}}, {{2}} ...) and the name order is stored in `body_param_names`
so campaigns and automations can label and map each parameter.

Multiple numbers: templates belong to a WhatsApp Business Account (`waba_id`). Numbers in the same WABA
share one catalogue; a number only ever sees, submits, syncs or sends templates of its own WABA, using
its own credentials. Delivery metrics are computed per number from that number's messages.
"""

import re
import logging
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any, Tuple

from bson import ObjectId

from app.whatsapp.repository import TemplateRepository, _serialize_doc
from app.whatsapp.meta_api import MetaClient, MetaApiError

logger = logging.getLogger("whatsapp.templates")

# Default templates to seed on first run (empty so deleted templates are not re-seeded)
DEFAULT_TEMPLATES = []

META_CATEGORIES = {"MARKETING", "UTILITY", "AUTHENTICATION"}
SENDABLE_STATUSES = {"APPROVED"}
EDITABLE_ON_META_STATUSES = {"APPROVED", "REJECTED", "PAUSED"}
MEDIA_HEADER_FORMATS = {"IMAGE", "VIDEO", "DOCUMENT"}
NAMED_VAR_RE = re.compile(r"\{\{\s*([a-zA-Z0-9_]+)\s*\}\}")
LANGUAGE_RE = re.compile(r"^[a-z]{2,3}(_[A-Z]{2})?$")

STATUS_HELP = {
    "DRAFT": "Saved locally. Not yet submitted to Meta.",
    "PENDING": "Submitted to Meta and awaiting review. Cannot be sent yet.",
    "APPROVED": "Approved by Meta. Can be used in campaigns and automations.",
    "REJECTED": "Rejected by Meta. Edit and resubmit.",
    "PAUSED": "Paused by Meta due to low quality feedback. Cannot be sent.",
    "DISABLED": "Disabled by Meta. Cannot be sent.",
    "IN_APPEAL": "Rejection under appeal.",
    "PENDING_DELETION": "Being deleted on Meta.",
    "DELETED": "No longer exists on Meta.",
    "LIMIT_EXCEEDED": "WABA template limit exceeded.",
    "ARCHIVED": "Archived on Meta.",
}


def _now() -> str:
    return datetime.utcnow().isoformat()


def normalize_meta_name(name: str) -> str:
    return re.sub(r"[^a-z0-9_]+", "_", str(name or "").strip().lower()).strip("_")[:512]


def get_collection():
    from app.config.database import whatsapp_template_collection
    return whatsapp_template_collection


def waba_match(number: Optional[dict]) -> dict:
    """Template filter for a number: its WABA (no number → templates without a WABA)."""
    return {"waba_id": (number or {}).get("waba_id") or None}


def number_match(number: Optional[dict]) -> dict:
    return {"number_id": str(number["_id"]) if number else None}


def template_in_scope(tmpl: Optional[dict], number: Optional[dict]) -> bool:
    return bool(tmpl) and (tmpl.get("waba_id") or None) == ((number or {}).get("waba_id") or None)


def _client(number: Optional[dict]) -> MetaClient:
    from app.whatsapp.numbers import config_for, NumberError
    if not number:
        raise NumberError("No WhatsApp business number is selected.", 409, "no_number")
    return MetaClient(config_for(number))


# ═══════════════════════════════════════════════════════════════════
# METRICS (computed from persisted message records — never estimated)
# ═══════════════════════════════════════════════════════════════════

def _template_message_stats(scope: Optional[dict] = None) -> Dict[str, Dict[str, int]]:
    """Aggregate real outbound message outcomes per local template ID (for one number when scoped)."""
    from app.config.database import whatsapp_message_collection
    pipeline = [
        {"$match": {**(scope or {}), "direction": "outbound", "template_id": {"$nin": [None, ""]}}},
        {"$group": {
            "_id": {"$toString": "$template_id"},
            "accepted": {"$sum": {"$cond": [{"$in": ["$status", ["accepted", "sent", "delivered", "read"]]}, 1, 0]}},
            "delivered": {"$sum": {"$cond": [{"$in": ["$status", ["delivered", "read"]]}, 1, 0]}},
            "read": {"$sum": {"$cond": [{"$eq": ["$status", "read"]}, 1, 0]}},
            "failed": {"$sum": {"$cond": [{"$eq": ["$status", "failed"]}, 1, 0]}},
        }},
    ]
    try:
        return {r["_id"]: r for r in whatsapp_message_collection.aggregate(pipeline)}
    except Exception as e:
        logger.warning(f"[Templates] Metric aggregation failed: {e}")
        return {}


def _rate(numerator: int, denominator: int) -> Optional[float]:
    return round(numerator / denominator * 100, 1) if denominator else None


def calculate_template_metrics(tmpl: dict, max_views: int = 1, max_used: int = 1, stats: Optional[dict] = None) -> dict:
    """Attach real delivery metrics. Rates are None when nothing has been sent yet."""
    stats = stats if stats is not None else _template_message_stats().get(str(tmpl.get("_id")), {})
    accepted = stats.get("accepted", 0)
    delivered = stats.get("delivered", 0)
    read = stats.get("read", 0)
    failed = stats.get("failed", 0)
    replies = tmpl.get("reply_count", 0)

    delivery_rate = _rate(delivered, accepted)
    read_rate = _rate(read, delivered)
    reply_rate = _rate(replies, read)

    performance_score = None
    if accepted:
        norm_usage = min(1.0, tmpl.get("times_used", 0) / (max_used or 1))
        norm_views = min(1.0, tmpl.get("views", 0) / (max_views or 1))
        performance_score = round(
            (delivery_rate or 0) * 0.3 + (read_rate or 0) * 0.3 + (reply_rate or 0) * 0.2 + norm_usage * 10 + norm_views * 10, 1
        )

    status = tmpl.get("status") or "DRAFT"
    return {
        **tmpl,
        "status": status,
        "status_help": STATUS_HELP.get(status, ""),
        "is_sendable": is_sendable(tmpl),
        "messages_sent": accepted,
        "delivered_count": delivered,
        "read_count": read,
        "failed_count": failed,
        "delivery_rate": delivery_rate,
        "read_rate": read_rate,
        "reply_rate": reply_rate,
        "performance_score": performance_score,
    }


def seed_default_templates() -> List[dict]:
    """Seed default templates if they don't exist. Returns list of created templates."""
    created = []
    for tmpl_data in DEFAULT_TEMPLATES:
        existing = TemplateRepository.find_by_name(tmpl_data["name"])
        if not existing:
            result = TemplateRepository.create(tmpl_data.copy())
            created.append(result)
    return created


def get_all_templates(active_only: bool = False, filters: dict = None, number: Optional[dict] = None) -> List[dict]:
    templates = TemplateRepository.get_all(active_only=active_only, filters=filters, scope=waba_match(number))
    if filters and filters.get("statuses"):
        wanted = {s.upper() for s in filters["statuses"]}
        templates = [t for t in templates if (t.get("status") or "DRAFT").upper() in wanted]

    stats = _template_message_stats(number_match(number))
    max_views = max([t.get("views", 0) for t in templates] or [1])
    max_used = max([t.get("times_used", 0) for t in templates] or [1])
    processed = [calculate_template_metrics(t, max_views, max_used, stats.get(str(t["_id"]), {})) for t in templates]

    scored = [t for t in processed if t["performance_score"] is not None]
    top_performer_id = max(scored, key=lambda x: x["performance_score"])["_id"] if scored else None
    used = [t for t in processed if t.get("times_used", 0) > 0]
    most_used_id = max(used, key=lambda x: x.get("times_used", 0))["_id"] if used else None
    viewed = [t for t in processed if t.get("views", 0) > 0]
    most_viewed_id = max(viewed, key=lambda x: x.get("views", 0))["_id"] if viewed else None

    for t in processed:
        badges = []
        if t["_id"] == top_performer_id:
            badges.append({"key": "top_performer", "label": "Top Performer", "icon": "👑", "color": "amber"})
        if t["_id"] == most_used_id:
            badges.append({"key": "most_used", "label": "Most Used", "icon": "⭐", "color": "emerald"})
        if t["_id"] == most_viewed_id:
            badges.append({"key": "most_viewed", "label": "Most Viewed", "icon": "👁", "color": "indigo"})
        if t.get("is_favorite"):
            badges.append({"key": "favorite", "label": "Favorite", "icon": "❤️", "color": "rose"})
        t["badges"] = badges

    return processed


def get_template_insights(number: Optional[dict] = None) -> dict:
    """KPIs, charts and ranking computed from persisted message records of one number."""
    from app.config.database import whatsapp_message_collection

    templates = get_all_templates(number=number)
    scope = number_match(number)
    total_templates = len(templates)
    active_templates = len([t for t in templates if t.get("is_active", True)])
    approved_templates = len([t for t in templates if t.get("is_sendable")])

    def best(key):
        candidates = [t for t in templates if t.get(key) is not None]
        return max(candidates, key=lambda x: x[key]) if candidates else None

    top_performer = best("performance_score")
    highest_delivery = best("delivery_rate")
    highest_read = best("read_rate")
    used = [t for t in templates if t.get("times_used", 0) > 0]
    most_used = max(used, key=lambda x: x.get("times_used", 0)) if used else None
    viewed = [t for t in templates if t.get("views", 0) > 0]
    most_viewed = max(viewed, key=lambda x: x.get("views", 0)) if viewed else None
    favorite = next((t for t in templates if t.get("is_favorite")), None)

    ranked = sorted(templates, key=lambda x: (x["performance_score"] is not None, x["performance_score"] or 0), reverse=True)
    for idx, t in enumerate(ranked):
        t["rank"] = idx + 1

    # Monthly template message volume (last 6 months)
    six_months_ago = (datetime.utcnow().replace(day=1) - timedelta(days=150)).strftime("%Y-%m")
    monthly = list(whatsapp_message_collection.aggregate([
        {"$match": {**scope, "direction": "outbound", "template_id": {"$nin": [None, ""]}, "created_at": {"$gte": six_months_ago}}},
        {"$group": {
            "_id": {"$substr": ["$created_at", 0, 7]},
            "messages": {"$sum": 1},
            "templates": {"$addToSet": "$template_id"},
        }},
        {"$sort": {"_id": 1}},
    ]))
    monthly_usage = [
        {
            "month": datetime.strptime(m["_id"], "%Y-%m").strftime("%b"),
            "usage": len(m["templates"]),
            "messages": m["messages"],
        }
        for m in monthly
    ]

    # Daily delivery / read rates (last 7 days) from real statuses
    week_ago = (datetime.utcnow() - timedelta(days=6)).strftime("%Y-%m-%d")
    daily = {d["_id"]: d for d in whatsapp_message_collection.aggregate([
        {"$match": {**scope, "direction": "outbound", "template_id": {"$nin": [None, ""]}, "created_at": {"$gte": week_ago}}},
        {"$group": {
            "_id": {"$substr": ["$created_at", 0, 10]},
            "accepted": {"$sum": {"$cond": [{"$in": ["$status", ["accepted", "sent", "delivered", "read"]]}, 1, 0]}},
            "delivered": {"$sum": {"$cond": [{"$in": ["$status", ["delivered", "read"]]}, 1, 0]}},
            "read": {"$sum": {"$cond": [{"$eq": ["$status", "read"]}, 1, 0]}},
        }},
    ])}
    performance_trend = []
    for offset in range(6, -1, -1):
        day = datetime.utcnow() - timedelta(days=offset)
        d = daily.get(day.strftime("%Y-%m-%d"), {})
        performance_trend.append({
            "day": day.strftime("%a"),
            "date": day.strftime("%Y-%m-%d"),
            "messages": d.get("accepted", 0),
            "delivery_rate": _rate(d.get("delivered", 0), d.get("accepted", 0)) or 0,
            "read_rate": _rate(d.get("read", 0), d.get("delivered", 0)) or 0,
            "reply_rate": 0,
        })

    return {
        "kpis": {
            "total_templates": total_templates,
            "active_templates": active_templates,
            "approved_templates": approved_templates,
            "most_used_template": most_used.get("name") if most_used else "N/A",
            "most_viewed_template": most_viewed.get("name") if most_viewed else "N/A",
            "highest_delivery_rate": f"{highest_delivery['delivery_rate']}%" if highest_delivery else "No data yet",
            "highest_read_rate": f"{highest_read['read_rate']}%" if highest_read else "No data yet",
            "favorite_template": favorite.get("name") if favorite else "N/A",
            "top_performer_score": top_performer.get("performance_score") if top_performer else 0.0,
            "top_performer_name": top_performer.get("name") if top_performer else "N/A",
        },
        "charts": {
            "monthly_usage": monthly_usage,
            "performance_trend": performance_trend,
        },
        "templates": ranked,
    }


def toggle_template_favorite(template_id: str) -> Optional[dict]:
    tmpl = TemplateRepository.find_by_id(template_id)
    if not tmpl:
        return None
    return TemplateRepository.update(template_id, {"is_favorite": not tmpl.get("is_favorite", False)})


def increment_template_views(template_id: str) -> Optional[dict]:
    try:
        get_collection().update_one({"_id": ObjectId(template_id)}, {"$inc": {"views": 1}})
    except Exception:
        return None
    return TemplateRepository.find_by_id(template_id)


def get_template_names(number: Optional[dict] = None) -> List[str]:
    return TemplateRepository.get_template_names(waba_match(number))


def get_template_by_id(template_id: str, number: Optional[dict] = None) -> Optional[dict]:
    tmpl = TemplateRepository.find_by_id(template_id)
    if not tmpl:
        return None
    stats = _template_message_stats(number_match(number)).get(str(tmpl["_id"]), {}) if number else None
    return calculate_template_metrics(tmpl, stats=stats)


def get_template_by_name(name: str) -> Optional[dict]:
    tmpl = TemplateRepository.find_by_name(name)
    return calculate_template_metrics(tmpl) if tmpl else None


def get_template_by_id_or_name(identifier: str) -> Optional[dict]:
    """Find a template by local ObjectId, exact display name, or exact Meta template name."""
    if not identifier or not isinstance(identifier, str):
        return None
    clean_id = identifier.strip()
    if ObjectId.is_valid(clean_id):
        tmpl = TemplateRepository.find_by_id(clean_id)
        if tmpl:
            return calculate_template_metrics(tmpl)
    doc = get_collection().find_one({"$or": [{"name": clean_id}, {"meta_template_name": clean_id}]})
    return calculate_template_metrics(_serialize_doc(doc)) if doc else None


# ═══════════════════════════════════════════════════════════════════
# LOCAL CRUD
# ═══════════════════════════════════════════════════════════════════

def create_template(data: dict, number: Optional[dict] = None) -> dict:
    """Create a local DRAFT in the number's WABA. Nothing is sent to Meta until submit_template() is called."""
    data["waba_id"] = (number or {}).get("waba_id") or None
    data.setdefault("views", 0)
    data.setdefault("times_used", 0)
    data.setdefault("is_favorite", False)
    data["language"] = data.get("language") or "en_US"
    data["meta_category"] = (data.get("meta_category") or "UTILITY").upper()
    data["meta_template_name"] = normalize_meta_name(data.get("meta_template_name") or data.get("name"))
    data["status"] = "DRAFT"
    data["source"] = "local"
    data["has_unsubmitted_changes"] = False
    return TemplateRepository.create(data)


CONTENT_FIELDS = {"content", "header", "footer", "response_buttons", "variable_examples", "meta_category"}


def update_template(template_id: str, data: dict) -> Optional[dict]:
    existing = TemplateRepository.find_by_id(template_id)
    if not existing:
        return None
    if existing.get("meta_template_id"):
        # Meta does not allow changing name or language of an existing template.
        if "language" in data and data["language"] != existing.get("language"):
            raise ValueError("Language cannot be changed after submission to Meta. Create a new template for another language.")
        data.pop("meta_template_name", None)
        if CONTENT_FIELDS & set(data.keys()):
            data["has_unsubmitted_changes"] = True
    else:
        if "meta_template_name" in data or "name" in data:
            data["meta_template_name"] = normalize_meta_name(data.get("meta_template_name") or data.get("name") or existing.get("name"))
    if "meta_category" in data and data["meta_category"]:
        data["meta_category"] = data["meta_category"].upper()
    data.pop("status", None)  # status is never set by local edits
    data.pop("waba_id", None)  # the owning WABA never changes through an edit
    return TemplateRepository.update(template_id, data)


async def delete_template(template_id: str, local_only: bool = False, number: Optional[dict] = None) -> bool:
    tmpl = TemplateRepository.find_by_id(template_id)
    if not tmpl:
        return False
    if tmpl.get("meta_template_id") and not local_only and tmpl.get("status") != "DELETED":
        # Raises MetaApiError on failure so the local record is kept in sync with Meta.
        await _client(number).delete_template(tmpl["meta_template_name"], tmpl["meta_template_id"])
    return TemplateRepository.delete(template_id)


def record_template_usage_metrics(identifier_or_id: str, sent_count: int = 1, **_ignored) -> Optional[dict]:
    """Record usage (not outcomes — delivery metrics are computed from message records)."""
    tmpl = get_template_by_id_or_name(identifier_or_id)
    if not tmpl:
        return None
    get_collection().update_one(
        {"_id": ObjectId(tmpl["_id"])},
        {"$inc": {"times_used": sent_count, "campaigns_count": 1}, "$set": {"last_used_at": _now()}},
    )
    return get_template_by_id(tmpl["_id"])


# ═══════════════════════════════════════════════════════════════════
# META COMPONENT BUILDING & VALIDATION
# ═══════════════════════════════════════════════════════════════════

def _ordered_unique(names: List[str]) -> List[str]:
    seen, out = set(), []
    for n in names:
        if n not in seen:
            seen.add(n)
            out.append(n)
    return out


def _positionalize(text: str, names: List[str]) -> str:
    return NAMED_VAR_RE.sub(lambda m: "{{" + str(names.index(m.group(1)) + 1) + "}}", text)


BUTTON_TYPE_MAP = {
    "custom": "QUICK_REPLY",
    "quick_reply": "QUICK_REPLY",
    "visit_website": "URL",
    "url": "URL",
    "call_phone": "PHONE_NUMBER",
    "phone_number": "PHONE_NUMBER",
    "copy_offer_code": "COPY_CODE",
    "copy_code": "COPY_CODE",
    "complete_flow": "FLOW",
    "flow": "FLOW",
}


def build_submission(tmpl: dict) -> Tuple[Dict[str, Any], Dict[str, Any], List[str]]:
    """
    Build the Meta message_templates payload from a local template.
    Returns (payload, derived_fields, errors). Media header handles are resolved separately.
    """
    errors: List[str] = []
    examples: Dict[str, str] = {k: str(v) for k, v in (tmpl.get("variable_examples") or {}).items() if str(v).strip()}

    meta_name = tmpl.get("meta_template_name") or normalize_meta_name(tmpl.get("name"))
    if not meta_name or not re.fullmatch(r"[a-z0-9_]{1,512}", meta_name):
        errors.append("Template name must contain only lowercase letters, numbers and underscores.")

    category = (tmpl.get("meta_category") or "").upper()
    if category not in META_CATEGORIES:
        errors.append("Meta category must be MARKETING, UTILITY or AUTHENTICATION.")
    if category == "AUTHENTICATION":
        errors.append("Authentication (OTP) templates use a fixed Meta format and are not supported by this editor.")

    language = tmpl.get("language") or ""
    if not LANGUAGE_RE.match(language):
        errors.append(f"Invalid language code '{language}'. Use a Meta locale such as en_US, en, hi.")

    components: List[Dict[str, Any]] = []

    # Header
    header = tmpl.get("header") or {}
    header_format = (header.get("format") or "NONE").upper()
    header_param_names: List[str] = []
    if header_format == "TEXT":
        text = (header.get("text") or "").strip()
        header_param_names = _ordered_unique(NAMED_VAR_RE.findall(text))
        if not text:
            errors.append("Header text is empty.")
        if len(text) > 60:
            errors.append("Header text cannot exceed 60 characters.")
        if len(header_param_names) > 1:
            errors.append("Header text supports at most one variable.")
        comp = {"type": "HEADER", "format": "TEXT", "text": _positionalize(text, header_param_names)}
        if header_param_names:
            missing = [n for n in header_param_names if n not in examples]
            if missing:
                errors.append(f"Example value required for header variable {{{{{missing[0]}}}}}.")
            else:
                comp["example"] = {"header_text": [examples[header_param_names[0]]]}
        components.append(comp)
    elif header_format in MEDIA_HEADER_FORMATS:
        if not (header.get("sample_url") or "").strip():
            errors.append(f"A sample {header_format.lower()} URL is required for media headers (Meta reviews the sample).")
        components.append({"type": "HEADER", "format": header_format})  # example handle added at submit
    elif header_format not in ("NONE", ""):
        errors.append(f"Unsupported header format '{header_format}'.")

    # Body
    body = (tmpl.get("content") or "").strip()
    body_param_names = _ordered_unique(NAMED_VAR_RE.findall(body))
    if not body:
        errors.append("Body text is required.")
    if len(body) > 1024:
        errors.append("Body text cannot exceed 1024 characters.")
    if body.startswith("{{") or body.endswith("}}"):
        errors.append("Meta does not allow the body to start or end with a variable. Add text before/after it.")
    if re.search(r"\}\}\s*\{\{", body):
        errors.append("Variables cannot be placed directly next to each other.")
    missing_examples = [n for n in body_param_names if n not in examples]
    if missing_examples:
        errors.append("Example values required for body variables: " + ", ".join(f"{{{{{n}}}}}" for n in missing_examples))
    body_comp: Dict[str, Any] = {"type": "BODY", "text": _positionalize(body, body_param_names)}
    if body_param_names and not missing_examples:
        body_comp["example"] = {"body_text": [[examples[n] for n in body_param_names]]}
    components.append(body_comp)

    # Footer
    footer = (tmpl.get("footer") or "").strip()
    if footer:
        if len(footer) > 60:
            errors.append("Footer cannot exceed 60 characters.")
        if NAMED_VAR_RE.search(footer):
            errors.append("Footer cannot contain variables.")
        components.append({"type": "FOOTER", "text": footer})

    # Buttons
    meta_buttons: List[Dict[str, Any]] = []
    for btn in tmpl.get("response_buttons") or []:
        local_type = (btn.get("type") or "custom").lower()
        meta_type = BUTTON_TYPE_MAP.get(local_type)
        text = (btn.get("text") or "").strip()
        if not meta_type:
            errors.append(f"Button type '{local_type}' is not supported in Meta message templates. Remove it before submitting.")
            continue
        if meta_type != "COPY_CODE" and (not text or len(text) > 25):
            errors.append(f"Button text '{text}' must be 1–25 characters.")
        if meta_type == "QUICK_REPLY":
            meta_buttons.append({"type": "QUICK_REPLY", "text": text})
        elif meta_type == "URL":
            url = (btn.get("url") or "").strip()
            if not re.match(r"^https?://", url):
                errors.append(f"Button '{text}' needs a valid http(s) URL.")
                continue
            b = {"type": "URL", "text": text, "url": url}
            if "{{" in url:
                if not re.search(r"\{\{\s*1\s*\}\}$", url):
                    errors.append("A dynamic URL may only contain {{1}} at the end.")
                elif not (btn.get("url_example") or "").strip():
                    errors.append(f"Button '{text}' has a dynamic URL and needs a full example URL.")
                else:
                    b["url"] = re.sub(r"\{\{\s*1\s*\}\}$", "{{1}}", url)
                    b["example"] = [btn["url_example"].strip()]
            meta_buttons.append(b)
        elif meta_type == "PHONE_NUMBER":
            phone = re.sub(r"[^\d+]", "", btn.get("phone_number") or "")
            if not re.fullmatch(r"\+?\d{8,15}", phone):
                errors.append(f"Button '{text}' needs a valid phone number with country code.")
                continue
            meta_buttons.append({"type": "PHONE_NUMBER", "text": text, "phone_number": phone if phone.startswith("+") else "+" + phone})
        elif meta_type == "COPY_CODE":
            code = (btn.get("offer_code") or "").strip()
            if not code or len(code) > 15:
                errors.append("Copy-code button needs an example offer code (max 15 characters).")
                continue
            meta_buttons.append({"type": "COPY_CODE", "example": code})
        elif meta_type == "FLOW":
            flow_id = (btn.get("flow_id") or "").strip()
            if not flow_id.isdigit():
                errors.append(f"Flow button '{text}' needs a published WhatsApp Flow ID (numeric).")
                continue
            meta_buttons.append({"type": "FLOW", "text": text, "flow_id": flow_id, "flow_action": "navigate"})

    if meta_buttons:
        if len(meta_buttons) > 10:
            errors.append("Meta allows at most 10 buttons.")
        if sum(1 for b in meta_buttons if b["type"] == "PHONE_NUMBER") > 1:
            errors.append("Only one phone-number button is allowed.")
        if sum(1 for b in meta_buttons if b["type"] == "URL") > 2:
            errors.append("At most two URL buttons are allowed.")
        kinds = ["QR" if b["type"] == "QUICK_REPLY" else "CTA" for b in meta_buttons]
        groups = [k for i, k in enumerate(kinds) if i == 0 or kinds[i - 1] != k]
        if len(groups) > 2:
            errors.append("Quick-reply buttons must be grouped together (not mixed between call-to-action buttons).")
        components.append({"type": "BUTTONS", "buttons": meta_buttons})

    payload = {
        "name": meta_name,
        "language": language,
        "category": category,
        "components": components,
    }
    derived = {
        "meta_template_name": meta_name,
        "body_param_names": body_param_names,
        "header_param_names": header_param_names,
    }
    return payload, derived, errors


def validate_template(template_id: str) -> Dict[str, Any]:
    tmpl = TemplateRepository.find_by_id(template_id)
    if not tmpl:
        raise LookupError("Template not found")
    payload, _, errors = build_submission(tmpl)
    return {"valid": not errors, "errors": errors, "meta_payload_preview": payload}


async def _resolve_media_header(client: MetaClient, tmpl: dict, payload: dict):
    header = tmpl.get("header") or {}
    fmt = (header.get("format") or "").upper()
    if fmt not in MEDIA_HEADER_FORMATS:
        return
    import httpx
    async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as http:
        resp = await http.get(header["sample_url"])
    if resp.status_code != 200:
        raise MetaApiError(message=f"Could not download the sample header media (HTTP {resp.status_code}).")
    if len(resp.content) > 16 * 1024 * 1024:
        raise MetaApiError(message="Sample header media must be smaller than 16 MB.")
    mime = resp.headers.get("content-type", "").split(";")[0] or "application/octet-stream"
    handle = await client.upload_sample_media(resp.content, mime)
    for comp in payload["components"]:
        if comp["type"] == "HEADER":
            comp["example"] = {"header_handle": [handle]}


async def submit_template(template_id: str, number: Optional[dict] = None) -> dict:
    """Create (first submission) or edit (resubmission) the template on the number's WABA."""
    coll = get_collection()
    tmpl = TemplateRepository.find_by_id(template_id)
    if not tmpl:
        raise LookupError("Template not found")

    payload, derived, errors = build_submission(tmpl)
    if errors:
        raise ValueError("; ".join(errors))

    # Lock against double-submits (repeated clicks / concurrent requests).
    lock_cutoff = (datetime.utcnow() - timedelta(minutes=2)).isoformat()
    locked = coll.find_one_and_update(
        {"_id": ObjectId(template_id), "$or": [{"submit_lock_at": {"$exists": False}}, {"submit_lock_at": None}, {"submit_lock_at": {"$lt": lock_cutoff}}]},
        {"$set": {"submit_lock_at": _now()}},
    )
    if not locked:
        raise ValueError("This template is already being submitted. Please wait a moment.")

    try:
        client = _client(number)
        await _resolve_media_header(client, tmpl, payload)
        if tmpl.get("meta_template_id") and tmpl.get("status") != "DELETED":
            if tmpl.get("status") not in EDITABLE_ON_META_STATUSES:
                raise ValueError(f"Meta only allows editing templates that are APPROVED, REJECTED or PAUSED (current: {tmpl.get('status')}).")
            edit_payload = {"components": payload["components"]}
            if tmpl.get("status") != "APPROVED":
                edit_payload["category"] = payload["category"]
            await client.edit_template(tmpl["meta_template_id"], edit_payload)
            meta_id = tmpl["meta_template_id"]
            response_status = None
        else:
            result = await client.create_template(payload)
            meta_id = result.get("id")
            response_status = result.get("status")
            if result.get("category"):
                payload["category"] = result["category"]

        update = {
            **derived,
            "meta_template_id": meta_id,
            "meta_category": payload["category"],
            "status": (response_status or "PENDING").upper(),
            "status_source": "meta_submit",
            "submitted_at": _now(),
            "last_submit_error": None,
            "rejected_reason": None,
            "has_unsubmitted_changes": False,
            "waba_id": number.get("waba_id") or None,
        }
        TemplateRepository.update(template_id, update)

        # Fetch the authoritative record (components exactly as Meta stores them).
        try:
            meta_tmpl = await client.get_template(meta_id)
            _apply_meta_record(template_id, meta_tmpl, number.get("waba_id"))
        except MetaApiError as e:
            logger.warning(f"[Templates] Submitted but could not re-fetch template {meta_id}: {e}")
        return get_template_by_id(template_id, number)
    except MetaApiError as e:
        TemplateRepository.update(template_id, {"last_submit_error": {**e.to_dict(), "at": _now()}})
        raise
    finally:
        coll.update_one({"_id": ObjectId(template_id)}, {"$set": {"submit_lock_at": None}})


# ═══════════════════════════════════════════════════════════════════
# SYNC FROM META
# ═══════════════════════════════════════════════════════════════════

def _apply_meta_record(local_id: str, meta: dict, waba_id: Optional[str] = None):
    extra = {"waba_id": waba_id} if waba_id else {}
    TemplateRepository.update(local_id, {
        **extra,
        "meta_template_id": meta.get("id"),
        "meta_template_name": meta.get("name"),
        "language": meta.get("language"),
        "meta_category": meta.get("category"),
        "meta_components": meta.get("components") or [],
        "meta_parameter_format": meta.get("parameter_format") or "POSITIONAL",
        "status": (meta.get("status") or "").upper() or "PENDING",
        "status_source": "meta_sync",
        "rejected_reason": meta.get("rejected_reason") if meta.get("rejected_reason") not in (None, "NONE") else None,
        "quality_score": (meta.get("quality_score") or {}).get("score"),
        "last_synced_at": _now(),
    })


def _content_from_meta(meta: dict) -> dict:
    out: Dict[str, Any] = {"content": "", "header": {"format": "NONE"}, "footer": "", "response_buttons": []}
    for comp in meta.get("components") or []:
        ctype = comp.get("type")
        if ctype == "BODY":
            out["content"] = comp.get("text", "")
        elif ctype == "HEADER":
            out["header"] = {"format": comp.get("format", "TEXT"), "text": comp.get("text", "")}
        elif ctype == "FOOTER":
            out["footer"] = comp.get("text", "")
        elif ctype == "BUTTONS":
            reverse = {"QUICK_REPLY": "custom", "URL": "visit_website", "PHONE_NUMBER": "call_phone", "COPY_CODE": "copy_offer_code", "FLOW": "complete_flow"}
            out["response_buttons"] = [
                {"type": reverse.get(b.get("type"), b.get("type", "").lower()), "text": b.get("text", ""), "url": b.get("url", ""), "phone_number": b.get("phone_number", "")}
                for b in comp.get("buttons", [])
            ]
    return out


async def sync_templates_from_meta(number: Optional[dict] = None) -> dict:
    """
    Pull every template from the number's WABA and reconcile local records of that WABA without creating
    duplicates. Templates of other WABAs are never touched.
    """
    coll = get_collection()
    meta_templates = await _client(number).list_templates()
    waba_id = number.get("waba_id")
    seen_ids = set()
    created = updated = 0

    for meta in meta_templates:
        meta_id = meta.get("id")
        seen_ids.add(meta_id)
        # Meta template IDs are globally unique: a record with this ID provably belongs to this WABA.
        local = coll.find_one({"meta_template_id": meta_id})
        if not local:
            # Link a local draft/legacy record of this WABA by Meta name + language (legacy records lack language → en_US).
            local = coll.find_one({
                "waba_id": waba_id,
                "meta_template_id": {"$in": [None, ""]},
                "meta_template_name": meta.get("name"),
                "$or": [{"language": meta.get("language")}, {"language": {"$exists": False}}, {"language": None}],
            })
        if local:
            _apply_meta_record(str(local["_id"]), meta, waba_id)
            updated += 1
        else:
            doc = {
                "name": meta.get("name"),
                "category": (meta.get("category") or "").lower(),
                "description": "Imported from Meta WhatsApp Manager",
                "source": "meta_import",
                "waba_id": waba_id,
                "is_active": True,
                "views": 0,
                "times_used": 0,
                "is_favorite": False,
                **_content_from_meta(meta),
            }
            try:
                created_doc = TemplateRepository.create(doc)
                _apply_meta_record(created_doc["_id"], meta, waba_id)
                created += 1
            except Exception as e:
                # Unique index race with a concurrent sync — the other sync linked it.
                logger.info(f"[Templates] Skipped duplicate import of {meta.get('name')}: {e}")

    # Local records linked to Meta templates that no longer exist there.
    removed = coll.update_many(
        {"waba_id": waba_id, "meta_template_id": {"$nin": [None, ""] + list(seen_ids)}, "status": {"$ne": "DELETED"}},
        {"$set": {"status": "DELETED", "status_source": "meta_sync", "last_synced_at": _now()}},
    ).modified_count

    # Legacy records previously marked APPROVED locally but never confirmed by Meta.
    corrected = coll.update_many(
        {"waba_id": waba_id, "meta_template_id": {"$in": [None, ""]}, "status": {"$nin": ["DRAFT", None]}},
        {"$set": {"status": "DRAFT", "status_source": "local", "sync_note": "Status reset: template was not found on Meta. Submit it for review."}},
    ).modified_count
    coll.update_many({"status": {"$exists": False}}, {"$set": {"status": "DRAFT", "status_source": "local"}})

    from app.config.database import whatsapp_number_collection
    summary = {"waba_id": waba_id, "total_on_meta": len(meta_templates), "created": created, "updated": updated,
               "marked_deleted": removed, "reset_to_draft": corrected, "synced_at": _now()}
    # Every number of this WABA shares the catalogue, so all of them record the sync.
    whatsapp_number_collection.update_many({"waba_id": waba_id}, {"$set": {"last_template_sync": summary}})
    return summary


def apply_template_status_webhook(value: dict, waba_id: Optional[str] = None) -> bool:
    """Handle `message_template_status_update` / `template_category_update` webhook values for one WABA."""
    meta_id = str(value.get("message_template_id") or "")
    if not meta_id:
        return False
    update: Dict[str, Any] = {"last_synced_at": _now(), "status_source": "meta_webhook"}
    if value.get("event"):
        update["status"] = value["event"].upper()
        reason = value.get("reason")
        update["rejected_reason"] = reason if reason and reason != "NONE" else None
    if value.get("new_category"):
        update["meta_category"] = value["new_category"].upper()
    query = {"meta_template_id": meta_id}
    if waba_id:
        query["waba_id"] = {"$in": [waba_id, None]}
    result = get_collection().update_one(query, {"$set": update})
    return result.matched_count > 0


# ═══════════════════════════════════════════════════════════════════
# SENDING SUPPORT (shared by campaigns and automations)
# ═══════════════════════════════════════════════════════════════════

def is_sendable(tmpl: Optional[dict]) -> bool:
    return bool(tmpl and tmpl.get("meta_template_id") and (tmpl.get("status") or "").upper() in SENDABLE_STATUSES)


def get_sendable_templates(number: Optional[dict] = None) -> List[dict]:
    docs = get_collection().find({**waba_match(number), "meta_template_id": {"$nin": [None, ""]}, "status": {"$in": list(SENDABLE_STATUSES)}}).sort("name", 1)
    return [describe_for_sending(_serialize_doc(d)) for d in docs]


def _placeholders(text: str) -> List[str]:
    return _ordered_unique(re.findall(r"\{\{\s*([a-zA-Z0-9_]+)\s*\}\}", text or ""))


def get_send_slots(tmpl: dict) -> List[Dict[str, Any]]:
    """
    Every value that must be supplied when sending this template, derived from the components
    Meta stores for it. Each slot: key, component, label, example, kind.
    """
    slots: List[Dict[str, Any]] = []
    body_names = tmpl.get("body_param_names") or []
    header_names = tmpl.get("header_param_names") or []
    examples = tmpl.get("variable_examples") or {}

    for comp in tmpl.get("meta_components") or []:
        ctype = comp.get("type")
        if ctype == "HEADER":
            fmt = comp.get("format")
            if fmt == "TEXT":
                ex = ((comp.get("example") or {}).get("header_text") or [None])
                for i, p in enumerate(_placeholders(comp.get("text"))):
                    local = header_names[i] if i < len(header_names) else None
                    slots.append({"key": f"header.{p}", "component": "header", "param": p, "label": local or f"Header {{{{{p}}}}}", "local_name": local, "example": ex[0] if i == 0 else None, "kind": "text"})
            elif fmt in MEDIA_HEADER_FORMATS:
                slots.append({"key": "header.media", "component": "header", "param": None, "label": f"Header {fmt.lower()} URL", "local_name": None, "example": (tmpl.get("header") or {}).get("sample_url"), "kind": "media", "media_format": fmt})
        elif ctype == "BODY":
            ex_rows = (comp.get("example") or {}).get("body_text") or [[]]
            ex = ex_rows[0] if ex_rows else []
            for i, p in enumerate(_placeholders(comp.get("text"))):
                local = body_names[i] if p.isdigit() and i < len(body_names) else (p if not p.isdigit() else None)
                slots.append({"key": f"body.{p}", "component": "body", "param": p, "label": local or f"Body {{{{{p}}}}}", "local_name": local, "example": examples.get(local) if local in examples else (ex[i] if i < len(ex) else None), "kind": "text"})
        elif ctype == "BUTTONS":
            for idx, btn in enumerate(comp.get("buttons") or []):
                if btn.get("type") == "URL" and "{{" in (btn.get("url") or ""):
                    slots.append({"key": f"button.{idx}.url", "component": "button", "index": idx, "label": f"URL suffix for button '{btn.get('text')}'", "local_name": None, "example": (btn.get("example") or [None])[0], "kind": "url_suffix"})
                elif btn.get("type") == "COPY_CODE":
                    slots.append({"key": f"button.{idx}.coupon", "component": "button", "index": idx, "label": "Offer code", "local_name": None, "example": (btn.get("example") or [None])[0] if isinstance(btn.get("example"), list) else btn.get("example"), "kind": "coupon"})
    return slots


def describe_for_sending(tmpl: dict) -> dict:
    return {
        "_id": tmpl["_id"],
        "name": tmpl.get("name"),
        "meta_template_name": tmpl.get("meta_template_name"),
        "meta_template_id": tmpl.get("meta_template_id"),
        "language": tmpl.get("language"),
        "meta_category": tmpl.get("meta_category"),
        "status": tmpl.get("status"),
        "is_sendable": is_sendable(tmpl),
        "components": tmpl.get("meta_components") or [],
        "slots": get_send_slots(tmpl),
        "parameter_format": tmpl.get("meta_parameter_format") or "POSITIONAL",
    }


def build_send_components(tmpl: dict, values: Dict[str, str]) -> Tuple[List[Dict[str, Any]], List[str]]:
    """
    Build the `template.components` array for POST /messages.
    `values` maps slot key → resolved string. Returns (components, missing_slot_labels).
    """
    named = (tmpl.get("meta_parameter_format") or "POSITIONAL").upper() == "NAMED"
    slots = get_send_slots(tmpl)
    missing = [s["label"] for s in slots if not str(values.get(s["key"]) or "").strip()]
    if missing:
        return [], missing

    def text_param(slot):
        p = {"type": "text", "text": str(values[slot["key"]])}
        if named and slot.get("param") and not str(slot["param"]).isdigit():
            p["parameter_name"] = slot["param"]
        return p

    components: List[Dict[str, Any]] = []
    header_params = []
    for s in slots:
        if s["component"] != "header":
            continue
        if s["kind"] == "media":
            fmt = s["media_format"].lower()
            header_params.append({"type": fmt, fmt: {"link": values[s["key"]]}})
        else:
            header_params.append(text_param(s))
    if header_params:
        components.append({"type": "header", "parameters": header_params})

    body_params = [text_param(s) for s in slots if s["component"] == "body"]
    if body_params:
        components.append({"type": "body", "parameters": body_params})

    for s in slots:
        if s["component"] != "button":
            continue
        if s["kind"] == "url_suffix":
            components.append({"type": "button", "sub_type": "url", "index": str(s["index"]), "parameters": [{"type": "text", "text": values[s["key"]]}]})
        elif s["kind"] == "coupon":
            components.append({"type": "button", "sub_type": "copy_code", "index": str(s["index"]), "parameters": [{"type": "coupon_code", "coupon_code": values[s["key"]]}]})
    return components, []


def render_preview(tmpl: dict, values: Dict[str, str]) -> Dict[str, Any]:
    """Render header/body/footer/buttons text with the given slot values (missing → [label])."""
    def sub(text, prefix):
        return re.sub(
            r"\{\{\s*([a-zA-Z0-9_]+)\s*\}\}",
            lambda m: str(values.get(f"{prefix}.{m.group(1)}") or f"[{m.group(1)}]"),
            text or "",
        )

    out: Dict[str, Any] = {"header": None, "header_media": None, "body": "", "footer": None, "buttons": []}
    for comp in tmpl.get("meta_components") or []:
        ctype = comp.get("type")
        if ctype == "HEADER":
            if comp.get("format") == "TEXT":
                out["header"] = sub(comp.get("text"), "header")
            else:
                out["header_media"] = {"format": comp.get("format"), "link": values.get("header.media")}
        elif ctype == "BODY":
            out["body"] = sub(comp.get("text"), "body")
        elif ctype == "FOOTER":
            out["footer"] = comp.get("text")
        elif ctype == "BUTTONS":
            out["buttons"] = [b.get("text") or b.get("type") for b in comp.get("buttons") or []]
    text = "\n\n".join(x for x in [out["header"], out["body"], out["footer"]] if x)
    out["text"] = text
    return out


def render_template(template_content: str, variables: Dict[str, Any]) -> str:
    """
    Substitute {{variable_name}} placeholders in local template content.
    Placeholders without a value are left visible as [variable_name] — values are never invented.
    """
    if not template_content:
        return ""
    var_map = {str(k).strip(): str(v) for k, v in (variables or {}).items() if v not in (None, "")}
    return NAMED_VAR_RE.sub(lambda m: var_map.get(m.group(1), f"[{m.group(1)}]"), template_content)
