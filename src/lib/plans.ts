export type OrganizationPlan = "free" | "pro";
export type PlanResource = "properties" | "rooms" | "members";

export const PLAN_LIMITS: Record<OrganizationPlan, Record<PlanResource, number | null>> = {
  free: { properties: 1, rooms: 10, members: 3 },
  pro: { properties: null, rooms: null, members: null },
};

export function formatPlanLimit(limit: number | null) {
  return limit === null ? "Tanpa batas" : String(limit);
}
