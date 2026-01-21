// Content script for CodeHS bulk delete functionality

function onElementReady(id, callback, interval = 100, timeout = 10000) {
    const end = Date.now() + timeout;
    const timer = setInterval(() => {
        const el = document.getElementById(id);
        if (el) {
            clearInterval(timer);
            callback(el);
        } else if (Date.now() > end) {
            clearInterval(timer);
            console.warn(`#${id} not found in time`);
        }
    }, interval);
}

function createDeleteButton(text = "Delete", onClick) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "btn btn-danger btn-sm";
    button.style.float = "right";
    button.innerHTML = `<span class="icon-trash"></span> ${text}`;
    button.addEventListener("click", (e) => {
        e.preventDefault();
        onClick();
    });
    return button;
}

function getCSRFToken() {
    const token = document.cookie
        .split("; ")
        .find((row) => row.startsWith("csrftoken="));
    return token ? token.split("=")[1] : "";
}

function deleteProgram(programId, row) {
    const promis = fetch("https://codehs.com/library/ajax/delete_sandbox", {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "X-CSRFToken": getCSRFToken(),
        },
        body: `program=${programId}&method=delete_sandbox`,
    });
    row.remove();
    return promis
}

function setupTable(table) {
    if (table.dataset.enhanced === "true") return;
    table.dataset.enhanced = "true";

    const tbody = table.querySelector("tbody");
    if (!tbody) return;

    const rows = Array.from(tbody.rows);
    const headerRow = rows.find((row) =>
        Array.from(row.cells).every((cell) => cell.tagName === "TH")
    );
    if (!headerRow) return;

    // Avoid duplicate setup
    if (headerRow.querySelector("input[type=checkbox]")) return;

    // Add Select-All checkbox
    const selectAllTh = document.createElement("th");
    const selectAllCheckbox = document.createElement("input");
    selectAllCheckbox.type = "checkbox";
    selectAllTh.appendChild(selectAllCheckbox);
    headerRow.insertBefore(selectAllTh, headerRow.firstChild);

    const deleteSelectedButton = createDeleteButton("Delete Selected", () => {
        const selected = tbody.querySelectorAll(".sandbox-checkbox:checked");
        const promisses = []
        selected.forEach((checkbox) => {
            const row = checkbox.closest("tr");
            if (!row) return;
            const id = row.getAttribute("data-program-id");
            if (!id) return;
            promisses.push(deleteProgram(Number(id), row))
        });
        Promise.all(promisses).then( () => 
            window.location.reload()
        )
    });
    deleteSelectedButton.classList.add("sandbox-delete-button");
    deleteSelectedButton.disabled = true;
    const deleteTh = document.createElement("th");
    deleteTh.style.padding = "0.5rem";
    deleteTh.appendChild(deleteSelectedButton);
    headerRow.appendChild(deleteTh);

    function updateDeleteSelectedState() {
        if (!tbody) return;
        const anyChecked = tbody.querySelector(".sandbox-checkbox:checked");
        deleteSelectedButton.disabled = !anyChecked;
    }

    selectAllCheckbox.addEventListener("change", (e) => {
        const checkboxes = tbody.querySelectorAll(".sandbox-checkbox");
        const target = e.target;
        if (!target) return;
        checkboxes.forEach((cb) => {
            cb.checked = target.checked;
        });
        updateDeleteSelectedState();
    });

    function enhanceRow(row) {
        if (row.querySelector(".sandbox-checkbox")) return;

        // Add individual checkbox
        const checkboxTd = document.createElement("td");
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.className = "sandbox-checkbox";
        checkbox.addEventListener("change", updateDeleteSelectedState);
        checkboxTd.appendChild(checkbox);
        row.insertBefore(checkboxTd, row.firstChild);

        // Add row delete button
        const programId = row.getAttribute("data-program-id");
        const deleteBtn = createDeleteButton("Delete", () => {
            if (programId !== null) {
                deleteProgram(Number(programId), row);
            }
        });
        const deleteTd = document.createElement("td");
        deleteTd.appendChild(deleteBtn);
        row.appendChild(deleteTd);
    }

    // Enhance all initial rows
    rows.forEach((row) => {
        if (row !== headerRow) {
            enhanceRow(row);
        }
    });
}

// Main execution - Monitor DOM changes and setup tables when they appear
(() => {
    let lastContent = document.documentElement.innerHTML;
    let debounceTimer;
    const DEBOUNCE_DELAY_MS = 300;

    // Debounce function to avoid checking content too frequently
    const scheduleContentCheck = () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(checkAndSetupTables, DEBOUNCE_DELAY_MS);
    };

    // Observe DOM mutations and trigger debounced check
    const observer = new MutationObserver(scheduleContentCheck);
    observer.observe(document.documentElement, {
        subtree: true,
        childList: true,
    });

    // Check if page content changed and setup CodeHS tables if found
    const checkAndSetupTables = () => {
        let currentContent = document.documentElement.innerHTML;
        if (currentContent !== lastContent) {
            lastContent = currentContent;
            // Setup bulk delete for both folder and program tables
            ["sandbox-folder-table", "sandbox-program-table"].forEach((id) => {
                onElementReady(id, (el) => setupTable(el));
            });
        }
    };
})();
