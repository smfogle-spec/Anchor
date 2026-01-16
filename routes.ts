import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { 
  insertStaffSchema, 
  insertClientSchema, 
  insertClientLocationSchema,
  insertSchoolSchema,
  insertTemplateAssignmentSchema,
  insertScheduleChangeSchema,
  insertDailyScheduleSchema,
  insertTrainingPlanSchema,
  insertTrainingSessionSchema,
  insertClientSkipHistorySchema,
  insertIdealDayTemplateSchema,
  insertIdealDaySegmentSchema,
  insertIdealDayLunchPairingSchema,
  insertTemplateLunchPairingGroupSchema,
  getStageSequence,
  type TrainingStyleType
} from "@shared/schema";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // ===== SCHOOL ROUTES =====
  
  // Get all schools
  app.get("/api/schools", async (req, res) => {
    try {
      const allSchools = await storage.getAllSchools();
      res.json(allSchools);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch schools" });
    }
  });
  
  // Get single school
  app.get("/api/schools/:id", async (req, res) => {
    try {
      const school = await storage.getSchool(req.params.id);
      if (!school) {
        return res.status(404).json({ error: "School not found" });
      }
      res.json(school);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch school" });
    }
  });
  
  // Create school
  app.post("/api/schools", async (req, res) => {
    try {
      const validated = insertSchoolSchema.parse(req.body);
      const newSchool = await storage.createSchool(validated);
      res.status(201).json(newSchool);
    } catch (error) {
      res.status(400).json({ error: "Invalid school data", details: error });
    }
  });
  
  // Update school
  app.patch("/api/schools/:id", async (req, res) => {
    try {
      const validated = insertSchoolSchema.partial().parse(req.body);
      const updated = await storage.updateSchool(req.params.id, validated);
      if (!updated) {
        return res.status(404).json({ error: "School not found" });
      }
      res.json(updated);
    } catch (error) {
      res.status(400).json({ error: "Invalid school data", details: error });
    }
  });
  
  // Delete school
  app.delete("/api/schools/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteSchool(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "School not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete school" });
    }
  });
  
  // ===== STAFF ROUTES =====
  
  // Get all staff
  app.get("/api/staff", async (req, res) => {
    try {
      const allStaff = await storage.getAllStaff();
      res.json(allStaff);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch staff" });
    }
  });
  
  // Get single staff
  app.get("/api/staff/:id", async (req, res) => {
    try {
      const staff = await storage.getStaff(req.params.id);
      if (!staff) {
        return res.status(404).json({ error: "Staff not found" });
      }
      res.json(staff);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch staff" });
    }
  });
  
  // Create staff
  app.post("/api/staff", async (req, res) => {
    try {
      const validated = insertStaffSchema.parse(req.body);
      const newStaff = await storage.createStaff(validated);
      res.status(201).json(newStaff);
    } catch (error) {
      res.status(400).json({ error: "Invalid staff data", details: error });
    }
  });
  
  // Update staff
  app.patch("/api/staff/:id", async (req, res) => {
    try {
      const validated = insertStaffSchema.partial().parse(req.body);
      const updated = await storage.updateStaff(req.params.id, validated);
      if (!updated) {
        return res.status(404).json({ error: "Staff not found" });
      }
      res.json(updated);
    } catch (error) {
      res.status(400).json({ error: "Invalid staff data", details: error });
    }
  });
  
  // Delete staff
  app.delete("/api/staff/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteStaff(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Staff not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete staff" });
    }
  });
  
  // ===== CLIENT ROUTES =====
  
  // Get all clients
  app.get("/api/clients", async (req, res) => {
    try {
      const allClients = await storage.getAllClients();
      res.json(allClients);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch clients" });
    }
  });
  
  // Get single client
  app.get("/api/clients/:id", async (req, res) => {
    try {
      const client = await storage.getClient(req.params.id);
      if (!client) {
        return res.status(404).json({ error: "Client not found" });
      }
      res.json(client);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch client" });
    }
  });
  
  // Create client
  app.post("/api/clients", async (req, res) => {
    try {
      const validated = insertClientSchema.parse(req.body);
      const newClient = await storage.createClient(validated);
      res.status(201).json(newClient);
    } catch (error) {
      res.status(400).json({ error: "Invalid client data", details: error });
    }
  });
  
  // Update client
  app.patch("/api/clients/:id", async (req, res) => {
    try {
      const validated = insertClientSchema.partial().parse(req.body);
      
      // Use transactional update that handles reciprocal peer relationships
      const updated = await storage.updateClientWithReciprocalPeers(req.params.id, validated);
      if (!updated) {
        return res.status(404).json({ error: "Client not found" });
      }
      res.json(updated);
    } catch (error) {
      res.status(400).json({ error: "Invalid client data", details: error });
    }
  });
  
  // Delete client
  app.delete("/api/clients/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteClient(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Client not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete client" });
    }
  });
  
  // ===== CLIENT CANCEL LINKS ROUTES =====
  
  // Get all cancel links
  app.get("/api/client-cancel-links", async (req, res) => {
    try {
      const allLinks = await storage.getAllClientCancelLinks();
      res.json(allLinks);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch cancel links" });
    }
  });
  
  // Get cancel links for a specific client
  app.get("/api/clients/:clientId/cancel-links", async (req, res) => {
    try {
      const links = await storage.getClientCancelLinks(req.params.clientId);
      res.json(links);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch cancel links" });
    }
  });
  
  // Set cancel links for a client (bidirectional - creates/removes links for both sides)
  app.put("/api/clients/:clientId/cancel-links", async (req, res) => {
    try {
      const { linkedClientIds } = req.body;
      if (!Array.isArray(linkedClientIds)) {
        return res.status(400).json({ error: "linkedClientIds must be an array" });
      }
      const links = await storage.setClientCancelLinks(req.params.clientId, linkedClientIds);
      res.json(links);
    } catch (error) {
      res.status(500).json({ error: "Failed to update cancel links" });
    }
  });
  
  // ===== CLIENT HISTORY ROUTES =====
  
  // Get cancel history for a client
  app.get("/api/clients/:clientId/history/cancels", async (req, res) => {
    try {
      const history = await storage.getClientCancelHistory(req.params.clientId);
      res.json(history);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch cancel history" });
    }
  });
  
  // Get all cancel history
  app.get("/api/client-cancel-history", async (req, res) => {
    try {
      const history = await storage.getAllClientCancelHistory();
      res.json(history);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch cancel history" });
    }
  });
  
  // Create cancel history entry
  app.post("/api/client-cancel-history", async (req, res) => {
    try {
      const history = await storage.createClientCancelHistory(req.body);
      res.status(201).json(history);
    } catch (error) {
      res.status(500).json({ error: "Failed to create cancel history" });
    }
  });
  
  // Delete cancel history entry
  app.delete("/api/client-cancel-history/:id", async (req, res) => {
    try {
      const success = await storage.deleteClientCancelHistory(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Cancel history not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete cancel history" });
    }
  });
  
  // Get sub history for a client
  app.get("/api/clients/:clientId/history/subs", async (req, res) => {
    try {
      const history = await storage.getClientSubHistory(req.params.clientId);
      res.json(history);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch sub history" });
    }
  });
  
  // Get all sub history
  app.get("/api/client-sub-history", async (req, res) => {
    try {
      const history = await storage.getAllClientSubHistory();
      res.json(history);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch sub history" });
    }
  });
  
  // Create sub history entry
  app.post("/api/client-sub-history", async (req, res) => {
    try {
      const history = await storage.createClientSubHistory(req.body);
      res.status(201).json(history);
    } catch (error) {
      res.status(500).json({ error: "Failed to create sub history" });
    }
  });
  
  // Delete sub history entry
  app.delete("/api/client-sub-history/:id", async (req, res) => {
    try {
      const success = await storage.deleteClientSubHistory(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Sub history not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete sub history" });
    }
  });
  
  // Get skip history for a client
  app.get("/api/clients/:clientId/history/skips", async (req, res) => {
    try {
      const history = await storage.getClientSkipHistory(req.params.clientId);
      res.json(history);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch skip history" });
    }
  });
  
  // Get all skip history
  app.get("/api/client-skip-history", async (req, res) => {
    try {
      const history = await storage.getAllClientSkipHistory();
      res.json(history);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch skip history" });
    }
  });
  
  // Create skip history entry
  app.post("/api/client-skip-history", async (req, res) => {
    try {
      const parsed = insertClientSkipHistorySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid skip history data", details: parsed.error.errors });
      }
      const history = await storage.createClientSkipHistory(parsed.data);
      res.status(201).json(history);
    } catch (error) {
      res.status(500).json({ error: "Failed to create skip history" });
    }
  });
  
  // Delete skip history entry
  app.delete("/api/client-skip-history/:id", async (req, res) => {
    try {
      const success = await storage.deleteClientSkipHistory(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Skip history not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete skip history" });
    }
  });
  
  // ===== DAILY RUN FINALIZATION =====
  
  // Finalize daily run - persist cancellations, subs, and update client metrics
  app.post("/api/daily-run/finalize", async (req, res) => {
    try {
      const { 
        date, 
        cancellations = [], 
        subs = [],
        skippedClients = [],
        attendedClients = [],
        absentClients = []
      }: {
        date: string;
        cancellations: { clientId: string; timeBlock: string; reason?: string }[];
        subs: { clientId: string; timeBlock: string; subStaffId: string; originalStaffId?: string }[];
        skippedClients: { clientId: string; skipReason: string }[];
        attendedClients: string[];
        absentClients: string[]; // Clients who were scheduled but didn't attend (not cancelled)
      } = req.body;
      
      if (!date) {
        return res.status(400).json({ error: "Date is required" });
      }
      
      const results = {
        cancelHistoryCreated: 0,
        subHistoryCreated: 0,
        skipHistoryCreated: 0,
        clientsUpdated: 0,
        skipsApplied: 0,
        absentResets: 0
      };
      
      // Create cancel history entries and update lastCanceledDate
      for (const cancel of cancellations) {
        await storage.createClientCancelHistory({
          clientId: cancel.clientId,
          date,
          timeBlock: cancel.timeBlock,
          reason: cancel.reason || null
        });
        results.cancelHistoryCreated++;
        
        // Update client lastCanceledDate, clear skip tracker, and reset return tracking
        // Cancellation counts as non-attendance, so the consecutive return streak resets
        await storage.updateClient(cancel.clientId, {
          lastCanceledDate: date,
          cancelSkipUsed: false,
          lastSkippedDate: null,
          daysBackSinceAbsence: 0 // Reset return streak - must be 3 CONSECUTIVE attended days
        });
        results.clientsUpdated++;
      }
      
      // Create sub history entries
      for (const sub of subs) {
        await storage.createClientSubHistory({
          clientId: sub.clientId,
          date,
          timeBlock: sub.timeBlock,
          subStaffId: sub.subStaffId,
          originalStaffId: sub.originalStaffId || null
        });
        results.subHistoryCreated++;
      }
      
      // Create skip history entries and update skip tracker for skipped clients
      for (const skip of skippedClients) {
        // Always create skip history entry for tracking
        await storage.createClientSkipHistory({
          clientId: skip.clientId,
          date,
          skipReason: skip.skipReason
        });
        results.skipHistoryCreated++;
        
        // Update skip tracker for 2-sessions/week rule
        if (skip.skipReason.includes("2-sessions/week")) {
          await storage.updateClient(skip.clientId, {
            cancelSkipUsed: true,
            lastSkippedDate: date
          });
          results.skipsApplied++;
        }
      }
      
      // Handle absent clients (scheduled but didn't attend) - increment absence counter, reset days back
      for (const clientId of absentClients) {
        const client = await storage.getClient(clientId);
        if (!client) continue;
        
        // Increment consecutive absent days and reset return tracking
        await storage.updateClient(clientId, {
          consecutiveAbsentDays: (client.consecutiveAbsentDays ?? 0) + 1,
          daysBackSinceAbsence: 0 // Reset return counter - must be 3 CONSECUTIVE days
        });
      }
      
      // Handle attendance tracking for clients
      for (const clientId of attendedClients) {
        const client = await storage.getClient(clientId);
        if (!client) continue;
        
        // If client had 5+ consecutive absent days
        if (client.consecutiveAbsentDays >= 5) {
          // Increment days back since absence
          const newDaysBack = (client.daysBackSinceAbsence ?? 0) + 1;
          
          if (newDaysBack >= 3) {
            // After 3 CONSECUTIVE days back, reset both counters - skip protection removed
            await storage.updateClient(clientId, {
              consecutiveAbsentDays: 0,
              daysBackSinceAbsence: 0
            });
            results.absentResets++;
          } else {
            // Still tracking return days
            await storage.updateClient(clientId, {
              daysBackSinceAbsence: newDaysBack
            });
          }
        } else if (client.consecutiveAbsentDays > 0) {
          // If was absent less than 5 days, just reset
          await storage.updateClient(clientId, {
            consecutiveAbsentDays: 0,
            daysBackSinceAbsence: 0
          });
          results.absentResets++;
        }
      }
      
      res.json({
        success: true,
        message: "Daily run finalized successfully",
        results
      });
    } catch (error) {
      console.error("Failed to finalize daily run:", error);
      res.status(500).json({ error: "Failed to finalize daily run" });
    }
  });
  
  // ===== CLIENT LOCATIONS ROUTES =====
  
  // Get all client locations
  app.get("/api/client-locations", async (req, res) => {
    try {
      const allLocations = await storage.getAllClientLocations();
      res.json(allLocations);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch client locations" });
    }
  });
  
  // Get locations for a specific client
  app.get("/api/clients/:clientId/locations", async (req, res) => {
    try {
      const locations = await storage.getClientLocations(req.params.clientId);
      res.json(locations);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch client locations" });
    }
  });
  
  // Get template assignments for a specific client
  app.get("/api/clients/:clientId/template-assignments", async (req, res) => {
    try {
      const assignments = await storage.getTemplateAssignmentsByClient(req.params.clientId);
      res.json(assignments);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch template assignments" });
    }
  });
  
  // Create client location
  app.post("/api/client-locations", async (req, res) => {
    try {
      const validated = insertClientLocationSchema.parse(req.body);
      const newLocation = await storage.createClientLocation(validated);
      res.status(201).json(newLocation);
    } catch (error) {
      res.status(400).json({ error: "Invalid location data", details: error });
    }
  });
  
  // Update client location
  app.patch("/api/client-locations/:id", async (req, res) => {
    try {
      const validated = insertClientLocationSchema.partial().parse(req.body);
      const updated = await storage.updateClientLocation(req.params.id, validated);
      if (!updated) {
        return res.status(404).json({ error: "Location not found" });
      }
      res.json(updated);
    } catch (error) {
      res.status(400).json({ error: "Invalid location data", details: error });
    }
  });
  
  // Delete client location
  app.delete("/api/client-locations/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteClientLocation(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Location not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete location" });
    }
  });
  
  // ===== CLIENT LOCATION STAFF APPROVALS ROUTES =====
  
  // Get all location staff approvals
  app.get("/api/location-staff-approvals", async (req, res) => {
    try {
      const allApprovals = await storage.getAllLocationStaffApprovals();
      res.json(allApprovals);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch location staff approvals" });
    }
  });
  
  // Get staff approvals for a specific location
  app.get("/api/location-staff-approvals/:locationId", async (req, res) => {
    try {
      const approvals = await storage.getLocationStaffApprovals(req.params.locationId);
      res.json(approvals);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch staff approvals" });
    }
  });
  
  // Set staff approvals for a location (replaces all existing)
  app.put("/api/location-staff-approvals/:locationId", async (req, res) => {
    try {
      const { staffIds } = req.body;
      if (!Array.isArray(staffIds)) {
        return res.status(400).json({ error: "Expected staffIds array" });
      }
      const approvals = await storage.setLocationStaffApprovals(req.params.locationId, staffIds);
      res.json(approvals);
    } catch (error) {
      res.status(500).json({ error: "Failed to update staff approvals" });
    }
  });
  
  // ===== CM SUPERVISION LINKS ROUTES =====
  
  // Get all CM-Lead BCBA links
  app.get("/api/cm-lead-bcba-links", async (req, res) => {
    try {
      const links = await storage.getAllCmLeadBcbaLinks();
      res.json(links);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch CM-Lead BCBA links" });
    }
  });
  
  // Get Lead BCBA links for a specific CM
  app.get("/api/cm-lead-bcba-links/:cmId", async (req, res) => {
    try {
      const links = await storage.getCmLeadBcbaLinks(req.params.cmId);
      res.json(links);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch Lead BCBA links" });
    }
  });
  
  // Set Lead BCBA links for a CM (replaces all existing)
  app.put("/api/cm-lead-bcba-links/:cmId", async (req, res) => {
    try {
      const { leadBcbaIds } = req.body;
      if (!Array.isArray(leadBcbaIds)) {
        return res.status(400).json({ error: "Expected leadBcbaIds array" });
      }
      const links = await storage.setCmLeadBcbaLinks(req.params.cmId, leadBcbaIds);
      res.json(links);
    } catch (error) {
      res.status(500).json({ error: "Failed to update Lead BCBA links" });
    }
  });
  
  // Get all CM-Admin links
  app.get("/api/cm-admin-links", async (req, res) => {
    try {
      const links = await storage.getAllCmAdminLinks();
      res.json(links);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch CM-Admin links" });
    }
  });
  
  // Get Admin links for a specific CM
  app.get("/api/cm-admin-links/:cmId", async (req, res) => {
    try {
      const links = await storage.getCmAdminLinks(req.params.cmId);
      res.json(links);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch Admin links" });
    }
  });
  
  // Set Admin links for a CM (replaces all existing)
  app.put("/api/cm-admin-links/:cmId", async (req, res) => {
    try {
      const { adminIds } = req.body;
      if (!Array.isArray(adminIds)) {
        return res.status(400).json({ error: "Expected adminIds array" });
      }
      const links = await storage.setCmAdminLinks(req.params.cmId, adminIds);
      res.json(links);
    } catch (error) {
      res.status(500).json({ error: "Failed to update Admin links" });
    }
  });
  
  // Get all Lead RBT-BCBA links
  app.get("/api/lead-rbt-bcba-links", async (req, res) => {
    try {
      const links = await storage.getAllLeadRbtBcbaLinks();
      res.json(links);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch Lead RBT-BCBA links" });
    }
  });
  
  // Get BCBA links for a specific Lead RBT
  app.get("/api/lead-rbt-bcba-links/:leadRbtId", async (req, res) => {
    try {
      const links = await storage.getLeadRbtBcbaLinks(req.params.leadRbtId);
      res.json(links);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch BCBA links" });
    }
  });
  
  // Set BCBA links for a Lead RBT (replaces all existing)
  app.put("/api/lead-rbt-bcba-links/:leadRbtId", async (req, res) => {
    try {
      const { bcbaIds } = req.body;
      if (!Array.isArray(bcbaIds)) {
        return res.status(400).json({ error: "Expected bcbaIds array" });
      }
      const links = await storage.setLeadRbtBcbaLinks(req.params.leadRbtId, bcbaIds);
      res.json(links);
    } catch (error) {
      res.status(500).json({ error: "Failed to update BCBA links" });
    }
  });
  
  // ===== TEMPLATE ROUTES =====
  
  // Get all template assignments
  app.get("/api/template", async (req, res) => {
    try {
      const allAssignments = await storage.getAllTemplateAssignments();
      res.json(allAssignments);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch template" });
    }
  });
  
  // Get template assignments by day
  app.get("/api/template/:weekDay", async (req, res) => {
    try {
      const assignments = await storage.getTemplateAssignmentsByDay(req.params.weekDay);
      res.json(assignments);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch template for day" });
    }
  });
  
  // Bulk upsert template (replace all) with optional focus staff updates
  app.post("/api/template/bulk", async (req, res) => {
    try {
      const assignments = req.body.assignments;
      const focusUpdates = req.body.focusUpdates || []; // { clientId, staffIdsToAdd }[]
      
      if (!Array.isArray(assignments)) {
        return res.status(400).json({ error: "Expected assignments array" });
      }
      
      // Validate each assignment and collect errors
      const validationErrors: string[] = [];
      const validated = assignments.map((a, index) => {
        try {
          return insertTemplateAssignmentSchema.parse(a);
        } catch (parseError: any) {
          const errorMsg = parseError?.errors?.[0]?.message || parseError?.message || "Invalid data";
          validationErrors.push(`Assignment ${index}: ${errorMsg}`);
          return null;
        }
      }).filter(Boolean);
      
      if (validationErrors.length > 0) {
        console.error("Template validation errors:", validationErrors);
        return res.status(400).json({ 
          error: "Some assignments have invalid data", 
          details: validationErrors.slice(0, 5).join("; ") // Limit to first 5 errors
        });
      }
      
      // If focus updates provided, use transactional method
      if (focusUpdates.length > 0) {
        const result = await storage.bulkUpsertTemplateWithFocusUpdates(validated as any[], focusUpdates);
        res.json({ 
          assignments: result.assignments, 
          focusUpdatesApplied: result.focusUpdatesApplied,
          staffRemovedFromFocus: result.staffRemovedFromFocus
        });
      } else {
        // No focus updates, use simple method (still automatically removes completely-removed staff from focus lists)
        const result = await storage.bulkUpsertTemplateAssignments(validated as any[]);
        res.json({ 
          assignments: result.assignments, 
          focusUpdatesApplied: 0,
          staffRemovedFromFocus: result.staffRemovedFromFocus
        });
      }
    } catch (error: any) {
      console.error("Template bulk save error:", error);
      const errorMessage = error?.message || "Unknown error saving template";
      res.status(500).json({ error: errorMessage });
    }
  });
  
  // Create single template assignment
  app.post("/api/template", async (req, res) => {
    try {
      const validated = insertTemplateAssignmentSchema.parse(req.body);
      const newAssignment = await storage.createTemplateAssignment(validated);
      res.status(201).json(newAssignment);
    } catch (error) {
      res.status(400).json({ error: "Invalid template assignment", details: error });
    }
  });
  
  // Update template assignment
  app.patch("/api/template/:id", async (req, res) => {
    try {
      const validated = insertTemplateAssignmentSchema.partial().parse(req.body);
      const updated = await storage.updateTemplateAssignment(req.params.id, validated);
      if (!updated) {
        return res.status(404).json({ error: "Assignment not found" });
      }
      res.json(updated);
    } catch (error) {
      res.status(400).json({ error: "Invalid template assignment", details: error });
    }
  });
  
  // Delete template assignment
  app.delete("/api/template/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteTemplateAssignment(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Assignment not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete assignment" });
    }
  });
  
  // ===== SCHEDULE CHANGES (CHANGE LOG) ROUTES =====
  
  // Get schedule changes (optionally by date)
  app.get("/api/schedule-changes", async (req, res) => {
    try {
      const date = req.query.date as string | undefined;
      const changes = await storage.getScheduleChanges(date);
      res.json(changes);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch schedule changes" });
    }
  });
  
  // Create schedule changes (bulk)
  app.post("/api/schedule-changes", async (req, res) => {
    try {
      const changes = req.body.changes;
      if (!Array.isArray(changes)) {
        return res.status(400).json({ error: "Expected changes array" });
      }
      
      const validated = changes.map(c => insertScheduleChangeSchema.parse(c));
      const result = await storage.createScheduleChanges(validated);
      res.status(201).json(result);
    } catch (error) {
      res.status(400).json({ error: "Invalid schedule change data", details: error });
    }
  });
  
  // Delete schedule changes by date
  app.delete("/api/schedule-changes/:date", async (req, res) => {
    try {
      await storage.deleteScheduleChangesByDate(req.params.date);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete schedule changes" });
    }
  });
  
  // ===== DAILY SCHEDULES (VERSIONED) ROUTES =====
  
  // Get latest schedule for a date
  app.get("/api/schedules/:date/latest", async (req, res) => {
    try {
      const schedule = await storage.getLatestSchedule(req.params.date);
      if (!schedule) {
        return res.status(404).json({ error: "No schedule found for this date" });
      }
      res.json(schedule);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch schedule" });
    }
  });
  
  // Get all versions for a date
  app.get("/api/schedules/:date/versions", async (req, res) => {
    try {
      const versions = await storage.getScheduleVersions(req.params.date);
      res.json(versions);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch schedule versions" });
    }
  });
  
  // Get specific version for a date
  app.get("/api/schedules/:date/version/:version", async (req, res) => {
    try {
      const version = parseInt(req.params.version, 10);
      const schedule = await storage.getScheduleByVersion(req.params.date, version);
      if (!schedule) {
        return res.status(404).json({ error: "Version not found" });
      }
      res.json(schedule);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch schedule version" });
    }
  });
  
  // Create new schedule version (generate from previous or template)
  app.post("/api/schedules/:date/generate", async (req, res) => {
    try {
      const date = req.params.date;
      const { snapshot, label, derivedFromVersion } = req.body;
      
      const nextVersion = await storage.getNextVersionNumber(date);
      
      const newSchedule = await storage.createScheduleVersion({
        date,
        version: nextVersion,
        snapshot,
        label: label || "generated",
        derivedFromVersion: derivedFromVersion || null
      });
      
      res.status(201).json(newSchedule);
    } catch (error) {
      res.status(400).json({ error: "Failed to create schedule", details: error });
    }
  });
  
  // Hard reset - create a fresh version from template (version 0 baseline)
  app.post("/api/schedules/:date/reset", async (req, res) => {
    try {
      const date = req.params.date;
      const { snapshot } = req.body;
      
      const nextVersion = await storage.getNextVersionNumber(date);
      
      const newSchedule = await storage.createScheduleVersion({
        date,
        version: nextVersion,
        snapshot,
        label: "reset",
        derivedFromVersion: 0 // Derived from template (version 0)
      });
      
      res.status(201).json(newSchedule);
    } catch (error) {
      res.status(400).json({ error: "Failed to reset schedule", details: error });
    }
  });
  
  // Rewind - restore a previous version
  app.post("/api/schedules/:date/rewind/:targetVersion", async (req, res) => {
    try {
      const date = req.params.date;
      const targetVersion = parseInt(req.params.targetVersion, 10);
      
      const targetSchedule = await storage.getScheduleByVersion(date, targetVersion);
      if (!targetSchedule) {
        return res.status(404).json({ error: "Target version not found" });
      }
      
      const nextVersion = await storage.getNextVersionNumber(date);
      
      const newSchedule = await storage.createScheduleVersion({
        date,
        version: nextVersion,
        snapshot: targetSchedule.snapshot as object,
        label: `rewind to v${targetVersion}`,
        derivedFromVersion: targetVersion
      });
      
      res.status(201).json(newSchedule);
    } catch (error) {
      res.status(400).json({ error: "Failed to rewind schedule", details: error });
    }
  });

  // ===== TRAINING PLAN ROUTES =====
  
  // Get all training plans
  app.get("/api/training-plans", async (req, res) => {
    try {
      const trackType = req.query.trackType as string | undefined;
      let plans;
      if (trackType) {
        plans = await storage.getTrainingPlansByTrack(trackType);
      } else {
        plans = await storage.getAllTrainingPlans();
      }
      res.json(plans);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch training plans" });
    }
  });
  
  // Get single training plan with sessions
  app.get("/api/training-plans/:id", async (req, res) => {
    try {
      const plan = await storage.getTrainingPlan(req.params.id);
      if (!plan) {
        return res.status(404).json({ error: "Training plan not found" });
      }
      const sessions = await storage.getTrainingSessions(plan.id);
      res.json({ ...plan, sessions });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch training plan" });
    }
  });
  
  // Create training plan with auto-generated sessions
  app.post("/api/training-plans", async (req, res) => {
    try {
      const validated = insertTrainingPlanSchema.parse(req.body);
      const plan = await storage.createTrainingPlan(validated);
      
      // Auto-generate training sessions based on style
      const stages = getStageSequence(validated.trainingStyle as TrainingStyleType);
      const sessions = stages.map((stageType, index) => ({
        planId: plan.id,
        stageType,
        stageOrder: index + 1,
        status: "planned" as const
      }));
      
      const createdSessions = await storage.createTrainingSessions(sessions);
      
      res.status(201).json({ ...plan, sessions: createdSessions });
    } catch (error) {
      res.status(400).json({ error: "Invalid training plan data", details: error });
    }
  });
  
  // Update training plan
  app.patch("/api/training-plans/:id", async (req, res) => {
    try {
      const validated = insertTrainingPlanSchema.partial().parse(req.body);
      
      // If training style changed, regenerate sessions
      if (validated.trainingStyle) {
        await storage.deleteTrainingSessionsByPlan(req.params.id);
        const stages = getStageSequence(validated.trainingStyle as TrainingStyleType);
        const sessions = stages.map((stageType, index) => ({
          planId: req.params.id,
          stageType,
          stageOrder: index + 1,
          status: "planned" as const
        }));
        await storage.createTrainingSessions(sessions);
      }
      
      const updated = await storage.updateTrainingPlan(req.params.id, validated);
      if (!updated) {
        return res.status(404).json({ error: "Training plan not found" });
      }
      
      const sessions = await storage.getTrainingSessions(updated.id);
      res.json({ ...updated, sessions });
    } catch (error) {
      res.status(400).json({ error: "Invalid training plan data", details: error });
    }
  });
  
  // Delete training plan (cascades to sessions)
  app.delete("/api/training-plans/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteTrainingPlan(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Training plan not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete training plan" });
    }
  });
  
  // Update priority order for P1 queue
  app.post("/api/training-plans/reorder", async (req, res) => {
    try {
      const { planIds } = req.body as { planIds: string[] };
      
      // Update priority for each plan
      for (let i = 0; i < planIds.length; i++) {
        await storage.updateTrainingPlan(planIds[i], { priority: i });
      }
      
      res.json({ success: true });
    } catch (error) {
      res.status(400).json({ error: "Failed to reorder training plans", details: error });
    }
  });
  
  // ===== TRAINING SESSION ROUTES =====
  
  // Get all training sessions (enriched with plan data when fetching by date for scheduler)
  app.get("/api/training-sessions", async (req, res) => {
    try {
      const date = req.query.date as string | undefined;
      const planId = req.query.planId as string | undefined;
      const enriched = req.query.enriched === 'true';
      
      let sessions;
      if (date) {
        sessions = await storage.getTrainingSessionsByDate(date);
        
        // For scheduler integration: enrich sessions with plan data
        if (enriched && sessions.length > 0) {
          const plans = await storage.getAllTrainingPlans();
          const planMap = new Map(plans.map(p => [p.id, p]));
          
          const enrichedSessions = sessions.map(session => {
            const plan = planMap.get(session.planId);
            return {
              ...session,
              traineeId: plan?.traineeId || null,
              clientId: plan?.clientId || null,
              preferredTrainerId: plan?.preferredTrainerId || null,
              trackType: plan?.trackType || null,
              trainingStyle: plan?.trainingStyle || null,
              planStatus: plan?.status || null
            };
          });
          return res.json(enrichedSessions);
        }
      } else if (planId) {
        sessions = await storage.getTrainingSessions(planId);
      } else {
        sessions = await storage.getAllTrainingSessions();
      }
      res.json(sessions);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch training sessions" });
    }
  });
  
  // Get single training session
  app.get("/api/training-sessions/:id", async (req, res) => {
    try {
      const session = await storage.getTrainingSession(req.params.id);
      if (!session) {
        return res.status(404).json({ error: "Training session not found" });
      }
      res.json(session);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch training session" });
    }
  });
  
  // Update training session (schedule, status, etc.)
  app.patch("/api/training-sessions/:id", async (req, res) => {
    try {
      const validated = insertTrainingSessionSchema.partial().parse(req.body);
      const currentSession = await storage.getTrainingSession(req.params.id);
      if (!currentSession) {
        return res.status(404).json({ error: "Training session not found" });
      }
      
      // If status is being changed to confirmed, add confirmation timestamp
      if (validated.status === 'confirmed' && currentSession.status !== 'confirmed') {
        (validated as any).confirmedAt = new Date();
      }
      
      const updated = await storage.updateTrainingSession(req.params.id, validated);
      if (!updated) {
        return res.status(404).json({ error: "Training session not found" });
      }
      
      // Auto-advance: If session is confirmed or skipped, check for plan completion
      if (validated.status === 'confirmed' || validated.status === 'skipped') {
        const planSessions = await storage.getTrainingSessions(currentSession.planId);
        
        // Check if all sessions are now confirmed or skipped
        // Use the updated status for the current session, and actual DB status for others
        const allComplete = planSessions.every(s => {
          // For the session we just updated, use the new status
          if (s.id === currentSession.id) {
            return validated.status === 'confirmed' || validated.status === 'skipped';
          }
          // For all other sessions, check their actual status
          return s.status === 'confirmed' || s.status === 'skipped';
        });
        
        if (allComplete) {
          // Mark the plan as completed
          await storage.updateTrainingPlan(currentSession.planId, { 
            status: 'completed'
          });
        }
      }
      
      res.json(updated);
    } catch (error) {
      res.status(400).json({ error: "Invalid training session data", details: error });
    }
  });

  // ===== IDEAL DAY TEMPLATE ROUTES =====
  
  // Get all ideal day templates
  app.get("/api/ideal-day-templates", async (req, res) => {
    try {
      const templates = await storage.getAllIdealDayTemplates();
      res.json(templates);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch ideal day templates" });
    }
  });
  
  // Get ideal day template by weekday
  app.get("/api/ideal-day-templates/:weekDay", async (req, res) => {
    try {
      const template = await storage.getIdealDayTemplate(req.params.weekDay);
      if (!template) {
        return res.status(404).json({ error: "Ideal day template not found" });
      }
      res.json(template);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch ideal day template" });
    }
  });
  
  // Get ideal day template with all segments and pairings
  app.get("/api/ideal-day-templates/:weekDay/full", async (req, res) => {
    try {
      const template = await storage.getIdealDayTemplate(req.params.weekDay);
      if (!template) {
        return res.status(404).json({ error: "Ideal day template not found" });
      }
      const segments = await storage.getIdealDaySegments(template.id);
      const lunchPairings = await storage.getIdealDayLunchPairings(template.id);
      res.json({ template, segments, lunchPairings });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch ideal day template details" });
    }
  });
  
  // Create or get ideal day template (ensures one exists for the weekday)
  app.post("/api/ideal-day-templates", async (req, res) => {
    try {
      const validated = insertIdealDayTemplateSchema.parse(req.body);
      
      // Check if template already exists for this weekday
      const existing = await storage.getIdealDayTemplate(validated.weekDay);
      if (existing) {
        return res.json(existing);
      }
      
      const newTemplate = await storage.createIdealDayTemplate(validated);
      res.status(201).json(newTemplate);
    } catch (error) {
      res.status(400).json({ error: "Invalid ideal day template data", details: error });
    }
  });
  
  // Update ideal day template
  app.patch("/api/ideal-day-templates/:id", async (req, res) => {
    try {
      const validated = insertIdealDayTemplateSchema.partial().parse(req.body);
      const updated = await storage.updateIdealDayTemplate(req.params.id, validated);
      if (!updated) {
        return res.status(404).json({ error: "Ideal day template not found" });
      }
      res.json(updated);
    } catch (error) {
      res.status(400).json({ error: "Invalid ideal day template data", details: error });
    }
  });
  
  // Delete ideal day template
  app.delete("/api/ideal-day-templates/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteIdealDayTemplate(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Ideal day template not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete ideal day template" });
    }
  });
  
  // Copy ideal day template from one day to another
  app.post("/api/ideal-day-templates/:sourceWeekDay/copy-to/:targetWeekDay", async (req, res) => {
    try {
      const { sourceWeekDay, targetWeekDay } = req.params;
      
      if (sourceWeekDay === targetWeekDay) {
        return res.status(409).json({ error: "Cannot copy a template to itself" });
      }
      
      const result = await storage.copyIdealDayTemplate(sourceWeekDay, targetWeekDay);
      res.json(result);
    } catch (error: any) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      res.status(500).json({ error: "Failed to copy ideal day template" });
    }
  });
  
  // Generate ideal day from template assignments
  app.post("/api/ideal-day-templates/:weekDay/generate", async (req, res) => {
    try {
      const { weekDay } = req.params;
      
      // Validate weekDay
      const validDays = ["mon", "tue", "wed", "thu", "fri"];
      if (!validDays.includes(weekDay)) {
        return res.status(400).json({ error: "Invalid weekday. Must be one of: mon, tue, wed, thu, fri" });
      }
      
      const result = await storage.generateIdealDayFromTemplate(weekDay);
      res.json(result);
    } catch (error: any) {
      console.error("Failed to generate ideal day:", error);
      res.status(500).json({ error: "Failed to generate ideal day from template" });
    }
  });
  
  // ===== IDEAL DAY SEGMENT ROUTES =====
  
  // Get segments for a weekday (convenience endpoint for schedule engine)
  app.get("/api/ideal-day-segments/by-weekday/:weekDay", async (req, res) => {
    try {
      const { weekDay } = req.params;
      const validDays = ["mon", "tue", "wed", "thu", "fri"];
      if (!validDays.includes(weekDay)) {
        return res.status(400).json({ error: "Invalid weekday. Must be one of: mon, tue, wed, thu, fri" });
      }
      
      // Get the template for this weekday
      const template = await storage.getIdealDayTemplate(weekDay);
      if (!template) {
        return res.json([]); // No template exists, return empty array
      }
      
      // Get all segments for this template
      const segments = await storage.getIdealDaySegments(template.id);
      res.json(segments);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch ideal day segments" });
    }
  });
  
  // Get all segments for a template
  app.get("/api/ideal-day-templates/:templateId/segments", async (req, res) => {
    try {
      const segments = await storage.getIdealDaySegments(req.params.templateId);
      res.json(segments);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch ideal day segments" });
    }
  });
  
  // Get segments for a specific staff member
  app.get("/api/ideal-day-templates/:templateId/segments/:staffId", async (req, res) => {
    try {
      const segments = await storage.getIdealDaySegmentsByStaff(req.params.templateId, req.params.staffId);
      res.json(segments);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch ideal day segments" });
    }
  });
  
  // Create a segment
  app.post("/api/ideal-day-segments", async (req, res) => {
    try {
      const validated = insertIdealDaySegmentSchema.parse(req.body);
      const newSegment = await storage.createIdealDaySegment(validated);
      res.status(201).json(newSegment);
    } catch (error) {
      res.status(400).json({ error: "Invalid ideal day segment data", details: error });
    }
  });
  
  // Bulk create segments (replace all segments for a template)
  app.post("/api/ideal-day-templates/:templateId/segments/bulk", async (req, res) => {
    try {
      const { segments } = req.body;
      if (!Array.isArray(segments)) {
        return res.status(400).json({ error: "segments must be an array" });
      }
      
      // Delete existing segments for this template
      await storage.deleteIdealDaySegmentsByTemplate(req.params.templateId);
      
      // Create new segments
      const validated = segments.map((s: any) => insertIdealDaySegmentSchema.parse({
        ...s,
        templateId: req.params.templateId
      }));
      const created = await storage.bulkCreateIdealDaySegments(validated);
      res.status(201).json(created);
    } catch (error) {
      res.status(400).json({ error: "Invalid ideal day segment data", details: error });
    }
  });
  
  // Update a segment
  app.patch("/api/ideal-day-segments/:id", async (req, res) => {
    try {
      const validated = insertIdealDaySegmentSchema.partial().parse(req.body);
      const updated = await storage.updateIdealDaySegment(req.params.id, validated);
      if (!updated) {
        return res.status(404).json({ error: "Ideal day segment not found" });
      }
      res.json(updated);
    } catch (error) {
      res.status(400).json({ error: "Invalid ideal day segment data", details: error });
    }
  });
  
  // Delete a segment
  app.delete("/api/ideal-day-segments/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteIdealDaySegment(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Ideal day segment not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete ideal day segment" });
    }
  });
  
  // ===== IDEAL DAY LUNCH PAIRING ROUTES =====
  
  // Get all lunch pairings for a template
  app.get("/api/ideal-day-templates/:templateId/lunch-pairings", async (req, res) => {
    try {
      const pairings = await storage.getIdealDayLunchPairings(req.params.templateId);
      res.json(pairings);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch lunch pairings" });
    }
  });
  
  // Create a lunch pairing
  app.post("/api/ideal-day-lunch-pairings", async (req, res) => {
    try {
      const validated = insertIdealDayLunchPairingSchema.parse(req.body);
      const newPairing = await storage.createIdealDayLunchPairing(validated);
      res.status(201).json(newPairing);
    } catch (error) {
      res.status(400).json({ error: "Invalid lunch pairing data", details: error });
    }
  });
  
  // Update a lunch pairing
  app.patch("/api/ideal-day-lunch-pairings/:id", async (req, res) => {
    try {
      const validated = insertIdealDayLunchPairingSchema.partial().parse(req.body);
      const updated = await storage.updateIdealDayLunchPairing(req.params.id, validated);
      if (!updated) {
        return res.status(404).json({ error: "Lunch pairing not found" });
      }
      res.json(updated);
    } catch (error) {
      res.status(400).json({ error: "Invalid lunch pairing data", details: error });
    }
  });
  
  // Delete a lunch pairing
  app.delete("/api/ideal-day-lunch-pairings/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteIdealDayLunchPairing(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Lunch pairing not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete lunch pairing" });
    }
  });
  
  // ===== TEMPLATE LUNCH PAIRING GROUPS ROUTES =====
  
  // Get all template lunch pairing groups
  app.get("/api/template-lunch-pairing-groups", async (req, res) => {
    try {
      const groups = await storage.getAllTemplateLunchPairingGroups();
      res.json(groups);
    } catch (error) {
      res.status(500).json({ error: "Failed to get template lunch pairing groups" });
    }
  });
  
  // Get template lunch pairing groups by location
  app.get("/api/template-lunch-pairing-groups/location/:locationId", async (req, res) => {
    try {
      const groups = await storage.getTemplateLunchPairingGroupsByLocation(req.params.locationId);
      res.json(groups);
    } catch (error) {
      res.status(500).json({ error: "Failed to get template lunch pairing groups" });
    }
  });
  
  // Create a template lunch pairing group
  app.post("/api/template-lunch-pairing-groups", async (req, res) => {
    try {
      const validated = insertTemplateLunchPairingGroupSchema.parse(req.body);
      const group = await storage.createTemplateLunchPairingGroup(validated);
      res.status(201).json(group);
    } catch (error) {
      res.status(400).json({ error: "Invalid template lunch pairing group data", details: error });
    }
  });
  
  // Update a template lunch pairing group
  app.patch("/api/template-lunch-pairing-groups/:id", async (req, res) => {
    try {
      const validated = insertTemplateLunchPairingGroupSchema.partial().parse(req.body);
      const group = await storage.updateTemplateLunchPairingGroup(req.params.id, validated);
      if (!group) {
        return res.status(404).json({ error: "Template lunch pairing group not found" });
      }
      res.json(group);
    } catch (error) {
      res.status(400).json({ error: "Invalid template lunch pairing group data", details: error });
    }
  });
  
  // Delete a template lunch pairing group
  app.delete("/api/template-lunch-pairing-groups/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteTemplateLunchPairingGroup(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Template lunch pairing group not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete template lunch pairing group" });
    }
  });
  
  // Delete all template lunch pairing groups
  app.delete("/api/template-lunch-pairing-groups", async (req, res) => {
    try {
      await storage.deleteAllTemplateLunchPairingGroups();
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete all template lunch pairing groups" });
    }
  });

  // ===== BATCH API ENDPOINT =====
  
  app.post("/api/batch", async (req, res) => {
    try {
      const { requests } = req.body;
      
      if (!Array.isArray(requests)) {
        return res.status(400).json({ error: "requests must be an array" });
      }
      
      if (requests.length > 10) {
        return res.status(400).json({ error: "Maximum 10 requests per batch" });
      }
      
      const results = await Promise.all(
        requests.map(async (request: { endpoint: string; method?: string }) => {
          try {
            const { endpoint, method = "GET" } = request;
            
            if (method !== "GET") {
              return { endpoint, error: "Only GET requests supported in batch", status: 400 };
            }
            
            let data;
            if (endpoint === "/api/staff") {
              data = await storage.getAllStaff();
            } else if (endpoint === "/api/clients") {
              data = await storage.getAllClients();
            } else if (endpoint === "/api/template") {
              data = await storage.getAllTemplateAssignments();
            } else if (endpoint === "/api/client-locations") {
              data = await storage.getAllClientLocations();
            } else if (endpoint === "/api/schools") {
              data = await storage.getAllSchools();
            } else if (endpoint === "/api/schedule/latest") {
              const today = new Date().toISOString().split('T')[0];
              data = await storage.getLatestSchedule(today);
            } else {
              return { endpoint, error: "Endpoint not supported in batch", status: 400 };
            }
            
            return { endpoint, data, status: 200 };
          } catch (error) {
            return { endpoint: request.endpoint, error: "Request failed", status: 500 };
          }
        })
      );
      
      res.json({ results });
    } catch (error) {
      res.status(500).json({ error: "Batch request failed" });
    }
  });

  return httpServer;
}
