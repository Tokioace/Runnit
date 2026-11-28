import { parseApprovedLegalPages } from './parseApprovedLegalPages';
export const legalPages=parseApprovedLegalPages(import.meta.env.VITE_APPROVED_LEGAL_PAGES_JSON,
 import.meta.env.VITE_LEGAL_PAGES_ENABLED);
