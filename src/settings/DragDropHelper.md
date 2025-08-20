# DragDropHelper

A reusable utility class for implementing drag and drop functionality in the MetaFlow plugin settings sections.

## Features

- **Simple Array Reordering**: For basic arrays where items are reordered by index
- **Order-based Reordering**: For arrays with order properties that need to be maintained
- **Nested Array Support**: For reordering items within sub-arrays (e.g., templates within mappings)
- **Visual Feedback**: Adds CSS classes for drag states (`metaflow-settings-dragging`, `metaflow-settings-dragover`, `metaflow-settings-grab`)

## Usage

### Basic Array Reordering

```typescript
const dragDropHelper = new DragDropHelper<MyItemType>({
  container: containerElement,
  items: myArray,
  onReorder: () => this.saveSettings(),
  refreshDisplay: () => this.renderItems()
});

// Make an element draggable
dragDropHelper.makeDraggable(element, index);

// Remove draggable functionality (e.g., when editing)
dragDropHelper.makeNonDraggable(element);
```

### Order-based Reordering

```typescript
const dragDropHelper = new DragDropHelper<PropertyScript>({
  container: containerElement,
  items: scripts,
  onReorder: () => this.saveSettings(),
  refreshDisplay: () => this.renderScripts(),
  getOrder: (script) => script.order ?? Number.MAX_SAFE_INTEGER,
  setOrder: (script, order) => { script.order = order; }
});
```

### Nested Array Reordering

```typescript
const templateDragHelper = DragDropHelper.createNestedArrayHelper(
  folderMappings,
  (mapping) => mapping.templates,
  () => this.saveSettings(),
  () => this.renderMappings()
);

// Use the helper function
templateDragHelper(templateElement, templateIndex, mappingIndex);
```

## CSS Classes

The helper automatically adds these CSS classes for styling:

- `metaflow-settings-grab`: Added to draggable elements (indicates draggable state)
- `metaflow-settings-dragging`: Added during drag operation
- `metaflow-settings-dragover`: Added to drop targets during drag hover

## Configuration

### DragDropConfig<T>

- `container`: The parent container element
- `items`: The array of items to reorder
- `onReorder`: Callback function (sync or async) called after reordering
- `refreshDisplay`: Function to refresh the UI after reordering
- `getOrder` (optional): Function to get order value from an item
- `setOrder` (optional): Function to set order value on an item

## Examples

### PropertyDefaultValueScriptsSection

Uses order-based reordering where each script has an `order` property that determines its position.

### FolderFileClassMappingsSection

Uses simple array reordering for folder mappings and nested array reordering for templates within each mapping.
