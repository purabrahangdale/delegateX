"""
db_retriever.py
---------------
Structured database retrieval layer for the DelegateX Hybrid AI Assistant.

Queries ALL live MongoDB collections and returns pre-computed, analytics-ready
context so the LLM can answer quantitative questions accurately.

Priority order (matches requirement spec):
  1. CRM Leads
  2. CRM Meetings
  3. Delegation Forms & Responses
  4. Employees
  5. Projects
  6. Tasks
"""

from __future__ import annotations

from datetime import date
from typing import Optional

from app.config.database import (
    crm_lead_collection,
    crm_meeting_collection,
    delegation_form_collection,
    delegation_response_collection,
    employee_collection,
    project_collection,
    task_collection,
)


def _today() -> str:
    return date.today().isoformat()


def _is_overdue(deadline_str: Optional[str]) -> bool:
    if not deadline_str:
        return False
    try:
        return date.fromisoformat(str(deadline_str)[:10]) < date.today()
    except Exception:
        return False


def _is_today(date_str: Optional[str]) -> bool:
    if not date_str:
        return False
    try:
        return date.fromisoformat(str(date_str)[:10]) == date.today()
    except Exception:
        return False


def _is_upcoming(date_str: Optional[str]) -> bool:
    if not date_str:
        return False
    try:
        return date.fromisoformat(str(date_str)[:10]) >= date.today()
    except Exception:
        return False


# ---------------------------------------------------------------------------
# Section builders
# ---------------------------------------------------------------------------

def _build_crm_leads_context() -> str:
    lines: list[str] = []
    leads = list(crm_lead_collection.find())
    total = len(leads)
    status_counts: dict[str, int] = {}
    priority_counts: dict[str, int] = {}
    project_type_counts: dict[str, int] = {}
    today_leads: list[dict] = []

    for lead in leads:
        s = lead.get("status", "Unknown")
        p = lead.get("priority", "Unknown")
        pt = lead.get("projectType", "Unknown")
        status_counts[s] = status_counts.get(s, 0) + 1
        priority_counts[p] = priority_counts.get(p, 0) + 1
        project_type_counts[pt] = project_type_counts.get(pt, 0) + 1
        if _is_today(lead.get("date")):
            today_leads.append(lead)

    lines.append("=== CRM LEADS ANALYTICS ===")
    lines.append(f"Total Leads: {total}")
    lines.append(f"Today New Enquiries: {len(today_leads)}")
    lines.append("\nStatus Breakdown:")
    for s, c in sorted(status_counts.items()):
        lines.append(f"  - {s}: {c}")
    lines.append("\nPriority Breakdown:")
    for p, c in sorted(priority_counts.items()):
        lines.append(f"  - {p}: {c}")
    lines.append("\nProject Type Breakdown:")
    for pt, c in sorted(project_type_counts.items()):
        lines.append(f"  - {pt}: {c}")
    lines.append("\nAll CRM Leads (full detail):")
    if not leads:
        lines.append("  No leads in database.")
    else:
        for lead in leads:
            lines.append(
                f"  - [{lead.get('status','?')}] {lead.get('name','N/A')} | "
                f"Phone: {lead.get('phone','N/A')} | "
                f"Email: {lead.get('email','N/A')} | "
                f"Project: {lead.get('projectType','N/A')} | "
                f"Priority: {lead.get('priority','N/A')} | "
                f"Value: Rs.{lead.get('value', 0)} | "
                f"Assigned: {lead.get('assignedTo','N/A')} | "
                f"Stage: {lead.get('stage','N/A')} | "
                f"Source: {lead.get('leadSource','N/A')} | "
                f"Date: {lead.get('date','N/A')}"
            )
    return "\n".join(lines)


def _build_crm_meetings_context() -> str:
    lines: list[str] = []
    meetings = list(crm_meeting_collection.find())
    total = len(meetings)
    today_mtgs = [m for m in meetings if _is_today(m.get("date"))]
    upcoming_mtgs = [m for m in meetings if _is_upcoming(m.get("date"))]
    status_counts: dict[str, int] = {}

    for mtg in meetings:
        s = mtg.get("status", "Unknown")
        status_counts[s] = status_counts.get(s, 0) + 1

    lines.append("=== CRM MEETINGS ANALYTICS ===")
    lines.append(f"Total Meetings: {total}")
    lines.append(f"Today Meetings: {len(today_mtgs)}")
    lines.append(f"Upcoming Meetings (today and future): {len(upcoming_mtgs)}")
    lines.append("\nStatus Breakdown:")
    for s, c in sorted(status_counts.items()):
        lines.append(f"  - {s}: {c}")
    lines.append("\nAll Meetings (full detail):")
    if not meetings:
        lines.append("  No meetings scheduled.")
    else:
        for mtg in meetings:
            title = mtg.get("title") or mtg.get("category") or "Meeting"
            client = mtg.get("clientName") or mtg.get("customerName") or "N/A"
            notes = mtg.get("notes") or mtg.get("mom") or "No notes"
            lines.append(
                f"  - [{mtg.get('status','?')}] {title} | "
                f"Client: {client} | "
                f"Date: {mtg.get('date','N/A')} | "
                f"Time: {mtg.get('time','N/A')} | "
                f"Location: {mtg.get('location','N/A')} | "
                f"Duration: {mtg.get('duration','N/A')} | "
                f"Notes: {notes}"
            )
    return "\n".join(lines)


