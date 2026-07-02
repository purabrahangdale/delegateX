import { useState } from "react";
import { 
    FiUser, FiMail, FiPlus, FiSearch, FiSliders, FiUsers, 
    FiCheckCircle, FiXCircle, FiRefreshCw, FiChevronDown, FiX, FiCheck 
} from "react-icons/fi";
import { useToast } from "../context/ToastContext";

export default function UserManagement() {
    const { showToast } = useToast();

    // Mock initial user management database
    const [users, setUsers] = useState([
        { id: 1, name: "Kunal Sen", email: "kunal.sen@enterprise.com", role: "Supervisor", status: "Active" },
        { id: 2, name: "Deepak Verma", email: "deepak.v@corporate.in", role: "Managing Director", status: "Active" },
        { id: 3, name: "Rohan Deshmukh", email: "rohan.deshmukh@analytics.com", role: "Designer", status: "Active" },
        { id: 4, name: "Ananya Patel", email: "ananya.patel@designstudio.dev", role: "Designer", status: "Active" },
        { id: 5, name: "Vikram Malhotra", email: "vikram.m@malhotra.co", role: "Supervisor", status: "Active" },
        { id: 6, name: "Sneha Patil", email: "sneha.patil@yahoo.in", role: "Developer", status: "Active" },
        { id: 7, name: "Kabir Joshi", email: "kabir.j@hotmail.com", role: "Supervisor", status: "Inactive" },
        { id: 8, name: "Ishita Sharma", email: "ishita.s@yahoo.com", role: "Developer", status: "Active" },
        { id: 9, name: "Arjun Verma", email: "arjun.v@gmail.com", role: "Designer", status: "Active" },
        { id: 10, name: "Priya Kulkarni", email: "priya.k@yahoo.com", role: "Developer", status: "Active" },
        { id: 11, name: "Aarav Mehta", email: "aarav.mehta@gmail.com", role: "Supervisor", status: "Active" }
    ]);

    // Accordion / Collapsible state
    const [isAddOpen, setIsAddOpen] = useState(false);

    // Form inputs state
    const [formData, setFormData] = useState({
        name: "",
        email: "",
        role: "Developer",
        status: "Active"
    });

    const [emailError, setEmailError] = useState("");

    const validateEmail = (email) => {
        if (!email) return "Email is required.";
        const re = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        if (!re.test(email)) {
            return "Please enter a valid email address.";
        }
        return "";
    };

    // Filters and controls state
    const [searchQuery, setSearchQuery] = useState("");
    const [roleFilter, setRoleFilter] = useState("All Roles");
    const [statusFilter, setStatusFilter] = useState("All"); // "All" | "Active" | "Inactive"

    // Roles and styling maps
    const roles = ["Developer", "Supervisor", "Designer", "Managing Director", "Administrator"];
    const roleColors = {
        "Supervisor": "bg-amber-50 text-amber-700 border-amber-100/60",
        "Managing Director": "bg-indigo-50 text-indigo-700 border-indigo-100/60",
        "Designer": "bg-purple-50 text-purple-700 border-purple-100/60",
        "Developer": "bg-slate-50 text-slate-700 border-slate-200/80",
        "Administrator": "bg-rose-50 text-rose-700 border-rose-100/60"
    };

    // Submits new user registration
    const handleRegister = (e) => {
        e.preventDefault();
        if (!formData.name.trim() || !formData.email.trim()) {
            showToast("Please fill in all required fields.", "error");
            return;
        }
        const error = validateEmail(formData.email);
        if (error) {
            setEmailError(error);
            showToast(error, "error");
            return;
        }

        const newUser = {
            id: Date.now(),
            name: formData.name,
            email: formData.email,
            role: formData.role,
            status: formData.status
        };

        setUsers([newUser, ...users]);
        setFormData({ name: "", email: "", role: "Developer", status: "Active" });
        setIsAddOpen(false);
        showToast(`User ${newUser.name} registered successfully.`, "success");
    };

    // Filters result list
    const filteredUsers = users.filter((u) => {
        const matchesSearch = u.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                             u.email.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesRole = roleFilter === "All Roles" || u.role === roleFilter;
        const matchesStatus = statusFilter === "All" || u.status === statusFilter;

        return matchesSearch && matchesRole && matchesStatus;
    });

    const activeCount = users.filter(u => u.status === "Active").length;

    return (
        <div className="w-full max-w-none px-4 md:px-6 py-4 space-y-6 animate-fade-in font-sans">
            
            {/* Page Title Header */}
            <div className="pb-4 border-b border-slate-100/50">
                <h1 className="text-2xl font-bold font-display text-slate-900 tracking-tight">User Management</h1>
                <p className="text-slate-500 text-xs mt-0.5 leading-relaxed">
                    Create accounts, assign roles, and manage team access.
                </p>
            </div>

            {/* Metrics Counters Row */}
            <div className="flex items-center gap-2">
                <span className="flex items-center gap-1.5 bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-xl text-slate-700 text-xs font-bold font-sans">
                    {users.length} Total
                </span>
                <span className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-100 px-3 py-1.5 rounded-xl text-emerald-700 text-xs font-bold font-sans">
                    {activeCount} Active
                </span>
            </div>

            {/* Accordion Card: Add New User */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden transition-all duration-350">
                {/* Accordion Toggle Header */}
                <button
                    type="button"
                    onClick={() => setIsAddOpen(!isAddOpen)}
                    className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-50/50 transition cursor-pointer text-left border-0 bg-transparent focus:outline-none"
                >
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-100/50 flex items-center justify-center text-indigo-650 shrink-0">
                            <FiPlus size={16} />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-slate-800 font-display">Add New User</h3>
                            <p className="text-[10px] text-slate-450 mt-0.5">Register a new team member</p>
                        </div>
                    </div>
                    <FiChevronDown 
                        size={18} 
                        className={`text-slate-400 transition-transform duration-200 ${isAddOpen ? "rotate-180" : ""}`} 
                    />
                </button>

                {/* Collapsible Form Body */}
                {isAddOpen && (
                    <div className="px-6 pb-6 pt-2 border-t border-slate-100/80 animate-slide-up">
                        <form onSubmit={handleRegister} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1.5 font-sans">
                                    Full Name <span className="text-rose-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    required
                                    placeholder="Enter full name"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full h-10 rounded-xl border border-slate-200 bg-white px-3.5 text-xs text-slate-800 focus:outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100/50 transition-all font-sans"
                                />
                            </div>

                            <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1.5 font-sans">
                                    Email Address <span className="text-rose-500">*</span>
                                </label>
                                <input
                                    type="email"
                                    required
                                    placeholder="name@company.com"
                                    value={formData.email}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        setFormData({ ...formData, email: val });
                                        setEmailError(validateEmail(val));
                                    }}
                                    className={`w-full h-10 rounded-xl border bg-white px-3.5 text-xs text-slate-800 focus:outline-none focus:ring-4 transition-all font-sans ${
                                        emailError
                                            ? "border-rose-500 focus:border-rose-500 focus:ring-rose-100/50"
                                            : "border-slate-200 focus:border-indigo-400 focus:ring-indigo-100/50"
                                    }`}
                                />
                                {emailError && (
                                    <p className="text-[10px] text-rose-500 font-semibold mt-1 pl-1">{emailError}</p>
                                )}
                            </div>

                            <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1.5 font-sans">
                                    System Role
                                </label>
                                <div className="relative">
                                    <select
                                        value={formData.role}
                                        onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                                        className="w-full h-10 appearance-none bg-white border border-slate-200 text-slate-705 text-xs font-semibold px-3.5 pr-9 rounded-xl focus:outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100/50 transition-all cursor-pointer"
                                    >
                                        {roles.map((r, i) => (
                                            <option key={i} value={r}>{r}</option>
                                        ))}
                                    </select>
                                    <FiChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
                                </div>
                            </div>

                            <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1.5 font-sans">
                                    Account Status
                                </label>
                                <div className="relative">
                                    <select
                                        value={formData.status}
                                        onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                                        className="w-full h-10 appearance-none bg-white border border-slate-200 text-slate-705 text-xs font-semibold px-3.5 pr-9 rounded-xl focus:outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100/50 transition-all cursor-pointer"
                                    >
                                        <option value="Active">Active</option>
                                        <option value="Inactive">Inactive</option>
                                    </select>
                                    <FiChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
                                </div>
                            </div>

                            <div className="md:col-span-2 flex justify-end gap-2.5 pt-2 border-t border-slate-100 mt-2">
                                <button
                                    type="button"
                                    onClick={() => setIsAddOpen(false)}
                                    className="h-10 px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="h-10 px-6 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-md shadow-indigo-600/10 transition cursor-pointer border-0"
                                >
                                    Add Member
                                </button>
                            </div>
                        </form>
                    </div>
                )}
            </div>

            {/* List Card panel: Team Members */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden flex flex-col">
                {/* Panel Header */}
                <div className="px-6 py-4 flex items-center justify-between border-b border-slate-100 bg-slate-50/50">
                    <div className="flex items-center gap-2">
                        <FiUsers className="text-slate-450" size={16} />
                        <h3 className="text-sm font-bold text-slate-800 font-display">Team Members</h3>
                        <span className="text-[10px] font-bold text-slate-500 bg-slate-200 px-2 py-0.5 rounded-full">
                            {filteredUsers.length}
                        </span>
                    </div>
                    <button
                        type="button"
                        onClick={() => showToast("Refreshed user directory.", "success")}
                        className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-450 hover:text-slate-700 transition cursor-pointer border-0 bg-transparent"
                        title="Refresh Directory"
                    >
                        <FiRefreshCw size={14} />
                    </button>
                </div>

                {/* Filter and Control Toolbar */}
                <div className="p-4 border-b border-slate-100 bg-slate-50/20 flex flex-col sm:flex-row items-center gap-3">
                    {/* Search bar */}
                    <div className="relative flex-1 w-full">
                        <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                            <FiSearch size={14} />
                        </span>
                        <input
                            type="text"
                            placeholder="Search by name or email..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-4 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100/50 transition-all font-sans h-10 shadow-sm"
                        />
                    </div>

                    {/* Filters: Role Selector */}
                    <div className="relative min-w-[150px] w-full sm:w-auto">
                        <select
                            value={roleFilter}
                            onChange={(e) => setRoleFilter(e.target.value)}
                            className="w-full h-10 appearance-none bg-white border border-slate-200 text-slate-705 text-xs font-semibold px-4 pr-9 rounded-xl focus:outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100/50 transition-all cursor-pointer shadow-sm"
                        >
                            <option value="All Roles">All Roles</option>
                            {roles.map((r, i) => (
                                <option key={i} value={r}>{r}</option>
                            ))}
                        </select>
                        <FiChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
                    </div>

                    {/* Segmented Controls: Status Filter */}
                    <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200/80 shadow-sm w-full sm:w-auto shrink-0">
                        {["All", "Active", "Inactive"].map((status) => (
                            <button
                                key={status}
                                type="button"
                                onClick={() => setStatusFilter(status)}
                                className={`flex-1 sm:flex-none px-4 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer border-0 bg-transparent ${statusFilter === status
                                    ? "bg-white text-indigo-600 shadow-sm"
                                    : "text-slate-500 hover:text-slate-800"
                                    }`}
                            >
                                {status}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Team Members List */}
                <div className="divide-y divide-slate-100 max-h-[480px] overflow-y-auto">
                    {filteredUsers.length > 0 ? (
                        filteredUsers.map((user) => {
                            const initials = user.name.split(" ").map(n => n[0]).join("").toUpperCase();
                            const isInactive = user.status === "Inactive";
                            return (
                                <div 
                                    key={user.id} 
                                    className={`flex items-center justify-between p-4 transition duration-150 hover:bg-slate-50/40 ${isInactive ? "opacity-75" : ""}`}
                                >
                                    {/* Left: Avatar & Text */}
                                    <div className="flex items-center gap-3.5 min-w-0">
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs shrink-0 border ${
                                            isInactive 
                                                ? "bg-slate-100 border-slate-200 text-slate-400" 
                                                : "bg-indigo-50 border-indigo-100 text-indigo-700"
                                        }`}>
                                            {initials}
                                        </div>
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                <span className="font-extrabold text-slate-800 text-xs tracking-tight">{user.name}</span>
                                                {user.status === "Active" ? (
                                                    <FiCheckCircle size={12} className="text-emerald-500 shrink-0" title="Active Account" />
                                                ) : (
                                                    <FiXCircle size={12} className="text-rose-400 shrink-0" title="Inactive Account" />
                                                )}
                                            </div>
                                            <span className="text-[10px] text-slate-450 font-medium block truncate max-w-[200px] sm:max-w-none font-sans mt-0.5">
                                                {user.email}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Right: Role & Options */}
                                    <div className="flex items-center gap-3">
                                        <span className={`px-3 py-1 rounded-xl text-[10px] font-bold border uppercase tracking-wider ${roleColors[user.role] || "bg-slate-50 text-slate-700 border-slate-200"}`}>
                                            {user.role}
                                        </span>
                                    </div>
                                </div>
                            );
                        })
                    ) : (
                        <div className="py-12 text-center flex flex-col items-center justify-center gap-2 font-sans">
                            <FiXCircle size={28} className="text-slate-300 animate-pulse" />
                            <span className="text-sm font-semibold text-slate-800">No members found</span>
                            <span className="text-xs text-slate-400">Try adjusting your filters or search query.</span>
                        </div>
                    )}
                </div>
            </div>
            
            {/* Page Footer */}
            <div className="text-center pt-4 border-t border-slate-100 text-[10px] text-slate-400 font-semibold font-sans">
                © 2026 DelegateX Console. All rights reserved.
            </div>
        </div>
    );
}
