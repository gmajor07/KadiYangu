import { describe, expect, it } from "vitest";
import { renderMessageTemplate, validateMessageTemplate } from "@/services/messaging";

describe("Phase 7E.3 messaging foundation", () => {
  it("accepts supported placeholders and rejects executable/unknown tokens", () => {
    expect(validateMessageTemplate("Hello {guest_name}, {event_name}").ok).toBe(true);
    expect(validateMessageTemplate("{unknown}").ok).toBe(false);
    expect(validateMessageTemplate("{{constructor}}").ok).toBe(false);
  });
  it("renders personalized values without executing template code", () => {
    expect(renderMessageTemplate("Hi {guest_name}, pledged {pledged_amount}", { guest_name: "Asha", pledged_amount: 120000 })).toBe("Hi Asha, pledged 120000");
    expect(renderMessageTemplate("{constructor}", { constructor: "bad" })).toBeNull();
  });
  it("does not dispatch messages in the foundation", () => {
    expect(validateMessageTemplate("Reminder {outstanding_amount}").ok).toBe(true);
  });
});

import { messageSelectionStorageKey } from "@/components/messaging/recipient-selector";
describe("messaging selection isolation", () => {
  it("scopes selection storage by event and channel", () => {
    expect(messageSelectionStorageKey("event-a", "SMS")).not.toBe(messageSelectionStorageKey("event-b", "SMS"));
    expect(messageSelectionStorageKey("event-a", "SMS")).not.toBe(messageSelectionStorageKey("event-a", "EMAIL"));
  });
});

import { actionFeedback, submitLabel } from "@/components/messaging/action-form";
describe("MessagingActionForm feedback contract", () => {
  it("exposes accessible success feedback", () => {
    expect(actionFeedback({ok:true,success:"Campaign saved"})).toEqual({role:"status",message:"Campaign saved"});
  });
  it("exposes safe error feedback for recipient, consent and transition failures", () => {
    expect(actionFeedback({ok:false,error:"No eligible recipients selected"}).role).toBe("alert");
    expect(actionFeedback({ok:false,error:"Consent update rejected"}).message).toBe("Consent update rejected");
    expect(actionFeedback({ok:false,error:"Campaign transition rejected"}).message).toBe("Campaign transition rejected");
  });
  it("uses a pending label and prevents duplicate-submit semantics", () => {
    expect(submitLabel(true,"Save recipients")).toBe("Saving…");
    expect(submitLabel(false,"Cancel campaign")).toBe("Cancel campaign");
  });
  it("does not represent dispatch as a successful action", () => {
    expect(actionFeedback({ok:true,success:"Saved campaign"}).message).not.toMatch(/sent|delivered/i);
  });
});
