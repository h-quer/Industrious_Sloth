import express from "express";
import path from "path";
import fs from "fs-extra";
import yaml from "js-yaml";
import cors from "cors";
import { Server } from "socket.io";
import chokidar from "chokidar";
import { createServer } from "http";

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const DATA_DIR = path.join(process.cwd(), "data");

app.use(cors());
app.use(express.json());

// Ensure data directory exists
fs.ensureDirSync(DATA_DIR);
const ROOT_CONFIG_PATH = path.join(DATA_DIR, "config.json");
if (!fs.existsSync(ROOT_CONFIG_PATH)) {
  fs.writeJsonSync(ROOT_CONFIG_PATH, { boards: [] });
}

// Helper to parse front matter
function parseMarkdown(content: string) {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (match) {
    try {
      const metadata = yaml.load(match[1]) as any;
      return { metadata, content: match[2].trim() };
    } catch (e) {
      return { metadata: {}, content: content.trim() };
    }
  }
  return { metadata: {}, content: content.trim() };
}

// Helper to stringify front matter
function stringifyMarkdown(metadata: any, content: string) {
  const yamlStr = yaml.dump(metadata);
  return `---\n${yamlStr}---\n\n${content}`;
}

// API Routes

// Serve custom CSS
app.get("/api/custom.css", (req, res) => {
  const customCssPath = path.join(DATA_DIR, "custom.css");
  if (fs.existsSync(customCssPath)) {
    res.setHeader("Content-Type", "text/css");
    res.sendFile(customCssPath);
  } else {
    res.status(404).send("Not found");
  }
});

