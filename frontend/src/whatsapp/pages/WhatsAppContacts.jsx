import { useState } from "react";
import WhatsAppHeader from "../components/WhatsAppHeader";
import { useToast } from "../../context/ToastContext";
import {
    FiUploadCloud, FiFileText, FiCheckCircle, FiUsers, FiAlertTriangle,
    FiUserCheck, FiStar, FiClock, FiSearch, FiCheck, FiX, FiPlus, FiEye,
    FiEdit2, FiTrash2, FiPhone, FiMail, FiTag
} from "react-icons/fi";

const INITIAL_CONTACTS = [
    { id: 1, name: "John Smith", phone: "+91-9876543210", email: "john.smith@example.com", category: "VIP Client", status: "Valid", notes: "Key decision maker", lastContact: "Today 11:20 AM" },
    { id: 2, name: "Sarah Jenkins", phone: "+91-9876543211", email: "sarah.j@example.com", category: "Recently Contacted", status: "Valid", notes: "Requested site visit", lastContact: "Yesterday" },
    { id: 3, name: "Michael Chang", phone: "+91-9876543212", email: "m.chang@example.com", category: "Recently Imported", status: "Valid", notes: "Met at expo", lastContact: "2 days ago" },
    { id: 4, name: "Anita Sharma", phone: "+91-9876543213", email: "anita.s@example.com", category: "VIP Client", status: "Valid", notes: "Interested in villa project", lastContact: "3 days ago" },
    { id: 5, name: "David Miller", phone: "+91-9876543214", email: "david.m@example.com", category: "Recently Contacted", status: "DND", notes: "Do not disturb requested", lastContact: "1 week ago" },
];

