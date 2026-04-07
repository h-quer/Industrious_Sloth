import React, { useState } from "react";
import { Plus, MoreVertical, Trash2, AlignLeft, Edit2, Check, X, LayoutDashboard } from "lucide-react";
import Icon from '@mdi/react';
import { Board, Lane, Item } from "../types";
import { isValidFilename, getInvalidChars } from "../lib/utils";
import {
  DndContext,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  defaultDropAnimationSideEffects,
  CollisionDetection,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  verticalListSortingStrategy,
  horizontalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { format, isPast, parseISO, isToday } from "date-fns";

interface BoardViewProps {
  board: Board;
  onItemClick: (item: Item) => void;
  onAddLane: (name: string) => void;
  onAddItem: (laneId: string, name: string) => void;
  onReorderLanes: (laneIds: string[]) => void;
  onReorderItems: (laneId: string, itemIds: string[]) => void;
  onMoveItemLocal: (itemId: string, sourceLaneId: string, targetLaneId: string, targetIndex: number) => void;
  onMoveItem: (itemId: string, sourceLaneId: string, targetLaneId: string, targetIndex: number) => void;
  onRenameLane: (laneId: string, name: string) => void;
  onDeleteLane: (laneId: string) => void;
}

function SortableItem({ item, onClick }: { item: Item; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item._dragId!,
    data: { type: "item", item },
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
    zIndex: isDragging ? 1 : 0,
  };

  const dueDate = item.metadata.dueDate ? parseISO(item.metadata.dueDate) : null;
  const isOverdue = dueDate && isPast(dueDate) && !isToday(dueDate);
  const isDueToday = dueDate && isToday(dueDate);

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className="bg-jungle-paper dark:bg-jungle-paper-dark p-3 rounded-xl shadow-sm border border-jungle-border dark:border-jungle-border-dark hover:border-jungle-emerald dark:hover:border-jungle-emerald-dark hover:shadow-md cursor-pointer group relative mb-3"
    >
      <div className="flex justify-between items-start mb-2">
        <h4 className="text-sm font-bold text-jungle-text dark:text-jungle-text-light line-clamp-2 leading-tight">{item.name}</h4>
        {item.content && item.content.trim().length > 0 && (
          <AlignLeft size={14} className="text-jungle-border dark:text-jungle-border-dark flex-shrink-0 ml-2 mt-0.5" />
        )}
      </div>
      
      {item.metadata.tags && item.metadata.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {item.metadata.tags.map(tag => (
            <span key={tag} className="px-1.5 py-0.5 bg-jungle-view-header dark:bg-jungle-view-header-dark/30 text-[10px] rounded-md text-jungle-emerald dark:text-jungle-emerald-dark font-bold border border-emerald-100 dark:border-emerald-800">
              {tag}
            </span>
          ))}
        </div>
      )}

      {dueDate && (
        <div className={`text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 ${
          isOverdue 
            ? "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-1.5 py-0.5 rounded-md inline-flex" 
            : isDueToday
            ? "text-jungle-amber dark:text-jungle-amber-dark bg-jungle-amber-muted dark:bg-jungle-amber-muted-dark px-1.5 py-0.5 rounded-md inline-flex"
            : "text-jungle-text-muted dark:text-jungle-text-muted-dark"
        }`}>
          {format(dueDate, "yyyy-MM-dd")}
        </div>
      )}
    </div>
  );
}

