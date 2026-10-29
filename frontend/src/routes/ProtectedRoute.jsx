import { Navigate, Outlet, useLocation } from "react-router-dom";
import { isSignedIn } from "../context/AuthContext";
import { WebSocketProvider } from "../context/WebSocketContext";

// Pages under this route need a signed-in session; live sockets open only once there is one.
function ProtectedRoute() {
    const location = useLocation();
    if (!isSignedIn()) {
        const redirect = encodeURIComponent(location.pathname + location.search);
        return <Navigate to={`/login?redirect=${redirect}`} replace />;
    }
    return (
        <WebSocketProvider>
            <Outlet />
        </WebSocketProvider>
    );
}

export default ProtectedRoute;
