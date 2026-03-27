import { AutoCliError } from "../../../errors.js";
import { SessionHttpClient } from "../../../utils/http-client.js";
import { parseAmazonProductTarget } from "../../../utils/targets.js";
import { getPlatformHomeUrl, getPlatformOrigin } from "../../config.js";
import { BaseShoppingAdapter, type ShoppingSessionProbe } from "../shared/base-shopping-adapter.js";
import { clamp, collapseWhitespace, parsePriceText, toAbsoluteUrl } from "../shared/helpers.js";

import type { AdapterActionResult, PlatformSession } from "../../../types.js";

const AMAZON_ORIGIN = getPlatformOrigin("amazon");
const AMAZON_HOME = getPlatformHomeUrl("amazon");
const AMAZON_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36";

interface AmazonSearchResult {
  asin: string;
  title: string;
  url?: string;
  imageUrl?: string;
  priceText?: string;
  price?: number;
  currency?: string;
  rating?: number;
  ratingCount?: number;
  sponsored?: boolean;
}

interface AmazonProductInfo {
  asin: string;
  title: string;
  url: string;
  priceText?: string;
  price?: number;
  currency?: string;
  rating?: number;
  ratingCount?: number;
  availability?: string;
  brand?: string;
  description?: string;
  imageUrl?: string;
  features: string[];
}

interface AmazonCartData {
  count: number;
  subtotalText?: string;
  empty: boolean;
  items: Array<Record<string, unknown>>;
}

interface AmazonOrdersPageSummary {
  visibleCount?: number;
  timeFilterLabel?: string;
  timeFilterValue?: string;
  availableTimeFilters: Array<{ value: string; label: string }>;
  empty: boolean;
}

export class AmazonAdapter extends BaseShoppingAdapter {
  readonly platform = "amazon" as const;
  readonly productTargetLabel = "ASIN";

  async accountSummary(input: { account?: string }): Promise<AdapterActionResult> {
    const { session } = await this.ensureActiveSession(input.account);
    const client = await this.createAmazonClient(session);
    const html = await this.fetchAmazonAccountLikeHtml(client, session);
    const summary = extractAmazonAccountSummary(html, this.getAmazonOrigin(session));

    return {
      ok: true,
      platform: this.platform,
      account: session.account,
      action: "account",
      message: `Loaded Amazon account overview for ${session.account}.`,
      user: summary.user,
      data: summary.data,
    };
  }

  async wishlist(input: { limit?: number; account?: string }): Promise<AdapterActionResult> {
    const { session } = await this.ensureActiveSession(input.account);
    const client = await this.createAmazonClient(session);
    const wishlistUrl = this.getAmazonWishlistUrl(session);
    const html = await this.fetchAmazonSessionHtml(client, wishlistUrl, session);
    const items = extractAmazonWishlistEntries(html, this.getAmazonOrigin(session)).slice(0, clamp(input.limit ?? 5, 1, 25));

    return {
      ok: true,
      platform: this.platform,
      account: session.account,
      action: "wishlist",
      message:
        items.length > 0
          ? `Loaded ${items.length} Amazon list${items.length === 1 ? "" : "s"} for ${session.account}.`
          : `No Amazon lists were visible for ${session.account}.`,
      data: {
        count: items.length,
        items,
      },
    };
  }

  async cart(input: { account?: string }): Promise<AdapterActionResult> {
    const { session } = await this.ensureActiveSession(input.account);
    const client = await this.createAmazonClient(session);
    const cartUrl = this.getAmazonCartUrl(session);
    const html = await this.fetchAmazonSessionHtml(client, cartUrl, session);
    const cart = extractAmazonCart(html, this.getAmazonOrigin(session));

    return {
      ok: true,
      platform: this.platform,
      account: session.account,
      action: "cart",
      message:
        cart.items.length > 0
          ? `Loaded ${cart.items.length} Amazon cart item${cart.items.length === 1 ? "" : "s"} for ${session.account}.`
          : `The Amazon cart is empty for ${session.account}.`,
      data: { ...cart },
    };
  }

