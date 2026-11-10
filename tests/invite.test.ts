import { describe, expect, it } from "vitest";
import { hasInvite } from "../src/rules/invite";

describe("convite da apresentação", () => {
  it("aceita o código, sem ligar para maiúsculas", () => {
    expect(hasInvite("?convite=drbruce")).toBe(true);
    expect(hasInvite("?convite=DrBruce")).toBe(true);
    expect(hasInvite("?bruce&convite=DRBRUCE")).toBe(true);
  });
  it("recusa endereço sem convite ou com outro código", () => {
    expect(hasInvite("")).toBe(false);
    expect(hasInvite("?convite=")).toBe(false);
    expect(hasInvite("?convite=bruce")).toBe(false);
    expect(hasInvite("?bruce")).toBe(false);
  });
});
