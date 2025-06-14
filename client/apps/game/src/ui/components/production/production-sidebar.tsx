import { useUIStore } from "@/hooks/store/use-ui-store";
import { ResourceIcon } from "@/ui/elements/resource-icon";
import { HasValue, runQuery } from "@dojoengine/recs";
import { useDojo } from "@frontboat/react";
import { ID, RealmInfo, resources } from "@frontboat/types";
import { memo, useMemo } from "react";

interface ProductionSidebarProps {
  realms: RealmInfo[];
  selectedRealmEntityId: ID;
  onSelectRealm: (id: ID) => void;
}

const SidebarRealm = ({
  realm,
  isSelected,
  onSelect,
}: {
  realm: RealmInfo;
  isSelected: boolean;
  onSelect: () => void;
}) => {
  const {
    setup: {
      components: { Building },
    },
  } = useDojo();

  const structureEntityId = useUIStore((state) => state.structureEntityId);
  const isCurrentStructure = realm.entityId === structureEntityId;

  const buildings = useMemo(() => {
    const buildings = runQuery([
      HasValue(Building, {
        outer_entity_id: realm.entityId,
      }),
    ]);

    return buildings;
  }, [realm]);

  return (
    <div
      onClick={onSelect}
      className={`p-4 rounded-lg cursor-pointer transition-colors ${isSelected ? "panel-gold bg-gold/5" : "border-transparent opacity-50"}`}
    >
      <div className="flex justify-between items-start">
        <h3 className="text-xl font-bold mb-2">{realm.name}</h3>
        {isCurrentStructure && <span className="text-xs bg-gold/30 text-white px-2 py-1 rounded">Current</span>}
      </div>

      <div className="flex flex-wrap gap-2 mb-2">
        {Object.values(realm.resources).map((resource) => {
          return (
            <ResourceIcon
              key={resource}
              resource={resources.find((r) => r.id === resource)?.trait || ""}
              size="sm"
              className="opacity-80"
            />
          );
        })}
      </div>

      <div className="space-y-2">
        <div className="text-sm text-gold/80">
          <span>{buildings.size} buildings</span>
        </div>
      </div>
    </div>
  );
};

export const ProductionSidebar = memo(({ realms, selectedRealmEntityId, onSelectRealm }: ProductionSidebarProps) => {
  return (
    <div className="space-y-4">
      {realms.map((realm) => (
        <SidebarRealm
          key={realm.entityId}
          realm={realm}
          isSelected={realm.entityId === selectedRealmEntityId}
          onSelect={() => onSelectRealm(realm.entityId)}
        />
      ))}
    </div>
  );
});
