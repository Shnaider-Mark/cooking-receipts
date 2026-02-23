import type { RecipeDetail, RecipeListItem, RecipePayload } from "./types";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, init);
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({ error: "Request failed" }))) as { error?: string };
    throw new Error(payload.error ?? "Ошибка запроса");
  }
  return (await response.json()) as T;
}

export function getImageUrl(url: string | null): string | null {
  if (!url) {
    return null;
  }
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }
  return `${API_BASE}${url}`;
}

export async function fetchRecipes(params: { q?: string; tag?: string; category?: string }) {
  const query = new URLSearchParams();
  if (params.q) {
    query.set("q", params.q);
  }
  if (params.tag) {
    query.set("tag", params.tag);
  }
  if (params.category) {
    query.set("category", params.category);
  }
  return request<RecipeListItem[]>(`/recipes?${query.toString()}`);
}

export async function fetchRecipe(id: number) {
  return request<RecipeDetail>(`/recipes/${id}`);
}

export async function createRecipe(payload: RecipePayload) {
  return request<{ id: number }>("/recipes", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });
}

export async function updateRecipe(id: number, payload: RecipePayload) {
  return request<{ ok: true }>(`/recipes/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });
}

export async function deleteRecipe(id: number) {
  return request<{ ok: true }>(`/recipes/${id}`, {
    method: "DELETE"
  });
}

export async function uploadPhoto(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("photo", file);
  const response = await request<{ url: string }>("/uploads/photo", {
    method: "POST",
    body: formData
  });
  return response.url;
}
