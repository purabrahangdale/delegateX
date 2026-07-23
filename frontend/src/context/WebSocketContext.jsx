import { createContext, useContext, useEffect, useState } from "react";
import axios from "axios";
import { createDelegationSocket } from "../websocket/delegationSocket";
import { createCrmSocket } from "../websocket/crmSocket";
import { createNotificationSocket } from "../websocket/notificationSocket";
import { createWhatsappSocket } from "../websocket/whatsappSocket";

const WebSocketContext = createContext(null);

const API = import.meta.env.VITE_API_BASE_URL || "https://delegatex.onrender.com";

export const WebSocketProvider = ({ children }) => {
    const [delegationSocket, setDelegationSocket] = useState(null);
    const [crmSocket, setCrmSocket] = useState(null);
    const [notificationSocket, setNotificationSocket] = useState(null);
    const [whatsappSocket, setWhatsappSocket] = useState(null);
    const [notifications, setNotifications] = useState([]);
    const [isLoadingNotifications, setIsLoadingNotifications] = useState(true);

    const fetchNotifications = async () => {
        setIsLoadingNotifications(true);
        try {
            const res = await axios.get(`${API}/notifications`);
            setNotifications(res.data || []);
        } catch (err) {
            console.error("Failed to fetch notifications", err);
        } finally {
            setIsLoadingNotifications(false);
        }
    };

    useEffect(() => {
        const delSock = createDelegationSocket();
        const crmSock = createCrmSocket();
        const notifSock = createNotificationSocket();
        const whatsappSock = createWhatsappSocket();

        delSock.connect();
        crmSock.connect();
        notifSock.connect();
        whatsappSock.connect();

        setDelegationSocket(delSock);
        setCrmSocket(crmSock);
        setNotificationSocket(notifSock);
        setWhatsappSocket(whatsappSock);

        fetchNotifications();

        const handleNotificationEvent = (eventData) => {
            if (eventData.event === "notification_received") {
                setNotifications(prev => [eventData.data, ...prev]);
            } else if (eventData.event === "notification_read_update") {
                const { id, read } = eventData.data;
                setNotifications(prev =>
                    prev.map(n => (n._id === id ? { ...n, read } : n))
                );
            } else if (eventData.event === "notification_all_read") {
                setNotifications(prev => prev.map(n => ({ ...n, read: true })));
            } else if (eventData.event === "notification_deleted") {
                const { id } = eventData.data;
                setNotifications(prev => prev.filter(n => n._id !== id));
            }
        };

        notifSock.on("message", handleNotificationEvent);

        return () => {
            notifSock.off("message", handleNotificationEvent);
        };
    }, []);

    const markNotificationAsRead = async (id) => {
        try {
            await axios.put(`${API}/notifications/${id}/read`);
        } catch (err) {
            console.error("Failed to mark notification as read", err);
        }
    };

    const markAllNotificationsAsRead = async () => {
        try {
            await axios.put(`${API}/notifications/read-all`);
        } catch (err) {
            console.error("Failed to mark all notifications as read", err);
        }
    };

    const deleteNotification = async (id) => {
        try {
            await axios.delete(`${API}/notifications/${id}`);
        } catch (err) {
            console.error("Failed to delete notification", err);
        }
    };

    const unreadCount = notifications.filter(n => !n.read).length;

    return (
        <WebSocketContext.Provider
            value={{
                delegationSocket,
                crmSocket,
                notificationSocket,
                whatsappSocket,
                notifications,
                isLoadingNotifications,
                unreadCount,
                markNotificationAsRead,
                markAllNotificationsAsRead,
                deleteNotification,
                refreshNotifications: fetchNotifications
            }}
        >
            {children}
        </WebSocketContext.Provider>
    );
};

export const useWebSockets = () => {
    const context = useContext(WebSocketContext);
    if (!context) {
        throw new Error("useWebSockets must be used within a WebSocketProvider");
    }
    return context;
};
