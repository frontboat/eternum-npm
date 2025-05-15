import { ContractAddress } from "@frontboat/types";

export type CoOwnersWithTimestamp = {
  coOwners: {
    address: ContractAddress;
    percentage: number;
  }[];
  timestamp: number;
};