// Get all data (boards, lanes, items)
app.get("/api/data", async (req, res) => {
  try {
    const rootConfig = await fs.readJson(ROOT_CONFIG_PATH).catch(() => ({ boards: [] }));
    const boardOrder = rootConfig.boards.map((b: any) => b.id);
    
    // Read actual directories for boards
    const allEntries = await fs.readdir(DATA_DIR, { withFileTypes: true });
    const boardDirs = allEntries
      .filter(dirent => dirent.isDirectory() && !dirent.name.startsWith('.'))
      .map(dirent => dirent.name);
    
    // Sort boards based on config, append any new ones
    const sortedBoardDirs = [...boardDirs].sort((a, b) => {
      const idxA = boardOrder.indexOf(a);
      const idxB = boardOrder.indexOf(b);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.localeCompare(b);
    });

    let rootConfigNeedsSaving = false;
    if (sortedBoardDirs.length !== boardOrder.length || sortedBoardDirs.some((id, i) => id !== boardOrder[i])) {
      rootConfigNeedsSaving = true;
    }

    const boards = await Promise.all(
      sortedBoardDirs.map(async (boardId: string) => {
        const boardDir = path.join(DATA_DIR, boardId);
        const boardConfigPath = path.join(boardDir, "config.json");
        
        let laneOrder: string[] = [];
        let boardInfo = rootConfig.boards.find((b: any) => b.id === boardId) || { id: boardId, icon: "LayoutDashboard", color: "text-jungle-emerald" };

        let boardConfig: any = { lanes: [] };
        let configNeedsSaving = false;
        if (await fs.pathExists(boardConfigPath)) {
          boardConfig = await fs.readJson(boardConfigPath);
          laneOrder = boardConfig.lanes.map((l: any) => l.id);
        } else {
          configNeedsSaving = true;
        }

        const boardEntries = await fs.readdir(boardDir, { withFileTypes: true });
        const laneDirs = boardEntries
          .filter(dirent => dirent.isDirectory() && !dirent.name.startsWith('.'))
          .map(dirent => dirent.name);

        // Check if lane order is out of sync
        if (laneOrder.length !== laneDirs.length || !laneOrder.every(id => laneDirs.includes(id))) {
          configNeedsSaving = true;
        }

        const sortedLaneDirs = [...laneDirs].sort((a, b) => {
          const idxA = laneOrder.indexOf(a);
          const idxB = laneOrder.indexOf(b);
          if (idxA !== -1 && idxB !== -1) return idxA - idxB;
          if (idxA !== -1) return -1;
          if (idxB !== -1) return 1;
          return a.localeCompare(b);
        });

        const lanes = await Promise.all(
          sortedLaneDirs.map(async (laneId: string) => {
            const laneDir = path.join(boardDir, laneId);
            
            let itemOrder: string[] = [];
            const laneConfig = boardConfig.lanes.find((l: any) => l.id === laneId);
            if (laneConfig) {
                itemOrder = laneConfig.items || [];
            }

            const laneEntries = await fs.readdir(laneDir, { withFileTypes: true });
            const itemFiles = laneEntries
                .filter(dirent => dirent.isFile() && dirent.name.endsWith('.md'))
                .map(dirent => dirent.name.replace('.md', ''));

            // Check if item order is out of sync
            if (itemOrder.length !== itemFiles.length || !itemOrder.every(id => itemFiles.includes(id))) {
              configNeedsSaving = true;
            }

            const sortedItemFiles = [...itemFiles].sort((a, b) => {
                const idxA = itemOrder.indexOf(a);
                const idxB = itemOrder.indexOf(b);
                if (idxA !== -1 && idxB !== -1) return idxA - idxB;
                if (idxA !== -1) return -1;
                if (idxB !== -1) return 1;
                return a.localeCompare(b);
            });

            const items = await Promise.all(
              sortedItemFiles.map(async (itemId: string) => {
                const itemPath = path.join(laneDir, `${itemId}.md`);
                if (await fs.pathExists(itemPath)) {
                  const raw = await fs.readFile(itemPath, "utf-8");
                  const { metadata, content } = parseMarkdown(raw);
                  return {
                    id: itemId,
                    name: itemId,
                    metadata,
                    content,
                    laneId: laneId,
                    boardId: boardId
                  };
                }
                return null;
              })
            );
            return { id: laneId, name: laneId, items: items.filter(Boolean) };
          })
        );
        
        if (configNeedsSaving) {
          boardConfig.lanes = lanes.map(l => ({ id: l.id, items: l.items.map(i => i.id) }));
          await fs.writeJson(boardConfigPath, boardConfig);
        }
        
        return { ...boardInfo, name: boardId, lanes };
      })
    );

    if (rootConfigNeedsSaving) {
      rootConfig.boards = boards.filter(Boolean).map(b => ({ id: b.id, icon: b.icon, color: b.color }));
      await fs.writeJson(ROOT_CONFIG_PATH, rootConfig);
    }

    res.json({ boards: boards.filter(Boolean) });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Create Board
app.post("/api/boards", async (req, res) => {
  const { name, icon, color } = req.body;
  const id = name.trim();
  const boardDir = path.join(DATA_DIR, id);

  try {
    if (await fs.pathExists(boardDir)) {
      return res.status(400).json({ error: "A board with this name already exists." });
    }
    await fs.ensureDir(boardDir);
    await fs.writeJson(path.join(boardDir, "config.json"), { lanes: [] });

    const rootConfig = await fs.readJson(ROOT_CONFIG_PATH);
    rootConfig.boards.push({ id, icon, color });
    await fs.writeJson(ROOT_CONFIG_PATH, rootConfig);

    res.json({ id, name: id, icon, color, lanes: [] });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Delete Board
app.delete("/api/boards/:id", async (req, res) => {
  const { id } = req.params;
  const boardDir = path.join(DATA_DIR, id);

  try {
    await fs.remove(boardDir);
    const rootConfig = await fs.readJson(ROOT_CONFIG_PATH);
    rootConfig.boards = rootConfig.boards.filter((b: any) => b.id !== id);
    await fs.writeJson(ROOT_CONFIG_PATH, rootConfig);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Update Board
app.put("/api/boards/:id", async (req, res) => {
  const { id } = req.params;
  const { name, icon, color } = req.body;
  const newId = name.trim();

  try {
    const rootConfig = await fs.readJson(ROOT_CONFIG_PATH);
    const boardIndex = rootConfig.boards.findIndex((b: any) => b.id === id);
    if (boardIndex === -1) {
      return res.status(404).json({ error: "Board not found" });
    }

    if (newId !== id) {
      const oldPath = path.join(DATA_DIR, id);
      const newPath = path.join(DATA_DIR, newId);
      if (await fs.pathExists(newPath)) {
        return res.status(400).json({ error: "A board with this name already exists." });
      }
      await fs.move(oldPath, newPath);
    }

    // Update board metadata
    rootConfig.boards[boardIndex] = { id: newId, icon, color };
    await fs.writeJson(ROOT_CONFIG_PATH, rootConfig);

    res.json({ ...rootConfig.boards[boardIndex], name: newId });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Reorder Boards
app.post("/api/boards/reorder", async (req, res) => {
  const { boardIds } = req.body;
  try {
    const rootConfig = await fs.readJson(ROOT_CONFIG_PATH).catch(() => ({ boards: [] }));
    const boardMap = new Map(rootConfig.boards.map((b: any) => [b.id, b]));
    
    const newBoards = boardIds.map((id: string) => {
      return boardMap.get(id) || { id, icon: "mdiLeaf", color: "#059669" };
    });
    
    rootConfig.boards = newBoards;
    await fs.writeJson(ROOT_CONFIG_PATH, rootConfig);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Create Lane
app.post("/api/boards/:boardId/lanes", async (req, res) => {
  const { boardId } = req.params;
  const { name } = req.body;
  const id = name.trim();
  const boardDir = path.join(DATA_DIR, boardId);
  const laneDir = path.join(boardDir, id);

  try {
    if (await fs.pathExists(laneDir)) {
      return res.status(400).json({ error: "A lane with this name already exists." });
    }
    await fs.ensureDir(laneDir);
    const boardConfigPath = path.join(boardDir, "config.json");
    let boardConfig = { lanes: [] };
    if (await fs.pathExists(boardConfigPath)) {
      boardConfig = await fs.readJson(boardConfigPath);
    }
    boardConfig.lanes.push({ id, items: [] });
    await fs.writeJson(boardConfigPath, boardConfig);
    res.json({ id, name: id, items: [] });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Get single item
app.get("/api/boards/:boardId/lanes/:laneId/items/:itemId", async (req, res) => {
  const { boardId, laneId, itemId } = req.params;
  const itemPath = path.join(DATA_DIR, boardId, laneId, `${itemId}.md`);

  try {
    if (await fs.pathExists(itemPath)) {
      const raw = await fs.readFile(itemPath, "utf-8");
      const { metadata, content } = parseMarkdown(raw);
      res.json({
        id: itemId,
        name: itemId,
        metadata,
        content,
        laneId,
        boardId
      });
    } else {
      res.status(404).json({ error: "Item not found" });
    }
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Create Item
app.post("/api/boards/:boardId/lanes/:laneId/items", async (req, res) => {
  const { boardId, laneId } = req.params;
  const { name, metadata, content } = req.body;
  const id = name.trim();
  const boardDir = path.join(DATA_DIR, boardId);
  const laneDir = path.join(boardDir, laneId);
  const itemPath = path.join(laneDir, `${id}.md`);

  try {
    await fs.ensureDir(laneDir);
    if (await fs.pathExists(itemPath)) {
      return res.status(400).json({ error: "An item with this name already exists in this lane." });
    }

    await fs.writeFile(itemPath, stringifyMarkdown(metadata || {}, content || ""));
    
    const boardConfigPath = path.join(boardDir, "config.json");
    let boardConfig = { lanes: [] };
    if (await fs.pathExists(boardConfigPath)) {
      boardConfig = await fs.readJson(boardConfigPath);
    }
    const lane = boardConfig.lanes.find((l: any) => l.id === laneId);
    if (lane) {
      if (!lane.items.includes(id)) {
        lane.items.push(id);
      }
    } else {
      boardConfig.lanes.push({ id: laneId, items: [id] });
    }
    await fs.writeJson(boardConfigPath, boardConfig);
    res.json({ id, name: id, metadata, content, laneId, boardId });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Update Item
app.put("/api/items", async (req, res) => {
  const { boardId, laneId, id, newName, metadata, content } = req.body;
  const laneDir = path.join(DATA_DIR, boardId, laneId);
  const oldPath = path.join(laneDir, `${id}.md`);
  const newId = newName ? newName.trim() : id;
  const newPath = path.join(laneDir, `${newId}.md`);

  try {
    await fs.ensureDir(laneDir);
    if (newName && newId !== id) {
      if (await fs.pathExists(newPath)) {
        return res.status(400).json({ error: "An item with this name already exists in this lane." });
      }
      if (await fs.pathExists(oldPath)) {
        await fs.move(oldPath, newPath);
      }
      // Update board config item order
      const boardConfigPath = path.join(DATA_DIR, boardId, "config.json");
      let boardConfig = { lanes: [] };
      if (await fs.pathExists(boardConfigPath)) {
        boardConfig = await fs.readJson(boardConfigPath);
      }
      const lane = boardConfig.lanes.find((l: any) => l.id === laneId);
      if (lane) {
        lane.items = lane.items.map((item: string) => item === id ? newId : item);
      } else {
        boardConfig.lanes.push({ id: laneId, items: [newId] });
      }
      await fs.writeJson(boardConfigPath, boardConfig);
    }
    await fs.writeFile(newPath, stringifyMarkdown(metadata, content));
    res.json({ id: newId, name: newId, metadata, content, laneId, boardId });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Move Item
app.post("/api/items/move", async (req, res) => {
  const { boardId, laneId, id, targetBoardId, targetLaneId, targetIndex } = req.body;
  const sourcePath = path.join(DATA_DIR, boardId, laneId, `${id}.md`);
  const targetLaneDir = path.join(DATA_DIR, targetBoardId, targetLaneId);
  const destPath = path.join(targetLaneDir, `${id}.md`);

  try {
    // 1. Ensure target directory exists
    await fs.ensureDir(targetLaneDir);

    // 2. Move file
    if (sourcePath !== destPath) {
      if (await fs.pathExists(destPath)) {
        return res.status(400).json({ error: "An item with this name already exists in the target lane." });
      }
      if (await fs.pathExists(sourcePath)) {
        await fs.move(sourcePath, destPath);
      }
    }

    // 2. Update source board config
    const sourceBoardConfigPath = path.join(DATA_DIR, boardId, "config.json");
    let sourceBoardConfig = { lanes: [] };
    if (await fs.pathExists(sourceBoardConfigPath)) {
      sourceBoardConfig = await fs.readJson(sourceBoardConfigPath);
    }
    const sourceLane = sourceBoardConfig.lanes.find((l: any) => l.id === laneId);
    if (sourceLane) {
      sourceLane.items = sourceLane.items.filter((item: string) => item !== id);
    }
    await fs.writeJson(sourceBoardConfigPath, sourceBoardConfig);

    // 3. Update target board config
    const targetBoardConfigPath = path.join(DATA_DIR, targetBoardId, "config.json");
    let targetBoardConfig = (boardId === targetBoardId) ? sourceBoardConfig : { lanes: [] };
    if (boardId !== targetBoardId && await fs.pathExists(targetBoardConfigPath)) {
      targetBoardConfig = await fs.readJson(targetBoardConfigPath);
    }
    const targetLane = targetBoardConfig.lanes.find((l: any) => l.id === targetLaneId);
    if (targetLane) {
      // Remove if it exists to prevent duplicates
      targetLane.items = targetLane.items.filter((item: string) => item !== id);
      if (typeof targetIndex === 'number') {
        targetLane.items.splice(targetIndex, 0, id);
      } else {
        targetLane.items.push(id);
      }
    } else {
      targetBoardConfig.lanes.push({ id: targetLaneId, items: [id] });
    }
    await fs.writeJson(targetBoardConfigPath, targetBoardConfig);

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Rename Lane
app.put("/api/boards/:boardId/lanes/:laneId", async (req, res) => {
  const { boardId, laneId } = req.params;
  const { name } = req.body;
  const newId = name.trim();
  const boardDir = path.join(DATA_DIR, boardId);

  try {
    const boardConfigPath = path.join(boardDir, "config.json");
    let boardConfig = { lanes: [] };
    if (await fs.pathExists(boardConfigPath)) {
      boardConfig = await fs.readJson(boardConfigPath);
    }
    const laneIndex = boardConfig.lanes.findIndex((l: any) => l.id === laneId);
    
    if (newId !== laneId) {
      const oldPath = path.join(boardDir, laneId);
      const newPath = path.join(boardDir, newId);
      if (await fs.pathExists(newPath)) {
        return res.status(400).json({ error: "A lane with this name already exists." });
      }
      if (await fs.pathExists(oldPath)) {
        await fs.move(oldPath, newPath);
      } else {
        await fs.ensureDir(newPath);
      }
    }

    if (laneIndex === -1) {
      boardConfig.lanes.push({ id: newId, items: [] });
    } else {
      boardConfig.lanes[laneIndex].id = newId;
    }
    await fs.writeJson(boardConfigPath, boardConfig);

    res.json({ id: newId, name: newId });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Delete Lane
app.delete("/api/boards/:boardId/lanes/:laneId", async (req, res) => {
  const { boardId, laneId } = req.params;
  const boardDir = path.join(DATA_DIR, boardId);
  const laneDir = path.join(boardDir, laneId);

  try {
    await fs.remove(laneDir);
    const boardConfigPath = path.join(boardDir, "config.json");
    if (await fs.pathExists(boardConfigPath)) {
      const boardConfig = await fs.readJson(boardConfigPath);
      boardConfig.lanes = boardConfig.lanes.filter((l: any) => l.id !== laneId);
      await fs.writeJson(boardConfigPath, boardConfig);
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Reorder Lanes
app.post("/api/boards/:boardId/lanes/reorder", async (req, res) => {
  const { boardId } = req.params;
  const { laneIds } = req.body;
  const boardConfigPath = path.join(DATA_DIR, boardId, "config.json");

  try {
    let boardConfig = { lanes: [] };
    if (await fs.pathExists(boardConfigPath)) {
      boardConfig = await fs.readJson(boardConfigPath);
    }
    const newLanes = laneIds.map((id: string) => {
      const existing = boardConfig.lanes.find((l: any) => l.id === id);
      return existing || { id, items: [] };
    });
    boardConfig.lanes = newLanes;
    await fs.writeJson(boardConfigPath, boardConfig);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Reorder Boards
app.post("/api/boards/reorder", async (req, res) => {
  const { boardIds } = req.body;
  try {
    const rootConfig = await fs.readJson(ROOT_CONFIG_PATH).catch(() => ({ boards: [] }));
    const newBoards = boardIds.map((id: string) => {
      const existing = rootConfig.boards.find((b: any) => b.id === id);
      return existing || { id, icon: "LayoutDashboard", color: "text-jungle-emerald" };
    });
    rootConfig.boards = newBoards;
    await fs.writeJson(ROOT_CONFIG_PATH, rootConfig);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Reorder Items
app.post("/api/boards/:boardId/lanes/:laneId/reorder", async (req, res) => {
  const { boardId, laneId } = req.params;
  const { itemIds } = req.body;
  const boardConfigPath = path.join(DATA_DIR, boardId, "config.json");

  try {
    let boardConfig = { lanes: [] };
    if (await fs.pathExists(boardConfigPath)) {
      boardConfig = await fs.readJson(boardConfigPath);
    }
    const lane = boardConfig.lanes.find((l: any) => l.id === laneId);
    if (lane) {
      lane.items = itemIds;
    } else {
      boardConfig.lanes.push({ id: laneId, items: itemIds });
    }
    await fs.writeJson(boardConfigPath, boardConfig);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// In-memory storage for the last active view mode
let lastActiveViewMode: any = "timeline";

app.get("/api/view-mode", (req, res) => {
  res.json({ viewMode: lastActiveViewMode });
});

app.post("/api/view-mode", (req, res) => {
  lastActiveViewMode = req.body.viewMode || "timeline";
  res.json({ success: true });
});

// Delete Item
app.delete("/api/boards/:boardId/lanes/:laneId/items/:itemId", async (req, res) => {
  const { boardId, laneId, itemId } = req.params;
  const itemPath = path.join(DATA_DIR, boardId, laneId, `${itemId}.md`);

  try {
    await fs.remove(itemPath);
    const boardConfigPath = path.join(DATA_DIR, boardId, "config.json");
    if (await fs.pathExists(boardConfigPath)) {
      const boardConfig = await fs.readJson(boardConfigPath);
      const lane = boardConfig.lanes.find((l: any) => l.id === laneId);
      if (lane) {
        lane.items = lane.items.filter((id: string) => id !== itemId);
        await fs.writeJson(boardConfigPath, boardConfig);
      }
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

async function startServer() {
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  // Watch for file changes
  const watcher = chokidar.watch(DATA_DIR, {
    ignored: /(^|[\/\\])\../, // ignore dotfiles
    persistent: true,
    ignoreInitial: true
  });

  watcher.on("all", (event, filePath) => {
    console.log(`File system event: ${event} on ${filePath}`);
    io.emit("fs-change", { event, path: filePath });
  });

  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
