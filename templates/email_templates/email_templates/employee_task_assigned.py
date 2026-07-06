from .styles import STYLES

EMPLOYEE_TASK_ASSIGNED_TEMPLATE = """<h1 style="{h1_style}">New Task Assigned</h1>

<p style="{p_style}">
  Dear {employee_name},
</p>

<p style="{p_style}">
  A new task, <strong>{task_title}</strong>, has been scheduled and assigned to you in the DelegateX workspace.
</p>

<!-- Details Table -->
<table border="0" cellpadding="0" cellspacing="0" width="100%" style="{table_style}">
  <tr>
    <td class="table-header" style="{table_header_style}">Project</td>
    <td class="table-data" style="{table_data_style}">{project}</td>
  </tr>
  <tr>
    <td class="table-header" style="{table_header_style}">Priority</td>
    <td class="table-data" style="{table_data_style}">
      <span style="{priority_badge_style}">{priority}</span>
    </td>
  </tr>
  <tr>
    <td class="table-header" style="{table_header_style}">Deadline</td>
    <td class="table-data" style="{table_data_style} color: #ef4444; font-weight: 500;">{deadline}</td>
  </tr>
  <tr>
    <td class="table-header" style="{table_header_style}">Assigned By</td>
    <td class="table-data" style="{table_data_style}">{assigned_by}</td>
  </tr>
</table>

<!-- Description Well -->
<div class="well" style="{well_style}">
  <span class="text-muted" style="{well_title_style}">Task Description</span>
  <p class="description-text" style="{well_body_style}">{description}</p>
</div>
"""

def get_employee_task_assigned_content(employee_name: str, task_title: str, project: str, priority: str, deadline: str, assigned_by: str, description: str) -> str:
    priority_lower = priority.lower().strip()
    if priority_lower == "high":
        priority_badge_style = STYLES["badge_high"]
    elif priority_lower == "low":
        priority_badge_style = STYLES["badge_low"]
    else:
        priority_badge_style = STYLES["badge_medium"]

    return EMPLOYEE_TASK_ASSIGNED_TEMPLATE.format(
        employee_name=employee_name,
        task_title=task_title,
        project=project,
        priority=priority,
        priority_badge_style=priority_badge_style,
        deadline=deadline,
        assigned_by=assigned_by,
        description=description,
        h1_style=STYLES["h1"],
        p_style=STYLES["p"],
        table_style=STYLES["table"],
        table_header_style=STYLES["table_header"],
        table_data_style=STYLES["table_data"],
        well_style=STYLES["well"],
        well_title_style=STYLES["well_title"],
        well_body_style=STYLES["well_body"]
    )
