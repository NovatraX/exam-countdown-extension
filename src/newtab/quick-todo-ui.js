import {
  getTodos,
  addTodo,
  toggleTodo,
  deleteTodo,
  getTodosStats,
} from "../utils/todos.js";

/**
 * Initialize quick todo UI on new tab
 */
export async function initializeQuickTodoUI() {
  await renderQuickTodos();
  initializeQuickTodoForm();

  // Listen for storage changes to update todos in real-time
  if (
    typeof chrome !== "undefined" &&
    chrome.storage &&
    chrome.storage.onChanged
  ) {
    chrome.storage.onChanged.addListener((changes, namespace) => {
      if (namespace === "sync" && changes.todos) {
        renderQuickTodos();
      }
    });
  }
}

/**
 * Initialize quick todo form
 */
function initializeQuickTodoForm() {
  const form = document.getElementById("quick-add-todo-form");
  const input = document.getElementById("quick-todo-input");

  if (form && input) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const text = input.value.trim();

      if (text) {
        try {
          await addTodo(text);
          input.value = "";
          renderQuickTodos();
        } catch (error) {
          console.error("Error adding quick todo:", error);
        }
      }
    });
  }
}

/**
 * Render quick todos on new tab
 */
async function renderQuickTodos() {
  const todosList = document.getElementById("quick-todos-list");
  const emptyState = document.getElementById("quick-empty-state");

  if (!todosList) return;

  const todos = await getTodos();

  // Clear existing todos
  const todoItems = todosList.querySelectorAll(".quick-todo-item");
  todoItems.forEach((item) => item.remove());

  if (todos.length === 0) {
    if (emptyState) emptyState.classList.remove("hidden");
    return;
  }

  if (emptyState) emptyState.classList.add("hidden");

  // Render todos (most recent first, limit to show reasonable amount)
  const todosToShow = todos.slice(-8).reverse();
  todosToShow.forEach((todo) => {
    const todoElement = createQuickTodoElement(todo);
    todosList.appendChild(todoElement);
  });
}

/**
 * Create a quick todo element for new tab
 * @param {Object} todo - Todo object
 * @returns {HTMLElement} Todo element
 */
function createQuickTodoElement(todo) {
  const div = document.createElement("div");
  div.className =
    "quick-todo-item flex items-center gap-2 p-2 bg-black/20 backdrop-blur-sm rounded border border-white/20 transition-all hover:bg-black/30";
  div.dataset.todoId = todo.id;

  // Checkbox
  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.className = "checkbox checkbox-primary checkbox-sm flex-shrink-0";
  checkbox.checked = todo.completed;
  checkbox.addEventListener("change", async () => {
    await toggleTodo(todo.id);
    renderQuickTodos();
  });

  // Todo text
  const textSpan = document.createElement("span");
  textSpan.className = `text-sm flex-1 text-white ${
    todo.completed ? "line-through opacity-50" : ""
  }`;
  textSpan.textContent =
    todo.text.length > 30 ? todo.text.substring(0, 30) + "..." : todo.text;
  textSpan.title = todo.text; // Show full text on hover

  // Delete button
  const deleteBtn = document.createElement("button");
  deleteBtn.className =
    "btn btn-ghost btn-circle btn-xs text-white/70 hover:text-error flex-shrink-0";
  deleteBtn.title = "Delete todo";
  deleteBtn.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-3 h-3">
      <path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
    </svg>
  `;
  deleteBtn.addEventListener("click", async () => {
    await deleteTodo(todo.id);
    renderQuickTodos();
  });

  div.appendChild(checkbox);
  div.appendChild(textSpan);
  div.appendChild(deleteBtn);

  return div;
}
