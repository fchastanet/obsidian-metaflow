export interface DragDropConfig<T> {
  /**
   * The container element that holds all draggable items
   */
  container: HTMLElement;

  /**
   * The array of items to reorder
   */
  items: T[];

  /**
   * Callback function called when items are reordered
   */
  onReorder: () => Promise<void> | void;

  /**
   * Function to refresh the display after reordering
   */
  refreshDisplay: () => void;

  /**
   * Optional function to get the order value from an item (for order-based sorting)
   */
  getOrder?: (item: T) => number;

  /**
   * Optional function to set the order value on an item (for order-based sorting)
   */
  setOrder?: (item: T, order: number) => void;
}

/**
 * Helper class to add drag and drop functionality to lists of elements
 */
export class DragDropHelper<T> {
  private config: DragDropConfig<T>;
  private isDragActive = false;

  constructor(config: DragDropConfig<T>) {
    this.config = config;
  }

  /**
   * Makes an element draggable and sets up all drag and drop event listeners
   */
  makeDraggable(element: HTMLElement, index: number): void {
    // Add drag and drop functionality
    element.draggable = true;
    element.classList.add('metaflow-settings-grab');
    element.setAttribute('data-index', index.toString());

    // Add visual feedback for drag operations
    element.addEventListener('dragstart', (e) => {
      this.isDragActive = true;
      element.classList.add('metaflow-settings-dragging');
      e.dataTransfer?.setData('text/plain', index.toString());
    });

    element.addEventListener('dragend', () => {
      this.isDragActive = false;
      element.classList.remove('metaflow-settings-dragging');
    });

    element.addEventListener('dragover', (e) => {
      e.preventDefault();
      if (this.isDragActive) {
        element.classList.add('metaflow-settings-dragover');
      }
    });

    element.addEventListener('dragleave', () => {
      element.classList.remove('metaflow-settings-dragover');
    });

    element.addEventListener('drop', async (e) => {
      e.preventDefault();
      element.classList.remove('metaflow-settings-dragover');

      const draggedIndex = parseInt(e.dataTransfer?.getData('text/plain') || '');
      const targetIndex = index;

      if (draggedIndex !== targetIndex && !isNaN(draggedIndex)) {
        await this.reorderItems(draggedIndex, targetIndex);
      }
    });
  }

  /**
   * Removes draggable functionality from an element
   */
  makeNonDraggable(element: HTMLElement): void {
    element.draggable = false;
    element.classList.remove('metaflow-settings-grab');
  }

  /**
   * Reorders items in the array and updates order values if applicable
   */
  private async reorderItems(draggedIndex: number, targetIndex: number): Promise<void> {
    // For order-based sorting (like PropertyDefaultValueScripts)
    if (this.config.getOrder && this.config.setOrder) {
      await this.reorderWithOrderValues(draggedIndex, targetIndex);
    } else {
      // For simple array-based sorting (like FolderFileClassMappings)
      await this.reorderSimpleArray(draggedIndex, targetIndex);
    }
  }

  /**
   * Reorders items using order values (for PropertyDefaultValueScripts)
   */
  private async reorderWithOrderValues(draggedIndex: number, targetIndex: number): Promise<void> {
    if (!this.config.getOrder || !this.config.setOrder) return;

    // Create a sorted copy of the items based on their order
    const orderedItems = this.config.items
      .slice()
      .sort((a, b) =>
        (this.config.getOrder!(a) ?? Number.MAX_SAFE_INTEGER) -
        (this.config.getOrder!(b) ?? Number.MAX_SAFE_INTEGER)
      );

    // Get the actual items from the sorted array
    const draggedItem = orderedItems[draggedIndex];

    // Remove dragged item from the ordered array
    orderedItems.splice(draggedIndex, 1);

    // Insert at the new position
    const insertIndex = draggedIndex < targetIndex ? targetIndex : targetIndex;
    orderedItems.splice(insertIndex, 0, draggedItem);

    // Recompute all order values based on new positions
    orderedItems.forEach((item, newIndex) => {
      this.config.setOrder!(item, newIndex + 1);
    });

    await Promise.resolve(this.config.onReorder());
    this.config.refreshDisplay();
  }

  /**
   * Reorders items in a simple array (for FolderFileClassMappings)
   */
  private async reorderSimpleArray(draggedIndex: number, targetIndex: number): Promise<void> {
    // Reorder the array
    const draggedItem = this.config.items[draggedIndex];
    this.config.items.splice(draggedIndex, 1);
    this.config.items.splice(targetIndex, 0, draggedItem);

    await Promise.resolve(this.config.onReorder());
    this.config.refreshDisplay();
  }

  /**
   * Creates a drag drop helper for nested arrays (e.g., templates within mappings)
   */
  static createNestedArrayHelper<TParent, TChild>(
    parentItems: TParent[],
    getChildArray: (parent: TParent) => TChild[],
    onReorder: () => Promise<void> | void,
    refreshDisplay: () => void
  ): (element: HTMLElement, childIndex: number, parentIndex: number) => void {

    return (element: HTMLElement, childIndex: number, parentIndex: number) => {
      // Add drag and drop functionality
      element.draggable = true;
      element.classList.add('metaflow-settings-grab');
      element.setAttribute('data-index', childIndex.toString());

      // Add visual feedback for drag operations
      element.addEventListener('dragstart', (e) => {
        element.classList.add('metaflow-settings-dragging');
        e.dataTransfer?.setData('text/plain', childIndex.toString());
      });

      element.addEventListener('dragend', () => {
        element.classList.remove('metaflow-settings-dragging');
      });

      element.addEventListener('dragover', (e) => {
        e.preventDefault();
        element.classList.add('metaflow-settings-dragover');
      });

      element.addEventListener('dragleave', () => {
        element.classList.remove('metaflow-settings-dragover');
      });

      element.addEventListener('drop', async (e) => {
        e.preventDefault();
        element.classList.remove('metaflow-settings-dragover');

        const draggedIndex = parseInt(e.dataTransfer?.getData('text/plain') || '');
        const targetIndex = childIndex;

        if (draggedIndex !== targetIndex && !isNaN(draggedIndex)) {
          // Get the child array from the parent
          const childArray = getChildArray(parentItems[parentIndex]);

          // Reorder the child array
          const draggedItem = childArray[draggedIndex];
          childArray.splice(draggedIndex, 1);
          childArray.splice(targetIndex, 0, draggedItem);

          await Promise.resolve(onReorder());
          refreshDisplay();
        }
      });
    };
  }
}
