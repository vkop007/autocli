import { createAdapterActionCapability } from "../../../../core/runtime/capability-helpers.js";
import { createCookieLoginOptions, resolveCookieLoginInput } from "../../../shared/cookie-login.js";
import { gitlabAdapter, type GitLabAdapter } from "../adapter.js";
import { printGitLabIdentityResult } from "../output.js";

export function createGitLabLoginCapability(adapter: GitLabAdapter) {
  return createAdapterActionCapability({
    id: "login",
    command: "login",
    description: `Import cookies and save the ${adapter.displayName} web session for future CLI use`,
    spinnerText: `Importing ${adapter.displayName} session...`,
    successMessage: `${adapter.displayName} session saved.`,
    options: createCookieLoginOptions(),
    action: ({ options }) => adapter.login(resolveCookieLoginInput(options)),
    onSuccess: printGitLabIdentityResult,
  });
}

export const gitlabLoginCapability = createGitLabLoginCapability(gitlabAdapter);
