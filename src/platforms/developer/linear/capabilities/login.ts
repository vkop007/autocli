import { createAdapterActionCapability } from "../../../../core/runtime/capability-helpers.js";
import { createCookieLoginOptions, resolveCookieLoginInput } from "../../../shared/cookie-login.js";
import { linearAdapter, type LinearAdapter } from "../adapter.js";
import { printLinearIdentityResult } from "../output.js";

export function createLinearLoginCapability(adapter: LinearAdapter) {
  return createAdapterActionCapability({
    id: "login",
    command: "login",
    description: "Import cookies and save the Linear web session for future CLI use",
    spinnerText: "Importing Linear session...",
    successMessage: "Linear session saved.",
    options: createCookieLoginOptions(),
    action: ({ options }) => adapter.login(resolveCookieLoginInput(options)),
    onSuccess: printLinearIdentityResult,
  });
}

export const linearLoginCapability = createLinearLoginCapability(linearAdapter);
