import React from "react";
import { format, isPast, parseISO, isToday } from "date-fns";
import { Board, Item } from "../types";
import { Calendar, Clock } from "lucide-react";

interface TimelineViewProps {
  items: Item[];
  boards: Board[];
  onItemClick: (item: Item) => void;
}

export default function TimelineView({ items, boards, onItemClick }: TimelineViewProps) {
  const itemsWithDueDate = items
    .filter(item => item.metadata.dueDate)
    .sort((a, b) => parseISO(a.metadata.dueDate!).getTime() - parseISO(b.metadata.dueDate!).getTime());

  const getBoardName = (boardId: string) => boards.find(b => b.id === boardId)?.name || boardId;

  return (
    <div className="h-full bg-jungle-mist dark:bg-clouded-night flex flex-col font-sans transition-colors duration-300">
      <div className="px-4 md:px-8 py-4 md:py-0 border-b border-jungle-border dark:border-jungle-border-dark bg-jungle-view-header dark:bg-jungle-view-header-dark md:h-[132px] flex flex-col justify-center flex-shrink-0">
        <h2 className="text-xl md:text-3xl font-black text-jungle-emerald dark:text-jungle-text-light flex items-center gap-2 md:gap-3 tracking-tight">
          <Clock className="text-jungle-amber dark:text-jungle-amber-dark w-6 h-6 md:w-8 md:h-8" />
          Timeline
        </h2>
        <p className="text-sm md:text-base text-jungle-text-muted dark:text-jungle-text-muted-dark mt-1 md:mt-2 font-medium">All tasks with a scheduled due date, ordered by time.</p>
      </div>

      <div className="flex-1 overflow-auto p-4 md:p-8">
        <div className="max-w-5xl mx-auto">
          <div className="hidden md:grid grid-cols-[150px_150px_1fr] gap-4 mb-4 px-4 text-[10px] font-black text-jungle-text-muted dark:text-jungle-text-muted-dark uppercase tracking-widest">
            <div>Due Date</div>
            <div>Board</div>
            <div>Task Name</div>
          </div>

          <div className="space-y-2">
            {itemsWithDueDate.length === 0 ? (
              <div className="text-center py-20 bg-jungle-paper dark:bg-jungle-paper-dark rounded-2xl border-2 border-dashed border-jungle-border dark:border-jungle-border-dark shadow-inner">
                <Calendar className="mx-auto text-jungle-border dark:text-jungle-border-dark mb-4" size={48} />
                <p className="text-jungle-text-muted dark:text-jungle-text-muted-dark font-bold uppercase tracking-wide">No tasks with due dates found.</p>
              </div>
            ) : (
              itemsWithDueDate.map(item => {
                const dueDate = parseISO(item.metadata.dueDate!);
                const overdue = isPast(dueDate) && !isToday(dueDate);
                const today = isToday(dueDate);

                return (
                  <div
                    key={item.id}
                    onClick={() => onItemClick(item)}
                    className="grid grid-cols-1 md:grid-cols-[150px_150px_1fr] gap-2 md:gap-4 p-4 bg-jungle-paper dark:bg-jungle-paper-dark border border-jungle-border dark:border-jungle-border-dark rounded-xl hover:border-jungle-emerald dark:hover:border-jungle-emerald-dark hover:shadow-lg transition-all cursor-pointer group items-start md:items-center"
                  >
                    <div className="flex items-center gap-2 md:contents">
                      <div className={`font-mono text-xs md:text-sm font-bold px-2 py-1 rounded w-fit ${
                        overdue 
                          ? "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20" 
                          : today
                          ? "text-jungle-amber dark:text-jungle-amber-dark bg-jungle-amber-muted dark:bg-jungle-amber-muted-dark"
                          : "text-jungle-text-muted dark:text-jungle-text-muted-dark"
                      }`}>
                        {format(dueDate, "yyyy-MM-dd")}
                      </div>
                      <div className="md:hidden text-xs text-jungle-text-muted dark:text-jungle-text-muted-dark font-medium truncate">
                        {getBoardName(item.boardId)}
                      </div>
                    </div>
                    <div className="hidden md:block text-sm text-jungle-text-muted dark:text-jungle-text-muted-dark font-medium truncate">
                      {getBoardName(item.boardId)}
                    </div>
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 md:gap-0">
                      <span className="text-base md:text-sm text-jungle-text dark:text-jungle-text-light font-bold group-hover:text-jungle-emerald dark:group-hover:text-jungle-emerald-dark transition-colors truncate">{item.name}</span>
                      <div className="flex flex-wrap gap-1">
                        {item.metadata.tags?.map(tag => (
                          <span key={tag} className="px-2 py-0.5 bg-jungle-view-header dark:bg-jungle-view-header-dark/30 text-jungle-emerald dark:text-jungle-emerald-dark text-[9px] rounded font-black border border-emerald-100 dark:border-emerald-800">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
