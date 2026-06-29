import React from "react";
import { calculateDaysWorked } from "../../utils/productivityUtils";

export default function EmployeeActivityTable({ tasks, onEmployeeClick }) {
  const getPriorityStyle = (priority) => {
    switch (priority) {
      case "Urgent":
        return "bg-red-50 text-red-700 border-red-200";
      case "High":
        return "bg-rose-50 text-rose-700 border-rose-200";
      case "Medium":
        return "bg-amber-50 text-amber-700 border-amber-200";
      case "Low":
        return "bg-emerald-50 text-emerald-700 border-emerald-200";
      default:
        return "bg-slate-50 text-slate-655 border-slate-200";
    }
  };

  const getStatusStyle = (status) => {
    const s = (status || "").toLowerCase();
    if (s === "completed") return "bg-emerald-50 text-emerald-700 border-emerald-200";
    if (s === "in progress" || s === "in_progress") return "bg-indigo-50 text-indigo-700 border-indigo-200";
    if (s === "in review" || s === "in_review") return "bg-purple-50 text-purple-700 border-purple-200";
    return "bg-amber-50 text-amber-700 border-amber-200";
  };

  const getProgress = (task) => {
    const s = (task.status || "").toLowerCase();
    if (s === "completed") return 100;
    if (s === "cancelled") return 0;
    if (s === "in progress" || s === "in_progress") return 65;
    if (s === "in review" || s === "in_review") return 85;
    return 20; // default for Pending/Todo
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50/70 border-b border-slate-200 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              <th className="px-6 py-4">Employee Name</th>
              <th className="px-6 py-4">Delegation / Task Name</th>
              <th className="px-6 py-4">Assigned Date</th>
              <th className="px-6 py-4">Completion Date</th>
              <th className="px-6 py-4">Days Worked</th>
              <th className="px-6 py-4">Current Status</th>
              <th className="px-6 py-4">Priority</th>
              <th className="px-6 py-4">Progress %</th>
              <th className="px-6 py-4">Last Updated</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs text-slate-700 font-sans">
            {tasks.length === 0 ? (
              <tr>
                <td colSpan="9" className="text-center py-10 text-slate-400 font-medium">
                  No delegation activities matching selected filters.
                </td>
              </tr>
            ) : (
              tasks.map((task) => {
                const daysWorked = calculateDaysWorked(task.assignedDate, task.completedDate);
                const progress = getProgress(task);
                const empName = task.employee_name || task.employee || "Unassigned";

                return (
                  <tr
                    key={task._id || task.id}
                    onClick={() => onEmployeeClick(empName)}
                    className="hover:bg-slate-50/80 transition-colors duration-150 cursor-pointer group"
                  >
                    {/* Employee Name */}
                    <td className="px-6 py-4 font-bold text-slate-900">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-[10px] font-display">
                          {empName.charAt(0)}
                        </div>
                        <span className="group-hover:text-indigo-650 transition-colors">
                          {empName}
                        </span>
                      </div>
                    </td>

                    {/* Task Title */}
                    <td className="px-6 py-4 max-w-[200px] truncate font-medium text-slate-800" title={task.title}>
                      {task.title}
                    </td>

                    {/* Assigned Date */}
                    <td className="px-6 py-4 text-slate-500 font-medium">
                      {task.assignedDate || "N/A"}
                    </td>

                    {/* Completion Date */}
                    <td className="px-6 py-4 text-slate-500 font-medium">
                      {task.completedDate || <span className="text-slate-400 italic font-normal">Active</span>}
                    </td>

                    {/* Days Worked */}
                    <td className="px-6 py-4">
                      <span className="font-bold text-slate-800">
                        {daysWorked} {daysWorked === 1 ? "day" : "days"}
                      </span>
                    </td>

                    {/* Status Pill */}
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${getStatusStyle(task.status)}`}>
                        {task.status || "Pending"}
                      </span>
                    </td>

                    {/* Priority Badge */}
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${getPriorityStyle(task.priority)}`}>
                        {task.priority || "Medium"}
                      </span>
                    </td>

                    {/* Progress Bar & Value */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden shrink-0">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              progress === 100 ? "bg-emerald-500" : "bg-indigo-600"
                            }`}
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                        <span className="font-bold text-slate-800 text-[10px] w-6 text-right">
                          {progress}%
                        </span>
                      </div>
                    </td>

                    {/* Last Updated */}
                    <td className="px-6 py-4 text-slate-400 font-medium">
                      {task.updatedAt || task.assignedDate || "N/A"}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
