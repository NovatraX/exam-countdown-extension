import browser from "webextension-polyfill";

// Todo storage key
const TODOS_STORAGE_KEY = "todos";

/**
 * Get all todos from storage
 * @returns {Promise<Array>} Array of todo objects
 */
export async function getTodos() {
  try {
    const data = await browser.storage.sync.get(TODOS_STORAGE_KEY);
    return data[TODOS_STORAGE_KEY] || [];
  } catch (error) {
    console.error("Error loading todos:", error);
    return [];
  }
}

/**
 * Save todos to storage
 * @param {Array} todos - Array of todo objects
 * @returns {Promise<boolean>} Success status
 */
export async function saveTodos(todos) {
  try {
    await browser.storage.sync.set({ [TODOS_STORAGE_KEY]: todos });
    return true;
  } catch (error) {
    console.error("Error saving todos:", error);
    return false;
  }
}

/**
 * Add a new todo
 * @param {string} text - Todo text
 * @returns {Promise<Object>} The created todo object
 */
export async function addTodo(text) {
  if (!text || text.trim() === "") {
    throw new Error("Todo text cannot be empty");
  }

  const todos = await getTodos();
  const newTodo = {
    id: Date.now().toString(),
    text: text.trim(),
    completed: false,
    createdAt: new Date().toISOString(),
  };

  todos.push(newTodo);
  await saveTodos(todos);
  return newTodo;
}

/**
 * Toggle todo completion status
 * @param {string} id - Todo ID
 * @returns {Promise<boolean>} Success status
 */
export async function toggleTodo(id) {
  const todos = await getTodos();
  const todo = todos.find((t) => t.id === id);

  if (todo) {
    todo.completed = !todo.completed;
    await saveTodos(todos);
    return true;
  }

  return false;
}

/**
 * Delete a todo
 * @param {string} id - Todo ID
 * @returns {Promise<boolean>} Success status
 */
export async function deleteTodo(id) {
  const todos = await getTodos();
  const filteredTodos = todos.filter((t) => t.id !== id);

  if (filteredTodos.length !== todos.length) {
    await saveTodos(filteredTodos);
    return true;
  }

  return false;
}

/**
 * Mark all todos as completed
 * @returns {Promise<boolean>} Success status
 */
export async function markAllCompleted() {
  const todos = await getTodos();
  const updatedTodos = todos.map((todo) => ({ ...todo, completed: true }));
  await saveTodos(updatedTodos);
  return true;
}

/**
 * Delete all todos
 * @returns {Promise<boolean>} Success status
 */
export async function clearAllTodos() {
  await saveTodos([]);
  return true;
}

/**
 * Get todos statistics
 * @returns {Promise<Object>} Statistics object
 */
export async function getTodosStats() {
  const todos = await getTodos();
  return {
    total: todos.length,
    completed: todos.filter((t) => t.completed).length,
    pending: todos.filter((t) => !t.completed).length,
  };
}
