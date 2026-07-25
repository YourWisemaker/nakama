import { useLocation, useNavigate } from "react-router-dom";
import { PlusIcon } from "lucide-react";
import { ProfileAvatar } from "@/components/ProfileAvatar";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useProfilesQuery } from "@/hooks/use-app-queries";
import { useAuth } from "@/context/use-auth";
import {
  buildNewChatPath,
  chatProfileIdFromPath,
  readRequestedProfileFromNewChatSearch,
} from "@/lib/chat-history";
import { PAGE_PATHS, pathForPage } from "@/lib/navigation";
import { cn } from "@/lib/utils";

export function ProfileRail() {
  const { data: profiles = [] } = useProfilesQuery();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const isHistory = location.pathname === PAGE_PATHS.history;

  const activeProfileId = (() => {
    if (isHistory) {
      return new URLSearchParams(location.search).get("profile");
    }
    const fromPath = chatProfileIdFromPath(location.pathname);
    if (fromPath) {
      return fromPath;
    }
    if (location.pathname === "/chat") {
      return readRequestedProfileFromNewChatSearch(location.search);
    }
    return null;
  })();

  function handleSelectProfile(profileId: string) {
    if (isHistory) {
      const params = new URLSearchParams(location.search);
      params.set("profile", profileId);
      navigate(`${PAGE_PATHS.history}?${params.toString()}`);
      return;
    }
    navigate(buildNewChatPath(profileId));
  }

  return (
    <div
      aria-label="Profiles"
      className="flex h-full w-14 shrink-0 flex-col items-center gap-2 border-r border-border/50 bg-sidebar/60 py-3"
    >
      <a
        href="/chat"
        aria-label="Nakama"
        title="Nakama"
        className="flex size-9 shrink-0 items-center justify-center rounded-xl transition-opacity hover:opacity-80"
      >
        <img
          src="/nakama.png"
          alt=""
          className="size-8 rounded-lg object-contain"
        />
      </a>

      <div className="no-scrollbar flex min-h-0 flex-1 flex-col items-center gap-1.5 overflow-y-auto p-1">
        {profiles.map((profile) => {
          const active = profile.id === activeProfileId;
          const trigger = (
            <button
              type="button"
              onClick={() => handleSelectProfile(profile.id)}
              aria-label={profile.name}
              aria-current={active ? "true" : undefined}
              title={profile.name}
              className={cn(
                "group relative flex size-9 shrink-0 items-center justify-center rounded-xl transition-all duration-150",
                active
                  ? "ring-2 ring-primary"
                  : "opacity-80 hover:opacity-100",
              )}
            >
              <ProfileAvatar
                profile={profile}
                size="sm"
                className="size-9 rounded-xl"
              />
            </button>
          );

          return (
            <Tooltip key={profile.id}>
              <TooltipTrigger render={trigger} />
              <TooltipContent side="right" sideOffset={8}>
                {profile.name}
              </TooltipContent>
            </Tooltip>
          );
        })}

        {user?.isPlatformAdmin ? (
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Manage profiles"
                  title="Manage profiles"
                  onClick={() => navigate(pathForPage("profiles"))}
                  className="text-muted-foreground/70 hover:text-foreground"
                >
                  <PlusIcon className="size-4" strokeWidth={1.75} />
                </Button>
              }
            />
            <TooltipContent side="right" sideOffset={8}>
              Manage profiles
            </TooltipContent>
          </Tooltip>
        ) : null}
      </div>
    </div>
  );
}
