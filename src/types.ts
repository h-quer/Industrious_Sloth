export interface ItemMetadata {
  tags?: string[];
  dueDate?: string; // ISO 8601
  [key: string]: any;
}

export interface Item {
  id: string;
  name: string;
  metadata: ItemMetadata;
  content: string;
  laneId: string;
  boardId: string;
  _dragId?: string; // Stable unique ID for drag-and-drop
}

export interface Lane {
  id: string;
  name: string;
  items: Item[];
}

export interface Board {
  id: string;
  name: string;
  icon: string;
  color: string;
  lanes: Lane[];
}

export interface RootConfig {
  boards: {
    id: string;
    name: string;
    icon: string;
    color: string;
  }[];
}
