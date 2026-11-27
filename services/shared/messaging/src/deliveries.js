/**
 * Delivery attempts allowed for one message before it is set aside, the same in every
 * adapter: a handler that keeps failing must not retry the same message forever.
 */
export const MAX_DELIVERIES = 5;
