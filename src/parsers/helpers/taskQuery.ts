import { TFile } from 'obsidian';
import { StateManager } from '../../StateManager';
import { Item, Lane } from '../../components/types';
import { generateInstanceId } from '../../components/helpers';
import { getTasksPlugin } from './inlineMetadata';

export interface TaskQueryResult {
  description: string;
  status: string;
  path: string;
  line: number;
  blockId?: string;
  priority?: string;
  tags?: string[];
  due?: Date;
  done?: Date;
  created?: Date;
  start?: Date;
  scheduled?: Date;
}

/**
 * Populates a lane with tasks from a query, merging with existing manually added items
 */
export function populateLaneFromQuery(
  stateManager: StateManager,
  lane: Lane
): Item[] {
  if (!lane.data.query) {
    return lane.children;
  }

  const tasksPlugin = getTasksPlugin();
  if (!tasksPlugin) {
    console.warn('Tasks plugin not available for query execution');
    return lane.children;
  }

  try {
    // Get the Tasks plugin's query engine
    const queryEngine = tasksPlugin.apiV1?.queryTasks;
    if (!queryEngine) {
      console.warn('Tasks plugin query API not available');
      return lane.children;
    }

    // Execute the tasks query
    const queryResults = queryEngine(lane.data.query, stateManager.file.path);

    if (!queryResults || !Array.isArray(queryResults)) {
      return lane.children;
    }

    // Convert query results to Kanban items
    const queryItems: Item[] = queryResults.map((task: TaskQueryResult) => {
      const content = task.description || '';
      const checkChar = task.status || ' ';
      
      // Create a new item with the task data
      const item = stateManager.getNewItem(content, checkChar);
      
      // Mark this item as being from a query so we can distinguish it
      item.data = {
        ...item.data,
        fromQuery: true,
        querySource: {
          path: task.path,
          line: task.line,
          blockId: task.blockId,
        }
      };

      // Add metadata from the task
      if (task.due) {
        item.data.metadata.dateStr = task.due.toISOString().split('T')[0];
      }
      
      if (task.tags) {
        item.data.metadata.tags = task.tags;
      }

      if (task.priority) {
        // Add priority to the task content if not already present
        if (!content.includes('🔺') && !content.includes('⏫') && !content.includes('🔼')) {
          const prioritySymbol = getPrioritySymbol(task.priority);
          if (prioritySymbol) {
            item.data.title = `${content} ${prioritySymbol}`;
            item.data.titleRaw = `${content} ${prioritySymbol}`;
          }
        }
      }

      return item;
    });

    // Filter out manually added items that aren't from queries
    const manualItems = lane.children.filter((item: Item) => 
      !(item.data as any)?.fromQuery
    );

    // Merge query items with manual items
    return [...queryItems, ...manualItems];
  } catch (error) {
    console.error('Error executing tasks query:', error);
    return lane.children;
  }
}

/**
 * Updates an item's properties to match the target lane's query criteria.
 * This is a simplified implementation - a real implementation would need
 * more sophisticated query parsing to understand what properties to set,
 * this is here to define a starting point.
 */
export function updateItemForQuery(item: Item, query: string): Item {
  // Parse common query patterns and update item accordingly
  if (query.includes('due today')) {
    // Add due date to task if not present
    // TODO: Get the configurated date format from Tasks definitions
    const today = new Date().toISOString().split('T')[0]; // teporary

    if (!item.data.titleRaw.includes('📅')) {
      const updatedContent = `${item.data.titleRaw} 📅 ${today}`;
      return {
        ...item,
        data: {
          ...item.data,
          title: updatedContent,
          titleRaw: updatedContent,
          metadata: {
            ...item.data.metadata,
            dateStr: today
          }
        }
      };
    }
  }
  
  if (query.includes('done') && !query.includes('not done')) {
    // Mark item as completed
    return {
      ...item,
      data: {
        ...item.data,
        checked: true,
        checkChar: 'x'
      }
    };
  }
  
  if (query.includes('not done')) {
    // Mark item as not completed
    return {
      ...item,
      data: {
        ...item.data,
        checked: false,
        checkChar: ' '
      }
    };
  }

  if (query.includes('priority high')) {
    // Add high priority if not present
    if (!item.data.titleRaw.includes('🔺')) {
      const updatedContent = `${item.data.titleRaw} 🔺`;
      return {
        ...item,
        data: {
          ...item.data,
          title: updatedContent,
          titleRaw: updatedContent
        }
      };
    }
  }

  return item;
}

/**
 * Gets the appropriate priority symbol for a priority level ⏬🔽🔼⏫🔺
 */
function getPrioritySymbol(priority: string): string {
  switch (priority?.toLowerCase()) {
    case 'highest':
      return '🔺';
    case 'high':
      return '⏫';
    case 'medium':
      return '🔼';
    case 'low':
      return '🔽';
    case 'lowest':
      return '⏬';
    default:
      return '';
  }
}

/**
 * Checks if a lane has dynamic content from queries
 */
export function isLaneDynamic(lane: Lane): boolean {
  return !!lane.data.query;
}

/**
 * Refreshes all dynamic lanes in a board
 */
export function refreshDynamicLanes(stateManager: StateManager, lanes: Lane[]): Lane[] {
  return lanes.map(lane => {
    if (isLaneDynamic(lane)) {
      const updatedChildren = populateLaneFromQuery(stateManager, lane);
      return {
        ...lane,
        children: updatedChildren
      };
    }
    return lane;
  });
}