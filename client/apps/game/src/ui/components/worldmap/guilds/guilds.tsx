import { CreateGuildButton } from "@/ui/components/worldmap/guilds/create-guild-button";
import { GuildListHeader, GuildRow } from "@/ui/components/worldmap/guilds/guild-list";
import { PRIZE_POOL_GUILDS } from "@/ui/constants";
import Button from "@/ui/elements/button";
import { SortInterface } from "@/ui/elements/sort-button";
import TextInput from "@/ui/elements/text-input";
import { useSocialStore } from "@/ui/modules/social/socialStore";
import { sortItems } from "@/ui/utils/utils";
import { calculateGuildLordsPrize, getGuildFromPlayerAddress } from "@frontboat/eternum";
import { useDojo, useGuilds, usePlayerWhitelist } from "@frontboat/react";
import { ContractAddress, PlayerInfo } from "@frontboat/types";
import { ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";

export const Guilds = ({
  viewGuildMembers,
  players,
}: {
  viewGuildMembers: (guildEntityId: ContractAddress) => void;
  players: PlayerInfo[];
}) => {
  const {
    setup: {
      components,
      systemCalls: { create_guild },
    },
    account: { account },
  } = useDojo();

  const {
    guildsViewGuildInvites,
    guildsGuildSearchTerm,
    guildsActiveSort,
    setGuildsViewGuildInvites,
    setGuildsGuildSearchTerm,
    setGuildsActiveSort,
  } = useSocialStore();

  const [isLoading, setIsLoading] = useState(false);
  const [isCreatingGuild, setIsCreatingGuild] = useState(false);
  const [isPublic, setIsPublic] = useState(true);
  const [guildName, setGuildName] = useState("");
  const [activeSort, setActiveSort] = useState<SortInterface>({
    sortKey: "rank",
    sort: "asc",
  });

  const guilds = useGuilds();
  const guildInvites = usePlayerWhitelist(ContractAddress(account.address));
  const playerGuild = useMemo(
    () => getGuildFromPlayerAddress(ContractAddress(account.address), components),
    [account.address, components, isLoading],
  );

  // Aggregate player data per guild
  const guildsWithStats = useMemo(() => {
    const guildStats = new Map<
      string,
      {
        totalPoints: number;
        totalRealms: number;
        totalMines: number;
        totalHypers: number;
        memberCount: number;
      }
    >();

    players.forEach((player) => {
      const guild = getGuildFromPlayerAddress(player.address, components);
      if (guild) {
        const stats = guildStats.get(guild.entityId.toString()) || {
          totalPoints: 0,
          totalRealms: 0,
          totalMines: 0,
          totalHypers: 0,
          memberCount: 0,
        };

        stats.totalPoints += player.points || 0;
        stats.totalRealms += player.realms || 0;
        stats.totalMines += player.mines || 0;
        stats.totalHypers += player.hyperstructures || 0;
        stats.memberCount++;

        guildStats.set(guild.entityId.toString(), stats);
      }
    });

    return guilds
      .map((guild) => {
        const stats = guildStats.get(guild.entityId.toString()) || {
          totalPoints: 0,
          totalRealms: 0,
          totalMines: 0,
          totalHypers: 0,
          memberCount: 0,
        };
        return {
          ...guild,
          points: stats.totalPoints,
          realms: stats.totalRealms,
          mines: stats.totalMines,
          hyperstructures: stats.totalHypers,
          memberCount: stats.memberCount,
        };
      })
      .sort((a, b) => b.points - a.points)
      .map((guild, index) => {
        const rank = index + 1;
        return {
          ...guild,
          rank,
          lords: calculateGuildLordsPrize(rank, PRIZE_POOL_GUILDS),
        };
      });
  }, [guilds, players]);

  const filteredGuilds = useMemo(
    () =>
      sortItems(
        guildsWithStats.filter((guild) => {
          const nameMatch = guild.name.toLowerCase().startsWith(guildsGuildSearchTerm.toLowerCase());
          console.log(guildInvites);
          if (guildsViewGuildInvites) {
            return (
              nameMatch &&
              guildInvites.some((invite) => {
                return invite.guildEntityId === Number(guild.entityId);
              })
            );
          }
          return nameMatch;
        }),
        guildsActiveSort,
        { sortKey: "rank", sort: "asc" },
      ),
    [guildsWithStats, guildsGuildSearchTerm, guildInvites, guildsViewGuildInvites, guildsActiveSort],
  );

  const handleCreateGuild = async (guildName: string, isPublic: boolean) => {
    setIsLoading(true);
    try {
      await create_guild({
        is_public: isPublic,
        guild_name: guildName,
        signer: account,
      });
      // Assuming synchronous success or if create_guild doesn't throw,
      // optimistically update UI.
      setIsCreatingGuild(false); // Close the form
      setGuildName(""); // Reset form state
      setIsPublic(true); // Reset form state
    } catch (error) {
      console.error("Failed to create guild:", error);
      // On error, form remains open, isLoading will become false.
    } finally {
      setIsLoading(false);
    }
  };

  const toggleIsCreatingGuild = () => {
    const willBeCreating = !isCreatingGuild;
    setIsCreatingGuild(willBeCreating);
    if (willBeCreating) {
      // If opening the form
      setGuildName("");
      setIsPublic(true);
    }
  };

  return (
    <div className="flex flex-col min-h-72 h-full w-full p-4 overflow-hidden">
      <div className="flex flex-col space-y-4 mb-4">
        <div className="flex flex-row gap-4 justify-between">
          <Button onClick={() => setGuildsViewGuildInvites(!guildsViewGuildInvites)}>
            {guildsViewGuildInvites ? "Show Tribe Rankings" : "Show Tribe Invites"}
          </Button>
          {playerGuild?.entityId ? (
            <Button variant="gold" onClick={() => viewGuildMembers(playerGuild.entityId)}>
              Tribe {playerGuild.name}
              <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          ) : (
            <Button isLoading={isLoading} variant="primary" className="w-full" onClick={toggleIsCreatingGuild}>
              Create Tribe
            </Button>
          )}
        </div>

        {!playerGuild?.entityId && isCreatingGuild && (
          <CreateGuildButton
            handleCreateGuild={handleCreateGuild}
            guildName={guildName}
            setGuildName={setGuildName}
            isPublic={isPublic}
            setIsPublic={setIsPublic}
          />
        )}
        <TextInput
          placeholder="Search Tribe . . ."
          value={guildsGuildSearchTerm}
          onChange={(searchTerm) => setGuildsGuildSearchTerm(searchTerm)}
          className="w-full button-wood"
        />
      </div>

      <div className="flex-1 min-h-0">
        <div className="flex flex-col h-full rounded-xl backdrop-blur-sm">
          <GuildListHeader activeSort={guildsActiveSort} setActiveSort={setGuildsActiveSort} />
          <div className="mt-4 overflow-y-auto scrollbar-thin scrollbar-thumb-gold/20 scrollbar-track-transparent">
            {filteredGuilds.map((guild) => (
              <GuildRow key={guild.entityId} guild={guild} onClick={() => viewGuildMembers(guild.entityId)} />
            ))}
            {!filteredGuilds.length && guildsViewGuildInvites && (
              <p className="text-center italic text-gold/70 py-4">No Tribe Invites Received</p>
            )}
            {!filteredGuilds.length && !guildsViewGuildInvites && guildsGuildSearchTerm && (
              <p className="text-center italic text-gold/70 py-4">No Tribes Found</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
