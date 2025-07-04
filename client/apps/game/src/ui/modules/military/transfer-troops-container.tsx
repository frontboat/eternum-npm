import Button from "@/ui/elements/button";
import { formatNumber } from "@/ui/utils/utils";
import { useComponentValue } from "@dojoengine/react";
import { getComponentValue } from "@dojoengine/recs";
import { getEntityIdFromKeys, getGuardsByStructure } from "@frontboat/eternum";
import { useDojo } from "@frontboat/react";
import { DEFENSE_NAMES, ID, getDirectionBetweenAdjacentHexes } from "@frontboat/types";
import { useMemo, useState } from "react";

export enum TransferDirection {
  ExplorerToStructure,
  StructureToExplorer,
  ExplorerToExplorer,
}

interface TransferTroopsContainerProps {
  selectedEntityId: ID;
  targetEntityId: ID;
  selectedHex: { x: number; y: number };
  targetHex: { x: number; y: number };
  transferDirection: TransferDirection;
  onTransferComplete: () => void;
}

export const TransferTroopsContainer = ({
  selectedEntityId,
  targetEntityId,
  selectedHex,
  targetHex,
  transferDirection,
  onTransferComplete,
}: TransferTroopsContainerProps) => {
  const {
    account: { account },
    setup: {
      systemCalls: { explorer_explorer_swap, explorer_guard_swap, guard_explorer_swap },
      components,
    },
  } = useDojo();

  const [loading, setLoading] = useState(false);
  const [troopAmount, setTroopAmount] = useState<number>(0);
  const [guardSlot, setGuardSlot] = useState<number>(0); // Default to first guard slot

  const selected = useComponentValue(components.Structure, getEntityIdFromKeys([BigInt(selectedEntityId)]));
  const target = useComponentValue(components.Structure, getEntityIdFromKeys([BigInt(targetEntityId)]));

  console.log(selected, target);

  const availableGuards = useMemo<number[]>(() => {
    if (transferDirection === TransferDirection.ExplorerToStructure) {
      // Guards are on the target structure
      if (!target) return [];
      return Array.from({ length: target.base.level + 1 }, (_, i) => i);
    } else if (transferDirection === TransferDirection.StructureToExplorer) {
      // Guards are on the selected structure
      if (!selected) return [];
      return Array.from({ length: selected.base.level + 1 }, (_, i) => i);
    } else if (transferDirection === TransferDirection.ExplorerToExplorer) {
      // Guards aren't directly involved in the same way for transfer amount calculation,
      // but the UI might use this for displaying guard slots (though it seems hidden).
      // Using selected structure's level as a fallback like the original code, with check.
      if (!selected) return [];
      return Array.from({ length: selected.base.level + 1 }, (_, i) => i);
    }
    // Default case or unknown direction
    return [];
  }, [selected, target, transferDirection]);

  // list of guards
  const targetGuards = (() => {
    if (!targetEntityId) return [];
    const structure = getComponentValue(components.Structure, getEntityIdFromKeys([BigInt(targetEntityId)]));
    if (!structure) return [];
    const guards = getGuardsByStructure(structure);
    return guards.map((guard) => ({
      ...guard,
      troops: {
        ...guard.troops,
        count: Number(guard.troops.count) / 10 ** 9,
      },
    }));
  })();

  // one explorer troop
  const targetExplorerTroops = (() => {
    if (!targetEntityId) return undefined;
    const explorers = getComponentValue(components.ExplorerTroops, getEntityIdFromKeys([BigInt(targetEntityId)]));
    if (!explorers?.troops) return undefined;
    return {
      ...explorers.troops,
      count: Number(explorers.troops.count) / 10 ** 9,
    };
  })();

  // list of guards
  const selectedGuards = (() => {
    if (!selectedEntityId) return [];
    const structure = getComponentValue(components.Structure, getEntityIdFromKeys([BigInt(selectedEntityId)]));
    if (!structure) return [];
    const guards = getGuardsByStructure(structure);
    return guards.map((guard) => ({
      ...guard,
      troops: {
        ...guard.troops,
        count: Number(guard.troops.count) / 10 ** 9,
      },
    }));
  })();

  // one explorer troop
  const selectedExplorerTroops = (() => {
    if (!selectedEntityId) return undefined;
    const explorers = getComponentValue(components.ExplorerTroops, getEntityIdFromKeys([BigInt(selectedEntityId)]));
    if (!explorers?.troops) return undefined;
    return {
      ...explorers.troops,
      count: Number(explorers.troops.count) / 10 ** 9,
    };
  })();

  const maxTroops = (() => {
    if (transferDirection === TransferDirection.ExplorerToStructure) {
      return Number(selectedExplorerTroops?.count || 0);
    } else if (transferDirection === TransferDirection.StructureToExplorer) {
      return Number(selectedGuards[guardSlot].troops.count);
    } else if (transferDirection === TransferDirection.ExplorerToExplorer) {
      return Number(selectedExplorerTroops?.count || 0);
    }
    return 0;
  })();

  // Handle troop amount change
  const handleTroopAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value);
    if (!isNaN(value) && value >= 0) {
      // Ensure we don't exceed available troops
      setTroopAmount(Math.min(value, maxTroops));
    }
  };

  // Handle transfer
  const handleTransfer = async () => {
    if (!selectedHex || !targetEntityId) return;

    const direction = getDirectionBetweenAdjacentHexes(
      { col: selectedHex.x, row: selectedHex.y },
      { col: targetHex.x, row: targetHex.y },
    );
    if (direction === null) return;

    try {
      setLoading(true);

      // Apply precision to troop amount for the transaction
      const troopAmountWithPrecision = troopAmount * 10 ** 9;

      if (transferDirection === TransferDirection.ExplorerToExplorer) {
        await explorer_explorer_swap({
          signer: account,
          from_explorer_id: selectedEntityId,
          to_explorer_id: targetEntityId,
          to_explorer_direction: direction,
          count: troopAmountWithPrecision,
        });
      } else if (transferDirection === TransferDirection.ExplorerToStructure) {
        const calldata = {
          signer: account,
          from_explorer_id: selectedEntityId,
          to_structure_id: targetEntityId,
          to_structure_direction: direction,
          to_guard_slot: guardSlot,
          count: troopAmountWithPrecision,
        };
        await explorer_guard_swap(calldata);
      } else if (transferDirection === TransferDirection.StructureToExplorer) {
        await guard_explorer_swap({
          signer: account,
          from_structure_id: selectedEntityId,
          from_guard_slot: guardSlot,
          to_explorer_id: targetEntityId,
          to_explorer_direction: direction,
          count: troopAmountWithPrecision,
        });
      }

      onTransferComplete();
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const isTroopsTransferDisabled = (() => {
    if (
      transferDirection === TransferDirection.ExplorerToStructure ||
      transferDirection === TransferDirection.StructureToExplorer
    ) {
      if (guardSlot === undefined) return true;

      // Check if troop tier and category match between selected and target
      if (transferDirection === TransferDirection.ExplorerToStructure) {
        const selectedTroop = selectedExplorerTroops;
        const targetTroop = targetGuards[guardSlot].troops;
        // If target troop count is 0, tier and category don't matter
        if (targetTroop?.count === 0) {
          return false;
        }
        return selectedTroop?.tier !== targetTroop?.tier || selectedTroop?.category !== targetTroop?.category;
      } else {
        const selectedTroop = selectedGuards[guardSlot].troops;
        const targetTroop = targetExplorerTroops;
        // If target troop count is 0, tier and category don't matter
        if (targetTroop?.count === 0) {
          return false;
        }
        return selectedTroop?.tier !== targetTroop?.tier || selectedTroop?.category !== targetTroop?.category;
      }
    }
    return troopAmount === 0;
  })();

  const getTroopMismatchMessage = () => {
    if (
      (transferDirection === TransferDirection.ExplorerToStructure ||
        transferDirection === TransferDirection.StructureToExplorer) &&
      guardSlot !== undefined
    ) {
      let selectedTroop, targetTroop;

      if (transferDirection === TransferDirection.ExplorerToStructure) {
        selectedTroop = selectedExplorerTroops;
        targetTroop = targetGuards[guardSlot].troops;
      } else {
        selectedTroop = selectedGuards[guardSlot].troops;
        targetTroop = targetExplorerTroops;
      }

      // If target troop count is 0, no mismatch message needed
      if (targetTroop?.count === 0) {
        return null;
      }

      if (selectedTroop?.tier !== targetTroop?.tier || selectedTroop?.category !== targetTroop?.category) {
        return `Troop mismatch: You can only transfer troops of the same tier and type (Tier ${selectedTroop?.tier} ${selectedTroop?.category} ≠ Tier ${targetTroop?.tier} ${targetTroop?.category})`;
      }
    }

    return null;
  };

  return (
    <div className="flex flex-col space-y-4">
      {/* Available Troops Section */}
      <div className="flex flex-col space-y-1 p-3 border border-gold/30 rounded-md bg-dark-brown/50">
        <h4 className="text-gold font-semibold text-lg">Available for Transfer</h4>
        <p className="text-gold/80 text-md">{formatNumber(maxTroops, 0)} troops</p>
        {transferDirection === TransferDirection.ExplorerToStructure && selectedExplorerTroops && (
          <p className="text-gold/70 text-sm">
            From Explorer: Tier {selectedExplorerTroops.tier} {selectedExplorerTroops.category}
          </p>
        )}
        {transferDirection === TransferDirection.StructureToExplorer &&
          selectedGuards.length > 0 &&
          guardSlot !== undefined &&
          selectedGuards[guardSlot] && (
            <p className="text-gold/70 text-sm">
              From Structure (Slot {guardSlot + 1} - {DEFENSE_NAMES[guardSlot as keyof typeof DEFENSE_NAMES]}): Tier{" "}
              {selectedGuards[guardSlot].troops.tier} {selectedGuards[guardSlot].troops.category}
            </p>
          )}
        {transferDirection === TransferDirection.ExplorerToExplorer && selectedExplorerTroops && (
          <p className="text-gold/70 text-sm">
            From Explorer: Tier {selectedExplorerTroops.tier} {selectedExplorerTroops.category}
          </p>
        )}
      </div>

      {/* Troop Amount Input Section */}
      <div className="flex flex-col space-y-2">
        <label htmlFor="troopAmountInput" className="text-gold font-semibold h6">
          Set Amount to Transfer
        </label>
        <div className="flex items-center space-x-2">
          <input
            id="troopAmountInput"
            type="range"
            min="0"
            max={maxTroops}
            value={troopAmount}
            onChange={handleTroopAmountChange}
            className="w-full accent-gold"
          />
          <input
            type="number"
            min="0"
            max={maxTroops}
            value={troopAmount}
            onChange={handleTroopAmountChange}
            className="w-20 px-2 py-1 bg-dark-brown border border-gold/30 rounded-md text-gold"
          />
        </div>
      </div>

      {/* Transferring Details Section */}
      {troopAmount > 0 && (
        <div className="flex flex-col space-y-1 p-3 border border-blue-500/50 rounded-md bg-blue-900/30 mt-4">
          <h4 className="text-blue-300 font-semibold text-lg">You will transfer:</h4>
          <p className="text-blue-200/80 text-md">{formatNumber(troopAmount, 0)} troops</p>
          {transferDirection === TransferDirection.ExplorerToStructure && selectedExplorerTroops && (
            <p className="text-blue-200/70 text-sm">
              Type: Tier {selectedExplorerTroops.tier} {selectedExplorerTroops.category}
            </p>
          )}
          {transferDirection === TransferDirection.StructureToExplorer &&
            selectedGuards.length > 0 &&
            guardSlot !== undefined &&
            selectedGuards[guardSlot] && (
              <p className="text-blue-200/70 text-sm">
                Type: Tier {selectedGuards[guardSlot].troops.tier} {selectedGuards[guardSlot].troops.category}
              </p>
            )}
          {transferDirection === TransferDirection.ExplorerToExplorer && selectedExplorerTroops && (
            <p className="text-blue-200/70 text-sm">
              Type: Tier {selectedExplorerTroops.tier} {selectedExplorerTroops.category}
            </p>
          )}
        </div>
      )}

      {(transferDirection === TransferDirection.ExplorerToStructure ||
        transferDirection === TransferDirection.StructureToExplorer) && (
        <div className="flex flex-col space-y-2 mt-4">
          <label className="text-gold font-semibold h6">Guard Slot</label>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {availableGuards.map((slotIndex) => {
              const guards =
                transferDirection === TransferDirection.ExplorerToStructure ? targetGuards : selectedGuards;
              if (!guards[slotIndex] || !guards[slotIndex].troops) {
                // This case should ideally not happen if guards are always initialized for 4 slots
                return (
                  <div
                    key={slotIndex}
                    className={`p-2 border rounded-md cursor-not-allowed bg-dark-brown border-danger- Glimmer text-light-pink/70`}
                  >
                    Slot {slotIndex + 1} - Empty/Error
                  </div>
                );
              }
              const troopInfo = guards[slotIndex].troops;
              const isActive = guardSlot === slotIndex;
              return (
                <div
                  key={slotIndex}
                  onClick={() => setGuardSlot(slotIndex)}
                  className={`p-3 border rounded-md cursor-pointer transition-all duration-150 ease-in-out \
                                                ${isActive ? "bg-gold/20 border-gold ring-2 ring-gold/50" : "bg-dark-brown border-gold/30 hover:bg-gold/10"}`}
                >
                  <div className="font-semibold text-gold">
                    {DEFENSE_NAMES[slotIndex as keyof typeof DEFENSE_NAMES]}
                  </div>
                  <div className="text-sm text-gold/80">
                    Tier {troopInfo.tier} {troopInfo.category}
                  </div>
                  <div className="text-sm text-gold/60">Available: {formatNumber(troopInfo.count, 0)}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {getTroopMismatchMessage() && <div className="text-red-500 text-sm mt-2">{getTroopMismatchMessage()}</div>}

      <div className="flex justify-center mt-6">
        <Button
          onClick={handleTransfer}
          variant="primary"
          disabled={loading || isTroopsTransferDisabled}
          isLoading={loading}
          className="w-full sm:w-auto"
        >
          {loading ? "Processing..." : "Transfer Troops"}
        </Button>
      </div>
    </div>
  );
};
