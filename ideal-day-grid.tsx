import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, Users, Coffee, Car, HeartPulse, Phone, Clock, X, GripVertical, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Staff, Client, ClientLocation, IdealDaySegment, TemplateLunchPairingGroup } from "@shared/schema";

const TIMELINE_START = 420; // 7:00 AM in minutes
const TIMELINE_END = 1020; // 5:00 PM in minutes
const SLOT_DURATION = 30; // 30 minutes per slot
const TOTAL_SLOTS = (TIMELINE_END - TIMELINE_START) / SLOT_DURATION; // 20 slots

const SEGMENT_TYPES = [
  { value: "client", label: "Client", icon: Users, color: "bg-primary/10 border-primary/30 text-primary" },
  { value: "lunch", label: "Lunch", icon: Coffee, color: "bg-amber-100 border-amber-300 text-amber-700" },
  { value: "drive", label: "Drive", icon: Car, color: "bg-blue-100 border-blue-300 text-blue-700" },
  { value: "break", label: "Break", icon: HeartPulse, color: "bg-green-100 border-green-300 text-green-700" },
  { value: "on_call", label: "On Call", icon: Phone, color: "bg-purple-100 border-purple-300 text-purple-700" },
  { value: "lead_support", label: "Lead/BX Support", icon: Users, color: "bg-teal-100 border-teal-300 text-teal-700" },
  { value: "open", label: "Open", icon: Clock, color: "bg-gray-100 border-gray-300 text-gray-600" },
  { value: "out", label: "Out", icon: X, color: "bg-red-100 border-red-300 text-red-700" },
];

const formatMinutesToTime = (minutes: number): string => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  const ampm = hours >= 12 ? "PM" : "AM";
  const displayHours = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours;
  return `${displayHours}:${mins.toString().padStart(2, "0")}${ampm}`;
};

const formatMinutesToTimeShort = (minutes: number): string => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  const displayHours = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours;
  return `${displayHours}:${mins.toString().padStart(2, "0")}`;
};

interface TimeSlot {
  slotIndex: number;
  startMinute: number;
  endMinute: number;
  segment?: IdealDaySegment;
  spanStart?: boolean; // Is this the first slot of a multi-slot segment?
  spanCount?: number; // How many slots does this segment span?
  hidden?: boolean; // Is this slot covered by a previous segment's span?
}

function buildTimeSlots(segments: IdealDaySegment[]): TimeSlot[] {
  const slots: TimeSlot[] = [];
  
  for (let i = 0; i < TOTAL_SLOTS; i++) {
    const startMinute = TIMELINE_START + (i * SLOT_DURATION);
    const endMinute = startMinute + SLOT_DURATION;
    slots.push({
      slotIndex: i,
      startMinute,
      endMinute,
    });
  }
  
  const sortedSegments = [...segments].sort((a, b) => a.startMinute - b.startMinute);
  
  for (const segment of sortedSegments) {
    const startSlotIndex = Math.floor((segment.startMinute - TIMELINE_START) / SLOT_DURATION);
    const endSlotIndex = Math.ceil((segment.endMinute - TIMELINE_START) / SLOT_DURATION);
    const spanCount = endSlotIndex - startSlotIndex;
    
    if (startSlotIndex >= 0 && startSlotIndex < TOTAL_SLOTS) {
      slots[startSlotIndex].segment = segment;
      slots[startSlotIndex].spanStart = true;
      slots[startSlotIndex].spanCount = spanCount;
      
      for (let j = startSlotIndex + 1; j < endSlotIndex && j < TOTAL_SLOTS; j++) {
        slots[j].hidden = true;
        slots[j].segment = segment;
      }
    }
  }
  
  return slots;
}

interface GridTimeHeaderProps {
  className?: string;
}

