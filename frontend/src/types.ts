export type RecipeListItem = {
  id: number;
  title: string;
  category: string;
  description: string;
  servings: number;
  prepTimeMin: number;
  cookTimeMin: number;
  photoUrl: string | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
};

export type Ingredient = {
  section: string;
  name: string;
  amount: string;
  unit: string;
};

export type RecipeDetail = {
  id: number;
  title: string;
  category: string;
  description: string;
  servings: number;
  prepTimeMin: number;
  cookTimeMin: number;
  photoUrl: string | null;
  ingredients: Ingredient[];
  steps: string[];
  tags: string[];
  createdAt: string;
  updatedAt: string;
};

export type RecipePayload = {
  title: string;
  category: string;
  description: string;
  servings: number;
  prepTimeMin: number;
  cookTimeMin: number;
  photoUrl: string | null;
  ingredients: Ingredient[];
  steps: string[];
  tags: string[];
};
