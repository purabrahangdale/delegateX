import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { FiArrowLeft, FiSearch, FiUsers, FiClock, FiCheckSquare, FiAlertCircle, FiTrendingUp, FiActivity, FiLayers } from "react-icons/fi";
import { getTasks } from "../services/taskApi";
import { getEmployees } from "../services/employeeApi";
import { getOverallProductivity, calculateDaysWorked } from "../utils/productivityUtils";
import EmployeeActivityTable from "../components/tasks/EmployeeActivityTable";
import EmployeeWorkDetails from "../components/tasks/EmployeeWorkDetails";

export default function EmployeeWorkInsights() {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters & Sorting state
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [priorityFilter, setPriorityFilter] = useState("All");
  const [completionFilter, setCompletionFilter] = useState("All");
  const [sortByDuration, setSortByDuration] = useState(false);

  // Drawer state
  const [selectedEmployee, setSelectedEmployee] = useState(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [tasksRes, employeesRes] = await Promise.all([
        getTasks(),
        getEmployees()
      ]);
      setTasks(tasksRes.data || []);
      setEmployees(employeesRes || []);
    } catch (error) {
      console.error("Failed to load work insights data", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Compute Productivity Statistics using utility functions
  const productivity = getOverallProductivity(tasks, employees);

  // Filter and sort the tasks list for the table
  const filteredTasks = tasks
    .filter((task) => {
      const empName = task.employee_name || task.employee || "Unassigned";
      
      const matchesSearch = empName.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus =
        statusFilter === "All" ||
        (task.status || "").toLowerCase() === statusFilter.toLowerCase();
        
      const matchesPriority =
        priorityFilter === "All" ||
        (task.priority || "").toLowerCase() === priorityFilter.toLowerCase();
        
      const isCompleted =
        (task.status || "").toLowerCase() === "completed";
      const matchesCompletion =
        completionFilter === "All" ||
        (completionFilter === "Completed" && isCompleted) ||
        (completionFilter === "Active" && !isCompleted);

      return matchesSearch && matchesStatus && matchesPriority && matchesCompletion;
    })
    .sort((a, b) => {
      if (sortByDuration) {
        const daysA = calculateDaysWorked(a.assignedDate, a.completedDate);
        const daysB = calculateDaysWorked(b.assignedDate, b.completedDate);
        return daysB - daysA; // Sort by longest working duration
      }
      // default: sort by latest updated
      const dateA = new Date(a.updatedAt || a.assignedDate || 0);
      const dateB = new Date(b.updatedAt || b.assignedDate || 0);
      return dateB - dateA;
    });

  if (loading) {
    return (
      <div className="w-full min-h-[60vh] flex flex-col items-center justify-center gap-3">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
        <span className="text-slate-550 text-xs font-semibold">Loading Productivity Analytics...</span>
      </div>
    );
  }

  return (
    <div className="w-full max-w-none px-4 md:px-6 py-4 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <button
            onClick={() => navigate("/dashboard-delegation")}
            className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-indigo-600 transition-colors bg-transparent border-0 outline-none cursor-pointer p-0 mb-1"
          >
            <FiArrowLeft size={13} />
            Back to Dashboard
          </button>
          <h1 className="text-2xl font-bold font-display text-slate-900 tracking-tight">
            Employee Work Activity & Productivity
          </h1>
          <p className="text-slate-500 text-xs">
            Analyze workloads, active durations, status history, and delivery metrics.
          </p>
        </div>
      </div>

      {/* Analytics KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {/* Total Employees Working */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow">
          <span className="text-sm font-semibold text-slate-900 flex items-center gap-2">
            <FiUsers className="text-indigo-500" size={14} />
            Working
          </span>
          <p className="text-2xl font-bold text-slate-800 tracking-tight font-display mt-2">
            {productivity.totalEmployeesWorking}
          </p>
          <span className="text-xs text-slate-550 block mt-1">Active assignees</span>
        </div>

        {/* Total Active Delegations */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow">
          <span className="text-sm font-semibold text-slate-900 flex items-center gap-2">
            <FiLayers className="text-amber-500" size={14} />
            Active Tasks
          </span>
          <p className="text-2xl font-bold text-slate-800 tracking-tight font-display mt-2">
            {productivity.totalActiveDelegations}
          </p>
          <span className="text-xs text-slate-550 block mt-1">Pending resolution</span>
        </div>

        {/* Most Active Employee */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow">
          <span className="text-sm font-semibold text-slate-900 flex items-center gap-2">
            <FiActivity className="text-rose-500" size={14} />
            Most Active
          </span>
          <p className="text-xl font-bold text-slate-800 tracking-tight font-display truncate mt-2" title={productivity.mostActiveEmployeeName}>
            {productivity.mostActiveEmployeeName}
          </p>
          <span className="text-xs text-slate-550 block mt-1">
            {productivity.mostActiveEmployeeActiveCount > 0
              ? `${productivity.mostActiveEmployeeActiveCount} active tasks`
              : "No active tasks"}
          </span>
        </div>

        {/* Average Completion Time */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow">
          <span className="text-sm font-semibold text-slate-900 flex items-center gap-2">
            <FiClock className="text-indigo-500" size={14} />
            Avg Cycle Time
          </span>
          <p className="text-2xl font-bold text-slate-800 tracking-tight font-display mt-2">
            {productivity.avgCompletionTime} days
          </p>
          <span className="text-xs text-slate-550 block mt-1">Per delegation</span>
        </div>

        {/* Overloaded Employees */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow">
          <span className="text-sm font-semibold text-slate-900 flex items-center gap-2">
            <FiAlertCircle className="text-rose-500" size={14} />
            Overloaded
          </span>
          <p className="text-2xl font-bold text-slate-800 tracking-tight font-display mt-2">
            {productivity.overloadedCount}
          </p>
          <span className="text-xs text-slate-550 block mt-1">With 3+ active tasks</span>
        </div>

        {/* Completed This Week */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow">
          <span className="text-sm font-semibold text-slate-900 flex items-center gap-2">
            <FiCheckSquare className="text-emerald-500" size={14} />
            Done (Week)
          </span>
          <p className="text-2xl font-bold text-slate-800 tracking-tight font-display mt-2">
            {productivity.completedThisWeek}
          </p>
          <span className="text-xs text-slate-550 block mt-1">Completed last 7d</span>
        </div>
      </div>

      {/* Filters and Controls */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Name Search */}
          <div className="relative flex-1 min-w-[240px]">
            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-455">
              <FiSearch size={14} />
            </span>
            <input
              type="text"
              placeholder="Search employee by name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full h-10 rounded-xl border border-slate-200 px-4 pl-10 text-sm focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100/50 outline-none transition font-sans"
            />
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-10 rounded-xl border border-slate-200 px-3 text-sm focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100/50 outline-none transition font-sans bg-white text-slate-700 cursor-pointer"
          >
            <option value="All">All Statuses</option>
            <option value="Pending">Pending</option>
            <option value="In Progress">In Progress</option>
            <option value="In Review">In Review</option>
            <option value="Completed">Completed</option>
          </select>

          {/* Priority Filter */}
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="h-10 rounded-xl border border-slate-200 px-3 text-sm focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100/50 outline-none transition font-sans bg-white text-slate-700 cursor-pointer"
          >
            <option value="All">All Priorities</option>
            <option value="Urgent">Urgent</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
          </select>

          {/* Completion State Filter */}
          <select
            value={completionFilter}
            onChange={(e) => setCompletionFilter(e.target.value)}
            className="h-10 rounded-xl border border-slate-200 px-3 text-sm focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100/50 outline-none transition font-sans bg-white text-slate-700 cursor-pointer"
          >
            <option value="All">All Resolution States</option>
            <option value="Active">Active / Incomplete</option>
            <option value="Completed">Completed Only</option>
          </select>

          {/* Sort duration check */}
          <button
            onClick={() => setSortByDuration(!sortByDuration)}
            className={`h-10 px-4 rounded-xl border text-sm font-semibold transition cursor-pointer ${
              sortByDuration
                ? "bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100/60"
                : "bg-white border-slate-200 text-slate-655 hover:bg-slate-50"
            }`}
          >
            {sortByDuration ? "Sorted: Longest Working" : "Sort: Longest Working"}
          </button>
        </div>

        {/* Activity Table */}
        <EmployeeActivityTable
          tasks={filteredTasks}
          onEmployeeClick={(name) => setSelectedEmployee(name)}
        />
      </div>

      {/* Detailed Employee Drawer */}
      {selectedEmployee && (
        <EmployeeWorkDetails
          employeeName={selectedEmployee}
          tasks={tasks}
          onClose={() => setSelectedEmployee(null)}
        />
      )}
    </div>
  );
}
