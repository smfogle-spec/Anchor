import { useState, useEffect } from "react";
import Layout from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Search, Plus, Save, User, MapPin, Clock, Users, Shield, BookOpen, Utensils, Copy, Trash2, Ban, Scissors, CalendarX, Link2, X, AlertTriangle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";
import type { ClientCancelLink } from "@shared/schema";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { type WeeklyAvailability } from "@/lib/mock-data";
import type { Client, Staff, ClientLocation, School, ClientLocationStaffApproval, TemplateAssignment } from "@shared/schema";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export default function ClientInfo() {
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [pendingApply, setPendingApply] = useState<{ day: 'mon' | 'tue' | 'wed' | 'thu' | 'fri'; field: 'start' | 'end'; value: string } | null>(null);
  const [newSchoolNames, setNewSchoolNames] = useState<Record<string, string>>({});
  
  // Search states for toggle lists
  const [trainedStaffSearch, setTrainedStaffSearch] = useState("");
  const [lunchCoverageSearch, setLunchCoverageSearch] = useState("");
  const [staffExclusionsSearch, setStaffExclusionsSearch] = useState("");
  const [allowedTrainersSearch, setAllowedTrainersSearch] = useState("");
  const [allowedLunchPeersSearch, setAllowedLunchPeersSearch] = useState("");
  const [cancelLinksSearch, setCancelLinksSearch] = useState("");
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch all clients
  const { data: clients = [], isLoading: clientsLoading } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
    queryFn: async () => {
      const response = await fetch("/api/clients");
      if (!response.ok) throw new Error("Failed to fetch clients");
      return response.json();
    },
  });

  // Fetch all staff for staff selection dropdowns
  const { data: staffList = [] } = useQuery<Staff[]>({
    queryKey: ["/api/staff"],
    queryFn: async () => {
      const response = await fetch("/api/staff");
      if (!response.ok) throw new Error("Failed to fetch staff");
      return response.json();
    },
  });

  // Fetch all schools
  const { data: schoolsList = [] } = useQuery<School[]>({
    queryKey: ["/api/schools"],
    queryFn: async () => {
      const response = await fetch("/api/schools");
      if (!response.ok) throw new Error("Failed to fetch schools");
      return response.json();
    },
  });

  // Create school mutation
  const createSchoolMutation = useMutation({
    mutationFn: async (data: Omit<School, "id">) => {
      const response = await fetch("/api/schools", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to create school");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/schools"] });
      toast({
        title: "School Added",
        description: "New school created with lunch settings.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create school",
        variant: "destructive",
      });
    },
  });

  // Update school mutation
  const updateSchoolMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<School> }) => {
      const response = await fetch(`/api/schools/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to update school");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/schools"] });
      toast({
        title: "School Updated",
        description: "School settings saved.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update school",
        variant: "destructive",
      });
    },
  });

  // Update client mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Client> }) => {
      const response = await fetch(`/api/clients/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to update client");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      toast({
        title: "Changes Saved",
        description: "Client profile updated successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save changes",
        variant: "destructive",
      });
    },
  });

  // Create client mutation
  const createMutation = useMutation({
    mutationFn: async (data: Omit<Client, "id">) => {
      const response = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to create client");
      return response.json();
    },
    onSuccess: (newClient) => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      setSelectedClientId(newClient.id);
      toast({
        title: "Client Added",
        description: "New client profile created.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create client",
        variant: "destructive",
      });
    },
  });

  // Delete client mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/clients/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete client");
      return id;
    },
    onSuccess: (deletedId) => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      if (selectedClientId === deletedId) {
        const remaining = clients.filter(c => c.id !== deletedId);
        setSelectedClientId(remaining.length > 0 ? remaining[0].id : null);
      }
      toast({
        title: "Client Removed",
        description: "Client has been removed from the system.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to remove client",
        variant: "destructive",
      });
    },
  });

  // Fetch cancel links for selected client
  const { data: clientCancelLinksData = [] } = useQuery<ClientCancelLink[]>({
    queryKey: ["/api/clients", selectedClientId, "cancel-links"],
    queryFn: async () => {
      if (!selectedClientId) return [];
      const response = await fetch(`/api/clients/${selectedClientId}/cancel-links`);
      if (!response.ok) throw new Error("Failed to fetch cancel links");
      return response.json();
    },
    enabled: !!selectedClientId,
  });

  // Set cancel links mutation
  const setCancelLinksMutation = useMutation({
    mutationFn: async ({ clientId, linkedClientIds }: { clientId: string; linkedClientIds: string[] }) => {
      const response = await fetch(`/api/clients/${clientId}/cancel-links`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ linkedClientIds }),
      });
      if (!response.ok) throw new Error("Failed to update cancel links");
      return response.json();
    },
    onSuccess: (_data, variables) => {
      // Invalidate both the client's cancel links and all other clients' links (for bidirectional sync)
      queryClient.invalidateQueries({ queryKey: ["/api/clients", variables.clientId, "cancel-links"] });
      // Invalidate all client cancel-links queries to update bidirectional links
      queryClient.invalidateQueries({ predicate: (query) => 
        query.queryKey.length >= 3 && 
        query.queryKey[0] === "/api/clients" && 
        query.queryKey[2] === "cancel-links"
      });
      toast({
        title: "Linked Cancels Updated",
        description: "Linked cancel settings saved for both clients.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update linked cancels",
        variant: "destructive",
      });
    },
  });

  // Fetch cancel history for selected client
  const { data: cancelHistory = [] } = useQuery<{
    id: string;
    clientId: string;
    date: string;
    timeBlock: string;
    reason: string | null;
    createdAt: string;
  }[]>({
    queryKey: ["/api/clients", selectedClientId, "history", "cancels"],
    queryFn: async () => {
      if (!selectedClientId) return [];
      const response = await fetch(`/api/clients/${selectedClientId}/history/cancels`);
      if (!response.ok) throw new Error("Failed to fetch cancel history");
      return response.json();
    },
    enabled: !!selectedClientId,
  });

  // Fetch sub history for selected client
  const { data: subHistory = [] } = useQuery<{
    id: string;
    clientId: string;
    date: string;
    timeBlock: string;
    subStaffId: string;
    originalStaffId: string | null;
    createdAt: string;
  }[]>({
    queryKey: ["/api/clients", selectedClientId, "history", "subs"],
    queryFn: async () => {
      if (!selectedClientId) return [];
      const response = await fetch(`/api/clients/${selectedClientId}/history/subs`);
      if (!response.ok) throw new Error("Failed to fetch sub history");
      return response.json();
    },
    enabled: !!selectedClientId,
  });

  // Fetch skip history for selected client
  const { data: skipHistory = [] } = useQuery<{
    id: string;
    clientId: string;
    date: string;
    skipReason: string;
    createdAt: string;
  }[]>({
    queryKey: ["/api/clients", selectedClientId, "history", "skips"],
    queryFn: async () => {
      if (!selectedClientId) return [];
      const response = await fetch(`/api/clients/${selectedClientId}/history/skips`);
      if (!response.ok) throw new Error("Failed to fetch skip history");
      return response.json();
    },
    enabled: !!selectedClientId,
  });

  // Fetch client locations for the selected client
  const { data: clientLocations = [] } = useQuery<ClientLocation[]>({
    queryKey: ["/api/clients", selectedClientId, "locations"],
    queryFn: async () => {
      if (!selectedClientId) return [];
      const response = await fetch(`/api/clients/${selectedClientId}/locations`);
      if (!response.ok) throw new Error("Failed to fetch locations");
      return response.json();
    },
    enabled: !!selectedClientId,
  });

  // Fetch template assignments for the selected client
  const { data: clientTemplateAssignments = [] } = useQuery<TemplateAssignment[]>({
    queryKey: ["/api/clients", selectedClientId, "template-assignments"],
    queryFn: async () => {
      if (!selectedClientId) return [];
      const response = await fetch(`/api/clients/${selectedClientId}/template-assignments`);
      if (!response.ok) throw new Error("Failed to fetch template assignments");
      return response.json();
    },
    enabled: !!selectedClientId,
  });

  // Create location mutation
  const createLocationMutation = useMutation({
    mutationFn: async (data: Omit<ClientLocation, "id">) => {
      const response = await fetch("/api/client-locations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to create location");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients", selectedClientId, "locations"] });
      toast({
        title: "Location Added",
        description: "Service location has been added.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to add location",
        variant: "destructive",
      });
    },
  });

  // Update location mutation
  const updateLocationMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<ClientLocation> }) => {
      const response = await fetch(`/api/client-locations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to update location");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients", selectedClientId, "locations"] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update location",
        variant: "destructive",
      });
    },
  });

  // Delete location mutation
  const deleteLocationMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/client-locations/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete location");
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients", selectedClientId, "locations"] });
      toast({
        title: "Location Removed",
        description: "Service location has been removed.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to remove location",
        variant: "destructive",
      });
    },
  });

  // Fetch location staff approvals for the current client's locations
  const { data: locationStaffApprovals = [] } = useQuery<ClientLocationStaffApproval[]>({
    queryKey: ["/api/location-staff-approvals", selectedClientId],
    queryFn: async () => {
      if (!selectedClientId || clientLocations.length === 0) return [];
      // Fetch approvals for all locations of this client
      const allApprovals: ClientLocationStaffApproval[] = [];
      for (const loc of clientLocations) {
        const response = await fetch(`/api/location-staff-approvals/${loc.id}`);
        if (response.ok) {
          const approvals = await response.json();
          allApprovals.push(...approvals);
        }
      }
      return allApprovals;
    },
    enabled: !!selectedClientId && clientLocations.length > 0,
  });

  // Update location staff approvals mutation
  const updateLocationStaffApprovalsMutation = useMutation({
    mutationFn: async ({ locationId, staffIds }: { locationId: string; staffIds: string[] }) => {
      const response = await fetch(`/api/location-staff-approvals/${locationId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ staffIds }),
      });
      if (!response.ok) throw new Error("Failed to update staff approvals");
      return response.json();
    },
    onMutate: async ({ locationId, staffIds }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["/api/location-staff-approvals", selectedClientId] });
      
      // Snapshot previous value
      const previousApprovals = queryClient.getQueryData<ClientLocationStaffApproval[]>(["/api/location-staff-approvals", selectedClientId]);
      
      // Optimistically update
      queryClient.setQueryData<ClientLocationStaffApproval[]>(["/api/location-staff-approvals", selectedClientId], (old) => {
        if (!old) return old;
        // Remove old approvals for this location, add new ones
        const otherApprovals = old.filter(a => a.clientLocationId !== locationId);
        const newApprovals = staffIds.map(staffId => ({ id: `temp-${locationId}-${staffId}`, clientLocationId: locationId, staffId }));
        return [...otherApprovals, ...newApprovals];
      });
      
      return { previousApprovals };
    },
    onError: (err, variables, context) => {
      // Rollback on error
      if (context?.previousApprovals) {
        queryClient.setQueryData(["/api/location-staff-approvals", selectedClientId], context.previousApprovals);
      }
      toast({
        title: "Error",
        description: "Failed to update location staff approvals",
        variant: "destructive",
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/location-staff-approvals", selectedClientId] });
    },
  });

  // Helper to toggle staff approval for a location
  const toggleLocationStaffApproval = (locationId: string, staffId: string) => {
    // Get current state from cache to avoid race conditions
    const currentApprovals = queryClient.getQueryData<ClientLocationStaffApproval[]>(["/api/location-staff-approvals", selectedClientId]) || [];
    const locationApprovals = currentApprovals.filter(a => a.clientLocationId === locationId);
    const currentStaffIds = locationApprovals.map(a => a.staffId);
    const isApproved = currentStaffIds.includes(staffId);
    const newStaffIds = isApproved
      ? currentStaffIds.filter(id => id !== staffId)
      : [...currentStaffIds, staffId];
    updateLocationStaffApprovalsMutation.mutate({ locationId, staffIds: newStaffIds });
  };

  // Set first client as selected when data loads
  useEffect(() => {
    if (!selectedClientId && clients.length > 0) {
      setSelectedClientId(clients[0].id);
    }
  }, [clients, selectedClientId]);

  // Clear pending apply when client changes
  useEffect(() => {
    setPendingApply(null);
  }, [selectedClientId]);

  // Auto-sync focusStaffIds from template assignments (only add new staff, don't remove)
  useEffect(() => {
    if (!selectedClientId || clientTemplateAssignments.length === 0) return;
    
    const client = clients.find(c => c.id === selectedClientId);
    if (!client) return;
    
    const templateStaffIds = Array.from(new Set(clientTemplateAssignments.map(a => a.staffId)));
    const currentFocusIds = (client.focusStaffIds as string[]) || [];
    
    // Only add new staff from template to focus, don't remove existing
    const newStaffToAdd = templateStaffIds.filter(id => !currentFocusIds.includes(id));
    
    if (newStaffToAdd.length > 0) {
      const updatedFocusIds = [...currentFocusIds, ...newStaffToAdd];
      queryClient.setQueryData(["/api/clients"], (old: Client[] | undefined) => {
        if (!old) return old;
        return old.map(c => c.id === selectedClientId ? { ...c, focusStaffIds: updatedFocusIds } : c);
      });
    }
  }, [selectedClientId, clientTemplateAssignments, clients, queryClient]);

  const selectedClient = clients.find(c => c.id === selectedClientId);

  const filteredClients = clients
    .filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name));

  // Validate exclusion conflicts - excluded staff cannot be in trained/float/lead lists
  const getExclusionConflicts = () => {
    if (!selectedClient) return [];
    
    const excludedIds = (selectedClient.excludedStaffIds as string[]) || [];
    const trainedIds = (selectedClient.trainedStaffIds as string[]) || [];
    const floatIds = (selectedClient.allowedFloatRbtIds as string[]) || [];
    const leadIds = (selectedClient.allowedLeadRbtIds as string[]) || [];
    
    const conflicts: { staffId: string; staffName: string; conflictTypes: string[] }[] = [];
    
    excludedIds.forEach(staffId => {
      const conflictTypes: string[] = [];
      if (trainedIds.includes(staffId)) conflictTypes.push("Trained Staff");
      if (floatIds.includes(staffId)) conflictTypes.push("Float RBT");
      if (leadIds.includes(staffId)) conflictTypes.push("Lead RBT");
      
      if (conflictTypes.length > 0) {
        const staffMember = staffList.find(s => s.id === staffId);
        conflicts.push({
          staffId,
          staffName: staffMember?.name || "Unknown Staff",
          conflictTypes
        });
      }
    });
    
    return conflicts;
  };
  
  const exclusionConflicts = getExclusionConflicts();
  const hasExclusionConflicts = exclusionConflicts.length > 0;

  const handleSave = () => {
    if (!selectedClient) return;
    
    // Check for exclusion conflicts
    if (hasExclusionConflicts) {
      toast({
        title: "Cannot Save - Exclusion Conflicts",
        description: `${exclusionConflicts.length} staff member(s) are both excluded AND in trained/float/lead lists. Remove them from one list to save.`,
        variant: "destructive"
      });
      return;
    }
    
    updateMutation.mutate({ id: selectedClient.id, data: selectedClient });
  };

  // Helper to update fields with optimistic update
  const updateField = (field: keyof Client, value: any) => {
    if (!selectedClient) return;
    queryClient.setQueryData(["/api/clients"], (old: Client[] | undefined) => {
      if (!old) return old;
      return old.map(c => c.id === selectedClientId ? { ...c, [field]: value } : c);
    });
  };

  // Helper for multi-select logic (simulated with toggle for prototype)
  const toggleStaffInSet = (staffId: string, setField: 'focusStaffIds' | 'trainedStaffIds' | 'lunchCoverageStaffIds' | 'lunchCoverageExcludedStaffIds' | 'allowedTrainerIds' | 'noLongerTrainedIds' | 'excludedStaffIds' | 'allowedFloatRbtIds' | 'allowedLeadRbtIds') => {
    if (!selectedClient) return;
    const currentSet = (selectedClient[setField] as unknown as string[]) || [];
    const isAdding = !currentSet.includes(staffId);
    const newSet = isAdding
      ? [...currentSet, staffId]
      : currentSet.filter(id => id !== staffId);
    updateField(setField, newSet);

    // Auto-sync: When adding to Focus Staff, also add to allowed Float/Lead RBT lists if applicable
    if (setField === 'focusStaffIds' && isAdding) {
      const staff = staffList.find(s => s.id === staffId);
      if (staff) {
        if (staff.role === 'Float') {
          const currentFloatIds = (selectedClient.allowedFloatRbtIds as string[] || []);
          if (!currentFloatIds.includes(staffId)) {
            updateField('allowedFloatRbtIds', [...currentFloatIds, staffId]);
          }
        }
        if (staff.role === 'Lead RBT') {
          const currentLeadIds = (selectedClient.allowedLeadRbtIds as string[] || []);
          if (!currentLeadIds.includes(staffId)) {
            updateField('allowedLeadRbtIds', [...currentLeadIds, staffId]);
          }
        }
      }
    }
  };

  const handleAddClient = () => {
    const newClientData = {
      name: "New Client",
      active: true,
      bcbaId: null,
      phoneNumbers: [],
      contacts: [],
      defaultLocation: "clinic",
      driveTimeMinutes: 0,
      focusStaffIds: [],
      trainedStaffIds: [],
      lunchCoverageStaffIds: [],
      lunchCoverageExcludedStaffIds: [],
      floatRbtsAllowed: true,
      allowedFloatRbtIds: [],
      leadRbtsAllowed: true,
      allowedLeadRbtIds: [],
      noLongerTrainedIds: [],
      excludedStaffIds: [],
      allowAllDaySameStaff: false,
      allowSub: true,
      allowSplits: true,
      allowBtPast60Days: true,
      allowBtPast6Months: false,
      isCrisisClient: false,
      splitLockEnabled: false,
      splitWindowStartMinute: null,
      splitWindowEndMinute: null,
      minSplitDurationMinutes: 30,
      allowedTrainerIds: [],
      leadSignOffAllowed: false,
      trainingStyle: "half",
      canBeGrouped: false,
      allowedLunchPeerIds: [],
      allowGroupsOf3: false,
      allowQuadrupleBilling: false,
      disallowedGroupCombos: [],
      schedule: {
        mon: { enabled: true, start: "09:00", end: "16:00" },
        tue: { enabled: true, start: "09:00", end: "16:00" },
        wed: { enabled: true, start: "09:00", end: "16:00" },
        thu: { enabled: true, start: "09:00", end: "16:00" },
        fri: { enabled: true, start: "09:00", end: "16:00" },
      }
    };
    createMutation.mutate(newClientData as any);
  };

  // Loading and empty states
  if (clientsLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-[calc(100vh-140px)]">
          <p className="text-muted-foreground">Loading client data...</p>
        </div>
      </Layout>
    );
  }

  if (!selectedClient) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-[calc(100vh-140px)]">
          <div className="text-center">
            <p className="text-muted-foreground mb-4">No clients found</p>
            <Button onClick={handleAddClient}>
              <Plus className="mr-2 h-4 w-4" />
              Add First Client
            </Button>
          </div>
        </div>
      </Layout>
    );
  }

  const schedule = selectedClient.schedule as WeeklyAvailability;

  // Helper for 15 min increments
  const generateTimeOptions = () => {
    const times = [];
    for (let h = 0; h < 24; h++) {
      for (let m = 0; m < 60; m += 15) {
        const hour = h.toString().padStart(2, '0');
        const minute = m.toString().padStart(2, '0');
        times.push(`${hour}:${minute}`);
      }
    }
    return times;
  };

  const TIME_OPTIONS = generateTimeOptions();

  const handleCopyToAll = (sourceDay: keyof WeeklyAvailability) => {
    const sourceSchedule = schedule[sourceDay];
    if (!sourceSchedule) return;

    const newSchedule = { ...schedule };
    (['mon', 'tue', 'wed', 'thu', 'fri'] as const).forEach(day => {
      if (day !== sourceDay) {
        newSchedule[day] = { ...sourceSchedule };
      }
    });
    updateField('schedule', newSchedule);
    toast({
      title: "Schedule Copied",
      description: `Copied ${String(sourceDay).toUpperCase()} schedule to all other days.`,
    });
  };

  const handleApplyToRestOfWeek = () => {
    if (!pendingApply) return;
    
    const days = ['mon', 'tue', 'wed', 'thu', 'fri'] as const;
    const startIndex = days.indexOf(pendingApply.day);
    
    const newSchedule = { ...schedule };
    for (let i = startIndex + 1; i < days.length; i++) {
      const day = days[i];
      if (newSchedule[day]) {
        newSchedule[day] = { ...newSchedule[day], [pendingApply.field]: pendingApply.value };
      } else {
        // Initialize the day with default values if it doesn't exist
        const defaultStart = pendingApply.field === 'start' ? pendingApply.value : '08:00';
        const defaultEnd = pendingApply.field === 'end' ? pendingApply.value : '16:30';
        newSchedule[day] = { enabled: false, start: defaultStart, end: defaultEnd };
      }
    }
    
    updateField('schedule', newSchedule);
    setPendingApply(null);
    toast({
      title: "Applied to Rest of Week",
      description: `${pendingApply.field === 'start' ? 'Start' : 'End'} time applied to remaining days.`,
    });
  };

  return (
    <Layout>
      <div className="flex flex-col lg:flex-row gap-4 md:gap-6 min-h-[calc(100vh-140px)] lg:h-[calc(100vh-140px)]">
        
        {/* Left Panel: Client List */}
        <Card className="w-full lg:w-80 flex flex-col min-h-[200px] h-[250px] lg:h-full border-border/60 shadow-sm shrink-0">
          <CardHeader className="p-4 border-b border-border/40 space-y-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Clients</CardTitle>
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={handleAddClient}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search clients..."
                className="pl-9 bg-secondary/20"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </CardHeader>
          <CardContent className="p-0 flex-1 overflow-hidden">
            <ScrollArea className="h-full">
              <div className="flex flex-col p-2 gap-1">
                {filteredClients.map((client) => (
                  <button
                    key={client.id}
                    onClick={() => setSelectedClientId(client.id)}
                    className={cn(
                      "flex flex-col items-start gap-1 p-3 rounded-md text-sm transition-colors text-left",
                      selectedClientId === client.id 
                        ? "bg-primary/10 text-primary font-medium" 
                        : "hover:bg-secondary/30 text-muted-foreground"
                    )}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span>{client.name}</span>
                      {client.active ? (
                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      ) : (
                        <span className="w-2 h-2 rounded-full bg-slate-300" />
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Right Panel: Client Detail */}
        <div className="flex-1 flex flex-col gap-4 md:gap-6 overflow-visible lg:overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl md:text-3xl font-serif font-bold text-primary">{selectedClient.name}</h1>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                 <Badge variant={selectedClient.active ? "default" : "secondary"} className={cn(selectedClient.active ? "bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/25 border-emerald-200" : "")}>
                   {selectedClient.active ? "Active" : "Inactive"}
                 </Badge>
              </div>
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" className="text-destructive hover:bg-destructive/10 flex-1 sm:flex-initial" data-testid="button-delete-client">
                    <Trash2 className="mr-2 h-4 w-4" />
                    Remove
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Remove Client</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to remove {selectedClient.name}? This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction 
                      onClick={() => deleteMutation.mutate(selectedClient.id)}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      data-testid="button-confirm-delete-client"
                    >
                      Remove
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              <Button variant="outline" onClick={() => {/* Cancel */}} className="flex-1 sm:flex-initial">Discard</Button>
              <Button onClick={handleSave} className="bg-primary text-primary-foreground shadow-sm flex-1 sm:flex-initial">
                <Save className="mr-2 h-4 w-4" />
                Save
              </Button>
            </div>
          </div>

          <Tabs defaultValue="basics" className="flex-1 flex flex-col overflow-hidden">
            <TabsList className="w-full justify-start border-b border-border/40 rounded-none bg-transparent p-0 h-auto gap-6 overflow-x-auto flex-nowrap">
              <TabsTrigger value="basics" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-2 py-3 whitespace-nowrap flex-shrink-0">Basics</TabsTrigger>
              <TabsTrigger value="schedule" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-2 py-3 whitespace-nowrap flex-shrink-0">Schedule</TabsTrigger>
              <TabsTrigger value="staffing" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-2 py-3 whitespace-nowrap flex-shrink-0">Staffing Sets</TabsTrigger>
              <TabsTrigger value="constraints" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-2 py-3 whitespace-nowrap flex-shrink-0">Constraints</TabsTrigger>
              <TabsTrigger value="cancels" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-2 py-3 whitespace-nowrap flex-shrink-0">Cancels</TabsTrigger>
              <TabsTrigger value="history" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-2 py-3 whitespace-nowrap flex-shrink-0">History</TabsTrigger>
              <TabsTrigger value="training" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-2 py-3 whitespace-nowrap flex-shrink-0">Training</TabsTrigger>
              <TabsTrigger value="lunch" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-2 py-3 whitespace-nowrap flex-shrink-0">Lunch Coverage</TabsTrigger>
            </TabsList>

            <ScrollArea className="flex-1 py-6 pr-4">
              {/* SCHEDULE TAB */}
              <TabsContent value="schedule" className="space-y-6 mt-0">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Clock className="w-5 h-5" /> Weekly Schedule</CardTitle>
                    <CardDescription>Set the days and times when {selectedClient.name} receives services.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {(['mon', 'tue', 'wed', 'thu', 'fri'] as const).map((day) => (
                        <div key={day} className="flex flex-col sm:flex-row sm:items-center gap-4 border-b border-border last:border-0 pb-4 last:pb-0">
                          <div className="w-24 font-medium capitalize">{day}</div>
                          <div className="flex items-center gap-2">
                            <Switch 
                              checked={schedule[day]?.enabled ?? false} 
                              onCheckedChange={(checked) => {
                                const newSchedule = { ...schedule };
                                if (!newSchedule[day]) {
                                  newSchedule[day] = { enabled: checked, start: "08:00", end: "16:30" };
                                } else {
                                  newSchedule[day] = { ...newSchedule[day], enabled: checked };
                                }
                                updateField('schedule', newSchedule);
                              }} 
                            />
                            <span className="text-sm w-16">{schedule[day]?.enabled ? "Active" : "Off"}</span>
                          </div>
                          
                          {schedule[day]?.enabled && (
                            <div className="flex items-center gap-2 flex-1">
                              <Input 
                                type="time" 
                                className="w-32" 
                                value={schedule[day].start} 
                                onChange={(e) => {
                                  const newSchedule = { ...schedule };
                                  newSchedule[day] = { ...newSchedule[day], start: e.target.value };
                                  updateField('schedule', newSchedule);
                                  if (day !== 'fri') {
                                    setPendingApply({ day, field: 'start', value: e.target.value });
                                  }
                                }}
                              />
                              <span className="text-muted-foreground">-</span>
                              <Input 
                                type="time" 
                                className="w-32" 
                                value={schedule[day].end} 
                                onChange={(e) => {
                                  const newSchedule = { ...schedule };
                                  newSchedule[day] = { ...newSchedule[day], end: e.target.value };
                                  updateField('schedule', newSchedule);
                                  if (day !== 'fri') {
                                    setPendingApply({ day, field: 'end', value: e.target.value });
                                  }
                                }}
                              />
                              {pendingApply?.day === day && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="ml-2 text-xs h-8 whitespace-nowrap bg-primary/5 border-primary/30 text-primary hover:bg-primary/10"
                                  onClick={handleApplyToRestOfWeek}
                                  data-testid={`button-apply-rest-${day}`}
                                >
                                  Apply to Rest of Week?
                                </Button>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* BASICS TAB */}
              <TabsContent value="basics" className="space-y-6 mt-0">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2"><User className="w-5 h-5" /> Core Information</CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-6 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Client Initials</Label>
                      <Input value={selectedClient.name} onChange={(e) => updateField('name', e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Assigned BCBA</Label>
                      <Select value={selectedClient.bcbaId || ""} onValueChange={(val) => updateField('bcbaId', val)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select BCBA" />
                        </SelectTrigger>
                        <SelectContent>
                          {staffList.filter(s => s.role === 'BCBA').sort((a, b) => a.name.localeCompare(b.name)).map(s => (
                            <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Status</Label>
                      <div className="flex items-center space-x-2 border p-3 rounded-md">
                        <Switch checked={selectedClient.active} onCheckedChange={(val) => updateField('active', val)} />
                        <span>{selectedClient.active ? "Client is Active" : "Client is Inactive"}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Users className="w-5 h-5" /> Emergency Contacts</CardTitle>
                    <CardDescription>Caregiver contact information for cancellation notifications</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {((selectedClient as any).contacts as { name: string; relationship: string; phone: string }[] || []).map((contact, idx) => (
                      <div key={idx} className="grid gap-3 md:grid-cols-3 p-4 border rounded-lg bg-secondary/10">
                        <div className="space-y-2">
                          <Label>Contact Name</Label>
                          <Input 
                            value={contact.name} 
                            placeholder="Jane Doe"
                            onChange={(e) => {
                              const newContacts = [...((selectedClient as any).contacts || [])];
                              newContacts[idx] = { ...newContacts[idx], name: e.target.value };
                              updateField('contacts' as any, newContacts);
                            }} 
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Relationship</Label>
                          <Select 
                            value={contact.relationship} 
                            onValueChange={(val) => {
                              const newContacts = [...((selectedClient as any).contacts || [])];
                              newContacts[idx] = { ...newContacts[idx], relationship: val };
                              updateField('contacts' as any, newContacts);
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select Relationship" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Mother">Mother</SelectItem>
                              <SelectItem value="Father">Father</SelectItem>
                              <SelectItem value="Guardian">Guardian</SelectItem>
                              <SelectItem value="Grandmother">Grandmother</SelectItem>
                              <SelectItem value="Grandfather">Grandfather</SelectItem>
                              <SelectItem value="Aunt">Aunt</SelectItem>
                              <SelectItem value="Uncle">Uncle</SelectItem>
                              <SelectItem value="Sibling">Sibling</SelectItem>
                              <SelectItem value="Other">Other</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Phone Number</Label>
                          <div className="flex gap-2">
                            <Input 
                              value={contact.phone} 
                              placeholder="(555) 123-4567"
                              className="flex-1"
                              onChange={(e) => {
                                const newContacts = [...((selectedClient as any).contacts || [])];
                                newContacts[idx] = { ...newContacts[idx], phone: e.target.value };
                                updateField('contacts' as any, newContacts);
                              }} 
                            />
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="text-destructive hover:text-destructive/80"
                              onClick={() => {
                                const newContacts = [...((selectedClient as any).contacts || [])];
                                newContacts.splice(idx, 1);
                                updateField('contacts' as any, newContacts);
                              }}
                            >
                              <span className="sr-only">Remove</span>
                              &times;
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full" 
                      onClick={() => updateField('contacts' as any, [...((selectedClient as any).contacts || []), { name: "", relationship: "", phone: "" }])}
                    >
                      <Plus className="w-3 h-3 mr-1" /> Add Contact
                    </Button>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2"><MapPin className="w-5 h-5" /> Service Locations</CardTitle>
                    <CardDescription>
                      Manage the locations where {selectedClient.name} receives services. Each location can have a different drive time.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {clientLocations.length === 0 ? (
                      <div className="text-center py-6 text-muted-foreground">
                        <MapPin className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p>No service locations configured.</p>
                        <p className="text-sm">Add locations where this client receives services.</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {clientLocations.sort((a, b) => a.sortOrder - b.sortOrder).map((loc, idx) => (
                          <div key={loc.id} className="border rounded-lg p-4 space-y-3" data-testid={`location-card-${loc.id}`}>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Badge variant={loc.isPrimary ? "default" : "outline"}>
                                  {loc.locationType.charAt(0).toUpperCase() + loc.locationType.slice(1)}
                                </Badge>
                                {loc.isPrimary && <Badge variant="secondary">Primary</Badge>}
                              </div>
                              <div className="flex items-center gap-2">
                                {!loc.isPrimary && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      clientLocations.forEach(l => {
                                        if (l.id === loc.id) {
                                          updateLocationMutation.mutate({ id: l.id, data: { isPrimary: true } });
                                        } else if (l.isPrimary) {
                                          updateLocationMutation.mutate({ id: l.id, data: { isPrimary: false } });
                                        }
                                      });
                                    }}
                                    data-testid={`button-set-primary-${loc.id}`}
                                  >
                                    Set as Primary
                                  </Button>
                                )}
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="text-destructive hover:text-destructive/80"
                                  onClick={() => deleteLocationMutation.mutate(loc.id)}
                                  data-testid={`button-delete-location-${loc.id}`}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>
                            <div className="grid gap-4 md:grid-cols-4">
                              <div className="space-y-2">
                                <Label className="text-sm">Location Type</Label>
                                <Select 
                                  value={loc.locationType} 
                                  onValueChange={(val) => updateLocationMutation.mutate({ id: loc.id, data: { locationType: val } })}
                                >
                                  <SelectTrigger data-testid={`select-location-type-${loc.id}`}>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="clinic">Clinic</SelectItem>
                                    <SelectItem value="home">Home</SelectItem>
                                    <SelectItem value="school">School</SelectItem>
                                    <SelectItem value="community">Community</SelectItem>
                                    <SelectItem value="other">Other</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-2">
                                <Label className="text-sm">Display Name (optional)</Label>
                                <Input 
                                  placeholder="e.g., Main Clinic, Grandma's House"
                                  value={loc.displayName || ""} 
                                  onChange={(e) => updateLocationMutation.mutate({ id: loc.id, data: { displayName: e.target.value } })}
                                  data-testid={`input-display-name-${loc.id}`}
                                />
                              </div>
                              <div className="space-y-2">
                                <Label className="text-sm">Service Start Date</Label>
                                <Input 
                                  type="date"
                                  value={loc.serviceStartDate || ""} 
                                  onChange={(e) => updateLocationMutation.mutate({ id: loc.id, data: { serviceStartDate: e.target.value || null } })}
                                  data-testid={`input-service-start-${loc.id}`}
                                />
                              </div>
                              <div className="space-y-2">
                                <Label className="text-sm">Drive Time (from Clinic)</Label>
                                <Select 
                                  value={loc.driveTimeMinutes.toString()} 
                                  onValueChange={(val) => updateLocationMutation.mutate({ id: loc.id, data: { driveTimeMinutes: parseInt(val) } })}
                                >
                                  <SelectTrigger data-testid={`select-drive-time-${loc.id}`}>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="0">0 mins (at clinic)</SelectItem>
                                    <SelectItem value="15">15 mins</SelectItem>
                                    <SelectItem value="30">30 mins</SelectItem>
                                    <SelectItem value="45">45 mins</SelectItem>
                                    <SelectItem value="60">60 mins</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                            {loc.locationType !== 'clinic' && (
                              <div className="space-y-2">
                                <Label className="text-sm">Address</Label>
                                <Input 
                                  placeholder="Street address"
                                  value={loc.address || ""} 
                                  onChange={(e) => updateLocationMutation.mutate({ id: loc.id, data: { address: e.target.value } })}
                                  data-testid={`input-address-${loc.id}`}
                                />
                              </div>
                            )}
                            
                            {/* School-specific settings */}
                            {loc.locationType === 'school' && (
                              <div className="mt-4 p-4 bg-muted/50 rounded-lg space-y-4">
                                <div className="space-y-2">
                                  <Label className="text-sm font-medium">Select or Create School</Label>
                                  <Select 
                                    value={loc.schoolId || "new"} 
                                    onValueChange={(val) => {
                                      if (val === "new") {
                                        updateLocationMutation.mutate({ id: loc.id, data: { schoolId: null } });
                                      } else {
                                        updateLocationMutation.mutate({ id: loc.id, data: { schoolId: val } });
                                      }
                                    }}
                                  >
                                    <SelectTrigger data-testid={`select-school-${loc.id}`}>
                                      <SelectValue placeholder="Select existing school or create new" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="new">+ Create New School</SelectItem>
                                      {schoolsList.sort((a, b) => a.name.localeCompare(b.name)).map(school => (
                                        <SelectItem key={school.id} value={school.id}>
                                          {school.name} {school.hasAlternativeLunch ? `(Lunch ${Math.floor(school.lunchWindowStartMinute / 60)}:${(school.lunchWindowStartMinute % 60).toString().padStart(2, '0')}-${Math.floor(school.lunchWindowEndMinute / 60)}:${(school.lunchWindowEndMinute % 60).toString().padStart(2, '0')})` : ''}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                                
                                {/* Create new school form */}
                                {!loc.schoolId && (
                                  <div className="space-y-4 p-3 border rounded-md bg-background">
                                    <div className="space-y-2">
                                      <Label className="text-sm">School Name</Label>
                                      <div className="flex gap-2">
                                        <Input 
                                          placeholder="e.g., Lincoln Elementary"
                                          value={newSchoolNames[loc.id] || ""}
                                          onChange={(e) => setNewSchoolNames(prev => ({ ...prev, [loc.id]: e.target.value }))}
                                          data-testid={`input-new-school-name-${loc.id}`}
                                        />
                                        <Button
                                          size="sm"
                                          disabled={!newSchoolNames[loc.id]?.trim()}
                                          onClick={() => {
                                            const name = newSchoolNames[loc.id]?.trim();
                                            if (!name) {
                                              toast({ title: "Error", description: "Please enter a school name", variant: "destructive" });
                                              return;
                                            }
                                            createSchoolMutation.mutate({
                                              name,
                                              hasAlternativeLunch: false,
                                              lunchWindowStartMinute: 690,
                                              lunchWindowEndMinute: 750,
                                            }, {
                                              onSuccess: (newSchool) => {
                                                updateLocationMutation.mutate({ id: loc.id, data: { schoolId: newSchool.id, displayName: name } });
                                                setNewSchoolNames(prev => {
                                                  const next = { ...prev };
                                                  delete next[loc.id];
                                                  return next;
                                                });
                                              }
                                            });
                                          }}
                                          data-testid={`button-create-school-${loc.id}`}
                                        >
                                          Create
                                        </Button>
                                      </div>
                                    </div>
                                  </div>
                                )}
                                
                                {/* Edit existing school lunch settings */}
                                {loc.schoolId && (() => {
                                  const school = schoolsList.find(s => s.id === loc.schoolId);
                                  if (!school) return null;
                                  return (
                                    <div className="space-y-4 p-3 border rounded-md bg-background">
                                      <div className="text-sm font-medium text-muted-foreground">
                                        School: <span className="text-foreground">{school.name}</span>
                                      </div>
                                      
                                      <div className="flex items-center justify-between">
                                        <Label className="text-sm" htmlFor={`alt-lunch-${loc.id}`}>
                                          Alternative lunch times?
                                        </Label>
                                        <Switch
                                          id={`alt-lunch-${loc.id}`}
                                          checked={school.hasAlternativeLunch}
                                          onCheckedChange={(checked) => {
                                            updateSchoolMutation.mutate({ id: school.id, data: { hasAlternativeLunch: checked } });
                                          }}
                                          data-testid={`switch-alt-lunch-${loc.id}`}
                                        />
                                      </div>
                                      
                                      {school.hasAlternativeLunch && (
                                        <div className="grid grid-cols-2 gap-4">
                                          <div className="space-y-2">
                                            <Label className="text-sm">Lunch Start</Label>
                                            <Select
                                              value={school.lunchWindowStartMinute.toString()}
                                              onValueChange={(val) => {
                                                updateSchoolMutation.mutate({ id: school.id, data: { lunchWindowStartMinute: parseInt(val) } });
                                              }}
                                            >
                                              <SelectTrigger data-testid={`select-lunch-start-${loc.id}`}>
                                                <SelectValue />
                                              </SelectTrigger>
                                              <SelectContent>
                                                {[660, 675, 690, 705, 720, 735, 750].map(min => (
                                                  <SelectItem key={min} value={min.toString()}>
                                                    {Math.floor(min / 60)}:{(min % 60).toString().padStart(2, '0')}
                                                  </SelectItem>
                                                ))}
                                              </SelectContent>
                                            </Select>
                                          </div>
                                          <div className="space-y-2">
                                            <Label className="text-sm">Lunch End</Label>
                                            <Select
                                              value={school.lunchWindowEndMinute.toString()}
                                              onValueChange={(val) => {
                                                updateSchoolMutation.mutate({ id: school.id, data: { lunchWindowEndMinute: parseInt(val) } });
                                              }}
                                            >
                                              <SelectTrigger data-testid={`select-lunch-end-${loc.id}`}>
                                                <SelectValue />
                                              </SelectTrigger>
                                              <SelectContent>
                                                {[720, 735, 750, 765, 780, 795, 810].map(min => (
                                                  <SelectItem key={min} value={min.toString()}>
                                                    {Math.floor(min / 60)}:{(min % 60).toString().padStart(2, '0')}
                                                  </SelectItem>
                                                ))}
                                              </SelectContent>
                                            </Select>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })()}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    <Button 
                      variant="outline" 
                      className="w-full" 
                      onClick={() => {
                        createLocationMutation.mutate({
                          clientId: selectedClient.id,
                          locationType: "clinic",
                          displayName: null,
                          address: null,
                          driveTimeMinutes: 0,
                          isPrimary: clientLocations.length === 0,
                          sortOrder: clientLocations.length,
                          schoolId: null,
                          serviceStartDate: null,
                        });
                      }}
                      data-testid="button-add-location"
                    >
                      <Plus className="w-4 h-4 mr-2" /> Add Service Location
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* STAFFING TAB */}
              <TabsContent value="staffing" className="space-y-6 mt-0">
                {/* Exclusion Conflict Error Banner */}
                {hasExclusionConflicts && (
                  <Alert variant="destructive" className="bg-destructive/10 border-destructive/20">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Exclusion Conflicts - Cannot Save</AlertTitle>
                    <AlertDescription>
                      <p className="mb-2">The following staff are marked as EXCLUDED but also appear in other staffing lists. Remove them from one list to save:</p>
                      <ul className="list-disc pl-4 space-y-1">
                        {exclusionConflicts.map(conflict => (
                          <li key={conflict.staffId}>
                            <strong>{conflict.staffName}</strong> is excluded but also in: {conflict.conflictTypes.join(", ")}
                          </li>
                        ))}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}
                
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Users className="w-5 h-5" /> Staffing Sets</CardTitle>
                    <CardDescription>Who is allowed to work with {selectedClient.name}?</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-8">
                    
                    <div className="space-y-3">
                      <Label className="text-base font-semibold text-foreground">Staffing Requirements</Label>
                      <Input
                        placeholder='e.g., "Female only", "Must speak Spanish"'
                        value={selectedClient.staffingRequirements || ""}
                        onChange={(e) => updateField("staffingRequirements", e.target.value || null)}
                        data-testid="input-staffing-requirements"
                      />
                    </div>
                    
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <Label className="text-base font-semibold text-foreground">Focus Staff</Label>
                        <p className="text-sm text-muted-foreground">Staff assigned on the template are automatically listed as focus staff.</p>
                      </div>
                      {(() => {
                        const dayLabels: Record<string, string> = { mon: 'M', tue: 'T', wed: 'W', thu: 'Th', fri: 'F' };
                        const focusStaffFromTemplate = clientTemplateAssignments.reduce((acc, assignment) => {
                          if (!acc[assignment.staffId]) {
                            acc[assignment.staffId] = [];
                          }
                          acc[assignment.staffId].push({ 
                            day: assignment.weekDay, 
                            block: assignment.timeBlock,
                            isLocked: assignment.isLocked || false
                          });
                          return acc;
                        }, {} as Record<string, { day: string; block: string; isLocked: boolean }[]>);

                        const focusStaffIds = Object.keys(focusStaffFromTemplate);
                        const focusStaff = staffList
                          .filter(s => focusStaffIds.includes(s.id))
                          .sort((a, b) => a.name.localeCompare(b.name));

                        if (focusStaff.length === 0) {
                          return (
                            <p className="text-sm text-muted-foreground italic">
                              No staff assigned on the template yet. Add assignments on the Template page.
                            </p>
                          );
                        }

                        return (
                          <div className="space-y-2">
                            {focusStaff.map(staff => {
                              const assignments = focusStaffFromTemplate[staff.id] || [];
                              const sortedAssignments = assignments.sort((a, b) => {
                                const dayOrder = ['mon', 'tue', 'wed', 'thu', 'fri'];
                                const dayDiff = dayOrder.indexOf(a.day) - dayOrder.indexOf(b.day);
                                if (dayDiff !== 0) return dayDiff;
                                return a.block === 'AM' ? -1 : 1;
                              });
                              
                              const formatted = sortedAssignments
                                .map(a => `${dayLabels[a.day]} ${a.block}`)
                                .join(', ');
                              
                              // Check if any AM or PM is locked
                              const hasAmLocked = sortedAssignments.some(a => a.block === 'AM' && a.isLocked);
                              const hasPmLocked = sortedAssignments.some(a => a.block === 'PM' && a.isLocked);

                              return (
                                <div key={staff.id} className="flex items-center justify-between py-2 px-3 bg-muted/30 rounded-md" data-testid={`focus-staff-${staff.id}`}>
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium">{staff.name}</span>
                                    {hasAmLocked && (
                                      <Badge variant="outline" className="text-xs bg-red-50 text-red-600 border-red-200">AM locked</Badge>
                                    )}
                                    {hasPmLocked && (
                                      <Badge variant="outline" className="text-xs bg-red-50 text-red-600 border-red-200">PM locked</Badge>
                                    )}
                                  </div>
                                  <span className="text-sm text-muted-foreground">{formatted}</span>
                                </div>
                              );
                            })}
                          </div>
                        );
                      })()}
                    </div>

                    <div className="border-t border-border pt-6 space-y-3">
                      <Label className="text-base font-semibold text-foreground">Trained Staff</Label>
                      <div className="relative max-w-xs">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Search staff..."
                          value={trainedStaffSearch}
                          onChange={(e) => setTrainedStaffSearch(e.target.value)}
                          className="pl-8 h-9"
                          data-testid="input-trained-staff-search"
                        />
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {staffList
                          .filter(s => s.role !== 'BCBA')
                          .filter(s => !trainedStaffSearch.trim() || s.name.toLowerCase().includes(trainedStaffSearch.toLowerCase()))
                          .sort((a, b) => a.name.localeCompare(b.name))
                          .map(staff => (
                          <div key={staff.id} className="flex items-center space-x-2">
                             <Switch 
                               id={`trained-${staff.id}`}
                               checked={(selectedClient.trainedStaffIds as string[]).includes(staff.id)}
                               onCheckedChange={() => toggleStaffInSet(staff.id, 'trainedStaffIds')}
                             />
                             <Label htmlFor={`trained-${staff.id}`} className="font-normal cursor-pointer">{staff.name}</Label>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="border-t border-border pt-6 space-y-3">
                      <div className="space-y-1">
                        <Label className="text-base font-semibold text-foreground">Lunch Coverage Only</Label>
                        <p className="text-sm text-muted-foreground">Staff who can cover this client during 11:30-12:30 lunch only (no sub approval needed). Cannot be scheduled for early (11:00) or late (12:30) lunches.</p>
                      </div>
                      <div className="relative max-w-xs">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Search staff..."
                          value={lunchCoverageSearch}
                          onChange={(e) => setLunchCoverageSearch(e.target.value)}
                          className="pl-8 h-9"
                          data-testid="input-lunch-coverage-search"
                        />
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {staffList
                          .filter(s => s.role !== 'BCBA')
                          .filter(s => !lunchCoverageSearch.trim() || s.name.toLowerCase().includes(lunchCoverageSearch.toLowerCase()))
                          .sort((a, b) => a.name.localeCompare(b.name))
                          .map(staff => (
                          <div key={staff.id} className="flex items-center space-x-2">
                             <Switch 
                               id={`lunch-coverage-${staff.id}`}
                               checked={(selectedClient.lunchCoverageStaffIds as string[] || []).includes(staff.id)}
                               onCheckedChange={() => toggleStaffInSet(staff.id, 'lunchCoverageStaffIds')}
                               data-testid={`switch-lunch-coverage-${staff.id}`}
                             />
                             <Label htmlFor={`lunch-coverage-${staff.id}`} className="font-normal cursor-pointer">{staff.name}</Label>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="border-t border-border pt-6 grid md:grid-cols-2 gap-6">
                       <div className="space-y-4">
                          <Label className="text-base font-semibold text-foreground">Eligibility Rules</Label>
                          <div className="space-y-4">
                            <div className="border rounded-md">
                              <div className="flex items-center justify-between p-3 border-b">
                                <span>Float RBTs Allowed</span>
                                <Switch checked={selectedClient.floatRbtsAllowed} onCheckedChange={(val) => updateField('floatRbtsAllowed', val)} />
                              </div>
                              {selectedClient.floatRbtsAllowed && (
                                <div className="p-3 space-y-2 bg-muted/20">
                                  <div className="flex items-center justify-between">
                                    <Label className="text-sm text-muted-foreground">Select Allowed Float RBTs:</Label>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 text-xs text-primary hover:bg-primary/10"
                                      onClick={() => {
                                        const allFloatIds = staffList.filter(s => s.role === 'Float').map(s => s.id);
                                        updateField('allowedFloatRbtIds', allFloatIds);
                                      }}
                                      data-testid="button-select-all-floats"
                                    >
                                      Select All
                                    </Button>
                                  </div>
                                  <div className="grid grid-cols-1 gap-2 max-h-40 overflow-y-auto">
                                    {staffList.filter(s => s.role === 'Float').sort((a, b) => a.name.localeCompare(b.name)).map(staff => (
                                      <div key={staff.id} className="flex items-center space-x-2">
                                        <Switch 
                                          id={`float-${staff.id}`}
                                          checked={(selectedClient.allowedFloatRbtIds as string[] || []).includes(staff.id)}
                                          onCheckedChange={() => toggleStaffInSet(staff.id, 'allowedFloatRbtIds')}
                                        />
                                        <Label htmlFor={`float-${staff.id}`} className="font-normal cursor-pointer text-sm">{staff.name}</Label>
                                      </div>
                                    ))}
                                    {staffList.filter(s => s.role === 'Float').length === 0 && (
                                      <p className="text-sm text-muted-foreground italic">No Float RBTs in system</p>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                            <div className="border rounded-md">
                              <div className="flex items-center justify-between p-3 border-b">
                                <span>Lead RBTs Allowed</span>
                                <Switch checked={selectedClient.leadRbtsAllowed} onCheckedChange={(val) => updateField('leadRbtsAllowed', val)} />
                              </div>
                              {selectedClient.leadRbtsAllowed && (
                                <div className="p-3 space-y-2 bg-muted/20">
                                  <div className="flex items-center justify-between">
                                    <Label className="text-sm text-muted-foreground">Select Allowed Lead RBTs:</Label>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 text-xs text-primary hover:bg-primary/10"
                                      onClick={() => {
                                        const allLeadIds = staffList.filter(s => s.role === 'Lead RBT').map(s => s.id);
                                        updateField('allowedLeadRbtIds', allLeadIds);
                                      }}
                                      data-testid="button-select-all-leads"
                                    >
                                      Select All
                                    </Button>
                                  </div>
                                  <div className="grid grid-cols-1 gap-2 max-h-40 overflow-y-auto">
                                    {staffList.filter(s => s.role === 'Lead RBT').sort((a, b) => a.name.localeCompare(b.name)).map(staff => (
                                      <div key={staff.id} className="flex items-center space-x-2">
                                        <Switch 
                                          id={`lead-${staff.id}`}
                                          checked={(selectedClient.allowedLeadRbtIds as string[] || []).includes(staff.id)}
                                          onCheckedChange={() => toggleStaffInSet(staff.id, 'allowedLeadRbtIds')}
                                        />
                                        <Label htmlFor={`lead-${staff.id}`} className="font-normal cursor-pointer text-sm">{staff.name}</Label>
                                      </div>
                                    ))}
                                    {staffList.filter(s => s.role === 'Lead RBT').length === 0 && (
                                      <p className="text-sm text-muted-foreground italic">No Lead RBTs in system</p>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                       </div>
                       
                    </div>
                  </CardContent>
                </Card>

                {/* Location-Specific Staff Approvals */}
                {(() => {
                  const nonClinicLocations = clientLocations.filter(loc => loc.locationType !== 'clinic');
                  if (nonClinicLocations.length === 0) return null;

                  // Get all eligible staff (focus, trained, floats if allowed, leads if allowed)
                  const focusIds = (selectedClient.focusStaffIds as string[]) || [];
                  const trainedIds = (selectedClient.trainedStaffIds as string[]) || [];
                  const floatIds = selectedClient.floatRbtsAllowed ? ((selectedClient.allowedFloatRbtIds as string[]) || []) : [];
                  const leadIds = selectedClient.leadRbtsAllowed ? ((selectedClient.allowedLeadRbtIds as string[]) || []) : [];
                  const eligibleIds = Array.from(new Set([...focusIds, ...trainedIds, ...floatIds, ...leadIds]));
                  const eligibleStaff = staffList.filter(s => eligibleIds.includes(s.id)).sort((a, b) => a.name.localeCompare(b.name));

                  if (eligibleStaff.length === 0) return null;

                  return (
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2"><MapPin className="w-5 h-5" /> Location Staff Approvals</CardTitle>
                        <CardDescription>Which staff can work at each non-clinic location? (All staff are assumed to be able to work at the clinic)</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-6">
                        {nonClinicLocations.sort((a, b) => a.sortOrder - b.sortOrder).map(loc => {
                          const locationLabel = loc.displayName || `${loc.locationType.charAt(0).toUpperCase() + loc.locationType.slice(1)}`;
                          const approvedStaffIds = locationStaffApprovals
                            .filter(a => a.clientLocationId === loc.id)
                            .map(a => a.staffId);

                          return (
                            <div key={loc.id} className="space-y-3 border-b border-border pb-4 last:border-0 last:pb-0">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-sm">{locationLabel}</Badge>
                                {loc.address && <span className="text-xs text-muted-foreground">{loc.address}</span>}
                              </div>
                              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                {eligibleStaff.map(staff => (
                                  <div key={staff.id} className="flex items-center space-x-2">
                                    <Switch 
                                      id={`loc-${loc.id}-staff-${staff.id}`}
                                      checked={approvedStaffIds.includes(staff.id)}
                                      onCheckedChange={() => toggleLocationStaffApproval(loc.id, staff.id)}
                                      data-testid={`switch-location-${loc.id}-staff-${staff.id}`}
                                    />
                                    <Label htmlFor={`loc-${loc.id}-staff-${staff.id}`} className="font-normal cursor-pointer text-sm">{staff.name}</Label>
                                  </div>
                                ))}
                              </div>
                              {approvedStaffIds.length === 0 && (
                                <p className="text-xs text-amber-600 dark:text-amber-400">No staff approved for this location yet. Sessions here may result in cancellations if coverage changes are needed.</p>
                              )}
                            </div>
                          );
                        })}
                      </CardContent>
                    </Card>
                  );
                })()}
              </TabsContent>

              {/* CONSTRAINTS TAB */}
              <TabsContent value="constraints" className="space-y-6 mt-0">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Shield className="w-5 h-5" /> Scheduling Constraints</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                     {[
                       { key: 'allowAllDaySameStaff', label: 'Allow all-day with same staff' },
                       { key: 'allowSub', label: 'Allow sub (non-focus/non-trained coverage)' },
                       { key: 'allowSplits', label: 'Allow engine splits (scheduler can split for coverage)' },
                       { key: 'allowBtPast60Days', label: 'Allow BT past 60 days' },
                       { key: 'allowBtPast6Months', label: 'Allow BT past 6 months' },
                       { key: 'allowGroupsOf3', label: 'Allow triple billing (groups of 3 during lunch)' },
                       { key: 'allowQuadrupleBilling', label: 'Allow quadruple billing (groups of 4 during 11:30-12:00 lunch)' },
                       { key: 'isCrisisClient', label: 'Crisis client?' },
                     ].map((item) => (
                       <div key={item.key} className="flex items-center justify-between border-b last:border-0 border-border pb-4 last:pb-0">
                         <Label className="text-base font-normal">{item.label}</Label>
                         <Switch 
                           checked={!!selectedClient[item.key as keyof Client]} 
                           onCheckedChange={(val) => updateField(item.key as keyof Client, val)} 
                         />
                       </div>
                     ))}
                  </CardContent>
                </Card>

                {/* Lunch Coverage Exclusion Card */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Clock className="w-5 h-5" /> Lunch Coverage Exclusion</CardTitle>
                    <CardDescription>Exclude eligible staff from lunch coverage (e.g., to give them a break from this client)</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      Select staff who should NOT cover this client during lunch, even though they are otherwise eligible.
                    </p>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {(() => {
                        const focusIds = (selectedClient.focusStaffIds as string[]) || [];
                        const trainedIds = (selectedClient.trainedStaffIds as string[]) || [];
                        const floatIds = selectedClient.floatRbtsAllowed ? ((selectedClient.allowedFloatRbtIds as string[]) || []) : [];
                        const leadIds = selectedClient.leadRbtsAllowed ? ((selectedClient.allowedLeadRbtIds as string[]) || []) : [];
                        const eligibleIds = Array.from(new Set([...focusIds, ...trainedIds, ...floatIds, ...leadIds]));
                        const eligibleStaff = staffList.filter(s => eligibleIds.includes(s.id)).sort((a, b) => a.name.localeCompare(b.name));
                        
                        if (eligibleStaff.length === 0) {
                          return <p className="text-sm text-muted-foreground italic col-span-full">No eligible staff assigned to this client yet.</p>;
                        }
                        
                        return eligibleStaff.map(staff => (
                          <div key={staff.id} className="flex items-center space-x-2">
                            <Switch 
                              id={`lunch-exclude-${staff.id}`}
                              checked={(selectedClient.lunchCoverageExcludedStaffIds as string[] || []).includes(staff.id)}
                              onCheckedChange={() => toggleStaffInSet(staff.id, 'lunchCoverageExcludedStaffIds')}
                              className="data-[state=checked]:bg-destructive"
                              data-testid={`switch-lunch-exclude-${staff.id}`}
                            />
                            <Label htmlFor={`lunch-exclude-${staff.id}`} className="font-normal cursor-pointer">{staff.name}</Label>
                          </div>
                        ));
                      })()}
                    </div>
                  </CardContent>
                </Card>

                {/* Split Lock Card */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Scissors className="w-5 h-5" /> Split Lock</CardTitle>
                    <CardDescription>Require a staff handoff during sessions (for clinical needs)</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between border-b border-border pb-4">
                      <div>
                        <Label className="text-base font-normal">Split Lock Enabled</Label>
                        <p className="text-xs text-muted-foreground">Client MUST have a staff handoff in the allowed window</p>
                      </div>
                      <Switch 
                        checked={!!selectedClient.splitLockEnabled} 
                        onCheckedChange={(val) => updateField('splitLockEnabled', val)} 
                        data-testid="switch-split-lock-enabled"
                      />
                    </div>
                    
                    {selectedClient.splitLockEnabled && (
                      <>
                        <div className="space-y-3 pt-2">
                          <Label className="text-sm font-medium">Allowed Handoff Window</Label>
                          <p className="text-xs text-muted-foreground">Time range when the staff handoff must occur</p>
                          <div className="flex items-center gap-2">
                            <Select 
                              value={selectedClient.splitWindowStartMinute?.toString() || ""} 
                              onValueChange={(val) => updateField('splitWindowStartMinute', parseInt(val))}
                            >
                              <SelectTrigger className="w-32" data-testid="select-split-window-start">
                                <SelectValue placeholder="Start" />
                              </SelectTrigger>
                              <SelectContent>
                                {Array.from({ length: 44 }, (_, i) => {
                                  const mins = 420 + i * 15; // 7:00 AM to 5:45 PM
                                  const hour = Math.floor(mins / 60);
                                  const min = mins % 60;
                                  const displayHour = hour > 12 ? hour - 12 : hour;
                                  const ampm = hour >= 12 ? "PM" : "AM";
                                  return (
                                    <SelectItem key={mins} value={mins.toString()}>
                                      {displayHour}:{min.toString().padStart(2, '0')} {ampm}
                                    </SelectItem>
                                  );
                                })}
                              </SelectContent>
                            </Select>
                            <span className="text-muted-foreground">to</span>
                            <Select 
                              value={selectedClient.splitWindowEndMinute?.toString() || ""} 
                              onValueChange={(val) => updateField('splitWindowEndMinute', parseInt(val))}
                            >
                              <SelectTrigger className="w-32" data-testid="select-split-window-end">
                                <SelectValue placeholder="End" />
                              </SelectTrigger>
                              <SelectContent>
                                {Array.from({ length: 44 }, (_, i) => {
                                  const mins = 420 + i * 15; // 7:00 AM to 5:45 PM
                                  const hour = Math.floor(mins / 60);
                                  const min = mins % 60;
                                  const displayHour = hour > 12 ? hour - 12 : hour;
                                  const ampm = hour >= 12 ? "PM" : "AM";
                                  return (
                                    <SelectItem key={mins} value={mins.toString()}>
                                      {displayHour}:{min.toString().padStart(2, '0')} {ampm}
                                    </SelectItem>
                                  );
                                })}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        
                        <div className="space-y-3 pt-2 border-t border-border">
                          <Label className="text-sm font-medium">Minimum Segment Duration</Label>
                          <p className="text-xs text-muted-foreground">Shortest allowed segment length</p>
                          <Select 
                            value={selectedClient.minSplitDurationMinutes?.toString() || "30"} 
                            onValueChange={(val) => updateField('minSplitDurationMinutes', parseInt(val))}
                          >
                            <SelectTrigger className="w-32" data-testid="select-min-split-duration">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="15">15 min</SelectItem>
                              <SelectItem value="30">30 min</SelectItem>
                              <SelectItem value="45">45 min</SelectItem>
                              <SelectItem value="60">60 min</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-destructive"><Ban className="w-5 h-5" /> Staff Exclusions</CardTitle>
                    <CardDescription>Staff members who should never be assigned to this client.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="relative max-w-xs">
                      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search staff..."
                        value={staffExclusionsSearch}
                        onChange={(e) => setStaffExclusionsSearch(e.target.value)}
                        className="pl-8 h-9"
                        data-testid="input-staff-exclusions-search"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      {staffList
                        .filter(s => s.role !== 'BCBA')
                        .filter(s => !staffExclusionsSearch.trim() || s.name.toLowerCase().includes(staffExclusionsSearch.toLowerCase()))
                        .sort((a, b) => a.name.localeCompare(b.name))
                        .map(staff => (
                        <div key={staff.id} className="flex items-center space-x-2">
                          <Switch 
                            id={`excluded-${staff.id}`}
                            checked={(selectedClient.excludedStaffIds as string[]).includes(staff.id)}
                            onCheckedChange={() => toggleStaffInSet(staff.id, 'excludedStaffIds')}
                            className="data-[state=checked]:bg-destructive"
                          />
                          <Label htmlFor={`excluded-${staff.id}`} className="font-normal cursor-pointer text-muted-foreground">{staff.name}</Label>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* CANCELS TAB */}
              <TabsContent value="cancels" className="space-y-6 mt-0">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2"><CalendarX className="w-5 h-5" /> Cancellation Settings</CardTitle>
                    <CardDescription>The system automatically tracks cancellations and applies skip rules. Use manual override below to set up initial values.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Last Canceled Date */}
                    <div className="flex items-center justify-between border p-4 rounded-md bg-secondary/10">
                      <div>
                        <Label className="text-base">Last Canceled Date</Label>
                        <p className="text-xs text-muted-foreground">Date this client was last canceled (used for fair rotation).</p>
                      </div>
                      <Input
                        type="date"
                        value={selectedClient.lastCanceledDate || ""}
                        onChange={(e) => updateField('lastCanceledDate', e.target.value || null)}
                        className="w-40"
                        data-testid="input-last-canceled-date"
                      />
                    </div>

                    {/* Skip Eligibility Notice - Calculated from template */}
                    {(() => {
                      const scheduledDays = new Set(clientTemplateAssignments.map(a => a.weekDay));
                      const daysPerWeek = scheduledDays.size;
                      const isSkipEligible = daysPerWeek <= 2 && daysPerWeek > 0;
                      
                      if (isSkipEligible) {
                        return (
                          <Alert className="border-amber-200 bg-amber-50">
                            <AlertTriangle className="h-4 w-4 text-amber-600" />
                            <AlertTitle className="text-amber-800">Skip Eligible (2-Day Rule)</AlertTitle>
                            <AlertDescription className="text-amber-700">
                              This client attends {daysPerWeek} day{daysPerWeek === 1 ? '' : 's'}/week ({Array.from(scheduledDays).join(', ').toUpperCase()}). The system will automatically skip them once before canceling.
                              {selectedClient.cancelSkipUsed && <span className="font-medium"> Skip has been used - will be canceled next time.</span>}
                            </AlertDescription>
                          </Alert>
                        );
                      } else if (daysPerWeek === 0) {
                        return (
                          <Alert className="border-slate-200 bg-slate-50">
                            <AlertTriangle className="h-4 w-4 text-slate-600" />
                            <AlertTitle className="text-slate-800">No Schedule</AlertTitle>
                            <AlertDescription className="text-slate-700">
                              No template assignments found. Skip eligibility is calculated from scheduled days.
                            </AlertDescription>
                          </Alert>
                        );
                      } else {
                        return (
                          <div className="flex items-center gap-2 border p-4 rounded-md bg-secondary/10">
                            <div className="flex-1">
                              <Label className="text-base">Schedule: {daysPerWeek} days/week</Label>
                              <p className="text-xs text-muted-foreground">Attends {Array.from(scheduledDays).join(', ').toUpperCase()}. Not eligible for skip (3+ days/week).</p>
                            </div>
                          </div>
                        );
                      }
                    })()}

                    {/* Last Skipped Date - Read Only */}
                    {selectedClient.lastSkippedDate && (
                      <div className="flex items-center justify-between border p-4 rounded-md bg-amber-50">
                        <div>
                          <Label className="text-base">Last Skipped</Label>
                          <p className="text-xs text-muted-foreground">When they were last skipped in cancel selection.</p>
                        </div>
                        <span className="font-medium text-amber-800">{selectedClient.lastSkippedDate}</span>
                      </div>
                    )}

                    {/* 5-Day Absence Notice */}
                    {selectedClient.consecutiveAbsentDays >= 5 && (
                      <Alert className="border-red-200 bg-red-50">
                        <AlertTriangle className="h-4 w-4 text-red-600" />
                        <AlertTitle className="text-red-800">5+ Consecutive Absences</AlertTitle>
                        <AlertDescription className="text-red-700">
                          This client has been absent for {selectedClient.consecutiveAbsentDays} consecutive days.
                          {((selectedClient as any).daysBackSinceAbsence ?? 0) > 0 
                            ? ` Returning: ${(selectedClient as any).daysBackSinceAbsence}/3 attendance days completed. Skip protection will be removed after 3 days.`
                            : ` The system will automatically skip them in cancel selection until they return for 3 consecutive days.`
                          }
                        </AlertDescription>
                      </Alert>
                    )}

                    {/* Consecutive Absent Days */}
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="flex items-center justify-between border p-4 rounded-md">
                        <div>
                          <Label className="text-base">Consecutive Absent Days</Label>
                          <p className="text-xs text-muted-foreground">Count of consecutive fully absent days.</p>
                        </div>
                        <Input
                          type="number"
                          min={0}
                          value={selectedClient.consecutiveAbsentDays}
                          onChange={(e) => updateField('consecutiveAbsentDays', parseInt(e.target.value) || 0)}
                          className="w-20 text-center"
                          data-testid="input-consecutive-absent-days"
                        />
                      </div>
                      <div className="flex items-center justify-between border p-4 rounded-md">
                        <div>
                          <Label className="text-base">Days Back Since Absence</Label>
                          <p className="text-xs text-muted-foreground">After 5+ absent days, tracks return days (need 3).</p>
                        </div>
                        <Input
                          type="number"
                          min={0}
                          max={3}
                          value={(selectedClient as any).daysBackSinceAbsence ?? 0}
                          onChange={(e) => updateField('daysBackSinceAbsence' as any, parseInt(e.target.value) || 0)}
                          className="w-20 text-center"
                          data-testid="input-days-back-since-absence"
                        />
                      </div>
                    </div>

                    {/* Cancel All Day Only */}
                    <div className="flex items-center justify-between border p-4 rounded-md">
                      <div>
                        <Label className="text-base">Cancel All Day Only</Label>
                        <p className="text-xs text-muted-foreground">If enabled, this client can only be canceled for a full day (not AM or PM only).</p>
                      </div>
                      <Switch
                        checked={selectedClient.cancelAllDayOnly}
                        onCheckedChange={(val) => updateField('cancelAllDayOnly', val)}
                        data-testid="switch-cancel-all-day-only"
                      />
                    </div>

                    {/* Critical Cancel Info */}
                    <div className="space-y-2 border p-4 rounded-md">
                      <Label className="text-base">Critical Cancel Info</Label>
                      <p className="text-xs text-muted-foreground">This information will appear in the caregiver contact popup when this client is canceled.</p>
                      <Textarea
                        placeholder="Enter critical information to display when canceling this client..."
                        value={selectedClient.criticalCancelNotes || ""}
                        onChange={(e) => updateField('criticalCancelNotes', e.target.value || null)}
                        className="min-h-[80px]"
                        data-testid="textarea-critical-cancel-notes"
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* Cancel Links Card */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Link2 className="w-5 h-5" /> Cancel Links (Siblings)</CardTitle>
                    <CardDescription>Link clients who should be canceled together (e.g., siblings). When one is canceled, linked clients are also canceled.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="relative max-w-xs">
                      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search clients..."
                        value={cancelLinksSearch}
                        onChange={(e) => setCancelLinksSearch(e.target.value)}
                        className="pl-8 h-9"
                        data-testid="input-cancel-links-search"
                      />
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {clients
                        .filter(c => c.id !== selectedClient.id)
                        .filter(c => !cancelLinksSearch.trim() || c.name.toLowerCase().includes(cancelLinksSearch.toLowerCase()))
                        .sort((a, b) => a.name.localeCompare(b.name))
                        .map(client => {
                          const isLinked = clientCancelLinksData.some(link => link.linkedClientId === client.id);
                          return (
                            <div key={client.id} className="flex items-center space-x-2">
                              <Switch
                                id={`cancel-link-${client.id}`}
                                checked={isLinked}
                                onCheckedChange={(checked) => {
                                  const currentLinkedIds = clientCancelLinksData.map(l => l.linkedClientId);
                                  const newLinkedIds = checked
                                    ? [...currentLinkedIds, client.id]
                                    : currentLinkedIds.filter(id => id !== client.id);
                                  setCancelLinksMutation.mutate({
                                    clientId: selectedClient.id,
                                    linkedClientIds: newLinkedIds
                                  });
                                }}
                              />
                              <Label htmlFor={`cancel-link-${client.id}`} className="font-normal cursor-pointer">{client.name}</Label>
                            </div>
                          );
                        })}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* HISTORY TAB */}
              <TabsContent value="history" className="space-y-6 mt-0">
                {/* Cancel History */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2"><CalendarX className="w-5 h-5" /> Cancel History</CardTitle>
                    <CardDescription>History of cancellations for this client. The system automatically records cancellations.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {cancelHistory.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <CalendarX className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p>No cancellation history yet.</p>
                      </div>
                    ) : (
                      <div className="divide-y">
                        {cancelHistory.map((entry) => (
                          <div key={entry.id} className="py-3 flex items-center justify-between">
                            <div>
                              <span className="font-medium">{new Date(entry.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</span>
                              <span className="ml-2 text-sm px-2 py-0.5 rounded bg-secondary">
                                {entry.timeBlock === 'FULL_DAY' ? 'Full Day' : entry.timeBlock}
                              </span>
                            </div>
                            {entry.reason && (
                              <span className="text-sm text-muted-foreground">{entry.reason}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Sub History */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Users className="w-5 h-5" /> Sub History</CardTitle>
                    <CardDescription>History of substitute staffing for this client. The system automatically records when subs are used.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {subHistory.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p>No sub history yet.</p>
                      </div>
                    ) : (
                      <div className="divide-y">
                        {subHistory.map((entry) => {
                          const subStaff = staffList.find(s => s.id === entry.subStaffId);
                          const originalStaff = entry.originalStaffId ? staffList.find(s => s.id === entry.originalStaffId) : null;
                          return (
                            <div key={entry.id} className="py-3 flex items-center justify-between">
                              <div>
                                <span className="font-medium">{new Date(entry.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</span>
                                <span className="ml-2 text-sm px-2 py-0.5 rounded bg-secondary">{entry.timeBlock}</span>
                              </div>
                              <div className="text-sm">
                                <span className="text-primary font-medium">{subStaff?.name || 'Unknown'}</span>
                                {originalStaff && (
                                  <span className="text-muted-foreground"> (for {originalStaff.name})</span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Skip History */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Shield className="w-5 h-5" /> Skip History</CardTitle>
                    <CardDescription>History of when this client was skipped in cancel selection. Skips protect clients from cancellation.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {skipHistory.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <Shield className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p>No skip history yet.</p>
                      </div>
                    ) : (
                      <div className="divide-y">
                        {skipHistory.map((entry) => (
                          <div key={entry.id} className="py-3 flex items-center justify-between">
                            <span className="font-medium">{new Date(entry.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</span>
                            <span className="text-sm text-amber-700 bg-amber-50 px-2 py-0.5 rounded">{entry.skipReason}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* TRAINING TAB */}
              <TabsContent value="training" className="space-y-6 mt-0">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2"><BookOpen className="w-5 h-5" /> Training Configuration</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-2">
                      <Label>Training Style</Label>
                      <Select value={selectedClient.trainingStyle} onValueChange={(val) => updateField('trainingStyle', val)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="half">Half (Shadow/Support -&gt; Sign Off)</SelectItem>
                          <SelectItem value="full">Full (Led by Trainer)</SelectItem>
                          <SelectItem value="double">Double (Two Staff)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-4 border-t border-border pt-4">
                      <Label className="text-base font-semibold">Allowed Trainers</Label>
                      <p className="text-xs text-muted-foreground">Select staff eligible to train on this client. Leads are Priority 1.</p>
                      <div className="relative max-w-xs">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Search staff..."
                          value={allowedTrainersSearch}
                          onChange={(e) => setAllowedTrainersSearch(e.target.value)}
                          className="pl-8 h-9"
                          data-testid="input-allowed-trainers-search"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        {staffList
                          .filter(s => s.role !== 'BCBA')
                          .filter(s => !allowedTrainersSearch.trim() || s.name.toLowerCase().includes(allowedTrainersSearch.toLowerCase()))
                          .sort((a, b) => a.name.localeCompare(b.name))
                          .map(staff => (
                          <div key={staff.id} className="flex items-center space-x-2">
                             <Switch 
                               id={`trainer-${staff.id}`}
                               checked={(selectedClient.allowedTrainerIds as string[]).includes(staff.id)}
                               onCheckedChange={() => toggleStaffInSet(staff.id, 'allowedTrainerIds')}
                             />
                             <Label htmlFor={`trainer-${staff.id}`} className="font-normal cursor-pointer">
                               {staff.name} {staff.role.includes('Lead') && <Badge variant="outline" className="ml-2 text-xs">Lead</Badge>}
                             </Label>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center justify-between border-t border-border pt-4">
                      <div>
                        <Label className="text-base">Lead Sign-off Allowed</Label>
                        <p className="text-xs text-muted-foreground">Can a Lead RBT sign off on training completion?</p>
                      </div>
                      <Switch checked={selectedClient.leadSignOffAllowed} onCheckedChange={(val) => updateField('leadSignOffAllowed', val)} />
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* LUNCH TAB */}
              <TabsContent value="lunch" className="space-y-6 mt-0">
                <Card>
                  <CardHeader>
                     <CardTitle className="flex items-center gap-2"><Utensils className="w-5 h-5" /> Lunch Coverage</CardTitle>
                     <CardDescription>Configure midday grouping rules for break coverage.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                     <div className="flex items-center justify-between border p-4 rounded-md bg-secondary/10">
                        <div>
                          <Label className="text-base">Can be grouped for lunch</Label>
                          <p className="text-xs text-muted-foreground">If enabled, engine can group this client with allowed peers.</p>
                        </div>
                        <Switch checked={selectedClient.canBeGrouped} onCheckedChange={(val) => updateField('canBeGrouped', val)} />
                     </div>

                     {selectedClient.canBeGrouped && (
                       <div className="space-y-6 animate-in fade-in slide-in-from-top-2 duration-300">
                         <div className="space-y-3">
                            <Label>Allowed Lunch Peers</Label>
                            <div className="relative max-w-xs">
                              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                              <Input
                                placeholder="Search clients..."
                                value={allowedLunchPeersSearch}
                                onChange={(e) => setAllowedLunchPeersSearch(e.target.value)}
                                className="pl-8 h-9"
                                data-testid="input-allowed-lunch-peers-search"
                              />
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                              {clients
                                .filter(c => c.id !== selectedClient.id)
                                .filter(c => !allowedLunchPeersSearch.trim() || c.name.toLowerCase().includes(allowedLunchPeersSearch.toLowerCase()))
                                .sort((a, b) => a.name.localeCompare(b.name))
                                .map(peer => (
                                <div key={peer.id} className="flex items-center space-x-2">
                                  <Switch 
                                    id={`peer-${peer.id}`}
                                    checked={(selectedClient.allowedLunchPeerIds as string[]).includes(peer.id)}
                                    onCheckedChange={() => {
                                      const current = selectedClient.allowedLunchPeerIds as string[];
                                      const isRemoving = current.includes(peer.id);
                                      const newPeers = isRemoving 
                                        ? current.filter((id: string) => id !== peer.id)
                                        : [...current, peer.id];
                                      updateField('allowedLunchPeerIds', newPeers);
                                      
                                      // When removing a peer, also clean up lunch slot restrictions
                                      if (isRemoving) {
                                        const noFirst = (selectedClient.noFirstLunchPeerIds as string[]) || [];
                                        const noSecond = (selectedClient.noSecondLunchPeerIds as string[]) || [];
                                        if (noFirst.includes(peer.id)) {
                                          updateField('noFirstLunchPeerIds', noFirst.filter((id: string) => id !== peer.id));
                                        }
                                        if (noSecond.includes(peer.id)) {
                                          updateField('noSecondLunchPeerIds', noSecond.filter((id: string) => id !== peer.id));
                                        }
                                      }
                                    }}
                                  />
                                  <Label htmlFor={`peer-${peer.id}`} className="font-normal cursor-pointer">{peer.name}</Label>
                                </div>
                              ))}
                            </div>
                         </div>

                         {/* No First Lunch Pairing */}
                         {(selectedClient.allowedLunchPeerIds as string[]).length > 0 && (
                           <div className="space-y-3 border-t border-border pt-4">
                              <div>
                                <Label>No First Lunch Pairing</Label>
                                <p className="text-xs text-muted-foreground">
                                  Selected peers cannot pair during first lunch slot (11:30-12:00 clinic, or first school lunch period).
                                </p>
                              </div>
                              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                {clients
                                  .filter(c => (selectedClient.allowedLunchPeerIds as string[]).includes(c.id))
                                  .sort((a, b) => a.name.localeCompare(b.name))
                                  .map(peer => (
                                    <div key={peer.id} className="flex items-center space-x-2">
                                      <Switch 
                                        id={`no-first-${peer.id}`}
                                        checked={((selectedClient.noFirstLunchPeerIds as string[]) || []).includes(peer.id)}
                                        onCheckedChange={() => {
                                          const current = (selectedClient.noFirstLunchPeerIds as string[]) || [];
                                          const isAdding = !current.includes(peer.id);
                                          const newIds = isAdding 
                                            ? [...current, peer.id]
                                            : current.filter((id: string) => id !== peer.id);
                                          updateField('noFirstLunchPeerIds', newIds);
                                          
                                          // Auto-toggle: update the peer's restriction for this client
                                          const peerClient = clients.find(c => c.id === peer.id);
                                          if (peerClient) {
                                            const peerCurrent = (peerClient.noFirstLunchPeerIds as string[]) || [];
                                            const peerHasThis = peerCurrent.includes(selectedClient.id);
                                            if (isAdding && !peerHasThis) {
                                              updateMutation.mutate({
                                                id: peer.id,
                                                data: { noFirstLunchPeerIds: [...peerCurrent, selectedClient.id] }
                                              });
                                            } else if (!isAdding && peerHasThis) {
                                              updateMutation.mutate({
                                                id: peer.id,
                                                data: { noFirstLunchPeerIds: peerCurrent.filter((id: string) => id !== selectedClient.id) }
                                              });
                                            }
                                          }
                                        }}
                                      />
                                      <Label htmlFor={`no-first-${peer.id}`} className="font-normal cursor-pointer">{peer.name}</Label>
                                    </div>
                                  ))}
                              </div>
                           </div>
                         )}

                         {/* No Second Lunch Pairing */}
                         {(selectedClient.allowedLunchPeerIds as string[]).length > 0 && (
                           <div className="space-y-3 border-t border-border pt-4">
                              <div>
                                <Label>No Second Lunch Pairing</Label>
                                <p className="text-xs text-muted-foreground">
                                  Selected peers cannot pair during second lunch slot (12:00-12:30 clinic, or second school lunch period).
                                </p>
                              </div>
                              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                {clients
                                  .filter(c => (selectedClient.allowedLunchPeerIds as string[]).includes(c.id))
                                  .sort((a, b) => a.name.localeCompare(b.name))
                                  .map(peer => (
                                    <div key={peer.id} className="flex items-center space-x-2">
                                      <Switch 
                                        id={`no-second-${peer.id}`}
                                        checked={((selectedClient.noSecondLunchPeerIds as string[]) || []).includes(peer.id)}
                                        onCheckedChange={() => {
                                          const current = (selectedClient.noSecondLunchPeerIds as string[]) || [];
                                          const isAdding = !current.includes(peer.id);
                                          const newIds = isAdding 
                                            ? [...current, peer.id]
                                            : current.filter((id: string) => id !== peer.id);
                                          updateField('noSecondLunchPeerIds', newIds);
                                          
                                          // Auto-toggle: update the peer's restriction for this client
                                          const peerClient = clients.find(c => c.id === peer.id);
                                          if (peerClient) {
                                            const peerCurrent = (peerClient.noSecondLunchPeerIds as string[]) || [];
                                            const peerHasThis = peerCurrent.includes(selectedClient.id);
                                            if (isAdding && !peerHasThis) {
                                              updateMutation.mutate({
                                                id: peer.id,
                                                data: { noSecondLunchPeerIds: [...peerCurrent, selectedClient.id] }
                                              });
                                            } else if (!isAdding && peerHasThis) {
                                              updateMutation.mutate({
                                                id: peer.id,
                                                data: { noSecondLunchPeerIds: peerCurrent.filter((id: string) => id !== selectedClient.id) }
                                              });
                                            }
                                          }
                                        }}
                                      />
                                      <Label htmlFor={`no-second-${peer.id}`} className="font-normal cursor-pointer">{peer.name}</Label>
                                    </div>
                                  ))}
                              </div>
                           </div>
                         )}

                         <div className="flex items-center justify-between border-t border-border pt-4">
                            <div>
                              <Label className="text-base">Allow groups of 3</Label>
                              <p className="text-xs text-muted-foreground">Default is pairs. Enable to allow larger groups.</p>
                            </div>
                            <Switch checked={selectedClient.allowGroupsOf3} onCheckedChange={(val) => updateField('allowGroupsOf3', val)} />
                         </div>

                         <div className="flex items-center justify-between border-t border-border pt-4">
                            <div>
                              <Label className="text-base">Allow groups of 4</Label>
                              <p className="text-xs text-muted-foreground">Enable to allow groups of 4 clients during lunch coverage.</p>
                            </div>
                            <Switch 
                              checked={selectedClient.allowGroupsOf4 ?? false} 
                              onCheckedChange={(val) => updateField('allowGroupsOf4', val)}
                              disabled={!selectedClient.allowGroupsOf3}
                            />
                         </div>

                         {/* Group Leader Section */}
                         <div className="space-y-3 border-t border-border pt-4">
                            <div className="flex items-center justify-between">
                              <div>
                                <Label className="text-base">Is Staff A Group Leader?</Label>
                                <p className="text-xs text-muted-foreground">Staff assigned to this client is designated as a group leader.</p>
                              </div>
                              <Switch 
                                checked={selectedClient.isGroupLeader ?? false} 
                                onCheckedChange={(val) => {
                                  updateField('isGroupLeader', val);
                                  if (!val) {
                                    updateField('groupLeaderName', null);
                                    updateField('groupLeaderNameFirstLunch', null);
                                    updateField('groupLeaderNameSecondLunch', null);
                                  }
                                }}
                              />
                            </div>
                            
                            {selectedClient.isGroupLeader && (
                              <div className="space-y-4 pl-4 border-l-2 border-primary/20">
                                <div className="space-y-2">
                                  <Label>First Lunch Group Name (11:30-12:00)</Label>
                                  <p className="text-xs text-muted-foreground">
                                    Enter the group name for the first lunch period (e.g., "motor room", "centers", "PreK").
                                  </p>
                                  <Input
                                    value={selectedClient.groupLeaderNameFirstLunch || ''}
                                    onChange={(e) => updateField('groupLeaderNameFirstLunch', e.target.value || null)}
                                    placeholder="Enter group name..."
                                    className="max-w-xs"
                                  />
                                  {selectedClient.groupLeaderNameFirstLunch && (
                                    <div className="flex items-center gap-2 mt-2">
                                      <span className="text-sm text-muted-foreground">Preview:</span>
                                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                                        {selectedClient.groupLeaderNameFirstLunch} Leader
                                      </span>
                                    </div>
                                  )}
                                </div>

                                <div className="space-y-2">
                                  <Label>Second Lunch Group Name (12:00-12:30)</Label>
                                  <p className="text-xs text-muted-foreground">
                                    Enter the group name for the second lunch period.
                                  </p>
                                  <Input
                                    value={selectedClient.groupLeaderNameSecondLunch || ''}
                                    onChange={(e) => updateField('groupLeaderNameSecondLunch', e.target.value || null)}
                                    placeholder="Enter group name..."
                                    className="max-w-xs"
                                  />
                                  {selectedClient.groupLeaderNameSecondLunch && (
                                    <div className="flex items-center gap-2 mt-2">
                                      <span className="text-sm text-muted-foreground">Preview:</span>
                                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                                        {selectedClient.groupLeaderNameSecondLunch} Leader
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                         </div>
                       </div>
                     )}
                  </CardContent>
                </Card>
              </TabsContent>
            </ScrollArea>
          </Tabs>
        </div>
      </div>
    </Layout>
  );
}
