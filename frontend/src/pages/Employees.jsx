import { useEffect, useState } from "react";
import EmployeeTable from "../components/employees/EmployeeTable";
import AddEmployeeModal from "../components/employees/AddEmployeeModal";

import {
    getEmployees,
    addEmployee,
    deleteEmployee,
    updateEmployee,
} from "../services/employeeApi";

import {
    FiPlus,
    FiSearch,
    FiSliders,
    FiX,
    FiMail,
    FiLayers,
    FiActivity,
} from "react-icons/fi";

import { useToast } from "../context/ToastContext";

function Employees() {

    const { showToast } = useToast();

    const [employees, setEmployees] = useState([]);

    const [search, setSearch] = useState("");

    const [roleFilter, setRoleFilter] = useState("All");

    const [statusFilter, setStatusFilter] = useState("All");

    const [loading, setLoading] = useState(true);

    // Modal States

    const [isModalOpen, setIsModalOpen] = useState(false);

    const [editingEmployee, setEditingEmployee] = useState(null);

    // Drawer State

    const [selectedEmployee, setSelectedEmployee] = useState(null);

    // Pagination

    const [currentPage, setCurrentPage] = useState(1);

    const itemsPerPage = 8;

    // FETCH EMPLOYEES

    const fetchEmployees = async () => {

        setLoading(true);

        try {

            const data = await getEmployees();

            setEmployees(data || []);

        } catch (error) {

            console.log(error);

            showToast(
                "Failed to connect to backend.",
                "error"
            );

        } finally {

            setLoading(false);
        }
    };

    useEffect(() => {

        fetchEmployees();

    }, []);

    // SAVE EMPLOYEE

    const handleSaveEmployee = async (employeeData) => {

        try {

            if (editingEmployee) {

                await updateEmployee(
                    editingEmployee._id,
                    employeeData
                );

                showToast(
                    "Employee updated successfully!"
                );

            } else {

                await addEmployee(employeeData);

                showToast(
                    "Employee added successfully!"
                );
            }

            fetchEmployees();

            setIsModalOpen(false);

        } catch (error) {

            console.log(error);

            showToast(
                "Operation failed.",
                "error"
            );
        }
    };

    // DELETE EMPLOYEE

    const handleDeleteEmployee = async (id) => {

        try {

            await deleteEmployee(id);

            showToast(
                "Employee deleted successfully."
            );

            if (
                selectedEmployee &&
                selectedEmployee._id === id
            ) {
                setSelectedEmployee(null);
            }

            fetchEmployees();

        } catch (error) {

            console.log(error);

            showToast(
                "Delete failed.",
                "error"
            );
        }
    };

    // EDIT

    const handleEditClick = (employee) => {

        setEditingEmployee(employee);

        setIsModalOpen(true);
    };

    // ADD

    const handleAddClick = () => {

        setEditingEmployee(null);

        setIsModalOpen(true);
    };

    // FILTERS

    const filteredEmployees = employees.filter((emp) => {

        const matchesSearch =
            emp.name?.toLowerCase()
                .includes(search.toLowerCase());

        const matchesRole =
            roleFilter === "All" ||
            emp.role === roleFilter;

        const matchesStatus =
            statusFilter === "All" ||
            emp.status === statusFilter;

        return (
            matchesSearch &&
            matchesRole &&
            matchesStatus
        );
    });

    // PAGINATION

    const totalItems = filteredEmployees.length;

    const totalPages =
        Math.ceil(totalItems / itemsPerPage) || 1;

    const startIndex =
        (currentPage - 1) * itemsPerPage;

    const endIndex = Math.min(
        startIndex + itemsPerPage,
        totalItems
    );

    const paginatedEmployees =
        filteredEmployees.slice(
            startIndex,
            endIndex
        );

    // RESET PAGE ON FILTER

    useEffect(() => {

        setCurrentPage(1);

    }, [search, roleFilter, statusFilter]);

    return (

        <div className="space-y-8 mt-2">

            {/* HEADER */}

            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-5">

                <div>

                    <h1 className="text-2xl font-bold font-display text-slate-900 tracking-tight">

                        Team Directory

                    </h1>

                    <p className="text-slate-500 text-xs mt-1">

                        Manage employees, roles, projects and delegation workflows.

                    </p>

                </div>

                <button
                    onClick={handleAddClick}
                    className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl text-xs font-semibold shadow-lg shadow-indigo-600/15 transition hover:scale-[1.01] active:scale-[0.99]"
                >

                    <FiPlus size={14} />

                    Add Member

                </button>

            </div>

            {/* FILTER PANEL */}

            <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">

                {/* SEARCH */}

                <div className="relative flex-1 max-w-md">

                    <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400">

                        <FiSearch size={14} />

                    </span>

                    <input
                        type="text"
                        placeholder="Search employee..."
                        value={search}
                        onChange={(e) =>
                            setSearch(e.target.value)
                        }
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 pl-9 pr-4 text-xs outline-none focus:bg-white focus:border-indigo-500"
                    />

                </div>

                {/* FILTERS */}

                <div className="flex flex-wrap items-center gap-3">

                    <div className="flex items-center gap-2">

                        <FiSliders
                            size={12}
                            className="text-slate-400"
                        />

                        <span className="text-[11px] text-slate-400 font-bold uppercase">

                            Filter

                        </span>

                    </div>

                    {/* ROLE */}

                    <select
                        value={roleFilter}
                        onChange={(e) =>
                            setRoleFilter(e.target.value)
                        }
                        className="bg-slate-50 border border-slate-200 text-xs px-3 py-2 rounded-xl outline-none focus:bg-white focus:border-indigo-500"
                    >

                        <option value="All">
                            All Roles
                        </option>

                        <option>
                            Frontend Engineer
                        </option>

                        <option>
                            Backend Engineer
                        </option>

                        <option>
                            Tester
                        </option>

                        <option>
                            Project Manager
                        </option>

                        <option>
                            Full Stack Developer
                        </option>

                        <option>
                            MERN Developer
                        </option>

                    </select>

                    {/* STATUS */}

                    <select
                        value={statusFilter}
                        onChange={(e) =>
                            setStatusFilter(e.target.value)
                        }
                        className="bg-slate-50 border border-slate-200 text-xs px-3 py-2 rounded-xl outline-none focus:bg-white focus:border-indigo-500"
                    >

                        <option value="All">
                            All Statuses
                        </option>

                        <option>
                            Active
                        </option>

                        <option>
                            Away
                        </option>

                        <option>
                            On Leave
                        </option>

                    </select>

                </div>

            </div>

            {/* TABLE */}

            {loading ? (
                <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm animate-pulse">
                    <table className="w-full border-collapse">
                        <thead>
                            <tr className="border-b border-slate-100 bg-slate-50/50">
                                <th className="px-6 py-4 text-left"><div className="h-3 w-16 bg-slate-200 rounded"></div></th>
                                <th className="px-6 py-4 text-left"><div className="h-3 w-16 bg-slate-200 rounded"></div></th>
                                <th className="px-6 py-4 text-left"><div className="h-3 w-16 bg-slate-200 rounded"></div></th>
                                <th className="px-6 py-4 text-left"><div className="h-3 w-20 bg-slate-200 rounded"></div></th>
                                <th className="px-6 py-4 text-left"><div className="h-3 w-12 bg-slate-200 rounded"></div></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {[1, 2, 3, 4, 5].map((i) => (
                                <tr key={i}>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="h-9 w-9 rounded-full bg-slate-200"></div>
                                            <div className="space-y-2">
                                                <div className="h-3.5 w-24 bg-slate-200 rounded"></div>
                                                <div className="h-2.5 w-16 bg-slate-100 rounded"></div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="h-5 w-24 bg-slate-200 rounded-lg"></div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="h-5 w-16 bg-slate-200 rounded-full"></div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="space-y-1.5">
                                            <div className="h-3 w-32 bg-slate-150 rounded"></div>
                                            <div className="h-2 w-20 bg-slate-100 rounded"></div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex gap-2">
                                            <div className="h-7 w-7 bg-slate-200 rounded-lg"></div>
                                            <div className="h-7 w-7 bg-slate-200 rounded-lg"></div>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

            ) : (

                <EmployeeTable
                    employees={paginatedEmployees}
                    onDeleteEmployee={handleDeleteEmployee}
                    onEditEmployee={handleEditClick}
                    onViewDetails={setSelectedEmployee}
                />

            )}

            {/* PAGINATION */}

            {!loading && totalPages > 1 && (

                <div className="flex justify-between items-center">

                    <span className="text-[11px] text-slate-400 font-bold uppercase">

                        Showing {startIndex + 1}-{endIndex} of {totalItems}

                    </span>

                    <div className="flex gap-2">

                        <button
                            disabled={currentPage === 1}
                            onClick={() =>
                                setCurrentPage((c) => c - 1)
                            }
                            className="px-3.5 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                        >

                            Previous

                        </button>

                        <button
                            disabled={currentPage === totalPages}
                            onClick={() =>
                                setCurrentPage((c) => c + 1)
                            }
                            className="px-3.5 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                        >

                            Next

                        </button>

                    </div>

                </div>

            )}

            {/* MODAL */}

            <AddEmployeeModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSave={handleSaveEmployee}
                employeeToEdit={editingEmployee}
            />

            {/* DRAWER */}

            {selectedEmployee && (

                <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">

                    {/* BACKDROP */}

                    <div
                        className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm"
                        onClick={() =>
                            setSelectedEmployee(null)
                        }
                    ></div>

                    {/* DRAWER */}

                    <div className="relative w-full max-w-sm bg-white border-l border-slate-200 shadow-2xl flex flex-col z-10">

                        {/* HEADER */}

                        <div className="p-6 border-b border-slate-100 flex justify-between items-center">

                            <span className="text-xs font-bold text-slate-400 uppercase">

                                Profile Overview

                            </span>

                            <button
                                onClick={() =>
                                    setSelectedEmployee(null)
                                }
                                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                            >

                                <FiX size={16} />

                            </button>

                        </div>

                        {/* BODY */}

                        <div className="flex-1 overflow-y-auto p-6 space-y-6">

                            {/* PROFILE */}

                            <div className="flex flex-col items-center text-center space-y-3 pb-6 border-b border-slate-100">

                                <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-indigo-500 to-indigo-600 flex items-center justify-center text-white font-bold text-2xl">

                                    {selectedEmployee.name?.charAt(0)}

                                </div>

                                <div>

                                    <h3 className="text-base font-bold text-slate-800">

                                        {selectedEmployee.name}

                                    </h3>

                                    <span className="text-xs text-slate-400">

                                        {selectedEmployee.role}

                                    </span>

                                </div>

                            </div>

                            {/* INFO */}

                            <div className="space-y-4">

                                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-3.5">

                                    <div className="flex items-center gap-3 text-xs">

                                        <FiMail
                                            className="text-slate-400"
                                            size={14}
                                        />

                                        <div>

                                            <span className="text-[9px] text-slate-400 font-bold uppercase block mb-1">

                                                Email Contact

                                            </span>

                                            <span className="text-slate-700 font-semibold">

                                                {`emp.${selectedEmployee.name?.toLowerCase().replace(/\s+/g, '')}@company.com`}

                                            </span>

                                        </div>

                                    </div>

                                    <div className="flex items-center gap-3 text-xs">

                                        <FiLayers
                                            className="text-slate-400"
                                            size={14}
                                        />

                                        <div>

                                            <span className="text-[9px] text-slate-400 font-bold uppercase block mb-1">

                                                Assigned Projects

                                            </span>

                                            <span className="text-slate-700 font-bold">

                                                {selectedEmployee.assigned_projects?.length > 0
                                                    ? selectedEmployee.assigned_projects.join(", ")
                                                    : "Unassigned"}

                                            </span>

                                        </div>

                                    </div>

                                </div>

                                {/* WORKLOAD */}

                                <div className="bg-indigo-50/20 p-4 rounded-xl border border-indigo-50/40 space-y-2">

                                    <span className="text-[9px] text-indigo-600 font-bold flex items-center gap-1.5 uppercase tracking-wider">

                                        <FiActivity size={12} />

                                        Live Workload

                                    </span>

                                    <div className="flex justify-between items-center text-xs mt-1">

                                        <span className="text-slate-500 font-medium">

                                            Active Tasks

                                        </span>

                                        <span className="text-indigo-600 font-bold">

                                            {selectedEmployee.pending_tasks || 0} Tasks

                                        </span>

                                    </div>

                                    <div className="flex justify-between items-center text-xs">

                                        <span className="text-slate-500 font-medium">

                                            Completed Tasks

                                        </span>

                                        <span className="text-emerald-600 font-bold">

                                            {selectedEmployee.completed_tasks || 0} Tasks

                                        </span>

                                    </div>

                                </div>

                            </div>

                        </div>

                    </div>

                </div>

            )}

        </div>
    );
}

export default Employees;