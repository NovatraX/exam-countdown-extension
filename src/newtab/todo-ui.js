import {
  getTodos,
  addTodo,
  toggleTodo,
  deleteTodo,
  markAllCompleted,
  clearAllTodos,
  getTodosStats,
} from "../utils/todos.js";

/**
 * Initialize todo UI and event listeners
 */
export function initializeTodoUI() {
  const todoBtn = document.getElementById("todo-btn");
  const todoModal = document.getElementById("todo-modal");
  const addTodoForm = document.getElementById("add-todo-form");
  const todoInput = document.getElementById("todo-input");
  const markAllDoneBtn = document.getElementById("mark-all-done-btn");
  const clearAllBtn = document.getElementById("clear-all-btn");

  // Open todo modal
  if (todoBtn && todoModal) {
    todoBtn.addEventListener("click", () => {
      todoModal.showModal();
      renderTodos();
      todoInput.focus();
    });
  }

  // Add todo form submission
  if (addTodoForm) {
    addTodoForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const text = todoInput.value.trim();

      if (text) {
        try {
          await addTodo(text);
          todoInput.value = "";
          renderTodos();
          showToast("Todo added successfully!", "success");
        } catch (error) {
          showToast(error.message, "error");
        }
      }
    });
  }

  // Keyboard shortcut: Ctrl+Enter to add todo
  if (todoInput) {
    todoInput.addEventListener("keydown", (e) => {
      if (e.ctrlKey && e.key === "Enter") {
        addTodoForm.dispatchEvent(new Event("submit"));
      }
    });
  }

  // Mark all as done
  if (markAllDoneBtn) {
    markAllDoneBtn.addEventListener("click", async () => {
      const confirmed = confirm("Mark all todos as completed?");
      if (confirmed) {
        await markAllCompleted();
        renderTodos();
        showToast("All todos marked as done!", "success");
      }
    });
  }

  // Clear all todos
  if (clearAllBtn) {
    clearAllBtn.addEventListener("click", async () => {
      const confirmed = confirm(
        "Delete all todos? This action cannot be undone."
      );
      if (confirmed) {
        await clearAllTodos();
        renderTodos();
        showToast("All todos cleared!", "info");
      }
    });
  }
}

/**
 * Render all todos to the DOM
 */
async function renderTodos() {
  const todosContainer = document.getElementById("todos-container");
  const emptyState = document.getElementById("empty-state");

  if (!todosContainer) return;

  const todos = await getTodos();

  // Clear container except empty state
  const todoItems = todosContainer.querySelectorAll(".todo-item");
  todoItems.forEach((item) => item.remove());

  if (todos.length === 0) {
    if (emptyState) emptyState.classList.remove("hidden");
    updateStats();
    return;
  }

  if (emptyState) emptyState.classList.add("hidden");

  // Render todos
  todos.forEach((todo) => {
    const todoElement = createTodoElement(todo);
    todosContainer.appendChild(todoElement);
  });

  updateStats();
}

/**
 * Create a todo element
 * @param {Object} todo - Todo object
 * @returns {HTMLElement} Todo element
 */
function createTodoElement(todo) {
  const div = document.createElement("div");
  div.className =
    "todo-item flex items-center gap-3 p-3 bg-base-100 rounded-lg border border-base-300 transition-all hover:shadow-md";
  div.dataset.todoId = todo.id;

  // Checkbox
  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.className = "checkbox checkbox-primary flex-shrink-0";
  checkbox.checked = todo.completed;
  checkbox.addEventListener("change", async () => {
    await toggleTodo(todo.id);
    renderTodos();
  });

  // Todo text
  const textSpan = document.createElement("span");
  textSpan.className = `flex-1 ${
    todo.completed ? "line-through opacity-50" : ""
  }`;
  textSpan.textContent = todo.text;

  // Delete button
  const deleteBtn = document.createElement("button");
  deleteBtn.className =
    "btn btn-ghost btn-circle btn-sm text-error flex-shrink-0";
  deleteBtn.title = "Delete todo";
  deleteBtn.innerHTML = `
		<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5">
			<path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
		</svg>
	`;
  deleteBtn.addEventListener("click", async () => {
    await deleteTodo(todo.id);
    renderTodos();
    showToast("Todo deleted!", "info");
  });

  div.appendChild(checkbox);
  div.appendChild(textSpan);
  div.appendChild(deleteBtn);

  return div;
}

/**
 * Update todo statistics
 */
async function updateStats() {
  const statsText = document.getElementById("stats-text");
  if (!statsText) return;

  const stats = await getTodosStats();

  if (stats.total === 0) {
    statsText.textContent = "No tasks";
  } else {
    statsText.textContent = `${stats.total} task${
      stats.total > 1 ? "s" : ""
    } • ${stats.completed} completed • ${stats.pending} pending`;
  }
}

/**
 * Show toast notification
 * @param {string} message - Message to display
 * @param {string} type - Toast type (success, error, info)
 */
function showToast(message, type = "info") {
  // Create toast element
  const toast = document.createElement("div");
  toast.className = `alert alert-${type} fixed bottom-4 right-4 w-auto max-w-sm shadow-lg z-50 flex items-center gap-2`;
  toast.style.animation = "slideIn 0.3s ease-out";

  let icon = "";
  switch (type) {
    case "success":
      icon = `<svg xmlns="http://www.w3.org/2000/svg" class="stroke-current flex-shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>`;
      break;
    case "error":
      icon = `<svg xmlns="http://www.w3.org/2000/svg" class="stroke-current flex-shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>`;
      break;
    default:
      icon = `<svg xmlns="http://www.w3.org/2000/svg" class="stroke-current flex-shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>`;
  }

  toast.innerHTML = `${icon}<span>${message}</span>`;

  document.body.appendChild(toast);

  // Auto remove after 3 seconds
  setTimeout(() => {
    toast.style.animation = "slideOut 0.3s ease-in";
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// Add CSS animations
const style = document.createElement("style");
style.textContent = `
	@keyframes slideIn {
		from {
			transform: translateX(100%);
			opacity: 0;
		}
		to {
			transform: translateX(0);
			opacity: 1;
		}
	}
	
	@keyframes slideOut {
		from {
			transform: translateX(0);
			opacity: 1;
		}
		to {
			transform: translateX(100%);
			opacity: 0;
		}
	}
`;
document.head.appendChild(style);
