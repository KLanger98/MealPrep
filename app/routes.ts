import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("recipes", "routes/recipes/index.tsx"),
  route("recipes/new", "routes/recipes/new.tsx"),
  route("recipes/:slug", "routes/recipes/show.tsx"),
  route("recipes/:slug/edit", "routes/recipes/edit.tsx"),
  route("recipes/:slug/image", "routes/recipes/image.tsx"),
  route("calendar", "routes/calendar.tsx"),
  route("assignments", "routes/assignments.tsx"),
  route("assignments/batch/:batchId", "routes/assignments.batch.tsx"),
  route("assignments/:id", "routes/assignments.day.tsx"),
  route("shopping-lists", "routes/shopping-lists/index.tsx"),
  route("shopping-lists/:id", "routes/shopping-lists/show.tsx"),
  route("sync", "routes/sync.tsx"),
] satisfies RouteConfig;
