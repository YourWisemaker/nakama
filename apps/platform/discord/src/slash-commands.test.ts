import { describe, expect, test } from "bun:test";
import { buildSlashCommands } from "./slash-commands";

describe("buildSlashCommands", () => {
  test("includes allow with a required user option alongside existing commands", () => {
    const commands = buildSlashCommands();
    const names = commands.map((command) => command.name);

    expect(names).toEqual([
      "start",
      "help",
      "stop",
      "clear",
      "compact",
      "new",
      "close",
      "status",
      "allow",
    ]);

    const allow = commands.find((command) => command.name === "allow");
    expect(allow).toBeDefined();

    const json = allow!.toJSON();
    const userOption = json.options?.find(
      (option: { name?: string }) => option.name === "user"
    );

    expect(userOption).toMatchObject({
      name: "user",
      required: true,
      type: 6,
    });
  });
});
