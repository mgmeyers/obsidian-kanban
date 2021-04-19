export const newLineRegex = /[\r\n]+/g;

// Begins with one or more # followed by a space
export const sectionRegex = /^#+\s+(.+)$/;

// Does not begin with a space or a bullet character
export const textRegex = /^(?!\s|[-*+]\s)./;

/**
 * Match groups:
 *
 * 1. indent
 * 2. bulletChar
 * 3. boxChar
 * 4. content
 */
export const taskRegex = /^([\s\t]*)([-+*])\s+\[([^\]]+)]\s+(.+)$/;

/**
 * Match groups:
 *
 * 1. indent
 * 2. bulletChar
 * 3. content
 */
export const listRegex = /^([\s\t]*)([-+*])\s+(.+)$/;

export interface Task {
  bulletChar: string;
  boxChar: string;
  complete: boolean;
  content: string;
  description?: string;
  subtasks: Task[];
}

export interface Section {
  title: string;
  subtasks: Task[];
  description?: string;
}

function getIndentLevel(indent: string, useTab: boolean, tabSize: number) {
  if (!indent) return 0;
  if (useTab) indent.split("\t").length;
  return indent.split(" ").length / tabSize;
}

function constructDescription(current: string | undefined, addition: string) {
  return `${current || ""}${current ? "\n\n" : ""}${addition}`;
}

export function mdToKanban(md: string, useTab: boolean, tabSize: number) {
  const lines = md.split(newLineRegex);
  const sections: Section[] = [];

  let indentLevel = 0;
  let containerStack: Array<Task | Section> = [];

  for (const line of lines) {
    try {
      // Section -----
      if (sectionRegex.test(line)) {
        const match = line.match(sectionRegex);
        const section: Section = {
          title: match[1],
          subtasks: [],
        };

        sections.push(section);

        containerStack = [section];
        indentLevel = 0;

        continue;
      }

      const stackLen = containerStack.length;
      const currentContainer = containerStack[stackLen - 1];

      // Task -----
      if (taskRegex.test(line)) {
        const match = line.match(taskRegex);
        const indent = getIndentLevel(match[1], useTab, tabSize);
        const task: Task = {
          bulletChar: match[2],
          boxChar: match[3],
          complete: match[3] !== " ",
          content: match[4],
          subtasks: [],
        };

        if (indent === indentLevel) {
          containerStack[stackLen - 1].subtasks.push(task);
          continue;
        }

        const subtasksLen = containerStack[stackLen - 1].subtasks.length;

        if (indent > indentLevel && subtasksLen) {
          const nextContainer = currentContainer.subtasks[subtasksLen - 1];

          containerStack.push(nextContainer);
          nextContainer.subtasks.push(task);
          indentLevel = indent;

          continue;
        }

        if (indent < indentLevel) {
          containerStack.pop();
          containerStack[containerStack.length - 1].subtasks.push(task);
          indentLevel = indent;

          continue;
        }
      }

      // List item -----
      if (listRegex.test(line)) {
        const match = line.match(listRegex);
        const indent = getIndentLevel(match[1], useTab, tabSize);
        let currentContainer = containerStack[stackLen - 1];

        if (indent === indentLevel) {
          currentContainer.description = constructDescription(
            currentContainer.description,
            match[3]
          );
          continue;
        }

        const subtasksLen = containerStack[stackLen - 1].subtasks.length;

        if (indent > indentLevel && subtasksLen) {
          const nextContainer = currentContainer.subtasks[subtasksLen - 1];

          containerStack.push(nextContainer);
          nextContainer.description = constructDescription(
            nextContainer.description,
            match[3]
          );
          indentLevel = indent;

          continue;
        }

        if (indent < indentLevel) {
          containerStack.pop();
          currentContainer = containerStack[containerStack.length - 1];
          currentContainer.description = constructDescription(
            currentContainer.description,
            match[3]
          );
          indentLevel = indent;

          continue;
        }
      }

      // Description item -----
      if (textRegex.test(line)) {
        currentContainer.description = constructDescription(
          currentContainer.description,
          line
        );
      }
    } catch (e) {
      console.error("Error parsing line", line);
      console.error(e);
    }
  }

  return sections;
}

function taskToListItem(
  task: Task,
  indentLevel: number,
  tabChar: string
): string {
  const output = [
    tabChar.repeat(indentLevel),
    task.bulletChar,
    ` [${task.boxChar}] `,
    task.content,
  ].join("");

  const description = task.description
    ? [
        tabChar.repeat(indentLevel + 1),
        task.bulletChar,
        ` ${task.description}`,
      ].join("") + "\n"
    : "";

  const subtasks = task.subtasks.length
    ? tasksToList(task.subtasks, indentLevel + 1, tabChar)
    : "";

  return `${output}\n${description}${subtasks}`;
}

function tasksToList(
  tasks: Task[],
  indentLevel: number,
  tabChar: string
): string {
  if (tasks.length === 0) {
    return "";
  }

  return tasks.reduce((str, task) => {
    return str + taskToListItem(task, indentLevel, tabChar);
  }, "");
}

export function kanbanToMd(
  sections: Section[],
  useTab: boolean,
  tabSize: number
): string {
  const tabChar = useTab ? "\t" : " ".repeat(tabSize);
  const output = [];

  for (const section of sections) {
    output.push(`## ${section.title}`);
    output.push("");

    if (section.description) {
      output.push(section.description);
      output.push("");
    }

    output.push(tasksToList(section.subtasks, 0, tabChar));
    output.push("");
  }

  return output.join("\n");
}