  async orderDetail(input: { target: string; account?: string }): Promise<AdapterActionResult> {
    const orderId = input.target.trim();
    if (!orderId) {
      throw new AutoCliError("AMAZON_ORDER_REQUIRED", "Amazon order ID cannot be empty.");
    }

    const { session } = await this.ensureActiveSession(input.account);
    const client = await this.createAmazonClient(session);
    const ordersUrl = this.getAmazonOrdersUrl(session);
    const html = await this.fetchAmazonSessionHtml(client, ordersUrl, session);
    let order = extractAmazonOrders(html).find((entry) => asString(entry.orderId) === orderId);

    if (!order) {
      const detailHtml = await this.fetchAmazonOrderDetailHtml(client, session, orderId).catch(() => undefined);
      if (detailHtml) {
        order = extractAmazonOrderDetail(detailHtml, orderId, this.getAmazonOrigin(session));
      }
    }

    if (!order) {
      throw new AutoCliError("AMAZON_ORDER_NOT_FOUND", `Amazon could not find order ${orderId}.`, {
        details: {
          orderId,
        },
      });
    }

    return {
      ok: true,
      platform: this.platform,
      account: session.account,
      action: "order",
      message: `Loaded Amazon order ${orderId}.`,
      id: orderId,
      url: asString(order.url),
      data: {
        ...order,
        itemDetails: Array.isArray(order.items)
          ? (order.items as unknown[]).map((item) => (typeof item === "string" ? { title: item } : item))
          : [],
      },
    };
  }

  async search(input: { query: string; limit?: number; account?: string }): Promise<AdapterActionResult> {
    const query = input.query.trim();
    if (!query) {
      throw new AutoCliError("AMAZON_QUERY_REQUIRED", "Amazon search query cannot be empty.");
    }

    const client = this.createGuestClient();
    const url = new URL("/s", AMAZON_ORIGIN);
    url.searchParams.set("k", query);
    const html = await this.fetchAmazonHtml(client, url.toString());
    const results = extractAmazonSearchResults(html).slice(0, clamp(input.limit ?? 5, 1, 25));

    return {
      ok: true,
      platform: this.platform,
      account: "public",
      action: "search",
      message: `Loaded ${results.length} Amazon products for "${query}".`,
      data: {
        query,
        results,
      },
    };
  }

  async productInfo(input: { target: string; account?: string }): Promise<AdapterActionResult> {
    const parsed = parseAmazonProductTarget(input.target);
    const client = this.createGuestClient();
    const targetUrl = parsed.url ?? `${AMAZON_ORIGIN}/dp/${parsed.asin}`;
    const html = await this.fetchAmazonHtml(client, targetUrl);
    const product = extractAmazonProduct(html, targetUrl, parsed.asin);

    return {
      ok: true,
      platform: this.platform,
      account: "public",
      action: "product",
      message: `Loaded Amazon product ${product.asin}.`,
      id: product.asin,
      url: product.url,
      data: { ...product },
    };
  }

  async orders(input: { limit?: number; account?: string }): Promise<AdapterActionResult> {
    const { session } = await this.ensureActiveSession(input.account);
    const client = await this.createAmazonClient(session);
    const response = await this.fetchAmazonOrdersResponse(client, session);

    if (isAmazonLoggedOutUrl(response.response.url)) {
      if (await this.isAmazonStillSignedInOutsideOrders(client, session)) {
        throw new AutoCliError(
          "AMAZON_ORDERS_REAUTH_REQUIRED",
          "Amazon is still signed in for account/cart pages, but orders currently require a real browser-authenticated context beyond imported cookies.",
        );
      }

      throw new AutoCliError("SESSION_EXPIRED", "Amazon redirected the saved session to a sign-in or claim flow. Re-import cookies.txt.");
    }

    const pageSummary = extractAmazonOrdersPageSummary(response.data);
    const orders = extractAmazonOrders(response.data).slice(0, clamp(input.limit ?? 5, 1, 25));
    if (orders.length === 0 && !pageSummary.empty) {
      throw new AutoCliError(
        "AMAZON_ORDERS_LAYOUT_CHANGED",
        "Amazon loaded the orders page, but AutoCLI could not extract the order cards from the current layout.",
      );
    }

    return {
      ok: true,
      platform: this.platform,
      account: session.account,
      action: "orders",
      message:
        orders.length > 0
          ? `Loaded ${orders.length} Amazon orders for ${session.account}.`
          : `No Amazon orders were visible for ${session.account}${pageSummary.timeFilterLabel ? ` in ${pageSummary.timeFilterLabel}` : ""}.`,
      data: {
        orders,
        count: orders.length,
        visibleCount: pageSummary.visibleCount,
        timeFilter: pageSummary.timeFilterValue
          ? {
              value: pageSummary.timeFilterValue,
              label: pageSummary.timeFilterLabel,
            }
          : undefined,
        availableTimeFilters: pageSummary.availableTimeFilters,
      },
    };
  }

