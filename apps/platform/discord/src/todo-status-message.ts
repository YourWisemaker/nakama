import type { AgentTodo } from "@nakama/core/contract";
import { DiscordEditableMessage } from "./editable-message";
import { type DiscordTodoRunState, renderDiscordTodoStatus } from "./format";
import type { DiscordMessenger } from "./messenger";

export class DiscordTodoStatusMessage {
  private readonly editable: DiscordEditableMessage;
  private lastTodos: AgentTodo[] = [];

  constructor(messenger: DiscordMessenger) {
    this.editable = new DiscordEditableMessage(messenger);
  }

  async update(todos: AgentTodo[]): Promise<void> {
    if (todos.length === 0) {
      return;
    }

    this.lastTodos = todos.map((todo) => ({ ...todo }));
    await this.editable.render(
      renderDiscordTodoStatus(this.lastTodos, "working")
    );
  }

  async complete(): Promise<void> {
    await this.renderTerminal("completed");
  }

  async stop(): Promise<void> {
    await this.renderTerminal("stopped");
  }

  async fail(): Promise<void> {
    await this.renderTerminal("failed");
  }

  private async renderTerminal(state: DiscordTodoRunState): Promise<void> {
    if (this.lastTodos.length === 0) {
      return;
    }

    await this.editable.render(renderDiscordTodoStatus(this.lastTodos, state));
  }
}
