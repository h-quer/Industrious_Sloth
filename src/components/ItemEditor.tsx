import React, { useState, useEffect, useRef, useMemo } from "react";
import { motion } from "motion/react";
import { X, Tag, Calendar, Save, Trash2, Move, Bold, Italic, Heading, List, CheckSquare, Link, Code } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { Item, Board } from "../types";
import { isValidFilename, getInvalidChars } from "../lib/utils";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { format, parseISO } from "date-fns";
import Editor from "react-simple-code-editor";
import Prism from "prismjs";
import "prismjs/components/prism-markdown";
import "prismjs/themes/prism.css";

interface ItemEditorProps {
  item: Item;
  boards: Board[];
  onSave: (updatedItem: Partial<Item> & { newName?: string }) => Promise<void>;
  onClose: () => void;
  onDelete: () => void;
  onMove: (itemId: string, targetBoardId: string, targetLaneId: string) => void;
  allTags: string[];
}

export default function ItemEditor({ item, boards, onSave, onClose, onDelete, onMove, allTags }: ItemEditorProps) {
  const [name, setName] = useState(item.name);
  const [nameError, setNameError] = useState<string | null>(null);
  const [content, setContent] = useState(item.content);
  const [tags, setTags] = useState<string[]>(item.metadata.tags || []);
  const [tagInput, setTagInput] = useState("");
  const [dueDate, setDueDate] = useState<Date | null>(item.metadata.dueDate ? parseISO(item.metadata.dueDate) : null);
  const [isPreview, setIsPreview] = useState(!!item.content.trim());
  const [showMove, setShowMove] = useState(false);
  const [isShaking, setIsShaking] = useState(false);
  const editorRef = useRef<any>(null);
  const backdropRef = useRef<HTMLDivElement>(null);

  const hasChanges = useMemo(() => {
    const initialDueDate = item.metadata.dueDate || "";
    const currentDueDate = dueDate ? format(dueDate, 'yyyy-MM-dd') : "";
    
    const initialTags = [...(item.metadata.tags || [])].sort();
    const currentTags = [...tags].sort();

    return (
      name.trim() !== item.name ||
      content !== item.content ||
      JSON.stringify(initialTags) !== JSON.stringify(currentTags) ||
      currentDueDate !== initialDueDate
    );
  }, [name, content, tags, dueDate, item]);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === backdropRef.current) {
      if (hasChanges) {
        setIsShaking(true);
        // Switch to edit mode to show the buttons that need highlighting
        if (isPreview) {
          setIsPreview(false);
        }
        setTimeout(() => setIsShaking(false), 600);
      } else {
        onClose();
      }
    }
  };

  useEffect(() => {
    setName(item.name);
    setContent(item.content);
    setTags(item.metadata.tags || []);
    setDueDate(item.metadata.dueDate ? parseISO(item.metadata.dueDate) : null);
    setNameError(null);
  }, [item]);

  useEffect(() => {
    if (!isPreview) {
      // Small timeout to ensure the DOM is ready after switching from preview
      const timer = setTimeout(() => {
        const textarea = document.querySelector('.item-editor-textarea') as HTMLTextAreaElement;
        if (textarea) {
          textarea.focus();
          // Move cursor to end of content
          const length = textarea.value.length;
          textarea.setSelectionRange(length, length);
        }
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isPreview]);

  const handleContentAreaClick = (e: React.MouseEvent) => {
    // Only focus if we're in edit mode and not clicking on an interactive element
    if (!isPreview) {
      const target = e.target as HTMLElement;
      const isInteractive = target.closest('button, input, select, textarea');
      if (!isInteractive) {
        const textarea = document.querySelector('.item-editor-textarea') as HTMLTextAreaElement;
        if (textarea) {
          textarea.focus();
        }
      }
    }
  };

  const applyFormat = (prefix: string, suffix: string = "") => {
    const textarea = document.querySelector('.item-editor-textarea') as HTMLTextAreaElement;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = content.substring(start, end);
    const before = content.substring(0, start);
    const after = content.substring(end);

    const newText = before + prefix + selectedText + suffix + after;
    setContent(newText);

    // Re-focus and set selection after state update
    setTimeout(() => {
      textarea.focus();
      if (start === end) {
        // If no selection, put cursor between prefix and suffix
        const newPos = start + prefix.length;
        textarea.setSelectionRange(newPos, newPos);
      } else {
        // Otherwise wrap the selection
        textarea.setSelectionRange(
          start + prefix.length,
          end + prefix.length
        );
      }
    }, 10);
  };

  const handleSave = async (): Promise<boolean> => {
    const trimmedName = name.trim();
    if (!trimmedName) return false;

    if (!isValidFilename(trimmedName)) {
      const invalid = getInvalidChars(trimmedName);
      setNameError(`Invalid characters: ${invalid.join(" ")}`);
      return false;
    }

    const currentBoard = boards.find(b => b.id === item.boardId);
    const currentLane = currentBoard?.lanes.find(l => l.id === item.laneId);
    if (currentLane && trimmedName !== item.name) {
      if (currentLane.items.some(i => i.name.toLowerCase() === trimmedName.toLowerCase() && i.id !== item.id)) {
        setNameError("An item with this name already exists in this lane.");
        return false;
      }
    }

    try {
      await onSave({
        newName: trimmedName,
        content,
        metadata: {
          ...item.metadata,
          tags,
          dueDate: dueDate ? format(dueDate, 'yyyy-MM-dd') : undefined
        }
      });
      setIsPreview(true);
      return true;
    } catch (error) {
      console.error("Failed to save item:", error);
      return false;
    }
  };

  const handleAddTag = (tag: string) => {
    const trimmed = tag.trim();
    if (trimmed && !tags.includes(trimmed)) {
      setTags([...tags, trimmed]);
    }
    setTagInput("");
  };

  const handleRemoveTag = (tag: string) => {
    setTags(tags.filter(t => t !== tag));
  };

  const handleMove = async (targetBoardId: string, targetLaneId: string) => {
    const targetBoard = boards.find(b => b.id === targetBoardId);
    const targetLane = targetBoard?.lanes.find(l => l.id === targetLaneId);
    if (targetLane && targetLane.items.some(i => i.name.toLowerCase() === name.trim().toLowerCase() && i.id !== item.id)) {
      setNameError("An item with this name already exists in the target lane.");
      return;
    }
    
    if (hasChanges) {
      const saved = await handleSave();
      if (!saved) return;
    }
    
    onMove(name.trim(), targetBoardId, targetLaneId);
  };

  return (
    <div 
      ref={backdropRef}
      onClick={handleBackdropClick}
      className="fixed inset-0 bg-jungle-sidebar/60 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-0 md:p-4 transition-colors duration-300"
    >
      <motion.div 
        animate={isShaking ? { 
          x: [0, -10, 10, -10, 10, -10, 10, 0],
          scale: [1, 1.01, 1]
        } : {}}
        transition={{ duration: 0.5 }}
        className={`bg-jungle-mist dark:bg-clouded-night w-full max-w-4xl h-full md:h-[90vh] md:rounded-2xl shadow-2xl flex flex-col overflow-hidden border transition-all duration-300 ${isShaking ? 'border-jungle-emerald dark:border-jungle-emerald-dark ring-4 ring-jungle-emerald/20' : 'border-jungle-border dark:border-jungle-border-dark'}`}
      >
        {/* Header */}
        <div className="p-4 border-b border-jungle-border dark:border-jungle-border-dark flex items-center justify-between bg-jungle-paper dark:bg-jungle-paper-dark">
          <div className="flex-1 min-w-0">
            <input
              type="text"
              value={name}
              readOnly={isPreview}
              onChange={(e) => {
                setName(e.target.value);
                setNameError(null);
              }}
              className={`text-xl md:text-2xl font-bold text-jungle-text dark:text-jungle-text-light bg-transparent border-none focus:ring-0 w-full placeholder-jungle-border dark:placeholder-jungle-border-dark ${nameError ? 'text-red-500' : ''} ${isPreview ? 'cursor-default' : ''}`}
              placeholder="Item Name"
            />
            {nameError && (
              <p className="text-[10px] text-red-500 font-bold px-3">{nameError}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowMove(!showMove)}
              className="p-2 hover:bg-jungle-sidebar dark:hover:bg-jungle-sidebar-dark rounded-lg text-jungle-text-muted dark:text-jungle-text-muted-dark hover:text-jungle-text dark:hover:text-jungle-text-light transition-colors"
              title="Move Item"
            >
              <Move size={20} />
            </button>
            <button
              onClick={onDelete}
              className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg text-red-500 dark:text-red-400 hover:text-red-600 dark:hover:text-red-300 transition-colors"
              title="Delete Item"
            >
              <Trash2 size={20} />
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-jungle-sidebar dark:hover:bg-jungle-sidebar-dark rounded-lg text-jungle-text-muted dark:text-jungle-text-muted-dark hover:text-jungle-text dark:hover:text-jungle-text-light transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Move Panel */}
        {showMove && (
          <div className="p-4 bg-jungle-amber/10 dark:bg-jungle-amber-dark/10 border-b border-jungle-amber/20 dark:border-jungle-amber-dark/30 flex flex-wrap gap-4 items-center">
            <span className="text-sm font-bold text-jungle-amber dark:text-jungle-amber-dark">Move to:</span>
            {boards.map(board => (
              <div key={board.id} className="flex items-center gap-2">
                <span className="text-xs font-bold text-jungle-amber/70 dark:text-jungle-amber-dark/50 uppercase">{board.name}:</span>
                {board.lanes.map(lane => (
                  <button
                    key={lane.id}
                    onClick={() => handleMove(board.id, lane.id)}
                    className="px-2 py-1 bg-jungle-paper dark:bg-jungle-paper-dark border border-jungle-amber/30 dark:border-jungle-amber-dark/50 rounded text-xs font-medium text-jungle-amber dark:text-jungle-amber-dark hover:bg-jungle-amber/20 dark:hover:bg-jungle-amber-dark/30 transition-colors"
                  >
                    {lane.name}
                  </button>
                ))}
              </div>
            ))}
          </div>
        )}

        {/* Metadata Bar */}
        <div className="p-4 border-b border-jungle-border dark:border-jungle-border-dark flex flex-wrap gap-6 items-center bg-jungle-paper dark:bg-jungle-paper-dark">
          <div className="flex items-center gap-2">
            <Tag size={16} className="text-jungle-text-muted dark:text-jungle-text-muted-dark" />
            <div className="flex flex-wrap gap-1 items-center">
              {tags.map(tag => (
                <span key={tag} className="px-3 py-1 bg-jungle-sidebar-header dark:bg-jungle-sidebar-header-dark/40 text-jungle-emerald dark:text-jungle-emerald-dark text-sm rounded-full flex items-center gap-1.5 font-medium border border-emerald-200 dark:border-emerald-800">
                  {tag}
                  {!isPreview && (
                    <button onClick={() => handleRemoveTag(tag)} className="hover:text-emerald-900 dark:hover:text-emerald-100 opacity-60 hover:opacity-100">×</button>
                  )}
                </span>
              ))}
              {!isPreview && (
                <div className="relative flex items-center">
                  <input
                    type="text"
                    value={tagInput}
                    onChange={(e) => {
                      const val = e.target.value;
                      setTagInput(val);
                      // If the value exactly matches one of the existing tags (that isn't already added)
                      // we assume it was selected from the datalist or fully typed
                      if (allTags.filter(t => !tags.includes(t)).includes(val)) {
                        handleAddTag(val);
                      }
                    }}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddTag(tagInput)}
                    list="existing-tags"
                    placeholder="+ Add Tag"
                    className="text-sm border-none bg-transparent focus:ring-0 text-jungle-emerald dark:text-jungle-emerald-dark font-bold placeholder-jungle-emerald/50 w-32 py-1 px-2 ml-1"
                  />
                  <datalist id="existing-tags">
                    {allTags.filter(t => !tags.includes(t)).map(t => (
                      <option key={t} value={t} />
                    ))}
                  </datalist>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Calendar size={18} className="text-jungle-text-muted dark:text-jungle-text-muted-dark" />
            <DatePicker
              selected={dueDate}
              onChange={(date) => setDueDate(date)}
              dateFormat="yyyy-MM-dd"
              placeholderText={isPreview ? "No due date" : "Set due date"}
              readOnly={isPreview}
              className={`text-base border-none bg-transparent focus:ring-0 text-jungle-amber dark:text-jungle-amber-dark font-bold placeholder-jungle-amber/50 py-1 px-2 ${isPreview ? 'cursor-default' : 'cursor-pointer'}`}
            />
          </div>
        </div>

        {/* Editor / Preview Toggle & Toolbar */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between border-b border-jungle-border dark:border-jungle-border-dark bg-jungle-mist dark:bg-jungle-paper-dark">
          <div className="flex w-full md:w-auto border-b md:border-b-0 border-jungle-border dark:border-jungle-border-dark">
            <button
              onClick={() => setIsPreview(true)}
              className={`flex-1 md:flex-none px-6 py-3 font-bold transition-colors ${isPreview ? "border-b-2 border-jungle-emerald dark:border-jungle-emerald-dark text-jungle-emerald dark:text-jungle-emerald-dark bg-jungle-paper dark:bg-jungle-paper-dark" : "text-jungle-text-muted dark:text-jungle-text-muted-dark hover:text-jungle-text dark:hover:text-jungle-text-light hover:bg-jungle-sidebar dark:hover:bg-jungle-sidebar-dark"}`}
            >
              View
            </button>
            <button
              onClick={() => setIsPreview(false)}
              className={`flex-1 md:flex-none px-6 py-3 font-bold transition-colors ${!isPreview ? "border-b-2 border-jungle-emerald dark:border-jungle-emerald-dark text-jungle-emerald dark:text-jungle-emerald-dark bg-jungle-paper dark:bg-jungle-paper-dark" : "text-jungle-text-muted dark:text-jungle-text-muted-dark hover:text-jungle-text dark:hover:text-jungle-text-light hover:bg-jungle-sidebar dark:hover:bg-jungle-sidebar-dark"}`}
            >
              Edit
            </button>
          </div>

          {!isPreview && (
            <div className="flex flex-wrap items-center gap-1 p-2 md:px-4 md:border-l border-jungle-border dark:border-jungle-border-dark w-full md:w-auto overflow-x-auto">
              <button onMouseDown={(e) => e.preventDefault()} onClick={() => applyFormat("**", "**")} className="p-1.5 hover:bg-jungle-sidebar-active dark:hover:bg-jungle-sidebar-active-dark rounded text-jungle-text-muted dark:text-jungle-text-muted-dark transition-colors" title="Bold">
                <Bold size={16} />
              </button>
              <button onMouseDown={(e) => e.preventDefault()} onClick={() => applyFormat("*", "*")} className="p-1.5 hover:bg-jungle-sidebar-active dark:hover:bg-jungle-sidebar-active-dark rounded text-jungle-text-muted dark:text-jungle-text-muted-dark transition-colors" title="Italic">
                <Italic size={16} />
              </button>
              <button onMouseDown={(e) => e.preventDefault()} onClick={() => applyFormat("# ")} className="p-1.5 hover:bg-jungle-sidebar-active dark:hover:bg-jungle-sidebar-active-dark rounded text-jungle-text-muted dark:text-jungle-text-muted-dark transition-colors" title="Heading">
                <Heading size={16} />
              </button>
              <div className="w-px h-4 bg-jungle-border dark:bg-jungle-border-dark mx-1" />
              <button onMouseDown={(e) => e.preventDefault()} onClick={() => applyFormat("- ")} className="p-1.5 hover:bg-jungle-sidebar-active dark:hover:bg-jungle-sidebar-active-dark rounded text-jungle-text-muted dark:text-jungle-text-muted-dark transition-colors" title="Bullet List">
                <List size={16} />
              </button>
              <button onMouseDown={(e) => e.preventDefault()} onClick={() => applyFormat("- [ ] ")} className="p-1.5 hover:bg-jungle-sidebar-active dark:hover:bg-jungle-sidebar-active-dark rounded text-jungle-text-muted dark:text-jungle-text-muted-dark transition-colors" title="Task List">
                <CheckSquare size={16} />
              </button>
              <div className="w-px h-4 bg-jungle-border dark:bg-jungle-border-dark mx-1" />
              <button onMouseDown={(e) => e.preventDefault()} onClick={() => applyFormat("[", "](url)")} className="p-1.5 hover:bg-jungle-sidebar-active dark:hover:bg-jungle-sidebar-active-dark rounded text-jungle-text-muted dark:text-jungle-text-muted-dark transition-colors" title="Link">
                <Link size={16} />
              </button>
              <button onMouseDown={(e) => e.preventDefault()} onClick={() => applyFormat("`", "`")} className="p-1.5 hover:bg-jungle-sidebar-active dark:hover:bg-jungle-sidebar-active-dark rounded text-jungle-text-muted dark:text-jungle-text-muted-dark transition-colors" title="Code">
                <Code size={16} />
              </button>
            </div>
          )}
        </div>

        {/* Content Area */}
        <div 
          className="flex-1 overflow-auto custom-scrollbar bg-jungle-paper dark:bg-clouded-night"
          onClick={handleContentAreaClick}
        >
          {isPreview ? (
            <div className="flex-1 p-4 md:p-12">
              <div className="prose prose-jungle dark:prose-invert prose-emerald max-w-none">
                <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
                  {content}
                </ReactMarkdown>
              </div>
            </div>
          ) : (
            <div className="min-h-full w-full p-4 font-mono text-sm">
              <Editor
                ref={editorRef}
                value={content}
                onValueChange={setContent}
                highlight={code => Prism.highlight(code, Prism.languages.markdown, "markdown")}
                padding={16}
                style={{
                  fontFamily: '"Fira Code", "JetBrains Mono", monospace',
                  fontSize: 14,
                  minHeight: "100%",
                  outline: "none",
                  backgroundColor: "transparent",
                  color: "inherit"
                }}
                textareaClassName="focus:outline-none dark:text-jungle-text-light item-editor-textarea"
                className="w-full min-h-full"
              />
            </div>
          )}
        </div>

        {/* Footer */}
        {!isPreview && (
          <div className="p-4 border-t border-jungle-border dark:border-jungle-border-dark bg-jungle-mist dark:bg-jungle-paper-dark flex justify-end gap-3">
            <button
              onClick={onClose}
              className={`px-4 py-2 text-jungle-text-muted dark:text-jungle-text-muted-dark hover:bg-jungle-sidebar dark:hover:bg-jungle-sidebar-dark rounded-lg font-bold transition-all duration-300 ${isShaking ? 'bg-jungle-sidebar dark:bg-jungle-sidebar-dark scale-110 ring-2 ring-jungle-border' : ''}`}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className={`px-4 py-2 bg-jungle-emerald dark:bg-jungle-emerald-dark text-white hover:opacity-90 rounded-lg font-bold flex items-center gap-2 shadow-sm transition-all duration-300 ${isShaking ? 'scale-110 ring-4 ring-jungle-emerald/50 shadow-lg' : ''}`}
            >
              <Save size={18} />
              Save Changes
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}
