"use client";

import { useState, useEffect, useRef } from "react";
import axios from "axios";
import Link from "next/link";
import {
  Bell,
  Award,
  MessageSquare,
  Megaphone,
  CheckCheck,
  Sparkles,
  ShieldCheck,
  Layers,
  Clock,
  Trash2,
  X,
} from "lucide-react";
import styles from "./css/notificationBell.module.css";

const BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";
const api = axios.create({ baseURL: BASE_URL, withCredentials: true });

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function timeAgo(dateString) {
  if (!dateString) return "just now";
  const seconds = Math.floor((new Date() - new Date(dateString)) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [subscribing, setSubscribing] = useState(false);
  const [clearing, setClearing] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Fetch notifications on mount & periodically
  useEffect(() => {
    fetchNotifications();
    checkPushSubscription();

    const interval = setInterval(fetchNotifications, 60000); // poll every 60s
    return () => clearInterval(interval);
  }, []);

  const fetchNotifications = async () => {
    try {
      const res = await api.get("/api/notifications/my-notifications");
      if (res.data?.success) {
        setNotifications(res.data.notifications || []);
        setUnreadCount(res.data.unreadCount || 0);
      }
    } catch (err) {
      // Ignore background fetch errors
    }
  };

  // Check if browser is currently subscribed to push
  const checkPushSubscription = async () => {
    if (
      typeof window === "undefined" ||
      !("serviceWorker" in navigator) ||
      !("PushManager" in window)
    ) {
      return;
    }

    try {
      if (typeof Notification !== "undefined" && Notification.permission === "granted") {
        await navigator.serviceWorker.register("/sw.js", { scope: "/" });
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        setIsSubscribed(!!sub);
      }
    } catch (err) {
      console.warn("Service worker check:", err);
    }
  };

  // Subscribe to Web Push Notifications
  const handleSubscribePush = async () => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window)) {
      alert("Web Push Notifications are not supported by this browser.");
      return;
    }

    try {
      setSubscribing(true);

      // 1. Request notification permission
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        alert("Notification permission was denied. Please enable notifications in your browser site settings.");
        return;
      }

      // 2. Register Service Worker with root scope and wait until ready
      await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      const reg = await navigator.serviceWorker.ready;

      // 3. Fetch VAPID public key from backend
      const keyRes = await api.get("/api/notifications/vapid-public-key");
      const publicKey = keyRes.data?.publicKey;
      if (!publicKey) throw new Error("Could not retrieve VAPID key from server.");

      // 4. If an existing subscription exists, unsubscribe it first to avoid key conflicts
      const existingSub = await reg.pushManager.getSubscription();
      if (existingSub) {
        try {
          await existingSub.unsubscribe();
        } catch (unsubErr) {
          console.warn("Unsubscribe stale subscription:", unsubErr);
        }
      }

      // 5. Subscribe to PushManager with converted VAPID key
      const convertedVapidKey = urlBase64ToUint8Array(publicKey);
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedVapidKey,
      });

      // 6. Send subscription to server
      await api.post("/api/notifications/subscribe", {
        subscription: sub.toJSON(),
        userAgent: navigator.userAgent,
      });

      setIsSubscribed(true);
      alert("✓ Web Push Notifications enabled! You will receive instant alerts on this device.");
    } catch (err) {
      console.error("Push subscription error:", err);
      if (err.name === "AbortError" || err.message?.includes("push service error")) {
        alert("Browser push service could not be reached. Please check your internet connection and ensure notifications are allowed for localhost in your browser settings.");
      } else {
        alert(err.response?.data?.message || err.message || "Failed to enable notifications.");
      }
    } finally {
      setSubscribing(false);
    }
  };

  // Mark all notifications as read
  const handleMarkAllRead = async () => {
    try {
      await api.put("/api/notifications/mark-read", { markAll: true });
      setUnreadCount(0);
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    } catch (err) {
      console.error("Mark all read error:", err);
    }
  };

  // Clear all notifications for user
  const handleClearAll = async (e) => {
    e.stopPropagation();
    try {
      setClearing(true);
      await api.put("/api/notifications/clear", { clearAll: true });
      setNotifications([]);
      setUnreadCount(0);
    } catch (err) {
      console.error("Clear all notifications error:", err);
    } finally {
      setClearing(false);
    }
  };

  // Clear single notification item
  const handleClearSingle = async (e, notifId) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await api.put("/api/notifications/clear", { notificationId: notifId });
      setNotifications((prev) => prev.filter((n) => n._id !== notifId));
      setUnreadCount((c) => {
        const wasUnread = notifications.find((n) => n._id === notifId && !n.isRead);
        return wasUnread ? Math.max(0, c - 1) : c;
      });
    } catch (err) {
      console.error("Clear notification error:", err);
    }
  };

  // Mark single notification as read
  const handleNotificationClick = async (notif) => {
    if (!notif.isRead) {
      try {
        await api.put("/api/notifications/mark-read", { notificationId: notif._id });
        setUnreadCount((c) => Math.max(0, c - 1));
        setNotifications((prev) =>
          prev.map((n) => (n._id === notif._id ? { ...n, isRead: true } : n))
        );
      } catch (err) {
        // ignore
      }
    }
    setOpen(false);
  };

  const getNotifIcon = (type) => {
    switch (type) {
      case "MARK_PUBLISHED":
        return { icon: Award, bg: "#eff6ff", color: "#2563eb" };
      case "FEEDBACK_REMINDER":
        return { icon: MessageSquare, bg: "#f0fdf4", color: "#16a34a" };
      case "ANNOUNCEMENT":
        return { icon: Megaphone, bg: "#fef3c7", color: "#b45309" };
      default:
        return { icon: Bell, bg: "#f1f5f9", color: "#475569" };
    }
  };

  return (
    <div className={styles.container} ref={dropdownRef} id="hide-on-pdf">
      {/* Bell Button */}
      <button
        type="button"
        className={styles.bellBtn}
        onClick={() => setOpen((prev) => !prev)}
        aria-label="Notifications"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className={styles.unreadBadge}>
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Drawer */}
      {open && (
        <div className={styles.dropdown}>
          {/* Header */}
          <div className={styles.dropdownHeader}>
            <div className={styles.headerTitle}>
              <Bell size={16} /> Notifications
              {unreadCount > 0 && (
                <span style={{ fontSize: "12px", background: "#ef4444", color: "#fff", padding: "1px 6px", borderRadius: "10px" }}>
                  {unreadCount} new
                </span>
              )}
            </div>

            <div className={styles.headerActions}>
              {unreadCount > 0 && (
                <button type="button" className={styles.markAllBtn} onClick={handleMarkAllRead}>
                  Mark read
                </button>
              )}

              {notifications.length > 0 && (
                <button
                  type="button"
                  className={styles.clearAllBtn}
                  onClick={handleClearAll}
                  disabled={clearing}
                  title="Clear all notifications"
                >
                  <Trash2 size={12} /> Clear all
                </button>
              )}
            </div>
          </div>

          {/* Push Permission Prompt / State */}
          <div className={styles.pushBanner}>
            {isSubscribed ? (
              <div className={styles.pushSubscribedBadge}>
                <ShieldCheck size={16} /> Push Alerts Active
              </div>
            ) : (
              <>
                <span>Get alerts on device</span>
                <button
                  type="button"
                  className={styles.enablePushBtn}
                  onClick={handleSubscribePush}
                  disabled={subscribing}
                >
                  <Bell size={13} /> {subscribing ? "Enabling..." : "Enable Push"}
                </button>
              </>
            )}
          </div>

          {/* Notifications List */}
          <div className={styles.notifList}>
            {notifications.length === 0 ? (
              <div className={styles.emptyState}>
                <Clock size={28} style={{ opacity: 0.4, margin: "0 auto 8px auto", display: "block" }} />
                No notifications yet.
              </div>
            ) : (
              notifications.map((n) => {
                const conf = getNotifIcon(n.type);
                const IconComponent = conf.icon;

                return (
                  <div
                    key={n._id}
                    className={`${styles.notifItem} ${!n.isRead ? styles.notifItemUnread : ""}`}
                  >
                    <Link
                      href={n.link || "#"}
                      style={{ display: "flex", flex: 1, textDecoration: "none", color: "inherit", gap: "12px", alignItems: "flex-start", minWidth: 0 }}
                      onClick={() => handleNotificationClick(n)}
                    >
                      <div className={styles.notifIconBox} style={{ background: conf.bg, color: conf.color }}>
                        <IconComponent size={18} />
                      </div>

                      <div className={styles.notifContent}>
                        <div className={styles.notifTitleRow}>
                          <span className={styles.notifTitle}>{n.title}</span>
                          <span className={styles.notifTime}>{timeAgo(n.createdAt)}</span>
                        </div>
                        <div className={styles.notifMessage}>{n.message}</div>
                      </div>
                    </Link>

                    {/* Single Item Clear Button */}
                    <button
                      type="button"
                      className={styles.clearItemBtn}
                      onClick={(e) => handleClearSingle(e, n._id)}
                      title="Clear this notification"
                    >
                      <X size={14} />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
