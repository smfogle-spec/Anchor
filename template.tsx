import { useState, useMemo, useEffect } from "react";
import Layout from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Save, AlertCircle, AlertTriangle, Info, XCircle, Check, ChevronsUpDown, Scissors, Plus, Trash2, Lock, LockOpen, Eye, X, Users, Coffee, GripVertical } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { type WeeklyTemplate, type WeekDay, type TemplateAssignment as LocalTemplateAssignment, type SplitSegment } from "@/lib/template-data";
import type { Staff, Client, TemplateAssignment, ClientLocation, School } from "@shared/schema";
import { LunchPairingsView } from "@/components/lunch-pairings-view";
import { generateDailySchedule } from "@/lib/schedule-engine";
import { type StaffSchedule, minuteToPercent, durationToPercent, formatMinutesToTime } from "@/lib/schedule-data";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

// Searchable Client Combobox Component
function ClientCombobox({ 
  value, 
  onValueChange, 
  clients,
  showSplitOption = false
}: { 
  value: string; 
  onValueChange: (val: string) => void; 
  clients: Client[];
  showSplitOption?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const selectedClient = clients.find(c => c.id === value);
  const isSplit = value === "split";
  
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full h-9 justify-between text-sm font-normal",
            value === "unassigned" ? "text-muted-foreground" : "font-medium",
            isSplit && "bg-primary/10 border-primary text-primary"
          )}
        >
          <span className="truncate flex items-center gap-1">
            {isSplit && <Scissors className="h-3 w-3" />}
            {value === "unassigned" ? "Unassigned" : isSplit ? "Split" : selectedClient?.name || "Unassigned"}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search clients..." />
          <CommandList>
            <CommandEmpty>No client found.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value="unassigned"
                onSelect={() => {
                  onValueChange("unassigned");
                  setOpen(false);
                }}
              >
                <Check className={cn("mr-2 h-4 w-4", value === "unassigned" ? "opacity-100" : "opacity-0")} />
                <span className="text-muted-foreground italic">Unassigned</span>
              </CommandItem>
              {showSplitOption && (
                <CommandItem
                  value="split"
                  onSelect={() => {
                    onValueChange("split");
                    setOpen(false);
                  }}
                >
                  <Check className={cn("mr-2 h-4 w-4", value === "split" ? "opacity-100" : "opacity-0")} />
                  <span className="flex items-center gap-1 text-primary font-medium">
                    <Scissors className="h-3 w-3" /> Split
                  </span>
                </CommandItem>
              )}
              {clients.map(client => (
                <CommandItem
                  key={client.id}
                  value={client.name}
                  onSelect={() => {
                    onValueChange(client.id);
                    setOpen(false);
                  }}
                >
                  <Check className={cn("mr-2 h-4 w-4", value === client.id ? "opacity-100" : "opacity-0")} />
                  {client.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// Compact searchable client picker for split segments
function SplitClientPicker({
  value,
  onValueChange,
  clients,
  staffRole
}: {
  value: string;
  onValueChange: (val: string) => void;
  clients: Client[];
  staffRole?: string;
}) {
  const [open, setOpen] = useState(false);
  const selectedClient = clients.find(c => c.id === value);
  const isUnassigned = value === "unassigned";
  const isDrive = value === "drive";
  
  const getUnassignedLabel = () => {
    if (staffRole === "Lead RBT") return "Lead/BX Support";
    return "On Call";
  };
  
  const displayLabel = isDrive
    ? "Drive"
    : isUnassigned 
      ? getUnassignedLabel() 
      : (selectedClient?.name || "Client");
  
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "h-7 w-28 justify-between text-xs font-normal px-2",
            isUnassigned && "text-muted-foreground italic",
            isDrive && "text-amber-600 font-medium"
          )}
          data-testid="split-client-picker"
        >
          <span className="truncate">{displayLabel}</span>
          <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[180px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search..." className="h-8 text-xs" />
          <CommandList className="max-h-48">
            <CommandEmpty>No client found.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value="unassigned"
                onSelect={() => {
                  onValueChange("unassigned");
                  setOpen(false);
                }}
                className="text-xs italic text-muted-foreground"
              >
                <Check className={cn("mr-2 h-3 w-3", isUnassigned ? "opacity-100" : "opacity-0")} />
                {getUnassignedLabel()}
              </CommandItem>
              <CommandItem
                value="drive"
                onSelect={() => {
                  onValueChange("drive");
                  setOpen(false);
                }}
                className="text-xs text-amber-600 font-medium"
              >
                <Check className={cn("mr-2 h-3 w-3", isDrive ? "opacity-100" : "opacity-0")} />
                Drive
              </CommandItem>
              {clients.map(client => (
                <CommandItem
                  key={client.id}
                  value={client.name}
                  onSelect={() => {
                    onValueChange(client.id);
                    setOpen(false);
                  }}
                  className="text-xs"
                >
                  <Check className={cn("mr-2 h-3 w-3", value === client.id ? "opacity-100" : "opacity-0")} />
                  {client.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// Compact searchable time picker for split segments
function SplitTimePicker({
  value,
  onValueChange,
  options,
  placeholder
}: {
  value: number | undefined;
  onValueChange: (val: number) => void;
  options: { value: number; label: string }[];
  placeholder: string;
}) {
  const [open, setOpen] = useState(false);
  const selectedOption = options.find(o => o.value === value);
  
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="h-7 w-24 justify-between text-xs font-normal px-2"
          data-testid="split-time-picker"
        >
          <span className="truncate">{selectedOption?.label || placeholder}</span>
          <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[140px] p-0" align="start" side="bottom" sideOffset={4}>
        <Command>
          <CommandInput placeholder="Type time..." className="h-8 text-xs" />
          <CommandList className="max-h-[200px] overflow-y-auto">
            <CommandEmpty>No time found.</CommandEmpty>
            <CommandGroup>
              {options.map(opt => (
                <CommandItem
                  key={opt.value}
                  value={opt.label}
                  onSelect={() => {
                    onValueChange(opt.value);
                    setOpen(false);
                  }}
                  className="text-xs"
                >
                  <Check className={cn("mr-2 h-3 w-3", value === opt.value ? "opacity-100" : "opacity-0")} />
                  {opt.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// Searchable scrollable time picker for block assignments (when client has multiple locations)
function BlockTimeCombobox({
  value,
  onValueChange,
  options,
  placeholder,
  testId
}: {
  value: number | undefined | null;
  onValueChange: (val: number) => void;
  options: { value: number; label: string }[];
  placeholder: string;
  testId?: string;
}) {
  const [open, setOpen] = useState(false);
  const selectedOption = options.find(o => o.value === value);
  
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="h-7 flex-1 justify-between text-xs font-normal px-2"
          data-testid={testId}
        >
          <span className="truncate">{selectedOption?.label || placeholder}</span>
          <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[130px] p-0" align="start" side="bottom" sideOffset={4}>
        <Command>
          <CommandInput placeholder="Type time..." className="h-8 text-xs" />
          <CommandList className="max-h-[200px] overflow-y-auto">
            <CommandEmpty>No time found.</CommandEmpty>
            <CommandGroup>
              {options.map(opt => (
                <CommandItem
                  key={opt.value}
                  value={opt.label}
                  onSelect={() => {
                    onValueChange(opt.value);
                    setOpen(false);
                  }}
                  className="text-xs"
                >
                  <Check className={cn("mr-2 h-3 w-3", value === opt.value ? "opacity-100" : "opacity-0")} />
                  {opt.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// Searchable scrollable location picker
function LocationCombobox({
  value,
  onValueChange,
  locations,
  testId
}: {
  value: string | null | undefined;
  onValueChange: (val: string) => void;
  locations: { id: string; displayName: string | null; locationType: string; isPrimary: boolean }[];
  testId?: string;
}) {
  const [open, setOpen] = useState(false);
  const selectedLoc = locations.find(l => l.id === value);
  const getLabel = (loc: typeof locations[0]) => {
    const name = loc.displayName || loc.locationType.charAt(0).toUpperCase() + loc.locationType.slice(1);
    return loc.isPrimary ? `${name} (Primary)` : name;
  };
  
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="h-7 w-full justify-between text-xs font-normal px-2"
          data-testid={testId}
        >
          <span className="truncate">{selectedLoc ? getLabel(selectedLoc) : "Select location"}</span>
          <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0" align="start" side="bottom" sideOffset={4}>
        <Command>
          <CommandInput placeholder="Type to search..." className="h-8 text-xs" />
          <CommandList className="max-h-[200px] overflow-y-auto">
            <CommandEmpty>No location found.</CommandEmpty>
            <CommandGroup>
              {locations.map(loc => (
                <CommandItem
                  key={loc.id}
                  value={getLabel(loc)}
                  onSelect={() => {
                    onValueChange(loc.id);
                    setOpen(false);
                  }}
                  className="text-xs"
                >
                  <Check className={cn("mr-2 h-3 w-3", value === loc.id ? "opacity-100" : "opacity-0")} />
                  {getLabel(loc)}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// Helper to get client service end time in minutes from midnight
const getClientServiceEndMinute = (client: Client | undefined, day: WeekDay): number => {
  if (!client) return 960; // Default to 4:00 PM
  const schedule = client.schedule as Record<string, { enabled: boolean; start: string; end: string }>;
  const daySchedule = schedule?.[day];
  if (!daySchedule?.enabled || !daySchedule.end) return 960;
  
  const [hours, mins] = daySchedule.end.split(':').map(Number);
  return hours * 60 + (mins || 0);
};

// Helper to get client service start time in minutes from midnight
const getClientServiceStartMinute = (client: Client | undefined, day: WeekDay): number => {
  if (!client) return 510; // Default to 8:30 AM
  const schedule = client.schedule as Record<string, { enabled: boolean; start: string; end: string }>;
  const daySchedule = schedule?.[day];
  if (!daySchedule?.enabled || !daySchedule.start) return 510;
  
  const [hours, mins] = daySchedule.start.split(':').map(Number);
  return hours * 60 + (mins || 0);
};

// Split Editor Component
function SplitEditor({
  segments,
  onSegmentsChange,
  clients,
  block,
  onClose,
  onDone,
  staffRole,
  day
}: {
  segments: SplitSegment[];
  onSegmentsChange: (segments: SplitSegment[]) => void;
  clients: Client[];
  block: "am" | "pm";
  onClose: () => void;
  onDone?: () => void;
  staffRole?: string;
  day: WeekDay;
}) {
  // Generate 15-minute time options
  const generateTimeOptions = () => {
    const options: { value: number; label: string }[] = [];
    const startHour = block === "am" ? 7 : 12;
    const endHour = block === "am" ? 13 : 18; // Extended to allow flexibility
    
    for (let hour = startHour; hour <= endHour; hour++) {
      for (let min = 0; min < 60; min += 15) {
        if (hour === endHour && min > 0) break;
        const totalMinutes = hour * 60 + min;
        const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
        const ampm = hour >= 12 ? "PM" : "AM";
        const label = `${displayHour}:${min.toString().padStart(2, '0')} ${ampm}`;
        options.push({ value: totalMinutes, label });
      }
    }
    return options;
  };

  const timeOptions = generateTimeOptions();

  const addSegment = () => {
    // Auto-populate start time from previous segment's end time
    const lastEnd = segments.length > 0 ? segments[segments.length - 1].endMinute : (block === "am" ? 510 : 750); // 8:30 AM or 12:30 PM
    
    // For PM block, try to use first segment's client service end time as default end
    let defaultEnd = Math.min(lastEnd + 60, block === "am" ? 720 : 1020); // Default: +1hr or block end
    
    // If PM block and we have segments, use the first segment's client service end time
    if (block === "pm" && segments.length > 0) {
      const firstSegmentClient = clients.find(c => c.id === segments[0].clientId);
      if (firstSegmentClient) {
        const serviceEnd = getClientServiceEndMinute(firstSegmentClient, day);
        if (serviceEnd > lastEnd) {
          defaultEnd = serviceEnd;
        }
      }
    }
    
    onSegmentsChange([
      ...segments,
      { clientId: "", startMinute: lastEnd, endMinute: defaultEnd }
    ]);
  };

  const updateSegment = (index: number, updates: Partial<SplitSegment>) => {
    const newSegments = [...segments];
    newSegments[index] = { ...newSegments[index], ...updates };
    
    // When updating end time of a segment, cascade to next segment's start time
    if (updates.endMinute !== undefined && index < newSegments.length - 1) {
      newSegments[index + 1] = {
        ...newSegments[index + 1],
        startMinute: updates.endMinute
      };
    }
    
    // When selecting a client for PM segment, auto-populate end time with client's service end
    if (updates.clientId && block === "pm" && updates.clientId !== "unassigned") {
      const client = clients.find(c => c.id === updates.clientId);
      if (client) {
        const serviceEnd = getClientServiceEndMinute(client, day);
        // Only update if it's the last segment or if the service end is reasonable
        if (index === newSegments.length - 1) {
          newSegments[index] = {
            ...newSegments[index],
            endMinute: serviceEnd
          };
        }
      }
    }
    
    onSegmentsChange(newSegments);
  };

  const removeSegment = (index: number) => {
    onSegmentsChange(segments.filter((_, i) => i !== index));
  };

  return (
    <div className="mt-2 p-3 bg-primary/5 border border-primary/20 rounded-lg space-y-3" data-testid="split-editor">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-primary flex items-center gap-1">
          <Scissors className="h-3 w-3" /> Split Segments
        </span>
        <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={onClose}>
          Cancel Split
        </Button>
      </div>
      
      {segments.map((segment, index) => (
        <div key={index} className="flex items-center gap-2 flex-wrap" data-testid={`split-segment-${index}`}>
          <SplitClientPicker
            value={segment.clientId || ""}
            onValueChange={(val) => updateSegment(index, { clientId: val })}
            clients={clients}
            staffRole={staffRole}
          />
          
          <SplitTimePicker
            value={segment.startMinute}
            onValueChange={(val) => updateSegment(index, { startMinute: val })}
            options={timeOptions}
            placeholder="Start"
          />
          
          <span className="text-xs text-muted-foreground">-</span>
          
          <SplitTimePicker
            value={segment.endMinute}
            onValueChange={(val) => updateSegment(index, { endMinute: val })}
            options={timeOptions}
            placeholder="End"
          />
          
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10"
            onClick={() => removeSegment(index)}
            data-testid={`split-remove-${index}`}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      ))}
      
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs flex-1"
          onClick={addSegment}
          data-testid="add-split-segment"
        >
          <Plus className="h-3 w-3 mr-1" /> Add Segment
        </Button>
        {onDone && segments.length >= 2 && segments.every(s => s.clientId && s.startMinute !== undefined && s.endMinute !== undefined) && (
          <Button
            variant="default"
            size="sm"
            className="h-7 text-xs"
            onClick={onDone}
            data-testid="split-done"
          >
            <Check className="h-3 w-3 mr-1" /> Done
          </Button>
        )}
      </div>
    </div>
  );
}

// Helper to check for duplicate client assignments in a block
// Check for overlapping client assignments within a block
// Only flags as duplicate if time ranges actually overlap (not just same client)
const findDuplicateClientAssignments = (assignments: LocalTemplateAssignment[], block: "am" | "pm") => {
  // Default block windows
  const defaultStart = block === "am" ? 450 : 750; // 7:30 AM or 12:30 PM
  const defaultEnd = block === "am" ? 690 : 990;   // 11:30 AM or 4:30 PM
  
  // Extract all time intervals per client
  type TimeInterval = { start: number; end: number; staffId: string };
  const clientIntervals = new Map<string, TimeInterval[]>();
  
  assignments.forEach(a => {
    if (a.clientId === "split" && a.segments) {
      // Split assignment - extract each segment's time range
      // For splits, use adjacent segment boundaries to infer missing times
      const sortedSegments = [...a.segments].sort((x, y) => (x.startMinute ?? 0) - (y.startMinute ?? 0));
      
      sortedSegments.forEach((seg, idx) => {
        if (seg.clientId && seg.clientId !== "unassigned" && seg.clientId !== "drive") {
          // Infer start from previous segment's end, or block start
          const inferredStart = seg.startMinute ?? 
            (idx > 0 ? sortedSegments[idx - 1].endMinute : undefined) ?? 
            defaultStart;
          
          // Infer end from next segment's start, or block end
          const inferredEnd = seg.endMinute ?? 
            (idx < sortedSegments.length - 1 ? sortedSegments[idx + 1].startMinute : undefined) ?? 
            defaultEnd;
          
          const intervals = clientIntervals.get(seg.clientId) || [];
          intervals.push({
            start: inferredStart,
            end: inferredEnd,
            staffId: a.staffId
          });
          clientIntervals.set(seg.clientId, intervals);
        }
      });
    } else if (a.clientId && a.clientId !== "unassigned" && a.clientId !== "drive" && a.clientId !== "split") {
      // Regular assignment - use explicit times or block defaults
      const intervals = clientIntervals.get(a.clientId) || [];
      intervals.push({
        start: a.startMinute ?? defaultStart,
        end: a.endMinute ?? defaultEnd,
        staffId: a.staffId
      });
      clientIntervals.set(a.clientId, intervals);
    }
  });
  
  // Check for overlapping intervals per client
  const duplicates: string[] = [];
  
  clientIntervals.forEach((intervals, clientId) => {
    if (intervals.length <= 1) return;
    
    // Sort by start time
    intervals.sort((a, b) => a.start - b.start);
    
    // Check for overlaps (same staff covering same client twice, or different staff with overlapping times)
    for (let i = 0; i < intervals.length - 1; i++) {
      const current = intervals[i];
      const next = intervals[i + 1];
      
      // Overlap if next starts BEFORE current ends (not equal - adjacent is OK)
      if (next.start < current.end) {
        duplicates.push(clientId);
        break; // Only add once per client
      }
    }
  });
  
  return duplicates;
};

// Helper to check for missing client coverage (respects client schedule)
// Accounts for: AM assignments extending into PM, clients in split segments
const findMissingClientCoverage = (amAssignments: LocalTemplateAssignment[], pmAssignments: LocalTemplateAssignment[], allClients: Client[], day: WeekDay) => {
  const missing = {
    am: [] as string[],
    pm: [] as string[]
  };
  
  const activeClients = allClients.filter(c => c.active);
  
  // Helper to check if client is covered in assignments (including splits)
  const isClientCovered = (assignments: LocalTemplateAssignment[], clientId: string, checkExtendedCoverage = false) => {
    for (const a of assignments) {
      // Direct assignment match
      if (a.clientId === clientId) {
        // If checking extended coverage (AM extending into PM), check endMinute
        if (checkExtendedCoverage && a.endMinute != null) {
          // AM assignment extends into PM if it ends at or after 12:30 PM (750 minutes)
          return a.endMinute >= 750;
        }
        return true;
      }
      // Check split segments
      if (a.clientId === 'split' && a.segments) {
        for (const seg of a.segments) {
          if (seg.clientId === clientId) {
            if (checkExtendedCoverage && seg.endMinute != null) {
              return seg.endMinute >= 750;
            }
            return true;
          }
        }
      }
    }
    return false;
  };
  
  activeClients.forEach(client => {
    const schedule = client.schedule as Record<string, { enabled: boolean; start: string; end: string }>;
    const daySchedule = schedule?.[day];
    
    // Skip clients not scheduled on this day
    if (!daySchedule?.enabled) return;
    
    // Parse start/end times to determine AM/PM needs
    const startHour = parseInt(daySchedule.start?.split(':')[0] || '9', 10);
    const startMin = parseInt(daySchedule.start?.split(':')[1] || '0', 10);
    const endHour = parseInt(daySchedule.end?.split(':')[0] || '16', 10);
    const endMin = parseInt(daySchedule.end?.split(':')[1] || '0', 10);
    
    // Convert to minutes from midnight for precise comparison
    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;
    
    // Client needs AM coverage if they start before noon (720 minutes)
    const needsAm = startMinutes < 720;
    
    // Client needs PM coverage only if they end at or after 1:00 PM (780 minutes)
    // Clients ending before 1:00 PM can be fully covered by AM staff billing through
    const needsPm = endMinutes >= 780;
    
    // Check AM coverage (including splits)
    const hasAm = isClientCovered(amAssignments, client.id);
    
    // Check PM coverage: either direct PM assignment, in a PM split, OR AM assignment extends into PM
    const hasPmDirect = isClientCovered(pmAssignments, client.id);
    const hasAmExtendingIntoPm = isClientCovered(amAssignments, client.id, true);
    const hasPm = hasPmDirect || hasAmExtendingIntoPm;
    
    if (needsAm && !hasAm) missing.am.push(client.id);
    if (needsPm && !hasPm) missing.pm.push(client.id);
  });
  
  return missing;
};

// Helper to convert flat assignments to nested WeeklyTemplate structure
const buildTemplateFromAssignments = (assignments: TemplateAssignment[]): WeeklyTemplate => {
  const template: WeeklyTemplate = {
    mon: { am: [], pm: [] },
    tue: { am: [], pm: [] },
    wed: { am: [], pm: [] },
    thu: { am: [], pm: [] },
    fri: { am: [], pm: [] },
  };
  
  // Group assignments by staff/day/block to detect splits
  const grouped = new Map<string, TemplateAssignment[]>();
  
  assignments.forEach(a => {
    const key = `${a.weekDay}-${a.timeBlock.toLowerCase()}-${a.staffId}`;
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key)!.push(a);
  });
  
  // Process grouped assignments
  grouped.forEach((staffAssignments, key) => {
    const [day, block] = key.split('-') as [WeekDay, "am" | "pm"];
    const staffId = staffAssignments[0].staffId;
    
    // Only treat as split if there are multiple assignments AND they have time ranges
    // (indicating intentional splits vs. just multiple clients by mistake)
    const hasSplitIndicators = staffAssignments.length > 1 && 
      staffAssignments.every(a => a.startMinute != null && a.endMinute != null);
    
    if (hasSplitIndicators) {
      // Multiple assignments with time ranges = split
      // Convert null clientId to "unassigned" for On Call / Lead/BX Support display
      // Detect isDrive flag and convert to "drive" clientId
      const segments: SplitSegment[] = staffAssignments.map(a => {
        const isDriveSegment = a.isDrive === true;
        return {
          clientId: isDriveSegment ? "drive" : (a.clientId || "unassigned"),
          locationId: a.locationId,
          startMinute: a.startMinute || 0,
          endMinute: a.endMinute || 0
        };
      }).sort((a, b) => a.startMinute - b.startMinute);
      
      // Use isLocked from first assignment (all segments share the same lock state)
      template[day][block].push({
        staffId,
        clientId: "split",
        segments,
        isLocked: staffAssignments[0].isLocked || false
      });
    } else if (staffAssignments.length > 1) {
      // Multiple assignments without time ranges - add them all separately
      staffAssignments.forEach(a => {
        template[day][block].push({
          staffId: a.staffId,
          clientId: a.clientId,
          locationId: a.locationId,
          startMinute: a.startMinute,
          endMinute: a.endMinute,
          isLocked: a.isLocked || false
        });
      });
    } else {
      // Single assignment
      const a = staffAssignments[0];
      template[day][block].push({
        staffId: a.staffId,
        clientId: a.clientId,
        locationId: a.locationId,
        startMinute: a.startMinute,
        endMinute: a.endMinute,
        isLocked: a.isLocked || false
      });
    }
  });
  
  return template;
};

// Helper to convert nested WeeklyTemplate to flat assignments
const buildAssignmentsFromTemplate = (template: WeeklyTemplate): Array<{weekDay: string, timeBlock: string, staffId: string, clientId: string | null, locationId?: string | null, startMinute?: number | null, endMinute?: number | null, isLocked?: boolean, isDrive?: boolean}> => {
  const assignments: Array<{weekDay: string, timeBlock: string, staffId: string, clientId: string | null, locationId?: string | null, startMinute?: number | null, endMinute?: number | null, isLocked?: boolean, isDrive?: boolean}> = [];
  
  const processAssignment = (a: LocalTemplateAssignment, day: WeekDay, block: "AM" | "PM") => {
    // Handle split assignments - expand segments into multiple rows
    if (a.clientId === "split" && a.segments && a.segments.length > 0) {
      a.segments.forEach(segment => {
        // Include segments with a client selected OR unassigned (for On Call / Lead/BX Support) OR drive
        if (segment.clientId) {
          // Convert "unassigned" and "drive" to null for database storage
          // Use isDrive flag for drive segments
          const isDriveSegment = segment.clientId === "drive";
          const normalizedClientId = (segment.clientId === "unassigned" || isDriveSegment) ? null : segment.clientId;
          assignments.push({
            weekDay: day,
            timeBlock: block,
            staffId: a.staffId,
            clientId: normalizedClientId,
            locationId: segment.locationId || null,
            startMinute: segment.startMinute,
            endMinute: segment.endMinute,
            isLocked: a.isLocked,
            isDrive: isDriveSegment
          });
        }
      });
    } else {
      // Normal single-client assignment
      // Convert "unassigned" to null for database storage
      const normalizedClientId = a.clientId === "unassigned" ? null : a.clientId;
      assignments.push({ 
        weekDay: day, 
        timeBlock: block, 
        staffId: a.staffId, 
        clientId: normalizedClientId,
        locationId: a.locationId,
        startMinute: a.startMinute,
        endMinute: a.endMinute,
        isLocked: a.isLocked
      });
    }
  };
  
  (Object.keys(template) as WeekDay[]).forEach(day => {
    template[day].am.forEach(a => processAssignment(a, day, "AM"));
    template[day].pm.forEach(a => processAssignment(a, day, "PM"));
  });
  
  return assignments;
};

type TemplateView = "assignments" | "lunchPairings";

export default function Template() {
  const [template, setTemplate] = useState<WeeklyTemplate | null>(null);
  const [activeTab, setActiveTab] = useState<WeekDay>("mon");
  const [activeView, setActiveView] = useState<TemplateView>("assignments");
  const [pendingApply, setPendingApply] = useState<{ day: WeekDay; block: 'am' | 'pm'; staffId: string; clientId: string | null; locationId?: string | null; startMinute?: number; endMinute?: number; segments?: SplitSegment[]; selectedDays: WeekDay[] } | null>(null);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [previewDay, setPreviewDay] = useState<WeekDay | null>(null);
  const [previewSchedule, setPreviewSchedule] = useState<StaffSchedule[]>([]);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch staff
  const { data: staffList = [] } = useQuery<Staff[]>({
    queryKey: ["/api/staff"],
    queryFn: async () => {
      const response = await fetch("/api/staff");
      if (!response.ok) throw new Error("Failed to fetch staff");
      return response.json();
    },
  });

  // Fetch clients
  const { data: clientList = [] } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
    queryFn: async () => {
      const response = await fetch("/api/clients");
      if (!response.ok) throw new Error("Failed to fetch clients");
      return response.json();
    },
  });

  // Fetch all client locations
  const { data: allClientLocations = [] } = useQuery<ClientLocation[]>({
    queryKey: ["/api/client-locations"],
    queryFn: async () => {
      const response = await fetch("/api/client-locations");
      if (!response.ok) throw new Error("Failed to fetch client locations");
      return response.json();
    },
  });

  // Group locations by client ID
  const locationsByClient = useMemo(() => {
    const map = new Map<string, ClientLocation[]>();
    allClientLocations.forEach(loc => {
      const existing = map.get(loc.clientId) || [];
      existing.push(loc);
      map.set(loc.clientId, existing);
    });
    return map;
  }, [allClientLocations]);

  // Fetch schools (needed for preview generation)
  const { data: schools = [] } = useQuery<School[]>({
    queryKey: ["/api/schools"],
    queryFn: async () => {
      const response = await fetch("/api/schools");
      if (!response.ok) throw new Error("Failed to fetch schools");
      return response.json();
    },
  });

  // Fetch template assignments
  const { data: templateAssignments = [], isLoading } = useQuery<TemplateAssignment[]>({
    queryKey: ["/api/template"],
    queryFn: async () => {
      const response = await fetch("/api/template");
      if (!response.ok) throw new Error("Failed to fetch template");
      return response.json();
    },
  });

  // Save template mutation with focus staff updates
  const saveMutation = useMutation({
    mutationFn: async (data: {
      assignments: Array<{weekDay: string, timeBlock: string, staffId: string, clientId: string | null, locationId?: string | null, startMinute?: number | null, endMinute?: number | null, isLocked?: boolean, isDrive?: boolean}>;
      focusUpdates: Array<{ clientId: string; staffIdsToAdd: string[] }>;
    }) => {
      const response = await fetch("/api/template/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        // Try to get error details from server response
        let errorMessage = "Failed to save template";
        try {
          const errorData = await response.json();
          if (errorData.error) {
            errorMessage = errorData.error;
          }
          if (errorData.details) {
            console.error("Save error details:", errorData.details);
          }
        } catch {
          // If we can't parse JSON, use status text
          errorMessage = `Save failed: ${response.status} ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }
      return response.json() as Promise<{ assignments: any[]; focusUpdatesApplied: number }>;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["/api/template"] });
      if (result.focusUpdatesApplied > 0) {
        queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
        toast({
          title: "Template Saved",
          description: `Baseline schedule updated. ${result.focusUpdatesApplied} staff automatically added to focus lists.`,
        });
      } else {
        toast({
          title: "Template Saved",
          description: "Baseline schedule updated successfully.",
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save template. Please try again.",
        variant: "destructive",
      });
    },
    retry: false, // Don't auto-retry on failure
  });

  // Generate preview schedule for a specific day
  const handleGeneratePreview = (day: WeekDay) => {
    if (!template || !staffList || !clientList) return;
    
    const dayIndex = day === 'mon' ? 1 : day === 'tue' ? 2 : day === 'wed' ? 3 : day === 'thu' ? 4 : 5;
    
    try {
      const result = generateDailySchedule(
        [],
        {
          staff: staffList,
          clients: clientList,
          templateAssignments: templateAssignments,
          clientLocations: allClientLocations,
          schools: schools,
        },
        [],
        dayIndex
      );
      
      setPreviewSchedule(result.schedule);
      setPreviewDay(day);
      setPreviewDialogOpen(true);
    } catch (error) {
      console.error("Failed to generate preview:", error);
      toast({
        title: "Preview Error",
        description: "Could not generate preview schedule",
        variant: "destructive",
      });
    }
  };

  // Build template from assignments when data loads
  // Always build template, even if empty, to prevent infinite loading
  useEffect(() => {
    // Build set of valid client IDs for filtering out deleted clients
    const validClientIds = new Set(clientList.map(c => c.id));
    
    // Filter out assignments with deleted client IDs before building template
    const filteredAssignments = templateAssignments.filter(a => {
      // Keep assignments with null clientId (unassigned/drive) or valid clientId
      if (!a.clientId) return true;
      if (validClientIds.has(a.clientId)) return true;
      console.warn(`Filtering out template assignment with deleted client: ${a.clientId}`);
      return false;
    });
    
    const rawTemplate = buildTemplateFromAssignments(filteredAssignments);
    
    // AM/PM block time constants for availability check
    const AM_END = 690;   // 11:30 AM
    const AM_START = 450; // 7:30 AM
    const PM_END = 990;   // 4:30 PM
    const PM_START = 750; // 12:30 PM
    
    // Clean up any assignments for unavailable blocks based on staff availability
    if (staffList.length > 0) {
      (Object.keys(rawTemplate) as WeekDay[]).forEach(day => {
        (['am', 'pm'] as const).forEach(block => {
          rawTemplate[day][block] = rawTemplate[day][block].filter(assignment => {
            const staff = staffList.find(s => s.id === assignment.staffId);
            if (!staff) return true; // Keep if staff not found (edge case)
            
            const availability = staff.availability as Record<string, { enabled: boolean; start: string; end: string }>;
            const dayAvail = availability?.[day];
            
            // If not enabled for this day, remove
            if (!dayAvail?.enabled) return false;
            
            // Parse staff availability times
            const [startHour, startMin] = (dayAvail.start || "08:00").split(':').map(Number);
            const [endHour, endMin] = (dayAvail.end || "16:00").split(':').map(Number);
            const staffStartMinute = startHour * 60 + (startMin || 0);
            const staffEndMinute = endHour * 60 + (endMin || 0);
            
            if (block === 'am') {
              return staffStartMinute < AM_END && staffEndMinute > AM_START;
            } else {
              return staffStartMinute < PM_END && staffEndMinute > PM_START;
            }
          });
        });
      });
    }
    
    setTemplate(rawTemplate);
  }, [templateAssignments, staffList, clientList]);

  const handleAssignmentChange = (
    day: WeekDay, 
    block: "am" | "pm", 
    staffId: string, 
    clientId: string | "unassigned",
    locationId?: string | null
  ) => {
    if (!template) return;
    
    const newTemplate = { ...template };
    const currentAssignments = [...newTemplate[day][block]];
    
    const existingIndex = currentAssignments.findIndex(a => a.staffId === staffId);
    const newValue = clientId === "unassigned" ? null : clientId;
    
    // Handle "split" selection - initialize with empty segments
    if (clientId === "split") {
      const defaultStartMinute = block === "am" ? 420 : 720; // 7:00 AM or 12:00 PM
      const defaultEndMinute = block === "am" ? 720 : 1050; // 12:00 PM or 5:30 PM
      const initialSegments: SplitSegment[] = [
        { clientId: "", startMinute: defaultStartMinute, endMinute: defaultStartMinute + 90 },
        { clientId: "", startMinute: defaultStartMinute + 90, endMinute: defaultEndMinute }
      ];
      
      if (existingIndex >= 0) {
        const existingLock = currentAssignments[existingIndex].isLocked;
        currentAssignments[existingIndex] = { 
          staffId, 
          clientId: "split",
          segments: initialSegments,
          isLocked: existingLock
        };
      } else {
        currentAssignments.push({ 
          staffId, 
          clientId: "split",
          segments: initialSegments
        });
      }
      
      newTemplate[day][block] = currentAssignments;
      setTemplate(newTemplate);
      return;
    }
    
    // Auto-select primary location if client has locations and no location specified
    let finalLocationId = locationId;
    if (newValue && finalLocationId === undefined) {
      const clientLocs = locationsByClient.get(newValue);
      if (clientLocs && clientLocs.length > 0) {
        const primary = clientLocs.find(l => l.isPrimary);
        finalLocationId = primary?.id || clientLocs[0].id;
      }
    }

    if (existingIndex >= 0) {
      const existingLock = currentAssignments[existingIndex].isLocked;
      currentAssignments[existingIndex] = { 
        staffId, 
        clientId: newValue,
        locationId: finalLocationId || null,
        segments: undefined, // Clear segments when switching away from split
        isLocked: existingLock
      };
    } else {
      currentAssignments.push({ 
        staffId, 
        clientId: newValue,
        locationId: finalLocationId || null
      });
    }
    
    newTemplate[day][block] = currentAssignments;
    setTemplate(newTemplate);
    
    // Track for "Apply to other days" - default to remaining days of the week
    const days: WeekDay[] = ['mon', 'tue', 'wed', 'thu', 'fri'];
    const startIndex = days.indexOf(day);
    const remainingDays = days.slice(startIndex + 1);
    setPendingApply({ day, block, staffId, clientId: newValue, locationId: finalLocationId || null, selectedDays: remainingDays });
  };
  
  const handleLocationChange = (
    day: WeekDay, 
    block: "am" | "pm", 
    staffId: string, 
    locationId: string | null
  ) => {
    if (!template) return;
    
    const newTemplate = { ...template };
    const currentAssignments = [...newTemplate[day][block]];
    
    const existingIndex = currentAssignments.findIndex(a => a.staffId === staffId);
    if (existingIndex >= 0) {
      currentAssignments[existingIndex] = { 
        ...currentAssignments[existingIndex],
        locationId
      };
      newTemplate[day][block] = currentAssignments;
      setTemplate(newTemplate);
    }
  };

  // Centralized helper to check if staff can work a block based on their availability
  // AM window: 7:30-11:30 (450-690 minutes) - staff must have overlap
  // PM window: 12:30-4:30 (750-990 minutes) - staff must have overlap
  const checkStaffAvailability = (staff: Staff, day: WeekDay, block: "am" | "pm"): boolean => {
    const availability = staff.availability as Record<string, { enabled: boolean; start: string; end: string }>;
    const dayAvail = availability?.[day];
    
    // If not enabled for this day, not available
    if (!dayAvail?.enabled) return false;
    
    // Parse staff availability times
    const [startHour, startMin] = (dayAvail.start || "08:00").split(':').map(Number);
    const [endHour, endMin] = (dayAvail.end || "16:00").split(':').map(Number);
    const staffStartMinute = startHour * 60 + (startMin || 0);
    const staffEndMinute = endHour * 60 + (endMin || 0);
    
    // AM/PM block time constants
    const AM_END = 690;   // 11:30 AM
    const AM_START = 450; // 7:30 AM
    const PM_END = 990;   // 4:30 PM
    const PM_START = 750; // 12:30 PM
    
    if (block === "am") {
      // Staff must start before 11:30 AM and end after 7:30 AM
      return staffStartMinute < AM_END && staffEndMinute > AM_START;
    } else {
      // Staff must start before 4:30 PM and end after 12:30 PM
      return staffStartMinute < PM_END && staffEndMinute > PM_START;
    }
  };
  
  // Alias for use in JSX and other locations
  const isStaffAvailableForBlock = checkStaffAvailability;
  
  // Helper to check if staff has a late start or early end that requires a split
  const staffRequiresSplitForClient = (
    staff: Staff, 
    client: Client | undefined, 
    day: WeekDay, 
    block: "am" | "pm"
  ): boolean => {
    if (!client) return false;
    
    const availability = staff.availability as Record<string, { enabled: boolean; start: string; end: string }>;
    const dayAvail = availability?.[day];
    if (!dayAvail?.enabled) return true; // Not available at all
    
    // Parse staff availability times
    const [startHour, startMin] = (dayAvail.start || "08:00").split(':').map(Number);
    const [endHour, endMin] = (dayAvail.end || "16:00").split(':').map(Number);
    const staffStartMinute = startHour * 60 + (startMin || 0);
    const staffEndMinute = endHour * 60 + (endMin || 0);
    
    // Get client service window
    const clientStart = getClientServiceStartMinute(client, day);
    const clientEnd = getClientServiceEndMinute(client, day);
    
    if (block === "am") {
      // AM block: if staff starts later than client needs, split is required
      return staffStartMinute > clientStart;
    } else {
      // PM block: check both late start AND early end scenarios
      // PM block typically starts around 12:30 - if staff starts later, needs split coverage
      const pmBlockStart = 750; // 12:30 PM in minutes
      const clientPmStart = Math.max(clientStart, pmBlockStart); // Client's effective PM start
      
      // Staff needs split if they start late (after client's PM needs begin)
      const startsLate = staffStartMinute > clientPmStart;
      
      // Staff needs split if they end early (before client's PM needs end)
      const endsEarly = staffEndMinute < clientEnd;
      
      return startsLate || endsEarly;
    }
  };

  // Toggle a day in the selectedDays list
  const toggleApplyDay = (day: WeekDay) => {
    if (!pendingApply) return;
    const current = pendingApply.selectedDays;
    const newDays = current.includes(day)
      ? current.filter(d => d !== day)
      : [...current, day];
    setPendingApply({ ...pendingApply, selectedDays: newDays });
  };

  // Select all remaining days (rest of week from current day)
  const selectAllDays = () => {
    if (!pendingApply) return;
    const days: WeekDay[] = ['mon', 'tue', 'wed', 'thu', 'fri'];
    const startIndex = days.indexOf(pendingApply.day);
    const remainingDays = days.slice(startIndex + 1);
    setPendingApply({ ...pendingApply, selectedDays: remainingDays });
  };

  const handleApplyToDays = () => {
    if (!pendingApply || !template || pendingApply.selectedDays.length === 0) return;
    
    // Find the staff member
    const staff = staffList.find(s => s.id === pendingApply.staffId);
    if (!staff) return;
    
    const newTemplate = { ...template };
    const skippedDays: string[] = [];
    const appliedDays: string[] = [];
    
    // Handle split assignments
    if (pendingApply.clientId === 'split') {
      // Always fetch fresh segments from the current template to avoid stale data
      const sourceAssignment = newTemplate[pendingApply.day][pendingApply.block].find(a => a.staffId === pendingApply.staffId);
      const freshSegments = sourceAssignment?.segments || pendingApply.segments || [];
      
      if (freshSegments.length === 0) {
        toast({ description: "No segments to apply.", variant: "destructive" });
        setPendingApply(null);
        return;
      }
      
      for (const day of pendingApply.selectedDays) {
        if (day === pendingApply.day) continue;
        
        // Check if staff is available for this day and block
        if (!isStaffAvailableForBlock(staff, day, pendingApply.block)) {
          skippedDays.push(day === 'tue' ? 'Tu' : day === 'thu' ? 'Th' : day.charAt(0).toUpperCase());
          continue;
        }
        
        const currentAssignments = [...newTemplate[day][pendingApply.block]];
        const existingIndex = currentAssignments.findIndex(a => a.staffId === pendingApply.staffId);
        
        if (existingIndex >= 0) {
          const existingLock = currentAssignments[existingIndex].isLocked;
          currentAssignments[existingIndex] = { 
            staffId: pendingApply.staffId, 
            clientId: 'split',
            segments: [...freshSegments],
            isLocked: existingLock
          };
        } else {
          currentAssignments.push({ 
            staffId: pendingApply.staffId, 
            clientId: 'split',
            segments: [...freshSegments]
          });
        }
        
        newTemplate[day][pendingApply.block] = currentAssignments;
        appliedDays.push(day === 'tue' ? 'Tu' : day === 'thu' ? 'Th' : day.charAt(0).toUpperCase());
      }
    } else {
      // Handle regular (non-split) assignments
      // Find the client (if not unassigned)
      const client = pendingApply.clientId && pendingApply.clientId !== 'unassigned'
        ? clientList.find(c => c.id === pendingApply.clientId)
        : undefined;
      
      const gapDays: string[] = [];
      
      for (const day of pendingApply.selectedDays) {
        // Skip the current day - we're applying FROM it, not TO it
        if (day === pendingApply.day) continue;
        
        // Check if staff is available for this day and block
        if (!isStaffAvailableForBlock(staff, day, pendingApply.block)) {
          skippedDays.push(day === 'tue' ? 'Tu' : day === 'thu' ? 'Th' : day.charAt(0).toUpperCase());
          continue;
        }
        
        // Check if staff requires a split for this client (late start/early end)
        if (client && staffRequiresSplitForClient(staff, client, day, pendingApply.block)) {
          gapDays.push(day === 'tue' ? 'Tu' : day === 'thu' ? 'Th' : day.charAt(0).toUpperCase());
          continue;
        }
        
        const currentAssignments = [...newTemplate[day][pendingApply.block]];
        const existingIndex = currentAssignments.findIndex(a => a.staffId === pendingApply.staffId);
        
        // Fetch fresh location and times from source assignment to avoid stale data
        const sourceAssignment = newTemplate[pendingApply.day][pendingApply.block].find(a => a.staffId === pendingApply.staffId);
        const freshLocationId = sourceAssignment?.locationId ?? pendingApply.locationId;
        const freshStartMinute = sourceAssignment?.startMinute ?? pendingApply.startMinute;
        const freshEndMinute = sourceAssignment?.endMinute ?? pendingApply.endMinute;
        
        if (existingIndex >= 0) {
          const existingLock = currentAssignments[existingIndex].isLocked;
          currentAssignments[existingIndex] = { 
            staffId: pendingApply.staffId, 
            clientId: pendingApply.clientId,
            locationId: freshLocationId,
            startMinute: freshStartMinute,
            endMinute: freshEndMinute,
            isLocked: existingLock
          };
        } else {
          currentAssignments.push({ 
            staffId: pendingApply.staffId, 
            clientId: pendingApply.clientId,
            locationId: freshLocationId,
            startMinute: freshStartMinute,
            endMinute: freshEndMinute
          });
        }
        
        newTemplate[day][pendingApply.block] = currentAssignments;
        appliedDays.push(day === 'tue' ? 'Tu' : day === 'thu' ? 'Th' : day.charAt(0).toUpperCase());
      }
      
      if (gapDays.length > 0) {
        toast({ description: `Skipped ${gapDays.join(', ')} (needs split).` });
      }
    }
    
    setTemplate(newTemplate);
    setPendingApply(null);
    
    // Build message with applied/skipped days info
    let message = appliedDays.length > 0 
      ? `Applied to ${appliedDays.join(', ')}.`
      : 'No days were updated.';
    if (skippedDays.length > 0) {
      message += ` Skipped ${skippedDays.join(', ')} (unavailable).`;
    }
    
    toast({ description: message });
  };

  const getClientForStaff = (day: WeekDay, block: "am" | "pm", staffId: string) => {
    if (!template) return "unassigned";
    return template[day][block].find(a => a.staffId === staffId)?.clientId || "unassigned";
  };
  
  const getLocationForStaff = (day: WeekDay, block: "am" | "pm", staffId: string) => {
    if (!template) return null;
    return template[day][block].find(a => a.staffId === staffId)?.locationId || null;
  };

  const getLockForStaff = (day: WeekDay, block: "am" | "pm", staffId: string) => {
    if (!template) return false;
    return template[day][block].find(a => a.staffId === staffId)?.isLocked || false;
  };

  const handleLockToggle = (day: WeekDay, block: "am" | "pm", staffId: string) => {
    if (!template) return;
    const newTemplate = { ...template };
    const currentAssignments = [...newTemplate[day][block]];
    const existingIndex = currentAssignments.findIndex(a => a.staffId === staffId);
    
    if (existingIndex >= 0) {
      const currentLocked = currentAssignments[existingIndex].isLocked || false;
      currentAssignments[existingIndex] = {
        ...currentAssignments[existingIndex],
        isLocked: !currentLocked
      };
      newTemplate[day][block] = currentAssignments;
      setTemplate(newTemplate);
    }
  };
  
  const getAssignmentForStaff = (day: WeekDay, block: "am" | "pm", staffId: string) => {
    if (!template) return null;
    return template[day][block].find(a => a.staffId === staffId) || null;
  };

  const getTimesForStaff = (day: WeekDay, block: "am" | "pm", staffId: string) => {
    if (!template) return { startMinute: null, endMinute: null };
    const assignment = template[day][block].find(a => a.staffId === staffId);
    return {
      startMinute: assignment?.startMinute ?? null,
      endMinute: assignment?.endMinute ?? null
    };
  };

  const handleTimeChange = (
    day: WeekDay, 
    block: "am" | "pm", 
    staffId: string, 
    field: "startMinute" | "endMinute",
    value: number | null
  ) => {
    if (!template) return;
    
    const newTemplate = { ...template };
    const currentAssignments = [...newTemplate[day][block]];
    
    const existingIndex = currentAssignments.findIndex(a => a.staffId === staffId);
    if (existingIndex >= 0) {
      currentAssignments[existingIndex] = { 
        ...currentAssignments[existingIndex],
        [field]: value
      };
      newTemplate[day][block] = currentAssignments;
      setTemplate(newTemplate);
    }
  };

  const getSegmentsForStaff = (day: WeekDay, block: "am" | "pm", staffId: string): SplitSegment[] => {
    if (!template) return [];
    const assignment = template[day][block].find(a => a.staffId === staffId);
    return assignment?.segments || [];
  };

  const handleSegmentsChange = (
    day: WeekDay,
    block: "am" | "pm",
    staffId: string,
    segments: SplitSegment[]
  ) => {
    if (!template) return;
    
    const newTemplate = { ...template };
    const currentAssignments = [...newTemplate[day][block]];
    
    const existingIndex = currentAssignments.findIndex(a => a.staffId === staffId);
    if (existingIndex >= 0) {
      currentAssignments[existingIndex] = { 
        ...currentAssignments[existingIndex],
        segments
      };
      newTemplate[day][block] = currentAssignments;
      setTemplate(newTemplate);
    }
  };

  // Time options for dropdowns (in minutes from midnight)
  // AM: 7:00 (420) to 12:00 (720)
  // PM: 12:00 (720) to 17:30 (1050)
  // Using 15-minute increments to support clients with non-standard times (e.g., 8:45)
  const generateTimeOptions = (block: "am" | "pm") => {
    const options: { value: number; label: string }[] = [];
    const startHour = block === "am" ? 7 : 12;
    const endHour = block === "am" ? 12 : 17;
    const endMinuteLimit = block === "am" ? 0 : 30;
    
    for (let hour = startHour; hour <= endHour; hour++) {
      const maxMin = hour === endHour ? endMinuteLimit : 45;
      for (let min = 0; min <= maxMin; min += 15) {
        if (hour === endHour && min > endMinuteLimit) break;
        const totalMinutes = hour * 60 + min;
        const displayHour = hour > 12 ? hour - 12 : hour;
        const ampm = hour >= 12 ? "PM" : "AM";
        const label = `${displayHour}:${min.toString().padStart(2, '0')} ${ampm}`;
        options.push({ value: totalMinutes, label });
      }
    }
    return options;
  };

  const amTimeOptions = generateTimeOptions("am");
  const pmTimeOptions = generateTimeOptions("pm");

  // Define filtered lists before any early returns (hooks must be called consistently)
  const activeClients = clientList.filter(c => c.active).sort((a, b) => a.name.localeCompare(b.name));
  const nonBcbaStaff = staffList.filter(s => s.role !== 'BCBA').sort((a, b) => a.name.localeCompare(b.name));
  
  // Filter clients to only those scheduled for the active day
  const clientsScheduledForDay = useMemo(() => {
    return activeClients.filter(client => {
      const schedule = client.schedule as Record<string, { enabled: boolean; start: string; end: string }>;
      return schedule?.[activeTab]?.enabled === true;
    });
  }, [activeClients, activeTab]);
  
  // Filter staff by search query - searches both staff names and assigned client names
  const filteredStaff = useMemo(() => {
    const activeStaff = nonBcbaStaff.filter(s => s.active);
    if (!searchQuery.trim()) return activeStaff;
    
    const query = searchQuery.toLowerCase();
    return activeStaff.filter(s => {
      // Match staff name
      if (s.name.toLowerCase().includes(query)) return true;
      
      // Match assigned client names for current day
      if (template) {
        const dayTemplate = template[activeTab];
        const staffAssignments = [...dayTemplate.am, ...dayTemplate.pm].filter(a => a.staffId === s.id);
        for (const assignment of staffAssignments) {
          if (assignment.clientId) {
            const client = clientList.find(c => c.id === assignment.clientId);
            if (client && client.name.toLowerCase().includes(query)) return true;
          }
          // Check split segments
          if (assignment.segments) {
            for (const seg of assignment.segments) {
              if (seg.clientId) {
                const client = clientList.find(c => c.id === seg.clientId);
                if (client && client.name.toLowerCase().includes(query)) return true;
              }
            }
          }
        }
      }
      return false;
    });
  }, [nonBcbaStaff, searchQuery, template, activeTab, clientList]);
  
  // Day abbreviation helper
  const getDayAbbrev = (day: WeekDay) => {
    switch (day) {
      case 'mon': return 'M';
      case 'tue': return 'Tu';
      case 'wed': return 'W';
      case 'thu': return 'Th';
      case 'fri': return 'F';
    }
  };

  // Loading state
  if (isLoading || !template) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-[calc(100vh-140px)]">
          <p className="text-muted-foreground">Loading template data...</p>
        </div>
      </Layout>
    );
  }

  // Validation Logic
  const amDuplicates = findDuplicateClientAssignments(template[activeTab].am, "am");
  const pmDuplicates = findDuplicateClientAssignments(template[activeTab].pm, "pm");
  const hasErrors = amDuplicates.length > 0 || pmDuplicates.length > 0;

  const missingCoverage = findMissingClientCoverage(template[activeTab].am, template[activeTab].pm, clientList, activeTab);

  // Exclusion conflict validation - check if assigned staff is excluded for that client
  type ExclusionConflict = {
    day: WeekDay;
    block: "am" | "pm";
    staffId: string;
    staffName: string;
    clientId: string;
    clientName: string;
  };

  const findExclusionConflicts = (): ExclusionConflict[] => {
    if (!template) return [];
    const conflicts: ExclusionConflict[] = [];
    
    (Object.keys(template) as WeekDay[]).forEach(day => {
      (["am", "pm"] as const).forEach(block => {
        template[day][block].forEach(a => {
          // Skip splits - handled separately in validateSplits
          if (a.clientId === "split" || !a.clientId) return;
          
          const client = clientList.find(c => c.id === a.clientId);
          const staff = staffList.find(s => s.id === a.staffId);
          if (!client || !staff) return;
          
          const excludedStaffIds = (client.excludedStaffIds as string[]) || [];
          if (excludedStaffIds.includes(staff.id)) {
            conflicts.push({
              day,
              block,
              staffId: staff.id,
              staffName: staff.name,
              clientId: client.id,
              clientName: client.name
            });
          }
        });
      });
    });
    
    return conflicts;
  };

  const exclusionConflicts = findExclusionConflicts();
  const hasExclusionConflicts = exclusionConflicts.length > 0;

  // Comprehensive split validation
  type SplitError = {
    day: WeekDay;
    block: "am" | "pm";
    staffId: string;
    staffName: string;
    type: "missing_client" | "invalid_times" | "overlap" | "gap" | "min_duration" | "excluded_staff";
    message: string;
  };

  const validateSplits = (): SplitError[] => {
    if (!template) return [];
    const errors: SplitError[] = [];
    
    (Object.keys(template) as WeekDay[]).forEach(day => {
      (["am", "pm"] as const).forEach(block => {
        template[day][block].forEach(a => {
          if (a.clientId === "split" && a.segments && a.segments.length > 0) {
            const staff = staffList.find(s => s.id === a.staffId);
            const staffName = staff?.name || "Unknown";
            
            // Sort segments by start time for sequential checks
            const sortedSegments = [...a.segments].sort((x, y) => (x.startMinute || 0) - (y.startMinute || 0));
            
            for (let i = 0; i < sortedSegments.length; i++) {
              const seg = sortedSegments[i];
              
              // 1. Check for missing client selection
              if (!seg.clientId) {
                errors.push({
                  day, block, staffId: a.staffId, staffName,
                  type: "missing_client",
                  message: `Segment ${i + 1} has no client selected`
                });
                continue; // Skip other checks for this segment
              }
              
              const client = clientList.find(c => c.id === seg.clientId);
              const clientName = client?.name || "Unknown";
              
              // 2. Check for missing/undefined times (critical error)
              if (seg.startMinute == null || seg.endMinute == null) {
                errors.push({
                  day, block, staffId: a.staffId, staffName,
                  type: "invalid_times",
                  message: `${clientName}: missing start or end time`
                });
                continue;
              }
              
              // 3. Check start < end
              if (seg.startMinute >= seg.endMinute) {
                errors.push({
                  day, block, staffId: a.staffId, staffName,
                  type: "invalid_times",
                  message: `${clientName}: start time must be before end time`
                });
              }
              
              // 4. Check minimum duration (client-specific or default 15 min)
              const minDuration = client?.minSplitDurationMinutes || 15;
              const segDuration = seg.endMinute - seg.startMinute;
              if (segDuration > 0 && segDuration < minDuration) {
                errors.push({
                  day, block, staffId: a.staffId, staffName,
                  type: "min_duration",
                  message: `${clientName}: segment is ${segDuration} min but requires at least ${minDuration} min`
                });
              }
              
              // 5. Check overlap with next segment
              if (i < sortedSegments.length - 1) {
                const nextSeg = sortedSegments[i + 1];
                if (nextSeg.startMinute != null && seg.endMinute > nextSeg.startMinute) {
                  const nextClient = clientList.find(c => c.id === nextSeg.clientId);
                  const nextClientName = nextClient?.name || "Segment " + (i + 2);
                  errors.push({
                    day, block, staffId: a.staffId, staffName,
                    type: "overlap",
                    message: `${clientName} overlaps with ${nextClientName}`
                  });
                }
              }
              
              // 6. Check gap between segments
              if (i < sortedSegments.length - 1) {
                const nextSeg = sortedSegments[i + 1];
                if (nextSeg.startMinute != null) {
                  const gap = nextSeg.startMinute - seg.endMinute;
                  if (gap > 30) {
                    errors.push({
                      day, block, staffId: a.staffId, staffName,
                      type: "gap",
                      message: `${gap} minute gap between segments (drive time should be ~15-30 min)`
                    });
                  } else if (gap > 0 && gap < 15) {
                    errors.push({
                      day, block, staffId: a.staffId, staffName,
                      type: "gap",
                      message: `Only ${gap} minute gap for drive time between segments (may be too short)`
                    });
                  }
                }
              }
              
              // 7. Check staffing constraints (excluded staff only for splits)
              // Note: Splits do NOT require focus/trained staff - adding via split makes them focus staff
              if (client && staff) {
                const excludedStaff = (client.excludedStaffIds as string[]) || [];
                
                // Excluded staff is a hard constraint
                if (excludedStaff.includes(staff.id)) {
                  errors.push({
                    day, block, staffId: a.staffId, staffName,
                    type: "excluded_staff",
                    message: `${staffName} is excluded from working with ${clientName}`
                  });
                }
                // Note: We intentionally don't check focus/trained for splits
                // Adding a staff via split makes them focus staff (handled on save)
              }
            }
          }
        });
      });
    });
    
    return errors;
  };

  const splitErrors = validateSplits();
  const criticalSplitErrors = splitErrors.filter(e => 
    e.type === "missing_client" || e.type === "invalid_times" || e.type === "overlap" || e.type === "excluded_staff"
  );
  const hasCriticalSplitErrors = criticalSplitErrors.length > 0;

  const handleSave = () => {
    // Safety check: prevent saving if template is not loaded
    if (!template) {
      toast({
        title: "Cannot Save",
        description: "Template is still loading. Please wait.",
        variant: "destructive"
      });
      return;
    }
    
    if (hasErrors) {
      toast({
        title: "Cannot Save",
        description: "Please resolve conflicting assignments before saving.",
        variant: "destructive"
      });
      return;
    }
    
    if (hasExclusionConflicts) {
      toast({
        title: "Cannot Save - Exclusion Conflicts",
        description: "Some staff are assigned to clients who have them excluded. Remove the assignment or update the client's exclusion list.",
        variant: "destructive"
      });
      return;
    }
    
    if (hasCriticalSplitErrors) {
      toast({
        title: "Cannot Save",
        description: "Please fix split assignment errors before saving.",
        variant: "destructive"
      });
      return;
    }
    
    const rawAssignments = buildAssignmentsFromTemplate(template);
    
    // Build set of valid client IDs for fast lookup
    const validClientIds = new Set(clientList.map(c => c.id));
    
    // Filter out:
    // 1. Assignments for unavailable blocks (staff hours don't cover the block)
    // 2. Assignments with client IDs that no longer exist (deleted clients)
    const assignments = rawAssignments.filter(a => {
      const staff = staffList.find(s => s.id === a.staffId);
      if (!staff) return true; // Keep if we can't find staff (shouldn't happen)
      
      const day = a.weekDay as WeekDay;
      const block = a.timeBlock.toLowerCase() as "am" | "pm";
      
      // Filter out unavailable blocks
      if (!isStaffAvailableForBlock(staff, day, block)) return false;
      
      // Filter out assignments with deleted/invalid client IDs
      // null clientId is valid (unassigned/drive), but non-null must exist
      if (a.clientId && !validClientIds.has(a.clientId)) {
        console.warn(`Filtering out assignment with deleted client: ${a.clientId}`);
        return false;
      }
      
      return true;
    });
    
    // Safety check: warn if saving would result in no assignments
    if (assignments.length === 0) {
      toast({
        title: "Nothing to Save",
        description: "No staff assignments found. Add assignments before saving.",
        variant: "destructive"
      });
      return;
    }
    
    // Collect staff-client pairs from splits that need to be added to focusStaffIds
    // Only consider available blocks (skip unavailable ones)
    const focusUpdatesMap = new Map<string, Set<string>>(); // clientId -> Set of staffIds to add
    
    (Object.keys(template) as WeekDay[]).forEach(day => {
      (['am', 'pm'] as const).forEach(block => {
        template[day][block].forEach(assignment => {
          // Skip unavailable blocks
          const staff = staffList.find(s => s.id === assignment.staffId);
          if (!staff || !isStaffAvailableForBlock(staff, day, block)) return;
          
          if (assignment.clientId === 'split' && assignment.segments) {
            assignment.segments.forEach(segment => {
              if (segment.clientId && segment.clientId !== 'unassigned') {
                const client = clientList.find(c => c.id === segment.clientId);
                
                if (client && staff) {
                  const focusStaff = (client.focusStaffIds as string[]) || [];
                  const trainedStaff = (client.trainedStaffIds as string[]) || [];
                  
                  // If staff not already on focus or trained list, add to updates
                  if (!focusStaff.includes(staff.id) && !trainedStaff.includes(staff.id)) {
                    if (!focusUpdatesMap.has(client.id)) {
                      focusUpdatesMap.set(client.id, new Set());
                    }
                    focusUpdatesMap.get(client.id)!.add(staff.id);
                  }
                }
              }
            });
          }
        });
      });
    });
    
    // Build focus updates array for server (just the new staff IDs to add - server will merge)
    const focusUpdates: Array<{ clientId: string; staffIdsToAdd: string[] }> = [];
    focusUpdatesMap.forEach((staffIds, clientId) => {
      focusUpdates.push({ clientId, staffIdsToAdd: Array.from(staffIds) });
    });
    
    // Save template and focus updates in a single atomic transaction
    saveMutation.mutate({ assignments, focusUpdates });
  };

  return (
    <Layout>
      <div className="flex flex-col min-h-[calc(100vh-140px)] gap-4 md:gap-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 flex-none">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl md:text-3xl font-serif font-bold text-primary">Weekly Template</h1>
            {/* View Tabs */}
            <div className="flex bg-muted rounded-lg p-1">
              <button
                onClick={() => setActiveView("assignments")}
                className={cn(
                  "px-3 py-1.5 text-sm font-medium rounded-md transition-colors flex items-center gap-2",
                  activeView === "assignments"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
                data-testid="view-assignments-tab"
              >
                <Users className="h-4 w-4" />
                Assignments
              </button>
              <button
                onClick={() => setActiveView("lunchPairings")}
                className={cn(
                  "px-3 py-1.5 text-sm font-medium rounded-md transition-colors flex items-center gap-2",
                  activeView === "lunchPairings"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
                data-testid="view-lunch-pairings-tab"
              >
                <Coffee className="h-4 w-4" />
                Lunch Pairings
              </button>
            </div>
          </div>
          {activeView === "assignments" && (
            <div className="flex gap-2 w-full sm:w-auto">
              <Button variant="outline" onClick={() => {
                // Filter out assignments with deleted clients before resetting
                const validIds = new Set(clientList.map(c => c.id));
                const filtered = templateAssignments.filter(a => !a.clientId || validIds.has(a.clientId));
                setTemplate(buildTemplateFromAssignments(filtered));
              }} className="flex-1 sm:flex-initial text-sm">
                Discard
              </Button>
              <Button 
                onClick={handleSave} 
                className={cn("shadow-sm transition-all flex-1 sm:flex-initial", (hasErrors || hasExclusionConflicts || hasCriticalSplitErrors || isLoading || !template || saveMutation.isPending) ? "opacity-50 cursor-not-allowed" : "bg-primary text-primary-foreground")}
                disabled={hasErrors || hasExclusionConflicts || hasCriticalSplitErrors || isLoading || !template || saveMutation.isPending}
              >
                <Save className="mr-2 h-4 w-4" />
                {saveMutation.isPending ? "Saving..." : "Save"}
              </Button>
            </div>
          )}
        </div>

        {/* Assignments View */}
        {activeView === "assignments" && (
          <>
        {/* Validation Panel */}
        {(hasErrors || hasExclusionConflicts || hasCriticalSplitErrors || missingCoverage.am.length > 0 || missingCoverage.pm.length > 0) && (
          <div className="flex-none space-y-2 animate-in slide-in-from-top-2">
             {/* Exclusion Conflicts Alert */}
             {hasExclusionConflicts && (
               <Alert variant="destructive" className="bg-destructive/10 border-destructive/20 text-destructive-foreground">
                 <XCircle className="h-4 w-4" />
                 <AlertTitle>Exclusion Conflicts - Cannot Save</AlertTitle>
                 <AlertDescription>
                   <p className="mb-2">The following staff are assigned to clients who have them excluded. Remove the assignment or update the client's exclusion list:</p>
                   <ul className="list-disc pl-4 space-y-1">
                     {exclusionConflicts.map((conflict, idx) => (
                       <li key={idx}>
                         <strong>{conflict.staffName}</strong> is excluded from <strong>{conflict.clientName}</strong> 
                         ({conflict.day.toUpperCase()} {conflict.block.toUpperCase()})
                       </li>
                     ))}
                   </ul>
                 </AlertDescription>
               </Alert>
             )}
             
             {hasErrors && (
               <Alert variant="destructive" className="bg-destructive/10 border-destructive/20 text-destructive-foreground">
                 <XCircle className="h-4 w-4" />
                 <AlertTitle>Conflicting Assignments</AlertTitle>
                 <AlertDescription>
                   Some clients are double-booked in the same block. You must fix these to save.
                   <div className="mt-2 text-sm list-disc pl-4">
                     {amDuplicates.map(id => {
                       const clientName = clientList.find(c => c.id === id)?.name || id;
                       const assignedStaff = template[activeTab].am
                         .filter(a => a.clientId === id)
                         .map(a => staffList.find(s => s.id === a.staffId)?.name || a.staffId)
                         .join(", ");
                       return <li key={`am-${id}`}>AM: {clientName} is assigned to multiple staff ({assignedStaff})</li>
                     })}
                     {pmDuplicates.map(id => {
                       const clientName = clientList.find(c => c.id === id)?.name || id;
                       const assignedStaff = template[activeTab].pm
                         .filter(a => a.clientId === id)
                         .map(a => staffList.find(s => s.id === a.staffId)?.name || a.staffId)
                         .join(", ");
                       return <li key={`pm-${id}`}>PM: {clientName} is assigned to multiple staff ({assignedStaff})</li>
                     })}
                   </div>
                 </AlertDescription>
               </Alert>
             )}

             {/* Critical Split Errors */}
             {hasCriticalSplitErrors && (
               <Alert variant="destructive" className="bg-destructive/10 border-destructive/20 text-destructive-foreground">
                 <XCircle className="h-4 w-4" />
                 <AlertTitle>Split Assignment Errors</AlertTitle>
                 <AlertDescription>
                   Please fix the following split issues before saving:
                   <ul className="mt-2 text-sm list-disc pl-4 space-y-1">
                     {criticalSplitErrors.map((err, i) => (
                       <li key={i}>
                         <span className="font-medium">{err.staffName}</span> ({err.day.toUpperCase()} {err.block.toUpperCase()}): {err.message}
                       </li>
                     ))}
                   </ul>
                 </AlertDescription>
               </Alert>
             )}

             
             {/* Warnings (Missing Coverage) */}
             {!hasErrors && !hasCriticalSplitErrors && (missingCoverage.am.length > 0 || missingCoverage.pm.length > 0) && (
               <Alert className="bg-amber-500/10 border-amber-500/20 text-amber-700 dark:text-amber-400">
                 <AlertTriangle className="h-4 w-4 text-amber-600" />
                 <AlertTitle>Missing Coverage Warning</AlertTitle>
                 <AlertDescription>
                   The following active clients have no staff assigned:
                   <div className="mt-1 text-xs grid grid-cols-2 gap-x-4">
                     {missingCoverage.am.length > 0 && (
                        <div>
                          <span className="font-semibold">AM Missing:</span> {missingCoverage.am.map(id => clientList.find(c => c.id === id)?.name).join(", ")}
                        </div>
                     )}
                     {missingCoverage.pm.length > 0 && (
                        <div>
                          <span className="font-semibold">PM Missing:</span> {missingCoverage.pm.map(id => clientList.find(c => c.id === id)?.name).join(", ")}
                        </div>
                     )}
                   </div>
                 </AlertDescription>
               </Alert>
             )}
          </div>
        )}

        {/* Main Content */}
        <div className="flex-1 border rounded-lg bg-card shadow-sm">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as WeekDay)}>
            {/* Sticky Header Section - Sticks to viewport when scrolling */}
            <div className="sticky top-16 sm:top-[5.5rem] z-20 bg-card rounded-t-lg border-b">
              {/* Day Tabs */}
              <div className="border-b bg-muted/20 flex items-center justify-between overflow-x-auto rounded-t-lg">
                <TabsList className="bg-transparent h-12 w-max justify-start gap-4 md:gap-8 px-2 md:px-4">
                  {(['mon', 'tue', 'wed', 'thu', 'fri'] as const).map((day) => (
                    <TabsTrigger 
                      key={day} 
                      value={day}
                      className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-3 md:px-4 h-full uppercase tracking-wider text-xs font-semibold whitespace-nowrap"
                    >
                      {day === 'mon' ? 'Monday' : day === 'tue' ? 'Tuesday' : day === 'wed' ? 'Wednesday' : day === 'thu' ? 'Thursday' : 'Friday'}
                    </TabsTrigger>
                  ))}
                </TabsList>
                <Button
                  variant="outline"
                  size="sm"
                  className="mr-4 gap-2 flex-none"
                  onClick={() => handleGeneratePreview(activeTab)}
                  data-testid="button-preview-schedule"
                >
                  <Eye className="w-4 h-4" />
                  <span className="hidden sm:inline">Preview Schedule</span>
                </Button>
              </div>

              {/* Search Bar */}
              <div className="px-3 md:px-6 py-2 border-b bg-card">
                <Input
                  placeholder="Search staff or clients..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-8 text-sm max-w-xs"
                  data-testid="template-search-input"
                />
              </div>
              
              {/* Column Headers */}
              <div className="grid grid-cols-[minmax(180px,1.5fr)_minmax(120px,1fr)_minmax(120px,1fr)] gap-2 md:gap-4 px-3 md:px-6 py-3 font-medium text-xs md:text-sm text-muted-foreground uppercase tracking-wider bg-card">
                <div>Staff Member</div>
                <div>AM Focus Client</div>
                <div>PM Focus Client</div>
              </div>
            </div>

            {/* Staff Rows - Normal flow, page scrolls */}
            <div className="divide-y divide-border/40">
                  {filteredStaff.map((staffMember) => (
                    <div key={staffMember.id} className="grid grid-cols-[minmax(180px,1.5fr)_minmax(120px,1fr)_minmax(120px,1fr)] gap-2 md:gap-4 px-3 md:px-6 py-3 items-start hover:bg-muted/10 transition-colors">
                      
                      {/* Staff Column with Apply Controls */}
                      <div className="flex flex-col justify-start min-w-0 gap-1">
                        <span className="font-medium text-foreground text-sm truncate">{staffMember.name}</span>
                        <span className="text-xs text-muted-foreground">{staffMember.role}</span>
                        {(() => {
                          // Show availability gap indicators
                          const availability = staffMember.availability as Record<string, { enabled: boolean; start: string; end: string }>;
                          const dayAvail = availability?.[activeTab];
                          
                          if (!dayAvail?.enabled) {
                            return <span className="text-xs text-red-500 font-medium">OFF</span>;
                          }
                          
                          const [startHour, startMin] = (dayAvail.start || "08:00").split(':').map(Number);
                          const [endHour, endMin] = (dayAvail.end || "16:00").split(':').map(Number);
                          const staffStartMinute = startHour * 60 + (startMin || 0);
                          const staffEndMinute = endHour * 60 + (endMin || 0);
                          
                          const indicators: React.ReactNode[] = [];
                          
                          // Late start (after 8:30 AM)
                          if (staffStartMinute > 510) {
                            const startLabel = `${startHour > 12 ? startHour - 12 : startHour}:${(startMin || 0).toString().padStart(2, '0')} ${startHour >= 12 ? 'PM' : 'AM'}`;
                            indicators.push(
                              <span key="late" className="text-xs text-amber-600" title="Staff starts late - AM clients need split coverage">
                                Starts {startLabel}
                              </span>
                            );
                          }
                          
                          // Early end (before 4:00 PM)
                          if (staffEndMinute < 960) {
                            const endLabel = `${endHour > 12 ? endHour - 12 : endHour}:${(endMin || 0).toString().padStart(2, '0')} ${endHour >= 12 ? 'PM' : 'AM'}`;
                            indicators.push(
                              <span key="early" className="text-xs text-amber-600" title="Staff ends early - PM clients need split coverage">
                                Ends {endLabel}
                              </span>
                            );
                          }
                          
                          if (indicators.length === 0) return null;
                          return <div className="flex flex-col gap-0.5">{indicators}</div>;
                        })()}
                        
                        {/* Apply to Days Controls - shown in staff column */}
                        {pendingApply?.staffId === staffMember.id && pendingApply?.day === activeTab && (
                          <div className="mt-2 p-2 bg-primary/5 rounded-md border border-primary/20 space-y-2">
                            <div className="text-xs text-muted-foreground">
                              Apply {pendingApply.block.toUpperCase()} to:
                            </div>
                            {/* Day selection buttons */}
                            <div className="flex flex-wrap gap-1">
                              {(['mon', 'tue', 'wed', 'thu', 'fri'] as const).filter(d => d !== pendingApply.day).map((day) => (
                                <Button
                                  key={day}
                                  variant={pendingApply.selectedDays.includes(day) ? "default" : "outline"}
                                  size="sm"
                                  className="h-6 w-7 p-0 text-xs"
                                  onClick={() => toggleApplyDay(day)}
                                >
                                  {getDayAbbrev(day)}
                                </Button>
                              ))}
                            </div>
                            {/* All Week + Apply buttons */}
                            <div className="flex gap-1">
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-6 text-xs flex-1"
                                onClick={selectAllDays}
                              >
                                All Week
                              </Button>
                              <Button
                                size="sm"
                                className="h-6 text-xs flex-1"
                                onClick={handleApplyToDays}
                                disabled={pendingApply.selectedDays.length === 0}
                              >
                                Apply
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0"
                                onClick={() => setPendingApply(null)}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* AM Assignment */}
                      <div className="min-w-0 space-y-1">
                        {!isStaffAvailableForBlock(staffMember, activeTab, 'am') ? (
                          <div className="flex items-center h-10 px-3 bg-muted/50 rounded-md border border-dashed border-muted-foreground/30">
                            <span className="text-sm text-muted-foreground italic">Unavailable</span>
                          </div>
                        ) : (
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className={cn(
                              "h-8 w-8 shrink-0",
                              getLockForStaff(activeTab, 'am', staffMember.id) 
                                ? "text-red-500 hover:text-red-600 hover:bg-red-50" 
                                : "text-muted-foreground hover:text-foreground"
                            )}
                            onClick={() => handleLockToggle(activeTab, 'am', staffMember.id)}
                            disabled={getClientForStaff(activeTab, 'am', staffMember.id) === 'unassigned'}
                            title={getLockForStaff(activeTab, 'am', staffMember.id) ? "Unlock - allow engine to move this staff" : "Lock - prevent engine from moving this staff"}
                            data-testid={`lock-am-${staffMember.id}`}
                          >
                            {getLockForStaff(activeTab, 'am', staffMember.id) ? <Lock className="h-4 w-4" /> : <LockOpen className="h-4 w-4" />}
                          </Button>
                          <ClientCombobox
                            value={getClientForStaff(activeTab, 'am', staffMember.id)}
                            onValueChange={(val) => handleAssignmentChange(activeTab, 'am', staffMember.id, val)}
                            clients={clientsScheduledForDay}
                            showSplitOption={true}
                          />
                        </div>
                        )}
                        {/* Split Editor for AM */}
                        {isStaffAvailableForBlock(staffMember, activeTab, 'am') && getClientForStaff(activeTab, 'am', staffMember.id) === 'split' && (
                          <SplitEditor
                            segments={getSegmentsForStaff(activeTab, 'am', staffMember.id)}
                            onSegmentsChange={(segs) => handleSegmentsChange(activeTab, 'am', staffMember.id, segs)}
                            clients={clientsScheduledForDay}
                            block="am"
                            onClose={() => handleAssignmentChange(activeTab, 'am', staffMember.id, 'unassigned')}
                            onDone={() => {
                              const segs = getSegmentsForStaff(activeTab, 'am', staffMember.id);
                              const days: WeekDay[] = ['mon', 'tue', 'wed', 'thu', 'fri'];
                              const startIndex = days.indexOf(activeTab);
                              const remainingDays = days.slice(startIndex + 1);
                              setPendingApply({ 
                                day: activeTab, 
                                block: 'am', 
                                staffId: staffMember.id, 
                                clientId: 'split',
                                segments: segs,
                                selectedDays: remainingDays 
                              });
                            }}
                            staffRole={staffMember.role}
                            day={activeTab}
                          />
                        )}
                        {isStaffAvailableForBlock(staffMember, activeTab, 'am') && (() => {
                          const clientId = getClientForStaff(activeTab, 'am', staffMember.id);
                          const clientLocs = clientId && clientId !== 'unassigned' ? locationsByClient.get(clientId) : null;
                          if (clientLocs && clientLocs.length > 1) {
                            const currentLocId = getLocationForStaff(activeTab, 'am', staffMember.id);
                            const { startMinute, endMinute } = getTimesForStaff(activeTab, 'am', staffMember.id);
                            return (
                              <>
                                <LocationCombobox
                                  value={currentLocId}
                                  onValueChange={(val) => handleLocationChange(activeTab, 'am', staffMember.id, val)}
                                  locations={clientLocs.sort((a, b) => a.sortOrder - b.sortOrder)}
                                  testId={`select-location-am-${staffMember.id}`}
                                />
                                <div className="flex gap-1 items-center">
                                  <BlockTimeCombobox
                                    value={startMinute}
                                    onValueChange={(val) => handleTimeChange(activeTab, 'am', staffMember.id, 'startMinute', val)}
                                    options={amTimeOptions}
                                    placeholder="Start"
                                    testId={`select-start-am-${staffMember.id}`}
                                  />
                                  <span className="text-xs text-muted-foreground">-</span>
                                  <BlockTimeCombobox
                                    value={endMinute}
                                    onValueChange={(val) => handleTimeChange(activeTab, 'am', staffMember.id, 'endMinute', val)}
                                    options={amTimeOptions}
                                    placeholder="End"
                                    testId={`select-end-am-${staffMember.id}`}
                                  />
                                  <Button
                                    variant="default"
                                    size="sm"
                                    className="h-7 text-xs ml-1"
                                    onClick={() => {
                                      const days: WeekDay[] = ['mon', 'tue', 'wed', 'thu', 'fri'];
                                      const startIndex = days.indexOf(activeTab);
                                      const remainingDays = days.slice(startIndex + 1);
                                      setPendingApply({ 
                                        day: activeTab, 
                                        block: 'am', 
                                        staffId: staffMember.id, 
                                        clientId,
                                        locationId: currentLocId,
                                        startMinute: startMinute ?? undefined,
                                        endMinute: endMinute ?? undefined,
                                        selectedDays: remainingDays 
                                      });
                                    }}
                                    data-testid={`done-location-am-${staffMember.id}`}
                                  >
                                    <Check className="h-3 w-3 mr-1" /> Done
                                  </Button>
                                </div>
                              </>
                            );
                          }
                          return null;
                        })()}
                      </div>

                      {/* PM Assignment */}
                      <div className="min-w-0 space-y-1">
                        {!isStaffAvailableForBlock(staffMember, activeTab, 'pm') ? (
                          <div className="flex items-center h-10 px-3 bg-muted/50 rounded-md border border-dashed border-muted-foreground/30">
                            <span className="text-sm text-muted-foreground italic">Unavailable</span>
                          </div>
                        ) : (
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className={cn(
                              "h-8 w-8 shrink-0",
                              getLockForStaff(activeTab, 'pm', staffMember.id) 
                                ? "text-red-500 hover:text-red-600 hover:bg-red-50" 
                                : "text-muted-foreground hover:text-foreground"
                            )}
                            onClick={() => handleLockToggle(activeTab, 'pm', staffMember.id)}
                            disabled={getClientForStaff(activeTab, 'pm', staffMember.id) === 'unassigned'}
                            title={getLockForStaff(activeTab, 'pm', staffMember.id) ? "Unlock - allow engine to move this staff" : "Lock - prevent engine from moving this staff"}
                            data-testid={`lock-pm-${staffMember.id}`}
                          >
                            {getLockForStaff(activeTab, 'pm', staffMember.id) ? <Lock className="h-4 w-4" /> : <LockOpen className="h-4 w-4" />}
                          </Button>
                          <ClientCombobox
                            value={getClientForStaff(activeTab, 'pm', staffMember.id)}
                            onValueChange={(val) => handleAssignmentChange(activeTab, 'pm', staffMember.id, val)}
                            clients={clientsScheduledForDay}
                            showSplitOption={true}
                          />
                        </div>
                        )}
                        {/* Split Editor for PM */}
                        {isStaffAvailableForBlock(staffMember, activeTab, 'pm') && getClientForStaff(activeTab, 'pm', staffMember.id) === 'split' && (
                          <SplitEditor
                            segments={getSegmentsForStaff(activeTab, 'pm', staffMember.id)}
                            onSegmentsChange={(segs) => handleSegmentsChange(activeTab, 'pm', staffMember.id, segs)}
                            clients={clientsScheduledForDay}
                            block="pm"
                            onClose={() => handleAssignmentChange(activeTab, 'pm', staffMember.id, 'unassigned')}
                            onDone={() => {
                              const segs = getSegmentsForStaff(activeTab, 'pm', staffMember.id);
                              const days: WeekDay[] = ['mon', 'tue', 'wed', 'thu', 'fri'];
                              const startIndex = days.indexOf(activeTab);
                              const remainingDays = days.slice(startIndex + 1);
                              setPendingApply({ 
                                day: activeTab, 
                                block: 'pm', 
                                staffId: staffMember.id, 
                                clientId: 'split',
                                segments: segs,
                                selectedDays: remainingDays 
                              });
                            }}
                            staffRole={staffMember.role}
                            day={activeTab}
                          />
                        )}
                        {isStaffAvailableForBlock(staffMember, activeTab, 'pm') && (() => {
                          const clientId = getClientForStaff(activeTab, 'pm', staffMember.id);
                          const clientLocs = clientId && clientId !== 'unassigned' ? locationsByClient.get(clientId) : null;
                          if (clientLocs && clientLocs.length > 1) {
                            const currentLocId = getLocationForStaff(activeTab, 'pm', staffMember.id);
                            const { startMinute, endMinute } = getTimesForStaff(activeTab, 'pm', staffMember.id);
                            return (
                              <>
                                <LocationCombobox
                                  value={currentLocId}
                                  onValueChange={(val) => handleLocationChange(activeTab, 'pm', staffMember.id, val)}
                                  locations={clientLocs.sort((a, b) => a.sortOrder - b.sortOrder)}
                                  testId={`select-location-pm-${staffMember.id}`}
                                />
                                <div className="flex gap-1 items-center">
                                  <BlockTimeCombobox
                                    value={startMinute}
                                    onValueChange={(val) => handleTimeChange(activeTab, 'pm', staffMember.id, 'startMinute', val)}
                                    options={pmTimeOptions}
                                    placeholder="Start"
                                    testId={`select-start-pm-${staffMember.id}`}
                                  />
                                  <span className="text-xs text-muted-foreground">-</span>
                                  <BlockTimeCombobox
                                    value={endMinute}
                                    onValueChange={(val) => handleTimeChange(activeTab, 'pm', staffMember.id, 'endMinute', val)}
                                    options={pmTimeOptions}
                                    placeholder="End"
                                    testId={`select-end-pm-${staffMember.id}`}
                                  />
                                  <Button
                                    variant="default"
                                    size="sm"
                                    className="h-7 text-xs ml-1"
                                    onClick={() => {
                                      const days: WeekDay[] = ['mon', 'tue', 'wed', 'thu', 'fri'];
                                      const startIndex = days.indexOf(activeTab);
                                      const remainingDays = days.slice(startIndex + 1);
                                      setPendingApply({ 
                                        day: activeTab, 
                                        block: 'pm', 
                                        staffId: staffMember.id, 
                                        clientId,
                                        locationId: currentLocId,
                                        startMinute: startMinute ?? undefined,
                                        endMinute: endMinute ?? undefined,
                                        selectedDays: remainingDays 
                                      });
                                    }}
                                    data-testid={`done-location-pm-${staffMember.id}`}
                                  >
                                    <Check className="h-3 w-3 mr-1" /> Done
                                  </Button>
                                </div>
                              </>
                            );
                          }
                          return null;
                        })()}
                      </div>

                    </div>
                  ))}
            </div>
          </Tabs>
        </div>
          </>
        )}

        {/* Lunch Pairings View */}
        {activeView === "lunchPairings" && (
          <LunchPairingsView clients={clientList} clientLocations={allClientLocations} />
        )}
      </div>

      <Dialog open={previewDialogOpen} onOpenChange={setPreviewDialogOpen}>
        <DialogContent className="max-w-[90vw] max-h-[90vh] w-full flex flex-col p-0 overflow-hidden">
          <DialogHeader className="px-6 py-4 border-b bg-card flex-shrink-0">
            <DialogTitle className="text-xl font-serif flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Eye className="w-5 h-5 text-primary" />
                Schedule Preview: {previewDay === 'mon' ? 'Monday' : previewDay === 'tue' ? 'Tuesday' : previewDay === 'wed' ? 'Wednesday' : previewDay === 'thu' ? 'Thursday' : 'Friday'}
              </span>
              <Badge variant="outline" className="text-xs">For Visualization Only</Badge>
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="flex-1 p-6">
            <div className="space-y-1">
              {previewSchedule.map((staffSchedule) => {
                const staffMember = staffList?.find(s => s.id === staffSchedule.staffId);
                if (!staffMember) return null;
                
                return (
                  <div key={staffSchedule.staffId} className="flex items-stretch border-b border-gray-200 last:border-b-0">
                    <div className="w-36 flex-shrink-0 py-2 px-3 bg-gray-50 border-r border-gray-200 flex items-center">
                      <span className="font-medium text-sm truncate">{staffMember.name}</span>
                    </div>
                    <div className="flex-1 relative h-12" style={{ minWidth: '500px' }}>
                      {staffSchedule.slots.map((slot, index) => {
                        if (slot.source === "OFF_SCHEDULE") return null;
                        if (slot.startMinute === undefined || slot.endMinute === undefined) return null;
                        
                        const leftPercent = minuteToPercent(slot.startMinute);
                        const widthPercent = durationToPercent(slot.startMinute, slot.endMinute);
                        
                        const bgColor = slot.source === "UNFILLED" ? "bg-red-100 border-red-300" :
                                       slot.source === "CANCEL" ? "bg-gray-100 border-gray-300" :
                                       slot.source === "REPAIR" ? "bg-amber-100 border-amber-300" :
                                       slot.source === "TRAINING" ? "bg-purple-100 border-purple-300" :
                                       "bg-teal-100 border-teal-300";
                        
                        const client = clientList?.find(c => c.id === slot.clientId);
                        const initials = client?.name?.split(' ').map(n => n[0]).join('') || slot.value.slice(0, 2);
                        
                        return (
                          <div 
                            key={index}
                            className={cn("absolute top-1 bottom-1 border rounded px-2 flex flex-col justify-center text-xs overflow-hidden", bgColor)}
                            style={{ left: `${leftPercent}%`, width: `${widthPercent}%` }}
                          >
                            <span className="font-medium truncate">{initials}</span>
                            <span className="text-[10px] text-gray-500 truncate">
                              {formatMinutesToTime(slot.startMinute)}-{formatMinutesToTime(slot.endMinute)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
            
            <div className="mt-6 flex items-center justify-center gap-6 text-xs text-gray-500">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-teal-100 border border-teal-300"></div>
                <span>Template</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-amber-100 border border-amber-300"></div>
                <span>Substitute</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-purple-100 border border-purple-300"></div>
                <span>Training</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-gray-100 border border-gray-300"></div>
                <span>Cancelled</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-red-100 border border-red-300"></div>
                <span>Unfilled</span>
              </div>
            </div>
            
            <p className="text-center text-sm text-muted-foreground mt-4">
              This is a preview based on the current template with no exceptions or approvals. 
              The actual schedule may differ based on daily changes.
            </p>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
