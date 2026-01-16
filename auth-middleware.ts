import { Request, Response, NextFunction } from "express";
import { type UserRole, type Permission, hasPermission, USER_ROLES } from "@shared/permissions";

export interface AuthenticatedUser {
  id: string;
  username: string;
  role: UserRole;
  staffId?: string;
  displayName?: string;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

export function isValidRole(role: string): role is UserRole {
  return USER_ROLES.includes(role as UserRole);
}

export function getRequestUser(req: Request): AuthenticatedUser | undefined {
  return (req as AuthenticatedRequest).user;
}

export function setRequestUser(req: Request, user: AuthenticatedUser): void {
  (req as AuthenticatedRequest).user = user;
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const user = getRequestUser(req);
  if (!user) {
    return res.status(401).json({ error: "Authentication required" });
  }
  next();
}

export function requirePermission(permission: Permission) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = getRequestUser(req);
    
    if (!user) {
      return res.status(401).json({ error: "Authentication required" });
    }

    if (!user.role) {
      return res.status(401).json({ error: "User role not found" });
    }

    if (!isValidRole(user.role)) {
      return res.status(403).json({ error: "Invalid user role" });
    }

    if (!hasPermission(user.role, permission)) {
      return res.status(403).json({ 
        error: "Permission denied",
        required: permission,
        userRole: user.role,
      });
    }

    next();
  };
}

export function requireAnyPermission(permissions: Permission[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = getRequestUser(req);
    
    if (!user) {
      return res.status(401).json({ error: "Authentication required" });
    }

    if (!user.role) {
      return res.status(401).json({ error: "User role not found" });
    }

    if (!isValidRole(user.role)) {
      return res.status(403).json({ error: "Invalid user role" });
    }

    const hasAny = permissions.some(p => hasPermission(user.role, p));
    if (!hasAny) {
      return res.status(403).json({ 
        error: "Permission denied",
        required: permissions,
        userRole: user.role,
      });
    }

    next();
  };
}

export function requireRole(roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = getRequestUser(req);
    
    if (!user) {
      return res.status(401).json({ error: "Authentication required" });
    }

    if (!user.role) {
      return res.status(401).json({ error: "User role not found" });
    }

    if (!roles.includes(user.role)) {
      return res.status(403).json({ 
        error: "Role not authorized",
        required: roles,
        userRole: user.role,
      });
    }

    next();
  };
}
