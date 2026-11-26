import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Box, IconButton, Tooltip } from "@mui/material";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";

// A vertical list whose items are reordered by dragging a handle.
// Lists can be nested (bullets inside jobs inside sections): each list has its
// own DndContext, so a drag only moves items within the list it started in.
//
// children(item, handle) renders one item; put `handle` where the grip goes.

export default function SortableList({ items, onReorder, children }) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return;
    const from = items.findIndex((i) => i.id === active.id);
    const to = items.findIndex((i) => i.id === over.id);
    if (from < 0 || to < 0) return;
    onReorder(arrayMove(items, from, to));
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
        {items.map((item) => (
          <SortableItem key={item.id} id={item.id}>
            {(handle) => children(item, handle)}
          </SortableItem>
        ))}
      </SortableContext>
    </DndContext>
  );
}

function SortableItem({ id, children }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const handle = (
    <Tooltip title="Drag to move" placement="left" disableInteractive>
      <IconButton
        size="small"
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        sx={{ p: 0.25, cursor: isDragging ? "grabbing" : "grab", touchAction: "none" }}
        aria-label="Drag to move"
      >
        <DragIndicatorIcon sx={{ fontSize: 18 }} />
      </IconButton>
    </Tooltip>
  );

  return (
    <Box
      ref={setNodeRef}
      sx={{
        transform: CSS.Translate.toString(transform),
        transition,
        position: "relative",
        zIndex: isDragging ? 10 : "auto",
        bgcolor: isDragging ? "background.paper" : undefined,
        boxShadow: isDragging ? 3 : undefined,
      }}
    >
      {children(handle)}
    </Box>
  );
}
