import { createAdapterActionCapability } from "../../../../core/runtime/capability-helpers.js";
import { createCookieLoginOptions, resolveCookieLoginInput } from "../../../shared/cookie-login.js";
import { linkedinAdapter } from "../adapter.js";

export const linkedinLoginCapability = createAdapterActionCapability({
  id: "login",
  command: "login",
  description: "Import cookies and save the LinkedIn session for future headless use",
  spinnerText: "Importing LinkedIn session...",
  successMessage: "LinkedIn session imported.",
  options: createCookieLoginOptions(),
  action: ({ options }) => linkedinAdapter.login(resolveCookieLoginInput(options)),
});
