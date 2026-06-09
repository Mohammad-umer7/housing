// Federal service registry. Maps a service id to its ServiceModule. Adding a new
// federal service to SADDAD is a single registry entry + one governance module —
// the agent pipeline, tools, auth, audit and dashboard do not change.
//
// This is the concrete artifact behind the "platform, not a one-off" claim in
// docs/PITCH.md, and is exercised by tests/service-registry.test.ts.

import { housingArrearsModule } from './housing-arrears'
import { visaRenewalModule } from './visa-renewal'
import type { ServiceModule } from './types'

export const SERVICE_REGISTRY: Record<string, ServiceModule> = {
  [housingArrearsModule.id]: housingArrearsModule,
  [visaRenewalModule.id]: visaRenewalModule,
}

export function getServiceModule(id: string): ServiceModule | null {
  return SERVICE_REGISTRY[id] ?? null
}

export function listServices(): Array<{ id: string; displayName: string; ruleCount: number }> {
  return Object.values(SERVICE_REGISTRY).map((m) => ({
    id: m.id,
    displayName: m.displayName,
    ruleCount: m.ruleCount,
  }))
}
