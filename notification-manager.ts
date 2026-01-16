interface NotificationConfig {
  title: string;
  body: string;
  icon?: string;
  tag?: string;
  requireInteraction?: boolean;
  data?: any;
}

type NotificationPermission = "granted" | "denied" | "default";

class NotificationManager {
  private permission: NotificationPermission = "default";
  private callbacks: Map<string, (data: any) => void> = new Map();

  constructor() {
    if ("Notification" in window) {
      this.permission = Notification.permission as NotificationPermission;
    }
  }

  async requestPermission(): Promise<NotificationPermission> {
    if (!("Notification" in window)) {
      console.warn("Notifications not supported");
      return "denied";
    }

    if (this.permission === "granted") {
      return "granted";
    }

    try {
      const result = await Notification.requestPermission();
      this.permission = result as NotificationPermission;
      return this.permission;
    } catch (e) {
      console.error("Failed to request notification permission:", e);
      return "denied";
    }
  }

  isSupported(): boolean {
    return "Notification" in window;
  }

  isGranted(): boolean {
    return this.permission === "granted";
  }

  async show(config: NotificationConfig): Promise<Notification | null> {
    if (!this.isSupported()) {
      console.warn("Notifications not supported");
      return null;
    }

    if (this.permission !== "granted") {
      const result = await this.requestPermission();
      if (result !== "granted") {
        console.warn("Notification permission denied");
        return null;
      }
    }

    try {
      const notification = new Notification(config.title, {
        body: config.body,
        icon: config.icon || "/favicon.ico",
        tag: config.tag,
        requireInteraction: config.requireInteraction || false,
        data: config.data,
      });

      notification.onclick = () => {
        window.focus();
        notification.close();
        
        if (config.tag && this.callbacks.has(config.tag)) {
          this.callbacks.get(config.tag)?.(config.data);
        }
      };

      return notification;
    } catch (e) {
      console.error("Failed to show notification:", e);
      return null;
    }
  }

  onNotificationClick(tag: string, callback: (data: any) => void): void {
    this.callbacks.set(tag, callback);
  }

  removeClickHandler(tag: string): void {
    this.callbacks.delete(tag);
  }

  notifyApprovalNeeded(clientName: string, approvalType: string): Promise<Notification | null> {
    return this.show({
      title: "Approval Needed",
      body: `${clientName} requires ${approvalType} approval`,
      tag: "approval",
      requireInteraction: true,
      data: { type: "approval", clientName, approvalType },
    });
  }

  notifyScheduleConflict(staffName: string, details: string): Promise<Notification | null> {
    return this.show({
      title: "Schedule Conflict",
      body: `${staffName}: ${details}`,
      tag: "conflict",
      requireInteraction: true,
      data: { type: "conflict", staffName, details },
    });
  }

  notifyScheduleReady(): Promise<Notification | null> {
    return this.show({
      title: "Schedule Ready",
      body: "Today's schedule has been generated and is ready for review",
      tag: "schedule-ready",
      data: { type: "schedule-ready" },
    });
  }
}

export const notificationManager = new NotificationManager();

export function useNotifications() {
  return {
    isSupported: notificationManager.isSupported(),
    isGranted: notificationManager.isGranted(),
    requestPermission: () => notificationManager.requestPermission(),
    notifyApprovalNeeded: notificationManager.notifyApprovalNeeded.bind(notificationManager),
    notifyScheduleConflict: notificationManager.notifyScheduleConflict.bind(notificationManager),
    notifyScheduleReady: notificationManager.notifyScheduleReady.bind(notificationManager),
    onNotificationClick: notificationManager.onNotificationClick.bind(notificationManager),
  };
}
