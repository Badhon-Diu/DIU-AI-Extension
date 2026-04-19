// Content script for DIU Marks Auto-Fill Extension
// This script runs on the marks sheet page

console.log('DIU Marks Auto-Fill: Content script loaded');

// Listen for messages from popup
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === 'fillMarks') {
    fillMarksData(request.data, request.columnIndex, request.columnName)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, message: error.message }));
    return true; // Keep channel open for async response
  }
});

// Function to fill marks data
async function fillMarksData(data, columnIndex, columnName) {
  console.log('DIU Marks Auto-Fill: Filling data', { data, columnIndex, columnName });
  
  // Find the table
  const table = document.querySelector('table');
  if (!table) {
    return { success: false, message: 'No table found on this page' };
  }

  const tbody = table.querySelector('tbody');
  if (!tbody) {
    return { success: false, message: 'No table body found' };
  }

  const rows = tbody.querySelectorAll('tr');
  let filledCount = 0;
  let matchedCount = 0;

  for (const row of rows) {
    const cells = row.querySelectorAll('td');
    if (cells.length === 0) continue;

    // Get student ID from first column
    const studentIdCell = cells[0];
    const studentId = studentIdCell.textContent.trim();

    // Check if we have data for this student
    if (data[studentId] !== undefined) {
      matchedCount++;
      
      // Get the target cell (columnIndex is 0-based, cells are also 0-based)
      const targetCell = cells[columnIndex];
      
      if (targetCell) {
        // Find the editable span inside the cell
        const editableSpan = targetCell.querySelector('.editable-cell');
        
        if (editableSpan) {
          const score = data[studentId];
          
          // Simulate clicking the cell to make it editable
          editableSpan.click();
          
          // Wait a moment for the cell to become editable
          await new Promise(resolve => setTimeout(resolve, 50));
          
          // Check if it became an input
          const input = targetCell.querySelector('input');
          
          if (input) {
            // Set the value
            input.value = score;
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
            
            // Simulate Enter key to save
            const enterEvent = new KeyboardEvent('keydown', {
              key: 'Enter',
              code: 'Enter',
              keyCode: 13,
              bubbles: true
            });
            input.dispatchEvent(enterEvent);
            
            filledCount++;
          } else {
            // If no input appeared, try setting text content directly
            editableSpan.textContent = score;
            
            // Trigger any necessary events
            editableSpan.dispatchEvent(new Event('blur', { bubbles: true }));
            
            filledCount++;
          }
          
          // Small delay between each cell to avoid overwhelming the page
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
    }
  }

  console.log(`DIU Marks Auto-Fill: Matched ${matchedCount} students, filled ${filledCount} cells`);

  if (matchedCount === 0) {
    return { success: false, message: 'No matching students found. Make sure the Student IDs match exactly (e.g., 232-15-012).' };
  }

  return { 
    success: true, 
    filledCount: filledCount,
    message: `Filled ${filledCount} out of ${matchedCount} matched students`
  };
}

// Also inject a floating button on the page for quick access
function injectFloatingButton() {
  // Check if button already exists
  if (document.getElementById('diu-marks-autofill-btn')) return;

  const btn = document.createElement('button');
  btn.id = 'diu-marks-autofill-btn';
  btn.innerHTML = `
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M13 10V3L4 14h7v7l9-11h-7z"/>
    </svg>
    <span>Auto-Fill Marks</span>
  `;
  btn.onclick = function() {
    // Open the extension popup
    chrome.runtime.sendMessage({ action: 'openPopup' });
  };
  
  document.body.appendChild(btn);
}

// Try to inject button when page loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', injectFloatingButton);
} else {
  injectFloatingButton();
}
