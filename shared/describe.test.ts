import { describe, expect, it } from "vitest";
import { describeGoal, describeLocation, normalise, parseSituation } from "./describe";

describe("parseSituation", () => {
  it("5v4 power play for the home team", () => {
    expect(parseSituation("1451", true)).toMatchObject({ strength: "PP", skaters: "5v4", emptyNet: false });
  });
  it("shorthanded for the away team", () => {
    expect(parseSituation("1451", false)).toMatchObject({ strength: "SH", skaters: "4v5" });
  });
  it("extra attacker against a pulled goalie is not a power play", () => {
    // away goalie pulled (0), 6 away skaters vs 5 home, home scores
    expect(parseSituation("0651", true)).toMatchObject({ strength: "EV", emptyNet: true });
  });
});

describe("location", () => {
  it("flips coordinates for a team attacking the left", () => {
    expect(normalise(-70, 5, true, "right")).toEqual({ x: 70, y: -5 });
    expect(normalise(70, 5, true, "left")).toEqual({ x: 70, y: 5 });
    expect(normalise(-70, 5, false, "left")).toEqual({ x: 70, y: -5 });
  });
  it("names the slot and the point", () => {
    expect(describeLocation({ x: 62, y: 3 }, false)).toBe("the slot");
    expect(describeLocation({ x: 40, y: 5 }, false)).toBe("the point");
    expect(describeLocation({ x: 88, y: 2 }, false)).toBe("the crease");
  });
});

describe("describeGoal", () => {
  const base = {
    scorerLast: "McDavid", scorerFull: "Connor McDavid", assistLasts: ["Draisaitl"], goalieLast: "Hellebuyck", teamName: "Oilers",
    opponentName: "Jets", strength: "EV" as const, skaters: "5v5", emptyNet: false, penaltyShot: false, ownGoal: false,
    shotType: "wrist", location: "the slot", period: 2, periodType: "REG" as const, time: "10:00", scoreFor: 2, scoreAgainst: 1,
    gameGoal: 1, isGwg: false, gameFinalTeamWon: false, isFirstOfGame: false,
  };
  it("writes the headline sentence", () => {
    const { text, tags } = describeGoal(base);
    expect(text).toContain("McDavid scores from the slot with a wrist shot past Hellebuyck.");
    expect(text).toContain("Assisted by Draisaitl.");
    expect(text).toContain("Oilers take a 2–1 lead.");
    expect(tags).toContain("go-ahead");
  });
  it("flags overtime winners and hat tricks", () => {
    const { text, tags } = describeGoal({ ...base, periodType: "OT", period: 4, isGwg: true, gameGoal: 3, scoreFor: 3, scoreAgainst: 2 });
    expect(text).toContain("Overtime winner!");
    expect(text).toContain("Hat trick");
    expect(tags).toEqual(expect.arrayContaining(["otwinner", "gwg", "hattrick"]));
  });
});
