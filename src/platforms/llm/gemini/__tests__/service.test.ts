import { describe, expect, test } from "bun:test";

import { extractGeminiBootstrap, parseGeminiGenerateResponse, parseGeminiResponseFrames } from "../service.js";

describe("gemini service helpers", () => {
  test("extracts bootstrap fields from WIZ_global_data", () => {
    const html = `
      <script>
        window.WIZ_global_data = {
          "SNlM0e":"AJvLN6-example:1774501991428",
          "cfb2h":"boq_assistant-bard-web-server_20260324.01_p0",
          "FdrFJe":"-758263268706518357",
          "TuX5cc":"en-GB"
        };
      </script>
    `;

    expect(extractGeminiBootstrap(html)).toEqual({
      accessToken: "AJvLN6-example:1774501991428",
      buildLabel: "boq_assistant-bard-web-server_20260324.01_p0",
      sessionId: "-758263268706518357",
      language: "en-GB",
    });
  });

  test("parses length-prefixed Gemini frames", () => {
    const chunk = '[["wrb.fr",null,"\\"hello हाय\\""]]';
    const payload = `)]}'\n\n${Buffer.byteLength(chunk, "utf8")}\n${chunk}`;
    const frames = parseGeminiResponseFrames(payload);
    expect(Array.isArray(frames)).toBe(true);
    expect(frames).toHaveLength(1);
  });

  test("extracts generated text and ids from stream response", () => {
    const body = JSON.stringify([
      null,
      ["c_test", "r_test"],
      null,
      null,
      [["rc_test", ["hi-gemini-autocli"]]],
    ]);
    const chunk = JSON.stringify([["wrb.fr", null, body]]);
    const framed = `)]}'\n\n${chunk.length}\n${chunk}`;

    expect(parseGeminiGenerateResponse(framed)).toEqual({
      outputText: "hi-gemini-autocli",
      chatId: "c_test",
      responseId: "r_test",
      candidateId: "rc_test",
    });
  });

  test("parses multi-frame live Gemini streams", () => {
    const frameOne = '[["wrb.fr",null,"[null,[null,\\"r_bootstrap\\"],{\\"18\\":\\"r_bootstrap\\"}]"]]';
    const frameTwoBody = JSON.stringify([
      null,
      ["c_live", "r_live"],
      null,
      null,
      [["rc_live", ["hi-gemini-live"]]],
    ]);
    const frameTwo = JSON.stringify([["wrb.fr", null, frameTwoBody]]);
    const framed = `)]}'\n\n160\n${frameOne}\n1653\n${frameTwo}`;

    expect(parseGeminiGenerateResponse(framed)).toEqual({
      outputText: "hi-gemini-live",
      chatId: "c_live",
      responseId: "r_live",
      candidateId: "rc_live",
    });
  });
});
