import { DojoConfig } from "@dojoengine/core";
import { world } from "@frontboat/types";

import { createClient } from "@dojoengine/sdk";

import { EternumProvider } from "@frontboat/provider";
import { defineContractComponents } from "@frontboat/types";

// Define an explicit interface for the return type
interface SetupNetworkExplicitReturn {
  toriiClient: Awaited<ReturnType<typeof createClient>>;
  contractComponents: ReturnType<typeof defineContractComponents>;
  provider: EternumProvider;
  world: typeof world;
}

export type SetupNetworkResult = Awaited<ReturnType<typeof setupNetwork>>;

export async function setupNetwork(
  config: DojoConfig,
  env: {
    vrfProviderAddress: string;
    useBurner: boolean;
  },
): Promise<SetupNetworkExplicitReturn> {
  const provider = new EternumProvider(config.manifest, config.rpcUrl, env.vrfProviderAddress);

  const toriiClient = await createClient({
    worldAddress: config.manifest.world.address || "",
    relayUrl: config.relayUrl,
    toriiUrl: config.toriiUrl,
  });

  return {
    toriiClient,
    contractComponents: defineContractComponents(world),
    provider,
    world,
  };
}
