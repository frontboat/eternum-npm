import { configManager } from "@frontboat/eternum";
import { TickIds } from "@frontboat/types";

export const getBlockTimestamp = () => {
  const timestamp = Math.floor(Date.now() / 1000);
  const tickConfigArmies = configManager.getTick(TickIds.Armies);
  const tickConfigDefault = configManager.getTick(TickIds.Default);

  const currentDefaultTick = Math.floor(timestamp / Number(tickConfigDefault));
  const currentArmiesTick = Math.floor(timestamp / Number(tickConfigArmies));

  return {
    currentBlockTimestamp: timestamp,
    currentDefaultTick,
    currentArmiesTick,
  };
};
