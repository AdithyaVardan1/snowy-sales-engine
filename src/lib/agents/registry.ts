import { AgentRunner } from "./types";

const runners: Record<string, AgentRunner> = {};

export function registerAgent(runner: AgentRunner) {
  runners[runner.slug] = runner;
}

export function getAgentRunner(slug: string): AgentRunner | undefined {
  return runners[slug];
}

export function getAllRegisteredAgents(): string[] {
  return Object.keys(runners);
}