  protected async probeSession(session: PlatformSession): Promise<ShoppingSessionProbe> {
    const client = await this.createAmazonClient(session);

    try {
      const response = await this.fetchAmazonOrdersResponse(client, session);

      if (response.response.url.includes("/errors/validateCaptcha")) {
        return {
          status: {
            state: "unknown",
            message: "Amazon presented a validation or anti-bot page while checking the session.",
            lastValidatedAt: new Date().toISOString(),
            lastErrorCode: "ANTI_BOT",
          },
        };
      }

      if (isAmazonLoggedOutUrl(response.response.url)) {
        const fallback = await this.probeAmazonFallbackPages(
          client,
          session,
          "Amazon session is still signed in for account/cart pages, but the orders surface currently requires a real browser-authenticated context beyond imported cookies.",
          "ORDERS_REAUTH_REQUIRED",
        );
        if (fallback) {
          return fallback;
        }

        return {
          status: {
            state: "expired",
            message: "Amazon redirected the session to sign-in or claim verification. Re-import cookies.txt.",
            lastValidatedAt: new Date().toISOString(),
            lastErrorCode: "LOGGED_OUT",
          },
        };
      }

      const summary = extractAmazonAccountSummary(response.data, this.getAmazonOrigin(session));
      return {
        status: {
          state: "active",
          message: "Session validated via the Amazon orders page.",
          lastValidatedAt: new Date().toISOString(),
        },
        user: summary.user,
        metadata: {
          validation: "orders_page",
          finalUrl: response.response.url,
          marketplaceOrigin: this.getAmazonOrigin(session),
        },
      };
    } catch (error) {
      if (isAmazonAntiBotError(error)) {
        const fallback = await this.probeAmazonFallbackPages(
          client,
          session,
          "Amazon session is still signed in, but the orders surface is blocked by Amazon's automated-traffic protections right now.",
          "ANTI_BOT",
        );
        if (fallback) {
          return fallback;
        }
      }

      return {
        status: {
          state: "unknown",
          message: "Amazon validation was unavailable, but the imported session was saved.",
          lastValidatedAt: new Date().toISOString(),
          lastErrorCode: error instanceof AutoCliError ? error.code : "REQUEST_FAILED",
        },
      };
    }
  }

  private createGuestClient(): SessionHttpClient {
    return new SessionHttpClient(undefined, this.buildAmazonHeaders(AMAZON_HOME));
  }

  private async createAmazonClient(session: PlatformSession): Promise<SessionHttpClient> {
    return this.createClient(session, this.buildAmazonHeaders(this.getAmazonHomeUrl(session), session));
  }

  private buildAmazonHeaders(referer: string, session?: PlatformSession): Record<string, string> {
    const origin = this.getAmazonOrigin(session);
    return {
      origin,
      referer,
      "user-agent": AMAZON_USER_AGENT,
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
      "accept-language": "en-US,en;q=0.9",
      "cache-control": "no-cache",
      pragma: "no-cache",
      "upgrade-insecure-requests": "1",
    };
  }

  private async fetchAmazonHtml(client: SessionHttpClient, url: string): Promise<string> {
    const response = await client
      .requestWithResponse<string>(url, {
        responseType: "text",
        expectedStatus: 200,
        headers: this.buildAmazonHeaders(url),
      })
      .catch((error) => {
        throw normalizeAmazonRequestError(error);
      });

    if (response.response.url.includes("/errors/validateCaptcha") || response.data.includes("Type the characters you see in this image")) {
      throw new AutoCliError(
        "AMAZON_ANTI_BOT_BLOCKED",
        "Amazon blocked the request with a validation or anti-bot page. A fresh browser session or slower request cadence may be required.",
      );
    }

    return response.data;
  }

  private async fetchAmazonSessionHtml(client: SessionHttpClient, url: string, session: PlatformSession): Promise<string> {
    const response = await client
      .requestWithResponse<string>(url, {
        responseType: "text",
        expectedStatus: 200,
        headers: this.buildAmazonHeaders(url, session),
      })
      .catch((error) => {
        throw normalizeAmazonRequestError(error);
      });

    if (response.response.url.includes("/errors/validateCaptcha") || response.data.includes("Type the characters you see in this image")) {
      throw new AutoCliError(
        "AMAZON_ANTI_BOT_BLOCKED",
        "Amazon blocked the request with a validation or anti-bot page. A fresh browser session or slower request cadence may be required.",
      );
    }

    return response.data;
  }

