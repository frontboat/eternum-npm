import { ResourceManager } from "@frontboat/eternum";
import { Building, RealmInfo, ResourcesIds } from "@frontboat/types";

export interface ResourceAmount {
  resourceId: ResourcesIds;
  amount: number;
}

export interface LaborBuilding extends Building {
  isActive: boolean;
  productionTimeLeft: number;
  balance?: number;
}

export interface ResourceBalance {
  resourceId: ResourcesIds;
  balance: number;
}

export interface LaborBuildingProps {
  building: LaborBuilding;
  resourceManager: ResourceManager;
  realm: RealmInfo;
}
