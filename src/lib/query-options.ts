import { queryOptions } from "@tanstack/react-query";
import {
  getCurrentUser,
  getDashboardStats,
  getClients,
  getClient,
  getDocuments,
  getVatOverview,
  getPortalStats,
  getPortalDocuments,
} from "./server-functions";

export const currentUserQueryOptions = () =>
  queryOptions({ queryKey: ["current-user"], queryFn: () => getCurrentUser() });

export const dashboardStatsQueryOptions = () =>
  queryOptions({ queryKey: ["dashboard-stats"], queryFn: () => getDashboardStats() });

export const clientsQueryOptions = () =>
  queryOptions({ queryKey: ["clients"], queryFn: () => getClients() });

export const clientQueryOptions = (clientId: string) =>
  queryOptions({ queryKey: ["client", clientId], queryFn: () => getClient({ data: { clientId } }) });

export const documentsQueryOptions = () =>
  queryOptions({ queryKey: ["documents"], queryFn: () => getDocuments() });

export const vatQueryOptions = (month: number, year: number) =>
  queryOptions({ queryKey: ["vat", month, year], queryFn: () => getVatOverview({ data: { month, year } }) });

export const portalStatsQueryOptions = () =>
  queryOptions({ queryKey: ["portal-stats"], queryFn: () => getPortalStats() });

export const portalDocumentsQueryOptions = () =>
  queryOptions({ queryKey: ["portal-documents"], queryFn: () => getPortalDocuments() });
