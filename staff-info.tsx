import { useState, useEffect } from "react";
import Layout from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
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
import { Search, Plus, Save, User, Calendar, Award, Clock, Copy, Trash2, AlertCircle, Phone, MapPin, X, Network } from "lucide-react";
import { type StaffRole, type LeadLevel, type WeeklyAvailability } from "@/lib/mock-data";
import type { Staff, Client, School, StaffPhoneContact } from "@shared/schema";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Separator } from "@/components/ui/separator";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

// Availability Editor Helper Components
const TimeSelect = ({ 
  value, 
  onChange 
}: { 
  value: string; // "HH:MM"
  onChange: (val: string) => void;
}) => {
  const [hour, min] = value.split(":").map(Number);
  // Convert 24h to 12h for display
  const isPM = hour >= 12;
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  
  return (
    <div className="flex items-center gap-1">
      <Select value={displayHour.toString()} onValueChange={(h) => {
        let newHour = parseInt(h);
        if (isPM && newHour !== 12) newHour += 12;
        if (!isPM && newHour === 12) newHour = 0;
        onChange(`${newHour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`);
      }}>
        <SelectTrigger className="w-[70px] h-8">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {Array.from({ length: 12 }, (_, i) => i + 1).map(h => (
            <SelectItem key={h} value={h.toString()}>{h}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      
      <Select value={min.toString()} onValueChange={(m) => {
        onChange(`${hour.toString().padStart(2, '0')}:${parseInt(m).toString().padStart(2, '0')}`);
      }}>
        <SelectTrigger className="w-[70px] h-8">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {["00", "15", "30", "45"].map(m => (
            <SelectItem key={m} value={m === "00" ? "0" : m}>{m}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      
      <Button 
        variant="outline" 
        size="sm" 
        className={cn("h-8 w-12 px-0", isPM ? "bg-primary/10 text-primary" : "")}
        onClick={() => {
          let newHour = hour;
          if (isPM) newHour -= 12;
          else newHour += 12;
          onChange(`${newHour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`);
        }}
      >
        {isPM ? "PM" : "AM"}
      </Button>
    </div>
  );
};

// Clinical Manager Multi-Select Component for Lead BCBAs and Admins
const CmMultiSelect = ({ 
  label, 
  staffId, 
  staffList, 
  filterRole, 
  linkType 
}: { 
  label: string;
  staffId: string;
  staffList: Staff[];
  filterRole: string;
  linkType: 'lead_bcba' | 'admin';
}) => {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  
  const endpoint = linkType === 'lead_bcba' ? '/api/cm-lead-bcba-links' : '/api/cm-admin-links';
  const idKey = linkType === 'lead_bcba' ? 'leadBcbaId' : 'adminId';
  const bodyKey = linkType === 'lead_bcba' ? 'leadBcbaIds' : 'adminIds';
  
  const { data: links = [] } = useQuery<any[]>({
    queryKey: [endpoint, staffId],
    queryFn: async () => {
      const response = await fetch(`${endpoint}/${staffId}`);
      if (!response.ok) return [];
      return response.json();
    },
  });
  
  const selectedIds = links.map(l => l[idKey]);
  const selectedStaff = staffList.filter(s => selectedIds.includes(s.id));
  const availableStaff = staffList.filter(s => s.role === filterRole && !selectedIds.includes(s.id));
  
  const updateMutation = useMutation({
    mutationFn: async (newIds: string[]) => {
      const response = await fetch(`${endpoint}/${staffId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [bodyKey]: newIds }),
      });
      if (!response.ok) throw new Error('Failed to update');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [endpoint, staffId] });
    },
  });
  
  const addStaff = (id: string) => {
    updateMutation.mutate([...selectedIds, id]);
    setDialogOpen(false);
  };
  
  const removeStaff = (id: string) => {
    updateMutation.mutate(selectedIds.filter(sid => sid !== id));
  };
  
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => setDialogOpen(true)}
          disabled={availableStaff.length === 0}
        >
          <Plus className="w-4 h-4 mr-1" />
          Add
        </Button>
      </div>
      <div className="border rounded-md p-3 min-h-[60px] bg-muted/30">
        {selectedStaff.length === 0 ? (
          <p className="text-sm text-muted-foreground">No {label.toLowerCase()} assigned</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {selectedStaff.sort((a, b) => a.name.localeCompare(b.name)).map(s => (
              <Badge key={s.id} variant="secondary" className="flex items-center gap-1">
                {s.name}
                <button 
                  onClick={() => removeStaff(s.id)}
                  className="hover:text-destructive ml-1"
                >
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
      </div>
      
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add {label.slice(0, -1)}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 max-h-[300px] overflow-auto">
            {availableStaff.sort((a, b) => a.name.localeCompare(b.name)).map(s => (
              <Button 
                key={s.id} 
                variant="outline" 
                className="w-full justify-start"
                onClick={() => addStaff(s.id)}
              >
                {s.name}
              </Button>
            ))}
            {availableStaff.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                No available {label.toLowerCase()} to add
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// Lead RBT Multi-Select Component for assigned BCBAs (many-to-many)
const LeadRbtBcbaMultiSelect = ({ 
  staffId, 
  staffList 
}: { 
  staffId: string;
  staffList: Staff[];
}) => {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  
  const { data: links = [] } = useQuery<any[]>({
    queryKey: ['/api/lead-rbt-bcba-links', staffId],
    queryFn: async () => {
      const response = await fetch(`/api/lead-rbt-bcba-links/${staffId}`);
      if (!response.ok) return [];
      return response.json();
    },
  });
  
  const selectedIds = links.map(l => l.bcbaId);
  const selectedBcbas = staffList.filter(s => selectedIds.includes(s.id));
  const availableBcbas = staffList.filter(s => s.role === 'BCBA' && !selectedIds.includes(s.id));
  
  const updateMutation = useMutation({
    mutationFn: async (newIds: string[]) => {
      const response = await fetch(`/api/lead-rbt-bcba-links/${staffId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bcbaIds: newIds }),
      });
      if (!response.ok) throw new Error('Failed to update');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/lead-rbt-bcba-links', staffId] });
      queryClient.invalidateQueries({ queryKey: ['/api/lead-rbt-bcba-links'] });
    },
  });
  
  const addBcba = (id: string) => {
    updateMutation.mutate([...selectedIds, id]);
    setDialogOpen(false);
  };
  
  const removeBcba = (id: string) => {
    updateMutation.mutate(selectedIds.filter(sid => sid !== id));
  };
  
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>Assigned BCBAs</Label>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => setDialogOpen(true)}
          disabled={availableBcbas.length === 0}
        >
          <Plus className="w-4 h-4 mr-1" />
          Add
        </Button>
      </div>
      <div className="border rounded-md p-3 min-h-[60px] bg-muted/30">
        {selectedBcbas.length === 0 ? (
          <p className="text-sm text-muted-foreground">No BCBAs assigned</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {selectedBcbas.sort((a, b) => a.name.localeCompare(b.name)).map(s => (
              <Badge key={s.id} variant="secondary" className="flex items-center gap-1">
                {s.name}
                <button 
                  onClick={() => removeBcba(s.id)}
                  className="hover:text-destructive ml-1"
                >
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
      </div>
      
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add BCBA</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 max-h-[300px] overflow-auto">
            {availableBcbas.sort((a, b) => a.name.localeCompare(b.name)).map(s => (
              <Button 
                key={s.id} 
                variant="outline" 
                className="w-full justify-start"
                onClick={() => addBcba(s.id)}
              >
                {s.name}
              </Button>
            ))}
            {availableBcbas.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                No available BCBAs to add
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default function StaffInfo() {
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newStaffName, setNewStaffName] = useState("");
  const [pendingApply, setPendingApply] = useState<{ day: 'mon' | 'tue' | 'wed' | 'thu' | 'fri'; field: 'start' | 'end'; value: string } | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch all staff
  const { data: staffList = [], isLoading } = useQuery<Staff[]>({
    queryKey: ["/api/staff"],
    queryFn: async () => {
      const response = await fetch("/api/staff");
      if (!response.ok) throw new Error("Failed to fetch staff");
      return response.json();
    },
  });

  // Fetch all clients for BX Support selector
  const { data: clientList = [] } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
    queryFn: async () => {
      const response = await fetch("/api/clients");
      if (!response.ok) throw new Error("Failed to fetch clients");
      return response.json();
    },
  });

  // Fetch all schools for School Staff selector
  const { data: schoolList = [] } = useQuery<School[]>({
    queryKey: ["/api/schools"],
    queryFn: async () => {
      const response = await fetch("/api/schools");
      if (!response.ok) throw new Error("Failed to fetch schools");
      return response.json();
    },
  });

  // Create staff mutation
  const createMutation = useMutation({
    mutationFn: async (name: string) => {
      const defaultAvailability: WeeklyAvailability = {
        mon: { enabled: true, start: "08:00", end: "16:30" },
        tue: { enabled: true, start: "08:00", end: "16:30" },
        wed: { enabled: true, start: "08:00", end: "16:30" },
        thu: { enabled: true, start: "08:00", end: "16:30" },
        fri: { enabled: true, start: "08:00", end: "16:30" },
      };
      
      const newStaff = {
        name,
        active: true,
        startDate: new Date().toISOString().split('T')[0],
        role: "RBT" as StaffRole,
        subEligible: false,
        allowQuadrupleBilling: false,
        noCrisisCoverage: false,
        noCrisisCoverageEndDate: null,
        leadLevel: null,
        notBtNonbillable: false,
        nonBillableMidday: false,
        assignedBcbaId: null,
        btCertificationDate: null,
        rbtCertificationDate: null,
        availability: defaultAvailability,
        isTrainer: false,
        signOffPermitted: false,
        hireDate: new Date().toISOString().split('T')[0],
        newHireOverride: false,
        noLunch: false,
        breakRequired: false,
        breakDuration: null,
        noLateLunches: false,
      };

      const response = await fetch("/api/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newStaff),
      });
      if (!response.ok) throw new Error("Failed to create staff");
      return response.json();
    },
    onSuccess: (newStaff) => {
      queryClient.invalidateQueries({ queryKey: ["/api/staff"] });
      setSelectedStaffId(newStaff.id);
      setAddDialogOpen(false);
      setNewStaffName("");
      toast({
        title: "Staff Added",
        description: `${newStaff.name} has been added successfully`,
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to add staff member",
        variant: "destructive",
      });
    },
  });

  // Update staff mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Staff> }) => {
      const response = await fetch(`/api/staff/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to update staff");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/staff"] });
      toast({
        title: "Changes Saved",
        description: `Updated profile successfully`,
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

  // Delete staff mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/staff/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete staff");
      return id;
    },
    onSuccess: (deletedId) => {
      queryClient.invalidateQueries({ queryKey: ["/api/staff"] });
      if (selectedStaffId === deletedId) {
        const remaining = staffList.filter(s => s.id !== deletedId);
        setSelectedStaffId(remaining.length > 0 ? remaining[0].id : null);
      }
      toast({
        title: "Staff Removed",
        description: "Staff member has been removed from the system.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to remove staff member",
        variant: "destructive",
      });
    },
  });

  const handleAddStaff = () => {
    if (!newStaffName.trim()) {
      toast({
        title: "Validation Error",
        description: "Please enter a staff name",
        variant: "destructive",
      });
      return;
    }
    createMutation.mutate(newStaffName.trim());
  };

  // Set first staff member as selected when data loads
  if (!selectedStaffId && staffList.length > 0) {
    setSelectedStaffId(staffList[0].id);
  }

  const selectedStaff = staffList.find(s => s.id === selectedStaffId);

  // Clear pending apply when staff changes
  useEffect(() => {
    setPendingApply(null);
  }, [selectedStaffId]);

  const filteredStaff = staffList
    .filter(s => s.name.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name));

  const handleSave = () => {
    if (!selectedStaff) return;

    // Basic Validation
    if (selectedStaff.role === 'Lead RBT' && !selectedStaff.leadLevel) {
      toast({
        title: "Validation Error",
        description: "Lead RBTs must have a Lead Level assigned.",
        variant: "destructive"
      });
      return;
    }

    updateMutation.mutate({ id: selectedStaff.id, data: selectedStaff });
  };

  const updateField = (field: keyof Staff, value: any) => {
    if (!selectedStaff) return;
    
    // Optimistic update in local state
    queryClient.setQueryData(["/api/staff"], (old: Staff[] | undefined) => {
      if (!old) return old;
      return old.map(s => s.id === selectedStaffId ? { ...s, [field]: value } : s);
    });
  };

  const updateAvailability = (day: keyof WeeklyAvailability, field: keyof WeeklyAvailability['mon'], value: any) => {
    if (!selectedStaff) return;
    const availability = selectedStaff.availability as WeeklyAvailability;
    const newAvail = { ...availability };
    newAvail[day] = { ...newAvail[day], [field]: value };
    updateField('availability', newAvail);
    
    // Track time changes for "Apply to rest of week"
    if (field === 'start' || field === 'end') {
      setPendingApply({ day: day as 'mon' | 'tue' | 'wed' | 'thu' | 'fri', field, value: value as string });
    }
  };

  const handleApplyToRestOfWeek = () => {
    if (!pendingApply || !selectedStaff) return;
    const availability = selectedStaff.availability as WeeklyAvailability;
    const days: ('mon' | 'tue' | 'wed' | 'thu' | 'fri')[] = ['mon', 'tue', 'wed', 'thu', 'fri'];
    const startIndex = days.indexOf(pendingApply.day);
    
    const newAvail = { ...availability };
    for (let i = startIndex + 1; i < days.length; i++) {
      const day = days[i];
      if (newAvail[day]) {
        newAvail[day] = { ...newAvail[day], [pendingApply.field]: pendingApply.value };
      } else {
        const defaultStart = pendingApply.field === 'start' ? pendingApply.value : '08:00';
        const defaultEnd = pendingApply.field === 'end' ? pendingApply.value : '16:30';
        newAvail[day] = { enabled: false, start: defaultStart, end: defaultEnd };
      }
    }
    
    updateField('availability', newAvail);
    setPendingApply(null);
    toast({
      description: `${pendingApply.field === 'start' ? 'Start' : 'End'} time applied to remaining days.`,
    });
  };

  const copyMondayToAll = () => {
    if (!selectedStaff) return;
    const availability = selectedStaff.availability as WeeklyAvailability;
    const mon = availability.mon;
    const newAvail = {
      mon: { ...mon },
      tue: { ...mon },
      wed: { ...mon },
      thu: { ...mon },
      fri: { ...mon },
    };
    updateField('availability', newAvail);
    toast({ description: "Copied Monday's hours to all days." });
  };

  // Calculated Read-only fields
  const calculateTenure = (dateStr: string) => {
    const start = new Date(dateStr);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
    if (diffDays > 365) return `${(diffDays/365).toFixed(1)} years`;
    return `${diffDays} days`;
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-[calc(100vh-140px)]">
          <p className="text-muted-foreground">Loading staff data...</p>
        </div>
      </Layout>
    );
  }

  if (!selectedStaff) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-[calc(100vh-140px)]">
          <p className="text-muted-foreground">No staff members found</p>
        </div>
      </Layout>
    );
  }

  const availability = selectedStaff.availability as WeeklyAvailability;

  return (
    <Layout>
      <div className="flex flex-col lg:flex-row gap-4 md:gap-6 min-h-[calc(100vh-140px)] lg:h-[calc(100vh-140px)]">
        
        {/* Left Panel: Staff List */}
        <Card className="w-full lg:w-80 flex flex-col min-h-[200px] h-[250px] lg:h-full border-border/60 shadow-sm shrink-0">
          <CardHeader className="p-4 border-b border-border/40 space-y-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Staff Directory</CardTitle>
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setAddDialogOpen(true)} data-testid="button-add-staff">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search staff..."
                className="pl-9 bg-secondary/20"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </CardHeader>
          <CardContent className="p-0 flex-1 overflow-hidden">
            <ScrollArea className="h-full">
              <div className="flex flex-col p-2 gap-1">
                {filteredStaff.map((staff) => (
                  <button
                    key={staff.id}
                    onClick={() => setSelectedStaffId(staff.id)}
                    className={cn(
                      "flex flex-col items-start gap-1 p-3 rounded-md text-sm transition-colors text-left",
                      selectedStaffId === staff.id 
                        ? "bg-primary/10 text-primary font-medium" 
                        : "hover:bg-secondary/30 text-muted-foreground"
                    )}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span>{staff.name}</span>
                      <div className="flex items-center gap-2">
                        {staff.role === 'BCBA' && <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">BCBA</Badge>}
                        {staff.active ? (
                          <span className="w-2 h-2 rounded-full bg-emerald-500" />
                        ) : (
                          <span className="w-2 h-2 rounded-full bg-slate-300" />
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Right Panel: Staff Detail */}
        <div className="flex-1 flex flex-col gap-4 md:gap-6 overflow-visible lg:overflow-hidden">
          {/* Sticky Top Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-background z-10 py-2">
            <div>
              <h1 className="text-2xl md:text-3xl font-serif font-bold text-primary">{selectedStaff.name}</h1>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                 <div className="flex items-center space-x-2">
                    <Switch checked={selectedStaff.active} onCheckedChange={(val) => updateField('active', val)} />
                    <span className="text-xs sm:text-sm text-muted-foreground">{selectedStaff.active ? "Active" : "Inactive"}</span>
                 </div>
                 <span className="text-muted-foreground mx-1 hidden sm:inline">|</span>
                 <span className="text-xs sm:text-sm text-muted-foreground truncate max-w-[120px] sm:max-w-none">ID: {selectedStaff.id}</span>
              </div>
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" className="text-destructive hover:bg-destructive/10 flex-1 sm:flex-initial" data-testid="button-delete-staff">
                    <Trash2 className="mr-2 h-4 w-4" />
                    Remove
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Remove Staff Member</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to remove {selectedStaff.name}? This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction 
                      onClick={() => deleteMutation.mutate(selectedStaff.id)}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      data-testid="button-confirm-delete-staff"
                    >
                      Remove
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              <Button variant="outline" onClick={() => {/* Cancel */}} className="flex-1 sm:flex-initial">Cancel</Button>
              <Button onClick={handleSave} className="bg-primary text-primary-foreground shadow-sm flex-1 sm:flex-initial">
                <Save className="mr-2 h-4 w-4" />
                Save
              </Button>
            </div>
          </div>

          <ScrollArea className="flex-1 pr-4">
            <div className="space-y-8 pb-10">
              
              {/* Basics Section */}
              <section className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-border">
                  <User className="w-5 h-5 text-primary" />
                  <h3 className="text-lg font-medium">Basics</h3>
                </div>
                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Staff Name</Label>
                    <Input value={selectedStaff.name} onChange={(e) => updateField('name', e.target.value)} />
                  </div>
                  {/* Show Assigned BCBA for BT, RBT, Float (single select) */}
                  {['BT', 'RBT', 'Float'].includes(selectedStaff.role) && (
                    <div className="space-y-2">
                      <Label>Assigned BCBA</Label>
                      <Select value={selectedStaff.assignedBcbaId || "none"} onValueChange={(val) => updateField('assignedBcbaId', val === "none" ? null : val)}>
                        <SelectTrigger>
                          <SelectValue placeholder="None" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          {staffList.filter(s => s.role === 'BCBA' && s.id !== selectedStaff.id).sort((a, b) => a.name.localeCompare(b.name)).map(s => (
                            <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  {/* Show Assigned BCBAs for Lead RBT (multi-select - Lead RBTs can be shared) */}
                  {selectedStaff.role === 'Lead RBT' && (
                    <LeadRbtBcbaMultiSelect staffId={selectedStaff.id} staffList={staffList} />
                  )}
                  {/* BCBA supervision fields */}
                  {selectedStaff.role === 'BCBA' && (
                    <>
                      <div className="space-y-2">
                        <Label>Assigned Lead (Lead RBT)</Label>
                        <Select value={(selectedStaff as any).assignedLeadId || "none"} onValueChange={(val) => updateField('assignedLeadId' as any, val === "none" ? null : val)}>
                          <SelectTrigger>
                            <SelectValue placeholder="None" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">None</SelectItem>
                            {staffList.filter(s => s.role === 'Lead RBT' && s.id !== selectedStaff.id).sort((a, b) => a.name.localeCompare(b.name)).map(s => (
                              <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Program Supervisor (Lead BCBA)</Label>
                        <Select value={(selectedStaff as any).programSupervisorId || "none"} onValueChange={(val) => updateField('programSupervisorId' as any, val === "none" ? null : val)}>
                          <SelectTrigger>
                            <SelectValue placeholder="None" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">None</SelectItem>
                            {staffList.filter(s => s.role === 'Lead BCBA' && s.id !== selectedStaff.id).sort((a, b) => a.name.localeCompare(b.name)).map(s => (
                              <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Clinical Supervisor (Clinical Manager)</Label>
                        <Select value={(selectedStaff as any).clinicalSupervisorId || "none"} onValueChange={(val) => updateField('clinicalSupervisorId' as any, val === "none" ? null : val)}>
                          <SelectTrigger>
                            <SelectValue placeholder="None" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">None</SelectItem>
                            {staffList.filter(s => s.role === 'Clinical Manager' && s.id !== selectedStaff.id).sort((a, b) => a.name.localeCompare(b.name)).map(s => (
                              <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </>
                  )}
                  {/* Admin supervision fields */}
                  {selectedStaff.role === 'Admin' && (
                    <div className="space-y-2">
                      <Label>Clinical Supervisor (Clinical Manager)</Label>
                      <Select value={(selectedStaff as any).clinicalSupervisorId || "none"} onValueChange={(val) => updateField('clinicalSupervisorId' as any, val === "none" ? null : val)}>
                        <SelectTrigger>
                          <SelectValue placeholder="None" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          {staffList.filter(s => s.role === 'Clinical Manager' && s.id !== selectedStaff.id).sort((a, b) => a.name.localeCompare(b.name)).map(s => (
                            <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  {/* Lead BCBA supervision fields */}
                  {selectedStaff.role === 'Lead BCBA' && (
                    <>
                      <div className="space-y-2">
                        <Label>Clinical Supervisor (Clinical Manager)</Label>
                        <Select value={(selectedStaff as any).clinicalSupervisorId || "none"} onValueChange={(val) => updateField('clinicalSupervisorId' as any, val === "none" ? null : val)}>
                          <SelectTrigger>
                            <SelectValue placeholder="None" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">None</SelectItem>
                            {staffList.filter(s => s.role === 'Clinical Manager' && s.id !== selectedStaff.id).sort((a, b) => a.name.localeCompare(b.name)).map(s => (
                              <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2 col-span-2">
                        <Label>BCBAs Supervised</Label>
                        <div className="border rounded-md p-3 min-h-[60px] bg-muted/30">
                          {staffList.filter(s => s.role === 'BCBA' && (s as any).programSupervisorId === selectedStaff.id).length === 0 ? (
                            <p className="text-sm text-muted-foreground">No BCBAs currently assigned</p>
                          ) : (
                            <div className="flex flex-wrap gap-2">
                              {staffList.filter(s => s.role === 'BCBA' && (s as any).programSupervisorId === selectedStaff.id).sort((a, b) => a.name.localeCompare(b.name)).map(s => (
                                <Badge key={s.id} variant="secondary">{s.name}</Badge>
                              ))}
                            </div>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">BCBAs who have selected this Lead BCBA as their Program Supervisor</p>
                      </div>
                    </>
                  )}
                </div>
              </section>
              
              {/* Clinical Manager Supervision Section */}
              {selectedStaff.role === 'Clinical Manager' && (
                <section className="space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b border-border">
                    <Network className="w-5 h-5 text-primary" />
                    <h3 className="text-lg font-medium">Supervision</h3>
                  </div>
                  <div className="grid gap-6 md:grid-cols-2">
                    <CmMultiSelect
                      label="Lead BCBAs"
                      staffId={selectedStaff.id}
                      staffList={staffList}
                      filterRole="Lead BCBA"
                      linkType="lead_bcba"
                    />
                    <CmMultiSelect
                      label="Admins"
                      staffId={selectedStaff.id}
                      staffList={staffList}
                      filterRole="Admin"
                      linkType="admin"
                    />
                  </div>
                </section>
              )}

              {/* Contact Information */}
              <section className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-border">
                  <Phone className="w-5 h-5 text-primary" />
                  <h3 className="text-lg font-medium">Contact Information</h3>
                </div>
                
                {/* Home Address */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    Home Address
                  </Label>
                  <Input 
                    value={selectedStaff.homeAddress || ""} 
                    onChange={(e) => updateField('homeAddress', e.target.value || null)}
                    placeholder="Enter home address for drive time estimation..."
                    data-testid="input-home-address"
                  />
                  <p className="text-xs text-muted-foreground">Used to estimate drive time when calling staff in from on-call.</p>
                </div>

                {/* Phone Numbers */}
                <div className="space-y-3">
                  <Label className="flex items-center gap-2">
                    <Phone className="w-4 h-4" />
                    Phone Numbers
                  </Label>
                  
                  {(() => {
                    const phoneContacts = (selectedStaff.phoneContacts as StaffPhoneContact[]) || [];
                    
                    const addPhoneContact = () => {
                      const newContact: StaffPhoneContact = {
                        id: crypto.randomUUID(),
                        type: 'cell',
                        number: '',
                      };
                      updateField('phoneContacts', [...phoneContacts, newContact]);
                    };
                    
                    const updatePhoneContact = (id: string, updates: Partial<StaffPhoneContact>) => {
                      const updated = phoneContacts.map(c => 
                        c.id === id ? { ...c, ...updates } : c
                      );
                      updateField('phoneContacts', updated);
                    };
                    
                    const removePhoneContact = (id: string) => {
                      updateField('phoneContacts', phoneContacts.filter(c => c.id !== id));
                    };
                    
                    return (
                      <div className="space-y-3">
                        {phoneContacts.map((contact) => (
                          <div key={contact.id} className="border rounded-lg p-3 space-y-3 bg-secondary/5">
                            <div className="flex gap-3 items-start">
                              <Select 
                                value={contact.type} 
                                onValueChange={(val) => updatePhoneContact(contact.id, { 
                                  type: val as StaffPhoneContact['type'],
                                  emergencyName: val !== 'emergency' ? undefined : contact.emergencyName,
                                  emergencyRelationship: val !== 'emergency' ? undefined : contact.emergencyRelationship,
                                })}
                              >
                                <SelectTrigger className="w-40" data-testid={`select-phone-type-${contact.id}`}>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="cell">Cell</SelectItem>
                                  <SelectItem value="home">Home</SelectItem>
                                  <SelectItem value="work">Work</SelectItem>
                                  <SelectItem value="emergency">Emergency Contact</SelectItem>
                                </SelectContent>
                              </Select>
                              
                              <Input 
                                type="tel"
                                placeholder="Phone number"
                                value={contact.number}
                                onChange={(e) => updatePhoneContact(contact.id, { number: e.target.value })}
                                className="flex-1"
                                data-testid={`input-phone-number-${contact.id}`}
                              />
                              
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => removePhoneContact(contact.id)}
                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                data-testid={`button-remove-phone-${contact.id}`}
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            </div>
                            
                            {/* Emergency Contact Fields */}
                            {contact.type === 'emergency' && (
                              <div className="grid gap-3 sm:grid-cols-2 pl-2 border-l-2 border-amber-300 ml-2 animate-in fade-in slide-in-from-top-2">
                                <div className="space-y-1">
                                  <Label className="text-sm text-muted-foreground">Contact Name</Label>
                                  <Input
                                    placeholder="Emergency contact name"
                                    value={contact.emergencyName || ""}
                                    onChange={(e) => updatePhoneContact(contact.id, { emergencyName: e.target.value })}
                                    data-testid={`input-emergency-name-${contact.id}`}
                                  />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-sm text-muted-foreground">Relationship</Label>
                                  <Input
                                    placeholder="e.g., Spouse, Parent"
                                    value={contact.emergencyRelationship || ""}
                                    onChange={(e) => updatePhoneContact(contact.id, { emergencyRelationship: e.target.value })}
                                    data-testid={`input-emergency-relationship-${contact.id}`}
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                        
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={addPhoneContact}
                          className="w-full border-dashed"
                          data-testid="button-add-phone"
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          Add Phone Number
                        </Button>
                      </div>
                    );
                  })()}
                </div>
              </section>

              {/* Role & Permissions */}
              <section className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-border">
                  <Award className="w-5 h-5 text-primary" />
                  <h3 className="text-lg font-medium">Role & Permissions</h3>
                </div>
                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Role</Label>
                    <Select value={selectedStaff.role} onValueChange={(val) => updateField('role', val)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="BT">BT</SelectItem>
                        <SelectItem value="RBT">RBT</SelectItem>
                        <SelectItem value="Float">Float</SelectItem>
                        <SelectItem value="Lead RBT">Lead RBT</SelectItem>
                        <SelectItem value="BCBA">BCBA</SelectItem>
                        <SelectItem value="Lead BCBA">Lead BCBA</SelectItem>
                        <SelectItem value="Admin">Admin</SelectItem>
                        <SelectItem value="Clinical Manager">Clinical Manager</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {selectedStaff.role === 'Lead RBT' && (
                    <div className="space-y-2 animate-in fade-in slide-in-from-left-2">
                      <Label>Lead Level <span className="text-destructive">*</span></Label>
                      <Select value={selectedStaff.leadLevel?.toString() || ""} onValueChange={(val) => updateField('leadLevel', parseInt(val))}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select Level" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">Level 1</SelectItem>
                          <SelectItem value="2">Level 2</SelectItem>
                          <SelectItem value="3">Level 3</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <div className="space-y-2 flex flex-col justify-end pb-2">
                     <div className="flex items-center justify-between border p-3 rounded-md">
                        <div>
                          <Label className="cursor-pointer" htmlFor="sub-eligible">Sub Eligible</Label>
                          <p className="text-xs text-muted-foreground">Can cover shifts outside focus clients?</p>
                        </div>
                        <Switch id="sub-eligible" checked={selectedStaff.subEligible} onCheckedChange={(val) => updateField('subEligible', val)} />
                     </div>
                  </div>

                  <div className="space-y-2 flex flex-col justify-end pb-2">
                     <div className="border p-3 rounded-md border-purple-200 bg-purple-50/50 dark:border-purple-900 dark:bg-purple-950/30">
                        <div className="flex items-center justify-between">
                          <div>
                            <Label className="cursor-pointer" htmlFor="allow-quadruple-billing">Can Cover Groups of 4 During Lunches</Label>
                            <p className="text-xs text-muted-foreground">Can cover up to 4 clients during lunch periods</p>
                          </div>
                          <Switch 
                            id="allow-quadruple-billing" 
                            checked={selectedStaff.allowQuadrupleBilling} 
                            onCheckedChange={(val) => updateField('allowQuadrupleBilling', val)} 
                          />
                        </div>
                        {selectedStaff.allowQuadrupleBilling && (
                          <div className="pt-3 mt-3 border-t border-purple-200 dark:border-purple-900 space-y-1 animate-in fade-in slide-in-from-top-2">
                            <p className="text-xs text-purple-700 dark:text-purple-400 font-medium">Last resort option when no other coverage prevents a cancel:</p>
                            <ul className="text-xs text-purple-600 dark:text-purple-500 list-disc list-inside space-y-0.5">
                              <li>Non-leads are preferred over leads</li>
                            </ul>
                            <p className="text-xs text-purple-600 dark:text-purple-500 mt-2">Requires approval • Tagged as "Nonbillable"</p>
                          </div>
                        )}
                     </div>
                  </div>

                  <div className="space-y-2 flex flex-col justify-end pb-2">
                     <div className="border p-3 rounded-md space-y-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <Label className="cursor-pointer" htmlFor="no-crisis-coverage">No Crisis Coverage</Label>
                            <p className="text-xs text-muted-foreground">Cannot be scheduled with crisis clients</p>
                          </div>
                          <Switch 
                            id="no-crisis-coverage" 
                            checked={selectedStaff.noCrisisCoverage} 
                            onCheckedChange={(val) => {
                              updateField('noCrisisCoverage', val);
                              if (!val) {
                                updateField('noCrisisCoverageEndDate', null);
                              }
                            }} 
                          />
                        </div>
                        {selectedStaff.noCrisisCoverage && (
                          <div className="pt-2 border-t space-y-2 animate-in fade-in slide-in-from-top-2">
                            <Label className="text-sm text-muted-foreground">Restriction End Date (optional)</Label>
                            <Input 
                              type="date" 
                              value={selectedStaff.noCrisisCoverageEndDate || ""} 
                              onChange={(e) => updateField('noCrisisCoverageEndDate', e.target.value || null)}
                              placeholder="Leave empty if indefinite"
                            />
                            <p className="text-xs text-muted-foreground">Leave empty if restriction is indefinite</p>
                          </div>
                        )}
                     </div>

                     <div className="border p-3 rounded-md">
                        <div className="flex items-center justify-between">
                          <div>
                            <Label className="cursor-pointer" htmlFor="no-lunch">No Lunch</Label>
                            <p className="text-xs text-muted-foreground">Staff does not take a lunch break</p>
                          </div>
                          <Switch 
                            id="no-lunch" 
                            checked={selectedStaff.noLunch} 
                            onCheckedChange={(val) => updateField('noLunch', val)} 
                          />
                        </div>
                     </div>

                     <div className="border p-3 rounded-md border-violet-200 bg-violet-50/50 dark:border-violet-900 dark:bg-violet-950/30">
                        <div className="flex items-center justify-between">
                          <div>
                            <Label className="cursor-pointer" htmlFor="break-required">Break Required</Label>
                            <p className="text-xs text-muted-foreground">Staff needs a medically necessary break</p>
                          </div>
                          <Switch 
                            id="break-required" 
                            checked={selectedStaff.breakRequired} 
                            onCheckedChange={(val) => {
                              updateField('breakRequired', val);
                              if (val && !selectedStaff.breakDuration) {
                                updateField('breakDuration', 15);
                              }
                              if (!val) {
                                updateField('breakDuration', null);
                              }
                            }} 
                          />
                        </div>
                        {selectedStaff.breakRequired && (
                          <div className="pt-3 mt-3 border-t border-violet-200 dark:border-violet-900 space-y-2 animate-in fade-in slide-in-from-top-2">
                            <Label className="text-sm text-violet-700 dark:text-violet-400">Break Duration</Label>
                            <div className="flex gap-3">
                              <Button 
                                type="button"
                                size="sm"
                                variant={selectedStaff.breakDuration === 15 ? "default" : "outline"}
                                className={selectedStaff.breakDuration === 15 ? "bg-violet-600 hover:bg-violet-700" : ""}
                                onClick={() => updateField('breakDuration', 15)}
                              >
                                15 minutes
                              </Button>
                              <Button 
                                type="button"
                                size="sm"
                                variant={selectedStaff.breakDuration === 30 ? "default" : "outline"}
                                className={selectedStaff.breakDuration === 30 ? "bg-violet-600 hover:bg-violet-700" : ""}
                                onClick={() => updateField('breakDuration', 30)}
                              >
                                30 minutes
                              </Button>
                            </div>
                            <p className="text-xs text-violet-600 dark:text-violet-500">Break will be scheduled during 11:30-12:30 when possible</p>
                          </div>
                        )}
                     </div>
                     
                     <div className="border p-3 rounded-md border-teal-200 bg-teal-50/50 dark:border-teal-900 dark:bg-teal-950/30">
                        <div className="flex items-center justify-between">
                          <div>
                            <Label className="cursor-pointer" htmlFor="no-late-lunches">No Late Lunches</Label>
                            <p className="text-xs text-muted-foreground">Disable mandatory 12:30 lunch when PM starts at 1:00+</p>
                          </div>
                          <Switch 
                            id="no-late-lunches" 
                            checked={selectedStaff.noLateLunches} 
                            onCheckedChange={(val) => updateField('noLateLunches', val)} 
                          />
                        </div>
                        {selectedStaff.noLateLunches && (
                          <div className="pt-3 mt-3 border-t border-teal-200 dark:border-teal-900 space-y-1 animate-in fade-in slide-in-from-top-2">
                            <p className="text-xs text-teal-700 dark:text-teal-400 font-medium">Late lunch rule disabled:</p>
                            <ul className="text-xs text-teal-600 dark:text-teal-500 list-disc list-inside space-y-0.5">
                              <li>Staff can take lunch at any available time</li>
                              <li>May take 11:00 lunch if coverage is fully staffed</li>
                            </ul>
                          </div>
                        )}
                     </div>
                  </div>

                  {selectedStaff.role === 'BT' && (
                    <div className="space-y-2 flex flex-col justify-end pb-2 animate-in fade-in slide-in-from-left-2">
                       <div className="border p-3 rounded-md border-blue-200 bg-blue-50/50 dark:border-blue-900 dark:bg-blue-950/30">
                          <div className="flex items-center justify-between">
                            <div>
                              <Label className="cursor-pointer" htmlFor="non-billable-midday">Non-Billable Midday</Label>
                              <p className="text-xs text-muted-foreground">Can group bill with another client during lunch</p>
                            </div>
                            <Switch 
                              id="non-billable-midday" 
                              checked={selectedStaff.nonBillableMidday} 
                              onCheckedChange={(val) => updateField('nonBillableMidday', val)} 
                            />
                          </div>
                          {selectedStaff.nonBillableMidday && (
                            <div className="pt-3 mt-3 border-t border-blue-200 dark:border-blue-900 space-y-1 animate-in fade-in slide-in-from-top-2">
                              <p className="text-xs text-blue-700 dark:text-blue-400 font-medium">When paired with a billable client, can also cover:</p>
                              <ul className="text-xs text-blue-600 dark:text-blue-500 list-disc list-inside space-y-0.5">
                                <li>A non-billable client during lunch (11:00–12:30)</li>
                                <li>Only if BT is past 60 days or 6 months</li>
                              </ul>
                              <p className="text-xs text-blue-600 dark:text-blue-500 mt-2">Last resort to prevent extended lunches • Tagged as "[Initials] Non-Billable"</p>
                            </div>
                          )}
                       </div>
                    </div>
                  )}

                  {selectedStaff.role === 'Lead RBT' && (
                    <div className="space-y-2 flex flex-col justify-end pb-2 animate-in fade-in slide-in-from-left-2">
                       <div className="border p-3 rounded-md border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/30">
                          <div className="flex items-center justify-between">
                            <div>
                              <Label className="cursor-pointer" htmlFor="not-bt-nonbillable">Not BT Nonbillable Coverage</Label>
                              <p className="text-xs text-muted-foreground">No longer practicing BT/RBT, can only provide nonbillable coverage</p>
                            </div>
                            <Switch 
                              id="not-bt-nonbillable" 
                              checked={selectedStaff.notBtNonbillable} 
                              onCheckedChange={(val) => updateField('notBtNonbillable', val)} 
                            />
                          </div>
                          {selectedStaff.notBtNonbillable && (
                            <div className="pt-3 mt-3 border-t border-amber-200 dark:border-amber-900 space-y-1 animate-in fade-in slide-in-from-top-2">
                              <p className="text-xs text-amber-700 dark:text-amber-400 font-medium">This staff can only be scheduled for:</p>
                              <ul className="text-xs text-amber-600 dark:text-amber-500 list-disc list-inside space-y-0.5">
                                <li>Lunch coverage (11:00–12:30)</li>
                                <li>Emergency coverage when client has no staff</li>
                              </ul>
                              <p className="text-xs text-amber-600 dark:text-amber-500 mt-2">Used as last resort • Requires approval • Tagged as "Nonbillable"</p>
                            </div>
                          )}
                       </div>
                    </div>
                  )}
                </div>
              </section>

              {/* Lead RBT Settings */}
              {selectedStaff.role === 'Lead RBT' && (
                <section className="space-y-4 animate-in fade-in slide-in-from-left-2">
                  <div className="flex items-center gap-2 pb-2 border-b border-border">
                    <Award className="w-5 h-5 text-teal-600" />
                    <h3 className="text-lg font-medium">Lead RBT Settings</h3>
                  </div>
                  <div className="grid gap-6">
                    {/* BX Support Toggle */}
                    <div className="border p-4 rounded-md border-teal-200 bg-teal-50/50 dark:border-teal-900 dark:bg-teal-950/30">
                      <div className="flex items-center justify-between">
                        <div>
                          <Label className="cursor-pointer" htmlFor="bx-support">BX Support?</Label>
                          <p className="text-xs text-muted-foreground">Show client-specific BX support label on schedule</p>
                        </div>
                        <Switch 
                          id="bx-support" 
                          data-testid="switch-bx-support"
                          checked={selectedStaff.bxSupportEnabled} 
                          onCheckedChange={(val) => {
                            updateField('bxSupportEnabled', val);
                            if (!val) {
                              updateField('bxSupportClientId', null);
                            }
                          }} 
                        />
                      </div>
                      {selectedStaff.bxSupportEnabled && (
                        <div className="pt-3 mt-3 border-t border-teal-200 dark:border-teal-900 space-y-2 animate-in fade-in slide-in-from-top-2">
                          <Label className="text-sm">Select Client for BX Support</Label>
                          <Select 
                            value={selectedStaff.bxSupportClientId || "none"} 
                            onValueChange={(val) => updateField('bxSupportClientId', val === "none" ? null : val)}
                          >
                            <SelectTrigger data-testid="select-bx-support-client">
                              <SelectValue placeholder="No client selected (shows 'Lead/BX Support')" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">No client selected</SelectItem>
                              {clientList
                                .filter(c => c.active)
                                .sort((a, b) => a.name.localeCompare(b.name))
                                .map(client => (
                                  <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                          <p className="text-xs text-teal-600 dark:text-teal-400">
                            {selectedStaff.bxSupportClientId 
                              ? `Schedule will show "Lead/${clientList.find(c => c.id === selectedStaff.bxSupportClientId)?.name?.split(' ').map(n => n[0]).join('') || '??'} Support"`
                              : 'Schedule will show "Lead/BX Support"'}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* School Staff Toggle */}
                    <div className="border p-4 rounded-md border-indigo-200 bg-indigo-50/50 dark:border-indigo-900 dark:bg-indigo-950/30">
                      <div className="flex items-center justify-between">
                        <div>
                          <Label className="cursor-pointer" htmlFor="school-staff">School Staff?</Label>
                          <p className="text-xs text-muted-foreground">Assign days at clinic vs school locations</p>
                        </div>
                        <Switch 
                          id="school-staff" 
                          data-testid="switch-school-staff"
                          checked={selectedStaff.isSchoolStaff} 
                          onCheckedChange={(val) => {
                            updateField('isSchoolStaff', val);
                            if (!val) {
                              updateField('schoolAssignments', null);
                            } else if (!selectedStaff.schoolAssignments) {
                              updateField('schoolAssignments', {
                                mon: { location: 'clinic' },
                                tue: { location: 'clinic' },
                                wed: { location: 'clinic' },
                                thu: { location: 'clinic' },
                                fri: { location: 'clinic' },
                              });
                            }
                          }} 
                        />
                      </div>
                      {selectedStaff.isSchoolStaff && (
                        <div className="pt-3 mt-3 border-t border-indigo-200 dark:border-indigo-900 space-y-3 animate-in fade-in slide-in-from-top-2">
                          <p className="text-xs text-indigo-600 dark:text-indigo-400 font-medium">Leads at a school can assist with that school's lunches</p>
                          <div className="grid gap-2">
                            {(['mon', 'tue', 'wed', 'thu', 'fri'] as const).map(day => {
                              const assignments = selectedStaff.schoolAssignments as Record<string, { location: string; schoolId?: string }> | null;
                              const dayAssignment = assignments?.[day] || { location: 'clinic' };
                              return (
                                <div key={day} className="flex items-center gap-3 py-2 border-b border-indigo-100 dark:border-indigo-900 last:border-0">
                                  <span className="w-10 font-medium text-sm capitalize">{day}</span>
                                  <Select 
                                    value={dayAssignment.location}
                                    onValueChange={(val) => {
                                      const updated = { ...assignments, [day]: { location: val, schoolId: val === 'school' ? dayAssignment.schoolId : undefined } };
                                      updateField('schoolAssignments', updated);
                                    }}
                                  >
                                    <SelectTrigger className="w-[100px]" data-testid={`select-school-location-${day}`}>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="clinic">Clinic</SelectItem>
                                      <SelectItem value="school">School</SelectItem>
                                    </SelectContent>
                                  </Select>
                                  {dayAssignment.location === 'school' && (
                                    <Select 
                                      value={dayAssignment.schoolId || ""}
                                      onValueChange={(val) => {
                                        const updated = { ...assignments, [day]: { location: 'school', schoolId: val } };
                                        updateField('schoolAssignments', updated);
                                      }}
                                    >
                                      <SelectTrigger className="flex-1" data-testid={`select-school-id-${day}`}>
                                        <SelectValue placeholder="Select school" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {schoolList
                                          .sort((a, b) => a.name.localeCompare(b.name))
                                          .map(school => (
                                            <SelectItem key={school.id} value={school.id}>{school.name}</SelectItem>
                                          ))}
                                      </SelectContent>
                                    </Select>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* BCBA Prep Toggle - Level 3 only */}
                    {selectedStaff.leadLevel === 3 && (
                      <div className="border p-4 rounded-md border-violet-200 bg-violet-50/50 dark:border-violet-900 dark:bg-violet-950/30">
                        <div className="flex items-center justify-between">
                          <div>
                            <Label className="cursor-pointer" htmlFor="bcba-prep">BCBA Prep</Label>
                            <p className="text-xs text-muted-foreground">Block schedule time for BCBA preparation (cannot be removed for client coverage)</p>
                          </div>
                          <Switch 
                            id="bcba-prep" 
                            data-testid="switch-bcba-prep"
                            checked={selectedStaff.bcbaPrepEnabled} 
                            onCheckedChange={(val) => {
                              updateField('bcbaPrepEnabled', val);
                              if (!val) {
                                updateField('bcbaPrepSchedule', null);
                              } else if (!selectedStaff.bcbaPrepSchedule) {
                                updateField('bcbaPrepSchedule', {
                                  mon: { am: false, pm: false },
                                  tue: { am: false, pm: false },
                                  wed: { am: false, pm: false },
                                  thu: { am: false, pm: false },
                                  fri: { am: false, pm: false },
                                });
                              }
                            }} 
                          />
                        </div>
                        {selectedStaff.bcbaPrepEnabled && (
                          <div className="pt-3 mt-3 border-t border-violet-200 dark:border-violet-900 space-y-3 animate-in fade-in slide-in-from-top-2">
                            <p className="text-xs text-violet-600 dark:text-violet-400 font-medium">BCBA Prep blocks cannot be removed to staff a client (only for Training or DNC)</p>
                            <div className="grid gap-2">
                              <div className="flex items-center gap-3 py-1 border-b border-violet-100 dark:border-violet-900">
                                <span className="w-10"></span>
                                <span className="w-16 text-center text-xs font-medium text-muted-foreground">AM</span>
                                <span className="w-16 text-center text-xs font-medium text-muted-foreground">PM</span>
                              </div>
                              {(['mon', 'tue', 'wed', 'thu', 'fri'] as const).map(day => {
                                const schedule = selectedStaff.bcbaPrepSchedule as Record<string, { am: boolean; pm: boolean }> | null;
                                const daySchedule = schedule?.[day] || { am: false, pm: false };
                                return (
                                  <div key={day} className="flex items-center gap-3 py-2 border-b border-violet-100 dark:border-violet-900 last:border-0">
                                    <span className="w-10 font-medium text-sm capitalize">{day}</span>
                                    <div className="w-16 flex justify-center">
                                      <Switch 
                                        checked={daySchedule.am}
                                        data-testid={`switch-bcba-prep-${day}-am`}
                                        onCheckedChange={(val) => {
                                          const updated = { ...schedule, [day]: { ...daySchedule, am: val } };
                                          updateField('bcbaPrepSchedule', updated);
                                        }}
                                      />
                                    </div>
                                    <div className="w-16 flex justify-center">
                                      <Switch 
                                        checked={daySchedule.pm}
                                        data-testid={`switch-bcba-prep-${day}-pm`}
                                        onCheckedChange={(val) => {
                                          const updated = { ...schedule, [day]: { ...daySchedule, pm: val } };
                                          updateField('bcbaPrepSchedule', updated);
                                        }}
                                      />
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </section>
              )}

              {/* Training */}
              <section className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-border">
                  <User className="w-5 h-5 text-primary" />
                  <h3 className="text-lg font-medium">Training</h3>
                </div>
                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-2">
                     <Label>Hire Date</Label>
                     <Input 
                       type="date" 
                       value={selectedStaff.hireDate || ""} 
                       onChange={(e) => updateField('hireDate', e.target.value)} 
                       data-testid="input-hire-date"
                     />
                     <p className="text-xs text-muted-foreground">Staff are considered New Hires for 30 days after this date</p>
                  </div>

                  <div className="space-y-2 flex flex-col justify-start">
                     <div className="flex items-center justify-between border p-3 rounded-md">
                        <div>
                          <Label className="cursor-pointer" htmlFor="new-hire-override">New Hire Override</Label>
                          <p className="text-xs text-muted-foreground">Disable New Hire training protection</p>
                        </div>
                        <Switch 
                          id="new-hire-override" 
                          checked={selectedStaff.newHireOverride} 
                          onCheckedChange={(val) => updateField('newHireOverride', val)} 
                          data-testid="switch-new-hire-override"
                        />
                     </div>
                  </div>

                  {selectedStaff.role === 'Lead RBT' && (
                    <div className="space-y-2 flex flex-col justify-start animate-in fade-in slide-in-from-left-2">
                       <div className="flex items-center justify-between border p-3 rounded-md border-blue-200 bg-blue-50/50 dark:border-blue-900 dark:bg-blue-950/30">
                          <div>
                            <Label className="cursor-pointer" htmlFor="sign-off-permitted">Sign-Off Permitted</Label>
                            <p className="text-xs text-muted-foreground">Can sign off trainees (Lead RBT only)</p>
                          </div>
                          <Switch 
                            id="sign-off-permitted" 
                            checked={selectedStaff.signOffPermitted} 
                            onCheckedChange={(val) => updateField('signOffPermitted', val)} 
                            data-testid="switch-sign-off-permitted"
                          />
                       </div>
                    </div>
                  )}
                </div>
              </section>

              {/* Certifications - Only show BT Certification Date for BT role */}
              {selectedStaff.role === 'BT' && (
                <section className="space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b border-border">
                    <Award className="w-5 h-5 text-primary" />
                    <h3 className="text-lg font-medium">Certifications</h3>
                  </div>
                  <div className="grid gap-6 md:grid-cols-2">
                    <div className="space-y-2">
                       <Label>BT Certification Date</Label>
                       <Input type="date" value={selectedStaff.btCertificationDate || ""} onChange={(e) => updateField('btCertificationDate', e.target.value)} />
                       <p className="text-xs text-muted-foreground">Used to determine 60-day and 6-month restrictions</p>
                    </div>
                  </div>
                </section>
              )}

              {/* Availability */}
              <section className="space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-border">
                  <div className="flex items-center gap-2">
                    <Clock className="w-5 h-5 text-primary" />
                    <h3 className="text-lg font-medium">Weekly Availability</h3>
                  </div>
                  <Button variant="ghost" size="sm" onClick={copyMondayToAll} className="text-muted-foreground hover:text-primary">
                    <Copy className="w-4 h-4 mr-2" />
                    Copy Mon to All
                  </Button>
                </div>
                
                <div className="space-y-2">
                  {(['mon', 'tue', 'wed', 'thu', 'fri'] as const).map((day) => (
                    <div key={day} className={cn("flex items-center gap-4 p-3 rounded-md border transition-colors", availability[day].enabled ? "bg-card border-border" : "bg-muted/30 border-transparent")}>
                      <div className="w-16 font-medium uppercase text-sm text-muted-foreground">
                        {day}
                      </div>
                      <Switch 
                        checked={availability[day].enabled} 
                        onCheckedChange={(val) => updateAvailability(day, 'enabled', val)}
                      />
                      
                      {availability[day].enabled ? (
                        <div className="flex items-center gap-2 flex-1 animate-in fade-in slide-in-from-left-2 duration-300">
                          <TimeSelect 
                            value={availability[day].start} 
                            onChange={(val) => updateAvailability(day, 'start', val)}
                          />
                          <span className="text-muted-foreground text-sm">to</span>
                          <TimeSelect 
                            value={availability[day].end} 
                            onChange={(val) => updateAvailability(day, 'end', val)}
                          />
                          {pendingApply?.day === day && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs text-primary hover:bg-primary/10 whitespace-nowrap"
                              onClick={handleApplyToRestOfWeek}
                            >
                              Apply to rest of week
                            </Button>
                          )}
                        </div>
                      ) : (
                        <div className="flex-1 text-sm text-muted-foreground italic pl-2">
                          Not available
                        </div>
                      )}

                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => updateAvailability(day, 'enabled', false)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </section>


            </div>
          </ScrollArea>
        </div>
      </div>

      {/* Add Staff Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Add New Staff Member</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="new-staff-name">Staff Name</Label>
            <Input
              id="new-staff-name"
              data-testid="input-new-staff-name"
              value={newStaffName}
              onChange={(e) => setNewStaffName(e.target.value)}
              placeholder="Enter staff name..."
              className="mt-2"
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddStaff();
              }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddStaff} disabled={createMutation.isPending} data-testid="button-confirm-add-staff">
              {createMutation.isPending ? "Adding..." : "Add Staff"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