  private async fetchAmazonAccountLikeHtml(client: SessionHttpClient, session: PlatformSession): Promise<string> {
    const candidates = [
      this.getAmazonAccountUrl(session),
      this.getAmazonOrdersUrl(session),
      this.getAmazonCartUrl(session),
      this.getAmazonWishlistUrl(session),
    ];

    let lastError: unknown;
    for (const url of candidates) {
      try {
        return await this.fetchAmazonSessionHtml(client, url, session);
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError instanceof Error ? lastError : new AutoCliError("AMAZON_ACCOUNT_UNAVAILABLE", "Amazon account pages were unavailable for the current session.");
  }

  private getAmazonOrigin(session?: PlatformSession): string {
    const cookieDomain = session ? detectAmazonCookieDomain(session) : undefined;
    if (!cookieDomain) {
      return AMAZON_ORIGIN;
    }

    return `https://www.${cookieDomain}`;
  }

  private getAmazonHomeUrl(session?: PlatformSession): string {
    return `${this.getAmazonOrigin(session)}/`;
  }

  private getAmazonAccountUrl(session?: PlatformSession): string {
    return `${this.getAmazonOrigin(session)}/gp/css/homepage.html`;
  }

  private getAmazonCartUrl(session?: PlatformSession): string {
    return `${this.getAmazonOrigin(session)}/gp/cart/view.html`;
  }

  private getAmazonWishlistUrl(session?: PlatformSession): string {
    return `${this.getAmazonOrigin(session)}/hz/wishlist/intro`;
  }

  private getAmazonOrdersUrl(session?: PlatformSession): string {
    return `${this.getAmazonOrigin(session)}/gp/css/order-history`;
  }

  private getAmazonModernOrdersUrl(session?: PlatformSession): string {
    return `${this.getAmazonOrigin(session)}/your-orders/orders`;
  }

  private async isAmazonStillSignedInOutsideOrders(client: SessionHttpClient, session: PlatformSession): Promise<boolean> {
    const candidates = [this.getAmazonAccountUrl(session), this.getAmazonCartUrl(session), this.getAmazonWishlistUrl(session)];

    for (const url of candidates) {
      const html = await this.fetchAmazonSessionHtml(client, url, session).catch(() => undefined);
      if (html && looksLikeAmazonSignedInPage(html)) {
        return true;
      }
    }

    return false;
  }

  private async probeAmazonFallbackPages(
    client: SessionHttpClient,
    session: PlatformSession,
    message: string,
    errorCode: string,
  ): Promise<ShoppingSessionProbe | undefined> {
    const cartUrl = this.getAmazonCartUrl(session);
    const cartHtml = await this.fetchAmazonSessionHtml(client, cartUrl, session).catch(() => undefined);
    if (cartHtml && looksLikeAmazonSignedInPage(cartHtml)) {
      const summary = extractAmazonAccountSummary(cartHtml, this.getAmazonOrigin(session));
      return {
        status: {
          state: "active",
          message,
          lastValidatedAt: new Date().toISOString(),
          lastErrorCode: errorCode,
        },
        user: summary.user,
        metadata: {
          validation: "cart_page",
          finalUrl: cartUrl,
          marketplaceOrigin: this.getAmazonOrigin(session),
        },
      };
    }

    const wishlistUrl = this.getAmazonWishlistUrl(session);
    const wishlistHtml = await this.fetchAmazonSessionHtml(client, wishlistUrl, session).catch(() => undefined);
    if (wishlistHtml && looksLikeAmazonSignedInPage(wishlistHtml)) {
      const summary = extractAmazonAccountSummary(wishlistHtml, this.getAmazonOrigin(session));
      return {
        status: {
          state: "active",
          message,
          lastValidatedAt: new Date().toISOString(),
          lastErrorCode: errorCode,
        },
        user: summary.user,
        metadata: {
          validation: "wishlist_page",
          finalUrl: wishlistUrl,
          marketplaceOrigin: this.getAmazonOrigin(session),
        },
      };
    }

    return undefined;
  }

  private async fetchAmazonOrdersResponse(
    client: SessionHttpClient,
    session: PlatformSession,
  ): Promise<{ data: string; response: Response }> {
    const headers = this.buildAmazonHeaders(this.getAmazonModernOrdersUrl(session), session);

    return client
      .requestWithResponse<string>(this.getAmazonModernOrdersUrl(session), {
        responseType: "text",
        expectedStatus: 200,
        headers,
      })
      .catch((error) => {
        throw normalizeAmazonRequestError(error);
      });
  }

  private async fetchAmazonOrderDetailHtml(
    client: SessionHttpClient,
    session: PlatformSession,
    orderId: string,
  ): Promise<string> {
    const candidates = [
      `${this.getAmazonOrigin(session)}/gp/your-account/order-details?orderID=${encodeURIComponent(orderId)}`,
      `${this.getAmazonOrigin(session)}/your-orders/order-details?orderID=${encodeURIComponent(orderId)}`,
    ];

    for (const url of candidates) {
      const html = await this.fetchAmazonSessionHtml(client, url, session).catch(() => undefined);
      if (!html) {
        continue;
      }

      if (looksLikeAmazonOrderDetailUnavailable(html)) {
        continue;
      }

      return html;
    }

    throw new AutoCliError("AMAZON_ORDER_NOT_FOUND", `Amazon could not load order details for ${orderId}.`, {
      details: {
        orderId,
      },
    });
  }
}

function extractAmazonSearchResults(html: string): AmazonSearchResult[] {
  const openTag = /<div\b(?=[^>]*\bdata-component-type="s-search-result")(?=[^>]*\bdata-asin="([A-Z0-9]{10})")[^>]*>/g;
  const matches = Array.from(html.matchAll(openTag));
  const results: AmazonSearchResult[] = [];
  const seen = new Set<string>();

  for (const [index, match] of matches.entries()) {
    const asin = match[1];
    const start = match.index ?? -1;
    if (!asin || start === -1 || seen.has(asin)) {
      continue;
    }

    const end = matches[index + 1]?.index ?? html.length;
    const block = html.slice(start, end);
    const title = collapseWhitespace(extractMatch(block, /<h2[^>]*>[\s\S]*?<span[^>]*>(.*?)<\/span>/i));
    if (!title) {
      continue;
    }

    const url = toAbsoluteUrl(AMAZON_ORIGIN, extractMatch(block, new RegExp(`href="([^"]*?(?:dp|gp/product)\\/${asin}[^"]*)"`, "i")));
    const imageUrl = extractMatch(block, /class="s-image"[^>]+src="([^"]+)"/i) ?? extractMatch(block, /src="([^"]+)"[^>]+class="s-image"/i);
    const whole = extractMatch(block, /<span class="a-price-whole">([^<]+)<\/span>/i)?.replace(/\D+/g, "");
    const fraction = extractMatch(block, /<span class="a-price-fraction">([^<]+)<\/span>/i)?.replace(/\D+/g, "");
    const ratingText = collapseWhitespace(extractMatch(block, /<span class="a-icon-alt">([^<]+)<\/span>/i));
    const rating = ratingText ? Number.parseFloat(ratingText) : undefined;
    const ratingCountText =
      collapseWhitespace(extractMatch(block, /aria-label="([0-9,]+)\s+ratings?"/i)) ||
      collapseWhitespace(extractMatch(block, /<span class="a-size-base s-underline-text">([^<]+)<\/span>/i));
    const ratingCount = parseInteger(ratingCountText);
    const priceText = whole ? `₹${whole}${fraction ? `.${fraction}` : ""}` : undefined;
    const parsedPrice = parsePriceText(priceText);

    seen.add(asin);
    results.push({
      asin,
      title,
      url,
      imageUrl,
      priceText: parsedPrice.text,
      price: parsedPrice.value,
      currency: parsedPrice.currency,
      rating: Number.isFinite(rating) ? rating : undefined,
      ratingCount,
      sponsored: block.includes("Sponsored"),
    });
  }

  return results;
}

function extractAmazonProduct(html: string, sourceUrl: string, asin: string): AmazonProductInfo {
  const title = collapseWhitespace(extractMatch(html, /<span id="productTitle"[^>]*>(.*?)<\/span>/i));
  if (!title) {
    throw new AutoCliError("AMAZON_PRODUCT_NOT_FOUND", "Amazon did not return a recognizable product detail page.");
  }

  const priceText =
    collapseWhitespace(extractMatch(html, /<div id="priceToPay"[\s\S]*?<span class="aok-offscreen">([^<]+)<\/span>/i)) ||
    collapseWhitespace(extractMatch(html, /<span class="a-price aok-align-center[\s\S]*?<span class="a-offscreen">([^<]+)<\/span>/i));
  const parsedPrice = parsePriceText(priceText);
  const ratingText =
    collapseWhitespace(extractMatch(html, /id="acrPopover"[^>]+title="([^"]+)"/i)) ||
    collapseWhitespace(extractMatch(html, /<span class="a-icon-alt">([^<]+)<\/span>/i));
  const rating = ratingText ? Number.parseFloat(ratingText) : undefined;
  const reviewCount = parseInteger(collapseWhitespace(extractMatch(html, /id="acrCustomerReviewText"[^>]*>(.*?)<\/span>/i)));
  const availability = collapseWhitespace(extractMatch(html, /<div id="availability"[\s\S]*?<span[^>]*>(.*?)<\/span>/i));
  const brand = collapseWhitespace(extractMatch(html, /<(?:a|span) id="bylineInfo"[^>]*>(.*?)<\/(?:a|span)>/i));
  const description =
    collapseWhitespace(extractMatch(html, /<meta name="description" content="([^"]+)"/i)) ||
    collapseWhitespace(extractMatch(html, /<div id="feature-bullets"[\s\S]*?<ul[^>]*>([\s\S]*?)<\/ul>/i));
  const imageUrl =
    extractMatch(html, /<meta property="og:image" content="([^"]+)"/i) ||
    extractMatch(html, /id="landingImage"[^>]+data-old-hires="([^"]+)"/i) ||
    extractMatch(html, /id="landingImage"[^>]+src="([^"]+)"/i);
  const features = Array.from(html.matchAll(/<li[^>]*><span class="a-list-item">([\s\S]*?)<\/span><\/li>/gi))
    .map((match) => collapseWhitespace(match[1] ?? ""))
    .filter(Boolean)
    .slice(0, 8);

  return {
    asin,
    title,
    url: sourceUrl,
    priceText: parsedPrice.text,
    price: parsedPrice.value,
    currency: parsedPrice.currency,
    rating: Number.isFinite(rating) ? rating : undefined,
    ratingCount: reviewCount,
    availability,
    brand,
    description,
    imageUrl,
    features,
  };
}

function extractAmazonOrders(html: string): Array<Record<string, unknown>> {
  const matches = Array.from(html.matchAll(/orderID=([0-9-]{10,})/g));
  const seen = new Set<string>();
  const orders: Array<Record<string, unknown>> = [];

  for (const match of matches) {
    const orderId = match[1];
    const index = match.index ?? -1;
    if (!orderId || index === -1 || seen.has(orderId)) {
      continue;
    }

    seen.add(orderId);
    const window = html.slice(Math.max(0, index - 2500), Math.min(html.length, index + 6500));
    const items = Array.from(window.matchAll(/<(?:span|a)[^>]+(?:class="a-size-medium|href="\/gp\/product\/)[^>]*>([^<]{8,200})<\/(?:span|a)>/gi))
      .map((itemMatch) => collapseWhitespace(itemMatch[1] ?? ""))
      .filter((value) => value && !/^(Buy it again|View item|Track package|Leave seller feedback|Write a product review)$/i.test(value))
      .slice(0, 3);
    const deliveredText = findAmazonDeliveryText(window);

    orders.push({
      orderId,
      placedAt: extractAmazonOrderField(window, "ORDER PLACED"),
      totalText: extractAmazonOrderField(window, "TOTAL"),
      status: deliveredText ?? extractAmazonOrderField(window, "ORDER #"),
      deliveryText: deliveredText,
      items,
      url: `${AMAZON_ORIGIN}/gp/your-account/order-details?orderID=${orderId}`,
    });
  }

  return orders;
}

function extractAmazonOrderDetail(html: string, orderId: string, origin: string): Record<string, unknown> | undefined {
  if (looksLikeAmazonOrderDetailUnavailable(html)) {
    return undefined;
  }

  const items = extractAmazonOrderDetailItems(html, origin);
  const deliveryText =
    collapseWhitespace(extractMatch(html, /<div[^>]*class="[^"]*a-alert-content[^"]*"[^>]*>([\s\S]*?)<\/div>/i)) ||
    findAmazonDeliveryText(html);

  return {
    orderId,
    placedAt: extractAmazonOrderDetailField(html, "Order placed"),
    totalText: extractAmazonOrderDetailField(html, "Grand Total") ?? extractAmazonOrderDetailField(html, "Order Total"),
    status: deliveryText || extractAmazonOrderDetailField(html, "Status"),
    deliveryText,
    recipient: extractAmazonOrderDetailField(html, "Recipient"),
    paymentMethod: extractAmazonOrderDetailField(html, "Payment Method"),
    shippingAddress: extractAmazonOrderDetailField(html, "Shipping Address"),
    items,
    url: `${origin}/gp/your-account/order-details?orderID=${encodeURIComponent(orderId)}`,
  };
}

function extractAmazonOrderDetailItems(html: string, origin: string): Array<Record<string, unknown>> {
  const matches = Array.from(
    html.matchAll(/<a[^>]+href="([^"]*\/(?:dp|gp\/product)\/([A-Z0-9]{10})[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi),
  );
  const results: Array<Record<string, unknown>> = [];
  const seen = new Set<string>();

  for (const match of matches) {
    const asin = match[2];
    if (!asin || seen.has(asin)) {
      continue;
    }

    const title = collapseWhitespace(stripHtml(match[3] ?? ""));
    if (!title || /^(?:Back to top|Continue shopping|Your Orders)$/i.test(title)) {
      continue;
    }

    seen.add(asin);
    results.push({
      asin,
      title,
      url: toAbsoluteUrl(origin, match[1]),
    });
  }

  return results;
}

function extractAmazonOrderField(window: string, label: string): string | undefined {
  const direct = collapseWhitespace(
    extractMatch(window, new RegExp(`${escapeRegex(label)}[\\s\\S]{0,200}?<span[^>]*>(.*?)<\\/span>`, "i")),
  );
  if (direct) {
    return direct;
  }

  return collapseWhitespace(
    extractMatch(window, new RegExp(`${escapeRegex(label)}[\\s\\S]{0,200}?<div[^>]*>(.*?)<\\/div>`, "i")),
  );
}

function findAmazonDeliveryText(window: string): string | undefined {
  const text = collapseWhitespace(window);
  const match = text.match(
    /\b(?:Delivered|Arriving|Shipped|Out for delivery|Return completed|Cancelled|Refunded)[^.]{0,80}/i,
  );
  return match?.[0]?.trim();
}

function looksLikeAmazonNoOrders(html: string): boolean {
  return extractAmazonOrdersPageSummary(html).empty;
}

function extractAmazonOrdersPageSummary(html: string): AmazonOrdersPageSummary {
  const timeFilterSelect = html.match(/<select[^>]+id="time-filter"[\s\S]*?<\/select>/i)?.[0] ?? "";
  const visibleCount = parseInteger(collapseWhitespace(extractMatch(html, /<span class="num-orders">([^<]+)<\/span>/i)));
  const timeFilterValue = extractMatch(timeFilterSelect, /<option[^>]+selected[^>]+value="([^"]+)"/i);
  const timeFilterLabel = collapseWhitespace(
    extractMatch(timeFilterSelect, /<option[^>]+selected[^>]*>([\s\S]*?)<\/option>/i),
  );
  const availableTimeFilters = Array.from(timeFilterSelect.matchAll(/<option[^>]+value="([^"]+)"[^>]*>\s*([\s\S]*?)\s*<\/option>/gi))
    .map((match) => {
      const value = match[1]?.trim();
      const label = collapseWhitespace(match[2] ?? "");
      return value && label ? { value, label } : undefined;
    })
    .filter((entry): entry is { value: string; label: string } => Boolean(entry));

