import { useEntityQuery } from "@dojoengine/react";
import { ComponentValue, HasValue, getComponentValue } from "@dojoengine/recs";
import { ClientComponents, ContractAddress, ID } from "@frontboat/types";
import { useDojo } from "../";

export const usePlayerContributions = (playerAddress: ContractAddress, hyperstructureEntityId: ID) => {
  const {
    setup: {
      components: { Contribution },
    },
  } = useDojo();

  const contributionsToHyperstructure = useEntityQuery([
    HasValue(Contribution, { hyperstructure_entity_id: hyperstructureEntityId, player_address: playerAddress }),
  ])
    .map((id) => getComponentValue(Contribution, id))
    .filter((x): x is ComponentValue<ClientComponents["Contribution"]["schema"]> => x !== undefined);

  return contributionsToHyperstructure;
};
