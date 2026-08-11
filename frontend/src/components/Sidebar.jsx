import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { FiPieChart, FiUsers, FiBriefcase, FiCheckSquare, FiChevronLeft, FiChevronRight, FiGrid, FiPlusSquare, FiLayers, FiChevronDown, FiCalendar, FiX, FiBarChart2, FiFileText, FiSettings, FiMail, FiClipboard, FiMessageCircle, FiSend, FiZap, FiSlash } from "react-icons/fi";

function Sidebar({ isCollapsed, setIsCollapsed, onClose }) {
    const location = useLocation();

    const isDelegationActive = location.pathname.startsWith("/tasks") ||
        location.pathname.startsWith("/dashboard-delegation") ||
        location.pathname.startsWith("/create-delegation") ||
        location.pathname.startsWith("/delegation");

    const isCrmActive = location.pathname.startsWith("/crm");
    const isEmployeesActive = location.pathname.startsWith("/employees");
    const isSettingsActive = location.pathname.startsWith("/settings");
    const isTemplatesActive = location.pathname.startsWith("/templates");
    const isWhatsappActive = location.pathname.startsWith("/whatsapp");

    const [isDelegationOpen, setIsDelegationOpen] = useState(isDelegationActive);
    const [isCrmOpen, setIsCrmOpen] = useState(isCrmActive);
    const [isEmployeesOpen, setIsEmployeesOpen] = useState(isEmployeesActive);
    const [isSettingsOpen, setIsSettingsOpen] = useState(isSettingsActive);
    const [isTemplatesOpen, setIsTemplatesOpen] = useState(isTemplatesActive);
    const [isWhatsappOpen, setIsWhatsappOpen] = useState(isWhatsappActive);

    // Keep submenu open if a child route becomes active
    useEffect(() => {
        if (isDelegationActive) {
            setIsDelegationOpen(true);
        }
    }, [location.pathname, isDelegationActive]);

    useEffect(() => {
        if (isCrmActive) {
            setIsCrmOpen(true);
        }
    }, [location.pathname, isCrmActive]);

    useEffect(() => {
        if (isEmployeesActive) {
            setIsEmployeesOpen(true);
        }
    }, [location.pathname, isEmployeesActive]);

    useEffect(() => {
        if (isSettingsActive) {
            setIsSettingsOpen(true);
        }
    }, [location.pathname, isSettingsActive]);

    useEffect(() => {
        if (isTemplatesActive) {
            setIsTemplatesOpen(true);
        }
    }, [location.pathname, isTemplatesActive]);

    useEffect(() => {
        if (isWhatsappActive) {
            setIsWhatsappOpen(true);
        }
    }, [location.pathname, isWhatsappActive]);

    const menuItems = [
        {
            title: "Dashboard",
            path: "/",
            icon: FiPieChart,
        },
        {
            title: "Employees",
            icon: FiUsers,
            isDropdown: true,
            children: [
                {
                    title: "Employees",
                    path: "/employees",
                    icon: FiUsers,
                },
                {
                    title: "Dashboard",
                    path: "/employees/dashboard",
                    icon: FiBarChart2,
                },
            ]
        },
        {
            title: "Projects",
            path: "/projects",
            icon: FiBriefcase,
        },
        {
            title: "Delegation",
            icon: FiLayers,
            isDropdown: true,
            children: [
                {
                    title: "Dashboard Delegation",
                    path: "/dashboard-delegation",
                    icon: FiGrid,
                },
                {
                    title: "Create Delegation",
                    path: "/create-delegation",
                    icon: FiPlusSquare,
                },
                {
                    title: "Delegation List",
                    path: "/tasks",
                    icon: FiCheckSquare,
                },
                {
                    title: "Delegation Form",
                    path: "/delegation/delegation-form",
                    icon: FiFileText,
                },
            ]
        },
        {
            title: "CRM",
            icon: FiBriefcase,
            isDropdown: true,
            children: [
                {
                    title: "CRM Dashboard",
                    path: "/crm/dashboard",
                    icon: FiGrid,
                },
                {
                    title: "Create New Lead",
                    path: "/crm/create-lead",
                    icon: FiPlusSquare,
                },
                {
                    title: "Meetings",
                    path: "/crm/meetings",
                    icon: FiCalendar,
                },
                {
                    title: "Converted",
                    path: "/crm/converted",
                    icon: FiCheckSquare,
                },
                {
                    title: "Lost",
                    path: "/crm/lost",
                    icon: FiX,
                },
                {
                    title: "All Leads",
                    path: "/crm/leads",
                    icon: FiUsers,
                },
            ]
        },
        {
            title: "Templates",
            icon: FiFileText,
            isDropdown: true,
            children: [
                {
                    title: "Email Templates",
                    path: "/templates/email",
                    icon: FiMail,
                },
                {
                    title: "Reusable Layouts",
                    path: "/templates/layouts",
                    icon: FiLayers,
                },
                {
                    title: "CRM Notification Templates",
                    path: "/templates/crm",
                    icon: FiBriefcase,
                },
                {
                    title: "Client Emails",
                    path: "/templates/client",
                    icon: FiUsers,
                },
                {
                    title: "Employee Emails",
                    path: "/templates/employee",
                    icon: FiUsers,
                },
                {
                    title: "Form Templates",
                    path: "/templates/form-templates",
                    icon: FiClipboard,
                },
                {
                    title: "WhatsApp Templates",
                    path: "/templates/whatsapp",
                    icon: FiMessageCircle,
                },
            ]
        },
        {
            title: "WhatsApp Automation",
            icon: FiMessageCircle,
            isWhatsapp: true,
            isDropdown: true,
            children: [
                {
                    title: "Dashboard",
                    path: "/whatsapp/dashboard",
                    icon: FiGrid,
                },
                {
                    title: "Campaigns",
                    path: "/whatsapp/campaigns",
                    icon: FiSend,
                },
                {
                    title: "Bulk Messaging",
                    path: "/whatsapp/bulk-send",
                    icon: FiPlusSquare,
                },
                {
                    title: "Inbox",
                    path: "/whatsapp/inbox",
                    icon: FiMessageCircle,
                },
                {
                    title: "Templates",
                    path: "/whatsapp/templates",
                    icon: FiFileText,
                },
                {
                    title: "Template Insights",
                    path: "/whatsapp/templates/insights",
                    icon: FiBarChart2,
                },
                {
                    title: "Contacts",
                    path: "/whatsapp/contacts",
                    icon: FiUsers,
                },
                {
                    title: "Global DND List",
                    path: "/whatsapp/dnd",
                    icon: FiSlash,
                },
                {
                    title: "Automation",
                    path: "/whatsapp/automation",
                    icon: FiZap,
                },
                {
                    title: "Reports",
                    path: "/whatsapp/reports",
                    icon: FiBarChart2,
                },
                {
                    title: "Logs",
                    path: "/whatsapp/logs",
                    icon: FiClipboard,
                },
                {
                    title: "Settings",
                    path: "/whatsapp/settings",
                    icon: FiSettings,
                },
            ]
        },
        {
            title: "Settings",
            icon: FiSettings,
            isDropdown: true,
            children: [
                {
                    title: "User Management",
                    path: "/settings/users",
                    icon: FiUsers,
                },
            ]
        }
    ];

    const isActive = (path) => {
        if (path === "/") return location.pathname === "/";
        if (path === "/employees") return location.pathname === "/employees";
        return location.pathname.startsWith(path);
    };

    const getDropdownOpen = (title) => {
        if (title === "Delegation") return isDelegationOpen;
        if (title === "CRM") return isCrmOpen;
        if (title === "Employees") return isEmployeesOpen;
        if (title === "Settings") return isSettingsOpen;
        if (title === "Templates") return isTemplatesOpen;
        if (title === "WhatsApp Automation") return isWhatsappOpen;
        return false;
    };

    const handleDropdownToggle = (title) => {
        if (title === "Delegation") setIsDelegationOpen(v => !v);
        else if (title === "CRM") setIsCrmOpen(v => !v);
        else if (title === "Employees") setIsEmployeesOpen(v => !v);
        else if (title === "Settings") setIsSettingsOpen(v => !v);
        else if (title === "Templates") setIsTemplatesOpen(v => !v);
        else if (title === "WhatsApp Automation") setIsWhatsappOpen(v => !v);
    };

    return (
        <div
            className={`fixed inset-y-0 left-0 z-40 bg-slate-950 border-r border-slate-900 text-slate-400 transition-all duration-300 ease-in-out flex flex-col ${isCollapsed ? "w-20" : "w-64"
                }`}
        >
            {/* Header / Logo */}
            <div className="h-16 flex items-center justify-between px-4 border-b border-slate-900">
                {!isCollapsed && (
                    <div className="flex items-center gap-2.5 animate-fade-in pl-1">
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-500 to-indigo-600 flex items-center justify-center text-white font-bold text-base shadow-lg shadow-indigo-500/20">
                            D
                        </div>
                        <div>
                            <span className="font-display font-bold text-sm tracking-tight text-white leading-none block">DelegateX</span>
                            <p className="text-[9px] text-slate-500 font-semibold uppercase tracking-wider">Enterprise Console</p>
                        </div>
                    </div>
                )}
                {isCollapsed && (
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-500 to-indigo-600 flex items-center justify-center text-white font-bold text-base mx-auto shadow-lg shadow-indigo-500/20">
                        D
                    </div>
                )}

                {/* Collapse Button (Only Desktop) */}
                {!isCollapsed && (
                    <button
                        onClick={() => setIsCollapsed(!isCollapsed)}
                        className="hidden md:flex p-1.5 rounded-lg border border-slate-800 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white transition duration-200"
                    >
                        <FiChevronLeft size={13} />
                    </button>
                )}
                {isCollapsed && (
                    <button
                        onClick={() => setIsCollapsed(!isCollapsed)}
                        className="hidden md:flex p-1.5 rounded-lg border border-slate-800 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white transition duration-200 mx-auto"
                    >
                        <FiChevronRight size={13} />
                    </button>
                )}
            </div>

            {/* Menu Items */}
            <div className="flex-1 py-6 px-3 space-y-1.5 overflow-y-auto">
                {menuItems.map((item, index) => {
                    if (item.isDropdown) {
                        const Icon = item.icon;
                        const hasActiveChild = item.children.some(child => isActive(child.path));
                        const isOpen = getDropdownOpen(item.title);
                        const handleToggle = () => handleDropdownToggle(item.title);
                        return (
                            <div key={index} className="space-y-1">
                                <button
                                    onClick={handleToggle}
                                    className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl transition-all duration-200 group relative cursor-pointer text-left focus:outline-none ${hasActiveChild
                                        ? "text-white font-semibold bg-slate-900/20"
                                        : "hover:bg-slate-900/60 hover:text-slate-200 text-slate-400"
                                        }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <Icon size={16} className={hasActiveChild ? "text-indigo-400" : "text-slate-500 group-hover:text-slate-300 transition"} />
                                        {!isCollapsed && (
                                            <span className="text-xs font-medium tracking-wide font-sans">{item.title}</span>
                                        )}
                                    </div>

                                    {!isCollapsed && (
                                        <FiChevronDown
                                            size={14}
                                            className={`text-slate-500 transition-transform duration-200 ${isOpen ? "rotate-180" : ""
                                                }`}
                                        />
                                    )}

                                    {/* Tooltip for collapsed state */}
                                    {isCollapsed && (
                                        <div className="absolute left-full ml-4 px-2.5 py-1.5 bg-slate-950 text-white text-[10px] font-bold rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition duration-200 shadow-xl border border-slate-900 whitespace-nowrap z-50">
                                            {item.title}
                                        </div>
                                    )}
                                </button>

                                {/* Child Items Submenu - Indented with smaller spacing and height transition */}
                                <div
                                    className={`transition-all duration-300 ease-in-out overflow-hidden space-y-1 ${isOpen ? "max-h-[1000px] opacity-100" : "max-h-0 opacity-0 pointer-events-none"
                                        }`}
                                >
                                    {item.children.map((child, cIdx) => {
                                        const ChildIcon = child.icon;
                                        const childActive = isActive(child.path);
                                        return (
                                            <Link
                                                key={cIdx}
                                                to={child.path}
                                                onClick={() => onClose && onClose()}
                                                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all duration-200 group relative ${isCollapsed ? "" : "pl-8"
                                                    } ${childActive
                                                        ? item.isWhatsapp
                                                            ? "bg-emerald-950/40 text-white font-medium border-l-2 border-[#25D366] rounded-l-none"
                                                            : "bg-slate-900 text-white font-medium border-l-2 border-indigo-500 rounded-l-none"
                                                        : "hover:bg-slate-900/40 hover:text-slate-200 text-slate-400"
                                                    }`}
                                            >
                                                <ChildIcon size={14} className={childActive ? (item.isWhatsapp ? "text-[#25D366]" : "text-indigo-400") : "text-slate-500 group-hover:text-slate-350 transition"} />

                                                {!isCollapsed && (
                                                    <span className="text-[11px] font-medium tracking-wide font-sans">{child.title}</span>
                                                )}

                                                {/* Tooltip for collapsed state */}
                                                {isCollapsed && (
                                                    <div className="absolute left-full ml-4 px-2.5 py-1.5 bg-slate-950 text-white text-[10px] font-bold rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition duration-200 shadow-xl border border-slate-900 whitespace-nowrap z-50">
                                                        {child.title}
                                                    </div>
                                                )}
                                            </Link>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    }

                    const Icon = item.icon;
                    const active = isActive(item.path);
                    return (
                        <Link
                            key={index}
                            to={item.path}
                            onClick={() => onClose && onClose()}
                            className={`flex items-center gap-3 px-3.5 py-3 rounded-xl transition-all duration-200 group relative ${active
                                ? "bg-slate-900 text-white font-medium border-l-2 border-indigo-500 rounded-l-none"
                                : "hover:bg-slate-900/60 hover:text-slate-200"
                                }`}
                        >
                            <Icon size={16} className={active ? "text-indigo-400" : "text-slate-500 group-hover:text-slate-300 transition"} />

                            {!isCollapsed && (
                                <span className="text-xs font-medium tracking-wide font-sans">{item.title}</span>
                            )}

                            {/* Tooltip for collapsed state */}
                            {isCollapsed && (
                                <div className="absolute left-full ml-4 px-2.5 py-1.5 bg-slate-950 text-white text-[10px] font-bold rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition duration-200 shadow-xl border border-slate-900 whitespace-nowrap z-50">
                                    {item.title}
                                </div>
                            )}
                        </Link>
                    );
                })}
            </div>

            {/* Footer / User Profile Summary */}
            <div className="p-4 border-t border-slate-900 flex items-center justify-center">
                {!isCollapsed ? (
                    <div className="flex items-center gap-3 w-full bg-slate-900/40 p-2 rounded-xl border border-slate-900/50">
                        <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 font-bold font-display text-xs">
                            AD
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-[11px] font-semibold text-slate-200 truncate">Admin User</p>
                            <p className="text-[9px] text-slate-600 truncate">admin@delegatex.com</p>
                        </div>
                    </div>
                ) : (
                    <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 font-bold font-display text-xs">
                        AD
                    </div>
                )}
            </div>
        </div>
    );
}

export default Sidebar;