function WhatsAppContacts() {
    const { showToast } = useToast();
    const [contacts, setContacts] = useState(INITIAL_CONTACTS);
    const [searchQuery, setSearchQuery] = useState("");
    const [dragActive, setDragActive] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [uploadSuccess, setUploadSuccess] = useState(false);

    // Modal State
    const [showAddModal, setShowAddModal] = useState(false);
    const [showDetailModal, setShowDetailModal] = useState(null);
    const [editingContact, setEditingContact] = useState(null);

    // Form Fields
    const [name, setName] = useState("");
    const [phone, setPhone] = useState("");
    const [email, setEmail] = useState("");
    const [category, setCategory] = useState("Regular Contact");
    const [status, setStatus] = useState("Valid");
    const [notes, setNotes] = useState("");
    const [formErrors, setFormErrors] = useState({});

    const resetForm = () => {
        setName("");
        setPhone("");
        setEmail("");
        setCategory("Regular Contact");
        setStatus("Valid");
        setNotes("");
        setFormErrors({});
        setEditingContact(null);
    };

    const validateForm = () => {
        const errors = {};
        const cleanName = name.trim();
        const cleanPhone = phone.trim();

        if (!cleanName) {
            errors.name = "Contact Name is required.";
        }

        if (!cleanPhone) {
            errors.phone = "Phone Number is required.";
        } else {
            // E.164 / International Phone Regex validation
            const phoneRegex = /^(\+?\d{1,4}[\s-]?)?\(?\d{1,4}\)?[\s-]?\d{1,4}[\s-]?\d{1,9}$/;
            if (!phoneRegex.test(cleanPhone)) {
                errors.phone = "Please enter a valid phone number (e.g. +91 98765 43210).";
            } else {
                // Check duplicate phone number
                const isDuplicate = contacts.some(c => 
                    c.phone.replace(/[\s-]/g, "") === cleanPhone.replace(/[\s-]/g, "") &&
                    (!editingContact || c.id !== editingContact.id)
                );
                if (isDuplicate) {
                    errors.phone = "This phone number already exists in your contacts.";
                }
            }
        }

        setFormErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleSaveContact = (e) => {
        e?.preventDefault();
        if (!validateForm()) {
            const firstErr = Object.values(formErrors)[0] || "Please fix validation errors.";
            if (showToast) showToast(firstErr, "error");
            return;
        }

        if (editingContact) {
            // Update existing contact
            setContacts(prev => prev.map(c => c.id === editingContact.id ? {
                ...c,
                name: name.trim(),
                phone: phone.trim(),
                email: email.trim(),
                category,
                status,
                notes: notes.trim()
            } : c));
            if (showToast) showToast("Contact updated successfully", "success");
        } else {
            // Create new contact at top of directory
            const newContact = {
                id: Date.now(),
                name: name.trim(),
                phone: phone.trim(),
                email: email.trim(),
                category,
                status,
                notes: notes.trim(),
                lastContact: "Just Now"
            };
            setContacts(prev => [newContact, ...prev]);
            if (showToast) showToast("Contact added successfully", "success");
        }

        setShowAddModal(false);
        resetForm();
    };

    const handleEdit = (c) => {
        setEditingContact(c);
        setName(c.name);
        setPhone(c.phone);
        setEmail(c.email || "");
        setCategory(c.category || "Regular Contact");
        setStatus(c.status || "Valid");
        setNotes(c.notes || "");
        setShowAddModal(true);
    };

    const handleDelete = (id) => {
        if (window.confirm("Are you sure you want to delete this contact?")) {
            setContacts(prev => prev.filter(c => c.id !== id));
            if (showToast) showToast("Contact deleted", "info");
        }
    };

    const handleFileUpload = (e) => {
        const file = e.target.files?.[0];
        if (file) {
            setUploading(true);
            setTimeout(() => {
                setUploading(false);
                setUploadSuccess(true);
                setTimeout(() => setUploadSuccess(false), 4000);
            }, 1500);
        }
    };

    const filteredContacts = contacts.filter(c =>
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.phone.includes(searchQuery) ||
        (c.email && c.email.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (c.notes && c.notes.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    return (
        <div className="space-y-6 mt-2 pb-12 animate-fade-in">
            <WhatsAppHeader activeTab="contacts" searchQuery={searchQuery} onSearchChange={setSearchQuery} />

            {/* Stat Counters Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                {[
                    { label: "Total Contacts", val: contacts.length, color: "text-slate-800 bg-white" },
                    { label: "Valid WhatsApp", val: contacts.filter(c => c.status === "Valid").length, color: "text-emerald-600 bg-emerald-50/60 border-emerald-100" },
                    { label: "VIP Contacts", val: contacts.filter(c => c.category === "VIP Client").length, color: "text-indigo-600 bg-indigo-50/60 border-indigo-100" },
                    { label: "Recently Contacted", val: contacts.filter(c => c.category === "Recently Contacted").length, color: "text-blue-600 bg-blue-50/60 border-blue-100" },
                    { label: "Duplicates Filtered", val: "45", color: "text-amber-600 bg-amber-50/60 border-amber-100" },
                    { label: "DND Excluded", val: contacts.filter(c => c.status === "DND").length, color: "text-rose-600 bg-rose-50/60 border-rose-100" },
                ].map((stat, i) => (
                    <div key={i} className={`p-4 border rounded-2xl shadow-2xs hover:shadow-xs transition ${stat.color}`}>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">{stat.label}</span>
                        <span className="text-xl font-extrabold font-display block mt-1">{stat.val}</span>
                    </div>
                ))}
            </div>

            {/* Top Toolbar Actions */}
            <div className="flex items-center justify-between bg-white p-4 border border-slate-200/80 rounded-2xl shadow-2xs">
                <div>
                    <h2 className="text-sm font-bold text-slate-800 font-display">Contact Management</h2>
                    <p className="text-xs text-slate-400 mt-0.5">Manage VIP clients, imported contacts, and WhatsApp engagement status.</p>
                </div>
                <button
                    onClick={() => { resetForm(); setShowAddModal(true); }}
                    className="flex items-center gap-1.5 bg-[#25D366] hover:bg-emerald-600 text-white px-4 py-2 rounded-xl text-xs font-semibold shadow-xs transition cursor-pointer"
                >
                    <FiPlus size={14} /> Add Contact
                </button>
            </div>

            {/* Contact Directory Table */}
            <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-[0_2px_8px_rgba(15,23,42,0.01)] space-y-4">
                <div className="flex justify-between items-center">
                    <h3 className="text-sm font-bold text-slate-900 font-display">Contact Directory ({filteredContacts.length})</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-slate-100 bg-slate-50/50">
                                <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Contact Name</th>
                                <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Phone Number</th>
                                <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Category</th>
                                <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">WhatsApp Status</th>
                                <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Last Activity</th>
                                <th className="text-right px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredContacts.length > 0 ? filteredContacts.map((c) => (
                                <tr key={c.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                                    <td className="px-4 py-3 text-xs font-bold text-slate-800">
                                        <div className="flex items-center gap-2">
                                            <div className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-[10px]">
                                                {c.name[0]?.toUpperCase()}
                                            </div>
                                            <div>
                                                <span>{c.name}</span>
                                                {c.email && <span className="text-[9px] text-slate-400 block font-normal">{c.email}</span>}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-xs text-slate-600 font-mono">{c.phone}</td>
                                    <td className="px-4 py-3 text-xs">
                                        <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-md bg-indigo-50 text-indigo-600 border border-indigo-100">{c.category}</span>
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-md border ${c.status === "Valid" ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-rose-50 text-rose-600 border-rose-100"}`}>
                                            {c.status}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-[10px] text-slate-400">{c.lastContact}</td>
                                    <td className="px-4 py-3 text-right">
                                        <div className="flex items-center justify-end gap-1.5">
                                            <button onClick={() => setShowDetailModal(c)} className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition cursor-pointer" title="View Details">
                                                <FiEye size={13} />
                                            </button>
                                            <button onClick={() => handleEdit(c)} className="p-1.5 text-slate-400 hover:text-emerald-600 rounded-lg hover:bg-emerald-50 transition cursor-pointer" title="Edit Contact">
                                                <FiEdit2 size={13} />
                                            </button>
                                            <button onClick={() => handleDelete(c.id)} className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer" title="Delete Contact">
                                                <FiTrash2 size={13} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan={6} className="px-4 py-10 text-center text-xs text-slate-400">
                                        No contacts matching your search criteria.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Drag & Drop Enterprise Importer Card */}
            <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-[0_2px_8px_rgba(15,23,42,0.01)] space-y-4">
                <h3 className="text-sm font-bold text-slate-900 font-display flex items-center gap-2">
                    <FiUploadCloud className="text-emerald-500" size={18} />
                    Enterprise Contact Importer (CSV / Excel)
                </h3>

                <div
                    onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                    onDragLeave={() => setDragActive(false)}
                    onDrop={(e) => { e.preventDefault(); setDragActive(false); handleFileUpload(e); }}
                    className={`border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center text-center transition-all ${dragActive ? "border-emerald-500 bg-emerald-50/30" : "border-slate-200 bg-slate-50/40 hover:bg-slate-50"}`}
                >
                    {uploading ? (
                        <div className="space-y-3">
                            <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto animate-spin">
                                <FiUploadCloud size={24} />
                            </div>
                            <p className="text-xs font-bold text-slate-700">Validating phone numbers & cleaning DND contacts...</p>
                        </div>
                    ) : uploadSuccess ? (
                        <div className="space-y-2">
                            <FiCheckCircle className="text-emerald-500 mx-auto" size={36} />
                            <p className="text-xs font-bold text-emerald-700">Successfully Imported 150 Contacts!</p>
                        </div>
                    ) : (
                        <>
                            <FiUploadCloud size={36} className="text-slate-300 mb-2" />
                            <p className="text-xs font-bold text-slate-700">Drag & Drop your CSV or XLSX file here</p>
                            <p className="text-[10px] text-slate-400 mt-1 max-w-xs">Automatic phone format normalization, duplicate filtering & DND detection.</p>
                            <label className="mt-4 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-semibold shadow-sm transition cursor-pointer">
                                Browse Files
                                <input type="file" onChange={handleFileUpload} accept=".csv, .xlsx" className="hidden" />
                            </label>
                        </>
                    )}
                </div>
            </div>

            {/* ADD / EDIT CONTACT MODAL */}
            {showAddModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
                    <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs" onClick={() => setShowAddModal(false)}></div>
                    <div className="relative bg-white rounded-2xl shadow-2xl p-6 w-full max-w-lg border border-slate-200/90 animate-slide-up space-y-4">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                            <h3 className="text-sm font-bold text-slate-900 font-display">
                                {editingContact ? "Edit Contact" : "Add New WhatsApp Contact"}
                            </h3>
                            <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer"><FiX size={16} /></button>
                        </div>

                        <form onSubmit={handleSaveContact} className="space-y-3.5">
                            <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                                    Contact Name <span className="text-rose-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    required
                                    placeholder="Full Name (e.g. Rahul Sharma)"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className={`w-full px-3.5 py-2.5 text-xs bg-slate-50 border rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 ${formErrors.name ? "border-rose-300" : "border-slate-200"}`}
                                />
                                {formErrors.name && <p className="text-[10px] text-rose-500 font-semibold mt-1">{formErrors.name}</p>}
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                                        Phone Number <span className="text-rose-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="e.g. +91 98765 43210"
                                        value={phone}
                                        onChange={(e) => setPhone(e.target.value)}
                                        className={`w-full px-3.5 py-2.5 text-xs bg-slate-50 border rounded-xl font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/20 ${formErrors.phone ? "border-rose-300" : "border-slate-200"}`}
                                    />
                                    {formErrors.phone && <p className="text-[10px] text-rose-500 font-semibold mt-1">{formErrors.phone}</p>}
                                </div>

                                <div>
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                                        Email (Optional)
                                    </label>
                                    <input
                                        type="email"
                                        placeholder="rahul@example.com"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Category</label>
                                    <select
                                        value={category}
                                        onChange={(e) => setCategory(e.target.value)}
                                        className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium cursor-pointer"
                                    >
                                        <option value="VIP Client">VIP Client</option>
                                        <option value="Recently Contacted">Recently Contacted</option>
                                        <option value="Recently Imported">Recently Imported</option>
                                        <option value="Regular Contact">Regular Contact</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">WhatsApp Status</label>
                                    <select
                                        value={status}
                                        onChange={(e) => setStatus(e.target.value)}
                                        className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium cursor-pointer"
                                    >
                                        <option value="Valid">Valid WhatsApp Number</option>
                                        <option value="DND">DND (Do Not Disturb)</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Notes (Optional)</label>
                                <textarea
                                    placeholder="Add any specific context or notes..."
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    rows={2}
                                    className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl resize-none font-sans focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                                />
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button type="button" onClick={() => setShowAddModal(false)} className="flex-1 py-2.5 text-xs font-semibold text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200 transition cursor-pointer">
                                    Cancel
                                </button>
                                <button type="submit" className="flex-1 py-2.5 text-xs font-semibold text-white bg-[#25D366] hover:bg-emerald-600 rounded-xl shadow-xs transition cursor-pointer">
                                    {editingContact ? "Update Contact" : "Save Contact"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* DETAIL MODAL */}
            {showDetailModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
                    <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs" onClick={() => setShowDetailModal(null)}></div>
                    <div className="relative bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md border border-slate-200 space-y-4">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                            <h3 className="text-sm font-bold text-slate-900 font-display">Contact Details</h3>
                            <button onClick={() => setShowDetailModal(null)} className="text-slate-400 hover:text-slate-600"><FiX size={16} /></button>
                        </div>
                        <div className="space-y-2 text-xs">
                            <p><span className="text-slate-400 font-medium">Name:</span> <strong className="text-slate-800">{showDetailModal.name}</strong></p>
                            <p><span className="text-slate-400 font-medium">Phone:</span> <strong className="text-slate-800 font-mono">{showDetailModal.phone}</strong></p>
                            <p><span className="text-slate-400 font-medium">Email:</span> <strong className="text-slate-800">{showDetailModal.email || "N/A"}</strong></p>
                            <p><span className="text-slate-400 font-medium">Category:</span> <span className="bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded text-[10px] font-bold">{showDetailModal.category}</span></p>
                            <p><span className="text-slate-400 font-medium">WhatsApp Status:</span> <span className="bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded text-[10px] font-bold">{showDetailModal.status}</span></p>
                            {showDetailModal.notes && <p><span className="text-slate-400 font-medium">Notes:</span> <span className="text-slate-700 italic block mt-0.5 p-2 bg-slate-50 rounded-lg">{showDetailModal.notes}</span></p>}
                        </div>
                        <button onClick={() => setShowDetailModal(null)} className="w-full py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-semibold">Close</button>
                    </div>
                </div>
            )}
        </div>
    );
}

export default WhatsAppContacts;