  return {
    visibleCount,
    timeFilterValue: timeFilterValue || undefined,
    timeFilterLabel: timeFilterLabel || undefined,
    availableTimeFilters,
    empty:
      visibleCount === 0 ||
      /(?:You have not placed any orders|looks like you haven'?t placed an order|<span class="num-orders">\s*0 orders?\s*<\/span>)/i.test(
        html,
      ),
  };
}

function extractAmazonOrderDetailField(html: string, label: string): string | undefined {
  const patterns = [
    new RegExp(`${escapeRegex(label)}[\\s\\S]{0,240}?<span[^>]*>([\\s\\S]*?)<\\/span>`, "i"),
    new RegExp(`${escapeRegex(label)}[\\s\\S]{0,240}?<div[^>]*>([\\s\\S]*?)<\\/div>`, "i"),
    new RegExp(`${escapeRegex(label)}[\\s\\S]{0,240}?<dd[^>]*>([\\s\\S]*?)<\\/dd>`, "i"),
  ];

  for (const pattern of patterns) {
    const value = collapseWhitespace(stripHtml(extractMatch(html, pattern) ?? ""));
    if (value) {
      return value;
    }
  }

  return undefined;
}

function looksLikeAmazonOrderDetailUnavailable(html: string): boolean {
  return /We'?re unable to load your order details/i.test(html);
}

