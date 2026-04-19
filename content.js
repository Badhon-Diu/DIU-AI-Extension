// Content script for DIU IntelliMarks Extension
// This script runs on the marks sheet page

console.log('DIU IntelliMarks: Content script loaded');

// Listen for messages from popup
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === 'fillMarks') {
    fillMarksData(request.data, request.columnIndex, request.columnName)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, message: error.message }));
    return true; // Keep channel open for async response
  }
});

// Function to fill marks data - supports both old and new website
async function fillMarksData(data, columnIndex, columnName) {
  console.log('DIU IntelliMarks: Filling data', { data, columnIndex, columnName });

  // Find the table with student data
  const table = findMarksTable();
  if (!table) {
    return { success: false, message: 'No marks table found on this page' };
  }

  const tbody = table.querySelector('tbody');
  // If no tbody, use the table itself
  const rowsContainer = tbody || table;
  const rows = rowsContainer.querySelectorAll('tr');

  console.log('DIU IntelliMarks: Found', rows.length, 'rows');

  let filledCount = 0;
  let matchedCount = 0;

  for (const row of rows) {
    const cells = row.querySelectorAll('td');
    if (cells.length === 0) {
      console.log('DIU IntelliMarks: Skipping row - no td cells');
      continue;
    }

    // Get student ID from first column
    const studentIdCell = cells[0];
    const studentId = studentIdCell.textContent.trim();
    console.log('DIU IntelliMarks: Row student ID:', studentId, 'Available:', data[studentId]);

    // Check if we have data for this student
    if (data[studentId] !== undefined) {
      matchedCount++;
      console.log('DIU IntelliMarks: Match found for', studentId);

      // Get the target cell
      const targetCell = cells[columnIndex];

      if (targetCell) {
        const score = data[studentId];
        console.log('DIU IntelliMarks: Filling', score, 'at column', columnIndex);
        const filled = await fillCell(targetCell, score);
        if (filled) filledCount++;

        // Small delay between each cell
        await new Promise(resolve => setTimeout(resolve, 100));
      } else {
        console.log('DIU IntelliMarks: No target cell at column', columnIndex);
      }
    }
  }

  console.log(`DIU IntelliMarks: Matched ${matchedCount} students, filled ${filledCount} cells`);

  if (matchedCount === 0) {
    return { success: false, message: 'No matching students found. Make sure the Student IDs match exactly (e.g., 232-15-012).' };
  }

  return {
    success: true,
    filledCount: filledCount,
    message: `Filled ${filledCount} out of ${matchedCount} matched students`
  };
}

// Find the marks table on the page
function findMarksTable() {
  // Try to find table with student data
  const tables = document.querySelectorAll('table');
  console.log('DIU IntelliMarks: Found', tables.length, 'tables');

  for (const table of tables) {
    // Check if table has student ID pattern in tbody rows
    const tbody = table.querySelector('tbody');
    const rows = tbody ? tbody.querySelectorAll('tr') : table.querySelectorAll('tr');

    for (const row of rows) {
      const firstCell = row.querySelector('td');
      if (firstCell) {
        const text = firstCell.textContent.trim();
        console.log('DIU IntelliMarks: Checking cell text:', text);
        if (text.match(/^\d{3}-\d{2}-\d{3}$/)) {
          console.log('DIU IntelliMarks: Found table with student ID:', text);
          return table;
        }
      }
    }
  }

  // Fallback to first table if no specific match found
  console.log('DIU IntelliMarks: Using first table as fallback');
  return tables[0];
}

// Fill a single cell with the score - handles both old and new website formats
async function fillCell(cell, score) {
  console.log('DIU IntelliMarks: fillCell called with score:', score);

  // Method 1: New website - direct input element
  const input = cell.querySelector('input[type="number"]');
  if (input) {
    console.log('DIU IntelliMarks: Found number input, filling value');

    // Focus the input first
    input.focus();
    await new Promise(resolve => setTimeout(resolve, 50));

    // Clear and set value
    input.value = '';
    input.value = score.toString();

    // Trigger multiple events to ensure the website detects the change
    input.dispatchEvent(new Event('focus', { bubbles: true }));
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('keyup', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));

    // Blur to save
    input.blur();
    input.dispatchEvent(new Event('blur', { bubbles: true }));

    console.log('DIU IntelliMarks: Input filled with', score);
    return true;
  }

  // Method 2: Old website - editable-cell span
  const editableSpan = cell.querySelector('.editable-cell');
  if (editableSpan) {
    console.log('DIU IntelliMarks: Found editable-cell span');
    editableSpan.click();
    await new Promise(resolve => setTimeout(resolve, 50));

    // Check if input appeared after click
    const dynamicInput = cell.querySelector('input');
    if (dynamicInput) {
      dynamicInput.value = score;
      dynamicInput.dispatchEvent(new Event('input', { bubbles: true }));
      dynamicInput.dispatchEvent(new Event('change', { bubbles: true }));

      const enterEvent = new KeyboardEvent('keydown', {
        key: 'Enter',
        code: 'Enter',
        keyCode: 13,
        bubbles: true
      });
      dynamicInput.dispatchEvent(enterEvent);
    } else {
      editableSpan.textContent = score;
      editableSpan.dispatchEvent(new Event('blur', { bubbles: true }));
    }

    return true;
  }

  // Method 3: Try contenteditable
  if (cell.isContentEditable || cell.querySelector('[contenteditable="true"]')) {
    const editable = cell.isContentEditable ? cell : cell.querySelector('[contenteditable="true"]');
    editable.textContent = score;
    editable.dispatchEvent(new Event('blur', { bubbles: true }));
    return true;
  }

  console.log('DIU IntelliMarks: No input found in cell');
  return false;
}
