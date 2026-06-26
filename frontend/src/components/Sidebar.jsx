import { Link, useLocation } from "react-router-dom";
import { FiPieChart, FiUsers, FiBriefcase, FiCheckSquare, FiChevronLeft, FiChevronRight } from "react-icons/fi";

function Sidebar({ isCollapsed, setIsCollapsed }) {
    const location = useLocation();

    const menuItems = [
        {
            title: "Dashboard",
            path: "/",
            icon: FiPieChart,
        },
        {
            title: "Employees",
            path: "/employees",
            icon: FiUsers,
        },
        {
            title: "Projects",
            path: "/projects",
            icon: FiBriefcase,
        },
        {
            title: "Tasks",
            path: "/tasks",
            icon: FiCheckSquare,
        },
    ];

    const isActive = (path) => {
        if (path === "/") {
            return location.pathname === "/";
        }
        return location.pathname.startsWith(path);
    };

    return (
        <div 
            className={`fixed inset-y-0 left-0 z-40 bg-slate-950 border-r border-slate-900 text-slate-400 transition-all duration-300 ease-in-out flex flex-col ${
                isCollapsed ? "w-20" : "w-64"
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
                    const Icon = item.icon;
                    const active = isActive(item.path);
                    return (
                        <Link
                            key={index}
                            to={item.path}
                            className={`flex items-center gap-3 px-3.5 py-3 rounded-xl transition-all duration-200 group relative ${
                                active
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