def _build_delegation_context() -> str:
    lines: list[str] = []
    forms = list(delegation_form_collection.find())
    responses = list(delegation_response_collection.find())

    lines.append("=== DELEGATION FORMS (TEMPLATES) ===")
    lines.append(f"Total Form Templates: {len(forms)}")
    if forms:
        for form in forms:
            fields = form.get("fields", [])
            lines.append(
                f"  - Form: '{form.get('title','Untitled')}' | "
                f"Fields: {len(fields)} | "
                f"Created: {form.get('createdAt','N/A')}"
            )
    else:
        lines.append("  No delegation form templates created yet.")

    lines.append("\n=== DELEGATION RESPONSES ===")
    lines.append(f"Total Responses Submitted: {len(responses)}")
    if responses:
        for resp in responses:
            lines.append(
                f"  - Response: {resp.get('id','N/A')} | "
                f"Form: {resp.get('formId','N/A')} | "
                f"Submitted: {resp.get('timestamp','N/A')}"
            )
    else:
        lines.append("  No delegation responses submitted yet.")
    return "\n".join(lines)


def _build_employees_context() -> str:
    lines: list[str] = []
    employees = list(employee_collection.find())
    total = len(employees)
    role_counts: dict[str, int] = {}
    status_counts: dict[str, int] = {}

    for emp in employees:
        role = emp.get("role", "Unknown")
        status = emp.get("status", "Unknown")
        role_counts[role] = role_counts.get(role, 0) + 1
        status_counts[status] = status_counts.get(status, 0) + 1

    lines.append("=== EMPLOYEES DIRECTORY ===")
    lines.append(f"Total Employees: {total}")
    lines.append("\nRole Breakdown:")
    for role, count in sorted(role_counts.items()):
        lines.append(f"  - {role}: {count}")
    lines.append("\nStatus Breakdown:")
    for status, count in sorted(status_counts.items()):
        lines.append(f"  - {status}: {count}")
    lines.append("\nAll Employees (full detail):")
    if not employees:
        lines.append("  No employees found.")
    else:
        for emp in employees:
            lines.append(
                f"  - {emp.get('name','N/A')} | "
                f"Role: {emp.get('role','N/A')} | "
                f"Status: {emp.get('status','N/A')} | "
                f"Project: {emp.get('project','N/A')} | "
                f"Email: {emp.get('email','N/A')}"
            )
    return "\n".join(lines)


def _build_projects_context(is_manager: bool, assigned_project: Optional[str]) -> str:
    lines: list[str] = []
    proj_query: dict = {} if is_manager else {"name": assigned_project}
    projects = list(project_collection.find(proj_query))
    status_counts: dict[str, int] = {}

    for proj in projects:
        s = proj.get("status", "Unknown")
        status_counts[s] = status_counts.get(s, 0) + 1

    lines.append("=== PROJECTS OVERVIEW ===")
    lines.append(f"Total Projects: {len(projects)}")
    lines.append("\nStatus Breakdown:")
    for s, c in sorted(status_counts.items()):
        lines.append(f"  - {s}: {c}")
    lines.append("\nAll Projects (full detail):")
    if not projects:
        lines.append("  No projects found.")
    else:
        for proj in projects:
            lines.append(
                f"  - [{proj.get('status','?')}] {proj.get('name','N/A')} | "
                f"Progress: {proj.get('progress', 0)}% | "
                f"Deadline: {proj.get('deadline','N/A')} | "
                f"Desc: {proj.get('description','N/A')}"
            )
    return "\n".join(lines)


