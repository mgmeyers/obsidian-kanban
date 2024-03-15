import { c } from '../helpers';
import { Item } from '../types';

export interface TaskCounterProps {
    item: Item;
}

export function TaskCounter({ item }: TaskCounterProps) {
    if (!item.data.metadata.tasks) {
        return null;
    }

    return (
        <div className={c('item-tasks-count')}>
            {item.data.metadata.tasks.completed}/{item.data.metadata.tasks.total}
        </div>
    );
}