function isAmazonLoggedOutUrl(url: string): boolean {
  return /\/(?:ap\/signin|ax\/claim|gp\/signin)/i.test(url);
}

function looksLikeAmazonSignedInPage(html: string): boolean {
  const greeting = extractAmazonNavGreeting(html);
  if (!greeting) {
    return false;
  }

  return !/^Hello,\s*sign in$/i.test(greeting);
}

function extractAmazonAccountSummary(html: string, origin: string): {
  user?: { username?: string; displayName?: string };
  data: Record<string, unknown>;
} {
  const greeting = extractAmazonNavGreeting(html);
  const displayName = greeting?.replace(/^Hello,\s*/i, "").trim();
  return {
    user: displayName
      ? {
          username: displayName,
          displayName,
        }
      : undefined,
    data: {
      displayName,
      greeting,
      signedIn: looksLikeAmazonSignedInPage(html),
      marketplaceOrigin: origin,
      ordersAccessible:
        !html.includes("/ap/signin") &&
        (/<title>\s*Your Orders\s*<\/title>/i.test(html) || html.includes("your-orders") || html.includes("order-history")),
    },
  };
}

function extractAmazonCart(html: string, origin: string): AmazonCartData {
  const items = extractAmazonCartItems(html, origin);
  const subtotalText =
    collapseWhitespace(extractMatch(html, /id="sc-subtotal-amount-activecart"[^>]*>\s*<span[^>]*>(.*?)<\/span>/i)) ||
    collapseWhitespace(extractMatch(html, /Subtotal \((?:[^)]+)\)\s*<span[^>]*>(.*?)<\/span>/i));

  return {
    count: items.length,
    subtotalText: subtotalText || undefined,
    empty: /Your Amazon Cart is empty/i.test(html),
    items,
  };
}

