import { useState, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, GripVertical, Users, AlertTriangle, Check, X } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import type { Client, ClientLocation, TemplateLunchPairingGroup } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";

interface LunchPairingsViewProps {
  clients: Client[];
  clientLocations: ClientLocation[];
}

type BillingType = "solo" | "group" | "quad";
type LunchBlock = "first" | "second";

interface ClientChip {
  id: string;
  name: string;
  initials: string;
  canBeGrouped: boolean;
  allowGroupsOf3: boolean;
  allowGroupsOf4: boolean;
  allowedLunchPeerIds: string[];
  noFirstLunchPeerIds: string[];
  noSecondLunchPeerIds: string[];
}

interface PairingGroup {
  id: string;
  clientIds: string[];
  displayName: string;
}

function getClientInitials(name: string): string {
  const parts = name.split(/[\s,]+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

function getBillingTypeForClient(client: Client): BillingType {
  if (client.allowGroupsOf4) return "quad";
  if (client.canBeGrouped) return "group";
  return "solo";
}

function getLocationDisplayName(loc: ClientLocation): string {
  return loc.displayName || loc.locationType || "Unknown";
}

interface CompatibilityCluster {
  id: string;
  clientIds: string[];
  label: string; // e.g., "WH / AS / XS"
  hasAsymmetricPermissions: boolean;
}

// Build compatibility clusters using union-find for clients who can mutually pair
function buildCompatibilityClusters(
  clients: ClientChip[],
  lunchBlock: LunchBlock
): CompatibilityCluster[] {
  if (clients.length === 0) return [];
  
  // Union-Find data structure
  const parent = new Map<string, string>();
  const rank = new Map<string, number>();
  
  const find = (x: string): string => {
    if (parent.get(x) !== x) {
      parent.set(x, find(parent.get(x)!));
    }
    return parent.get(x)!;
  };
  
  const union = (x: string, y: string): void => {
    const px = find(x);
    const py = find(y);
    if (px === py) return;
    
    const rx = rank.get(px) || 0;
    const ry = rank.get(py) || 0;
    
    if (rx < ry) {
      parent.set(px, py);
    } else if (rx > ry) {
      parent.set(py, px);
    } else {
      parent.set(py, px);
      rank.set(px, rx + 1);
    }
  };
  
  // Initialize each client as its own set
  clients.forEach(c => {
    parent.set(c.id, c.id);
    rank.set(c.id, 0);
  });
  
  // Check for mutual compatibility and track asymmetric permissions
  const asymmetricPairs = new Set<string>();
  
  for (let i = 0; i < clients.length; i++) {
    for (let j = i + 1; j < clients.length; j++) {
      const c1 = clients[i];
      const c2 = clients[j];
      
      // Check if they allow each other
      const c1AllowsC2 = c1.allowedLunchPeerIds.includes(c2.id);
      const c2AllowsC1 = c2.allowedLunchPeerIds.includes(c1.id);
      
      // Check block-specific exclusions
      const noList1 = lunchBlock === "first" ? c1.noFirstLunchPeerIds : c1.noSecondLunchPeerIds;
      const noList2 = lunchBlock === "first" ? c2.noFirstLunchPeerIds : c2.noSecondLunchPeerIds;
      const isBlocked1 = noList1.includes(c2.id);
      const isBlocked2 = noList2.includes(c1.id);
      
      // If either blocks the other, they can't cluster
      if (isBlocked1 || isBlocked2) continue;
      
      // Track asymmetric permissions
      if ((c1AllowsC2 && !c2AllowsC1) || (!c1AllowsC2 && c2AllowsC1)) {
        asymmetricPairs.add(`${c1.id}-${c2.id}`);
      }
      
      // If BOTH allow each other (mutual), union them
      if (c1AllowsC2 && c2AllowsC1) {
        union(c1.id, c2.id);
      }
    }
  }
  
  // Build clusters from union-find results
  const clusterMap = new Map<string, ClientChip[]>();
  clients.forEach(c => {
    const root = find(c.id);
    if (!clusterMap.has(root)) {
      clusterMap.set(root, []);
    }
    clusterMap.get(root)!.push(c);
  });
  
  // Convert to cluster objects
  const clusters: CompatibilityCluster[] = [];
  let clusterIndex = 0;
  
  clusterMap.forEach((clusterClients, rootId) => {
    // Sort clients alphabetically for consistent display
    clusterClients.sort((a, b) => a.name.localeCompare(b.name));
    
    // Check if any client in this cluster has asymmetric permissions with someone
    const hasAsymmetric = clusterClients.some(c1 => 
      clusterClients.some(c2 => 
        asymmetricPairs.has(`${c1.id}-${c2.id}`) || asymmetricPairs.has(`${c2.id}-${c1.id}`)
      )
    );
    
    clusters.push({
      id: `cluster-${clusterIndex++}`,
      clientIds: clusterClients.map(c => c.id),
      label: clusterClients.map(c => c.initials).join(" / "),
      hasAsymmetricPermissions: hasAsymmetric,
    });
  });
  
  // Sort clusters by size (larger first) then alphabetically
  clusters.sort((a, b) => {
    if (b.clientIds.length !== a.clientIds.length) {
      return b.clientIds.length - a.clientIds.length;
    }
    return a.label.localeCompare(b.label);
  });
  
  return clusters;
}

function getUniqueLocations(clientLocations: ClientLocation[]): { id: string; name: string }[] {
  const locationMap = new Map<string, string>();
  
  clientLocations.forEach(loc => {
    if (!locationMap.has(loc.id)) {
      locationMap.set(loc.id, getLocationDisplayName(loc));
    }
  });
  
  const uniqueByType = new Map<string, { id: string; name: string }>();
  clientLocations.forEach(loc => {
    const name = getLocationDisplayName(loc);
    if (!uniqueByType.has(name)) {
      uniqueByType.set(name, { id: loc.id, name });
    }
  });
  
  return Array.from(uniqueByType.values()).sort((a, b) => a.name.localeCompare(b.name));
}

function ClientDraggableChip({ 
  client, 
  isInGroup,
  isValidDropTarget,
  onDragStart,
  onDragEnd,
  onDrop,
  onDoubleClick
}: { 
  client: ClientChip;
  isInGroup: boolean;
  isValidDropTarget: boolean | null;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDrop: () => void;
  onDoubleClick?: () => void;
}) {
  const [isDragging, setIsDragging] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  
  return (
    <div
      draggable
      onDragStart={(e) => {
        setIsDragging(true);
        e.dataTransfer.setData("text/plain", client.id);
        onDragStart();
      }}
      onDragEnd={() => {
        setIsDragging(false);
        onDragEnd();
      }}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragOver(true);
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragOver(false);
        onDrop();
      }}
      onDoubleClick={onDoubleClick}
      className={cn(
        "px-3 py-2 rounded-lg border cursor-grab active:cursor-grabbing transition-all",
        "flex items-center gap-2 select-none",
        isDragging && "opacity-50 scale-95",
        isDragOver && isValidDropTarget === true && "ring-2 ring-green-500 bg-green-50",
        isDragOver && isValidDropTarget === false && "ring-2 ring-red-500 bg-red-50",
        isInGroup 
          ? "bg-primary/10 border-primary/30 text-primary font-medium" 
          : "bg-card border-border hover:border-primary/50"
      )}
      data-testid={`client-chip-${client.id}`}
    >
      <GripVertical className="h-3 w-3 text-muted-foreground" />
      <span className="font-medium">{client.initials}</span>
      <span className="text-xs text-muted-foreground">{client.name}</span>
    </div>
  );
}

