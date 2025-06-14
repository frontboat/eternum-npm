import { useUIStore } from "@/hooks/store/use-ui-store";
import { Position } from "@/types/position";
import { usePlayerArmyAtPosition, useQuery } from "@frontboat/react";
import { HexPosition } from "@frontboat/types";
import { SelectedArmyContent } from "../armies/selected-army-content";

export const SelectedWorldmapEntity = () => {
  const { isMapView } = useQuery();

  const selectedHex = useUIStore((state) => state.selectedHex);

  if (!isMapView || !selectedHex) return null;

  return <SelectedWorldmapEntityContent selectedHex={selectedHex} />;
};

const SelectedWorldmapEntityContent = ({ selectedHex }: { selectedHex: HexPosition }) => {
  const playerArmy = usePlayerArmyAtPosition({
    position: new Position({ x: selectedHex?.col || 0, y: selectedHex?.row || 0 }).getContract(),
  });

  return playerArmy ? <SelectedArmyContent playerArmy={playerArmy} /> : null;
};