function extractAmazonCartItems(html: string, origin: string): Array<Record<string, unknown>> {
  const matches = Array.from(html.matchAll(/<div\b(?=[^>]*\bdata-asin="([A-Z0-9]{10})")[^>]*class="[^"]*sc-list-item[^"]*"[^>]*>/gi));
  const results: Array<Record<string, unknown>> = [];
  const seen = new Set<string>();

  for (const [index, match] of matches.entries()) {
    const asin = match[1];
    const start = match.index ?? -1;
    if (!asin || start === -1 || seen.has(asin)) {
      continue;
    }

    const end = matches[index + 1]?.index ?? html.length;
    const block = html.slice(start, end);
    const title =
      collapseWhitespace(extractMatch(block, /class="[^"]*sc-product-title[^"]*"[^>]*>([\s\S]*?)<\/span>/i)) ||
      collapseWhitespace(extractMatch(block, /href="\/dp\/[A-Z0-9]{10}[^"]*"[^>]*>\s*<span[^>]*>([\s\S]*?)<\/span>/i));

    if (!title) {
      continue;
    }

    seen.add(asin);
    results.push({
      asin,
      title,
      url: toAbsoluteUrl(origin, extractMatch(block, new RegExp(`href=\"([^\"]*\\/dp\\/${asin}[^\"]*)\"`, "i"))),
      imageUrl: extractMatch(block, /<img[^>]+src="([^"]+)"/i),
      priceText: collapseWhitespace(extractMatch(block, /class="[^"]*sc-price[^"]*"[^>]*>(.*?)<\/span>/i)),
      availability: collapseWhitespace(extractMatch(block, /class="[^"]*sc-availability[^"]*"[^>]*>(.*?)<\/span>/i)),
      quantity: parseInteger(collapseWhitespace(extractMatch(block, /value="([0-9]+)"[^>]*data-a-selector="value"/i))),
    });
  }

  return results;
}