function GroupDisplay({ 
  group, 
  clients,
  onDoubleClick
}: { 
  group: PairingGroup;
  clients: ClientChip[];
  onDoubleClick: () => void;
}) {
  const groupClients = group.clientIds.map(id => clients.find(c => c.id === id)).filter(Boolean) as ClientChip[];
  
  return (
    <div
      className="flex items-center gap-1 px-3 py-2 rounded-lg bg-primary/10 border border-primary/30 cursor-pointer hover:bg-primary/20 transition-colors"
      onDoubleClick={onDoubleClick}
      data-testid={`group-${group.id}`}
    >
      <Users className="h-4 w-4 text-primary mr-1" />
      {groupClients.map((client, idx) => (
        <span key={client.id} className="font-medium text-primary">
          {client.initials}
          {idx < groupClients.length - 1 && <span className="mx-1">/</span>}
        </span>
      ))}
    </div>
  );
}

function BillingTypeBucket({
  title,
  billingType,
  lunchBlock,
  locationName,
  clients,
  groups,
  allClientsInLocation,
  onCreateGroup,
  onSplitGroup
}: {
  title: string;
  billingType: BillingType;
  lunchBlock: LunchBlock;
  locationName: string;
  clients: ClientChip[];
  groups: PairingGroup[];
  allClientsInLocation: ClientChip[];
  onCreateGroup: (clientIds: string[]) => void;
  onSplitGroup: (groupId: string) => void;
}) {
  const [draggedClientId, setDraggedClientId] = useState<string | null>(null);
  
  const groupedClientIds = new Set(groups.flatMap(g => g.clientIds));
  const ungroupedClients = clients.filter(c => !groupedClientIds.has(c.id));
  
  // Require MUTUAL permission for pairing - both clients must allow each other
  const canPairClients = useCallback((client1Id: string, client2Id: string, block: LunchBlock): boolean => {
    const client1 = allClientsInLocation.find(c => c.id === client1Id);
    const client2 = allClientsInLocation.find(c => c.id === client2Id);
    
    if (!client1 || !client2) return false;
    
    // Both must allow each other (mutual permission)
    const isOnAllowedList1 = client1.allowedLunchPeerIds.includes(client2Id);
    const isOnAllowedList2 = client2.allowedLunchPeerIds.includes(client1Id);
    
    // Check block-specific exclusions
    const noList1 = block === "first" ? client1.noFirstLunchPeerIds : client1.noSecondLunchPeerIds;
    const noList2 = block === "first" ? client2.noFirstLunchPeerIds : client2.noSecondLunchPeerIds;
    
    const isBlocked1 = noList1.includes(client2Id);
    const isBlocked2 = noList2.includes(client1Id);
    
    // Require MUTUAL permission (both must allow each other) and neither blocks the other
    return isOnAllowedList1 && isOnAllowedList2 && !isBlocked1 && !isBlocked2;
  }, [allClientsInLocation]);
  
  const getValidDropTarget = useCallback((targetClientId: string): boolean | null => {
    if (!draggedClientId || draggedClientId === targetClientId) return null;
    return canPairClients(draggedClientId, targetClientId, lunchBlock);
  }, [draggedClientId, canPairClients, lunchBlock]);
  
  const handleDrop = (targetClientId: string) => {
    if (!draggedClientId || draggedClientId === targetClientId) return;
    
    if (canPairClients(draggedClientId, targetClientId, lunchBlock)) {
      onCreateGroup([draggedClientId, targetClientId]);
    }
    setDraggedClientId(null);
  };
  
  const handleDropOnGroup = (group: PairingGroup) => {
    if (!draggedClientId) return;
    if (group.clientIds.includes(draggedClientId)) return;
    
    if (group.clientIds.length >= 3) return;
    
    const canJoin = group.clientIds.every(existingId => 
      canPairClients(draggedClientId, existingId, lunchBlock)
    );
    
    if (canJoin) {
      onCreateGroup([...group.clientIds, draggedClientId]);
    }
    setDraggedClientId(null);
  };
  
  // Build compatibility clusters for ungrouped clients
  const clusters = useMemo(() => 
    buildCompatibilityClusters(ungroupedClients, lunchBlock),
    [ungroupedClients, lunchBlock]
  );
  
  // Find which cluster a client belongs to
  const getClusterForClient = (clientId: string): CompatibilityCluster | undefined => {
    return clusters.find(c => c.clientIds.includes(clientId));
  };
  
  // Check if dragged client can drop within a cluster
  const canDropInCluster = (clusterId: string): boolean => {
    if (!draggedClientId) return false;
    const draggedCluster = getClusterForClient(draggedClientId);
    return draggedCluster?.id === clusterId;
  };
  
  return (
    <div className="flex-1 min-w-[250px] flex-shrink-0">
      <div className="flex items-center gap-2 mb-2">
        <h4 className="text-sm font-medium text-muted-foreground">{title}</h4>
        <Badge variant="outline" className="text-xs">
          {clients.length}
        </Badge>
      </div>
      
      <div className="space-y-3 min-h-[100px] p-2 rounded-lg border border-dashed border-border bg-muted/20">
        {/* Existing groups */}
        {groups.map(group => (
          <div
            key={group.id}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => handleDropOnGroup(group)}
          >
            <GroupDisplay
              group={group}
              clients={clients}
              onDoubleClick={() => onSplitGroup(group.id)}
            />
          </div>
        ))}
        
        {/* Compatibility clusters */}
        {clusters.map(cluster => (
          <div 
            key={cluster.id}
            className={cn(
              "rounded-lg border p-2 space-y-1",
              cluster.clientIds.length > 1 
                ? "border-primary/20 bg-primary/5" 
                : "border-border bg-transparent",
              draggedClientId && canDropInCluster(cluster.id) && "ring-1 ring-primary/30"
            )}
            data-testid={`cluster-${cluster.id}`}
          >
            {/* Cluster header - only show for multi-client clusters */}
            {cluster.clientIds.length > 1 && (
              <div className="flex items-center gap-2 pb-1 mb-1 border-b border-primary/10">
                <Users className="h-3 w-3 text-primary/60" />
                <span className="text-[10px] font-medium text-primary/70">
                  {cluster.label}
                </span>
                {cluster.hasAsymmetricPermissions && (
                  <span title="Some pairing permissions are one-way">
                    <AlertTriangle className="h-3 w-3 text-amber-500" />
                  </span>
                )}
              </div>
            )}
            
            {/* Clients in this cluster */}
            <div className="flex flex-wrap gap-1">
              {cluster.clientIds.map(clientId => {
                const client = ungroupedClients.find(c => c.id === clientId);
                if (!client) return null;
                
                return (
                  <ClientDraggableChip
                    key={client.id}
                    client={client}
                    isInGroup={false}
                    isValidDropTarget={getValidDropTarget(client.id)}
                    onDragStart={() => setDraggedClientId(client.id)}
                    onDragEnd={() => setDraggedClientId(null)}
                    onDrop={() => handleDrop(client.id)}
                  />
                );
              })}
            </div>
          </div>
        ))}
        
        {clusters.length === 0 && groups.length === 0 && (
          <div className="text-xs text-muted-foreground text-center py-4">
            No clients
          </div>
        )}
      </div>
    </div>
  );
}

