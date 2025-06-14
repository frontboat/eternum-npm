import useStore from "@/shared/store";
import { AndComposeClause, MemberClause } from "@dojoengine/sdk";
import { Query } from "@dojoengine/torii-wasm";
import { divideByPrecision } from "@frontboat/eternum";
import { useDojo } from "@frontboat/react";
import { useEffect, useState } from "react";

export interface Position {
  x: number;
  y: number;
}

export const useArmiesInRadius = (center: Position | null, radius = 40) => {
  const {
    network: { toriiClient },
  } = useDojo();
  const { selectedRealm } = useStore();
  const [armies, setArmies] = useState<any[] | []>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const queryArmies = async () => {
      if (!center) return;

      setIsLoading(true);
      setError(null);

      try {
        const query: Query = {
          pagination: {
            limit: 1000,
            cursor: undefined,
            direction: "Forward",
            order_by: [],
          },
          models: ["s1_eternum-ExplorerTroops"],
          no_hashed_keys: false,
          historical: false,
          clause: AndComposeClause([
            MemberClause("s1_eternum-ExplorerTroops", "coord.x", "Gte", center.x - radius),
            MemberClause("s1_eternum-ExplorerTroops", "coord.x", "Lte", center.x + radius),
            MemberClause("s1_eternum-ExplorerTroops", "coord.y", "Gte", center.y - radius),
            MemberClause("s1_eternum-ExplorerTroops", "coord.y", "Lte", center.y + radius),
          ]).build(),
        };

        const results = await toriiClient.getEntities(query);
        let armies = Object.values(results).map((army) => {
          const owner = army["s1_eternum-ExplorerTroops"]["owner"]["value"];
          const isEnemy = owner !== selectedRealm?.entityId;
          const count = divideByPrecision(
            // @ts-ignore
            Number(army["s1_eternum-ExplorerTroops"]["troops"]["value"]["count"]["value"]),
          );
          // @ts-ignore
          const troopType = army["s1_eternum-ExplorerTroops"]["troops"]["value"]["category"]["value"]["option"];
          // @ts-ignore
          const tier = army["s1_eternum-ExplorerTroops"]["troops"]["value"]["tier"]["value"]["option"];
          const id = army["s1_eternum-ExplorerTroops"]["explorer_id"]["value"];
          // @ts-ignore
          const x = army["s1_eternum-ExplorerTroops"]["coord"]["value"]["x"]["value"];
          // @ts-ignore
          const y = army["s1_eternum-ExplorerTroops"]["coord"]["value"]["y"]["value"];
          const distance = Math.round(Math.sqrt((x - center.x) ** 2 + (y - center.y) ** 2));
          return { owner, count, troopType, id, tier, x, y, distance, isEnemy };
        });
        armies = armies.filter((army) => army.isEnemy);
        if (armies.length > 0) {
          setArmies(armies);
        } else {
          setArmies([]);
        }
      } catch (err) {
        setError(err instanceof Error ? err : new Error("Failed to fetch armies"));
      } finally {
        setIsLoading(false);
      }
    };

    queryArmies();

    // Refresh every 3 minutes
    const interval = setInterval(queryArmies, 180000);

    return () => clearInterval(interval);
  }, [toriiClient, center, radius]);

  return {
    armies,
    isLoading,
    error,
    count: armies ? Object.keys(armies).length : 0,
  };
};
