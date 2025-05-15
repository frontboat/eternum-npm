import { useEntityQuery } from "@dojoengine/react";
import { HasValue } from "@dojoengine/recs";
import { ResourceManager } from "@frontboat/eternum";
import { ID } from "@frontboat/types";
import { useMemo } from "react";
import { useDojo } from "../context";

export const useResourceManager = (entityId: ID) => {
  const dojo = useDojo();

  const resource = useEntityQuery([HasValue(dojo.setup.components.Resource, { entity_id: entityId })]);

  const resourceManager = useMemo(() => {
    return new ResourceManager(dojo.setup.components, entityId);
  }, [entityId, resource]);

  return resourceManager;
};
