import { LoadingAnimation } from "@/ui/elements/loading-animation";
import { getEntityIdFromKeys } from "@/ui/utils/utils";
import { getBlockTimestamp } from "@/utils/timestamp";
import { useComponentValue } from "@dojoengine/react";
import { getGuardsByStructure, ResourceManager, StaminaManager } from "@frontboat/eternum";
import { useDojo } from "@frontboat/react";
import { getExplorerFromToriiClient, getStructureFromToriiClient } from "@frontboat/torii-client";
import { ID, Resource, STEALABLE_RESOURCES, StructureType, Troops } from "@frontboat/types";
import { useEffect, useState } from "react";
import { CombatContainer } from "./combat-container";
import { RaidContainer } from "./raid-container";

export enum AttackType {
  Combat,
  Raid,
}

export enum TargetType {
  Village,
  Structure,
  Army,
}

export type AttackTarget = {
  info: Troops[];
  id: ID;
  targetType: TargetType;
  structureCategory: StructureType | null;
  hex: { x: number; y: number };
};

// Function to order resources according to STEALABLE_RESOURCES order
export function orderResourcesByPriority(resourceBalances: Resource[]): Resource[] {
  const orderedResources: Resource[] = [];

  STEALABLE_RESOURCES.forEach((resourceId) => {
    const resource = resourceBalances.find((r) => r.resourceId === resourceId);
    if (resource) {
      orderedResources.push(resource);
    }
  });

  return orderedResources;
}

export const AttackContainer = ({
  attackerEntityId,
  targetHex,
}: {
  attackerEntityId: ID;
  targetHex: { x: number; y: number };
}) => {
  const {
    network: { toriiClient },
    setup: {
      components: { Tile },
    },
  } = useDojo();

  const [attackType, setAttackType] = useState<AttackType>(AttackType.Combat);

  const targetTile = useComponentValue(Tile, getEntityIdFromKeys([BigInt(targetHex.x), BigInt(targetHex.y)]));

  const [target, setTarget] = useState<AttackTarget | null>(null);
  const [targetResources, setTargetResources] = useState<Array<{ resourceId: number; amount: number }>>([]);
  const [isLoading, setIsLoading] = useState(false);

  // target not synced so need to fetch from torii
  useEffect(() => {
    if (!targetTile?.occupier_id) return;
    const isStructure = targetTile?.occupier_is_structure;

    const getTarget = async () => {
      setIsLoading(true);
      const { currentArmiesTick } = getBlockTimestamp();
      if (isStructure) {
        const { structure, resources } = await getStructureFromToriiClient(toriiClient, targetTile.occupier_id);
        if (structure) {
          const guards = getGuardsByStructure(structure).filter((guard) => guard.troops.count > 0n);
          setTarget({
            info: guards.map((guard) => ({
              ...guard.troops,
              stamina: StaminaManager.getStamina(guard.troops, currentArmiesTick),
            })),
            id: targetTile?.occupier_id,
            targetType: TargetType.Structure,
            structureCategory: structure.category,
            hex: { x: targetTile.col, y: targetTile.row },
          });
        }
        if (resources) {
          setTargetResources(orderResourcesByPriority(ResourceManager.getResourceBalances(resources)));
        }
      } else {
        const { explorer, resources } = await getExplorerFromToriiClient(toriiClient, targetTile.occupier_id);
        if (resources) {
          setTargetResources(orderResourcesByPriority(ResourceManager.getResourceBalances(resources)));
        }
        if (explorer) {
          setTarget({
            info: [explorer.troops],
            id: targetTile?.occupier_id,
            targetType: TargetType.Army,
            structureCategory: null,
            hex: { x: targetTile.col, y: targetTile.row },
          });
        }
      }
      setIsLoading(false);
    };

    getTarget();
  }, [targetTile]);

  return (
    <div className="flex flex-col h-full">
      {isLoading ? (
        <LoadingAnimation />
      ) : (
        <>
          {/* Attack Type Selection */}
          <div className="flex justify-center mb-6 mx-auto mt-4">
            <div className="flex rounded-md overflow-hidden border border-gold/30 shadow-lg">
              <button
                className={`px-8 py-3 text-lg font-semibold transition-all duration-200 ${
                  attackType === AttackType.Combat
                    ? "bg-gold/20 text-gold border-b-2 border-gold"
                    : "bg-dark-brown text-gold/70 hover:text-gold hover:bg-brown-900/50"
                }`}
                onClick={() => setAttackType(AttackType.Combat)}
              >
                <div className="flex items-center">
                  <span className="mr-2">⚔️</span>
                  Combat
                </div>
              </button>
              <button
                className={`px-8 py-3 text-lg font-semibold transition-all duration-200 ${
                  attackType === AttackType.Raid
                    ? "bg-gold/20 text-gold border-b-2 border-gold"
                    : "bg-dark-brown text-gold/70 hover:text-gold hover:bg-brown-900/50"
                }`}
                onClick={() => setAttackType(AttackType.Raid)}
              >
                <div className="flex items-center">
                  <span className="mr-2">💰</span>
                  Raid
                </div>
              </button>
            </div>
          </div>

          {/* Attack Type Description */}
          <div className="text-center mb-4 px-6">
            <p className="text-gold/70 text-sm">
              {attackType === AttackType.Combat
                ? "Combat mode allows you to attack and defeat enemy troops to claim territory."
                : "Raid mode allows you to steal resources from structures without necessarily defeating all troops."}
            </p>
          </div>

          {/* Attack Content */}
          {target ? (
            <div className="flex-grow overflow-y-auto">
              {attackType === AttackType.Combat ? (
                <CombatContainer
                  attackerEntityId={attackerEntityId}
                  target={target}
                  targetResources={targetResources}
                />
              ) : (
                <RaidContainer attackerEntityId={attackerEntityId} target={target} targetResources={targetResources} />
              )}
            </div>
          ) : (
            <div className="flex-grow overflow-y-auto">
              <div className="text-gold/70 text-sm">No target found</div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
