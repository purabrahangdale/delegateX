import { useState, useRef, useEffect } from "react";
import { useLocation, Link, useNavigate } from "react-router-dom";
import { FiBell, FiSearch, FiChevronDown, FiUser, FiSettings, FiLogOut, FiMenu, FiX, FiBriefcase, FiUsers, FiCheckSquare, FiAlertCircle } from "react-icons/fi";
import { getEmployees } from "../services/employeeApi";
import { getProjects } from "../services/projectApi";
import { getTasks } from "../services/taskApi";
import { useWebSockets } from "../context/WebSocketContext";


function Navbar({ onToggleMobileMenu }) {
    const location = useLocation();
    const navigate = useNavigate();
    const [searchQuery, setSearchQuery] = useState("");
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [searchResults, setSearchResults] = useState({ employees: [], projects: [], tasks: [] });
    const [allData, setAllData] = useState({ employees: [], projects: [], tasks: [] });
    const [showNotifications, setShowNotifications] = useState(false);
    const [showProfileMenu, setShowProfileMenu] = useState(false);

    const {
        notifications,
        isLoadingNotifications,
        unreadCount,
        markNotificationAsRead,
        markAllNotificationsAsRead,
        deleteNotification
    } = useWebSockets();


    const notifRef = useRef(null);
    const profileRef = useRef(null);

    // Dynamic breadcrumbs clickable links
    const getBreadcrumbs = () => {
        const path = location.pathname;
        if (path.startsWith("/crm") || path.startsWith("/settings")) return [];
        if (path === "/") return [{ label: "Workspace", path: "/" }, { label: "Dashboard", path: "/" }];
        const segments = path.split("/").filter(Boolean);
        return [
            { label: "Workspace", path: "/" },
            ...segments.map((s, idx) => ({
                label: s.charAt(0).toUpperCase() + s.slice(1),
                path: "/" + segments.slice(0, idx + 1).join("/")
            }))
        ];
    };

    const breadcrumbs = getBreadcrumbs();

    // Fetch all resources on search open
    const fetchSearchData = async () => {
        try {
            const [empRes, projRes, taskRes] = await Promise.all([
                getEmployees(),
                getProjects(),
                getTasks()
            ]);
            setAllData({
                employees: Array.isArray(empRes) ? empRes : (empRes?.data || []),
                projects: projRes.data || [],
                tasks: taskRes.data || []
            });
        } catch (err) {
            console.error("Failed to load search context resources", err);
        }
    };

    useEffect(() => {
        if (isSearchOpen) {
            fetchSearchData();
        }
    }, [isSearchOpen]);

    // Handle search filtering
    useEffect(() => {
        if (!searchQuery.trim()) {
            setSearchResults({ employees: [], projects: [], tasks: [] });
            return;
        }

        const query = searchQuery.toLowerCase();
        const filteredEmployees = allData.employees.filter(e => e.name.toLowerCase().includes(query) || e.role.toLowerCase().includes(query));
        const filteredProjects = allData.projects.filter(p => p.name.toLowerCase().includes(query) || (p.description && p.description.toLowerCase().includes(query)));
        const filteredTasks = allData.tasks.filter(t => t.title.toLowerCase().includes(query) || (t.description && t.description.toLowerCase().includes(query)));

        setSearchResults({
            employees: filteredEmployees,
            projects: filteredProjects,
            tasks: filteredTasks
        });
    }, [searchQuery, allData]);

    // Hotkey listener (Cmd/Ctrl + K)
    useEffect(() => {
        const handleKeyDown = (e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "k") {
                e.preventDefault();
                setIsSearchOpen((prev) => !prev);
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, []);

    // Close menus on click outside
    useEffect(() => {
        function handleClickOutside(event) {
            if (notifRef.current && !notifRef.current.contains(event.target)) {
                setShowNotifications(false);
            }
            if (profileRef.current && !profileRef.current.contains(event.target)) {
                setShowProfileMenu(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const markAllRead = () => {
        markAllNotificationsAsRead();
    };

    const clearNotification = (id) => {
        deleteNotification(id);
    };

    const handleSearchItemClick = (path) => {
        setIsSearchOpen(false);
        setSearchQuery("");
        navigate(path);
    };

    return (
        <>
            <header className="h-16 border-b border-slate-200/80 bg-white/80 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-30">
                {/* Left section: Mobile Toggle & Breadcrumbs */}
                <div className="flex items-center gap-4">
                    <button
                        onClick={onToggleMobileMenu}
                        className="md:hidden p-2 rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition"
                    >
                        <FiMenu size={20} />
                    </button>

                    {/* Breadcrumbs */}
                    <nav className="hidden sm:flex items-center gap-2 text-xs">
                        {breadcrumbs.map((crumb, idx) => (
                            <div key={idx} className="flex items-center gap-2">
                                {idx > 0 && <span className="text-slate-300">/</span>}
                                <Link
                                    to={crumb.path}
                                    className={`transition-colors font-sans py-1 px-1.5 rounded-lg ${
                                        idx === breadcrumbs.length - 1
                                            ? "font-semibold text-slate-900 font-display pointer-events-none"
                                            : "text-slate-400 hover:text-slate-700 hover:bg-slate-100/50"
                                    }`}
                                >
                                    {crumb.label}
                                </Link>
                            </div>
                        ))}
                    </nav>
                </div>

                {/* Right section: Search button, Notifications, Profile */}
                <div className="flex items-center gap-1.5 sm:gap-3">
                    {/* Search trigger (Cmd+K design) */}
                    <button
                        onClick={() => setIsSearchOpen(true)}
                        className="flex items-center gap-2.5 px-2.5 sm:px-3 py-2 border border-slate-200 hover:border-slate-300 bg-slate-50/50 hover:bg-slate-50 text-slate-400 hover:text-slate-600 rounded-xl transition text-left text-xs cursor-pointer w-auto sm:w-56"
                    >
                        <FiSearch size={14} />
                        <span className="hidden sm:inline flex-1 text-[11px] font-sans">Search workspace...</span>
                        <kbd className="hidden sm:inline-flex items-center bg-white px-1.5 py-0.5 border border-slate-200 text-[9px] font-bold text-slate-400 rounded-md font-sans shadow-sm select-none">
                            Ctrl K
                        </kbd>
                    </button>

                    {/* Notifications Widget */}
                    <div className="relative" ref={notifRef}>
                        <button
                            onClick={() => setShowNotifications(!showNotifications)}
                            className={`p-2.5 rounded-xl border transition relative cursor-pointer ${
                                showNotifications 
                                    ? "bg-slate-100 border-slate-300 text-slate-800" 
                                    : "border-slate-200 bg-white hover:bg-slate-50 text-slate-500 hover:text-slate-800"
                            }`}
                        >
                            <FiBell size={16} />
                            {unreadCount > 0 && (
                                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-indigo-600 rounded-full ring-2 ring-white"></span>
                            )}
                        </button>

                        {showNotifications && (
                            <div className="absolute right-0 mt-2 w-80 bg-white border border-slate-200 rounded-2xl shadow-xl py-2 z-50 animate-slide-up">
                                <div className="px-4 py-2 border-b border-slate-100 flex justify-between items-center">
                                    <span className="font-semibold text-slate-900 text-xs font-display">Activity feed</span>
                                    {unreadCount > 0 && (
                                        <span className="text-[9px] bg-indigo-50 text-indigo-600 font-bold px-2 py-0.5 rounded-full">
                                            {unreadCount} New
                                        </span>
                                    )}
                                </div>
                                <div className="max-h-64 overflow-y-auto py-1 divide-y divide-slate-50">
                                    {isLoadingNotifications ? (
                                        Array.from({ length: 3 }).map((_, i) => (
                                            <div key={i} className="px-4 py-3 flex flex-col gap-2 animate-pulse">
                                                <div className="h-3 w-24 bg-slate-200 rounded"></div>
                                                <div className="h-3 w-48 bg-slate-200 rounded"></div>
                                                <div className="h-2.5 w-16 bg-slate-100 rounded"></div>
                                            </div>
                                        ))
                                    ) : notifications.length > 0 ? (
                                        notifications.map((n) => (
                                            <div
                                                key={n._id}
                                                className={`px-4 py-2.5 hover:bg-slate-50 flex items-start justify-between gap-2 transition ${
                                                    !n.read ? "bg-indigo-50/10" : ""
                                                }`}
                                            >
                                                <div className="flex flex-col gap-0.5 max-w-[90%] font-sans">
                                                    <p className="text-xs font-bold text-slate-800 leading-snug">{n.title}</p>
                                                    <p className="text-xs text-slate-600 leading-snug">{n.message}</p>
                                                    <span className="text-[9px] text-slate-400 font-medium">
                                                        {n.timestamp ? new Date(n.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "Just now"}
                                                    </span>
                                                </div>
                                                <button
                                                    onClick={() => clearNotification(n._id)}
                                                    className="p-0.5 rounded hover:bg-slate-100 text-slate-300 hover:text-slate-500 transition cursor-pointer"
                                                >
                                                    <FiX size={12} />
                                                </button>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="py-8 text-center text-slate-400 text-xs flex flex-col items-center gap-1.5">
                                            <FiBell size={18} className="text-slate-300" />
                                            <span>No active notifications.</span>
                                        </div>
                                    )}
                                </div>
                                {notifications.length > 0 && (
                                    <div className="px-4 py-1.5 border-t border-slate-100 text-center">
                                        <button 
                                            onClick={markAllRead}
                                            className="text-[10px] text-indigo-600 hover:text-indigo-800 font-bold tracking-wide transition cursor-pointer"
                                        >
                                            Mark all as read
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Profile Widget */}
                    <div className="relative" ref={profileRef}>
                        <button
                            onClick={() => setShowProfileMenu(!showProfileMenu)}
                            className={`flex items-center gap-2 p-1 pr-2.5 rounded-xl border transition cursor-pointer ${
                                showProfileMenu 
                                    ? "bg-slate-100 border-slate-300 text-slate-800" 
                                    : "border-slate-200 bg-white hover:bg-slate-50"
                            }`}
                        >
                            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold font-display text-xs shadow-sm">
                                AD
                            </div>
                            <div className="hidden lg:flex flex-col items-start text-left">
                                <span className="text-xs font-semibold text-slate-900 leading-tight">Admin User</span>
                                <span className="text-[9px] text-slate-400 font-medium">Owner</span>
                            </div>
                            <FiChevronDown size={12} className="text-slate-400" />
                        </button>

                        {showProfileMenu && (
                            <div className="absolute right-0 mt-2 w-48 bg-white border border-slate-200 rounded-2xl shadow-xl py-1.5 z-50 animate-slide-up">
                                <div className="px-4 py-2 border-b border-slate-100">
                                    <p className="text-xs font-semibold text-slate-800">Admin User</p>
                                    <p className="text-[9px] text-slate-400 truncate">admin@delegatex.com</p>
                                </div>
                                <div className="py-1">
                                    <button 
                                        onClick={() => { setShowProfileMenu(false); navigate('/employees'); }}
                                        className="w-full text-left px-4 py-2 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2 transition cursor-pointer"
                                    >
                                        <FiUser size={13} className="text-slate-400" />
                                        Team Directory
                                    </button>
                                    <button 
                                        onClick={() => { setShowProfileMenu(false); navigate('/projects'); }}
                                        className="w-full text-left px-4 py-2 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2 transition cursor-pointer"
                                    >
                                        <FiSettings size={13} className="text-slate-400" />
                                        Projects Dashboard
                                    </button>
                                </div>
                                <div className="border-t border-slate-100 pt-1">
                                    <button className="w-full text-left px-4 py-2 text-xs text-rose-600 hover:bg-rose-50 flex items-center gap-2 transition font-medium cursor-pointer">
                                        <FiLogOut size={13} className="text-rose-400" />
                                        Sign Out
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </header>

            {/* Global command palette search modal */}
            {isSearchOpen && (
                <div className="fixed inset-0 z-55 overflow-hidden flex items-start justify-center pt-24 p-4">
                    {/* Backdrop */}
                    <div 
                        className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity"
                        onClick={() => setIsSearchOpen(false)}
                    ></div>

                    {/* Spotlight Command Box */}
                    <div className="relative bg-white border border-slate-200 w-full max-w-xl rounded-2xl shadow-2xl flex flex-col z-10 animate-slide-up overflow-hidden">
                        <div className="p-4 border-b border-slate-100 flex items-center gap-3">
                            <FiSearch className="text-slate-400" size={18} />
                            <input
                                type="text"
                                placeholder="Search tasks, team members, or project boards..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="flex-1 bg-transparent text-slate-800 text-xs outline-none border-none placeholder-slate-400 font-sans"
                                autoFocus
                            />
                            <button
                                onClick={() => setIsSearchOpen(false)}
                                className="p-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-500 transition text-[10px] font-bold font-sans cursor-pointer"
                            >
                                ESC
                            </button>
                        </div>

                        {/* Search Results Display */}
                        <div className="max-h-96 overflow-y-auto p-2">
                            {!searchQuery.trim() ? (
                                <div className="p-8 text-center text-slate-400 text-xs flex flex-col items-center justify-center gap-2">
                                    <FiSearch size={24} className="text-slate-300 animate-pulse" />
                                    <span>Type query keywords or press Esc to dismiss command.</span>
                                </div>
                            ) : (searchResults.employees.length === 0 && searchResults.projects.length === 0 && searchResults.tasks.length === 0) ? (
                                <div className="p-8 text-center text-slate-400 text-xs flex flex-col items-center justify-center gap-2">
                                    <FiAlertCircle size={24} className="text-slate-300" />
                                    <span>No matching items found in directory tags.</span>
                                </div>
                            ) : (
                                <div className="space-y-4 p-2">
                                    {/* Employees Results */}
                                    {searchResults.employees.length > 0 && (
                                        <div>
                                            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider px-2 block mb-1">Team Directory</span>
                                            <div className="space-y-0.5">
                                                {searchResults.employees.map(e => (
                                                    <button
                                                        key={e._id}
                                                        onClick={() => handleSearchItemClick('/employees')}
                                                        className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-slate-50 text-left transition cursor-pointer text-xs"
                                                    >
                                                        <div className="w-7 h-7 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center font-bold">
                                                            <FiUsers size={12} />
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="font-semibold text-slate-800 truncate">{e.name}</p>
                                                            <p className="text-[10px] text-slate-400 truncate">{e.role}</p>
                                                        </div>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Projects Results */}
                                    {searchResults.projects.length > 0 && (
                                        <div>
                                            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider px-2 block mb-1">Projects Registry</span>
                                            <div className="space-y-0.5">
                                                {searchResults.projects.map(p => (
                                                    <button
                                                        key={p._id}
                                                        onClick={() => handleSearchItemClick('/projects')}
                                                        className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-slate-50 text-left transition cursor-pointer text-xs"
                                                    >
                                                        <div className="w-7 h-7 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center font-bold">
                                                            <FiBriefcase size={12} />
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="font-semibold text-slate-800 truncate">{p.name}</p>
                                                            <p className="text-[10px] text-slate-400 truncate">{p.status}</p>
                                                        </div>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Tasks Results */}
                                    {searchResults.tasks.length > 0 && (
                                        <div>
                                            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider px-2 block mb-1">Delegated Tasks</span>
                                            <div className="space-y-0.5">
                                                {searchResults.tasks.map(t => (
                                                    <button
                                                        key={t._id}
                                                        onClick={() => handleSearchItemClick('/tasks')}
                                                        className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-slate-50 text-left transition cursor-pointer text-xs"
                                                    >
                                                        <div className="w-7 h-7 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center font-bold">
                                                            <FiCheckSquare size={12} />
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="font-semibold text-slate-800 truncate">{t.title}</p>
                                                            <p className="text-[10px] text-slate-400 truncate">{t.employee} &bull; {t.status}</p>
                                                        </div>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

export default Navbar;