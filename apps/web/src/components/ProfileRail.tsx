import { useLocation, useNavigate } from "react-router-dom";
import { PlusIcon } from "lucide-react";
import { SidebarUserMenu } from "@/components/SidebarUserMenu";
import { ProfileAvatar } from "@/components/ProfileAvatar";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useProfilesQuery } from "@/hooks/use-app-queries";
import { useAuth } from "@/context/use-auth";
import { useActiveChatProfile } from "@/context/use-active-chat-profile";
import {
  buildChatBasePath,
  isChatSessionPath,
  resolveActiveProfileIdFromLocation,
} from "@/lib/chat-history";
import { PAGE_PATHS, pathForPage } from "@/lib/navigation";
import { cn } from "@/lib/utils";

export function ProfileRail() {
  const { data: profiles = [] } = useProfilesQuery();
  const { user } = useAuth();
  const { profileId: liveChatProfileId, setProfileId: setLiveChatProfileId } =
    useActiveChatProfile();
  const navigate = useNavigate();
  const location = useLocation();

  const activeProfileId = resolveActiveProfileIdFromLocation({
    pathname: location.pathname,
    search: location.search,
    profiles,
    liveChatProfileId,
    historyPath: PAGE_PATHS.history,
  });

  function handleSelectProfile(profileId: string) {
    if (profileId === activeProfileId) {
      return;
    }

    setLiveChatProfileId(profileId);

    if (location.pathname === PAGE_PATHS.history) {
      const params = new URLSearchParams(location.search);
      params.set("profile", profileId);
      navigate(`${PAGE_PATHS.history}?${params.toString()}`);
      return;
    }

    // Draft /chat: profile travels via context; ChatPage resets state in place.
    if (location.pathname === buildChatBasePath()) {
      return;
    }

    navigate(buildChatBasePath(), {
      replace: isChatSessionPath(location.pathname),
    });
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

      <div className="no-scrollbar flex min-h-0 flex-1 flex-col items-center gap-1.5 overflow-y-auto px-1 py-1">
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
                "group relative flex size-7 shrink-0 items-center justify-center rounded-md transition-all duration-150",
                active
                  ? "bg-background shadow-sm ring-2 ring-primary ring-offset-1 ring-offset-sidebar/60"
                  : "hover:bg-muted/40",
              )}
            >
              <ProfileAvatar
                profile={profile}
                size="sm"
                className={cn(
                  "size-7 rounded-md transition-all duration-150",
                  active
                    ? "opacity-100 saturate-100"
                    : "opacity-45 grayscale group-hover:opacity-70 group-hover:grayscale-0",
                )}
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

      <div className="flex shrink-0 flex-col items-center">
        <SidebarUserMenu />
      </div>
    </div>
  );
}