export function GridTimeHeader({ className }: GridTimeHeaderProps) {
  const timeLabels: { minute: number; label: string }[] = [];
  for (let m = TIMELINE_START; m <= TIMELINE_END; m += 60) {
    timeLabels.push({ minute: m, label: formatMinutesToTimeShort(m) });
  }
  
  return (
    <div className={cn("flex border-b border-border bg-muted/30 min-w-max", className)}>
      <div className="w-28 md:w-36 flex-shrink-0 border-r border-border px-2 py-1">
        <span className="text-xs font-medium text-muted-foreground">Staff</span>
      </div>
      <div className="flex-1 relative h-8 min-w-[600px]">
        {timeLabels.map(({ minute, label }) => {
          const left = ((minute - TIMELINE_START) / (TIMELINE_END - TIMELINE_START)) * 100;
          return (
            <div
              key={minute}
              className="absolute top-0 bottom-0 flex items-center"
              style={{ left: `${left}%` }}
            >
              <span className="text-[10px] text-muted-foreground font-medium whitespace-nowrap">
                {label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface SegmentCellProps {
  slot: TimeSlot;
  clients: Client[];
  locations: ClientLocation[];
  lunchGroups: TemplateLunchPairingGroup[];
  onClickSlot: (slotIndex: number, startMinute: number) => void;
  onClickSegment: (segment: IdealDaySegment) => void;
  onDeleteSegment: (segmentId: string) => void;
  onResizeSegment?: (segmentId: string, newStartMinute: number, newEndMinute: number) => void;
  isDragging?: boolean;
  onDragStart?: (segment: IdealDaySegment) => void;
  onDragEnd?: () => void;
  onDrop?: (targetSlotIndex: number) => void;
}

function SegmentCell({
  slot,
  clients,
  locations,
  lunchGroups,
  onClickSlot,
  onClickSegment,
  onDeleteSegment,
  onResizeSegment,
  isDragging,
  onDragStart,
  onDragEnd,
  onDrop,
}: SegmentCellProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isResizing, setIsResizing] = useState<"left" | "right" | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const resizeRef = useRef<{ startX: number; edge: "left" | "right"; segment: IdealDaySegment; containerWidth: number } | null>(null);
  
  if (slot.hidden) {
    return null;
  }
  
  // Calculate width as percentage of total timeline
  const slotWidthPercent = 100 / TOTAL_SLOTS;
  const spanCount = slot.spanCount || 1;
  
  // Container width covers all slots this segment touches
  const containerWidthPercent = slotWidthPercent * spanCount;
  
  if (slot.segment && slot.spanStart) {
    const segment = slot.segment;
    const segmentType = SEGMENT_TYPES.find(t => t.value === segment.segmentType) || SEGMENT_TYPES[6];
    const Icon = segmentType.icon;
    const client = segment.clientId ? clients.find(c => c.id === segment.clientId) : null;
    const displayValue = segment.displayValue || (client ? client.name : segmentType.label);
    const duration = segment.endMinute - segment.startMinute;
    
    // Calculate actual segment width and offset within the container
    // Container covers slot.startMinute to (slot.startMinute + spanCount * SLOT_DURATION)
    const containerDuration = spanCount * SLOT_DURATION;
    const startOffset = segment.startMinute - slot.startMinute; // How many minutes into container
    const segmentWidthInContainer = (duration / containerDuration) * 100; // % of container
    const marginLeftPercent = (startOffset / containerDuration) * 100; // % offset from left
    
    // Get location info
    const location = segment.locationId ? locations.find(l => l.id === segment.locationId) : null;
    const locationLabel = location?.displayName || location?.locationType || null;
    
    const lunchGroup = segment.segmentType === "lunch" && segment.lunchPairingGroupId
      ? lunchGroups.find(g => g.id === segment.lunchPairingGroupId)
      : null;
    
    const handleResizeStart = (e: React.MouseEvent | React.TouchEvent, edge: "left" | "right") => {
      e.preventDefault();
      e.stopPropagation();
      setIsResizing(edge);
      const startX = "touches" in e ? e.touches[0].clientX : e.clientX;
      
      // Get actual container width in pixels for accurate calculation
      const containerWidth = containerRef.current?.getBoundingClientRect().width || 100;
      // Each slot in the container represents SLOT_DURATION minutes
      // So total container represents containerDuration minutes
      const pixelsPerMinute = containerWidth / containerDuration;
      
      resizeRef.current = { startX, edge, segment, containerWidth };
      
      const handleMove = (moveE: MouseEvent | TouchEvent) => {
        if (!resizeRef.current) return;
        const currentX = "touches" in moveE ? moveE.touches[0].clientX : moveE.clientX;
        const deltaX = currentX - resizeRef.current.startX;
        
        // Convert pixels to minutes based on actual container width
        const pixelsPerMinute = resizeRef.current.containerWidth / containerDuration;
        // Round to nearest 15-minute increment
        const deltaMinutes = Math.round(deltaX / pixelsPerMinute / 15) * 15;
        
        if (deltaMinutes !== 0) {
          let newStart = resizeRef.current.segment.startMinute;
          let newEnd = resizeRef.current.segment.endMinute;
          
          if (resizeRef.current.edge === "left") {
            newStart = resizeRef.current.segment.startMinute + deltaMinutes;
            // Clamp: don't go before timeline, don't go past end - 15min
            newStart = Math.max(TIMELINE_START, Math.min(newEnd - 15, newStart));
          } else {
            newEnd = resizeRef.current.segment.endMinute + deltaMinutes;
            // Clamp: don't go before start + 15min, don't exceed timeline
            newEnd = Math.max(newStart + 15, Math.min(TIMELINE_END, newEnd));
          }
          
          if (newStart !== resizeRef.current.segment.startMinute || newEnd !== resizeRef.current.segment.endMinute) {
            onResizeSegment?.(resizeRef.current.segment.id, newStart, newEnd);
            resizeRef.current.startX = currentX;
            resizeRef.current.segment = { ...resizeRef.current.segment, startMinute: newStart, endMinute: newEnd };
          }
        }
      };
      
      const handleEnd = () => {
        setIsResizing(null);
        resizeRef.current = null;
        document.removeEventListener("mousemove", handleMove);
        document.removeEventListener("mouseup", handleEnd);
        document.removeEventListener("touchmove", handleMove);
        document.removeEventListener("touchend", handleEnd);
      };
      
      document.addEventListener("mousemove", handleMove);
      document.addEventListener("mouseup", handleEnd);
      document.addEventListener("touchmove", handleMove);
      document.addEventListener("touchend", handleEnd);
    };
    
    return (
      <div
        ref={containerRef}
        className="relative h-full"
        style={{ 
          width: `${containerWidthPercent}%`, 
          flexShrink: 0,
        }}
      >
        <div
          draggable={!isResizing}
          onDragStart={(e) => {
            if (isResizing) {
              e.preventDefault();
              return;
            }
            e.dataTransfer.setData("text/plain", segment.id);
            onDragStart?.(segment);
          }}
          onDragEnd={() => onDragEnd?.()}
          className={cn(
            "absolute top-0 bottom-0 rounded border cursor-pointer transition-all hover:ring-2 hover:ring-primary/50 flex items-center px-1 overflow-hidden group",
            segmentType.color,
            isDragging && "opacity-50",
            isResizing && "ring-2 ring-primary"
          )}
          style={{ 
            left: `${marginLeftPercent}%`,
            width: `${segmentWidthInContainer}%`,
          }}
          onClick={() => !isResizing && onClickSegment(segment)}
          data-testid={`segment-${segment.id}`}
        >
          {/* Left resize handle */}
          <div
            className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize opacity-0 group-hover:opacity-100 bg-primary/20 hover:bg-primary/40 transition-opacity flex items-center justify-center z-10"
            onMouseDown={(e) => handleResizeStart(e, "left")}
            onTouchStart={(e) => handleResizeStart(e, "left")}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-0.5 h-4 bg-primary/60 rounded" />
          </div>
          
          <GripVertical className="h-3 w-3 text-muted-foreground/50 mr-1 flex-shrink-0 cursor-grab ml-2" />
          <div className="flex flex-col min-w-0 flex-1 py-0.5">
            <div className="flex items-center gap-1">
              <Icon className="h-3 w-3 flex-shrink-0" />
              <span className="text-xs font-medium truncate">{displayValue}</span>
              {lunchGroup && (
                <Badge variant="outline" className="text-[9px] py-0 h-4">
                  {lunchGroup.displayName}
                </Badge>
              )}
            </div>
            {locationLabel && (
              <div className="flex items-center gap-0.5 text-[9px] opacity-70">
                <MapPin className="h-2 w-2" />
                <span className="truncate">{locationLabel}</span>
              </div>
            )}
          </div>
          {duration >= 60 && (
            <span className="text-[10px] opacity-70 flex-shrink-0 ml-1 mr-2">
              {formatMinutesToTimeShort(segment.startMinute)}-{formatMinutesToTimeShort(segment.endMinute)}
            </span>
          )}
          
          {/* Right resize handle */}
          <div
            className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize opacity-0 group-hover:opacity-100 bg-primary/20 hover:bg-primary/40 transition-opacity flex items-center justify-center z-10"
            onMouseDown={(e) => handleResizeStart(e, "right")}
            onTouchStart={(e) => handleResizeStart(e, "right")}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-0.5 h-4 bg-primary/60 rounded" />
          </div>
          
          <button
            className="absolute top-0 right-2 p-0.5 bg-red-500 text-white rounded-bl opacity-0 group-hover:opacity-100 transition-opacity z-20"
            onClick={(e) => { e.stopPropagation(); onDeleteSegment(segment.id); }}
            data-testid={`delete-segment-${segment.id}`}
          >
            <X className="h-2.5 w-2.5" />
          </button>
        </div>
      </div>
    );
  }
  
  return (
    <div
      className={cn(
        "h-full border border-dashed border-border/50 rounded cursor-pointer transition-all hover:bg-muted/50 hover:border-primary/30 flex items-center justify-center",
        isDragOver && "bg-primary/10 border-primary"
      )}
      style={{ width: `${slotWidthPercent}%`, flexShrink: 0 }}
      onClick={() => onClickSlot(slot.slotIndex, slot.startMinute)}
      onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragOver(false);
        onDrop?.(slot.slotIndex);
      }}
      data-testid={`slot-${slot.slotIndex}`}
    >
      <Plus className="h-3 w-3 text-muted-foreground/30" />
    </div>
  );
}

interface StaffGridRowProps {
  staffMember: Staff;
  segments: IdealDaySegment[];
  clients: Client[];
  locations: ClientLocation[];
  lunchGroups: TemplateLunchPairingGroup[];
  onClickSlot: (staffId: string, slotIndex: number, startMinute: number) => void;
  onClickSegment: (segment: IdealDaySegment) => void;
  onDeleteSegment: (segmentId: string) => void;
  onResizeSegment: (segmentId: string, newStartMinute: number, newEndMinute: number) => void;
  draggedSegment: IdealDaySegment | null;
  onDragStart: (segment: IdealDaySegment) => void;
  onDragEnd: () => void;
  onDropOnStaff: (staffId: string, targetSlotIndex: number) => void;
}

export function StaffGridRow({
  staffMember,
  segments,
  clients,
  locations,
  lunchGroups,
  onClickSlot,
  onClickSegment,
  onDeleteSegment,
  onResizeSegment,
  draggedSegment,
  onDragStart,
  onDragEnd,
  onDropOnStaff,
}: StaffGridRowProps) {
  const timeSlots = useMemo(() => buildTimeSlots(segments), [segments]);
  
  return (
    <div className="flex border-b border-border hover:bg-muted/20 transition-colors min-w-max">
      <div className="w-28 md:w-36 flex-shrink-0 px-2 py-2 border-r border-border bg-muted/10">
        <div className="text-xs md:text-sm font-medium truncate">{staffMember.name}</div>
        <div className="text-[9px] md:text-[10px] text-muted-foreground">{staffMember.role}</div>
      </div>
      
      <div className="flex-1 flex h-11 md:h-12 p-0.5 gap-0.5 min-w-[600px]">
        {timeSlots.map((slot) => (
          <SegmentCell
            key={slot.slotIndex}
            slot={slot}
            clients={clients}
            locations={locations}
            lunchGroups={lunchGroups}
            onClickSlot={(slotIndex, startMinute) => onClickSlot(staffMember.id, slotIndex, startMinute)}
            onClickSegment={onClickSegment}
            onDeleteSegment={onDeleteSegment}
            onResizeSegment={onResizeSegment}
            isDragging={draggedSegment?.id === slot.segment?.id}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            onDrop={(targetSlotIndex) => onDropOnStaff(staffMember.id, targetSlotIndex)}
          />
        ))}
      </div>
    </div>
  );
}

interface SegmentEditorDialogProps {
  segment: IdealDaySegment | null;
  staffId: string | null;
  templateId: string;
  startMinute: number;
  clients: Client[];
  lunchGroups: TemplateLunchPairingGroup[];
  isOpen: boolean;
  onClose: () => void;
  onSave: (segment: Partial<IdealDaySegment>) => void;
}

export function SegmentEditorDialog({
  segment,
  staffId,
  templateId,
  startMinute,
  clients,
  lunchGroups,
  isOpen,
  onClose,
  onSave,
}: SegmentEditorDialogProps) {
  const [segmentType, setSegmentType] = useState(segment?.segmentType || "client");
  const [clientId, setClientId] = useState(segment?.clientId || "");
  const [lunchGroupId, setLunchGroupId] = useState(segment?.lunchPairingGroupId || "");
  const [startMin, setStartMin] = useState(segment?.startMinute || startMinute);
  const [endMin, setEndMin] = useState(segment?.endMinute || startMinute + 30);
  const [displayValue, setDisplayValue] = useState(segment?.displayValue || "");
  
  useEffect(() => {
    if (isOpen) {
      setSegmentType(segment?.segmentType || "client");
      setClientId(segment?.clientId || "");
      setLunchGroupId(segment?.lunchPairingGroupId || "");
      setStartMin(segment?.startMinute || startMinute);
      setEndMin(segment?.endMinute || startMinute + 30);
      setDisplayValue(segment?.displayValue || "");
    }
  }, [isOpen, segment, startMinute]);
  
  const timeOptions = useMemo(() => {
    const options: { value: number; label: string }[] = [];
    // 15-minute increments to support school lunch variations
    for (let m = TIMELINE_START; m <= TIMELINE_END; m += 15) {
      options.push({ value: m, label: formatMinutesToTime(m) });
    }
    return options;
  }, []);
  
  const sortedClients = useMemo(() => 
    [...clients].filter(c => c.active).sort((a, b) => a.name.localeCompare(b.name)),
    [clients]
  );
  
  const filteredLunchGroups = useMemo(() => {
    // lunchBlock values in database are "11:30-12:00" or "12:00-12:30"
    // First lunch is 11:30-12:00 (690-720), Second lunch is 12:00-12:30 (720-750)
    const targetBlock = startMin >= 720 ? "12:00-12:30" : "11:30-12:00";
    return lunchGroups.filter(g => g.lunchBlock === targetBlock);
  }, [lunchGroups, startMin]);
  
  const handleSave = () => {
    if (startMin >= endMin) {
      alert("End time must be after start time");
      return;
    }
    
    // Clamp end time to not exceed timeline bounds
    const clampedEndMin = Math.min(endMin, TIMELINE_END);
    
    onSave({
      // Preserve existing segment fields when editing
      ...(segment ? {
        id: segment.id,
        origin: segment.origin,
        sourceAssignmentId: segment.sourceAssignmentId,
        locationId: segment.locationId,
        lunchPeriod: segment.lunchPeriod,
        reason: segment.reason,
        sortOrder: segment.sortOrder,
      } : {}),
      // Update with new values
      templateId,
      staffId: staffId || segment?.staffId || "",
      segmentType,
      clientId: segmentType === "client" ? clientId || null : null,
      lunchPairingGroupId: segmentType === "lunch" ? lunchGroupId || null : null,
      startMinute: startMin,
      endMinute: clampedEndMin,
      displayValue: displayValue || null,
      sortOrder: segment?.sortOrder || 0,
    });
    onClose();
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{segment ? "Edit Segment" : "Add Segment"}</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Type</Label>
            <div className="grid grid-cols-4 gap-2">
              {SEGMENT_TYPES.map((type) => {
                const Icon = type.icon;
                return (
                  <button
                    key={type.value}
                    onClick={() => setSegmentType(type.value)}
                    className={cn(
                      "flex flex-col items-center gap-1 p-2 rounded-lg border transition-all",
                      segmentType === type.value
                        ? "border-primary bg-primary/10 ring-2 ring-primary/20"
                        : "border-border hover:border-primary/50"
                    )}
                    data-testid={`type-${type.value}`}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="text-[10px] font-medium">{type.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
          
          {segmentType === "client" && (
            <div className="space-y-2">
              <Label>Client</Label>
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger data-testid="client-select">
                  <SelectValue placeholder="Select client..." />
                </SelectTrigger>
                <SelectContent>
                  <ScrollArea className="h-60">
                    {sortedClients.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.name}
                      </SelectItem>
                    ))}
                  </ScrollArea>
                </SelectContent>
              </Select>
            </div>
          )}
          
          {segmentType === "lunch" && (
            <div className="space-y-3">
              {filteredLunchGroups.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Quick Select from Template</Label>
                  <div className="flex flex-wrap gap-2">
                    {filteredLunchGroups.map((group) => {
                      const groupClientNames = (group.clientIds as string[])
                        .map(id => clients.find(c => c.id === id)?.name)
                        .filter(Boolean)
                        .sort((a, b) => a!.localeCompare(b!))
                        .join(", ");
                      const isSelected = lunchGroupId === group.id;
                      return (
                        <button
                          key={group.id}
                          type="button"
                          onClick={() => setLunchGroupId(isSelected ? "" : group.id)}
                          className={cn(
                            "px-2 py-1 text-xs rounded-md border transition-all",
                            isSelected
                              ? "bg-amber-100 border-amber-400 text-amber-800"
                              : "bg-muted/50 border-border hover:border-amber-300"
                          )}
                          title={groupClientNames}
                          data-testid={`lunch-preset-${group.id}`}
                        >
                          {group.displayName}
                        </button>
                      );
                    })}
                    <button
                      type="button"
                      onClick={() => setLunchGroupId("")}
                      className={cn(
                        "px-2 py-1 text-xs rounded-md border transition-all",
                        !lunchGroupId
                          ? "bg-gray-100 border-gray-400 text-gray-800"
                          : "bg-muted/50 border-border hover:border-gray-300"
                      )}
                      data-testid="lunch-solo-btn"
                    >
                      Solo
                    </button>
                  </div>
                </div>
              )}
              
              {lunchGroupId && (
                <div className="space-y-2">
                  <Label className="text-xs">Clients in Group</Label>
                  <div className="text-sm p-2 bg-muted/30 rounded border border-border">
                    {(() => {
                      const group = filteredLunchGroups.find(g => g.id === lunchGroupId);
                      if (!group) return <span className="text-muted-foreground italic">No group selected</span>;
                      const clientNames = (group.clientIds as string[])
                        .map(id => clients.find(c => c.id === id)?.name)
                        .filter(Boolean)
                        .sort((a, b) => a!.localeCompare(b!));
                      return clientNames.length > 0 
                        ? clientNames.join(", ")
                        : <span className="text-muted-foreground italic">No clients</span>;
                    })()}
                  </div>
                </div>
              )}
              
              {!lunchGroupId && (
                <div className="text-xs text-muted-foreground p-2 bg-muted/20 rounded">
                  Solo lunch - staff will be on their own during this time
                </div>
              )}
            </div>
          )}
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Start Time</Label>
              <Select value={startMin.toString()} onValueChange={(v) => setStartMin(parseInt(v))}>
                <SelectTrigger data-testid="start-time-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <ScrollArea className="h-60">
                    {timeOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value.toString()}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </ScrollArea>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>End Time</Label>
              <Select value={endMin.toString()} onValueChange={(v) => setEndMin(parseInt(v))}>
                <SelectTrigger data-testid="end-time-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <ScrollArea className="h-60">
                    {timeOptions.filter(opt => opt.value > startMin).map((opt) => (
                      <SelectItem key={opt.value} value={opt.value.toString()}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </ScrollArea>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          {(segmentType === "lead_support" || segmentType === "on_call") && (
            <div className="space-y-2">
              <Label>Display Label (Optional)</Label>
              <input
                type="text"
                value={displayValue}
                onChange={(e) => setDisplayValue(e.target.value)}
                placeholder="Custom label..."
                className="w-full px-3 py-2 border border-border rounded-md text-sm"
                data-testid="display-value-input"
              />
            </div>
          )}
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} data-testid="save-segment-btn">
            {segment ? "Update" : "Add"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface IdealDayGridProps {
  staff: Staff[];
  segments: IdealDaySegment[];
  clients: Client[];
  locations: ClientLocation[];
  lunchGroups: TemplateLunchPairingGroup[];
  templateId: string;
  onSaveSegment: (segment: Partial<IdealDaySegment>) => void;
  onDeleteSegment: (segmentId: string) => void;
  onMoveSegment: (segmentId: string, newStaffId: string, newStartMinute: number) => void;
}

export function IdealDayGrid({
  staff,
  segments,
  clients,
  locations,
  lunchGroups,
  templateId,
  onSaveSegment,
  onDeleteSegment,
  onMoveSegment,
}: IdealDayGridProps) {
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingSegment, setEditingSegment] = useState<IdealDaySegment | null>(null);
  const [editingStaffId, setEditingStaffId] = useState<string | null>(null);
  const [editingStartMinute, setEditingStartMinute] = useState(TIMELINE_START);
  const [draggedSegment, setDraggedSegment] = useState<IdealDaySegment | null>(null);
  
  const segmentsByStaff = useMemo(() => {
    const map = new Map<string, IdealDaySegment[]>();
    staff.forEach(s => map.set(s.id, []));
    segments.forEach(seg => {
      const list = map.get(seg.staffId);
      if (list) list.push(seg);
    });
    return map;
  }, [staff, segments]);
  
  const handleClickSlot = useCallback((staffId: string, slotIndex: number, startMinute: number) => {
    setEditingSegment(null);
    setEditingStaffId(staffId);
    setEditingStartMinute(startMinute);
    setEditorOpen(true);
  }, []);
  
  const handleClickSegment = useCallback((segment: IdealDaySegment) => {
    setEditingSegment(segment);
    setEditingStaffId(segment.staffId);
    setEditingStartMinute(segment.startMinute);
    setEditorOpen(true);
  }, []);
  
  const handleDragStart = useCallback((segment: IdealDaySegment) => {
    setDraggedSegment(segment);
  }, []);
  
  const handleDragEnd = useCallback(() => {
    setDraggedSegment(null);
  }, []);
  
  const handleDropOnStaff = useCallback((staffId: string, targetSlotIndex: number) => {
    if (!draggedSegment) return;
    
    const newStartMinute = TIMELINE_START + (targetSlotIndex * SLOT_DURATION);
    onMoveSegment(draggedSegment.id, staffId, newStartMinute);
    setDraggedSegment(null);
  }, [draggedSegment, onMoveSegment]);
  
  const handleResizeSegment = useCallback((segmentId: string, newStartMinute: number, newEndMinute: number) => {
    const segment = segments.find(s => s.id === segmentId);
    if (!segment) return;
    
    onSaveSegment({
      ...segment,
      startMinute: newStartMinute,
      endMinute: newEndMinute,
    });
  }, [segments, onSaveSegment]);
  
  const sortedStaff = useMemo(() => 
    [...staff].sort((a, b) => a.name.localeCompare(b.name)),
    [staff]
  );
  
  return (
    <div className="border rounded-lg overflow-hidden w-full">
      <GridTimeHeader />
      
      <div className="max-h-[calc(100vh-220px)] overflow-y-auto overflow-x-auto">
        {sortedStaff.map((staffMember) => (
          <StaffGridRow
            key={staffMember.id}
            staffMember={staffMember}
            segments={segmentsByStaff.get(staffMember.id) || []}
            clients={clients}
            locations={locations}
            lunchGroups={lunchGroups}
            onClickSlot={handleClickSlot}
            onClickSegment={handleClickSegment}
            onDeleteSegment={onDeleteSegment}
            onResizeSegment={handleResizeSegment}
            draggedSegment={draggedSegment}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDropOnStaff={handleDropOnStaff}
          />
        ))}
      </div>
      
      <SegmentEditorDialog
        segment={editingSegment}
        staffId={editingStaffId}
        templateId={templateId}
        startMinute={editingStartMinute}
        clients={clients}
        lunchGroups={lunchGroups}
        isOpen={editorOpen}
        onClose={() => setEditorOpen(false)}
        onSave={onSaveSegment}
      />
    </div>
  );
}
