import { EntityArmyList } from "@/ui/components/military/army-list";
import { EntitiesArmyTable } from "@/ui/components/military/entities-army-table";
import { useComponentValue } from "@dojoengine/react";
import { getEntityIdFromKeys } from "@frontboat/eternum";
import { useDojo, useQuery } from "@frontboat/react";
import { ID } from "@frontboat/types";

export const Military = ({ entityId, className }: { entityId: ID | undefined; className?: string }) => {
  const {
    setup: { components },
  } = useDojo();

  const { isMapView } = useQuery();
  const structure = useComponentValue(components.Structure, getEntityIdFromKeys([BigInt(entityId || 0)]));

  return (
    <div className={`relative ${className}`}>
      {isMapView ? <EntitiesArmyTable /> : structure && <EntityArmyList structure={structure} />}
    </div>
  );
};
