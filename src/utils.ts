import { IChecklistItem, IFilterOptions, ISortOptions, Priority } from './types';

export const PRIORITY_WEIGHT: { [key in Priority]: number } = {
    high: 3,
    medium: 2,
    low: 1
};

export const PRIORITY_ICONS: { [key in Priority]: string } = {
    high: '🔴',
    medium: '🟡',
    low: '🟢'
};

export function filterItems(items: IChecklistItem[], options: IFilterOptions): IChecklistItem[] {
    return items.filter(item => {
        if (options.priority && item.priority !== options.priority) {
            return false;
        }
        if (options.status !== undefined && item.status !== options.status) {
            return false;
        }
        if (options.tags && options.tags.length > 0) {
            if (!item.tags || !options.tags.some(tag => item.tags?.includes(tag))) {
                return false;
            }
        }
        if (options.dueDate) {
            if (item.dueDate) {
                if (options.dueDate.before && item.dueDate > options.dueDate.before) {
                    return false;
                }
                if (options.dueDate.after && item.dueDate < options.dueDate.after) {
                    return false;
                }
            }
        }
        return true;
    });
}

export function sortItems(items: IChecklistItem[], options: ISortOptions): IChecklistItem[] {
    return [...items].sort((a, b) => {
        const direction = options.direction === 'asc' ? 1 : -1;
        
        switch (options.by) {
            case 'priority':
                return direction * ((PRIORITY_WEIGHT[a.priority || 'low'] || 0) - 
                                 (PRIORITY_WEIGHT[b.priority || 'low'] || 0));
            case 'dueDate':
                if (!a.dueDate && !b.dueDate) return 0;
                if (!a.dueDate) return direction;
                if (!b.dueDate) return -direction;
                return direction * (a.dueDate.getTime() - b.dueDate.getTime());
            case 'status':
                return direction * ((a.status ? 1 : 0) - (b.status ? 1 : 0));
            case 'label':
                return direction * a.label.localeCompare(b.label);
            default:
                return 0;
        }
    });
}