function SortableLane({ 
  lane, 
  items, 
  onItemClick, 
  onAddItem,
  onRenameLane,
  onDeleteLane,
  allLanes
}: { 
  lane: Lane; 
  items: Item[]; 
  onItemClick: (item: Item) => void; 
  onAddItem: (laneId: string, name: string) => void;
  onRenameLane: (laneId: string, name: string) => void;
  onDeleteLane: (laneId: string) => void;
  allLanes: Lane[];
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: lane.id,
    data: { type: "lane", lane },
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const [isAdding, setIsAdding] = useState(false);
  const [newItemName, setNewItemName] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(lane.name);
  const [editNameError, setEditNameError] = useState<string | null>(null);

  const handleAddItem = () => {
    const trimmedName = newItemName.trim();
    if (trimmedName) {
      if (!isValidFilename(trimmedName)) {
        const invalid = getInvalidChars(trimmedName);
        setNameError(`Invalid characters: ${invalid.join(" ")}`);
        return;
      }
      if (items.some(i => i.name.toLowerCase() === trimmedName.toLowerCase())) {
        setNameError("An item with this name already exists in this lane.");
        return;
      }
      onAddItem(lane.id, trimmedName);
      setNewItemName("");
      setIsAdding(false);
      setNameError(null);
    }
  };

  const handleRename = () => {
    const trimmedName = editName.trim();
    if (trimmedName && trimmedName !== lane.name) {
      if (!isValidFilename(trimmedName)) {
        const invalid = getInvalidChars(trimmedName);
        setEditNameError(`Invalid characters: ${invalid.join(" ")}`);
        return;
      }
      // Check for duplicate lane names in the board
      if (allLanes.some(l => l.id !== lane.id && l.name.toLowerCase() === trimmedName.toLowerCase())) {
        setEditNameError("A lane with this name already exists in this board.");
        return;
      }
      onRenameLane(lane.id, trimmedName);
    }
    setIsEditing(false);
    setEditNameError(null);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex-shrink-0 w-[85vw] md:w-72 bg-jungle-view-header/40 dark:bg-jungle-view-header-dark rounded-2xl flex flex-col max-h-full border border-jungle-border/50 dark:border-jungle-border-dark/50 hover:border-jungle-border dark:hover:border-jungle-border-dark transition-colors"
    >
      <div className="p-4 flex items-center justify-between">
        <div {...attributes} {...listeners} className="flex items-center gap-2 flex-1 cursor-grab active:cursor-grabbing overflow-hidden">
          {isEditing ? (
            <div className="flex-1 min-w-0">
              <input
                autoFocus
                type="text"
                value={editName}
                onChange={(e) => {
                  setEditName(e.target.value);
                  setEditNameError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    e.stopPropagation();
                    handleRename();
                  }
                  if (e.key === "Escape") {
                    setEditName(lane.name);
                    setIsEditing(false);
                    setEditNameError(null);
                  }
                  if (e.key === " ") e.stopPropagation();
                }}
                onBlur={handleRename}
                className={`bg-jungle-paper dark:bg-jungle-paper-dark border ${editNameError ? 'border-red-500' : 'border-jungle-emerald'} rounded px-1 py-0.5 text-sm font-black w-full outline-none`}
              />
              {editNameError && (
                <p className="text-[10px] text-red-500 font-bold mt-1 px-1">{editNameError}</p>
              )}
            </div>
          ) : (
            <h3 className="font-black text-jungle-text-muted dark:text-jungle-text-muted-dark text-sm truncate">{lane.name}</h3>
          )}
          <span className="bg-jungle-border/50 dark:bg-jungle-border-dark text-jungle-text-muted dark:text-jungle-text-muted-dark text-[10px] px-2 py-0.5 rounded-full font-black flex-shrink-0">{items.length}</span>
        </div>
        
        <div className="flex items-center gap-1 ml-2">
          <button 
            onClick={() => setIsEditing(!isEditing)}
            className="p-1 text-jungle-text-muted dark:text-jungle-text-muted-dark hover:text-jungle-emerald dark:hover:text-jungle-emerald-dark transition-colors"
            title="Rename Lane"
          >
            {isEditing ? <Check size={14} /> : <Edit2 size={14} />}
          </button>
          <button 
            onClick={() => onDeleteLane(lane.id)}
            className="p-1 text-jungle-text-muted dark:text-jungle-text-muted-dark hover:text-red-600 dark:hover:text-red-400 transition-colors"
            title="Delete Lane"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 pb-3 custom-scrollbar">
        <SortableContext items={items.map(i => i._dragId!)} strategy={verticalListSortingStrategy}>
          {items.map(item => (
            <SortableItem key={item._dragId} item={item} onClick={() => onItemClick(item)} />
          ))}
        </SortableContext>

        {isAdding ? (
          <div className="bg-jungle-paper dark:bg-jungle-paper-dark p-4 rounded-xl shadow-sm border-2 border-jungle-emerald dark:border-jungle-emerald-dark">
            <input
              autoFocus
              type="text"
              value={newItemName}
              onChange={(e) => {
                setNewItemName(e.target.value);
                setNameError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  e.stopPropagation();
                  handleAddItem();
                }
                if (e.key === " ") e.stopPropagation();
              }}
              onBlur={() => !newItemName && setIsAdding(false)}
              className={`w-full text-base font-medium text-jungle-text dark:text-jungle-text-light border-none focus:ring-0 py-1 px-0 ${nameError ? 'mb-2' : 'mb-3'} placeholder-jungle-text-muted dark:placeholder-jungle-text-muted-dark bg-transparent`}
              placeholder="Enter task name..."
            />
            {nameError && (
              <p className="text-xs text-red-500 font-bold mb-3">{nameError}</p>
            )}
            <div className="flex justify-end gap-3">
              <button onClick={() => setIsAdding(false)} className="text-sm font-bold text-jungle-text-muted dark:text-jungle-text-muted-dark hover:text-jungle-text dark:hover:text-jungle-text-light">Cancel</button>
              <button onClick={handleAddItem} className="text-sm text-jungle-emerald dark:text-jungle-emerald-dark font-black hover:text-emerald-700 dark:hover:text-emerald-300">Add</button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setIsAdding(true)}
            className="w-full py-2.5 flex items-center justify-center gap-1 text-jungle-text-muted dark:text-jungle-text-muted-dark hover:text-jungle-emerald dark:hover:text-jungle-emerald-dark hover:bg-jungle-view-header dark:hover:bg-jungle-view-header-dark/20 rounded-xl transition-all border-2 border-dashed border-jungle-border dark:border-jungle-border-dark hover:border-jungle-emerald dark:hover:border-jungle-emerald-dark"
          >
            <Plus size={16} />
            <span className="text-xs font-bold">Add Task</span>
          </button>
        )}
      </div>
    </div>
  );
}

