/**
 * VoidRift Software Development — a first-party plugin (software-dev-blueprint.md §2).
 */

import type { ScopedCoreApi } from "@voidrift/core";

/**
 * The plugin entry point. The scoped CoreAPI tags every registration with this
 * plugin's id and namespaces its registry access to the plugin (core §12.4, §12.5).
 */
export function register(_core: ScopedCoreApi): void {
  // Placeholder: no registrations yet (skeleton).
}

export default { register };
