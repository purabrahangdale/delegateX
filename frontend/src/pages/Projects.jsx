import { useEffect, useState } from "react";
import ProjectCard from "../components/projects/ProjectCard";
import AddProjectModal from "../components/projects/AddProjectModal";
import { getProjects, addProject, updateProject, deleteProject } from "../services/projectApi";
import { FiPlus, FiSearch, FiSliders, FiFolder } from "react-icons/fi";
import { useToast } from "../context/ToastContext";

function Projects() {
    const { showToast } = useToast();
    const [projects, setProjects] = useState([]);
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("All");
    const [loading, setLoading] = useState(true);

    // Modal states
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingProject, setEditingProject] = useState(null);

    // Fetch projects
    const fetchProjects = async () => {
        setLoading(true);
        try {
            const response = await getProjects();
            setProjects(response.data || []);
        } catch (error) {
            console.error("Failed to load projects", error);
            showToast("Failed to connect to database.", "error");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchProjects();
    }, []);

    // Save project (Create or Edit)
    const handleSaveProject = async (projectData) => {
        try {
            if (editingProject) {
                await updateProject(editingProject._id, projectData);
                showToast("Project updated successfully!");
            } else {
                await addProject(projectData);
                showToast("New project track initialized!");
            }
            fetchProjects();
        } catch (err) {
            console.error(err);
            showToast("Failed to save project details.", "error");
        }
    };

    // Delete project
    const handleDeleteProject = async (id) => {
        try {
            await deleteProject(id);
            showToast("Project deleted from registry.");
            fetchProjects();
        } catch (err) {
            console.error(err);
            showToast("Failed to delete project.", "error");
        }
    };

    const handleEditClick = (project) => {
        setEditingProject(project);
        setIsModalOpen(true);
    };

    const handleAddClick = () => {
        setEditingProject(null);
        setIsModalOpen(true);
    };

    // Search and status filtering
    const filteredProjects = projects.filter((proj) => {
        const matchesSearch = proj.name.toLowerCase().includes(search.toLowerCase());
        const matchesStatus = statusFilter === "All" || proj.status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    return (
        <div className="space-y-8 mt-2">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-5">
                <div>
                    <h1 className="text-2xl font-bold font-display text-slate-900 tracking-tight">Projects Workspace</h1>
                    <p className="text-slate-500 text-xs mt-1">Track high-level metrics, progress pipelines, deadlines, and project health.</p>
                </div>
                <button
                    onClick={handleAddClick}
                    className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl text-xs font-semibold shadow-lg shadow-indigo-600/15 transition hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
                >
                    <FiPlus size={14} />
                    Create Project
                </button>
            </div>

            {/* Filters panel */}
            <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-[0_2px_8px_rgba(15,23,42,0.01)] flex flex-col md:flex-row md:items-center justify-between gap-4">
                {/* Search Bar */}
                <div className="relative flex-1 max-w-md">
                    <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <FiSearch size={14} />
                    </span>
                    <input
                        type="text"
                        placeholder="Search projects by title..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 pl-9 pr-4 text-xs text-slate-800 placeholder-slate-400 outline-none focus:bg-white focus:border-indigo-500 transition-all font-sans"
                    />
                </div>

                {/* Dropdowns */}
                <div className="flex items-center gap-3">
                    <FiSliders size={12} className="text-slate-400" />
                    <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">Filter:</span>
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="bg-slate-50 border border-slate-200 text-slate-700 text-xs px-3.5 py-2.5 rounded-xl outline-none focus:bg-white focus:border-indigo-500 transition cursor-pointer font-sans"
                    >
                        <option value="All">All Statuses</option>
                        <option>Pending</option>
                        <option>In Progress</option>
                        <option>Completed</option>
                    </select>
                </div>
            </div>

            {/* Project Grid / Loading State */}
            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="h-72 bg-slate-100 border border-slate-200 rounded-2xl"></div>
                    ))}
                </div>
            ) : filteredProjects.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredProjects.map((project) => (
                        <ProjectCard
                            key={project._id}
                            project={project}
                            onEdit={handleEditClick}
                            onDelete={handleDeleteProject}
                        />
                    ))}
                </div>
            ) : (
                <div className="bg-white border border-slate-200/80 rounded-2xl p-16 text-center shadow-[0_2px_8px_rgba(15,23,42,0.01)]">
                    <div className="flex flex-col items-center justify-center gap-3">
                        <FiFolder size={32} className="text-slate-300" />
                        <span className="text-xs text-slate-400 font-semibold">No project tracks initialized. Create a project to start.</span>
                    </div>
                </div>
            )}

            {/* Modal */}
            <AddProjectModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSave={handleSaveProject}
                projectToEdit={editingProject}
            />
        </div>
    );
}

export default Projects;