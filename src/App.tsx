import React, { useState, useEffect, useMemo, useRef } from "react";
import { 
  LayoutDashboard, 
  Clock, 
  Search, 
  Plus, 
  Trash2, 
  Palette,
  Sun,
  Moon,
  Monitor,
  Info,
  Github,
  X,
  Menu,
  GripVertical
} from "lucide-react";
import Icon from '@mdi/react';
import { 
  DndContext, 
  closestCenter, 
  KeyboardSensor, 
  PointerSensor, 
  useSensor, 
  useSensors, 
  DragEndEvent 
} from "@dnd-kit/core";
import { 
  arrayMove, 
  SortableContext, 
  sortableKeyboardCoordinates, 
  verticalListSortingStrategy, 
  useSortable 
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { 
  mdiLeaf, 
  mdiPineTree, 
  mdiFormatListCheckbox, 
  mdiBriefcase, 
  mdiBookOpen, 
  mdiEarth, 
  mdiPaw, 
  mdiHandBackLeft,
  mdiWeatherSunny, 
  mdiWater,
  mdiFlowerTulip,
  mdiViewDashboard,
  mdiViewColumn,
  mdiCheckAll,
  mdiClipboardCheck,
  mdiCalendarCheck,
  mdiFormatListBulleted,
  mdiFlag,
  mdiTarget,
  mdiRocketLaunch,
  mdiStar,
  mdiBell,
  mdiLightningBolt,
  mdiChartBar,
  mdiCheckCircle,
  mdiDesktopTower,
  mdiLaptop,
  mdiServer,
  mdiNetworkOutline,
  mdiCodeJson,
  mdiDatabase
} from '@mdi/js';
import { Board, Item, Lane } from "./types";
import { isValidFilename, getInvalidChars } from "./lib/utils";
import BoardView from "./components/BoardView";
import TimelineView from "./components/TimelineView";
import SearchView from "./components/SearchView";
import ItemEditor from "./components/ItemEditor";
import { io } from "socket.io-client";

type ViewMode = "timeline" | "search" | { type: "board"; boardId: string };
type Theme = "light" | "dark" | "system";

const MDI_ICONS = [
  mdiLeaf, mdiPineTree, mdiFormatListCheckbox, mdiBriefcase, 
  mdiBookOpen, mdiEarth, mdiPaw, mdiWeatherSunny, mdiWater, mdiFlowerTulip,
  mdiViewDashboard, mdiViewColumn, mdiCheckAll, mdiClipboardCheck,
  mdiCalendarCheck, mdiFormatListBulleted, mdiFlag, mdiTarget,
  mdiRocketLaunch, mdiStar, mdiBell, mdiLightningBolt, mdiChartBar, mdiCheckCircle,
  mdiDesktopTower, mdiLaptop, mdiServer, mdiNetworkOutline, mdiCodeJson, mdiDatabase
];

const BOARD_COLORS = [
  "#059669", // emerald-600
  "#16a34a", // green-600
  "#65a30d", // lime-600
  "#ca8a04", // yellow-600
  "#ea580c", // orange-600
  "#d97706", // amber-600
  "#78350f", // amber-900 (sloth brown)
  "#44403c", // stone-700
];

export default function App() {
  const [boards, setBoards] = useState<Board[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>("timeline");
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [isAddingBoard, setIsAddingBoard] = useState(false);
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const [editingBoardId, setEditingBoardId] = useState<string | null>(null);
  const [newBoardName, setNewBoardName] = useState("");
  const [newBoardIcon, setNewBoardIcon] = useState(MDI_ICONS[0]);
  const [newBoardColor, setNewBoardColor] = useState(BOARD_COLORS[5]);
  const [loading, setLoading] = useState(true);
  const [nameError, setNameError] = useState<string | null>(null);
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem("theme") as Theme;
    return saved || "system";
  });
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: () => {},
  });
  const [toast, setToast] = useState<{
    message: string;
    type: "error" | "success";
  } | null>(null);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const isInitialMount = useRef(true);
  useEffect(() => {
    fetch("/api/view-mode")
      .then(res => res.json())
      .then(data => {
        if (data.viewMode) {
          setViewMode(data.viewMode);
        }
      })
      .catch(err => console.error("Failed to fetch view mode:", err));
  }, []);

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    fetch("/api/view-mode", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ viewMode })
    }).catch(err => console.error("Failed to save view mode:", err));
  }, [viewMode]);

  const editingItemRef = useRef<Item | null>(null);
  useEffect(() => {
    editingItemRef.current = editingItem;
  }, [editingItem]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    const root = window.document.documentElement;
    
    const updateTheme = () => {
      let actualTheme = theme;
      if (theme === "system") {
        actualTheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
      }
      
      console.log(`Applying theme: ${actualTheme} (selected: ${theme})`);
      
      if (actualTheme === "dark") {
        root.classList.add("dark");
      } else {
        root.classList.remove("dark");
      }
    };

    updateTheme();
    localStorage.setItem("theme", theme);

    if (theme === "system") {
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
      const listener = () => updateTheme();
      mediaQuery.addEventListener("change", listener);
      return () => mediaQuery.removeEventListener("change", listener);
    }
  }, [theme]);

  const fetchData = async () => {
    try {
      const res = await fetch("/api/data");
      if (!res.ok) {
        throw new Error("Failed to fetch data");
      }
      const data = await res.json();
      const boardsWithDragIds = (data.boards || [])
        .filter((b: Board) => !!b)
        .map((b: Board) => ({
          ...b,
          lanes: (b.lanes || []).map((l: Lane) => ({
            ...l,
            items: (l.items || []).map((i: Item) => ({
              ...i,
              _dragId: i._dragId || `${i.boardId}:${i.laneId}:${i.id}:${Math.random().toString(36).substr(2, 9)}`
            }))
          }))
        }));
      setBoards(boardsWithDragIds);
    } catch (error) {
      console.error("Failed to fetch data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    const socket = io();
    socket.on("fs-change", (data: { event: string, path: string }) => {
      console.log("File system change detected:", data);
      fetchData();
      
      // If the currently editing item was changed on disk, refresh it
      const currentEditing = editingItemRef.current;
      if (currentEditing && data.path.includes(currentEditing.boardId) && data.path.endsWith(`${currentEditing.id}.md`)) {
        if (data.event === 'unlink') {
          setEditingItem(null);
        } else {
          handleItemClick(currentEditing);
        }
      }
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const allItems = useMemo(() => {
    const items: Item[] = [];
    boards.forEach(board => {
      board.lanes.forEach(lane => {
        items.push(...lane.items);
      });
    });
    return items;
  }, [boards]);

  const allTags = useMemo(() => {
    const tags = new Set<string>();
    allItems.forEach(item => {
      item.metadata.tags?.forEach(tag => tags.add(tag));
    });
    return Array.from(tags).sort();
  }, [allItems]);

  const handleItemClick = async (item: Item) => {
    try {
      const res = await fetch(`/api/boards/${item.boardId}/lanes/${item.laneId}/items/${item.id}`);
      if (res.ok) {
        const latestItem = await res.json();
        setEditingItem(latestItem);
      } else {
        setEditingItem(item);
      }
    } catch (error) {
      console.error("Failed to fetch latest item data:", error);
      setEditingItem(item);
    }
  };

  const handleCreateBoard = async () => {
    const trimmedName = newBoardName.trim();
    if (!trimmedName) return;

    if (!isValidFilename(trimmedName)) {
      const invalid = getInvalidChars(trimmedName);
      setNameError(`Invalid characters: ${invalid.join(" ")}`);
      return;
    }

    // Check for duplicate board names
    if (boards.some(b => b.id !== editingBoardId && b.name.toLowerCase() === trimmedName.toLowerCase())) {
      setNameError("A board with this name already exists.");
      return;
    }
    
    try {
      if (editingBoardId) {
        const res = await fetch(`/api/boards/${editingBoardId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: trimmedName,
            icon: newBoardIcon,
            color: newBoardColor
          })
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Failed to update board");
        }
        const updatedBoard = await res.json();
        fetchData(); // Refresh to ensure sync with file system
        
        // Update viewMode if the current board was renamed
        if (typeof viewMode === 'object' && viewMode.type === 'board' && viewMode.boardId === editingBoardId) {
          setViewMode({ type: 'board', boardId: updatedBoard.id });
        }
      } else {
        const res = await fetch("/api/boards", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: trimmedName,
            icon: newBoardIcon,
            color: newBoardColor
          })
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Failed to create board");
        }
        const newBoard = await res.json();
        fetchData(); // Refresh to ensure sync with file system
        setViewMode({ type: "board", boardId: newBoard.id });
      }
      setNewBoardName("");
      setIsAddingBoard(false);
      setEditingBoardId(null);
      setToast({ message: "Board saved successfully", type: "success" });
    } catch (error) {
      console.error("Failed to save board:", error);
      setToast({ message: error instanceof Error ? error.message : "Failed to save board", type: "error" });
    }
  };

  const handleEditBoard = (board: Board, e: React.MouseEvent) => {
    e.stopPropagation();
    setNewBoardName(board.name);
    setNewBoardIcon(board.icon);
    setNewBoardColor(board.color);
    setEditingBoardId(board.id);
    setIsAddingBoard(true);
  };

  const handleDeleteBoard = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirmDialog({
      isOpen: true,
      title: "Delete Board",
      message: "Are you sure you want to delete this board and all its contents? This action cannot be undone.",
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/boards/${id}`, { method: "DELETE" });
          if (!res.ok) {
            const data = await res.json();
            throw new Error(data.error || "Failed to delete board");
          }
          fetchData(); // Refresh to ensure sync with file system
          if (typeof viewMode === 'object' && viewMode.boardId === id) {
            setViewMode("timeline");
          }
          setConfirmDialog(prev => ({ ...prev, isOpen: false }));
          setToast({ message: "Board deleted successfully", type: "success" });
        } catch (error) {
          console.error("Failed to delete board:", error);
          setToast({ message: error instanceof Error ? error.message : "Failed to delete board", type: "error" });
        }
      }
    });
  };

  const handleAddLane = async (boardId: string, name: string) => {
    try {
      const res = await fetch(`/api/boards/${boardId}/lanes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name })
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to add lane");
      }
      const newLane = await res.json();
      fetchData(); // Refresh to ensure sync with file system
      setToast({ message: "Lane added successfully", type: "success" });
    } catch (error) {
      console.error("Failed to add lane:", error);
      setToast({ message: error instanceof Error ? error.message : "Failed to add lane", type: "error" });
    }
  };

  const handleAddItem = async (boardId: string, laneId: string, name: string) => {
    try {
      const res = await fetch(`/api/boards/${boardId}/lanes/${laneId}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, metadata: { tags: [], dueDate: null }, content: "" })
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to add item");
      }
      const newItem = await res.json();
      const newItemWithDragId = {
        ...newItem,
        _dragId: `${boardId}:${laneId}:${newItem.id}:${Math.random().toString(36).substr(2, 9)}`
      };
      fetchData(); // Refresh to ensure sync with file system
      setToast({ message: "Item added successfully", type: "success" });
    } catch (error) {
      console.error("Failed to add item:", error);
      setToast({ message: error instanceof Error ? error.message : "Failed to add item", type: "error" });
    }
  };

  const handleUpdateItem = async (updatedItem: Partial<Item> & { newName?: string }) => {
    if (!editingItem) return;

    // Check for duplicate names if renaming
    if (updatedItem.newName && updatedItem.newName.trim().toLowerCase() !== editingItem.id.toLowerCase()) {
      const trimmedNewName = updatedItem.newName.trim();
      const currentBoard = boards.find(b => b.id === editingItem.boardId);
      const currentLane = currentBoard?.lanes.find(l => l.id === editingItem.laneId);
      if (currentLane?.items.some(i => i.id.toLowerCase() === trimmedNewName.toLowerCase())) {
        setToast({ message: "An item with this name already exists in this lane.", type: "error" });
        return;
      }
    }

    try {
      const res = await fetch("/api/items", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          boardId: editingItem.boardId,
          laneId: editingItem.laneId,
          id: editingItem.id,
          ...updatedItem
        })
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update item");
      }
      const savedItem = await res.json();
      const savedItemWithDragId = {
        ...savedItem,
        _dragId: editingItem._dragId || `${editingItem.boardId}:${editingItem.laneId}:${savedItem.id}:${Math.random().toString(36).substr(2, 9)}`
      };
      fetchData(); // Refresh to ensure sync with file system
      setEditingItem(savedItemWithDragId);
      setToast({ message: "Item updated successfully", type: "success" });
    } catch (error) {
      console.error("Failed to update item:", error);
      setToast({ message: error instanceof Error ? error.message : "Failed to update item", type: "error" });
      throw error;
    }
  };

  const handleMoveItemLocal = (itemId: string, sourceLaneId: string, targetLaneId: string, targetIndex: number) => {
    setBoards(prevBoards => {
      const board = prevBoards.find(b => b.lanes.some(l => l.id === sourceLaneId));
      if (!board) return prevBoards;
      
      const sourceLane = board.lanes.find(l => l.id === sourceLaneId);
      const item = sourceLane?.items.find(i => i.id === itemId);
      if (!item || !sourceLane) return prevBoards;

      return prevBoards.map(b => {
        if (b.id !== board.id) return b;
        
        const targetLane = b.lanes.find(l => l.id === targetLaneId);
        if (!targetLane) return b;

        if (sourceLaneId === targetLaneId) {
          const newItems = [...sourceLane.items];
          const existingIdx = newItems.findIndex(i => i.id === itemId);
          if (existingIdx !== -1) newItems.splice(existingIdx, 1);
          newItems.splice(targetIndex, 0, { ...item, laneId: targetLaneId, _dragId: item._dragId });
          
          return {
            ...b,
            lanes: b.lanes.map(l => l.id === sourceLaneId ? { ...l, items: newItems } : l)
          };
        }

        const newSourceItems = sourceLane.items.filter(i => i.id !== itemId);
        const newTargetItems = [...targetLane.items];
        
        const existingIdx = newTargetItems.findIndex(i => i.id === itemId);
        if (existingIdx !== -1) newTargetItems.splice(existingIdx, 1);
        
        newTargetItems.splice(targetIndex, 0, { ...item, laneId: targetLaneId, _dragId: item._dragId });

        return {
          ...b,
          lanes: b.lanes.map(l => {
            if (l.id === sourceLaneId) return { ...l, items: newSourceItems };
            if (l.id === targetLaneId) return { ...l, items: newTargetItems };
            return l;
          })
        };
      });
    });
  };

  const handleMoveItem = async (itemId: string, sourceBoardId: string, sourceLaneId: string, targetLaneId: string, targetIndex: number, targetBoardId?: string) => {
    const finalTargetBoardId = targetBoardId || sourceBoardId;
    console.log(`handleMoveItem called: item=${itemId}, sourceLane=${sourceLaneId}, targetLane=${targetLaneId}`);

    // Check for duplicate names if moving to a different lane
    if (sourceLaneId !== targetLaneId || sourceBoardId !== finalTargetBoardId) {
      const targetBoard = boards.find(b => b.id === finalTargetBoardId);
      const targetLane = targetBoard?.lanes.find(l => l.id === targetLaneId);
      if (targetLane?.items.some(i => i.id.toLowerCase() === itemId.toLowerCase())) {
        setToast({ message: "An item with this name already exists in the target lane.", type: "error" });
        return;
      }
    }

    if (sourceBoardId === finalTargetBoardId && sourceLaneId === targetLaneId) {
      handleMoveItemLocal(itemId, sourceLaneId, targetLaneId, targetIndex);
    }

    try {
      console.log(`Sending /api/items/move request...`);
      const res = await fetch("/api/items/move", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          boardId: sourceBoardId,
          laneId: sourceLaneId,
          id: itemId,
          targetBoardId: finalTargetBoardId,
          targetLaneId: targetLaneId,
          targetIndex
        })
      });
      if (!res.ok) {
        const data = await res.json();
        console.error(`Move failed:`, data.error);
        throw new Error(data.error || "Failed to move item");
      }
      console.log(`Move successful, refreshing data...`);
      fetchData(); // Refresh all data to reflect move in background
      setEditingItem(null);
      setToast({ message: "Item moved successfully", type: "success" });
    } catch (error) {
      console.error("Failed to move item:", error);
      setToast({ message: error instanceof Error ? error.message : "Failed to move item", type: "error" });
      fetchData(); // Revert on error
    }
  };

  const handleReorderLanes = async (boardId: string, laneIds: string[]) => {
    // Optimistic update
    setBoards(boards.map(b => b.id === boardId ? {
      ...b,
      lanes: laneIds.map(id => b.lanes.find(l => l.id === id)!)
    } : b));

    try {
      const res = await fetch(`/api/boards/${boardId}/lanes/reorder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ laneIds })
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to reorder lanes");
      }
      fetchData(); // Refresh to ensure sync with file system
      setToast({ message: "Lanes reordered", type: "success" });
    } catch (error) {
      console.error("Failed to reorder lanes:", error);
      setToast({ message: error instanceof Error ? error.message : "Failed to reorder lanes", type: "error" });
      fetchData(); // Revert on error
    }
  };

  const handleRenameLane = async (boardId: string, laneId: string, newName: string) => {
    try {
      const res = await fetch(`/api/boards/${boardId}/lanes/${laneId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName })
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to rename lane");
      }
      const updatedLane = await res.json();
      fetchData(); // Refresh to ensure sync with file system
      setToast({ message: "Lane renamed successfully", type: "success" });
    } catch (error) {
      console.error("Failed to rename lane:", error);
      setToast({ message: error instanceof Error ? error.message : "Failed to rename lane", type: "error" });
    }
  };

  const handleDeleteLane = async (boardId: string, laneId: string) => {
    setConfirmDialog({
      isOpen: true,
      title: "Delete Lane",
      message: "Are you sure you want to delete this lane and all its tasks? This action cannot be undone.",
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/boards/${boardId}/lanes/${laneId}`, { method: "DELETE" });
          if (!res.ok) {
            const data = await res.json();
            throw new Error(data.error || "Failed to delete lane");
          }
          fetchData(); // Refresh to ensure sync with file system
          setConfirmDialog(prev => ({ ...prev, isOpen: false }));
          setToast({ message: "Lane deleted successfully", type: "success" });
        } catch (error) {
          console.error("Failed to delete lane:", error);
          setToast({ message: error instanceof Error ? error.message : "Failed to delete lane", type: "error" });
        }
      }
    });
  };

  const handleReorderItems = async (boardId: string, laneId: string, itemIds: string[]) => {
    // Optimistic update
    setBoards(boards.map(b => b.id === boardId ? {
      ...b,
      lanes: b.lanes.map(l => l.id === laneId ? { ...l, items: itemIds.map(id => l.items.find(i => i.id === id)!) } : l)
    } : b));

    try {
      const res = await fetch(`/api/boards/${boardId}/lanes/${laneId}/reorder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemIds })
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to reorder items");
      }
      fetchData(); // Refresh to ensure sync with file system
      setToast({ message: "Items reordered", type: "success" });
    } catch (error) {
      console.error("Failed to reorder items:", error);
      setToast({ message: error instanceof Error ? error.message : "Failed to reorder items", type: "error" });
      fetchData(); // Revert on error
    }
  };

  const handleDeleteItem = async (item: Item) => {
    setConfirmDialog({
      isOpen: true,
      title: "Delete Item",
      message: `Are you sure you want to delete "${item.name}"? This will permanently remove the .md file from storage.`,
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/boards/${item.boardId}/lanes/${item.laneId}/items/${item.id}`, { method: "DELETE" });
          if (!res.ok) {
            const data = await res.json();
            throw new Error(data.error || "Failed to delete item");
          }
          fetchData(); // Refresh to ensure sync with file system
          setEditingItem(null);
          setConfirmDialog(prev => ({ ...prev, isOpen: false }));
          setToast({ message: "Item deleted successfully", type: "success" });
        } catch (error) {
          console.error("Failed to delete item:", error);
          setToast({ message: error instanceof Error ? error.message : "Failed to delete item", type: "error" });
        }
      }
    });
  };

  const handleReorderBoards = async (boardIds: string[]) => {
    // Optimistic update
    const reorderedBoards = boardIds
      .map(id => boards.find(b => b.id === id))
      .filter((b): b is Board => !!b);
    
    setBoards(reorderedBoards);
    setToast({ message: "Boards reordered", type: "success" });

    try {
      const res = await fetch("/api/boards/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ boardIds })
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to reorder boards");
      }
      fetchData(); // Refresh to ensure sync with file system
    } catch (error) {
      console.error("Failed to reorder boards:", error);
      setToast({ message: error instanceof Error ? error.message : "Failed to reorder boards", type: "error" });
      fetchData(); // Revert on error
    }
  };

  const handleBoardDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = boards.findIndex((b) => b.id === active.id);
      const newIndex = boards.findIndex((b) => b.id === over.id);
      const newBoardIds = arrayMove(boards, oldIndex, newIndex).map(b => b.id);
      handleReorderBoards(newBoardIds);
    }
  };

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-jungle-mist dark:bg-clouded-night">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-jungle-emerald dark:border-jungle-emerald-dark"></div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex bg-jungle-mist dark:bg-clouded-night overflow-hidden font-sans text-jungle-text dark:text-jungle-text-light transition-colors duration-300">
      {/* Mobile Sidebar Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar - Jungle Theme */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-72 bg-jungle-sidebar dark:bg-jungle-sidebar-dark text-jungle-text dark:text-jungle-text-light border-r border-jungle-border dark:border-jungle-border-dark flex flex-col shadow-xl transition-transform duration-300 ease-in-out md:relative md:translate-x-0 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="px-6 border-b border-jungle-border dark:border-jungle-border-dark flex items-center justify-between gap-4 h-[132px] flex-shrink-0 bg-jungle-sidebar-header dark:bg-jungle-sidebar-header-dark">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-jungle-amber dark:bg-jungle-amber-dark rounded-2xl flex items-center justify-center overflow-hidden shadow-lg shadow-jungle-amber/20 ring-4 ring-jungle-amber dark:ring-jungle-amber-dark flex-shrink-0">
              <img 
                src="/logo.png" 
                alt="Sloth Logo" 
                className="w-12 h-12 object-contain"
                referrerPolicy="no-referrer"
              />
            </div>
            <h1 className="text-2xl font-black tracking-tight text-jungle-text dark:text-jungle-text-light leading-tight">
              Industrious<br />Sloth
            </h1>
          </div>
          <button 
            className="md:hidden p-2 text-jungle-text-muted dark:text-jungle-text-muted-dark hover:bg-jungle-sidebar-active dark:hover:bg-jungle-sidebar-active-dark rounded-lg"
            onClick={() => setIsMobileMenuOpen(false)}
          >
            <X size={24} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto p-4 space-y-8 custom-scrollbar">
          {/* Main Views */}
          <div className="space-y-1">
            <button
              onClick={() => {
                setViewMode("timeline");
                setIsMobileMenuOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${viewMode === "timeline" ? "bg-jungle-sidebar-active dark:bg-jungle-sidebar-active-dark text-jungle-text dark:text-jungle-text-light font-bold shadow-sm" : "text-jungle-text-muted dark:text-jungle-text-muted-dark hover:bg-jungle-sidebar-active/50 dark:hover:bg-jungle-sidebar-active-dark/50"}`}
            >
              <Clock size={20} />
              Timeline
            </button>
            <button
              onClick={() => {
                setViewMode("search");
                setIsMobileMenuOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${viewMode === "search" ? "bg-jungle-sidebar-active dark:bg-jungle-sidebar-active-dark text-jungle-text dark:text-jungle-text-light font-bold shadow-sm" : "text-jungle-text-muted dark:text-jungle-text-muted-dark hover:bg-jungle-sidebar-active/50 dark:hover:bg-jungle-sidebar-active-dark/50"}`}
            >
              <Search size={20} />
              Search
            </button>
          </div>

          {/* Boards List */}
          <div>
            <div className="px-4 mb-4 flex items-center justify-between">
              <h2 className="text-xs font-black text-jungle-text-muted dark:text-jungle-text-muted-dark uppercase tracking-widest">Boards</h2>
              <button
                onClick={() => {
                  setEditingBoardId(null);
                  setNewBoardName("");
                  setNewBoardIcon(MDI_ICONS[0]);
                  setNewBoardColor(BOARD_COLORS[5]);
                  setIsAddingBoard(true);
                }}
                className="p-1 hover:bg-jungle-sidebar-active dark:hover:bg-jungle-sidebar-active-dark rounded-lg text-jungle-text-muted dark:text-jungle-text-muted-dark hover:text-jungle-text dark:hover:text-jungle-text-light transition-colors"
              >
                <Plus size={16} />
              </button>
            </div>

            <div className="space-y-1">
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleBoardDragEnd}
              >
                <SortableContext
                  items={boards.map(b => b.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {boards.map(board => (
                    <SortableBoardItem
                      key={board.id}
                      board={board}
                      viewMode={viewMode}
                      onSelect={(id) => {
                        setViewMode({ type: "board", boardId: id });
                        setIsMobileMenuOpen(false);
                      }}
                      onEdit={handleEditBoard}
                      onDelete={handleDeleteBoard}
                    />
                  ))}
                </SortableContext>
              </DndContext>

              {isAddingBoard && (
                <div className="px-4 py-3 bg-jungle-sidebar-active/50 dark:bg-jungle-sidebar-active-dark/50 rounded-xl border border-jungle-border dark:border-jungle-border-dark">
                  <input
                    autoFocus
                    type="text"
                    value={newBoardName}
                    onChange={(e) => {
                      setNewBoardName(e.target.value);
                      setNameError(null);
                    }}
                    className={`w-full bg-jungle-paper dark:bg-jungle-paper-dark border ${nameError ? 'border-red-500' : 'border-jungle-border dark:border-jungle-border-dark'} rounded-lg p-2 text-sm mb-1 text-jungle-text dark:text-jungle-text-light placeholder-jungle-text-muted outline-none focus:ring-2 focus:ring-jungle-emerald`}
                    placeholder="Board name..."
                  />
                  {nameError && (
                    <p className="text-[10px] text-red-400 font-bold mb-2 px-1">{nameError}</p>
                  )}
                  
                  <div className="mb-3">
                    <label className="text-[10px] font-bold text-jungle-text-muted dark:text-jungle-text-muted-dark uppercase tracking-wider mb-1 block">Icon</label>
                    <div className="flex flex-wrap gap-1">
                      {MDI_ICONS.map((iconPath, i) => (
                        <button
                          key={i}
                          onClick={() => setNewBoardIcon(iconPath)}
                          className={`p-1.5 rounded-md transition-colors ${newBoardIcon === iconPath ? 'bg-jungle-amber/20 text-jungle-amber dark:text-jungle-amber-dark' : 'text-jungle-text-muted dark:text-jungle-text-muted-dark hover:bg-jungle-sidebar-active dark:hover:bg-jungle-sidebar-active-dark'}`}
                        >
                          <Icon path={iconPath} size={0.7} />
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="mb-3">
                    <label className="text-[10px] font-bold text-jungle-text-muted dark:text-jungle-text-muted-dark uppercase tracking-wider mb-1 block">Color</label>
                    <div className="flex flex-wrap gap-1">
                      {BOARD_COLORS.map(color => (
                        <button
                          key={color}
                          onClick={() => setNewBoardColor(color)}
                          className={`w-5 h-5 rounded-full border-2 transition-all ${newBoardColor === color ? 'border-white scale-110' : 'border-transparent hover:scale-110'}`}
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 mt-2">
                    <button onClick={() => {
                      setIsAddingBoard(false);
                      setEditingBoardId(null);
                      setNewBoardName("");
                    }} className="text-xs text-jungle-text-muted dark:text-jungle-text-muted-dark font-medium hover:text-jungle-text dark:hover:text-jungle-text-light">Cancel</button>
                    <button onClick={handleCreateBoard} className="text-xs bg-jungle-emerald dark:bg-jungle-emerald-dark hover:opacity-90 text-white px-3 py-1 rounded-md font-bold transition-colors">
                      {editingBoardId ? "Save" : "Create"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </nav>

        {/* Theme Switcher & About */}
        <div className="p-4 border-t border-jungle-border dark:border-jungle-border-dark bg-jungle-sidebar dark:bg-jungle-sidebar-dark flex gap-2">
          <div className="flex-1 flex items-center bg-jungle-sidebar-active/50 dark:bg-jungle-sidebar-active-dark/50 rounded-xl p-1">
            <button
              onClick={() => setTheme("system")}
              className={`flex-1 flex items-center justify-center py-2 rounded-lg transition-all ${theme === "system" ? "bg-jungle-amber dark:bg-jungle-amber-dark text-white shadow-md" : "text-jungle-text-muted dark:text-jungle-text-muted-dark hover:bg-jungle-sidebar-active dark:hover:bg-jungle-sidebar-active-dark"}`}
              title="System Theme"
            >
              <Monitor size={16} />
            </button>
            <button
              onClick={() => setTheme("light")}
              className={`flex-1 flex items-center justify-center py-2 rounded-lg transition-all ${theme === "light" ? "bg-jungle-amber dark:bg-jungle-amber-dark text-white shadow-md" : "text-jungle-text-muted dark:text-jungle-text-muted-dark hover:bg-jungle-sidebar-active dark:hover:bg-jungle-sidebar-active-dark"}`}
              title="Light Mode"
            >
              <Sun size={16} />
            </button>
            <button
              onClick={() => setTheme("dark")}
              className={`flex-1 flex items-center justify-center py-2 rounded-lg transition-all ${theme === "dark" ? "bg-jungle-amber dark:bg-jungle-amber-dark text-white shadow-md" : "text-jungle-text-muted dark:text-jungle-text-muted-dark hover:bg-jungle-sidebar-active dark:hover:bg-jungle-sidebar-active-dark"}`}
              title="Dark Mode"
            >
              <Moon size={16} />
            </button>
          </div>
          <div className="flex items-center bg-jungle-sidebar-active/50 dark:bg-jungle-sidebar-active-dark/50 rounded-xl p-1">
            <button
              onClick={() => setIsAboutOpen(true)}
              className="w-10 flex items-center justify-center py-2 rounded-lg transition-all text-jungle-text-muted dark:text-jungle-text-muted-dark hover:bg-jungle-sidebar-active dark:hover:bg-jungle-sidebar-active-dark"
              title="About"
            >
              <Info size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden relative bg-jungle-mist dark:bg-clouded-night transition-colors duration-300">
        {/* Mobile Header */}
        <div className="md:hidden flex items-center p-4 border-b border-jungle-border dark:border-jungle-border-dark bg-jungle-sidebar-header dark:bg-jungle-sidebar-header-dark">
          <button 
            className="p-2 mr-4 text-jungle-text dark:text-jungle-text-light hover:bg-jungle-sidebar-active dark:hover:bg-jungle-sidebar-active-dark rounded-lg"
            onClick={() => setIsMobileMenuOpen(true)}
          >
            <Menu size={24} />
          </button>
          <h2 className="text-xl font-black text-jungle-text dark:text-jungle-text-light truncate">
            {typeof viewMode === 'object' ? boards.find(b => b.id === viewMode.boardId)?.name : viewMode.charAt(0).toUpperCase() + viewMode.slice(1)}
          </h2>
        </div>

        <div className="flex-1 overflow-hidden relative">
          {viewMode === "timeline" && (
            <TimelineView items={allItems} boards={boards} onItemClick={handleItemClick} />
          )}
          {viewMode === "search" && (
            <SearchView items={allItems} boards={boards} onItemClick={handleItemClick} />
          )}
          {typeof viewMode === 'object' && viewMode.type === "board" && (
            (() => {
              const currentBoard = boards.find(b => b.id === viewMode.boardId);
              if (!currentBoard) return (
                <div className="h-full flex items-center justify-center text-jungle-text-muted dark:text-jungle-text-muted-dark">
                  Board not found
                </div>
              );
              return (
                <BoardView
                  board={currentBoard}
                  onItemClick={handleItemClick}
                  onAddLane={(name) => handleAddLane(viewMode.boardId, name)}
                  onAddItem={(laneId, name) => handleAddItem(viewMode.boardId, laneId, name)}
                  onReorderLanes={(laneIds) => handleReorderLanes(viewMode.boardId, laneIds)}
                  onReorderItems={(laneId, itemIds) => handleReorderItems(viewMode.boardId, laneId, itemIds)}
                  onMoveItemLocal={(itemId, src, target, idx) => handleMoveItemLocal(itemId, src, target, idx)}
                  onMoveItem={(itemId, src, target, idx) => handleMoveItem(itemId, viewMode.boardId, src, target, idx)}
                  onRenameLane={(laneId, name) => handleRenameLane(viewMode.boardId, laneId, name)}
                  onDeleteLane={(laneId) => handleDeleteLane(viewMode.boardId, laneId)}
                />
              );
            })()
          )}
        </div>

        {/* Item Editor Modal */}
        {editingItem && (
          <ItemEditor
            item={editingItem}
            boards={boards}
            allTags={allTags}
            onClose={() => setEditingItem(null)}
            onSave={handleUpdateItem}
            onDelete={() => handleDeleteItem(editingItem)}
            onMove={(itemId, targetBoardId, targetLaneId) => {
              handleMoveItem(itemId, editingItem.boardId, editingItem.laneId, targetLaneId, 0, targetBoardId);
            }}
          />
        )}
        {/* About Modal */}
        {isAboutOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-jungle-mist dark:bg-clouded-night w-full max-w-md rounded-3xl shadow-2xl overflow-hidden border border-jungle-border dark:border-jungle-border-dark animate-in zoom-in-95 duration-200">
              <div className="p-6 border-b border-jungle-border dark:border-jungle-border-dark flex items-center justify-between bg-jungle-paper dark:bg-jungle-paper-dark">
                <h2 className="text-xl font-black text-jungle-text dark:text-jungle-text-light flex items-center gap-2">
                  <Info className="text-jungle-amber dark:text-jungle-amber-dark" size={24} />
                  About Industrious Sloth
                </h2>
                <button 
                  onClick={() => setIsAboutOpen(false)}
                  className="p-2 hover:bg-jungle-sidebar dark:hover:bg-jungle-sidebar-dark rounded-full text-jungle-text-muted dark:text-jungle-text-muted-dark transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
              
              <div className="p-8 space-y-6">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-jungle-amber dark:bg-jungle-amber-dark rounded-2xl flex items-center justify-center shadow-lg shadow-jungle-amber/20">
                    <img src="/logo.png" alt="Sloth Logo" className="w-12 h-12 object-contain" referrerPolicy="no-referrer" />
                  </div>
                  <div>
                    <p className="text-lg font-bold text-jungle-text dark:text-jungle-text-light">Version 0.1</p>
                    <p className="text-jungle-text-muted dark:text-jungle-text-muted-dark text-sm font-medium">A jungle-themed productivity tool.</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center gap-3 text-jungle-text dark:text-jungle-text-light">
                    <Github size={18} className="text-jungle-text-muted dark:text-jungle-text-muted-dark" />
                    <span className="font-bold">Github:</span>
                    <span className="text-jungle-text-muted italic">(link placeholder)</span>
                  </div>
                  
                  <div className="p-4 bg-jungle-paper dark:bg-jungle-paper-dark rounded-2xl border border-jungle-border dark:border-jungle-border-dark">
                    <a 
                      href="https://www.flaticon.com/free-icons/sloth" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-jungle-text dark:text-jungle-text-light hover:underline font-bold text-sm block"
                    >
                      Sloth icon created by Freepik
                    </a>
                  </div>
                </div>

                <div className="pt-6 border-t border-jungle-border dark:border-jungle-border-dark text-center">
                  <p className="text-xs font-black uppercase tracking-widest text-jungle-text-muted dark:text-jungle-text-muted-dark">
                    Created with Google AI Studio
                  </p>
                </div>
              </div>
              
              <div className="p-4 bg-jungle-sidebar dark:bg-jungle-sidebar-dark flex justify-end">
                <button 
                  onClick={() => setIsAboutOpen(false)}
                  className="px-6 py-2 bg-jungle-amber dark:bg-jungle-amber-dark hover:opacity-90 text-white font-bold rounded-xl shadow-lg shadow-jungle-amber/20 transition-all"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Confirmation Dialog */}
        {confirmDialog.isOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-jungle-mist dark:bg-clouded-night w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden border border-jungle-border dark:border-jungle-border-dark animate-in zoom-in-95 duration-200">
              <div className="p-6">
                <h3 className="text-xl font-black text-jungle-text dark:text-jungle-text-light mb-2">
                  {confirmDialog.title}
                </h3>
                <p className="text-jungle-text-muted dark:text-jungle-text-muted-dark mb-8 leading-relaxed">
                  {confirmDialog.message}
                </p>
                <div className="flex justify-end gap-3">
                  <button 
                    onClick={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
                    className="px-5 py-2.5 text-sm font-bold text-jungle-text-muted dark:text-jungle-text-muted-dark hover:bg-jungle-sidebar dark:hover:bg-jungle-sidebar-dark rounded-xl transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={confirmDialog.onConfirm}
                    className="px-5 py-2.5 bg-red-500 hover:bg-red-600 text-white text-sm font-black rounded-xl shadow-lg shadow-red-500/20 transition-all"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Toast Notification */}
        {toast && (
          <div className={`fixed bottom-8 left-1/2 -translate-x-1/2 z-[110] px-6 py-3 rounded-2xl shadow-2xl animate-in slide-in-from-bottom-4 duration-300 flex items-center gap-3 border ${
            toast.type === 'success' 
              ? "bg-jungle-emerald text-white border-jungle-emerald-dark" 
              : "bg-red-500 text-white border-red-600"
          }`}>
            <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
            <span className="text-sm font-black tracking-tight">{toast.message}</span>
          </div>
        )}
      </main>
    </div>
  );
}

function SortableBoardItem({ 
  board, 
  viewMode, 
  onSelect, 
  onEdit, 
  onDelete 
}: { 
  board: Board; 
  viewMode: ViewMode; 
  onSelect: (id: string) => void;
  onEdit: (board: Board, e: React.MouseEvent) => void;
  onDelete: (id: string, e: React.MouseEvent) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: board?.id || 'unknown' });

  if (!board) return null;

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`w-full group flex items-center justify-between px-4 py-3 rounded-xl transition-all cursor-pointer outline-none focus:ring-2 focus:ring-jungle-emerald/50 ${typeof viewMode === 'object' && viewMode.boardId === board.id ? "bg-jungle-sidebar-active dark:bg-jungle-sidebar-active-dark text-jungle-text dark:text-jungle-text-light font-bold shadow-sm" : "text-jungle-text-muted dark:text-jungle-text-muted-dark hover:bg-jungle-sidebar-active/50 dark:hover:bg-jungle-sidebar-active-dark/50"}`}
    >
      <div 
        className="flex items-center gap-3 flex-1 min-w-0"
        onClick={() => onSelect(board.id)}
        {...attributes}
        {...listeners}
      >
        <div className="text-jungle-text-muted dark:text-jungle-text-muted-dark opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing">
          <GripVertical size={14} />
        </div>
        <span className="text-lg flex items-center justify-center flex-shrink-0" style={{ color: board.color || 'currentColor' }}>
          {board.icon && board.icon.startsWith('M') ? <Icon path={board.icon} size={0.8} /> : (board.icon || <LayoutDashboard size={16} />)}
        </span>
        <span className="truncate max-w-[120px]">{board.name || 'Untitled Board'}</span>
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onEdit(board, e);
          }}
          className="p-1 hover:bg-jungle-sidebar-active dark:hover:bg-jungle-sidebar-active-dark text-jungle-text-muted dark:text-jungle-text-muted-dark hover:text-jungle-text dark:hover:text-jungle-text-light rounded transition-all"
        >
          <Palette size={14} />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(board.id, e);
          }}
          className="p-1 hover:bg-red-900/50 hover:text-red-400 rounded transition-all"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}
