"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell, BellRing, BellOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useNotificationSocket, type NotificationDTO } from "./use-notification-socket";
import {
  getRecentNotificationsAction,
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from "@/lib/notifications/notification-actions";
import { subscribeToPushAction, unsubscribeFromPushAction } from "@/lib/notifications/push-actions";

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const base64Safe = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64Safe);
  return Uint8Array.from([...raw].map((char) => char.charCodeAt(0)));
}

type PushState = "unsupported" | "unsubscribed" | "subscribed" | "busy";

function usePushSubscription() {
  const [state, setState] = useState<PushState>("unsupported");

  useEffect(() => {
    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!publicKey || !("serviceWorker" in navigator) || !("PushManager" in window)) return;

    navigator.serviceWorker.getRegistration("/sw.js").then(async (registration) => {
      const subscription = await registration?.pushManager.getSubscription();
      setState(subscription ? "subscribed" : "unsubscribed");
    });
  }, []);

  async function subscribe() {
    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!publicKey) return;
    setState("busy");
    try {
      const registration = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
      const json = subscription.toJSON();
      if (json.endpoint && json.keys?.p256dh && json.keys?.auth) {
        await subscribeToPushAction({
          endpoint: json.endpoint,
          keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
        });
      }
      setState("subscribed");
    } catch (error) {
      console.error("Failed to subscribe to push notifications", error);
      setState("unsubscribed");
    }
  }

  async function unsubscribe() {
    setState("busy");
    try {
      const registration = await navigator.serviceWorker.getRegistration("/sw.js");
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        await unsubscribeFromPushAction(subscription.endpoint);
        await subscription.unsubscribe();
      }
      setState("unsubscribed");
    } catch (error) {
      console.error("Failed to unsubscribe from push notifications", error);
      setState("subscribed");
    }
  }

  return { state, subscribe, unsubscribe };
}

function timeAgo(iso: string) {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function NotificationBell({
  userId,
  joinToken,
  initialUnreadCount,
}: {
  userId: string;
  joinToken: string;
  initialUnreadCount: number;
}) {
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);
  const [notifications, setNotifications] = useState<NotificationDTO[] | null>(null);
  const [loading, setLoading] = useState(false);
  const push = usePushSubscription();

  useNotificationSocket(userId, joinToken, (notification) => {
    setUnreadCount((count) => count + 1);
    setNotifications((prev) => (prev ? [notification, ...prev].slice(0, 20) : prev));
  });

  async function handleOpenChange(open: boolean) {
    if (!open || notifications !== null) return;
    setLoading(true);
    try {
      const recent = await getRecentNotificationsAction();
      setNotifications(
        recent.map((n) => ({
          id: n.id,
          type: n.type,
          title: n.title,
          body: n.body,
          matchId: n.matchId,
          readAt: n.readAt ? n.readAt.toISOString() : null,
          createdAt: n.createdAt.toISOString(),
        }))
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleItemClick(notification: NotificationDTO) {
    if (!notification.readAt) {
      setUnreadCount((count) => Math.max(0, count - 1));
      setNotifications(
        (prev) =>
          prev?.map((n) =>
            n.id === notification.id ? { ...n, readAt: new Date().toISOString() } : n
          ) ?? prev
      );
      await markNotificationReadAction(notification.id);
    }
  }

  async function handleMarkAllRead() {
    if (unreadCount === 0) return;
    setUnreadCount(0);
    setNotifications((prev) => prev?.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })) ?? prev);
    await markAllNotificationsReadAction();
  }

  return (
    <DropdownMenu onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            className="relative h-9 w-9 rounded-full p-0 text-brand-base hover:bg-brand-base/10"
          />
        }
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-secondary px-1 text-[10px] font-bold text-brand-primary-dark">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <div className="flex items-center justify-between px-1.5 py-1">
          <span className="text-xs font-medium text-muted-foreground">Notifications</span>
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={handleMarkAllRead}
              className="text-xs font-medium text-brand-primary hover:underline"
            >
              Mark all read
            </button>
          )}
        </div>
        <DropdownMenuSeparator />

        {loading && notifications === null && (
          <p className="px-1.5 py-3 text-center text-sm text-muted-foreground">Loading...</p>
        )}
        {notifications !== null && notifications.length === 0 && (
          <p className="px-1.5 py-3 text-center text-sm text-muted-foreground">
            No notifications yet.
          </p>
        )}
        {notifications?.map((notification) => (
          <DropdownMenuItem
            key={notification.id}
            render={
              notification.matchId ? (
                <Link href={`/matches/${notification.matchId}`} />
              ) : (
                <div />
              )
            }
            onClick={() => handleItemClick(notification)}
            className="flex-col items-start gap-0.5 py-2"
          >
            <div className="flex w-full items-center gap-1.5">
              {!notification.readAt && (
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand-primary" />
              )}
              <span className="text-sm font-medium text-foreground">{notification.title}</span>
            </div>
            <span className="text-xs text-muted-foreground">{notification.body}</span>
            <span className="text-[11px] text-muted-foreground">{timeAgo(notification.createdAt)}</span>
          </DropdownMenuItem>
        ))}

        {push.state !== "unsupported" && (
          <>
            <DropdownMenuSeparator />
            <button
              type="button"
              disabled={push.state === "busy"}
              onClick={push.state === "subscribed" ? push.unsubscribe : push.subscribe}
              className="flex w-full items-center gap-2 rounded-md px-1.5 py-1.5 text-left text-xs font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground disabled:opacity-50"
            >
              {push.state === "subscribed" ? (
                <>
                  <BellOff className="h-3.5 w-3.5" />
                  Disable push notifications
                </>
              ) : (
                <>
                  <BellRing className="h-3.5 w-3.5" />
                  Enable push notifications
                </>
              )}
            </button>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
