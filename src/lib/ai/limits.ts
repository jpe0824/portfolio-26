/**
 * Shared between the route (request validation) and the terminal input (client-side cap), so
 * the two bounds cannot drift apart into "the client allows what the server rejects."
 */
export const MAX_QUESTION_CHARS = 500;
export const MAX_MESSAGES = 6;
