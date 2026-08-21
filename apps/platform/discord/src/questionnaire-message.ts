import { formatAgentQuestionnaireMessage } from "@nakama/core/agent-questionnaire";
import type { AgentQuestionnaire } from "@nakama/core/contract";
import { DiscordEditableMessage } from "./editable-message";
import type { DiscordMessenger } from "./messenger";

export class DiscordQuestionnaireMessage {
  private readonly editable: DiscordEditableMessage;

  constructor(messenger: DiscordMessenger) {
    this.editable = new DiscordEditableMessage(messenger);
  }

  async update(questionnaire: AgentQuestionnaire | null): Promise<void> {
    if (!(questionnaire && questionnaire.questions.length > 0)) {
      return;
    }

    await this.editable.render(formatAgentQuestionnaireMessage(questionnaire));
  }
}
