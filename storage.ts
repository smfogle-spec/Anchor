import { 
  users, 
  staff, 
  clients, 
  clientLocations,
  clientLocationStaffApprovals,
  clientCancelLinks,
  clientCancelHistory,
  clientSubHistory,
  clientSkipHistory,
  schools,
  templateAssignments,
  scheduleChanges,
  dailySchedules,
  trainingPlans,
  trainingSessions,
  cmLeadBcbaLinks,
  cmAdminLinks,
  leadRbtBcbaLinks,
  type User, 
  type InsertUser,
  type Staff,
  type InsertStaff,
  type Client,
  type InsertClient,
  type ClientLocation,
  type InsertClientLocation,
  type ClientLocationStaffApproval,
  type InsertClientLocationStaffApproval,
  type ClientCancelLink,
  type InsertClientCancelLink,
  type ClientCancelHistory,
  type InsertClientCancelHistory,
  type ClientSubHistory,
  type InsertClientSubHistory,
  type ClientSkipHistory,
  type InsertClientSkipHistory,
  type School,
  type InsertSchool,
  type TemplateAssignment,
  type InsertTemplateAssignment,
  type ScheduleChange,
  type InsertScheduleChange,
  type DailySchedule,
  type InsertDailySchedule,
  type TrainingPlan,
  type InsertTrainingPlan,
  type TrainingSession,
  type InsertTrainingSession,
  type CmLeadBcbaLink,
  type CmAdminLink,
  type LeadRbtBcbaLink,
  type IdealDayTemplate,
  type InsertIdealDayTemplate,
  type IdealDaySegment,
  type InsertIdealDaySegment,
  type IdealDayLunchPairing,
  type InsertIdealDayLunchPairing,
  type TemplateLunchPairingGroup,
  type InsertTemplateLunchPairingGroup,
  idealDayTemplates,
  idealDaySegments,
  idealDayLunchPairings,
  templateLunchPairingGroups
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, max } from "drizzle-orm";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Schools
  getAllSchools(): Promise<School[]>;
  getSchool(id: string): Promise<School | undefined>;
  getSchoolByName(name: string): Promise<School | undefined>;
  createSchool(school: InsertSchool): Promise<School>;
  updateSchool(id: string, school: Partial<InsertSchool>): Promise<School | undefined>;
  deleteSchool(id: string): Promise<boolean>;
  
  // Staff
  getAllStaff(): Promise<Staff[]>;
  getStaff(id: string): Promise<Staff | undefined>;
  createStaff(staff: InsertStaff): Promise<Staff>;
  updateStaff(id: string, staff: Partial<InsertStaff>): Promise<Staff | undefined>;
  deleteStaff(id: string): Promise<boolean>;
  
  // Clients
  getAllClients(): Promise<Client[]>;
  getClient(id: string): Promise<Client | undefined>;
  createClient(client: InsertClient): Promise<Client>;
  updateClient(id: string, client: Partial<InsertClient>): Promise<Client | undefined>;
  updateClientWithReciprocalPeers(id: string, client: Partial<InsertClient>): Promise<Client | undefined>;
  deleteClient(id: string): Promise<boolean>;
  
  // Client Cancel Links (bidirectional sibling cancellation)
  getClientCancelLinks(clientId: string): Promise<ClientCancelLink[]>;
  getAllClientCancelLinks(): Promise<ClientCancelLink[]>;
  setClientCancelLinks(clientId: string, linkedClientIds: string[]): Promise<ClientCancelLink[]>;
  
  // Client Locations
  getClientLocations(clientId: string): Promise<ClientLocation[]>;
  getAllClientLocations(): Promise<ClientLocation[]>;
  createClientLocation(location: InsertClientLocation): Promise<ClientLocation>;
  updateClientLocation(id: string, location: Partial<InsertClientLocation>): Promise<ClientLocation | undefined>;
  deleteClientLocation(id: string): Promise<boolean>;
  deleteClientLocationsByClientId(clientId: string): Promise<boolean>;
  
  // Client Location Staff Approvals
  getLocationStaffApprovals(clientLocationId: string): Promise<ClientLocationStaffApproval[]>;
  getAllLocationStaffApprovals(): Promise<ClientLocationStaffApproval[]>;
  createLocationStaffApproval(approval: InsertClientLocationStaffApproval): Promise<ClientLocationStaffApproval>;
  deleteLocationStaffApproval(clientLocationId: string, staffId: string): Promise<boolean>;
  setLocationStaffApprovals(clientLocationId: string, staffIds: string[]): Promise<ClientLocationStaffApproval[]>;
  
  // Template Assignments
  getAllTemplateAssignments(): Promise<TemplateAssignment[]>;
  getTemplateAssignmentsByDay(weekDay: string): Promise<TemplateAssignment[]>;
  getTemplateAssignmentsByClient(clientId: string): Promise<TemplateAssignment[]>;
  createTemplateAssignment(assignment: InsertTemplateAssignment): Promise<TemplateAssignment>;
  updateTemplateAssignment(id: string, assignment: Partial<InsertTemplateAssignment>): Promise<TemplateAssignment | undefined>;
  deleteTemplateAssignment(id: string): Promise<boolean>;
  bulkUpsertTemplateAssignments(assignments: InsertTemplateAssignment[]): Promise<{ assignments: TemplateAssignment[]; staffRemovedFromFocus: string[] }>;
  
  // Schedule Changes (Change Log)
  getScheduleChanges(date?: string): Promise<ScheduleChange[]>;
  createScheduleChange(change: InsertScheduleChange): Promise<ScheduleChange>;
  createScheduleChanges(changes: InsertScheduleChange[]): Promise<ScheduleChange[]>;
  deleteScheduleChangesByDate(date: string): Promise<boolean>;
  
  // Daily Schedules (Versioned snapshots)
  getLatestSchedule(date: string): Promise<DailySchedule | undefined>;
  getScheduleVersions(date: string): Promise<DailySchedule[]>;
  getScheduleByVersion(date: string, version: number): Promise<DailySchedule | undefined>;
  createScheduleVersion(schedule: InsertDailySchedule): Promise<DailySchedule>;
  getNextVersionNumber(date: string): Promise<number>;
  
  // Training Plans
  getAllTrainingPlans(): Promise<TrainingPlan[]>;
  getTrainingPlan(id: string): Promise<TrainingPlan | undefined>;
  getTrainingPlansByTrainee(traineeId: string): Promise<TrainingPlan[]>;
  getTrainingPlansByClient(clientId: string): Promise<TrainingPlan[]>;
  getTrainingPlansByTrack(trackType: string): Promise<TrainingPlan[]>;
  createTrainingPlan(plan: InsertTrainingPlan): Promise<TrainingPlan>;
  updateTrainingPlan(id: string, plan: Partial<InsertTrainingPlan>): Promise<TrainingPlan | undefined>;
  deleteTrainingPlan(id: string): Promise<boolean>;
  
  // Training Sessions
  getTrainingSessions(planId: string): Promise<TrainingSession[]>;
  getAllTrainingSessions(): Promise<TrainingSession[]>;
  getTrainingSession(id: string): Promise<TrainingSession | undefined>;
  getTrainingSessionsByDate(date: string): Promise<TrainingSession[]>;
  createTrainingSession(session: InsertTrainingSession): Promise<TrainingSession>;
  createTrainingSessions(sessions: InsertTrainingSession[]): Promise<TrainingSession[]>;
  updateTrainingSession(id: string, session: Partial<InsertTrainingSession>): Promise<TrainingSession | undefined>;
  deleteTrainingSession(id: string): Promise<boolean>;
  deleteTrainingSessionsByPlan(planId: string): Promise<boolean>;
  
  // CM Lead BCBA Links (Clinical Manager to Lead BCBA supervision)
  getCmLeadBcbaLinks(clinicalManagerId: string): Promise<CmLeadBcbaLink[]>;
  getAllCmLeadBcbaLinks(): Promise<CmLeadBcbaLink[]>;
  setCmLeadBcbaLinks(clinicalManagerId: string, leadBcbaIds: string[]): Promise<CmLeadBcbaLink[]>;
  
  // CM Admin Links (Clinical Manager to Admin supervision)
  getCmAdminLinks(clinicalManagerId: string): Promise<CmAdminLink[]>;
  getAllCmAdminLinks(): Promise<CmAdminLink[]>;
  setCmAdminLinks(clinicalManagerId: string, adminIds: string[]): Promise<CmAdminLink[]>;
  
  // Lead RBT BCBA Links (Lead RBT to BCBA assignments - many-to-many)
  getLeadRbtBcbaLinks(leadRbtId: string): Promise<LeadRbtBcbaLink[]>;
  getAllLeadRbtBcbaLinks(): Promise<LeadRbtBcbaLink[]>;
  setLeadRbtBcbaLinks(leadRbtId: string, bcbaIds: string[]): Promise<LeadRbtBcbaLink[]>;
  
  // Client Cancel History
  getClientCancelHistory(clientId: string): Promise<ClientCancelHistory[]>;
  getAllClientCancelHistory(): Promise<ClientCancelHistory[]>;
  createClientCancelHistory(history: InsertClientCancelHistory): Promise<ClientCancelHistory>;
  deleteClientCancelHistory(id: string): Promise<boolean>;
  
  // Client Sub History
  getClientSubHistory(clientId: string): Promise<ClientSubHistory[]>;
  getAllClientSubHistory(): Promise<ClientSubHistory[]>;
  createClientSubHistory(history: InsertClientSubHistory): Promise<ClientSubHistory>;
  deleteClientSubHistory(id: string): Promise<boolean>;
  
  // Client Skip History
  getClientSkipHistory(clientId: string): Promise<ClientSkipHistory[]>;
  getAllClientSkipHistory(): Promise<ClientSkipHistory[]>;
  createClientSkipHistory(history: InsertClientSkipHistory): Promise<ClientSkipHistory>;
  deleteClientSkipHistory(id: string): Promise<boolean>;
  
  // Ideal Day Templates
  getAllIdealDayTemplates(): Promise<IdealDayTemplate[]>;
  getIdealDayTemplate(weekDay: string): Promise<IdealDayTemplate | undefined>;
  getIdealDayTemplateById(id: string): Promise<IdealDayTemplate | undefined>;
  createIdealDayTemplate(template: InsertIdealDayTemplate): Promise<IdealDayTemplate>;
  updateIdealDayTemplate(id: string, template: Partial<InsertIdealDayTemplate>): Promise<IdealDayTemplate | undefined>;
  deleteIdealDayTemplate(id: string): Promise<boolean>;
  
  // Ideal Day Segments
  getIdealDaySegments(templateId: string): Promise<IdealDaySegment[]>;
  getIdealDaySegmentsByStaff(templateId: string, staffId: string): Promise<IdealDaySegment[]>;
  createIdealDaySegment(segment: InsertIdealDaySegment): Promise<IdealDaySegment>;
  updateIdealDaySegment(id: string, segment: Partial<InsertIdealDaySegment>): Promise<IdealDaySegment | undefined>;
  deleteIdealDaySegment(id: string): Promise<boolean>;
  deleteIdealDaySegmentsByTemplate(templateId: string): Promise<boolean>;
  bulkCreateIdealDaySegments(segments: InsertIdealDaySegment[]): Promise<IdealDaySegment[]>;
  
  // Ideal Day Lunch Pairings
  getIdealDayLunchPairings(templateId: string): Promise<IdealDayLunchPairing[]>;
  createIdealDayLunchPairing(pairing: InsertIdealDayLunchPairing): Promise<IdealDayLunchPairing>;
  updateIdealDayLunchPairing(id: string, pairing: Partial<InsertIdealDayLunchPairing>): Promise<IdealDayLunchPairing | undefined>;
  deleteIdealDayLunchPairing(id: string): Promise<boolean>;
  deleteIdealDayLunchPairingsByTemplate(templateId: string): Promise<boolean>;
  
  // Copy Ideal Day Template
  copyIdealDayTemplate(sourceWeekDay: string, targetWeekDay: string): Promise<{
    template: IdealDayTemplate;
    segments: IdealDaySegment[];
    lunchPairings: IdealDayLunchPairing[];
  }>;
  
  // Generate Ideal Day from Template Assignments
  generateIdealDayFromTemplate(weekDay: string): Promise<{
    template: IdealDayTemplate;
    segments: IdealDaySegment[];
    lunchPairings: IdealDayLunchPairing[];
  }>;
  
  // Template Lunch Pairing Groups (baseline pairing plan)
  getAllTemplateLunchPairingGroups(): Promise<TemplateLunchPairingGroup[]>;
  getTemplateLunchPairingGroupsByLocation(locationId: string): Promise<TemplateLunchPairingGroup[]>;
  getTemplateLunchPairingGroupsByLocationAndBlock(locationId: string | null, lunchBlock: string): Promise<TemplateLunchPairingGroup[]>;
  createTemplateLunchPairingGroup(group: InsertTemplateLunchPairingGroup): Promise<TemplateLunchPairingGroup>;
  updateTemplateLunchPairingGroup(id: string, group: Partial<InsertTemplateLunchPairingGroup>): Promise<TemplateLunchPairingGroup | undefined>;
  deleteTemplateLunchPairingGroup(id: string): Promise<boolean>;
  deleteAllTemplateLunchPairingGroups(): Promise<boolean>;
}