function extractAmazonWishlistEntries(html: string, origin: string): Array<Record<string, unknown>> {
  const results: Array<Record<string, unknown>> = [];
  const seen = new Set<string>();

  for (const match of html.matchAll(/<a[^>]+href="([^"]*\/hz\/wishlist\/ls[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi)) {
    const url = toAbsoluteUrl(origin, match[1]);
    const title = collapseWhitespace(match[2] ?? "");
    if (!url || !title || /^(Your Lists|Create a List|Find a List or Registry|Sign In)$/i.test(title) || seen.has(url)) {
      continue;
    }

    seen.add(url);
    results.push({
      title,
      url,
    });
  }

  return results;
}

function extractAmazonNavGreeting(html: string): string | undefined {
  return collapseWhitespace(extractMatch(html, /id="nav-link-accountList-nav-line-1"[^>]*>([\s\S]*?)<\/span>/i));
}

function detectAmazonCookieDomain(session: PlatformSession): string | undefined {
  const cookies = Array.isArray(session.cookieJar.cookies) ? session.cookieJar.cookies : [];
  const match = cookies
    .map((cookie) => (cookie && typeof cookie.domain === "string" ? cookie.domain.replace(/^\./, "") : undefined))
    .find((domain): domain is string => typeof domain === "string" && /^amazon\.[a-z.]+$/i.test(domain));

  return match;
}

function extractMatch(input: string, pattern: RegExp): string | undefined {
  return input.match(pattern)?.[1];
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function stripHtml(value: string): string {
  return value.replace(/<[^>]+>/g, " ");
}

function isAmazonAntiBotError(error: unknown): boolean {
  return error instanceof AutoCliError && error.code === "AMAZON_ANTI_BOT_BLOCKED";
}

function normalizeAmazonRequestError(error: unknown): never {
  if (error instanceof AutoCliError && error.code === "HTTP_REQUEST_FAILED") {
    const body = typeof error.details?.body === "string" ? error.details.body : undefined;
    const status = typeof error.details?.status === "number" ? error.details.status : undefined;

    if (status === 503 && isAmazonAutomationBlockBody(body)) {
      throw new AutoCliError(
        "AMAZON_ANTI_BOT_BLOCKED",
        "Amazon blocked the orders request as automated traffic. The browser session is valid, but this surface currently requires a real browser context.",
        {
          details: {
            status,
            upstreamMessage: body?.slice(0, 200),
          },
        },
      );
    }
  }

  throw error;
}

function isAmazonAutomationBlockBody(body: string | undefined): boolean {
  return Boolean(body && /automated access to Amazon data|api-services-support@amazon\.com/i.test(body));
}

function parseInteger(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }

  const normalized = value.replace(/[^0-9]/g, "");
  if (!normalized) {
    return undefined;
  }

  const parsed = Number.parseInt(normalized, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
