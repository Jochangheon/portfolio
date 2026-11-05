import { projects, type Project } from "../portfolio.ts";

export const categories = [
  { label: "전체", path: "/records" },
  { label: "프로젝트", path: "/records/projects" },
  { label: "실험 노트", path: "/records/experiments" },
  { label: "스킬·워크플로", path: "/records/workflows" },
] as const;
export const recordPath = (id: string) => "/records/" + encodeURIComponent(id);
export const editorPath = (id: string, preview = false) =>
  "/admin/records/" + encodeURIComponent(id) + (preview ? "/preview" : "/edit");
export type Route =
  | { page: "home" | "ai" | "career" | "projects" | "approach" | "example" | "not-found" }
  | { page: "project"; project: Project }
  | { page: "atlas"; admin: boolean }
  | { page: "records"; category: string }
  | { page: "detail"; id: string }
  | { page: "admin"; id?: string; mode: "index" | "new" | "edit" | "preview" };
export function matchRoute(path: string): Route {
  path = path.replace(/\/$/, "") || "/";
  if (path === "/") return { page: "home" };
  if (path === "/ai") return { page: "ai" };
  if (path === "/career") return { page: "career" };
  if (path === "/projects") return { page: "projects" };
  if (path.startsWith("/projects/")) {
    const project = projects.find(item => path === "/projects/" + item.slug);
    return project ? { page: "project", project } : { page: "not-found" };
  }
  if (path === "/atlas" || path === "/admin/atlas") return {page:"atlas",admin:path.startsWith("/admin")};
  if (path === "/approach") return { page: "approach" };
  if (path === "/examples/workflow") return { page: "example" };
  const category = categories.find((x) => x.path === path);
  if (category) return { page: "records", category: category.label };
  if (path === "/admin") return { page: "admin", mode: "index" };
  if (path === "/admin/records/new") return { page: "admin", mode: "new" };
  const detail = path.match(/^\/records\/([a-zA-Z0-9_-]{1,128})$/);
  if (detail) return { page: "detail", id: detail[1] };
  const edit = path.match(/^\/admin\/records\/([a-zA-Z0-9_-]{1,128})\/(edit|preview)$/);
  if (edit) return { page: "admin", id: edit[1], mode: edit[2] as "edit" | "preview" };
  return { page: "not-found" };
}
