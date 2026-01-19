import { StateManager } from 'src/StateManager';

import { c } from '../helpers';
import { Item } from '../types';

export interface TaskCounterProps {
    item: Item;
    stateManager: StateManager;
}

export function TaskCounter({ item, stateManager }: TaskCounterProps) {
    const hideTaskCount = stateManager.useSetting('hide-task-count');

    if (hideTaskCount || !item.data.metadata.tasks) {
        return null;
    }

    return (
        <div className={c('item-tasks-count')}>
            {item.data.metadata.tasks.completed}/{item.data.metadata.tasks.total}
        </div>
    );
}
