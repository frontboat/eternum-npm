import { useDojo } from "@frontboat/react";
import { useProvider } from "@starknet-react/core";
import { initMetagame, MetagameClient, MetagameProvider as MetagameProviderSDK } from "metagame-sdk";
import { ReactNode, useEffect, useState } from "react";
import { dojoConfig } from "../../../dojoConfig";

export const MetagameProvider = ({ children }: { children: ReactNode }) => {
  const {
    setup: {
      network: { toriiClient },
    },
  } = useDojo();
  const [metagameClient, setMetagameClient] = useState<MetagameClient<any> | null>(null);
  const { provider } = useProvider();

  useEffect(() => {
    async function initialize() {
      const metagameClient = initMetagame<any>({
        toriiUrl: dojoConfig.toriiUrl,
        provider: provider,
        toriiClient: toriiClient,
      });

      setMetagameClient(metagameClient);
    }

    initialize();
  }, []);

  if (!metagameClient) {
    return <div>Loading...</div>;
  }

  return <MetagameProviderSDK metagameClient={metagameClient!}>{children}</MetagameProviderSDK>;
};
