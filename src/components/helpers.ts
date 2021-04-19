export const baseClassName = "kanban-plugin";

export function c(className: string) {
  return `${baseClassName}__${className}`;
}

export function reorderList<T>(lanes: T[], startIndex: number, endIndex: number) {
  const result = Array.from(lanes);
  const [removed] = result.splice(startIndex, 1);
  result.splice(endIndex, 0, removed);

  return result;
}

export function generateTempId(): string {
    return Math.random().toString(36).substr(2, 9);
}