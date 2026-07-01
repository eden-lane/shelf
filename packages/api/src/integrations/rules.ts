import type { GitHubRepository, ImportRuleRecord } from "./types";

export const ruleMatchesRepository = (rule: ImportRuleRecord, repository: GitHubRepository) => {
  if (!rule.enabled) {
    return false;
  }

  const value = repositoryValue(rule.conditionField, repository);

  if (value === null || value === undefined) {
    return false;
  }

  if (Array.isArray(value)) {
    if (rule.conditionOperator === "contains") {
      return value.some(
        (item) =>
          typeof item === "string" &&
          String(rule.conditionValue).toLowerCase() === item.toLowerCase(),
      );
    }

    if (rule.conditionOperator === "is") {
      return value.some(
        (item) =>
          typeof item === "string" &&
          String(rule.conditionValue).toLowerCase() === item.toLowerCase(),
      );
    }

    return false;
  }

  if (typeof value === "string") {
    const expected = String(rule.conditionValue).toLowerCase();
    const actual = value.toLowerCase();

    return rule.conditionOperator === "is"
      ? actual === expected
      : rule.conditionOperator === "contains"
        ? actual.includes(expected)
        : false;
  }

  if (typeof value === "number") {
    const expected =
      typeof rule.conditionValue === "number" ? rule.conditionValue : Number(rule.conditionValue);

    if (!Number.isFinite(expected)) {
      return false;
    }

    if (rule.conditionOperator === ">") return value > expected;
    if (rule.conditionOperator === ">=") return value >= expected;
    if (rule.conditionOperator === "<") return value < expected;
    if (rule.conditionOperator === "<=") return value <= expected;
    if (rule.conditionOperator === "==") return value === expected;

    return false;
  }

  if (typeof value === "boolean") {
    const expected =
      typeof rule.conditionValue === "boolean"
        ? rule.conditionValue
        : String(rule.conditionValue).toLowerCase() === "true";

    return rule.conditionOperator === "is" && value === expected;
  }

  return false;
};

export const repositoryValue = (
  field: ImportRuleRecord["conditionField"],
  repository: GitHubRepository,
) => {
  if (field === "language") return repository.language;
  if (field === "topics") return repository.topics ?? [];
  if (field === "name") return repository.name;
  if (field === "stargazers_count") return repository.stargazers_count;
  if (field === "forks_count") return repository.forks_count;
  if (field === "private") return repository.private;
  if (field === "archived") return repository.archived;

  return null;
};
