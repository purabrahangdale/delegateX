import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { getTasks } from "../services/taskApi";
import TaskDetailsDrawer from "../components/tasks/TaskDetailsDrawer";
import { FiAlertCircle } from "react-icons/fi";

function TaskDetailsPage() {
    const { taskId } = useParams();
    const [task, setTask] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchTask = async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await getTasks();
            const list = response.data || [];
            const foundTask = list.find(t => (t._id || t.id) === taskId);
            if (foundTask) {
                setTask(foundTask);
            } else {
                setTask(null);
            }
        } catch (err) {
            console.error("Failed to load task details", err);
            setError("Failed to connect to the service. Please check your connection and try again.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTask();
    }, [taskId]);

    if (loading) {
        return (
            <div className="w-full min-h-[60vh] flex flex-col items-center justify-center gap-3">
                <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                <div className="text-slate-500 font-semibold text-sm">Loading task details...</div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="w-full min-h-[60vh] flex flex-col items-center justify-center gap-3 px-4 text-center">
                <FiAlertCircle size={40} className="text-rose-500 animate-pulse" />
                <h3 className="text-lg font-bold text-slate-800">Connection Error</h3>
                <p className="text-sm text-slate-500 max-w-md">{error}</p>
                <button
                    onClick={fetchTask}
                    className="mt-2 h-10 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold shadow-sm transition active:scale-[0.98]"
                >
                    Retry Connection
                </button>
            </div>
        );
    }

    if (!task) {
        return (
            <div className="w-full min-h-[60vh] flex flex-col items-center justify-center gap-3 px-4 text-center">
                <FiAlertCircle size={40} className="text-amber-500" />
                <h3 className="text-lg font-bold text-slate-800 font-display">Task Not Found</h3>
                <p className="text-sm text-slate-500 max-w-sm">
                    The task with ID <code className="bg-slate-100 px-1.5 py-0.5 rounded text-rose-600 font-mono text-xs">{taskId}</code> does not exist or has been deleted.
                </p>
            </div>
        );
    }

    return (
        <div className="w-full px-4 md:px-6 py-5">
            <TaskDetailsDrawer 
                task={task} 
                onUpdate={fetchTask} 
            />
        </div>
    );
}

export default TaskDetailsPage;
