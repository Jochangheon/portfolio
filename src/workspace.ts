export type Folder = { id: string; name: string; parentId: string | null };
export type Note = {
  folderId: string | null; body: string; pinned: boolean; archived: boolean;
  updated: string; version: number;
};
export type WorkspaceEntry = {
  id: string; title: string; type: string; published: boolean; revision: number;
  folderId: string | null; pinned: boolean; archived: boolean; updated: string;
  excerpt: string; searchText: string;
};
export type WorkspaceIndex = { folders: Folder[]; pages: WorkspaceEntry[] };
export function folderOptions(folders: Folder[]) {
  const result: {id:string; label:string}[] = [];
  function walk(parentId: string | null, depth: number) {
    for (const folder of folders.filter(item => item.parentId === parentId)) {
      result.push({id: folder.id, label: "　".repeat(depth) + folder.name});
      walk(folder.id, depth + 1);
    }
  }
  walk(null, 0);
  return result;
}
export const workspacePath = (id: string) => "/workspace/pages/" + encodeURIComponent(id);
