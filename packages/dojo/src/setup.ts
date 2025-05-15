import { DojoConfig } from "@dojoengine/core";
import {
    ClientComponents,
    createClientComponents,
    createSystemCalls,
    SystemCallAuthHandler,
    SystemCalls,
} from "@frontboat/types";
import { setupNetwork, SetupNetworkResult } from "./setup-network";

export type SetupResult = Awaited<ReturnType<typeof setup>>;

export interface SetupReturnValue {
  network: SetupNetworkResult;
  components: ClientComponents;
  systemCalls: SystemCalls;
}

export async function setup(
  config: DojoConfig,
  env: { vrfProviderAddress: string; useBurner: boolean },
  authHandler?: SystemCallAuthHandler,
): Promise<SetupReturnValue> {
  const network = await setupNetwork(config, env);
  const components = createClientComponents(network);
  const systemCalls = createSystemCalls({
    provider: network.provider,
    authHandler,
  });

  return {
    network,
    components,
    systemCalls,
  };
}
