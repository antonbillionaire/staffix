import { describe, it, expect } from "vitest";
import { parseFBWebhookAll, parseFBWebhook, parseLeadgenEvents } from "../facebook-utils";

describe("parseFBWebhookAll", () => {
  it("returns empty array for non-page objects", () => {
    expect(parseFBWebhookAll({ object: "instagram" })).toEqual([]);
  });

  it("returns empty array for empty entry", () => {
    expect(parseFBWebhookAll({ object: "page", entry: [] })).toEqual([]);
  });

  it("parses single text message", () => {
    const body = {
      object: "page",
      entry: [{
        messaging: [{
          sender: { id: "USER_123" },
          recipient: { id: "PAGE_456" },
          message: { mid: "m_abc", text: "Hello" },
        }],
      }],
    };
    const result = parseFBWebhookAll(body);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      senderId: "USER_123",
      pageId: "PAGE_456",
      text: "Hello",
      messageId: "m_abc",
    });
  });

  it("parses multiple messages from batched entries", () => {
    const body = {
      object: "page",
      entry: [
        {
          messaging: [
            { sender: { id: "U1" }, recipient: { id: "P1" }, message: { mid: "m1", text: "Hi" } },
            { sender: { id: "U2" }, recipient: { id: "P1" }, message: { mid: "m2", text: "Hey" } },
          ],
        },
        {
          messaging: [
            { sender: { id: "U3" }, recipient: { id: "P2" }, message: { mid: "m3", text: "Yo" } },
          ],
        },
      ],
    };
    const result = parseFBWebhookAll(body);
    expect(result).toHaveLength(3);
    expect(result.map(m => m.senderId)).toEqual(["U1", "U2", "U3"]);
  });

  it("skips echo messages (bot's own messages)", () => {
    const body = {
      object: "page",
      entry: [{
        messaging: [{
          sender: { id: "PAGE_456" },
          recipient: { id: "USER_123" },
          message: { mid: "m_echo", text: "Bot reply", is_echo: true },
        }],
      }],
    };
    expect(parseFBWebhookAll(body)).toEqual([]);
  });

  it("skips non-text messages (images, stickers)", () => {
    const body = {
      object: "page",
      entry: [{
        messaging: [{
          sender: { id: "U1" },
          recipient: { id: "P1" },
          message: { mid: "m_img", attachments: [{ type: "image" }] },
        }],
      }],
    };
    expect(parseFBWebhookAll(body)).toEqual([]);
  });

  it("skips postback events", () => {
    const body = {
      object: "page",
      entry: [{
        messaging: [{
          sender: { id: "U1" },
          recipient: { id: "P1" },
          postback: { payload: "GET_STARTED" },
        }],
      }],
    };
    expect(parseFBWebhookAll(body)).toEqual([]);
  });

  it("handles missing messaging array gracefully", () => {
    const body = { object: "page", entry: [{ id: "123" }] };
    expect(parseFBWebhookAll(body)).toEqual([]);
  });

  it("handles missing mid gracefully", () => {
    const body = {
      object: "page",
      entry: [{
        messaging: [{
          sender: { id: "U1" },
          recipient: { id: "P1" },
          message: { text: "No mid" },
        }],
      }],
    };
    const result = parseFBWebhookAll(body);
    expect(result).toHaveLength(1);
    expect(result[0].messageId).toBe("");
  });
});

describe("parseFBWebhook (legacy)", () => {
  it("returns first message from payload", () => {
    const body = {
      object: "page",
      entry: [{
        messaging: [
          { sender: { id: "U1" }, recipient: { id: "P1" }, message: { mid: "m1", text: "First" } },
          { sender: { id: "U2" }, recipient: { id: "P1" }, message: { mid: "m2", text: "Second" } },
        ],
      }],
    };
    const result = parseFBWebhook(body);
    expect(result?.text).toBe("First");
  });

  it("returns null for empty payload", () => {
    expect(parseFBWebhook({ object: "page", entry: [] })).toBeNull();
  });
});

describe("parseLeadgenEvents", () => {
  it("returns empty array for non-page objects", () => {
    expect(parseLeadgenEvents({ object: "instagram" })).toEqual([]);
  });

  it("parses single leadgen event", () => {
    const body = {
      object: "page",
      entry: [{
        id: "PAGE_123",
        changes: [{
          field: "leadgen",
          value: {
            leadgen_id: "LEAD_001",
            page_id: "PAGE_123",
            form_id: "FORM_001",
            ad_id: "AD_001",
            created_time: 1700000000,
          },
        }],
      }],
    };
    const result = parseLeadgenEvents(body);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      leadId: "LEAD_001",
      pageId: "PAGE_123",
      formId: "FORM_001",
      adId: "AD_001",
      createdTime: 1700000000,
    });
  });

  it("handles leadgen event without ad_id", () => {
    const body = {
      object: "page",
      entry: [{
        id: "PAGE_123",
        changes: [{
          field: "leadgen",
          value: {
            leadgen_id: "LEAD_002",
            page_id: "PAGE_123",
            form_id: "FORM_002",
            created_time: 1700000001,
          },
        }],
      }],
    };
    const result = parseLeadgenEvents(body);
    expect(result[0].adId).toBeUndefined();
  });

  it("ignores non-leadgen changes", () => {
    const body = {
      object: "page",
      entry: [{
        id: "PAGE_123",
        changes: [
          { field: "feed", value: { post_id: "POST_1" } },
          { field: "leadgen", value: { leadgen_id: "L1", page_id: "P1", form_id: "F1", created_time: 1 } },
        ],
      }],
    };
    const result = parseLeadgenEvents(body);
    expect(result).toHaveLength(1);
    expect(result[0].leadId).toBe("L1");
  });

  it("falls back to entry.id when page_id is missing", () => {
    const body = {
      object: "page",
      entry: [{
        id: "ENTRY_PAGE",
        changes: [{
          field: "leadgen",
          value: { leadgen_id: "L1", form_id: "F1", created_time: 1 },
        }],
      }],
    };
    const result = parseLeadgenEvents(body);
    expect(result[0].pageId).toBe("ENTRY_PAGE");
  });

  it("handles entry without changes array", () => {
    const body = { object: "page", entry: [{ id: "123" }] };
    expect(parseLeadgenEvents(body)).toEqual([]);
  });

  it("parses multiple leadgen events across entries", () => {
    const body = {
      object: "page",
      entry: [
        { changes: [{ field: "leadgen", value: { leadgen_id: "L1", page_id: "P1", form_id: "F1", created_time: 1 } }] },
        { changes: [{ field: "leadgen", value: { leadgen_id: "L2", page_id: "P2", form_id: "F2", created_time: 2 } }] },
      ],
    };
    expect(parseLeadgenEvents(body)).toHaveLength(2);
  });
});