export class DatabaseStorage implements IStorage {
  // Users
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }
  
  // Schools
  async getAllSchools(): Promise<School[]> {
    return await db.select().from(schools);
  }
  
  async getSchool(id: string): Promise<School | undefined> {
    const [result] = await db.select().from(schools).where(eq(schools.id, id));
    return result || undefined;
  }
  
  async getSchoolByName(name: string): Promise<School | undefined> {
    const [result] = await db.select().from(schools).where(eq(schools.name, name));
    return result || undefined;
  }
  
  async createSchool(insertSchool: InsertSchool): Promise<School> {
    const [result] = await db
      .insert(schools)
      .values(insertSchool)
      .returning();
    return result;
  }
  
  async updateSchool(id: string, updateData: Partial<InsertSchool>): Promise<School | undefined> {
    const [result] = await db
      .update(schools)
      .set(updateData)
      .where(eq(schools.id, id))
      .returning();
    return result || undefined;
  }
  
  async deleteSchool(id: string): Promise<boolean> {
    const result = await db.delete(schools).where(eq(schools.id, id));
    return (result.rowCount ?? 0) > 0;
  }
  
  // Staff
  async getAllStaff(): Promise<Staff[]> {
    return await db.select().from(staff);
  }
  
  async getStaff(id: string): Promise<Staff | undefined> {
    const [result] = await db.select().from(staff).where(eq(staff.id, id));
    return result || undefined;
  }
  
  async createStaff(insertStaff: InsertStaff): Promise<Staff> {
    const [result] = await db
      .insert(staff)
      .values(insertStaff)
      .returning();
    return result;
  }
  
  async updateStaff(id: string, updateData: Partial<InsertStaff>): Promise<Staff | undefined> {
    const [result] = await db
      .update(staff)
      .set(updateData)
      .where(eq(staff.id, id))
      .returning();
    return result || undefined;
  }
  
  async deleteStaff(id: string): Promise<boolean> {
    const result = await db.delete(staff).where(eq(staff.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }
  
  // Clients
  async getAllClients(): Promise<Client[]> {
    return await db.select().from(clients);
  }
  
  async getClient(id: string): Promise<Client | undefined> {
    const [result] = await db.select().from(clients).where(eq(clients.id, id));
    return result || undefined;
  }
  
  async createClient(insertClient: InsertClient): Promise<Client> {
    const [result] = await db
      .insert(clients)
      .values(insertClient)
      .returning();
    return result;
  }
  
  async updateClient(id: string, updateData: Partial<InsertClient>): Promise<Client | undefined> {
    const [result] = await db
      .update(clients)
      .set(updateData)
      .where(eq(clients.id, id))
      .returning();
    return result || undefined;
  }
  
  async updateClientWithReciprocalPeers(id: string, updateData: Partial<InsertClient>): Promise<Client | undefined> {
    return await db.transaction(async (tx) => {
      // Get old client data
      const [oldClient] = await tx.select().from(clients).where(eq(clients.id, id));
      if (!oldClient) return undefined;
      
      // Process allowedLunchPeerIds if present
      if (updateData.allowedLunchPeerIds !== undefined) {
        const oldPeers = (oldClient.allowedLunchPeerIds as string[]) || [];
        let newPeers = (updateData.allowedLunchPeerIds as string[]) || [];
        
        // Prevent self-reference and duplicates
        newPeers = Array.from(new Set(newPeers.filter(peerId => peerId !== id)));
        updateData.allowedLunchPeerIds = newPeers;
        
        // Find added and removed peers
        const addedPeers = newPeers.filter(peerId => !oldPeers.includes(peerId));
        const removedPeers = oldPeers.filter(peerId => !newPeers.includes(peerId));
        
        // Add this client to each new peer's allowedLunchPeerIds
        for (const peerId of addedPeers) {
          const [peer] = await tx.select().from(clients).where(eq(clients.id, peerId));
          if (peer) {
            const peerLunchPeers = (peer.allowedLunchPeerIds as string[]) || [];
            if (!peerLunchPeers.includes(id)) {
              await tx.update(clients)
                .set({ allowedLunchPeerIds: [...peerLunchPeers, id] })
                .where(eq(clients.id, peerId));
            }
          }
        }
        
        // Remove this client from each removed peer's allowedLunchPeerIds
        for (const peerId of removedPeers) {
          const [peer] = await tx.select().from(clients).where(eq(clients.id, peerId));
          if (peer) {
            const peerLunchPeers = (peer.allowedLunchPeerIds as string[]) || [];
            await tx.update(clients)
              .set({ allowedLunchPeerIds: peerLunchPeers.filter(pId => pId !== id) })
              .where(eq(clients.id, peerId));
          }
        }
      }
      
      // Update the main client
      const [result] = await tx.update(clients)
        .set(updateData)
        .where(eq(clients.id, id))
        .returning();
      
      return result || undefined;
    });
  }
  
  async deleteClient(id: string): Promise<boolean> {
    const result = await db.delete(clients).where(eq(clients.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }
  
  // Client Cancel Links (bidirectional sibling cancellation)
  async getClientCancelLinks(clientId: string): Promise<ClientCancelLink[]> {
    return await db.select().from(clientCancelLinks).where(eq(clientCancelLinks.clientId, clientId));
  }
  
  async getAllClientCancelLinks(): Promise<ClientCancelLink[]> {
    return await db.select().from(clientCancelLinks);
  }
  
  async setClientCancelLinks(clientId: string, linkedClientIds: string[]): Promise<ClientCancelLink[]> {
    // Get current links for this client
    const currentLinks = await db.select().from(clientCancelLinks).where(eq(clientCancelLinks.clientId, clientId));
    const currentLinkedIds = currentLinks.map(l => l.linkedClientId);
    
    // Determine what to add and remove
    const toAdd = linkedClientIds.filter(id => !currentLinkedIds.includes(id) && id !== clientId);
    const toRemove = currentLinkedIds.filter(id => !linkedClientIds.includes(id));
    
    // Remove old links (both directions)
    for (const linkedId of toRemove) {
      await db.delete(clientCancelLinks).where(
        and(eq(clientCancelLinks.clientId, clientId), eq(clientCancelLinks.linkedClientId, linkedId))
      );
      await db.delete(clientCancelLinks).where(
        and(eq(clientCancelLinks.clientId, linkedId), eq(clientCancelLinks.linkedClientId, clientId))
      );
    }
    
    // Add new links (both directions for bidirectional relationship)
    const results: ClientCancelLink[] = [];
    for (const linkedId of toAdd) {
      // Add forward link
      const [link1] = await db.insert(clientCancelLinks).values({
        clientId: clientId,
        linkedClientId: linkedId
      }).returning();
      results.push(link1);
      
      // Add reverse link (if it doesn't already exist)
      const existingReverse = await db.select().from(clientCancelLinks).where(
        and(eq(clientCancelLinks.clientId, linkedId), eq(clientCancelLinks.linkedClientId, clientId))
      );
      if (existingReverse.length === 0) {
        await db.insert(clientCancelLinks).values({
          clientId: linkedId,
          linkedClientId: clientId
        });
      }
    }
    
    // Return all current links for this client
    return await db.select().from(clientCancelLinks).where(eq(clientCancelLinks.clientId, clientId));
  }
  
  // Client Locations
  async getClientLocations(clientId: string): Promise<ClientLocation[]> {
    return await db.select().from(clientLocations).where(eq(clientLocations.clientId, clientId));
  }
  
  async getAllClientLocations(): Promise<ClientLocation[]> {
    return await db.select().from(clientLocations);
  }
  
  async createClientLocation(location: InsertClientLocation): Promise<ClientLocation> {
    const [result] = await db
      .insert(clientLocations)
      .values(location)
      .returning();
    return result;
  }
  
  async updateClientLocation(id: string, updateData: Partial<InsertClientLocation>): Promise<ClientLocation | undefined> {
    const [result] = await db
      .update(clientLocations)
      .set(updateData)
      .where(eq(clientLocations.id, id))
      .returning();
    return result || undefined;
  }
  
  async deleteClientLocation(id: string): Promise<boolean> {
    const result = await db.delete(clientLocations).where(eq(clientLocations.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }
  
  async deleteClientLocationsByClientId(clientId: string): Promise<boolean> {
    const result = await db.delete(clientLocations).where(eq(clientLocations.clientId, clientId));
    return result.rowCount ? result.rowCount > 0 : false;
  }
  
  // Client Location Staff Approvals
  async getLocationStaffApprovals(clientLocationId: string): Promise<ClientLocationStaffApproval[]> {
    return await db.select().from(clientLocationStaffApprovals).where(eq(clientLocationStaffApprovals.clientLocationId, clientLocationId));
  }
  
  async getAllLocationStaffApprovals(): Promise<ClientLocationStaffApproval[]> {
    return await db.select().from(clientLocationStaffApprovals);
  }
  
  async createLocationStaffApproval(approval: InsertClientLocationStaffApproval): Promise<ClientLocationStaffApproval> {
    const [result] = await db
      .insert(clientLocationStaffApprovals)
      .values(approval)
      .returning();
    return result;
  }
  
  async deleteLocationStaffApproval(clientLocationId: string, staffId: string): Promise<boolean> {
    const result = await db.delete(clientLocationStaffApprovals).where(
      and(
        eq(clientLocationStaffApprovals.clientLocationId, clientLocationId),
        eq(clientLocationStaffApprovals.staffId, staffId)
      )
    );
    return result.rowCount ? result.rowCount > 0 : false;
  }
  
  async setLocationStaffApprovals(clientLocationId: string, staffIds: string[]): Promise<ClientLocationStaffApproval[]> {
    // Delete existing approvals for this location
    await db.delete(clientLocationStaffApprovals).where(eq(clientLocationStaffApprovals.clientLocationId, clientLocationId));
    
    // Insert new approvals
    if (staffIds.length === 0) {
      return [];
    }
    
    const approvals = staffIds.map(staffId => ({ clientLocationId, staffId }));
    const results = await db
      .insert(clientLocationStaffApprovals)
      .values(approvals)
      .returning();
    return results;
  }
  
  // Template Assignments
  async getAllTemplateAssignments(): Promise<TemplateAssignment[]> {
    return await db.select().from(templateAssignments);
  }
  
  async getTemplateAssignmentsByDay(weekDay: string): Promise<TemplateAssignment[]> {
    return await db.select().from(templateAssignments).where(eq(templateAssignments.weekDay, weekDay));
  }
  
  async getTemplateAssignmentsByClient(clientId: string): Promise<TemplateAssignment[]> {
    return await db.select().from(templateAssignments).where(eq(templateAssignments.clientId, clientId));
  }
  
  async createTemplateAssignment(assignment: InsertTemplateAssignment): Promise<TemplateAssignment> {
    const [result] = await db
      .insert(templateAssignments)
      .values(assignment)
      .returning();
    return result;
  }
  
  async updateTemplateAssignment(id: string, updateData: Partial<InsertTemplateAssignment>): Promise<TemplateAssignment | undefined> {
    const [result] = await db
      .update(templateAssignments)
      .set(updateData)
      .where(eq(templateAssignments.id, id))
      .returning();
    return result || undefined;
  }
  
  async deleteTemplateAssignment(id: string): Promise<boolean> {
    const result = await db.delete(templateAssignments).where(eq(templateAssignments.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }
  
  async bulkUpsertTemplateAssignments(assignments: InsertTemplateAssignment[]): Promise<{ assignments: TemplateAssignment[]; staffRemovedFromFocus: string[] }> {
    // Safety check: refuse to delete all assignments if empty array is passed
    // This prevents accidental data loss from bugs or race conditions
    if (assignments.length === 0) {
      console.warn("bulkUpsertTemplateAssignments called with empty array - refusing to delete existing data");
      const existing = await db.select().from(templateAssignments);
      return { assignments: existing, staffRemovedFromFocus: [] };
    }
    
    // Use a transaction to ensure atomicity - only delete if insert succeeds
    const results = await db.transaction(async (tx) => {
      // Get current template assignments to identify staff being removed
      const currentAssignments = await tx.select().from(templateAssignments);
      const oldStaffIds = new Set(currentAssignments.map(a => a.staffId));
      
      // Calculate which staff IDs will be in the new template
      const newStaffIds = new Set(assignments.map(a => a.staffId));
      
      // Find staff who are being completely removed from the template
      const staffToRemoveFromFocus = Array.from(oldStaffIds).filter(id => !newStaffIds.has(id));
      
      // Delete all existing assignments
      await tx.delete(templateAssignments);
      
      // Insert all new assignments
      const inserted = await tx
        .insert(templateAssignments)
        .values(assignments)
        .returning();
      
      // Remove completely-removed staff from all clients' focusStaffIds
      if (staffToRemoveFromFocus.length > 0) {
        // Get all clients
        const allClients = await tx.select().from(clients);
        
        for (const client of allClients) {
          const currentFocus = (client.focusStaffIds as string[]) || [];
          // Filter out the removed staff
          const updatedFocus = currentFocus.filter(id => !staffToRemoveFromFocus.includes(id));
          
          // Only update if there was a change
          if (updatedFocus.length !== currentFocus.length) {
            await tx
              .update(clients)
              .set({ focusStaffIds: updatedFocus })
              .where(eq(clients.id, client.id));
          }
        }
      }
      
      return { assignments: inserted, staffRemovedFromFocus: staffToRemoveFromFocus };
    });
    
    return results;
  }
  
  // Bulk upsert template with focus staff updates - atomic transaction
  // Note: focusUpdates contains { clientId, staffIdsToAdd } - the new staff IDs to add (not the full list)
  // Also automatically removes staff from all clients' focusStaffIds when they are removed from all template assignments
  async bulkUpsertTemplateWithFocusUpdates(
    assignments: InsertTemplateAssignment[],
    focusUpdates: Array<{ clientId: string; staffIdsToAdd: string[] }>
  ): Promise<{ assignments: TemplateAssignment[]; focusUpdatesApplied: number; staffRemovedFromFocus: string[] }> {
    // Safety check: refuse to delete all assignments if empty array is passed
    if (assignments.length === 0) {
      console.warn("bulkUpsertTemplateWithFocusUpdates called with empty assignments - refusing to delete existing data");
      const existing = await db.select().from(templateAssignments);
      return { assignments: existing, focusUpdatesApplied: 0, staffRemovedFromFocus: [] };
    }
    
    // Use a single transaction for both template and focus staff updates
    const result = await db.transaction(async (tx) => {
      // Get current template assignments to identify staff being removed
      const currentAssignments = await tx.select().from(templateAssignments);
      const oldStaffIds = new Set(currentAssignments.map(a => a.staffId));
      
      // Calculate which staff IDs will be in the new template
      const newStaffIds = new Set(assignments.map(a => a.staffId));
      
      // Find staff who are being completely removed from the template
      const staffToRemoveFromFocus = Array.from(oldStaffIds).filter(id => !newStaffIds.has(id));
      
      // Delete all existing template assignments
      await tx.delete(templateAssignments);
      
      // Insert all new template assignments
      const inserted = await tx
        .insert(templateAssignments)
        .values(assignments)
        .returning();
      
      // Remove completely-removed staff from all clients' focusStaffIds
      if (staffToRemoveFromFocus.length > 0) {
        // Get all clients
        const allClients = await tx.select().from(clients);
        
        for (const client of allClients) {
          const currentFocus = (client.focusStaffIds as string[]) || [];
          // Filter out the removed staff
          const updatedFocus = currentFocus.filter(id => !staffToRemoveFromFocus.includes(id));
          
          // Only update if there was a change
          if (updatedFocus.length !== currentFocus.length) {
            await tx
              .update(clients)
              .set({ focusStaffIds: updatedFocus })
              .where(eq(clients.id, client.id));
          }
        }
      }
      
      // Apply focus staff updates - read current value inside transaction to prevent race conditions
      let focusUpdatesApplied = 0;
      for (const update of focusUpdates) {
        // Read current focusStaffIds inside the transaction
        const [currentClient] = await tx
          .select({ focusStaffIds: clients.focusStaffIds })
          .from(clients)
          .where(eq(clients.id, update.clientId));
        
        if (currentClient) {
          const currentFocus = (currentClient.focusStaffIds as string[]) || [];
          // Union current focus staff with new additions (prevents duplicates and race conditions)
          const uniqueSet = new Set([...currentFocus, ...update.staffIdsToAdd]);
          const mergedFocusStaffIds = Array.from(uniqueSet);
          
          await tx
            .update(clients)
            .set({ focusStaffIds: mergedFocusStaffIds })
            .where(eq(clients.id, update.clientId));
          focusUpdatesApplied++;
        }
      }
      
      return { assignments: inserted, focusUpdatesApplied, staffRemovedFromFocus: staffToRemoveFromFocus };
    });
    
    return result;
  }
  
  // Schedule Changes (Change Log)
  async getScheduleChanges(date?: string): Promise<ScheduleChange[]> {
    if (date) {
      return await db.select().from(scheduleChanges)
        .where(eq(scheduleChanges.date, date))
        .orderBy(desc(scheduleChanges.createdAt));
    }
    return await db.select().from(scheduleChanges)
      .orderBy(desc(scheduleChanges.createdAt));
  }
  
  async createScheduleChange(change: InsertScheduleChange): Promise<ScheduleChange> {
    const [result] = await db
      .insert(scheduleChanges)
      .values(change)
      .returning();
    return result;
  }
  
  async createScheduleChanges(changes: InsertScheduleChange[]): Promise<ScheduleChange[]> {
    if (changes.length === 0) {
      return [];
    }
    const results = await db
      .insert(scheduleChanges)
      .values(changes)
      .returning();
    return results;
  }
  
  async deleteScheduleChangesByDate(date: string): Promise<boolean> {
    const result = await db.delete(scheduleChanges).where(eq(scheduleChanges.date, date));
    return result.rowCount ? result.rowCount > 0 : false;
  }
  
  // Daily Schedules (Versioned snapshots)
  async getLatestSchedule(date: string): Promise<DailySchedule | undefined> {
    const [result] = await db.select()
      .from(dailySchedules)
      .where(eq(dailySchedules.date, date))
      .orderBy(desc(dailySchedules.version))
      .limit(1);
    return result || undefined;
  }
  
  async getScheduleVersions(date: string): Promise<DailySchedule[]> {
    return await db.select()
      .from(dailySchedules)
      .where(eq(dailySchedules.date, date))
      .orderBy(desc(dailySchedules.version));
  }
  
  async getScheduleByVersion(date: string, version: number): Promise<DailySchedule | undefined> {
    const [result] = await db.select()
      .from(dailySchedules)
      .where(and(
        eq(dailySchedules.date, date),
        eq(dailySchedules.version, version)
      ));
    return result || undefined;
  }
  
  async createScheduleVersion(schedule: InsertDailySchedule): Promise<DailySchedule> {
    const [result] = await db
      .insert(dailySchedules)
      .values(schedule)
      .returning();
    return result;
  }
  
  async getNextVersionNumber(date: string): Promise<number> {
    const latest = await this.getLatestSchedule(date);
    return latest ? latest.version + 1 : 1;
  }
  
  // Training Plans
  async getAllTrainingPlans(): Promise<TrainingPlan[]> {
    return await db.select().from(trainingPlans);
  }
  
  async getTrainingPlan(id: string): Promise<TrainingPlan | undefined> {
    const [result] = await db.select().from(trainingPlans).where(eq(trainingPlans.id, id));
    return result || undefined;
  }
  
  async getTrainingPlansByTrainee(traineeId: string): Promise<TrainingPlan[]> {
    return await db.select().from(trainingPlans).where(eq(trainingPlans.traineeId, traineeId));
  }
  
  async getTrainingPlansByClient(clientId: string): Promise<TrainingPlan[]> {
    return await db.select().from(trainingPlans).where(eq(trainingPlans.clientId, clientId));
  }
  
  async getTrainingPlansByTrack(trackType: string): Promise<TrainingPlan[]> {
    return await db.select().from(trainingPlans).where(eq(trainingPlans.trackType, trackType));
  }
  
  async createTrainingPlan(plan: InsertTrainingPlan): Promise<TrainingPlan> {
    const [result] = await db.insert(trainingPlans).values(plan).returning();
    return result;
  }
  
  async updateTrainingPlan(id: string, plan: Partial<InsertTrainingPlan>): Promise<TrainingPlan | undefined> {
    const [result] = await db.update(trainingPlans).set(plan).where(eq(trainingPlans.id, id)).returning();
    return result || undefined;
  }
  
  async deleteTrainingPlan(id: string): Promise<boolean> {
    const result = await db.delete(trainingPlans).where(eq(trainingPlans.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }
  
  // Training Sessions
  async getTrainingSessions(planId: string): Promise<TrainingSession[]> {
    return await db.select().from(trainingSessions).where(eq(trainingSessions.planId, planId));
  }
  
  async getAllTrainingSessions(): Promise<TrainingSession[]> {
    return await db.select().from(trainingSessions);
  }
  
  async getTrainingSession(id: string): Promise<TrainingSession | undefined> {
    const [result] = await db.select().from(trainingSessions).where(eq(trainingSessions.id, id));
    return result || undefined;
  }
  
  async getTrainingSessionsByDate(date: string): Promise<TrainingSession[]> {
    return await db.select().from(trainingSessions).where(eq(trainingSessions.scheduledDate, date));
  }
  
  async createTrainingSession(session: InsertTrainingSession): Promise<TrainingSession> {
    const [result] = await db.insert(trainingSessions).values(session).returning();
    return result;
  }
  
  async createTrainingSessions(sessions: InsertTrainingSession[]): Promise<TrainingSession[]> {
    if (sessions.length === 0) return [];
    return await db.insert(trainingSessions).values(sessions).returning();
  }
  
  async updateTrainingSession(id: string, session: Partial<InsertTrainingSession>): Promise<TrainingSession | undefined> {
    const [result] = await db.update(trainingSessions).set(session).where(eq(trainingSessions.id, id)).returning();
    return result || undefined;
  }
  
  async deleteTrainingSession(id: string): Promise<boolean> {
    const result = await db.delete(trainingSessions).where(eq(trainingSessions.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }
  
  async deleteTrainingSessionsByPlan(planId: string): Promise<boolean> {
    const result = await db.delete(trainingSessions).where(eq(trainingSessions.planId, planId));
    return result.rowCount ? result.rowCount >= 0 : false;
  }
  
  // CM Lead BCBA Links
  async getCmLeadBcbaLinks(clinicalManagerId: string): Promise<CmLeadBcbaLink[]> {
    return await db.select().from(cmLeadBcbaLinks).where(eq(cmLeadBcbaLinks.clinicalManagerId, clinicalManagerId));
  }
  
  async getAllCmLeadBcbaLinks(): Promise<CmLeadBcbaLink[]> {
    return await db.select().from(cmLeadBcbaLinks);
  }
  
  async setCmLeadBcbaLinks(clinicalManagerId: string, leadBcbaIds: string[]): Promise<CmLeadBcbaLink[]> {
    await db.delete(cmLeadBcbaLinks).where(eq(cmLeadBcbaLinks.clinicalManagerId, clinicalManagerId));
    if (leadBcbaIds.length === 0) return [];
    const links = leadBcbaIds.map(leadBcbaId => ({ clinicalManagerId, leadBcbaId }));
    return await db.insert(cmLeadBcbaLinks).values(links).returning();
  }
  
  // CM Admin Links
  async getCmAdminLinks(clinicalManagerId: string): Promise<CmAdminLink[]> {
    return await db.select().from(cmAdminLinks).where(eq(cmAdminLinks.clinicalManagerId, clinicalManagerId));
  }
  
  async getAllCmAdminLinks(): Promise<CmAdminLink[]> {
    return await db.select().from(cmAdminLinks);
  }
  
  async setCmAdminLinks(clinicalManagerId: string, adminIds: string[]): Promise<CmAdminLink[]> {
    await db.delete(cmAdminLinks).where(eq(cmAdminLinks.clinicalManagerId, clinicalManagerId));
    if (adminIds.length === 0) return [];
    const links = adminIds.map(adminId => ({ clinicalManagerId, adminId }));
    return await db.insert(cmAdminLinks).values(links).returning();
  }
  
  // Lead RBT BCBA Links
  async getLeadRbtBcbaLinks(leadRbtId: string): Promise<LeadRbtBcbaLink[]> {
    return await db.select().from(leadRbtBcbaLinks).where(eq(leadRbtBcbaLinks.leadRbtId, leadRbtId));
  }
  
  async getAllLeadRbtBcbaLinks(): Promise<LeadRbtBcbaLink[]> {
    return await db.select().from(leadRbtBcbaLinks);
  }
  
  async setLeadRbtBcbaLinks(leadRbtId: string, bcbaIds: string[]): Promise<LeadRbtBcbaLink[]> {
    await db.delete(leadRbtBcbaLinks).where(eq(leadRbtBcbaLinks.leadRbtId, leadRbtId));
    if (bcbaIds.length === 0) return [];
    const links = bcbaIds.map(bcbaId => ({ leadRbtId, bcbaId }));
    return await db.insert(leadRbtBcbaLinks).values(links).returning();
  }
  
  // Client Cancel History
  async getClientCancelHistory(clientId: string): Promise<ClientCancelHistory[]> {
    return await db.select().from(clientCancelHistory)
      .where(eq(clientCancelHistory.clientId, clientId))
      .orderBy(desc(clientCancelHistory.createdAt));
  }
  
  async getAllClientCancelHistory(): Promise<ClientCancelHistory[]> {
    return await db.select().from(clientCancelHistory).orderBy(desc(clientCancelHistory.createdAt));
  }
  
  async createClientCancelHistory(history: InsertClientCancelHistory): Promise<ClientCancelHistory> {
    const [result] = await db.insert(clientCancelHistory).values(history).returning();
    return result;
  }
  
  async deleteClientCancelHistory(id: string): Promise<boolean> {
    const result = await db.delete(clientCancelHistory).where(eq(clientCancelHistory.id, id));
    return (result.rowCount ?? 0) > 0;
  }
  
  // Client Sub History
  async getClientSubHistory(clientId: string): Promise<ClientSubHistory[]> {
    return await db.select().from(clientSubHistory)
      .where(eq(clientSubHistory.clientId, clientId))
      .orderBy(desc(clientSubHistory.createdAt));
  }
  
  async getAllClientSubHistory(): Promise<ClientSubHistory[]> {
    return await db.select().from(clientSubHistory).orderBy(desc(clientSubHistory.createdAt));
  }
  
  async createClientSubHistory(history: InsertClientSubHistory): Promise<ClientSubHistory> {
    const [result] = await db.insert(clientSubHistory).values(history).returning();
    return result;
  }
  
  async deleteClientSubHistory(id: string): Promise<boolean> {
    const result = await db.delete(clientSubHistory).where(eq(clientSubHistory.id, id));
    return (result.rowCount ?? 0) > 0;
  }
  
  // Client Skip History
  async getClientSkipHistory(clientId: string): Promise<ClientSkipHistory[]> {
    return await db.select().from(clientSkipHistory)
      .where(eq(clientSkipHistory.clientId, clientId))
      .orderBy(desc(clientSkipHistory.createdAt));
  }
  
  async getAllClientSkipHistory(): Promise<ClientSkipHistory[]> {
    return await db.select().from(clientSkipHistory).orderBy(desc(clientSkipHistory.createdAt));
  }
  
  async createClientSkipHistory(history: InsertClientSkipHistory): Promise<ClientSkipHistory> {
    const [result] = await db.insert(clientSkipHistory).values(history).returning();
    return result;
  }
  
  async deleteClientSkipHistory(id: string): Promise<boolean> {
    const result = await db.delete(clientSkipHistory).where(eq(clientSkipHistory.id, id));
    return (result.rowCount ?? 0) > 0;
  }
  
  // Ideal Day Templates
  async getAllIdealDayTemplates(): Promise<IdealDayTemplate[]> {
    return await db.select().from(idealDayTemplates);
  }
  
  async getIdealDayTemplate(weekDay: string): Promise<IdealDayTemplate | undefined> {
    const [result] = await db.select().from(idealDayTemplates).where(eq(idealDayTemplates.weekDay, weekDay));
    return result || undefined;
  }
  
  async getIdealDayTemplateById(id: string): Promise<IdealDayTemplate | undefined> {
    const [result] = await db.select().from(idealDayTemplates).where(eq(idealDayTemplates.id, id));
    return result || undefined;
  }
  
  async createIdealDayTemplate(template: InsertIdealDayTemplate): Promise<IdealDayTemplate> {
    const [result] = await db.insert(idealDayTemplates).values(template).returning();
    return result;
  }
  
  async updateIdealDayTemplate(id: string, template: Partial<InsertIdealDayTemplate>): Promise<IdealDayTemplate | undefined> {
    const [result] = await db.update(idealDayTemplates)
      .set({ ...template, updatedAt: new Date() })
      .where(eq(idealDayTemplates.id, id))
      .returning();
    return result || undefined;
  }
  
  async deleteIdealDayTemplate(id: string): Promise<boolean> {
    const result = await db.delete(idealDayTemplates).where(eq(idealDayTemplates.id, id));
    return (result.rowCount ?? 0) > 0;
  }
  
  // Ideal Day Segments
  async getIdealDaySegments(templateId: string): Promise<IdealDaySegment[]> {
    return await db.select().from(idealDaySegments)
      .where(eq(idealDaySegments.templateId, templateId))
      .orderBy(idealDaySegments.staffId, idealDaySegments.sortOrder);
  }
  
  async getIdealDaySegmentsByStaff(templateId: string, staffId: string): Promise<IdealDaySegment[]> {
    return await db.select().from(idealDaySegments)
      .where(and(eq(idealDaySegments.templateId, templateId), eq(idealDaySegments.staffId, staffId)))
      .orderBy(idealDaySegments.sortOrder);
  }
  
  async createIdealDaySegment(segment: InsertIdealDaySegment): Promise<IdealDaySegment> {
    const [result] = await db.insert(idealDaySegments).values(segment).returning();
    return result;
  }
  
  async updateIdealDaySegment(id: string, segment: Partial<InsertIdealDaySegment>): Promise<IdealDaySegment | undefined> {
    const [result] = await db.update(idealDaySegments)
      .set(segment)
      .where(eq(idealDaySegments.id, id))
      .returning();
    return result || undefined;
  }
  
  async deleteIdealDaySegment(id: string): Promise<boolean> {
    const result = await db.delete(idealDaySegments).where(eq(idealDaySegments.id, id));
    return (result.rowCount ?? 0) > 0;
  }
  
  async deleteIdealDaySegmentsByTemplate(templateId: string): Promise<boolean> {
    const result = await db.delete(idealDaySegments).where(eq(idealDaySegments.templateId, templateId));
    return (result.rowCount ?? 0) >= 0;
  }
  
  async bulkCreateIdealDaySegments(segments: InsertIdealDaySegment[]): Promise<IdealDaySegment[]> {
    if (segments.length === 0) return [];
    return await db.insert(idealDaySegments).values(segments).returning();
  }
  
  // Ideal Day Lunch Pairings
  async getIdealDayLunchPairings(templateId: string): Promise<IdealDayLunchPairing[]> {
    return await db.select().from(idealDayLunchPairings)
      .where(eq(idealDayLunchPairings.templateId, templateId));
  }
  
  async createIdealDayLunchPairing(pairing: InsertIdealDayLunchPairing): Promise<IdealDayLunchPairing> {
    const [result] = await db.insert(idealDayLunchPairings).values(pairing).returning();
    return result;
  }
  
  async updateIdealDayLunchPairing(id: string, pairing: Partial<InsertIdealDayLunchPairing>): Promise<IdealDayLunchPairing | undefined> {
    const [result] = await db.update(idealDayLunchPairings)
      .set(pairing)
      .where(eq(idealDayLunchPairings.id, id))
      .returning();
    return result || undefined;
  }
  
  async deleteIdealDayLunchPairing(id: string): Promise<boolean> {
    const result = await db.delete(idealDayLunchPairings).where(eq(idealDayLunchPairings.id, id));
    return (result.rowCount ?? 0) > 0;
  }
  
  async deleteIdealDayLunchPairingsByTemplate(templateId: string): Promise<boolean> {
    const result = await db.delete(idealDayLunchPairings).where(eq(idealDayLunchPairings.templateId, templateId));
    return (result.rowCount ?? 0) >= 0;
  }
  
  async copyIdealDayTemplate(sourceWeekDay: string, targetWeekDay: string): Promise<{
    template: IdealDayTemplate;
    segments: IdealDaySegment[];
    lunchPairings: IdealDayLunchPairing[];
  }> {
    // Get source template
    const sourceTemplate = await this.getIdealDayTemplate(sourceWeekDay);
    if (!sourceTemplate) {
      throw new Error(`Source template for ${sourceWeekDay} not found`);
    }
    
    // Get or create target template
    let targetTemplate = await this.getIdealDayTemplate(targetWeekDay);
    if (!targetTemplate) {
      targetTemplate = await this.createIdealDayTemplate({ weekDay: targetWeekDay });
    }
    
    // Get source data
    const sourceSegments = await this.getIdealDaySegments(sourceTemplate.id);
    const sourcePairings = await this.getIdealDayLunchPairings(sourceTemplate.id);
    
    // Delete existing target data
    await this.deleteIdealDaySegmentsByTemplate(targetTemplate.id);
    await this.deleteIdealDayLunchPairingsByTemplate(targetTemplate.id);
    
    // Copy segments with new templateId
    const newSegments: IdealDaySegment[] = [];
    for (const seg of sourceSegments) {
      const newSeg = await this.createIdealDaySegment({
        templateId: targetTemplate.id,
        staffId: seg.staffId,
        startMinute: seg.startMinute,
        endMinute: seg.endMinute,
        segmentType: seg.segmentType,
        clientId: seg.clientId,
        locationId: seg.locationId,
        lunchPeriod: seg.lunchPeriod,
        displayValue: seg.displayValue,
        reason: seg.reason,
        sortOrder: seg.sortOrder,
      });
      newSegments.push(newSeg);
    }
    
    // Copy lunch pairings with new templateId
    const newPairings: IdealDayLunchPairing[] = [];
    for (const p of sourcePairings) {
      const newPairing = await this.createIdealDayLunchPairing({
        templateId: targetTemplate.id,
        lunchPeriod: p.lunchPeriod,
        coveringStaffId: p.coveringStaffId,
        clientIds: p.clientIds,
        groupName: p.groupName,
        isSolo: p.isSolo,
        isGroupLeader: p.isGroupLeader,
        groupLeaderName: p.groupLeaderName,
        locationId: p.locationId,
      });
      newPairings.push(newPairing);
    }
    
    // Update target template isComplete flag to match source
    await this.updateIdealDayTemplate(targetTemplate.id, { isComplete: sourceTemplate.isComplete });
    
    return {
      template: targetTemplate,
      segments: newSegments,
      lunchPairings: newPairings,
    };
  }
  
  async generateIdealDayFromTemplate(weekDay: string): Promise<{
    template: IdealDayTemplate;
    segments: IdealDaySegment[];
    lunchPairings: IdealDayLunchPairing[];
  }> {
    // Import timing constants
    const SCHEDULE_TIMING = {
      AM_START: 510, // 8:30 AM
      AM_END: 690, // 11:30 AM
      PM_START: 780, // 1:00 PM
      PM_END: 960, // 4:00 PM
      LUNCH_FIRST_START: 690,
      LUNCH_FIRST_END: 720,
      LUNCH_SECOND_START: 720,
      LUNCH_SECOND_END: 750,
      DRIVE_BUFFER: 30,
    };
    
    // Get or create ideal day template
    let template = await this.getIdealDayTemplate(weekDay);
    if (!template) {
      template = await this.createIdealDayTemplate({ weekDay });
    }
    
    // Get template assignments for this weekday
    const assignments = await this.getTemplateAssignmentsByDay(weekDay);
    
    // Delete only generated segments (preserve manual ones)
    const existingSegments = await this.getIdealDaySegments(template.id);
    for (const seg of existingSegments) {
      if (seg.origin === "generated") {
        await this.deleteIdealDaySegment(seg.id);
      }
    }
    
    // Delete existing lunch pairings
    await this.deleteIdealDayLunchPairingsByTemplate(template.id);
    
    // Group assignments by staff
    const assignmentsByStaff = new Map<string, typeof assignments>();
    for (const assignment of assignments) {
      const staffAssignments = assignmentsByStaff.get(assignment.staffId) || [];
      staffAssignments.push(assignment);
      assignmentsByStaff.set(assignment.staffId, staffAssignments);
    }
    
    const newSegments: IdealDaySegment[] = [];
    const clientsNeedingLunch = new Map<string, { clientId: string; staffId: string }>();
    
    // Generate segments for each staff member
    const staffIds = Array.from(assignmentsByStaff.keys());
    for (const staffId of staffIds) {
      const staffAssignments = assignmentsByStaff.get(staffId) || [];
      const amAssignments = staffAssignments.filter((a: TemplateAssignment) => a.timeBlock === "AM" && a.clientId);
      const pmAssignments = staffAssignments.filter((a: TemplateAssignment) => a.timeBlock === "PM" && a.clientId);
      
      let sortOrder = 0;
      
      // Create AM client segments
      for (const assignment of amAssignments) {
        if (assignment.clientId) {
          const startMinute = assignment.startMinute || SCHEDULE_TIMING.AM_START;
          const endMinute = assignment.endMinute || SCHEDULE_TIMING.AM_END;
          
          const segment = await this.createIdealDaySegment({
            templateId: template.id,
            staffId,
            startMinute,
            endMinute,
            segmentType: "client",
            clientId: assignment.clientId,
            locationId: assignment.locationId,
            origin: "generated",
            sourceAssignmentId: assignment.id,
            sortOrder: sortOrder++,
          });
          newSegments.push(segment);
          
          // Track clients who need lunch coverage (end at or after 11:30)
          if (endMinute >= SCHEDULE_TIMING.LUNCH_FIRST_START) {
            clientsNeedingLunch.set(assignment.clientId, {
              clientId: assignment.clientId,
              staffId,
            });
          }
        }
      }
      
      // Determine lunch period for this staff (based on whether they have AM client ending at 11:30)
      const hasLateAm = amAssignments.some((a: TemplateAssignment) => {
        const end = a.endMinute || SCHEDULE_TIMING.AM_END;
        return end >= SCHEDULE_TIMING.LUNCH_FIRST_START;
      });
      
      if (hasLateAm || amAssignments.length > 0) {
        // Staff gets first lunch if they have AM clients
        const lunchSegment = await this.createIdealDaySegment({
          templateId: template.id,
          staffId,
          startMinute: SCHEDULE_TIMING.LUNCH_FIRST_START,
          endMinute: SCHEDULE_TIMING.LUNCH_FIRST_END,
          segmentType: "lunch",
          lunchPeriod: "first",
          origin: "generated",
          sortOrder: sortOrder++,
        });
        newSegments.push(lunchSegment);
      }
      
      // Check for split-location (different AM/PM locations) - add drive segment
      const amLocation = amAssignments[0]?.locationId;
      const pmLocation = pmAssignments[0]?.locationId;
      if (amLocation && pmLocation && amLocation !== pmLocation) {
        const driveSegment = await this.createIdealDaySegment({
          templateId: template.id,
          staffId,
          startMinute: SCHEDULE_TIMING.LUNCH_SECOND_START,
          endMinute: SCHEDULE_TIMING.PM_START,
          segmentType: "drive",
          displayValue: "Drive",
          origin: "generated",
          sortOrder: sortOrder++,
        });
        newSegments.push(driveSegment);
      }
      
      // Create PM client segments
      for (const assignment of pmAssignments) {
        if (assignment.clientId) {
          const startMinute = assignment.startMinute || SCHEDULE_TIMING.PM_START;
          const endMinute = assignment.endMinute || SCHEDULE_TIMING.PM_END;
          
          const segment = await this.createIdealDaySegment({
            templateId: template.id,
            staffId,
            startMinute,
            endMinute,
            segmentType: "client",
            clientId: assignment.clientId,
            locationId: assignment.locationId,
            origin: "generated",
            sourceAssignmentId: assignment.id,
            sortOrder: sortOrder++,
          });
          newSegments.push(segment);
        }
      }
    }
    
    // Generate basic lunch pairings (solo by default - can be edited manually)
    const newPairings: IdealDayLunchPairing[] = [];
    const clientIds = Array.from(clientsNeedingLunch.keys());
    for (const clientId of clientIds) {
      const info = clientsNeedingLunch.get(clientId)!;
      const pairing = await this.createIdealDayLunchPairing({
        templateId: template.id,
        lunchPeriod: "first",
        coveringStaffId: info.staffId,
        clientIds: [clientId],
        isSolo: true,
      });
      newPairings.push(pairing);
    }
    
    // Refresh segments to get all (including any preserved manual ones)
    const allSegments = await this.getIdealDaySegments(template.id);
    
    return {
      template,
      segments: allSegments,
      lunchPairings: newPairings,
    };
  }
  
  // Template Lunch Pairing Groups
  async getAllTemplateLunchPairingGroups(): Promise<TemplateLunchPairingGroup[]> {
    return await db.select().from(templateLunchPairingGroups);
  }
  
  async getTemplateLunchPairingGroupsByLocation(locationId: string): Promise<TemplateLunchPairingGroup[]> {
    return await db.select().from(templateLunchPairingGroups)
      .where(eq(templateLunchPairingGroups.locationId, locationId));
  }
  
  async getTemplateLunchPairingGroupsByLocationAndBlock(locationId: string | null, lunchBlock: string): Promise<TemplateLunchPairingGroup[]> {
    if (locationId) {
      return await db.select().from(templateLunchPairingGroups)
        .where(and(
          eq(templateLunchPairingGroups.locationId, locationId),
          eq(templateLunchPairingGroups.lunchBlock, lunchBlock)
        ));
    } else {
      return await db.select().from(templateLunchPairingGroups)
        .where(eq(templateLunchPairingGroups.lunchBlock, lunchBlock));
    }
  }
  
  async createTemplateLunchPairingGroup(group: InsertTemplateLunchPairingGroup): Promise<TemplateLunchPairingGroup> {
    const [result] = await db.insert(templateLunchPairingGroups)
      .values(group)
      .returning();
    return result;
  }
  
  async updateTemplateLunchPairingGroup(id: string, group: Partial<InsertTemplateLunchPairingGroup>): Promise<TemplateLunchPairingGroup | undefined> {
    const [result] = await db.update(templateLunchPairingGroups)
      .set(group)
      .where(eq(templateLunchPairingGroups.id, id))
      .returning();
    return result || undefined;
  }
  
  async deleteTemplateLunchPairingGroup(id: string): Promise<boolean> {
    const result = await db.delete(templateLunchPairingGroups)
      .where(eq(templateLunchPairingGroups.id, id));
    return true;
  }
  
  async deleteAllTemplateLunchPairingGroups(): Promise<boolean> {
    await db.delete(templateLunchPairingGroups);
    return true;
  }
}

export const storage = new DatabaseStorage();
