/**
 * The start of the current day, midnight UTC. Ghana keeps UTC all year, so
 * "today" for a sub-admin's limits and lists begins at local midnight there.
 */
export function startOfToday(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
}
