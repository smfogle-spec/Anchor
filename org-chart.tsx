import { useMemo } from "react";
import Layout from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import type { Staff, CmLeadBcbaLink, CmAdminLink, LeadRbtBcbaLink } from "@shared/schema";
import { Network, User, Users, Crown, Shield, Briefcase } from "lucide-react";
import { cn } from "@/lib/utils";

export default function OrgChart() {
  const { data: staffList = [] } = useQuery<Staff[]>({
    queryKey: ["/api/staff"],
    queryFn: async () => {
      const response = await fetch("/api/staff");
      if (!response.ok) throw new Error("Failed to fetch staff");
      return response.json();
    },
  });

  const { data: cmLeadBcbaLinks = [] } = useQuery<CmLeadBcbaLink[]>({
    queryKey: ["/api/cm-lead-bcba-links"],
    queryFn: async () => {
      const response = await fetch("/api/cm-lead-bcba-links");
      if (!response.ok) return [];
      return response.json();
    },
  });

  const { data: cmAdminLinks = [] } = useQuery<CmAdminLink[]>({
    queryKey: ["/api/cm-admin-links"],
    queryFn: async () => {
      const response = await fetch("/api/cm-admin-links");
      if (!response.ok) return [];
      return response.json();
    },
  });

  const { data: leadRbtBcbaLinks = [] } = useQuery<LeadRbtBcbaLink[]>({
    queryKey: ["/api/lead-rbt-bcba-links"],
    queryFn: async () => {
      const response = await fetch("/api/lead-rbt-bcba-links");
      if (!response.ok) return [];
      return response.json();
    },
  });

  const clinicalManagers = useMemo(() => 
    staffList.filter(s => s.role === 'Clinical Manager' && s.active).sort((a, b) => a.name.localeCompare(b.name)),
    [staffList]
  );

  const orgChartData = useMemo(() => {
    if (clinicalManagers.length === 0) return null;
    const cm = clinicalManagers[0];

    const cmLeadBcbaIds = cmLeadBcbaLinks
      .filter(l => l.clinicalManagerId === cm.id)
      .map(l => l.leadBcbaId);
    const cmAdminIds = cmAdminLinks
      .filter(l => l.clinicalManagerId === cm.id)
      .map(l => l.adminId);

    const leadBcbas = staffList
      .filter(s => cmLeadBcbaIds.includes(s.id) && s.active)
      .sort((a, b) => a.name.localeCompare(b.name));
    const admins = staffList
      .filter(s => cmAdminIds.includes(s.id) && s.active)
      .sort((a, b) => a.name.localeCompare(b.name));

    // All BCBAs (flat list, sorted alphabetically)
    const allBcbas = staffList
      .filter(s => s.role === 'BCBA' && s.active)
      .sort((a, b) => a.name.localeCompare(b.name));

    // Map Lead RBTs to their BCBAs (many-to-many)
    const leadRbtsByBcba = new Map<string, Staff[]>();
    const leadRbtAssignmentCount = new Map<string, string[]>();
    
    leadRbtBcbaLinks.forEach(link => {
      const leadRbt = staffList.find(s => s.id === link.leadRbtId && s.active);
      if (leadRbt) {
        if (!leadRbtsByBcba.has(link.bcbaId)) leadRbtsByBcba.set(link.bcbaId, []);
        const existing = leadRbtsByBcba.get(link.bcbaId)!;
        if (!existing.find(s => s.id === leadRbt.id)) {
          existing.push(leadRbt);
        }
        if (!leadRbtAssignmentCount.has(link.leadRbtId)) leadRbtAssignmentCount.set(link.leadRbtId, []);
        leadRbtAssignmentCount.get(link.leadRbtId)!.push(link.bcbaId);
      }
    });

    // Map BTs/RBTs/Floats to their assigned BCBA
    const staffByBcba = new Map<string, Staff[]>();
    staffList.forEach(s => {
      if (['BT', 'RBT', 'Float'].includes(s.role) && s.active && s.assignedBcbaId) {
        if (!staffByBcba.has(s.assignedBcbaId)) staffByBcba.set(s.assignedBcbaId, []);
        staffByBcba.get(s.assignedBcbaId)!.push(s);
      }
    });

    return {
      cm,
      leadBcbas,
      admins,
      allBcbas,
      leadRbtsByBcba,
      leadRbtAssignmentCount,
      staffByBcba
    };
  }, [clinicalManagers, staffList, cmLeadBcbaLinks, cmAdminLinks, leadRbtBcbaLinks]);

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'Clinical Manager': return 'bg-purple-100 text-purple-800 border-purple-300';
      case 'Lead BCBA': return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'Admin': return 'bg-amber-100 text-amber-800 border-amber-300';
      case 'BCBA': return 'bg-teal-100 text-teal-800 border-teal-300';
      case 'Lead RBT': return 'bg-green-100 text-green-800 border-green-300';
      case 'BT': return 'bg-slate-100 text-slate-800 border-slate-300';
      case 'RBT': return 'bg-sky-100 text-sky-800 border-sky-300';
      case 'Float': return 'bg-orange-100 text-orange-800 border-orange-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'Clinical Manager': return <Crown className="w-4 h-4" />;
      case 'Lead BCBA': return <Shield className="w-4 h-4" />;
      case 'Admin': return <Briefcase className="w-4 h-4" />;
      case 'BCBA': return <Users className="w-4 h-4" />;
      default: return <User className="w-4 h-4" />;
    }
  };

  const StaffNode = ({ staff, isShared = false, compact = false }: { staff: Staff; isShared?: boolean; compact?: boolean }) => (
    <div 
      className={cn(
        "flex flex-col items-center rounded-lg border-2 transition-all hover:shadow-md",
        compact ? "p-2 min-w-[90px]" : "p-3 min-w-[120px]",
        getRoleColor(staff.role),
        isShared && "border-dashed"
      )}
    >
      <div className="flex items-center gap-1 mb-1">
        {getRoleIcon(staff.role)}
        <span className={cn("font-medium truncate", compact ? "text-xs max-w-[70px]" : "text-sm max-w-[100px]")}>{staff.name}</span>
      </div>
      <Badge variant="outline" className="text-[10px] h-4">
        {staff.role}
      </Badge>
    </div>
  );

  const TreeLevel = ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={cn("flex flex-wrap justify-center gap-4", className)}>
      {children}
    </div>
  );

  const Connector = ({ dashed = false }: { dashed?: boolean }) => (
    <div className={cn("w-px h-6 bg-border mx-auto", dashed && "border-dashed border-l-2 border-border bg-transparent")} />
  );

  if (!orgChartData) {
    return (
      <Layout>
        <div className="container mx-auto py-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Network className="w-5 h-5" />
                Organization Chart
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-center py-8">
                No Clinical Manager found. Create a staff member with the Clinical Manager role to view the org chart.
              </p>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  const { cm, leadBcbas, admins, allBcbas, leadRbtsByBcba, leadRbtAssignmentCount, staffByBcba } = orgChartData;

  return (
    <Layout>
      <div className="container mx-auto py-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Network className="w-5 h-5" />
              Organization Chart
            </CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <div className="min-w-[800px] space-y-4">
              {/* Level 1: Clinical Manager */}
              <TreeLevel className="justify-center">
                <StaffNode staff={cm} />
              </TreeLevel>

              <Connector />

              {/* Level 2: Lead BCBAs and Admins (parallel) */}
              <TreeLevel className="justify-center gap-8">
                {leadBcbas.length > 0 && (
                  <div className="flex flex-col items-center">
                    <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wide">Lead BCBAs</p>
                    <div className="flex flex-wrap gap-3 justify-center">
                      {leadBcbas.map(lb => (
                        <StaffNode key={lb.id} staff={lb} />
                      ))}
                    </div>
                  </div>
                )}

                {admins.length > 0 && (
                  <div className="flex flex-col items-center">
                    <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wide">Admins</p>
                    <div className="flex flex-wrap gap-3 justify-center">
                      {admins.map(admin => (
                        <StaffNode key={admin.id} staff={admin} />
                      ))}
                    </div>
                  </div>
                )}
              </TreeLevel>

              {allBcbas.length > 0 && (
                <>
                  <Connector />

                  {/* Level 3: All BCBAs (parallel row) */}
                  <div className="flex flex-col items-center">
                    <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wide">BCBAs</p>
                    <div className="flex flex-wrap gap-3 justify-center">
                      {allBcbas.map(bcba => (
                        <StaffNode key={bcba.id} staff={bcba} />
                      ))}
                    </div>
                  </div>

                  <Connector />

                  {/* Level 4: Lead RBTs organized by BCBA (parallel row) */}
                  {allBcbas.some(bcba => leadRbtsByBcba.get(bcba.id)?.length) && (
                    <div className="flex flex-col items-center">
                      <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wide">Lead RBTs</p>
                      <div className="flex flex-wrap gap-6 justify-center">
                        {allBcbas.map(bcba => {
                          const leadRbts = leadRbtsByBcba.get(bcba.id) || [];
                          if (leadRbts.length === 0) return null;
                          return (
                            <div key={bcba.id} className="flex flex-col items-center">
                              <p className="text-[10px] text-muted-foreground mb-1">{bcba.name}'s Team</p>
                              <div className="flex flex-wrap gap-2 justify-center">
                                {leadRbts.sort((a, b) => a.name.localeCompare(b.name)).map(leadRbt => {
                                  const isShared = (leadRbtAssignmentCount.get(leadRbt.id)?.length || 0) > 1;
                                  return (
                                    <StaffNode key={leadRbt.id} staff={leadRbt} isShared={isShared} />
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <Connector />

                  {/* Level 5: BTs/RBTs/Floats organized by BCBA (parallel row) */}
                  {allBcbas.some(bcba => staffByBcba.get(bcba.id)?.length) && (
                    <div className="flex flex-col items-center">
                      <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wide">RBTs / BTs / Floats</p>
                      <div className="flex flex-wrap gap-6 justify-center">
                        {allBcbas.map(bcba => {
                          const staff = staffByBcba.get(bcba.id) || [];
                          if (staff.length === 0) return null;
                          return (
                            <div key={bcba.id} className="flex flex-col items-center">
                              <p className="text-[10px] text-muted-foreground mb-1">{bcba.name}'s Team</p>
                              <div className="flex flex-wrap gap-2 justify-center max-w-[300px]">
                                {staff.sort((a, b) => a.name.localeCompare(b.name)).map(s => (
                                  <StaffNode key={s.id} staff={s} compact />
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
            
            <div className="mt-8 pt-4 border-t">
              <p className="text-xs text-muted-foreground mb-2">Legend:</p>
              <div className="flex flex-wrap gap-4">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-dashed rounded" />
                  <span className="text-xs">Shared (assigned to multiple BCBAs)</span>
                </div>
                {['Clinical Manager', 'Lead BCBA', 'Admin', 'BCBA', 'Lead RBT', 'BT', 'RBT', 'Float'].map(role => (
                  <div key={role} className="flex items-center gap-1">
                    <div className={cn("w-3 h-3 rounded border", getRoleColor(role))} />
                    <span className="text-xs">{role}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
