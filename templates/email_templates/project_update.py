from .styles import STYLES

PROJECT_UPDATE_TEMPLATE = """<h1 style="{h1_style}">Project Update</h1>

<p style="{p_style}">
  Dear {customer_name},
</p>

<p style="{p_style}">
  Thank you for connecting with us.
</p>

<p style="{p_style}">
  We are pleased to inform you that a task relating to your project (<strong>{project}</strong>) has been scheduled and assigned to our team.
</p>

<!-- Details Table -->
<table border="0" cellpadding="0" cellspacing="0" width="100%" style="{table_style}">
  <tr>
    <td class="table-header" style="{table_header_style}">Task Title</td>
    <td class="table-data" style="{table_data_style}">{task_title}</td>
  </tr>
  <tr>
    <td class="table-header" style="{table_header_style}">Assigned Expert</td>
    <td class="table-data" style="{table_data_style}">{employee_name}</td>
  </tr>
  <tr>
    <td class="table-header" style="{table_header_style}">Status</td>
    <td class="table-data" style="{table_data_style}">
      <span style="display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: 600; background-color: #f4f4f5; color: #18181b;">{status}</span>
    </td>
  </tr>
  <tr>
    <td class="table-header" style="{table_header_style}">Expected Deadline</td>
    <td class="table-data" style="{table_data_style} color: #ef4444; font-weight: 500;">{deadline}</td>
  </tr>
</table>

<!-- Description Well -->
<div class="well" style="{well_style}">
  <span class="text-muted" style="{well_title_style}">Task Details</span>
  <p class="description-text" style="{well_body_style}">{description}</p>
</div>

<p style="{p_style}">
  We will keep you updated as progress is made.
</p>
"""

def get_project_update_content(customer_name: str, project: str, task_title: str, employee_name: str, status: str, deadline: str, description: str) -> str:
    return PROJECT_UPDATE_TEMPLATE.format(
        customer_name=customer_name,
        project=project,
        task_title=task_title,
        employee_name=employee_name,
        status=status,
        deadline=deadline,
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
