import { useComponentValue } from "@dojoengine/react";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { StaminaManager } from "@frontboat/eternum";
import { ID } from "@frontboat/types";
import { useMemo } from "react";
import { useDojo } from "../context";

export const useStaminaManager = (entityId: ID) => {
  const { setup } = useDojo();

  const explorer = useComponentValue(setup.components.ExplorerTroops, getEntityIdFromKeys([BigInt(entityId)]));

  const manager = useMemo(() => {
    return new StaminaManager(setup.components, entityId);
  }, [entityId, explorer]);

  return manager;
};
