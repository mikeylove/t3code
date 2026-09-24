import type { EnvironmentId } from "@t3tools/contracts";
import type {
  HomeListFilterMenuEnvironment,
  HomeListFilterMenuProject,
} from "./home-list-filter-menu";

export type HomeHeaderEnvironment = HomeListFilterMenuEnvironment;

export interface HomeHeaderProps {
  readonly environments: ReadonlyArray<HomeHeaderEnvironment>;
  /** Every environment in scope is a thread guest session: no new task, search, or project filter. */
  readonly guestOnly: boolean;
  readonly projects: ReadonlyArray<HomeListFilterMenuProject>;
  readonly searchQuery: string;
  readonly selectedEnvironmentId: EnvironmentId | null;
  readonly selectedProjectKey: string | null;
  readonly onSearchQueryChange: (query: string) => void;
  readonly onEnvironmentChange: (environmentId: EnvironmentId | null) => void;
  readonly onProjectChange: (projectKey: string | null) => void;
  readonly onOpenEnvironments: () => void;
  readonly onOpenSettings: () => void;
  readonly onStartNewTask: () => void;
}
