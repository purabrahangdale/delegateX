import React, { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams, useParams } from "react-router-dom";
import { FiSave, FiChevronRight, FiArrowLeft } from "react-icons/fi";
import { useToast } from "../../../context/ToastContext";
import { getFormById, saveForm } from "../api/delegationFormApi";
import DelegationFormBuilder from "../components/DelegationFormBuilder";
import DelegationLivePreview from "../components/DelegationLivePreview";

export default function CreateDelegationFormPage() {
    const { showToast } = useToast();
    const navigate = useNavigate();
    const { id: routeEditId } = useParams();
    const [searchParams] = useSearchParams();
    const editId = routeEditId || searchParams.get("edit");

    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [fields, setFields] = useState([]);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (editId) {
            loadFormDetails(editId);
        }
    }, [editId]);

    const loadFormDetails = async (id) => {
        try {
            const res = await getFormById(id);
            const data = res.data && res.data.success !== undefined ? (res.data.success ? res.data.data : null) : res.data;
            if (data) {
                setTitle(data.title || "");
                setDescription(data.description || "");
                setFields(data.fields || []);
            }
        } catch (e) {
            console.error("Failed to load form details:", e);
            showToast("Failed to load template data for editing", "error");
        }
    };

    const handleSave = async () => {
        if (!title.trim()) {
            showToast("Please enter a form title.", "error");
            return;
        }

        setSaving(true);
        try {
            const payload = {
                id: editId || undefined,
                title,
                description,
                fields
            };
            await saveForm(payload);
            showToast(editId ? "Delegation form updated successfully!" : "Delegation form created successfully!");
            navigate("/delegation/delegation-form");
        } catch (e) {
            console.error("Failed to save delegation form:", e);
            showToast("Failed to save delegation form.", "error");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-8 mt-2">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-900 pb-5">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                    <span>Workspace</span>
                    <FiChevronRight size={12} className="text-slate-700" />
                    <span>Delegation</span>
                    <FiChevronRight size={12} className="text-slate-700" />
                    <Link to="/delegation/delegation-form" className="hover:text-slate-300 transition">Forms</Link>
                    <FiChevronRight size={12} className="text-slate-700" />
                    <span className="text-slate-900 font-bold">{editId ? "Edit" : "Create"}</span>
                </div>

                <div className="flex items-center gap-2.5">
                    <button
                        onClick={() => navigate("/delegation/delegation-form")}
                        className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white bg-slate-950 border border-slate-900 rounded-xl transition cursor-pointer"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-xs font-semibold shadow-lg shadow-indigo-600/15 transition hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
                    >
                        <FiSave size={14} />
                        {saving ? "Saving..." : editId ? "Save Changes" : "Create Form"}
                    </button>
                </div>
            </div>

            {/* Split Screen Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Configuration side */}
                <div className="space-y-6">
                    <div className="flex items-center gap-3 bg-white border border-slate-200/80 rounded-2xl p-4 shadow-[0_2px_8px_rgba(15,23,42,0.01)]">
                        <button
                            onClick={() => navigate("/delegation/delegation-form")}
                            className="p-2 text-slate-500 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition cursor-pointer"
                            title="Back to list"
                        >
                            <FiArrowLeft size={15} />
                        </button>
                        <div>
                            <h2 className="text-sm font-bold font-display text-slate-950 tracking-tight">
                                {editId ? "Edit Delegation Form" : "Create Delegation Form"}
                            </h2>
                            <p className="text-slate-500 text-[10px] mt-0.5">
                                Design the intake requirements for your project tasks.
                            </p>
                        </div>
                    </div>

                    <DelegationFormBuilder
                        title={title}
                        setTitle={setTitle}
                        description={description}
                        setDescription={setDescription}
                        fields={fields}
                        setFields={setFields}
                    />
                </div>

                {/* Preview side */}
                <div className="sticky top-6">
                    <DelegationLivePreview
                        title={title}
                        description={description}
                        fields={fields}
                    />
                </div>
            </div>
        </div>
    );
}