def _build_tasks_context(is_manager: bool, employee_name: Optional[str]) -> str:
    lines: list[str] = []
    task_query: dict = {}
    if not is_manager and employee_name:
        task_query = {"$or": [
            {"employee": employee_name},
            {"assignedEmployee": employee_name}
        ]}

    tasks = list(task_collection.find(task_query))
    today_str = _today()
    status_counts: dict[str, int] = {}
    priority_counts: dict[str, int] = {}
    overdue_tasks: list[dict] = []
    due_today_tasks: list[dict] = []
    workload: dict[str, int] = {}

    for task in tasks:
        status = task.get("status", "Unknown")
        priority = task.get("priority", "Unknown")
        assignee = task.get("employee") or task.get("assignedEmployee") or "Unassigned"
        status_counts[status] = status_counts.get(status, 0) + 1
        priority_counts[priority] = priority_counts.get(priority, 0) + 1
        if status not in ("Completed", "Cancelled"):
            if _is_overdue(task.get("deadline")):
                overdue_tasks.append(task)
            elif _is_today(task.get("deadline")):
                due_today_tasks.append(task)
            workload[assignee] = workload.get(assignee, 0) + 1

    top_employee = max(workload, key=workload.get) if workload else None

    lines.append("=== TASK DELEGATIONS ANALYTICS ===")
    lines.append(f"Total Tasks: {len(tasks)}")
    lines.append(f"Today Date: {today_str}")
    lines.append(f"Overdue Tasks (deadline passed, not completed): {len(overdue_tasks)}")
    lines.append(f"Due Today: {len(due_today_tasks)}")
    if top_employee:
        lines.append(f"Highest Workload Employee: {top_employee} ({workload[top_employee]} active tasks)")

    lines.append("\nStatus Breakdown:")
    for s, c in sorted(status_counts.items()):
        lines.append(f"  - {s}: {c}")
    lines.append("\nPriority Breakdown:")
    for p, c in sorted(priority_counts.items()):
        lines.append(f"  - {p}: {c}")

    if overdue_tasks:
        lines.append("\nOverdue Task List:")
        for t in overdue_tasks:
            lines.append(
                f"  - OVERDUE: {t.get('title','N/A')} | "
                f"Assigned: {t.get('employee','N/A')} | "
                f"Deadline: {t.get('deadline','N/A')} | "
                f"Priority: {t.get('priority','N/A')} | "
                f"Status: {t.get('status','N/A')}"
            )

    lines.append("\nAll Tasks (full detail):")
    if not tasks:
        lines.append("  No tasks found.")
    else:
        for task in tasks:
            lines.append(
                f"  - [{task.get('status','?')}] {task.get('title','N/A')} | "
                f"Assigned: {task.get('employee','N/A')} | "
                f"Project: {task.get('project','N/A')} | "
                f"Priority: {task.get('priority','N/A')} | "
                f"Deadline: {task.get('deadline','N/A')} | "
                f"Desc: {task.get('description','N/A')}"
            )
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Main class
# ---------------------------------------------------------------------------

class DatabaseRetriever:
    """
    Builds structured, analytics-ready context from all live MongoDB
    collections. Enforces RBAC so regular employees cannot see CRM data.
    """

    MANAGER_ROLES = {"Administrator", "Managing Director", "Supervisor"}

    def build_context(self, user_email: str, user_role: str) -> tuple:
        """
        Returns (db_context_string, is_manager).

        db_context_string contains pre-computed summaries + full data for
        every collection the user is authorised to see.
        """
        is_manager = (
            user_role in self.MANAGER_ROLES
            or user_email.lower() == "admin@delegatex.com"
        )

        employee_name: Optional[str] = None
        assigned_project: Optional[str] = None

        if not is_manager:
            emp_record = employee_collection.find_one({"email": user_email})
            if emp_record:
                employee_name = emp_record.get("name")
                assigned_project = emp_record.get("project")

        sections: list[str] = []

        # ── 1 & 2: CRM (managers only) ────────────────────────────────────
        if is_manager:
            sections.append(_build_crm_leads_context())
            sections.append("")
            sections.append(_build_crm_meetings_context())
            sections.append("")
        else:
            sections.append(
                "=== CRM DATA ===\n"
                "Access Restricted: You do not have permission to view CRM leads or meeting data."
            )
            sections.append("")

        # ── 3: Delegation Forms & Responses ──────────────────────────────
        sections.append(_build_delegation_context())
        sections.append("")

        # ── 4: Employees ──────────────────────────────────────────────────
        sections.append(_build_employees_context())
        sections.append("")

        # ── 5: Projects ───────────────────────────────────────────────────
        sections.append(_build_projects_context(is_manager, assigned_project))
        sections.append("")

        # ── 6: Tasks ──────────────────────────────────────────────────────
        sections.append(_build_tasks_context(is_manager, employee_name))

        return "\n".join(sections), is_manager
