import { useComponentValue, useEntityQuery } from "@dojoengine/react";
import { HasValue } from "@dojoengine/recs";
import { getEntityIdFromKeys, getStructure } from "@frontboat/eternum";
import { ContractAddress, Position, Structure } from "@frontboat/types";
import { useMemo } from "react";
import { useDojo } from "../context";

export const usePlayerStructures = (playerAddress?: ContractAddress) => {
  const {
    account: { account },
    setup: { components },
  } = useDojo();

  const entities = useEntityQuery([
    HasValue(components.Structure, { owner: playerAddress || ContractAddress(account.address) }),
  ]);

  const playerStructures = useMemo(() => {
    return entities
      .map((id) => getStructure(id, ContractAddress(account.address), components))
      .filter((value) => Boolean(value))
      .sort((a, b) => {
        // First sort by category
        const categoryDiff = (a?.structure?.base?.category ?? 0) - (b?.structure?.base?.category ?? 0);
        if (categoryDiff !== 0) return categoryDiff;

        // If same category, sort by entity id
        return Number(a?.entityId ?? 0) - Number(b?.entityId ?? 0);
      });
  }, [entities]);

  return playerStructures as Structure[];
};

export const usePlayerStructureAtPosition = ({ position }: { position: Position }) => {
  const {
    account: { account },
    setup: { components },
  } = useDojo();

  const entityAtPosition = useComponentValue(
    components.Tile,
    getEntityIdFromKeys([BigInt(position.x), BigInt(position.y)]),
  );

  const ownStructure = useMemo(() => {
    if (!entityAtPosition || !entityAtPosition.occupier_is_structure) return null;
    const structure = getStructure(entityAtPosition.occupier_id, ContractAddress(account.address), components);
    if (!structure || !structure.isMine) return null;
    return structure;
  }, [entityAtPosition, position.x, position.y]);

  return ownStructure;
};