function LunchBlockSection({
  block,
  locationName,
  locationId,
  clients,
  groups,
  onCreateGroup,
  onSplitGroup
}: {
  block: LunchBlock;
  locationName: string;
  locationId: string;
  clients: ClientChip[];
  groups: TemplateLunchPairingGroup[];
  onCreateGroup: (clientIds: string[], billingType: BillingType) => void;
  onSplitGroup: (groupId: string) => void;
}) {
  const blockLabel = block === "first" ? "11:30 - 12:00" : "12:00 - 12:30";
  
  const soloClients = clients.filter(c => !c.canBeGrouped && !c.allowGroupsOf4);
  const groupClients = clients.filter(c => c.canBeGrouped && !c.allowGroupsOf4);
  const quadClients = clients.filter(c => c.allowGroupsOf4);
  
  const blockGroups = groups.filter(g => g.lunchBlock === block);
  const soloGroups = blockGroups.filter(g => g.billingType === "solo");
  const groupGroups = blockGroups.filter(g => g.billingType === "group");
  const quadGroups = blockGroups.filter(g => g.billingType === "quad");
  
  const toLocalGroup = (g: TemplateLunchPairingGroup): PairingGroup => ({
    id: g.id,
    clientIds: g.clientIds || [],
    displayName: g.displayName || ""
  });
  
  return (
    <div className="border rounded-lg p-4">
      <h3 className="font-medium mb-4 flex items-center gap-2">
        <Badge variant="secondary">{blockLabel}</Badge>
        Lunch Block {block === "first" ? "1" : "2"}
      </h3>
      
      <div className="flex gap-4 overflow-x-auto pb-2">
        <BillingTypeBucket
          title="Solo Bill Only"
          billingType="solo"
          lunchBlock={block}
          locationName={locationName}
          clients={soloClients}
          groups={soloGroups.map(toLocalGroup)}
          allClientsInLocation={clients}
          onCreateGroup={(ids) => onCreateGroup(ids, "solo")}
          onSplitGroup={onSplitGroup}
        />
        
        <BillingTypeBucket
          title="Group Bill"
          billingType="group"
          lunchBlock={block}
          locationName={locationName}
          clients={groupClients}
          groups={groupGroups.map(toLocalGroup)}
          allClientsInLocation={clients}
          onCreateGroup={(ids) => onCreateGroup(ids, "group")}
          onSplitGroup={onSplitGroup}
        />
        
        <BillingTypeBucket
          title="Non-Bill Quads"
          billingType="quad"
          lunchBlock={block}
          locationName={locationName}
          clients={quadClients}
          groups={quadGroups.map(toLocalGroup)}
          allClientsInLocation={clients}
          onCreateGroup={(ids) => onCreateGroup(ids, "quad")}
          onSplitGroup={onSplitGroup}
        />
      </div>
    </div>
  );
}

