import { createAdapterActionCapability } from "../../../core/runtime/capability-helpers.js";
import {
  printShoppingAccountResult,
  printShoppingCartResult,
  printShoppingOrderDetailResult,
  printShoppingOrdersResult,
  printShoppingProductResult,
  printShoppingSearchResult,
  printShoppingStatusResult,
  printShoppingWishlistResult,
} from "./output.js";
import { parseShoppingLimitOption } from "./options.js";

import type { AdapterActionResult } from "../../../types.js";
import type { PlatformCapability } from "../../../core/runtime/platform-definition.js";
import type { BaseShoppingAdapter } from "./base-shopping-adapter.js";

export function createShoppingCapabilities(adapter: BaseShoppingAdapter): readonly PlatformCapability[] {
  const capabilities: PlatformCapability[] = [
    createAdapterActionCapability({
      id: "login",
      command: "login",
      description: `Import cookies and save the ${adapter.displayName} session for future CLI use`,
      spinnerText: `Importing ${adapter.displayName} session...`,
      successMessage: `${adapter.displayName} session imported.`,
      options: [
        { flags: "--cookies <path>", description: "Path to cookies.txt or a JSON cookie export" },
        { flags: "--account <name>", description: "Optional saved alias instead of the default session name" },
        { flags: "--cookie-string <value>", description: "Raw cookie string instead of a file" },
        { flags: "--cookie-json <json>", description: "Inline JSON cookie array or jar export" },
      ],
      action: ({ options }) =>
        adapter.login({
          account: options.account as string | undefined,
          cookieFile: options.cookies as string | undefined,
          cookieString: options.cookieString as string | undefined,
          cookieJson: options.cookieJson as string | undefined,
        }),
    }),
    createAdapterActionCapability({
      id: "status",
      command: "status",
      description: `Show the saved ${adapter.displayName} session status`,
      spinnerText: `Checking ${adapter.displayName} session status...`,
      successMessage: `${adapter.displayName} status loaded.`,
      options: [{ flags: "--account <name>", description: "Optional saved session name to inspect" }],
      action: ({ options }) => adapter.statusAction(options.account as string | undefined),
      onSuccess: printShoppingStatusResult,
    }),
    createAdapterActionCapability({
      id: "search",
      command: "search <query>",
      description: `Search ${adapter.displayName} products`,
      spinnerText: `Searching ${adapter.displayName}...`,
      successMessage: `${adapter.displayName} search completed.`,
      options: [
        {
          flags: "--limit <number>",
          description: "Maximum number of results to return (1-25, default: 5)",
          parser: parseShoppingLimitOption,
        },
      ],
      action: ({ args, options }) =>
        adapter.search({
          query: String(args[0] ?? ""),
          limit: options.limit as number | undefined,
        }),
      onSuccess: printShoppingSearchResult,
    }),
    createAdapterActionCapability({
      id: "product",
      command: "product <target>",
      aliases: ["item", "info"],
      description: `Load exact ${adapter.displayName} product details by URL or ${adapter.productTargetLabel}`,
      spinnerText: `Loading ${adapter.displayName} product details...`,
      successMessage: `${adapter.displayName} product details loaded.`,
      action: ({ args }) =>
        adapter.productInfo({
          target: String(args[0] ?? ""),
        }),
      onSuccess: printShoppingProductResult,
    }),
    createAdapterActionCapability({
      id: "orders",
      command: "orders",
      description: `List recent ${adapter.displayName} orders using the latest saved session by default`,
      spinnerText: `Loading ${adapter.displayName} orders...`,
      successMessage: `${adapter.displayName} orders loaded.`,
      options: [
        { flags: "--account <name>", description: "Optional saved session name to use" },
        {
          flags: "--limit <number>",
          description: "Maximum number of orders to return (1-25, default: 5)",
          parser: parseShoppingLimitOption,
        },
      ],
      action: ({ options }) =>
        adapter.orders({
          account: options.account as string | undefined,
          limit: options.limit as number | undefined,
        }),
      onSuccess: printShoppingOrdersResult,
    }),
  ];

  const extendedAdapter = adapter as BaseShoppingAdapter & Partial<ShoppingRichAdapter>;

  if (typeof extendedAdapter.accountSummary === "function") {
    capabilities.push(
      createAdapterActionCapability({
        id: "account",
        command: "account",
        aliases: ["me", "profile"],
        description: `Load the saved ${adapter.displayName} account overview`,
        spinnerText: `Loading ${adapter.displayName} account details...`,
        successMessage: `${adapter.displayName} account details loaded.`,
        options: [{ flags: "--account <name>", description: "Optional saved session name to use" }],
        action: ({ options }) =>
          extendedAdapter.accountSummary!({
            account: options.account as string | undefined,
          }),
        onSuccess: printShoppingAccountResult,
      }),
    );
  }

  if (typeof extendedAdapter.wishlist === "function") {
    capabilities.push(
      createAdapterActionCapability({
        id: "wishlist",
        command: "wishlist",
        aliases: ["saved"],
        description: `Load the saved ${adapter.displayName} wishlist`,
        spinnerText: `Loading ${adapter.displayName} wishlist...`,
        successMessage: `${adapter.displayName} wishlist loaded.`,
        options: [
          { flags: "--account <name>", description: "Optional saved session name to use" },
          {
            flags: "--limit <number>",
            description: "Maximum number of wishlist items to return (1-25, default: 5)",
            parser: parseShoppingLimitOption,
          },
        ],
        action: ({ options }) =>
          extendedAdapter.wishlist!({
            account: options.account as string | undefined,
            limit: options.limit as number | undefined,
          }),
        onSuccess: printShoppingWishlistResult,
      }),
    );
  }

  if (typeof extendedAdapter.cart === "function") {
    capabilities.push(
      createAdapterActionCapability({
        id: "cart",
        command: "cart",
        description: `Load the saved ${adapter.displayName} cart`,
        spinnerText: `Loading ${adapter.displayName} cart...`,
        successMessage: `${adapter.displayName} cart loaded.`,
        options: [{ flags: "--account <name>", description: "Optional saved session name to use" }],
        action: ({ options }) =>
          extendedAdapter.cart!({
            account: options.account as string | undefined,
          }),
        onSuccess: printShoppingCartResult,
      }),
    );
  }

  if (typeof extendedAdapter.orderDetail === "function") {
    capabilities.push(
      createAdapterActionCapability({
        id: "order",
        command: "order <target>",
        aliases: ["order-detail"],
        description: `Load exact ${adapter.displayName} order details by order ID`,
        spinnerText: `Loading ${adapter.displayName} order details...`,
        successMessage: `${adapter.displayName} order details loaded.`,
        options: [{ flags: "--account <name>", description: "Optional saved session name to use" }],
        action: ({ args, options }) =>
          extendedAdapter.orderDetail!({
            account: options.account as string | undefined,
            target: String(args[0] ?? ""),
          }),
        onSuccess: printShoppingOrderDetailResult,
      }),
    );
  }

  return capabilities;
}

interface ShoppingRichAdapter {
  accountSummary(input: { account?: string }): Promise<AdapterActionResult>;
  wishlist(input: { account?: string; limit?: number }): Promise<AdapterActionResult>;
  cart(input: { account?: string }): Promise<AdapterActionResult>;
  orderDetail(input: { account?: string; target: string }): Promise<AdapterActionResult>;
}
