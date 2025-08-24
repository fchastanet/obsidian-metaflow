import {DragDropHelper} from './DragDropHelper';

describe('DragDropHelper', () => {
  let container: HTMLElement;
  let items: Array<{id: number; order?: number}>;
  let onReorderCalled: boolean;
  let refreshDisplayCalled: boolean;

  beforeEach(() => {
    // Set up DOM
    document.body.innerHTML = '';
    container = document.createElement('div');
    document.body.appendChild(container);

    items = [
      {id: 1, order: 1},
      {id: 2, order: 2},
      {id: 3, order: 3}
    ];

    onReorderCalled = false;
    refreshDisplayCalled = false;
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('should create a DragDropHelper instance', () => {
    const helper = new DragDropHelper({
      container,
      items,
      onReorder: () => {onReorderCalled = true;},
      refreshDisplay: () => {refreshDisplayCalled = true;}
    });

    expect(helper).toBeDefined();
  });

  it('should make element draggable', () => {
    const helper = new DragDropHelper({
      container,
      items,
      onReorder: () => {onReorderCalled = true;},
      refreshDisplay: () => {refreshDisplayCalled = true;}
    });

    const element = document.createElement('div');
    helper.makeDraggable(element, 0);

    expect(element.draggable).toBe(true);
    expect(element.classList.contains('metaflow-settings-grab')).toBe(true);
    expect(element.getAttribute('data-index')).toBe('0');
  });

  it('should make element non-draggable', () => {
    const helper = new DragDropHelper({
      container,
      items,
      onReorder: () => {onReorderCalled = true;},
      refreshDisplay: () => {refreshDisplayCalled = true;}
    });

    const element = document.createElement('div');
    // First make it draggable
    helper.makeDraggable(element, 0);
    // Then make it non-draggable
    helper.makeNonDraggable(element);

    expect(element.draggable).toBe(false);
    expect(element.classList.contains('metaflow-settings-grab')).toBe(false);
  });

  it('should handle drag start event', () => {
    const helper = new DragDropHelper({
      container,
      items,
      onReorder: () => {onReorderCalled = true;},
      refreshDisplay: () => {refreshDisplayCalled = true;}
    });

    const element = document.createElement('div');
    helper.makeDraggable(element, 0);

    const dataTransfer = {
      setData: jest.fn()
    };

    const dragStartEvent = new Event('dragstart') as any;
    dragStartEvent.dataTransfer = dataTransfer;

    element.dispatchEvent(dragStartEvent);

    expect(element.classList.contains('metaflow-settings-dragging')).toBe(true);
    expect(dataTransfer.setData).toHaveBeenCalledWith('text/plain', '0');
  });

  it('should handle drag end event', () => {
    const helper = new DragDropHelper({
      container,
      items,
      onReorder: () => {onReorderCalled = true;},
      refreshDisplay: () => {refreshDisplayCalled = true;}
    });

    const element = document.createElement('div');
    helper.makeDraggable(element, 0);

    // Add dragging class first
    element.classList.add('metaflow-settings-dragging');

    const dragEndEvent = new Event('dragend');
    element.dispatchEvent(dragEndEvent);

    expect(element.classList.contains('metaflow-settings-dragging')).toBe(false);
  });

  it('should create nested array helper', () => {
    const parentItems = [
      {children: [{name: 'child1'}, {name: 'child2'}]},
      {children: [{name: 'child3'}]}
    ];

    const helper = DragDropHelper.createNestedArrayHelper(
      parentItems,
      (parent) => parent.children,
      () => {onReorderCalled = true;},
      () => {refreshDisplayCalled = true;}
    );

    expect(typeof helper).toBe('function');
  });

  it('should handle simple array reordering', async () => {
    const helper = new DragDropHelper({
      container,
      items,
      onReorder: () => {onReorderCalled = true;},
      refreshDisplay: () => {refreshDisplayCalled = true;}
    });

    const element = document.createElement('div');
    helper.makeDraggable(element, 1); // Element at index 1

    const dataTransfer = {
      getData: jest.fn().mockReturnValue('0') // Dragging from index 0
    };

    const dropEvent = new Event('drop') as any;
    dropEvent.dataTransfer = dataTransfer;
    dropEvent.preventDefault = jest.fn();

    element.dispatchEvent(dropEvent);

    // Wait for async operations
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(onReorderCalled).toBe(true);
    expect(refreshDisplayCalled).toBe(true);
    expect(items[0].id).toBe(2); // Item with id 2 should now be at index 0
    expect(items[1].id).toBe(1); // Item with id 1 should now be at index 1
  });

  it('should handle order-based reordering', async () => {
    const helper = new DragDropHelper({
      container,
      items,
      onReorder: () => {onReorderCalled = true;},
      refreshDisplay: () => {refreshDisplayCalled = true;},
      getOrder: (item) => item.order ?? Number.MAX_SAFE_INTEGER,
      setOrder: (item, order) => {item.order = order;}
    });

    const element = document.createElement('div');
    helper.makeDraggable(element, 1); // Element at index 1 (display index)

    const dataTransfer = {
      getData: jest.fn().mockReturnValue('0') // Dragging from display index 0
    };

    const dropEvent = new Event('drop') as any;
    dropEvent.dataTransfer = dataTransfer;
    dropEvent.preventDefault = jest.fn();

    element.dispatchEvent(dropEvent);

    // Wait for async operations
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(onReorderCalled).toBe(true);
    expect(refreshDisplayCalled).toBe(true);
    // Check that order values have been updated
    expect(items.find(item => item.id === 2)?.order).toBe(1);
    expect(items.find(item => item.id === 1)?.order).toBe(2);
  });
});
