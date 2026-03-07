import update from 'immutability-helper';
import { Modal } from 'obsidian';
import { render, unmountComponentAtNode, useCallback, useState } from 'preact/compat';
import { StateManager } from 'src/StateManager';
import { Category } from 'src/components/types';
import { t } from 'src/lang/helpers';

import { c } from './helpers';

interface CategoryItemProps {
  category: Category;
  index: number;
  total: number;
  onUpdate: (name: string, color: string) => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

function CategoryItem({ category, index, total, onUpdate, onDelete, onMoveUp, onMoveDown }: CategoryItemProps) {
  return (
    <div className={c('category-item')}>
      <div className={c('category-reorder-btns')}>
        <button
          className={`clickable-icon ${c('category-reorder-btn')}`}
          onClick={onMoveUp}
          disabled={index === 0}
          aria-label="Move up"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="m18 15-6-6-6 6"/>
          </svg>
        </button>
        <button
          className={`clickable-icon ${c('category-reorder-btn')}`}
          onClick={onMoveDown}
          disabled={index === total - 1}
          aria-label="Move down"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="m6 9 6 6 6-6"/>
          </svg>
        </button>
      </div>
      <input
        type="color"
        className={c('category-color-input')}
        value={category.color || '#4a90d9'}
        onChange={(e) => onUpdate(category.name, (e.target as HTMLInputElement).value)}
      />
      <input
        type="text"
        className={c('category-name-input')}
        placeholder={t('Category name')}
        value={category.name}
        onChange={(e) => onUpdate((e.target as HTMLInputElement).value, category.color)}
      />
      <button
        className={`clickable-icon ${c('category-delete-btn')}`}
        onClick={onDelete}
        aria-label={t('Remove category')}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M3 6h18" />
          <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
          <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
        </svg>
      </button>
    </div>
  );
}

interface CategoryListProps {
  initialCategories: Category[];
  onSave: (categories: Category[]) => void;
}

function CategoryList({ initialCategories, onSave }: CategoryListProps) {
  const [categories, setCategories] = useState<Category[]>(initialCategories);

  const addCategory = useCallback(() => {
    const updated = update(categories, {
      $push: [{ name: '', color: '#4a90d9' }],
    });
    setCategories(updated);
    onSave(updated);
  }, [categories, onSave]);

  const updateCategory = useCallback(
    (index: number, name: string, color: string) => {
      const updated = update(categories, {
        [index]: { name: { $set: name }, color: { $set: color } },
      });
      setCategories(updated);
      onSave(updated);
    },
    [categories, onSave]
  );

  const deleteCategory = useCallback(
    (index: number) => {
      const updated = update(categories, { $splice: [[index, 1]] });
      setCategories(updated);
      onSave(updated);
    },
    [categories, onSave]
  );

  const moveCategory = useCallback(
    (from: number, to: number) => {
      if (to < 0 || to >= categories.length) return;
      const item = categories[from];
      const updated = update(categories, {
        $splice: [
          [from, 1],
          [to, 0, item],
        ],
      });
      setCategories(updated);
      onSave(updated);
    },
    [categories, onSave]
  );

  return (
    <div className={c('category-list')}>
      <div className={c('category-list-header')}>
        <h3>{t('Manage categories')}</h3>
        <p className={c('category-list-desc')}>
          {t('Add categories to organize your cards. Each category has a name and color.')}
        </p>
      </div>
      <div className={c('category-items')}>
        {categories.map((cat, i) => (
          <CategoryItem
            key={i}
            category={cat}
            index={i}
            total={categories.length}
            onUpdate={(name, color) => updateCategory(i, name, color)}
            onDelete={() => deleteCategory(i)}
            onMoveUp={() => moveCategory(i, i - 1)}
            onMoveDown={() => moveCategory(i, i + 1)}
          />
        ))}
      </div>
      <button className={c('category-add-btn')} onClick={addCategory}>
        + {t('Add category')}
      </button>
    </div>
  );
}

export class CategoryModal extends Modal {
  stateManager: StateManager;

  constructor(stateManager: StateManager) {
    super(stateManager.app);
    this.stateManager = stateManager;
  }

  onOpen() {
    const { contentEl, modalEl } = this;
    modalEl.addClass(c('category-modal'));

    const categories = (this.stateManager.getSetting('categories') as Category[]) || [];

    render(
      <CategoryList
        initialCategories={categories}
        onSave={(updated) => {
          this.stateManager.setState((board) =>
            update(board, {
              data: {
                settings: {
                  categories: { $set: updated },
                },
              },
            })
          );
        }}
      />,
      contentEl
    );
  }

  onClose() {
    unmountComponentAtNode(this.contentEl);
    this.contentEl.empty();
  }
}
