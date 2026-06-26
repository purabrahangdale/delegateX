import { useState } from "react";

import {
    FiTrash2,
    FiEdit2,
    FiEye,
    FiAlertCircle,
    FiCheck,
    FiX,
    FiUsers,
} from "react-icons/fi";

function EmployeeTable({
    employees,
    onDeleteEmployee,
    onEditEmployee,
    onViewDetails,
}) {

    const [confirmDeleteId, setConfirmDeleteId] = useState(null);

    const getRoleStyle = (role) => {

        switch (role) {

            case "Frontend Engineer":
                return "bg-cyan-50 text-cyan-700 border-cyan-100";

            case "Backend Engineer":
                return "bg-emerald-50 text-emerald-700 border-emerald-100";

            case "Tester":
                return "bg-amber-50 text-amber-700 border-amber-100";

            case "Project Manager":
                return "bg-violet-50 text-violet-700 border-violet-100";

            case "Fullstack Developer":
                return "bg-indigo-50 text-indigo-700 border-indigo-100";

            case "MERN Developer":
                return "bg-pink-50 text-pink-700 border-pink-100";

            default:
                return "bg-slate-50 text-slate-700 border-slate-200";
        }
    };

    const getStatusStyle = (status) => {

        switch (status) {

            case "Active":
                return "bg-emerald-50 text-emerald-700 border-emerald-100";

            case "Away":
                return "bg-amber-50 text-amber-700 border-amber-100";

            case "On Leave":
                return "bg-rose-50 text-rose-700 border-rose-100";

            default:
                return "bg-slate-50 text-slate-700 border-slate-200";
        }
    };

    const getStatusDot = (status) => {

        switch (status) {

            case "Active":
                return "bg-emerald-500";

            case "Away":
                return "bg-amber-500";

            case "On Leave":
                return "bg-rose-500";

            default:
                return "bg-slate-400";
        }
    };

    const handleDeleteClick = (id) => {
        setConfirmDeleteId(id);
    };

    const cancelDelete = () => {
        setConfirmDeleteId(null);
    };

    const confirmDelete = (id) => {

        onDeleteEmployee(id);

        setConfirmDeleteId(null);
    };

    return (

        <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">

            <div className="overflow-x-auto">

                <table className="w-full text-left">

                    <thead>

                        <tr className="bg-slate-50 border-b border-slate-200 text-[11px] uppercase tracking-wider text-slate-400">

                            <th className="p-5 pl-6">Employee</th>

                            <th className="p-5">Role</th>

                            <th className="p-5">Projects</th>

                            <th className="p-5">Tasks</th>

                            <th className="p-5">Status</th>

                            <th className="p-5 pr-6 text-right">Actions</th>

                        </tr>

                    </thead>

                    <tbody className="divide-y divide-slate-100">

                        {employees.length > 0 ? (

                            employees.map((employee) => (

                                <tr
                                    key={employee._id}
                                    className="hover:bg-slate-50 transition duration-200 group"
                                >

                                    {/* Employee */}

                                    <td className="p-5 pl-6">

                                        <div className="flex items-center gap-4">

                                            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-indigo-500 to-indigo-600 flex items-center justify-center text-white font-bold shadow-sm shrink-0">

                                                {employee.name?.charAt(0)}

                                            </div>

                                            <div>

                                                <h3 className="text-sm font-semibold text-slate-800">

                                                    {employee.name}

                                                </h3>

                                                <p className="text-xs text-slate-400 mt-0.5">

                                                    {employee.email}

                                                </p>

                                            </div>

                                        </div>

                                    </td>

                                    {/* Role */}

                                    <td className="p-5">

                                        <span
                                            className={`px-3 py-1 rounded-xl text-[11px] font-semibold border ${getRoleStyle(employee.role)}`}
                                        >

                                            {employee.role}

                                        </span>

                                    </td>

                                    {/* Projects */}

                                    <td className="p-5">

                                        <div className="flex flex-wrap gap-2">

                                            {employee.assigned_projects?.length > 0 ? (

                                                employee.assigned_projects.map((project, index) => (

                                                    <span
                                                        key={index}
                                                        className="px-2.5 py-1 bg-slate-100 rounded-lg text-[11px] text-slate-600 font-medium"
                                                    >

                                                        {project}

                                                    </span>

                                                ))

                                            ) : (

                                                <span className="text-xs text-slate-400">

                                                    Unassigned

                                                </span>

                                            )}

                                        </div>

                                    </td>

                                    {/* Tasks */}

                                    <td className="p-5">

                                        <div className="space-y-1">

                                            <p className="text-xs font-semibold text-slate-700">

                                                {employee.pending_tasks || 0} Active

                                            </p>

                                            <p className="text-xs text-emerald-600 font-medium">

                                                {employee.completed_tasks || 0} Completed

                                            </p>

                                        </div>

                                    </td>

                                    {/* Status */}

                                    <td className="p-5">

                                        <div
                                            className={`inline-flex items-center gap-2 px-3 py-1 rounded-xl border text-[11px] font-semibold ${getStatusStyle(employee.status)}`}
                                        >

                                            <div
                                                className={`w-2 h-2 rounded-full ${getStatusDot(employee.status)}`}
                                            />

                                            {employee.status}

                                        </div>

                                    </td>

                                    {/* Actions */}

                                    <td className="p-5 pr-6 text-right">

                                        {confirmDeleteId === employee._id ? (

                                            <div className="flex items-center justify-end gap-2">

                                                <span className="text-[11px] font-semibold text-rose-500 flex items-center gap-1">

                                                    <FiAlertCircle size={12} />

                                                    Confirm?

                                                </span>

                                                <button
                                                    onClick={() => confirmDelete(employee._id)}
                                                    className="p-2 rounded-lg bg-rose-500 hover:bg-rose-600 text-white transition"
                                                >

                                                    <FiCheck size={13} />

                                                </button>

                                                <button
                                                    onClick={cancelDelete}
                                                    className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
                                                >

                                                    <FiX size={13} />

                                                </button>

                                            </div>

                                        ) : (

                                            <div className="flex items-center justify-end gap-1 opacity-70 group-hover:opacity-100 transition">

                                                <button
                                                    onClick={() => onViewDetails(employee)}
                                                    className="p-2 rounded-xl hover:bg-slate-100 text-slate-500 hover:text-slate-700 transition"
                                                >

                                                    <FiEye size={15} />

                                                </button>

                                                <button
                                                    onClick={() => onEditEmployee(employee)}
                                                    className="p-2 rounded-xl hover:bg-indigo-50 text-slate-500 hover:text-indigo-600 transition"
                                                >

                                                    <FiEdit2 size={15} />

                                                </button>

                                                <button
                                                    onClick={() => handleDeleteClick(employee._id)}
                                                    className="p-2 rounded-xl hover:bg-rose-50 text-slate-500 hover:text-rose-600 transition"
                                                >

                                                    <FiTrash2 size={15} />

                                                </button>

                                            </div>

                                        )}

                                    </td>

                                </tr>

                            ))

                        ) : (

                            <tr>

                                <td colSpan="6" className="py-20 text-center">

                                    <div className="flex flex-col items-center gap-3">

                                        <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center">

                                            <FiUsers size={26} className="text-slate-400" />

                                        </div>

                                        <div>

                                            <h3 className="text-sm font-semibold text-slate-700">

                                                No Employees Found

                                            </h3>

                                            <p className="text-xs text-slate-400 mt-1">

                                                Add your first employee to start delegation tracking

                                            </p>

                                        </div>

                                    </div>

                                </td>

                            </tr>

                        )}

                    </tbody>

                </table>

            </div>

        </div>

    );
}

export default EmployeeTable;