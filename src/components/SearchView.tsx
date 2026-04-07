import React, { useState, useMemo } from "react";
import { Search, Filter } from "lucide-react";
import { Item, Board } from "../types";
import { isPast, parseISO, isToday } from "date-fns";

interface SearchViewProps {
  items: Item[];
  boards: Board[];
  onItemClick: (item: Item) => void;
}

export default function SearchView({ items, boards, onItemClick }: SearchViewProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [searchMode, setSearchMode] = useState<"and" | "or">("and");

  const searchWords = useMemo(() => 
    searchTerm.toLowerCase().trim().split(/\s+/).filter(w => w.length > 0),
    [searchTerm]
  );

  const filteredItems = useMemo(() => {
    if (searchWords.length === 0) return items;

    return items.filter(item => {
      const board = boards.find(b => b.id === item.boardId);
      const lane = board?.lanes.find(l => l.id === item.laneId);
      
      const itemName = (item.name || "").toLowerCase();
      const itemContent = (item.content || "").toLowerCase();
      const itemTags = (item.metadata?.tags || []).map(t => String(t).toLowerCase());
      const itemDueDate = item.metadata?.dueDate ? String(item.metadata.dueDate).toLowerCase() : "";
      const boardName = board ? board.name.toLowerCase() : "";
      const laneName = lane ? lane.name.toLowerCase() : "";

      // Check if ALL search words are present in ANY of the fields (AND mode)
      // Or if ANY search word is present in ANY of the fields (OR mode)
      if (searchMode === "and") {
        return searchWords.every(word => 
          itemName.includes(word) ||
          itemContent.includes(word) ||
          itemTags.some(tag => tag.includes(word)) ||
          itemDueDate.includes(word) ||
          boardName.includes(word) ||
          laneName.includes(word)
        );
      } else {
        return searchWords.some(word => 
          itemName.includes(word) ||
          itemContent.includes(word) ||
          itemTags.some(tag => tag.includes(word)) ||
          itemDueDate.includes(word) ||
          boardName.includes(word) ||
          laneName.includes(word)
        );
      }
    });
  }, [items, searchWords, searchMode, boards]);

  const getBoardName = (boardId: string) => boards.find(b => b.id === boardId)?.name || boardId;

  return (
    <div className="h-full bg-jungle-mist dark:bg-clouded-night flex flex-col font-sans transition-colors duration-300">
      <div className="px-4 md:px-8 border-b border-jungle-border dark:border-jungle-border-dark bg-jungle-view-header dark:bg-jungle-view-header-dark py-4 md:py-0 md:h-[132px] flex flex-col justify-center flex-shrink-0">
        <h2 className="text-xl md:text-3xl font-black text-jungle-emerald dark:text-jungle-text-light flex items-center gap-2 md:gap-3 tracking-tight">
          <Search className="text-jungle-amber dark:text-jungle-amber-dark w-6 h-6 md:w-8 md:h-8" />
          Search
        </h2>
        <p className="text-sm md:text-base text-jungle-text-muted dark:text-jungle-text-muted-dark mt-1 md:mt-2 font-medium">Search across names, tags, and content in all boards.</p>
      </div>

      <div className="p-4 md:p-8 bg-jungle-view-header/30 dark:bg-jungle-paper-dark/50 border-b border-jungle-border dark:border-jungle-border-dark">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-jungle-text-muted dark:text-jungle-text-muted-dark" size={20} />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search items (e.g. 'urgent task')..."
              className="w-full pl-10 pr-4 py-3 bg-jungle-paper dark:bg-jungle-paper-dark border border-jungle-border dark:border-jungle-border-dark rounded-xl focus:ring-2 focus:ring-jungle-emerald outline-none shadow-sm text-jungle-text dark:text-jungle-text-light"
            />
          </div>
          <div className="flex items-center bg-jungle-paper dark:bg-jungle-paper-dark border border-jungle-border dark:border-jungle-border-dark rounded-xl p-1 shadow-sm">
            <button
              onClick={() => setSearchMode("or")}
              className={`px-4 py-2 rounded-lg text-sm font-black transition-all ${searchMode === "or" ? "bg-jungle-emerald dark:bg-jungle-emerald-dark text-white shadow-md" : "text-jungle-text-muted dark:text-jungle-text-muted-dark hover:bg-jungle-view-header dark:hover:bg-jungle-view-header-dark/30"}`}
            >
              OR
            </button>
            <button
              onClick={() => setSearchMode("and")}
              className={`px-4 py-2 rounded-lg text-sm font-black transition-all ${searchMode === "and" ? "bg-jungle-emerald dark:bg-jungle-emerald-dark text-white shadow-md" : "text-jungle-text-muted dark:text-jungle-text-muted-dark hover:bg-jungle-view-header dark:hover:bg-jungle-view-header-dark/30"}`}
            >
              AND
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 md:p-8">
        <div className="max-w-6xl mx-auto">
          <div className="hidden md:grid grid-cols-[2fr_1fr_1.5fr_1fr] gap-4 mb-4 px-4 text-[10px] font-black text-jungle-text-muted dark:text-jungle-text-muted-dark uppercase tracking-widest">
            <div>Name</div>
            <div>Board</div>
            <div>Tags</div>
            <div>Due Date</div>
          </div>

          <div className="space-y-2">
            {filteredItems.length === 0 ? (
              <div className="text-center py-20 bg-jungle-paper dark:bg-jungle-paper-dark rounded-2xl border-2 border-dashed border-jungle-border dark:border-jungle-border-dark shadow-inner">
                <Filter className="mx-auto text-jungle-border dark:text-jungle-border-dark mb-4" size={48} />
                <p className="text-jungle-text-muted dark:text-jungle-text-muted-dark font-bold uppercase tracking-wide">No items match your search.</p>
              </div>
            ) : (
              filteredItems.map(item => (
                <div
                  key={item._dragId || `${item.boardId}-${item.laneId}-${item.id}`}
                  onClick={() => onItemClick(item)}
                  className="flex flex-col md:grid md:grid-cols-[2fr_1fr_1.5fr_1fr] md:items-center gap-2 md:gap-4 p-4 bg-jungle-paper dark:bg-jungle-paper-dark border border-jungle-border dark:border-jungle-border-dark rounded-xl hover:border-jungle-emerald dark:hover:border-jungle-emerald-dark hover:shadow-lg transition-all cursor-pointer group"
                >
                  <div className="flex justify-between items-start md:contents">
                    <div className="text-base md:text-sm text-jungle-text dark:text-jungle-text-light font-bold group-hover:text-jungle-emerald dark:group-hover:text-jungle-emerald-dark transition-colors truncate pr-2">
                      {item.name}
                    </div>
                    <div className="md:hidden text-xs text-jungle-text-muted dark:text-jungle-text-muted-dark font-mono flex items-center flex-shrink-0">
                      {item.metadata.dueDate ? (() => {
                        const dueDate = parseISO(item.metadata.dueDate);
                        const overdue = isPast(dueDate) && !isToday(dueDate);
                        const today = isToday(dueDate);
                        return (
                          <span className={`px-2 py-1 rounded w-fit font-bold ${
                            overdue 
                              ? "bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400" 
                              : today
                              ? "bg-jungle-amber-muted text-jungle-amber dark:bg-jungle-amber-muted-dark dark:text-jungle-amber-dark"
                              : ""
                          }`}>
                            {item.metadata.dueDate.split('T')[0]}
                          </span>
                        );
                      })() : null}
                    </div>
                  </div>
                  <div className="text-xs text-jungle-text-muted dark:text-jungle-text-muted-dark font-medium truncate">
                    {getBoardName(item.boardId)}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {item.metadata.tags?.map(tag => (
                      <span key={tag} className="px-2 py-0.5 bg-jungle-view-header dark:bg-jungle-view-header-dark/30 text-jungle-emerald dark:text-jungle-emerald-dark text-[9px] rounded font-black border border-emerald-100 dark:border-emerald-800">
                        {tag}
                      </span>
                    ))}
                    {(!item.metadata.tags || item.metadata.tags.length === 0) && (
                      <span className="text-[9px] text-jungle-text-muted dark:text-jungle-text-muted-dark italic">No tags</span>
                    )}
                  </div>
                  <div className="hidden md:flex text-xs text-jungle-text-muted dark:text-jungle-text-muted-dark font-mono items-center">
                    {item.metadata.dueDate ? (() => {
                      const dueDate = parseISO(item.metadata.dueDate);
                      const overdue = isPast(dueDate) && !isToday(dueDate);
                      const today = isToday(dueDate);
                      return (
                        <span className={`px-2 py-1 rounded w-fit font-bold ${
                          overdue 
                            ? "bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400" 
                            : today
                            ? "bg-jungle-amber-muted text-jungle-amber dark:bg-jungle-amber-muted-dark dark:text-jungle-amber-dark"
                            : ""
                        }`}>
                          {item.metadata.dueDate.split('T')[0]}
                        </span>
                      );
                    })() : (
                      <span className="px-2 py-1 inline-block">-</span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
