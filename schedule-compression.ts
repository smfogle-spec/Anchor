interface CompressedSnapshot {
  v: number;
  d: string;
  s: CompressedStaffSchedule[];
  e: CompressedException[];
  a: CompressedApproval[];
}

interface CompressedStaffSchedule {
  i: string;
  n: string;
  l: CompressedSlot[];
}

interface CompressedSlot {
  b: string;
  v: string;
  c?: string;
  s?: string;
  r?: string;
  o?: string;
  t?: string;
}

interface CompressedException {
  i: string;
  t: string;
  e: string;
  m: string;
  a?: boolean;
  w?: { s: string; e: string };
}

interface CompressedApproval {
  i: string;
  t: string;
  r: string;
  s: string;
}

const STATUS_MAP: Record<string, string> = {
  assigned: "a",
  unfilled: "u",
  cancelled: "c",
};

const STATUS_REVERSE: Record<string, string> = {
  a: "assigned",
  u: "unfilled",
  c: "cancelled",
};

export function compressSnapshot(snapshot: any): string {
  const compressed: CompressedSnapshot = {
    v: 1,
    d: new Date().toISOString().split("T")[0],
    s: (snapshot.staffSchedules || []).map((ss: any) => ({
      i: ss.staffId,
      n: ss.staffName,
      l: (ss.slots || []).map((slot: any) => {
        const cs: CompressedSlot = {
          b: slot.block,
          v: slot.value,
        };
        if (slot.clientId) cs.c = slot.clientId;
        if (slot.status) cs.s = STATUS_MAP[slot.status] || slot.status;
        if (slot.reason) cs.r = slot.reason;
        if (slot.source) cs.o = slot.source;
        if (slot.location) cs.t = slot.location;
        return cs;
      }),
    })),
    e: (snapshot.exceptions || []).map((ex: any) => {
      const ce: CompressedException = {
        i: ex.id,
        t: ex.type,
        e: ex.entityId,
        m: ex.mode,
      };
      if (ex.allDay) ce.a = true;
      if (ex.timeWindow) ce.w = { s: ex.timeWindow.start, e: ex.timeWindow.end };
      return ce;
    }),
    a: (snapshot.approvals || []).map((ap: any) => ({
      i: ap.id,
      t: ap.type,
      r: ap.relatedId,
      s: ap.status,
    })),
  };

  return JSON.stringify(compressed);
}

export function decompressSnapshot(compressed: string): any {
  const data: CompressedSnapshot = JSON.parse(compressed);

  return {
    staffSchedules: data.s.map((ss) => ({
      staffId: ss.i,
      staffName: ss.n,
      slots: ss.l.map((slot) => ({
        block: slot.b,
        value: slot.v,
        clientId: slot.c,
        status: slot.s ? STATUS_REVERSE[slot.s] || slot.s : undefined,
        reason: slot.r,
        source: slot.o,
        location: slot.t,
      })),
    })),
    exceptions: data.e.map((ex) => ({
      id: ex.i,
      type: ex.t,
      entityId: ex.e,
      mode: ex.m,
      allDay: ex.a || false,
      timeWindow: ex.w ? { start: ex.w.s, end: ex.w.e } : undefined,
    })),
    approvals: data.a.map((ap) => ({
      id: ap.i,
      type: ap.t,
      relatedId: ap.r,
      status: ap.s,
    })),
  };
}

export function estimateCompressionRatio(original: any): {
  originalSize: number;
  compressedSize: number;
  ratio: number;
} {
  const originalStr = JSON.stringify(original);
  const compressedStr = compressSnapshot(original);
  
  return {
    originalSize: originalStr.length,
    compressedSize: compressedStr.length,
    ratio: compressedStr.length / originalStr.length,
  };
}
