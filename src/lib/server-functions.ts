// Re-export from refactored modules for backward compat
export { getCurrentUser, createOffice } from "./server-functions/auth";
export { getDashboardStats } from "./server-functions/dashboard";
export { getClients, getClient, createClient } from "./server-functions/clients";
export { getDocuments, updateDocumentStatus, updateDocumentFields, createDocumentRecord, moveDocumentPeriod, deleteDocuments } from "./server-functions/documents";
export { getVatOverview } from "./server-functions/vat";
export { getPortalStats, getPortalDocuments } from "./server-functions/portal";
export {
  getNylasConnectUrl,
  exchangeNylasCode,
  disconnectEmail,
  triggerEmailScan,
  resetEmailSyncPeriod,
  detectEmailProvider,
} from "./server-functions/nylas";
