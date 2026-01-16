import type {
  Staff,
  Exception,
  SchedulerTrainingSession,
  TrainingSessionUpdate,
} from "./types";

export interface TrainingModuleResult {
  trainingSessionUpdates: TrainingSessionUpdate[];
  todayTrainingSessions: SchedulerTrainingSession[];
}

export function isNewHireProtected(
  staffId: string,
  allStaff: Staff[]
): boolean {
  const staffMember = allStaff.find(s => s.id === staffId);
  if (!staffMember || !staffMember.hireDate) return false;
  if (staffMember.newHireOverride) return false;
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const hireDate = new Date(staffMember.hireDate);
  const daysSinceHire = Math.floor((today.getTime() - hireDate.getTime()) / (1000 * 60 * 60 * 24));
  return daysSinceHire < 30;
}

export function processTrainingSessions(
  trainingSessions: SchedulerTrainingSession[],
  exceptions: Exception[],
  outStaffIds: Set<string>,
  unavailableClients: Set<string>,
  todayDateStr: string
): TrainingModuleResult {
  const trainingSessionUpdates: TrainingSessionUpdate[] = [];
  
  const todayTrainingSessions = trainingSessions.filter(ts => 
    ts.scheduledDate === todayDateStr && 
    ts.status === 'planned' &&
    (ts.planStatus === 'active' || ts.planStatus === null)
  );
  
  for (const session of todayTrainingSessions) {
    if (session.traineeId && outStaffIds.has(session.traineeId)) {
      trainingSessionUpdates.push({
        sessionId: session.id,
        newStatus: 'disrupted',
        reason: `Trainee is OUT for the day`
      });
      continue;
    }
    
    if (session.trainerId && outStaffIds.has(session.trainerId)) {
      trainingSessionUpdates.push({
        sessionId: session.id,
        newStatus: 'disrupted',
        reason: `Trainer is OUT for the day`
      });
      continue;
    }
    
    if (session.clientId && unavailableClients.has(session.clientId)) {
      trainingSessionUpdates.push({
        sessionId: session.id,
        newStatus: 'disrupted',
        reason: `Client is unavailable (cancelled or out)`
      });
      continue;
    }
  }
  
  return {
    trainingSessionUpdates,
    todayTrainingSessions: todayTrainingSessions.filter(
      ts => !trainingSessionUpdates.some(u => u.sessionId === ts.id)
    )
  };
}

export function checkTrainingDisruption(
  session: SchedulerTrainingSession,
  traineeOut: boolean,
  trainerOut: boolean,
  clientUnavailable: boolean
): TrainingSessionUpdate | null {
  if (traineeOut) {
    return {
      sessionId: session.id,
      newStatus: 'disrupted',
      reason: 'Trainee is OUT for the day'
    };
  }
  
  if (trainerOut) {
    return {
      sessionId: session.id,
      newStatus: 'disrupted',
      reason: 'Trainer is OUT for the day'
    };
  }
  
  if (clientUnavailable) {
    return {
      sessionId: session.id,
      newStatus: 'disrupted',
      reason: 'Client is unavailable (cancelled or out)'
    };
  }
  
  return null;
}
