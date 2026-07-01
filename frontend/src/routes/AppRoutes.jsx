import { BrowserRouter, Routes, Route } from "react-router-dom";

import AdminLayout from "../layouts/AdminLayout";
import Dashboard from "../pages/Dashboard";
import Employees from "../pages/Employees";
import Projects from "../pages/Projects";
import Tasks from "../pages/Tasks";
import Login from "../pages/Login";
import TaskDetailsPage from "../pages/TaskDetailsPage";
import CreateDelegation from "../pages/CreateDelegation";
import DelegationDashboard from "../pages/DelegationDashboard";
import CRMView from "../pages/CRMView";
import EmployeeWorkInsights from "../pages/EmployeeWorkInsights";
import UserManagement from "../pages/UserManagement";

function AppRoutes() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/login" element={<Login />} />
                <Route element={<AdminLayout />}>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/employees" element={<Employees />} />
                    <Route path="/projects" element={<Projects />} />
                    <Route path="/tasks" element={<Tasks />} />
                    <Route path="/tasks/:taskId" element={<TaskDetailsPage />} />
                    <Route path="/dashboard-delegation" element={<DelegationDashboard />} />
                    <Route path="/employees/dashboard" element={<EmployeeWorkInsights />} />

                    <Route path="/create-delegation" element={<CreateDelegation />} />

                    <Route path="/crm/:view" element={<CRMView />} />
                    <Route path="/settings/users" element={<UserManagement />} />
                </Route>
            </Routes>
        </BrowserRouter>
    );
}

export default AppRoutes;
