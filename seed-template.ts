import { storage } from "./storage";
import { db } from "./db";
import { staff, clients } from "@shared/schema";

async function seedTemplate() {
  console.log("Starting template seed...");
  
  try {
    // Get all staff and clients from database
    const allStaff = await db.select().from(staff);
    const allClients = await db.select().from(clients);
    
    console.log(`Found ${allStaff.length} staff and ${allClients.length} clients`);
    
    // Create template assignments for Monday through Friday
    const days = ['mon', 'tue', 'wed', 'thu', 'fri'];
    const blocks = ['AM', 'PM'];
    
    const assignments = [];
    
    // For each staff member, create assignments
    const nonBcbaStaff = allStaff.filter(s => s.role !== 'BCBA');
    
    for (const day of days) {
      for (const block of blocks) {
        for (let i = 0; i < nonBcbaStaff.length; i++) {
          const staffMember = nonBcbaStaff[i];
          // Assign clients in round-robin fashion
          const clientIndex = (i + (block === 'PM' ? 5 : 0)) % allClients.length;
          const client = allClients[clientIndex];
          
          assignments.push({
            weekDay: day,
            timeBlock: block,
            staffId: staffMember.id,
            clientId: client ? client.id : null
          });
        }
      }
    }
    
    // Bulk upsert
    const result = await storage.bulkUpsertTemplateAssignments(assignments);
    console.log(`✓ Seeded ${result.length} template assignments`);
    console.log("✓ Template seeding completed successfully!");
  } catch (error) {
    console.error("Error seeding template:", error);
    process.exit(1);
  }
  
  process.exit(0);
}

seedTemplate();