function LocationSection({
  locationName,
  locationId,
  clients,
  allGroups,
  onCreateGroup,
  onSplitGroup
}: {
  locationName: string;
  locationId: string;
  clients: ClientChip[];
  allGroups: TemplateLunchPairingGroup[];
  onCreateGroup: (clientIds: string[], billingType: BillingType, lunchBlock: LunchBlock) => void;
  onSplitGroup: (groupId: string) => void;
}) {
  const locationGroups = allGroups.filter(g => g.locationName === locationName);
  
  return (
    <Card className="mb-6">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          {locationName}
          <Badge variant="outline">{clients.length} clients</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <LunchBlockSection
          block="first"
          locationName={locationName}
          locationId={locationId}
          clients={clients}
          groups={locationGroups}
          onCreateGroup={(ids, bt) => onCreateGroup(ids, bt, "first")}
          onSplitGroup={onSplitGroup}
        />
        
        <LunchBlockSection
          block="second"
          locationName={locationName}
          locationId={locationId}
          clients={clients}
          groups={locationGroups}
          onCreateGroup={(ids, bt) => onCreateGroup(ids, bt, "second")}
          onSplitGroup={onSplitGroup}
        />
      </CardContent>
    </Card>
  );
}

export function LunchPairingsView({ clients, clientLocations }: LunchPairingsViewProps) {
  const queryClient = useQueryClient();
  
  const { data: pairingGroups = [], isLoading } = useQuery<TemplateLunchPairingGroup[]>({
    queryKey: ["/api/template-lunch-pairing-groups"],
    queryFn: async () => {
      const response = await fetch("/api/template-lunch-pairing-groups");
      if (!response.ok) throw new Error("Failed to fetch pairing groups");
      return response.json();
    },
  });
  
  const createGroupMutation = useMutation({
    mutationFn: async (group: { 
      locationId: string | null; 
      locationName: string; 
      lunchBlock: string; 
      billingType: string; 
      clientIds: string[];
      displayName: string;
    }) => {
      const response = await apiRequest("POST", "/api/template-lunch-pairing-groups", group);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/template-lunch-pairing-groups"] });
    },
  });
  
  const deleteGroupMutation = useMutation({
    mutationFn: async (groupId: string) => {
      await apiRequest("DELETE", `/api/template-lunch-pairing-groups/${groupId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/template-lunch-pairing-groups"] });
    },
  });
  
  const clientsWithChipData: ClientChip[] = useMemo(() => {
    return clients
      .filter(c => c.active)
      .map(c => ({
        id: c.id,
        name: c.name,
        initials: getClientInitials(c.name),
        canBeGrouped: c.canBeGrouped || false,
        allowGroupsOf3: c.allowGroupsOf3 || false,
        allowGroupsOf4: c.allowGroupsOf4 || false,
        allowedLunchPeerIds: (c.allowedLunchPeerIds as string[]) || [],
        noFirstLunchPeerIds: (c.noFirstLunchPeerIds as string[]) || [],
        noSecondLunchPeerIds: (c.noSecondLunchPeerIds as string[]) || [],
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [clients]);
  
  const clientsByLocation = useMemo(() => {
    const map = new Map<string, { locationId: string; clients: ClientChip[] }>();
    
    map.set("Clinic", { locationId: "clinic", clients: [] });
    
    clientsWithChipData.forEach(client => {
      const originalClient = clients.find(c => c.id === client.id);
      const location = originalClient?.defaultLocation || "Clinic";
      
      if (!map.has(location)) {
        const loc = clientLocations.find(l => getLocationDisplayName(l) === location);
        map.set(location, { locationId: loc?.id || location, clients: [] });
      }
      
      map.get(location)!.clients.push(client);
    });
    
    return map;
  }, [clientsWithChipData, clients, clientLocations]);
  
  const handleCreateGroup = (
    clientIds: string[], 
    billingType: BillingType, 
    lunchBlock: LunchBlock,
    locationName: string,
    locationId: string
  ) => {
    const groupClients = clientIds.map(id => clientsWithChipData.find(c => c.id === id)).filter(Boolean) as ClientChip[];
    const displayName = groupClients.map(c => c.initials).join(" / ");
    
    createGroupMutation.mutate({
      locationId: locationId === "clinic" ? null : locationId,
      locationName,
      lunchBlock,
      billingType,
      clientIds,
      displayName,
    });
  };
  
  const handleSplitGroup = (groupId: string) => {
    deleteGroupMutation.mutate(groupId);
  };
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }
  
  return (
    <div className="flex-1 overflow-x-auto">
      <Card className="mb-4">
        <CardContent className="py-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5" />
            <div>
              <p className="text-sm font-medium">How to use this page</p>
              <p className="text-sm text-muted-foreground mt-1">
                Drag a client onto another to create a pair. Drag onto a pair to create a trio. 
                Double-click a group to split it apart. Groups you create here become the baseline 
                pairing options for the Ideal Day page.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <div className="overflow-auto max-h-[calc(100vh-280px)]">
        {Array.from(clientsByLocation.entries()).map(([locationName, { locationId, clients: locationClients }]) => (
          <LocationSection
            key={locationName}
            locationName={locationName}
            locationId={locationId}
            clients={locationClients}
            allGroups={pairingGroups}
            onCreateGroup={(ids, bt, lb) => handleCreateGroup(ids, bt, lb, locationName, locationId)}
            onSplitGroup={handleSplitGroup}
          />
        ))}
        
        {clientsByLocation.size === 0 && (
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-muted-foreground">No active clients found. Add clients to start building lunch pairings.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
