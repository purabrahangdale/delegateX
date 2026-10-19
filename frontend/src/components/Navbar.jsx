import { useState, useRef, useEffect } from "react";
import { useLocation, Link } from "react-router-dom";
import { FiBell, FiChevronDown, FiLogOut, FiMenu, FiX } from "react-icons/fi";
import { useWebSockets } from "../context/WebSocketContext";


function Navbar({ onToggleMobileMenu }) {
    const location = useLocation();
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

        </>
    );
}

export default Navbar;