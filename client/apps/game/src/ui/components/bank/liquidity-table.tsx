import { LiquidityResourceRow } from "@/ui/components/bank/liquidity-resource-row";
import { useDojo, usePlayerStructures } from "@frontboat/react";
import { ContractAddress, ID, RESOURCE_TIERS, ResourcesIds, resources } from "@frontboat/types";
import { useState } from "react";

type LiquidityTableProps = {
  entity_id: ID;
};

export const LiquidityTableHeader = () => (
  <div className="grid grid-cols-7 gap-4 px-2 h6">
    <div className="uppercase">Pair</div>
    <div className="uppercase">
      <p>Price</p>
    </div>
    <div className="uppercase col-span-2">Total Liquidity</div>
    <div className="uppercase col-span-2">My Liquidity</div>
  </div>
);

export const LiquidityTable = ({ entity_id }: LiquidityTableProps) => {
  const {
    account: { account },
  } = useDojo();

  const [searchTerm, setSearchTerm] = useState("");

  const filteredResources = Object.entries(RESOURCE_TIERS).flatMap(([tier, resourceIds]) => {
    return resourceIds.filter(
      (resourceId) =>
        resourceId !== ResourcesIds.Lords &&
        resources
          .find((r) => r.id === resourceId)
          ?.trait.toLowerCase()
          .includes(searchTerm.toLowerCase()),
    );
  });

  const playerStructures = usePlayerStructures(ContractAddress(account.address));

  const playerStructureIds = playerStructures.map((structure) => structure.structure.entity_id);

  return (
    <div className="amm-liquidity-selector p-4 h-full panel-wood overflow-x-auto relative">
      <input
        type="text"
        placeholder="Search resources..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="w-full p-2 mb-6 bg-gold/20 focus:outline-none text-gold placeholder-gold/50 border border-gold/30 rounded"
      />
      <LiquidityTableHeader />
      <div className="overflow-y-auto">
        <div className="grid gap-2 relative">
          {filteredResources.map((resourceId, index) => (
            <LiquidityResourceRow
              key={resourceId}
              playerStructureIds={playerStructureIds}
              entityId={entity_id}
              resourceId={resourceId}
              isFirst={index === 0 ? true : false}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