export default function BoardView({ 
  board, 
  onItemClick, 
  onAddLane, 
  onAddItem, 
  onReorderLanes, 
  onReorderItems, 
  onMoveItemLocal,
  onMoveItem,
  onRenameLane,
  onDeleteLane
}: BoardViewProps) {
  const [activeItem, setActiveItem] = useState<Item | null>(null);
  const [originalLaneId, setOriginalLaneId] = useState<string | null>(null);
  const [activeLane, setActiveLane] = useState<Lane | null>(null);
  const [isAddingLane, setIsAddingLane] = useState(false);
  const [newLaneName, setNewLaneName] = useState("");
  const [laneNameError, setLaneNameError] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const handleDragStart = (event: any) => {
    const { active } = event;
    if (active.data.current.type === "item") {
      setActiveItem(active.data.current.item);
      setOriginalLaneId(active.data.current.item.laneId);
    } else if (active.data.current.type === "lane") {
      setActiveLane(active.data.current.lane);
    }
  };

  const findLaneOfItem = (dragId: string) => {
    return board.lanes.find(l => l.items.some(i => i._dragId === dragId));
  };

  const handleDragOver = (event: any) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id;
    const overId = over.id;

    if (activeId === overId) return;

    const activeType = active.data.current?.type;
    const overType = over.data.current?.type;

    if (activeType === "item") {
      const activeLane = findLaneOfItem(activeId);
      const overLane = overType === "lane" ? board.lanes.find(l => l.id === overId) : findLaneOfItem(overId);

      if (!activeLane || !overLane || activeLane.id === overLane.id) {
        return;
      }

      // We don't call onMoveItemLocal here anymore for cross-lane moves
      // to ensure UI only updates after the file system operation is complete.
    }
  };

  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    const startLaneId = originalLaneId;
    setActiveItem(null);
    setActiveLane(null);
    setOriginalLaneId(null);

    if (!over) return;

    const activeId = active.id;
    const overId = over.id;

    if (activeId === overId) return;

    const activeType = active.data.current?.type;
    const overType = over.data.current?.type;

    if (activeType === "lane") {
      const oldIndex = board.lanes.findIndex(l => l.id === activeId);
      
      let overLaneId = overId;
      if (overType === "item") {
        overLaneId = overId.split(":")[1];
      }
      
      const newIndex = board.lanes.findIndex(l => l.id === overLaneId);
      
      if (oldIndex !== -1 && newIndex !== -1) {
        const newLanes = arrayMove(board.lanes, oldIndex, newIndex);
        onReorderLanes(newLanes.map(l => l.id));
      }
    } else if (activeType === "item") {
      const currentItem = active.data.current.item;
      const originalLaneIdForMove = startLaneId || currentItem.laneId;
      
      const targetLaneId = overType === "lane" ? overId : overId.split(":")[1];
      const targetLane = board.lanes.find(l => l.id === targetLaneId);
      
      if (!targetLane) return;

      if (originalLaneIdForMove !== targetLaneId) {
        // Moved to a new lane
        let finalIndex = targetLane.items.findIndex(i => i._dragId === activeId);
        if (finalIndex === -1 || finalIndex === undefined) {
          finalIndex = overType === "lane" ? targetLane.items.length : (over.data.current?.sortable?.index ?? targetLane.items.length);
        }
        if (finalIndex !== undefined && finalIndex !== -1) {
          onMoveItem(currentItem.id, originalLaneIdForMove, targetLaneId, finalIndex);
        }
      } else {
        // Stayed in the same lane
        const activeIndex = active.data.current?.sortable?.index;
        const overIndex = over.data.current?.sortable?.index;
        if (activeIndex !== undefined && overIndex !== undefined && activeIndex !== overIndex) {
          const newItemIds = arrayMove(targetLane.items, activeIndex, overIndex).map(i => i.id);
          onReorderItems(targetLaneId, newItemIds);
        }
      }
    }
  };

  const handleAddLane = () => {
    const trimmedName = newLaneName.trim();
    if (trimmedName) {
      if (!isValidFilename(trimmedName)) {
        const invalid = getInvalidChars(trimmedName);
        setLaneNameError(`Invalid characters: ${invalid.join(" ")}`);
        return;
      }
      if (board.lanes.some(l => l.name.toLowerCase() === trimmedName.toLowerCase())) {
        setLaneNameError("A lane with this name already exists in this board.");
        return;
      }
      onAddLane(trimmedName);
      setNewLaneName("");
      setIsAddingLane(false);
      setLaneNameError(null);
    }
  };

  const customCollisionDetection: CollisionDetection = (args) => {
    if (args.active.data.current?.type === "lane") {
      const laneCollisions = args.droppableContainers.filter(
        (container) => container.data.current?.type === "lane"
      );
      return closestCorners({ ...args, droppableContainers: laneCollisions });
    }
    return closestCorners(args);
  };

  if (!board) {
    return (
      <div className="h-full flex items-center justify-center text-jungle-text-muted dark:text-jungle-text-muted-dark">
        Board not found
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-jungle-mist dark:bg-clouded-night transition-colors duration-300">
      <div className="px-4 md:px-8 py-4 md:py-0 flex items-center justify-between bg-jungle-view-header dark:bg-jungle-view-header-dark border-b border-jungle-border dark:border-jungle-border-dark md:h-[132px] flex-shrink-0">
        <div className="flex items-center gap-3 md:gap-4">
          <div className="w-10 h-10 md:w-14 md:h-14 rounded-2xl flex items-center justify-center text-white text-xl md:text-3xl shadow-lg" style={{ backgroundColor: board.color || '#059669', boxShadow: `0 10px 15px -3px ${(board.color || '#059669')}40` }}>
            {board.icon && board.icon.startsWith('M') ? <Icon path={board.icon} size={1} className="md:w-auto md:h-auto w-6 h-6" /> : (board.icon || <LayoutDashboard size={24} />)}
          </div>
          <h2 className="text-xl md:text-3xl font-black text-jungle-emerald dark:text-jungle-text-light tracking-tight truncate max-w-[150px] md:max-w-none">{board.name || 'Untitled Board'}</h2>
        </div>
        <button
          onClick={() => setIsAddingLane(true)}
          className="px-3 md:px-5 py-2 md:py-2.5 bg-jungle-paper dark:bg-jungle-sidebar-header-dark/50 border border-jungle-border dark:border-jungle-border-dark hover:border-jungle-emerald dark:hover:border-jungle-emerald-dark hover:bg-jungle-view-header dark:hover:bg-jungle-view-header-dark/30 hover:text-jungle-emerald dark:hover:text-jungle-text-light text-jungle-text-muted dark:text-jungle-text-muted-dark rounded-xl text-sm md:text-base font-bold flex items-center gap-1 md:gap-2 transition-all shadow-sm whitespace-nowrap"
        >
          <Plus size={18} />
          <span className="hidden sm:inline">Add Lane</span>
          <span className="sm:hidden">Add</span>
        </button>
      </div>

      <div className="flex-1 overflow-x-auto overflow-y-hidden p-4 md:p-8 pt-4 md:pt-8 custom-scrollbar">
        <div className="flex gap-6 h-full items-start">
          <DndContext
            sensors={sensors}
            collisionDetection={customCollisionDetection}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={board.lanes.map(l => l.id)} strategy={horizontalListSortingStrategy}>
              {board.lanes.map(lane => (
                <SortableLane
                  key={lane.id}
                  lane={lane}
                  items={lane.items}
                  onItemClick={onItemClick}
                  onAddItem={onAddItem}
                  onRenameLane={onRenameLane}
                  onDeleteLane={onDeleteLane}
                  allLanes={board.lanes}
                />
              ))}
            </SortableContext>

            {isAddingLane && (
              <div className="flex-shrink-0 w-72 bg-jungle-sidebar/50 dark:bg-jungle-sidebar-dark/30 border-2 border-dashed border-jungle-border dark:border-jungle-border-dark rounded-2xl p-4">
                <input
                  autoFocus
                  type="text"
                  value={newLaneName}
                  onChange={(e) => {
                    setNewLaneName(e.target.value);
                    setLaneNameError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      e.stopPropagation();
                      handleAddLane();
                    }
                    if (e.key === " ") e.stopPropagation();
                  }}
                  className={`w-full bg-jungle-paper dark:bg-jungle-paper-dark border ${laneNameError ? 'border-red-500' : 'border-jungle-border dark:border-jungle-border-dark'} rounded-xl p-2.5 text-sm mb-1 focus:ring-2 focus:ring-jungle-emerald outline-none font-medium text-jungle-text dark:text-jungle-text-light placeholder-jungle-text-muted dark:placeholder-jungle-text-muted-dark`}
                  placeholder="Lane name..."
                />
                {laneNameError && (
                  <p className="text-[10px] text-red-500 font-bold mb-3 px-1">{laneNameError}</p>
                )}
                <div className="flex justify-end gap-2">
                  <button onClick={() => setIsAddingLane(false)} className="text-sm font-bold text-jungle-text-muted dark:text-jungle-text-muted-dark hover:text-jungle-text dark:hover:text-jungle-text-light">Cancel</button>
                  <button onClick={handleAddLane} className="text-sm text-jungle-emerald dark:text-jungle-emerald-dark font-black hover:text-emerald-700 dark:hover:text-emerald-300">Create</button>
                </div>
              </div>
            )}

            <DragOverlay dropAnimation={{ 
              duration: 150,
              easing: 'ease-out',
              sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: '0.5' } } }) 
            }}>
              {activeItem ? (
                <div className="bg-jungle-paper dark:bg-jungle-paper-dark p-3 rounded-xl shadow-2xl border-2 border-jungle-emerald w-64 opacity-90 scale-105">
                  <h4 className="text-sm font-bold text-jungle-text dark:text-jungle-text-light">{activeItem.name}</h4>
                </div>
              ) : activeLane ? (
                <div className="bg-jungle-view-header/30 dark:bg-jungle-view-header-dark p-4 rounded-2xl shadow-2xl border-2 border-jungle-emerald w-72 h-48 opacity-80 scale-105">
                  <h3 className="font-black text-jungle-text-muted dark:text-jungle-text-muted-dark text-sm">{activeLane.name}</h3>
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        </div>
      </div>
    </div>
  );
}
