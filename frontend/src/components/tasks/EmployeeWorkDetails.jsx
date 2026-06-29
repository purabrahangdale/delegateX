import React from "react";
import { FiX, FiCheckCircle, FiClock, FiActivity, FiLayers, FiCalendar, FiTrendingUp } from "react-icons/fi";
import { getEmployeeProductivityMetrics, calculateDaysWorked } from "../../utils/productivityUtils";

export default function EmployeeWorkDetails({ employeeName, tasks, onClose }) {
  const metrics = getEmployeeProductivityMetrics(employeeName, tasks);

  // Split active and completed tasks
  const activeTasks = metrics.tasks.filter(t => t.status !== "Completed" && t.status !== "completed");
  const completedTasks = metrics.tasks.filter(t => t.status === "Completed" || t.status === "completed");

  // Format activity timeline (reverse chronological order)
  const timelineHistory = [];
  metrics.tasks.forEach(t => {
    if (t.assignedDate) {
      timelineHistory.push({
        date: t.assignedDate,
        type: "assigned",
        text: `Assigned task: "${t.title}"`,
        project: t.project,
        color: "bg-indigo-500"
      });
    }
    if (t.completedDate) {
      timelineHistory.push({
        date: t.completedDate,
        type: "completed",
        text: `Completed task: "${t.title}"`,
        project: t.project,
        color: "bg-emerald-500"
      });
    }
    if (t.statusHistory && Array.isArray(t.statusHistory)) {
      t.statusHistory.forEach(history => {
        // avoid duplicating the initial assignment or final completion if already added, but include other transitions
        if (history.status !== "Completed" && history.status !== "completed" && history.status !== "Pending") {
          timelineHistory.push({
            date: history.changedAt || t.assignedDate,
            type: "transition",
            text: `Moved task "${t.title}" to ${history.status}`,
            project: t.project,
            color: "bg-purple-500"
          });
        }
      });
    }
  });

  // Sort timeline by date descending
  timelineHistory.sort((a, b) => new Date(b.date) - new Date(a.date));

  // Weekly trend logic: group completions by week (mocking trend for UI)
  const completionsLast4Weeks = [
    { label: "3 Weeks Ago", count: 0 },
    { label: "2 Weeks Ago", count: 0 },
    { label: "Last Week", count: 0 },
    { label: "This Week", count: 0 }
  ];

  const today = new Date();
  completedTasks.forEach(t => {
    const compDate = new Date(t.completedDate || t.updatedAt || today);
    const diffTime = today - compDate;
    const diffDays = Math.floor(diffTime / 86400000);
    if (diffDays <= 7) {
      completionsLast4Weeks[3].count++;
    } else if (diffDays <= 14) {
      completionsLast4Weeks[2].count++;
    } else if (diffDays <= 21) {
      completionsLast4Weeks[1].count++;
    } else if (diffDays <= 28) {
      completionsLast4Weeks[0].count++;
    }
  });

  const maxWeeklyCount = Math.max(...completionsLast4Weeks.map(w => w.count), 1);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity animate-fade-in"
        onClick={onClose}
      />

      {/* Drawer Body */}
      <div className="relative w-full max-w-lg bg-slate-50 shadow-2xl h-full flex flex-col z-50 border-l border-slate-200 animate-slide-in-right">
        {/* Header */}
        <div className="bg-white border-b border-slate-200 px-6 py-5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 to-indigo-650 text-white flex items-center justify-center font-bold text-sm font-display shadow-md shadow-indigo-500/10">
              {employeeName.split(" ").map(n => n[0]).join("")}
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 font-display">{employeeName}</h2>
              <span className="text-[10px] bg-slate-100 text-slate-500 font-bold px-2 py-0.5 rounded uppercase tracking-wider mt-0.5 inline-block">
                {metrics.role || "Team Member"}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg border border-slate-200 text-slate-400 hover:text-slate-655 hover:bg-slate-50 transition cursor-pointer"
          >
            <FiX size={16} />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Key Metrics Grid */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white border border-slate-200/80 p-3.5 rounded-2xl shadow-sm text-center">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Assigned</span>
              <span className="text-xl font-bold text-slate-800 font-display mt-1 block">{metrics.totalTasks}</span>
            </div>
            <div className="bg-white border border-slate-200/80 p-3.5 rounded-2xl shadow-sm text-center">
              <span className="text-[9px] font-bold text-emerald-500 uppercase tracking-wider block">Completed</span>
              <span className="text-xl font-bold text-slate-800 font-display mt-1 block">{metrics.completedCount}</span>
            </div>
            <div className="bg-white border border-slate-200/80 p-3.5 rounded-2xl shadow-sm text-center">
              <span className="text-[9px] font-bold text-indigo-500 uppercase tracking-wider block">Active Work</span>
              <span className="text-xl font-bold text-slate-800 font-display mt-1 block">{metrics.activeCount}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white border border-slate-200/80 p-3.5 rounded-2xl shadow-sm flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                <FiClock size={16} />
              </div>
              <div>
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Total Days</span>
                <span className="text-sm font-bold text-slate-800 font-display">{metrics.totalWorkingDays} worked</span>
              </div>
            </div>
            <div className="bg-white border border-slate-200/80 p-3.5 rounded-2xl shadow-sm flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                <FiCalendar size={16} />
              </div>
              <div>
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Avg Cycle Time</span>
                <span className="text-sm font-bold text-slate-800 font-display">{metrics.avgCompletionDuration} days</span>
              </div>
            </div>
          </div>

          {/* Productivity & Completion Ratios */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm space-y-4">
            <h3 className="text-xs font-bold text-slate-900 font-display flex items-center gap-2">
              <FiTrendingUp className="text-indigo-650" size={14} />
              Performance Ratios
            </h3>

            {/* Completion Rate */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-semibold text-slate-600">
                <span>Task Completion Rate</span>
                <span className="font-bold text-slate-850">{metrics.completionRate}%</span>
              </div>
              <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-600 rounded-full transition-all duration-500"
                  style={{ width: `${metrics.completionRate}%` }}
                />
              </div>
            </div>

            {/* On-Time Delivery */}
            <div className="space-y-1.5 pt-1">
              <div className="flex justify-between text-xs font-semibold text-slate-600">
                <span>On-Time Delivery Rate</span>
                <span className="font-bold text-slate-850">{metrics.onTimeDeliveryRate}%</span>
              </div>
              <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                  style={{ width: `${metrics.onTimeDeliveryRate}%` }}
                />
              </div>
            </div>
          </div>

          {/* Trend Chart (Weekly Productivity) */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm space-y-3">
            <h3 className="text-xs font-bold text-slate-900 font-display">Weekly Productivity Trend</h3>
            <p className="text-[10px] text-slate-400 font-medium">Completed delegations by week</p>

            <div className="flex items-end justify-between h-20 pt-4 px-2">
              {completionsLast4Weeks.map((week, idx) => {
                const heightPercent = Math.round((week.count / maxWeeklyCount) * 100);
                return (
                  <div key={idx} className="flex flex-col items-center gap-1.5 flex-1 group">
                    <span className="text-[9px] font-bold text-slate-655 opacity-0 group-hover:opacity-100 transition-opacity">
                      {week.count}
                    </span>
                    <div className="w-8 bg-slate-100 rounded-md h-12 overflow-hidden flex items-end">
                      <div
                        className="w-full bg-indigo-600 group-hover:bg-indigo-700 rounded-b-md transition-all duration-500"
                        style={{ height: `${heightPercent}%` }}
                      />
                    </div>
                    <span className="text-[8px] font-bold text-slate-455 tracking-tight mt-0.5">
                      {week.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Active Work / Tasks */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm space-y-3.5">
            <h3 className="text-xs font-bold text-slate-900 font-display flex items-center justify-between">
              <span>Current Active Assignments</span>
              <span className="text-[10px] bg-slate-100 text-slate-600 font-bold px-2 py-0.5 rounded-full">
                {activeTasks.length} tasks
              </span>
            </h3>

            <div className="divide-y divide-slate-100 border-t border-slate-100">
              {activeTasks.length === 0 ? (
                <p className="text-xs text-slate-400 py-4 font-medium italic text-center">No current active assignments.</p>
              ) : (
                activeTasks.map((t, idx) => (
                  <div key={t._id || idx} className="py-3 first:pt-2 last:pb-0 space-y-1">
                    <div className="flex justify-between items-start gap-3">
                      <span className="font-semibold text-xs text-slate-800 leading-snug truncate" title={t.title}>
                        {t.title}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase shrink-0 ${
                        t.priority === "High" || t.priority === "Urgent"
                          ? "bg-rose-50 text-rose-600"
                          : "bg-slate-100 text-slate-500"
                      }`}>
                        {t.priority}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-slate-400 font-medium">
                      <span>{t.project}</span>
                      <span className="flex items-center gap-1">
                        <FiClock size={11} />
                        Active {calculateDaysWorked(t.assignedDate, t.completedDate)} days
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Activity Timeline */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm space-y-4">
            <h3 className="text-xs font-bold text-slate-900 font-display flex items-center gap-2">
              <FiActivity className="text-indigo-650" size={14} />
              Recent Activity History
            </h3>

            <div className="relative pl-4 border-l-2 border-slate-100 space-y-5 ml-1">
              {timelineHistory.length === 0 ? (
                <p className="text-xs text-slate-400 py-2 font-medium italic text-center -ml-4">No recent activity logs.</p>
              ) : (
                timelineHistory.slice(0, 8).map((log, idx) => (
                  <div key={idx} className="relative">
                    {/* Circle timeline dot */}
                    <div className={`absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full border-2 border-white ring-2 ring-slate-100 ${log.color}`} />
                    <div className="space-y-0.5 leading-snug">
                      <span className="text-[9px] font-bold text-slate-400 block">{log.date}</span>
                      <p className="text-xs font-bold text-slate-700">{log.text}</p>
                      <span className="text-[10px] font-semibold text-indigo-600 block">{log.project}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
