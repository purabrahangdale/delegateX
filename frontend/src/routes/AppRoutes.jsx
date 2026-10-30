import { lazy } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import AdminLayout from "../layouts/AdminLayout";
import Login from "../pages/Login";
import ProtectedRoute from "./ProtectedRoute";
import { WhatsAppNumberLayout } from "../whatsapp/context/WhatsAppNumberContext";

// Pages load on demand, so the first screen does not download every page and its libraries.
const WhatsAppDashboard = lazy(() => import("../whatsapp/pages/WhatsAppDashboard"));
const WhatsAppInbox = lazy(() => import("../whatsapp/pages/WhatsAppInbox"));
const WhatsAppTemplates = lazy(() => import("../whatsapp/pages/WhatsAppTemplates"));
const CreateWhatsAppTemplate = lazy(() => import("../whatsapp/pages/CreateWhatsAppTemplate"));
const WhatsAppLogs = lazy(() => import("../whatsapp/pages/WhatsAppLogs"));
const WhatsAppSettings = lazy(() => import("../whatsapp/pages/WhatsAppSettings"));
const WhatsAppCampaigns = lazy(() => import("../whatsapp/pages/WhatsAppCampaigns"));
const WhatsAppContacts = lazy(() => import("../whatsapp/pages/WhatsAppContacts"));
const WhatsAppAutomation = lazy(() => import("../whatsapp/pages/WhatsAppAutomation"));
const WhatsAppReports = lazy(() => import("../whatsapp/pages/WhatsAppReports"));
const WhatsAppTemplateInsights = lazy(() => import("../whatsapp/pages/WhatsAppTemplateInsights"));
const WhatsAppDND = lazy(() => import("../whatsapp/pages/WhatsAppDND"));
const ChatAccessHistory = lazy(() => import("../whatsapp/pages/ChatAccessHistory"));
const WhatsAppKeywordReplies = lazy(() => import("../whatsapp/pages/WhatsAppKeywordReplies"));

function AppRoutes() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/login" element={<Login />} />
                <Route element={<ProtectedRoute />}>
                <Route element={<AdminLayout />}>
                    <Route path="/" element={<Navigate to="/whatsapp/dashboard" replace />} />

                    {/* WhatsApp Automation — every page works on the globally selected business number */}
                    <Route element={<WhatsAppNumberLayout />}>
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
                    <Route path="/whatsapp/keyword-replies" element={<WhatsAppKeywordReplies />} />
                    <Route path="/whatsapp/reports" element={<WhatsAppReports />} />
                    <Route path="/whatsapp/access-history" element={<ChatAccessHistory />} />
                    <Route path="/whatsapp/logs" element={<WhatsAppLogs />} />
                    <Route path="/whatsapp/settings" element={<WhatsAppSettings />} />
                    </Route>
                </Route>
                </Route>
                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        </BrowserRouter>
    );
}

export default AppRoutes;
