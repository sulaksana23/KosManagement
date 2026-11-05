export function hasLeaseConflictAtMoveIn(moveInDate: string, activeLeaseEndDates: (string | null)[]) {
  return activeLeaseEndDates.some((endDate) => endDate === null || endDate >= moveInDate);
}
