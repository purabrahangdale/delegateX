export const calculateDaysWorked = (assignedDate, completedDate) => {
    if (!assignedDate) return 0;
    const start = new Date(assignedDate);
    const end = completedDate ? new Date(completedDate) : new Date();
    
    // Clear hours to calculate full calendar days accurately
    const startD = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    const endD = new Date(end.getFullYear(), end.getMonth(), end.getDate());
    
    const diffTime = endD.getTime() - startD.getTime();
    const days = Math.ceil(diffTime / 86400000);
    return Math.max(0, days);
};

export const getEmployeeProductivityMetrics = (employeeName, tasks) => {
    const empTasks = tasks.filter(t => (t.employee_name || t.employee) === employeeName);
    const totalTasks = empTasks.length;
    
    const completedTasks = empTasks.filter(t => t.status === "Completed" || t.status === "completed");
    const completedCount = completedTasks.length;
    
    const activeTasks = empTasks.filter(t => t.status !== "Completed" && t.status !== "completed");
    const activeCount = activeTasks.length;
    
    const pendingCount = empTasks.filter(t => {
        const s = (t.status || "").toLowerCase();
        return s === "pending" || s === "todo" || s === "to do";
    }).length;
    
    // Completion rate
    const completionRate = totalTasks > 0 ? Math.round((completedCount / totalTasks) * 100) : 0;
    
    // On-Time Delivery
    let onTimeCompletedCount = 0;
    completedTasks.forEach(t => {
        if (!t.deadline) {
            onTimeCompletedCount++;
            return;
        }
        const compDateStr = t.completedDate || t.updatedAt || new Date().toISOString().split("T")[0];
        if (compDateStr <= t.deadline) {
            onTimeCompletedCount++;
        }
    });
    const onTimeDeliveryRate = completedCount > 0 ? Math.round((onTimeCompletedCount / completedCount) * 100) : 100;
    
    // Total working days
    let totalWorkingDays = 0;
    empTasks.forEach(t => {
        totalWorkingDays += calculateDaysWorked(t.assignedDate, t.completedDate);
    });
    
    // Avg completion duration
    let avgCompletionDuration = 0;
    if (completedCount > 0) {
        let totalCompDays = 0;
        completedTasks.forEach(t => {
            totalCompDays += calculateDaysWorked(t.assignedDate, t.completedDate);
        });
        avgCompletionDuration = Math.round(totalCompDays / completedCount);
    }
    
    return {
        totalTasks,
        completedCount,
        activeCount,
        pendingCount,
        completionRate,
        onTimeDeliveryRate,
        totalWorkingDays,
        avgCompletionDuration,
        tasks: empTasks
    };
};

export const getOverallProductivity = (tasks, employees) => {
    // Unique list of employee names from both employees directory and active/historical tasks
    const employeeNames = Array.from(new Set([
        ...employees.map(e => e.name || e.employee_name),
        ...tasks.map(t => t.employee_name || t.employee)
    ])).filter(name => name && name.toLowerCase() !== "unassigned");
    
    const employeesMetrics = employeeNames.map(name => {
        const metrics = getEmployeeProductivityMetrics(name, tasks);
        const emp = employees.find(e => (e.name || e.employee_name) === name);
        return {
            name,
            role: emp?.role || "Team Member",
            ...metrics
        };
    });
    
    // Most Active Employee (highest active tasks count)
    let mostActiveEmployee = null;
    let maxActiveCount = -1;
    employeesMetrics.forEach(emp => {
        if (emp.activeCount > maxActiveCount) {
            maxActiveCount = emp.activeCount;
            mostActiveEmployee = emp;
        } else if (emp.activeCount === maxActiveCount && maxActiveCount > 0) {
            if (emp.totalTasks > (mostActiveEmployee?.totalTasks || 0)) {
                mostActiveEmployee = emp;
            }
        }
    });
    
    // Avg completion time
    const allCompletedTasks = tasks.filter(t => t.status === "Completed" || t.status === "completed");
    let avgCompletionTime = 0;
    if (allCompletedTasks.length > 0) {
        let totalDays = 0;
        allCompletedTasks.forEach(t => {
            totalDays += calculateDaysWorked(t.assignedDate, t.completedDate);
        });
        avgCompletionTime = Math.round(totalDays / allCompletedTasks.length);
    }
    
    // Overloaded employees: active tasks >= 3
    const overloadedEmployees = employeesMetrics.filter(emp => emp.activeCount >= 3);
    
    // Total Active Delegations
    const totalActiveDelegations = tasks.filter(t => t.status !== "Completed" && t.status !== "completed").length;
    
    // Completed This Week
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const oneWeekAgoStr = oneWeekAgo.toISOString().split("T")[0];
    const completedThisWeek = allCompletedTasks.filter(t => {
        const compDate = t.completedDate || t.updatedAt;
        return compDate && compDate >= oneWeekAgoStr;
    }).length;
    
    return {
        employeesMetrics,
        totalEmployeesWorking: employeesMetrics.filter(emp => emp.activeCount > 0).length,
        totalActiveDelegations,
        mostActiveEmployeeName: mostActiveEmployee ? mostActiveEmployee.name : "None",
        mostActiveEmployeeActiveCount: mostActiveEmployee ? mostActiveEmployee.activeCount : 0,
        avgCompletionTime,
        overloadedCount: overloadedEmployees.length,
        overloadedEmployees,
        completedThisWeek
    };
};
