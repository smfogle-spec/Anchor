import { storage } from "./storage";
import type { InsertStaff, InsertClient, InsertTemplateAssignment } from "@shared/schema";

// Mock Staff Data
const STAFF_DATA: InsertStaff[] = [
  {
    name: "Remy",
    active: true,
    startDate: "2023-01-15",
    assignedBcbaId: null,
    role: "BCBA",
    subEligible: false,
    btCertificationDate: undefined,
    rbtCertificationDate: undefined,
    availability: {
      mon: { enabled: true, start: "08:00", end: "17:00" },
      tue: { enabled: true, start: "08:00", end: "17:00" },
      wed: { enabled: true, start: "08:00", end: "17:00" },
      thu: { enabled: true, start: "08:00", end: "17:00" },
      fri: { enabled: true, start: "08:00", end: "17:00" }
    }
  },
  {
    name: "Jordan",
    active: true,
    startDate: "2023-03-01",
    assignedBcbaId: null,
    role: "RBT",
    subEligible: true,
    rbtCertificationDate: "2023-02-15",
    availability: {
      mon: { enabled: true, start: "08:00", end: "16:30" },
      tue: { enabled: true, start: "08:00", end: "16:30" },
      wed: { enabled: true, start: "08:00", end: "16:30" },
      thu: { enabled: true, start: "08:00", end: "16:30" },
      fri: { enabled: true, start: "08:00", end: "16:30" }
    }
  },
  {
    name: "Mackenzie",
    active: true,
    startDate: "2023-04-10",
    assignedBcbaId: null,
    role: "RBT",
    subEligible: true,
    rbtCertificationDate: "2023-03-20",
    availability: {
      mon: { enabled: true, start: "08:00", end: "16:30" },
      tue: { enabled: true, start: "08:00", end: "16:30" },
      wed: { enabled: true, start: "08:00", end: "16:30" },
      thu: { enabled: true, start: "08:00", end: "16:30" },
      fri: { enabled: true, start: "08:00", end: "16:30" }
    }
  },
  {
    name: "Josh",
    active: true,
    startDate: "2023-05-01",
    assignedBcbaId: null,
    role: "Lead RBT",
    subEligible: true,
    leadLevel: 2,
    rbtCertificationDate: "2022-12-01",
    availability: {
      mon: { enabled: true, start: "08:00", end: "16:30" },
      tue: { enabled: true, start: "08:00", end: "16:30" },
      wed: { enabled: true, start: "08:00", end: "16:30" },
      thu: { enabled: true, start: "08:00", end: "16:30" },
      fri: { enabled: true, start: "08:00", end: "16:30" }
    }
  },
  {
    name: "Cameryn",
    active: true,
    startDate: "2023-06-01",
    assignedBcbaId: null,
    role: "RBT",
    subEligible: false,
    rbtCertificationDate: "2023-05-15",
    availability: {
      mon: { enabled: true, start: "08:00", end: "16:30" },
      tue: { enabled: true, start: "08:00", end: "16:30" },
      wed: { enabled: true, start: "08:00", end: "16:30" },
      thu: { enabled: true, start: "08:00", end: "16:30" },
      fri: { enabled: true, start: "08:00", end: "16:30" }
    }
  },
  {
    name: "Madison",
    active: true,
    startDate: "2023-07-01",
    assignedBcbaId: null,
    role: "RBT",
    subEligible: true,
    rbtCertificationDate: "2023-06-10",
    availability: {
      mon: { enabled: true, start: "08:00", end: "16:30" },
      tue: { enabled: true, start: "08:00", end: "16:30" },
      wed: { enabled: true, start: "08:00", end: "16:30" },
      thu: { enabled: true, start: "08:00", end: "16:30" },
      fri: { enabled: true, start: "08:00", end: "16:30" }
    }
  },
  {
    name: "Sabrina",
    active: true,
    startDate: "2023-08-01",
    assignedBcbaId: null,
    role: "RBT",
    subEligible: true,
    rbtCertificationDate: "2023-07-15",
    availability: {
      mon: { enabled: true, start: "08:00", end: "16:30" },
      tue: { enabled: true, start: "08:00", end: "16:30" },
      wed: { enabled: true, start: "08:00", end: "16:30" },
      thu: { enabled: true, start: "08:00", end: "16:30" },
      fri: { enabled: true, start: "08:00", end: "16:30" }
    }
  },
  {
    name: "Sophia",
    active: true,
    startDate: "2023-09-01",
    assignedBcbaId: null,
    role: "Float",
    subEligible: true,
    rbtCertificationDate: "2023-08-10",
    availability: {
      mon: { enabled: true, start: "08:00", end: "16:30" },
      tue: { enabled: true, start: "08:00", end: "16:30" },
      wed: { enabled: true, start: "08:00", end: "16:30" },
      thu: { enabled: true, start: "08:00", end: "16:30" },
      fri: { enabled: true, start: "08:00", end: "16:30" }
    }
  },
  {
    name: "Brad",
    active: true,
    startDate: "2023-10-01",
    assignedBcbaId: null,
    role: "RBT",
    subEligible: true,
    rbtCertificationDate: "2023-09-15",
    availability: {
      mon: { enabled: true, start: "08:00", end: "16:30" },
      tue: { enabled: true, start: "08:00", end: "16:30" },
      wed: { enabled: true, start: "08:00", end: "16:30" },
      thu: { enabled: true, start: "08:00", end: "16:30" },
      fri: { enabled: true, start: "08:00", end: "16:30" }
    }
  },
  {
    name: "Katie",
    active: true,
    startDate: "2023-11-01",
    assignedBcbaId: null,
    role: "RBT",
    subEligible: true,
    rbtCertificationDate: "2023-10-10",
    availability: {
      mon: { enabled: true, start: "08:00", end: "16:30" },
      tue: { enabled: true, start: "08:00", end: "16:30" },
      wed: { enabled: true, start: "08:00", end: "16:30" },
      thu: { enabled: true, start: "08:00", end: "16:30" },
      fri: { enabled: true, start: "08:00", end: "16:30" }
    }
  },
  {
    name: "Isabel",
    active: true,
    startDate: "2023-12-01",
    assignedBcbaId: null,
    role: "RBT",
    subEligible: false,
    rbtCertificationDate: "2023-11-15",
    availability: {
      mon: { enabled: true, start: "08:00", end: "16:30" },
      tue: { enabled: true, start: "08:00", end: "16:30" },
      wed: { enabled: true, start: "08:00", end: "16:30" },
      thu: { enabled: true, start: "08:00", end: "16:30" },
      fri: { enabled: true, start: "08:00", end: "16:30" }
    }
  },
  {
    name: "Chema",
    active: true,
    startDate: "2024-01-01",
    assignedBcbaId: null,
    role: "RBT",
    subEligible: true,
    rbtCertificationDate: "2023-12-01",
    availability: {
      mon: { enabled: true, start: "08:00", end: "16:30" },
      tue: { enabled: true, start: "08:00", end: "16:30" },
      wed: { enabled: true, start: "08:00", end: "16:30" },
      thu: { enabled: true, start: "08:00", end: "16:30" },
      fri: { enabled: true, start: "08:00", end: "16:30" }
    }
  },
  {
    name: "Sara C",
    active: true,
    startDate: "2024-02-01",
    assignedBcbaId: null,
    role: "RBT",
    subEligible: true,
    rbtCertificationDate: "2024-01-10",
    availability: {
      mon: { enabled: true, start: "08:00", end: "16:30" },
      tue: { enabled: true, start: "08:00", end: "16:30" },
      wed: { enabled: true, start: "08:00", end: "16:30" },
      thu: { enabled: true, start: "08:00", end: "16:30" },
      fri: { enabled: true, start: "08:00", end: "16:30" }
    }
  }
];

async function seed() {
  console.log("Starting database seed...");
  
  try {
    // Seed Staff
    console.log("Seeding staff...");
    for (const staffMember of STAFF_DATA) {
      await storage.createStaff(staffMember);
    }
    console.log(`✓ Seeded ${STAFF_DATA.length} staff members`);
    
    console.log("✓ Database seeding completed successfully!");
  } catch (error) {
    console.error("Error seeding database:", error);
    process.exit(1);
  }
  
  process.exit(0);
}

seed();
