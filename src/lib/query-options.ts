import { queryOptions } from "@tanstack/react-query";
import { getDashboard, getDeals, getReps, getRep, getCompPlans, getCurrentUser } from "./server-functions";

export const dashboardQueryOptions = () =>
  queryOptions({ queryKey: ["dashboard"], queryFn: () => getDashboard() });

export const dealsQueryOptions = () =>
  queryOptions({ queryKey: ["deals"], queryFn: () => getDeals() });

export const repsQueryOptions = () =>
  queryOptions({ queryKey: ["reps"], queryFn: () => getReps() });

export const repQueryOptions = (repId: string) =>
  queryOptions({ queryKey: ["rep", repId], queryFn: () => getRep({ data: { repId } }) });

export const compPlansQueryOptions = () =>
  queryOptions({ queryKey: ["comp-plans"], queryFn: () => getCompPlans() });

export const currentUserQueryOptions = () =>
  queryOptions({ queryKey: ["current-user"], queryFn: () => getCurrentUser() });
