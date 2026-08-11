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
import TemplatesView from "../pages/TemplatesView";
import FormTemplatesView from "../pages/FormTemplatesView";
import CreateFormTemplateView from "../pages/CreateFormTemplateView";
import DelegationFormsPage from "../delegation/delegation-form/pages/DelegationFormsPage";
import CreateDelegationFormPage from "../delegation/delegation-form/pages/CreateDelegationFormPage";
import DelegationResponsesPage from "../delegation/delegation-form/pages/DelegationResponsesPage";
import PublicDelegationFormPage from "../delegation/delegation-form/pages/PublicDelegationFormPage";
import WhatsAppDashboard from "../whatsapp/pages/WhatsAppDashboard";
import WhatsAppInbox from "../whatsapp/pages/WhatsAppInbox";
import WhatsAppTemplates from "../whatsapp/pages/WhatsAppTemplates";
import CreateWhatsAppTemplate from "../whatsapp/pages/CreateWhatsAppTemplate";
import WhatsAppLogs from "../whatsapp/pages/WhatsAppLogs";
import WhatsAppSettings from "../whatsapp/pages/WhatsAppSettings";
import WhatsAppCampaigns from "../whatsapp/pages/WhatsAppCampaigns";
import WhatsAppContacts from "../whatsapp/pages/WhatsAppContacts";
import WhatsAppAutomation from "../whatsapp/pages/WhatsAppAutomation";
import WhatsAppReports from "../whatsapp/pages/WhatsAppReports";
import WhatsAppTemplateInsights from "../whatsapp/pages/WhatsAppTemplateInsights";
import WhatsAppDND from "../whatsapp/pages/WhatsAppDND";

function AppRoutes() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/delegation/form/:formId" element={<PublicDelegationFormPage />} />
                <Route element={<AdminLayout />}>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/employees" element={<Employees />} />
                    <Route path="/projects" element={<Projects />} />
                    <Route path="/tasks" element={<Tasks />} />
                    <Route path="/tasks/:taskId" element={<TaskDetailsPage />} />
                    <Route path="/dashboard-delegation" element={<DelegationDashboard />} />
                    <Route path="/employees/dashboard" element={<EmployeeWorkInsights />} />

                    <Route path="/create-delegation" element={<CreateDelegation />} />

                    <Route path="/delegation/delegation-form" element={<DelegationFormsPage />} />
                    <Route path="/delegation/delegation-form/create" element={<CreateDelegationFormPage />} />
                    <Route path="/delegation/forms/edit/:id" element={<CreateDelegationFormPage />} />
                    <Route path="/delegation/delegation-form/responses" element={<DelegationResponsesPage />} />

                    <Route path="/crm/:view" element={<CRMView />} />

                    {/* WhatsApp Automation */}
                    <Route path="/whatsapp/dashboard" element={<WhatsAppDashboard />} />
                    <Route path="/whatsapp/campaigns" element={<WhatsAppCampaigns />} />
                    <Route path="/whatsapp/bulk-send" element={<WhatsAppCampaigns isWizardOnly={true} />} />
                    <Route path="/whatsapp/inbox" element={<WhatsAppInbox />} />
                    <Route path="/whatsapp/templates" element={<WhatsAppTemplates />} />
                    <Route path="/whatsapp/templates/insights" element={<WhatsAppTemplateInsights />} />
                    <Route path="/whatsapp/templates/create" element={<CreateWhatsAppTemplate />} />
                    <Route path="/whatsapp/templates/new" element={<CreateWhatsAppTemplate />} />
                    <Route path="/whatsapp/create-template" element={<CreateWhatsAppTemplate />} />
                    <Route path="/whatsapp/contacts" element={<WhatsAppContacts />} />
                    <Route path="/whatsapp/dnd" element={<WhatsAppDND />} />
                    <Route path="/whatsapp/automation" element={<WhatsAppAutomation />} />
                    <Route path="/whatsapp/reports" element={<WhatsAppReports />} />
                    <Route path="/whatsapp/logs" element={<WhatsAppLogs />} />
                    <Route path="/whatsapp/settings" element={<WhatsAppSettings />} />

                    <Route path="/settings/users" element={<UserManagement />} />
                    <Route path="/templates/form-templates" element={<FormTemplatesView />} />
                    <Route path="/templates/form-templates/create" element={<CreateFormTemplateView />} />
                    <Route path="/templates" element={<TemplatesView />} />
                    <Route path="/templates/:view" element={<TemplatesView />} />
                </Route>
            </Routes>
        </BrowserRouter>
    );
}

export default AppRoutes;
