// Popup script for DIU Marks Auto-Fill Extension

document.addEventListener('DOMContentLoaded', function() {
  // Tab switching
  const tabs = document.querySelectorAll('.tab');
  const tabContents = document.querySelectorAll('.tab-content');
  
  tabs.forEach(tab => {
    tab.addEventListener('click', function() {
      const targetTab = this.getAttribute('data-tab');
      
      tabs.forEach(t => t.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));
      
      this.classList.add('active');
      document.getElementById(targetTab).classList.add('active');
    });
  });

  // ==================== AUDIO TAB (Manual Entry) ====================
  const columnSelect = document.getElementById('columnSelect');
  const dataInput = document.getElementById('dataInput');
  const saveBtn = document.getElementById('saveBtn');
  const fillBtn = document.getElementById('fillBtn');
  const clearBtn = document.getElementById('clearBtn');
  const exportBtn = document.getElementById('exportBtn');
  const saveStatus = document.getElementById('saveStatus');
  const actionStatus = document.getElementById('actionStatus');
  const savedDataPreview = document.getElementById('savedDataPreview');

  const columnMapping = {
    'attendance': 2, 'quiz1': 3, 'quiz2': 4, 'quiz3': 5,
    'presentation': 6, 'assignment': 7, 'midterm': 8, 'final': 9
  };

  loadSavedData();

  saveBtn.addEventListener('click', function() {
    const column = columnSelect.value;
    const inputText = dataInput.value.trim();
    
    if (!inputText) {
      showStatus(saveStatus, 'Please enter some data!', 'error');
      return;
    }

    const parsedData = parseInputData(inputText);
    
    if (Object.keys(parsedData).length === 0) {
      showStatus(saveStatus, 'No valid data found. Use format: StudentID: Score', 'error');
      return;
    }

    const storageKey = 'marks_' + column;
    chrome.storage.local.set({ [storageKey]: parsedData }, function() {
      showStatus(saveStatus, `Saved ${Object.keys(parsedData).length} student records!`, 'success');
      loadSavedData();
      dataInput.value = '';
    });
  });

  fillBtn.addEventListener('click', async function() {
    const column = columnSelect.value;
    const storageKey = 'marks_' + column;
    
    chrome.storage.local.get([storageKey], function(result) {
      const data = result[storageKey];
      
      if (!data || Object.keys(data).length === 0) {
        showStatus(actionStatus, 'No saved data for this column. Please save data first.', 'error');
        return;
      }

      chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
        if (tabs.length === 0) {
          showStatus(actionStatus, 'No active tab found!', 'error');
          return;
        }

        const columnIndex = columnMapping[column];
        
        chrome.tabs.sendMessage(tabs[0].id, {
          action: 'fillMarks',
          data: data,
          columnIndex: columnIndex,
          columnName: column
        }, function(response) {
          if (chrome.runtime.lastError) {
            showStatus(actionStatus, 'Error: ' + chrome.runtime.lastError.message, 'error');
            return;
          }
          
          if (response && response.success) {
            showStatus(actionStatus, `Successfully filled ${response.filledCount} student marks!`, 'success');
          } else {
            showStatus(actionStatus, response?.message || 'Failed to fill marks', 'error');
          }
        });
      });
    });
  });

  clearBtn.addEventListener('click', function() {
    if (confirm('Are you sure you want to clear all saved data?')) {
      chrome.storage.local.clear(function() {
        showStatus(actionStatus, 'All data cleared!', 'success');
        loadSavedData();
      });
    }
  });

  exportBtn.addEventListener('click', function() {
    chrome.storage.local.get(null, function(result) {
      const dataStr = JSON.stringify(result, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = 'diu-marks-data.json';
      a.click();
      
      URL.revokeObjectURL(url);
      showStatus(actionStatus, 'Data exported!', 'success');
    });
  });

  function loadSavedData() {
    chrome.storage.local.get(null, function(result) {
      let html = '';
      let hasData = false;
      
      const columnNames = {
        'marks_quiz1': 'Quiz 1', 'marks_quiz2': 'Quiz 2', 'marks_quiz3': 'Quiz 3',
        'marks_attendance': 'Attendance', 'marks_presentation': 'Presentation',
        'marks_assignment': 'Assignment', 'marks_midterm': 'Midterm', 'marks_final': 'Final'
      };

      for (const [key, value] of Object.entries(result)) {
        if (key.startsWith('marks_') && Object.keys(value).length > 0) {
          hasData = true;
          const columnName = columnNames[key] || key;
          const studentCount = Object.keys(value).length;
          
          html += `<div style="margin-bottom: 14px;">`;
          html += `<div style="font-weight: 600; color: #667eea; font-size: 13px; margin-bottom: 8px;">${columnName} (${studentCount} students)</div>`;
          
          for (const [studentId, score] of Object.entries(value)) {
            html += `<div class="student-item"><span class="student-id">${studentId}</span><span class="student-score">${score}</span></div>`;
          }
          html += `</div>`;
        }
      }

      savedDataPreview.innerHTML = hasData ? html : '<div class="empty-state">No data saved yet</div>';
    });
  }

  function parseInputData(text) {
    const data = {};
    const lines = text.split('\n');
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      
      const match = trimmed.match(/^(\d{3}-\d{2}-\d{3})[:\s,]+(\d+(?:\.\d+)?)$/);
      
      if (match) {
        const studentId = match[1];
        const score = parseFloat(match[2]);
        data[studentId] = score;
      }
    }
    
    return data;
  }

  // ==================== VOICE WITH AI TAB ====================
  const voiceAssessmentType = document.getElementById('voiceAssessmentType');
  const voiceRecordBtn = document.getElementById('voiceRecordBtn');
  const recordingIndicator = document.getElementById('recordingIndicator');
  const voiceRecordCard = document.getElementById('voiceRecordCard');
  const voiceProcessingCard = document.getElementById('voiceProcessingCard');
  const voiceChatCard = document.getElementById('voiceChatCard');
  const voiceChatContainer = document.getElementById('voiceChatContainer');
  const voiceResultsCard = document.getElementById('voiceResultsCard');
  const voiceAiResultsContent = document.getElementById('voiceAiResultsContent');
  const voiceMismatchSection = document.getElementById('voiceMismatchSection');
  const voiceMismatchList = document.getElementById('voiceMismatchList');
  const voiceFillAIBtn = document.getElementById('voiceFillAIBtn');
  const voiceResetBtn = document.getElementById('voiceResetBtn');
  const voiceStatus = document.getElementById('voiceStatus');
  const manualToggle = document.getElementById('manualToggle');
  const manualSection = document.getElementById('manualSection');

  let voiceAiResults = {};
  let isRecording = false;

  // Manual section toggle
  if (manualToggle) {
    manualToggle.addEventListener('click', function() {
      const isHidden = manualSection.style.display === 'none';
      manualSection.style.display = isHidden ? 'block' : 'none';
      manualToggle.textContent = isHidden ? '⌨️ Manual Entry (Click to collapse)' : '⌨️ Manual Entry (Click to expand)';
    });
  }

  // Voice record button click
  if (voiceRecordBtn) {
    voiceRecordBtn.addEventListener('click', function() {
      const assessment = voiceAssessmentType.value;
      
      if (!assessment) {
        showStatus(voiceStatus, 'Please select an assessment type first!', 'error');
        return;
      }

      if (!isRecording) {
        // Start recording
        isRecording = true;
        voiceRecordBtn.classList.add('recording');
        voiceRecordBtn.querySelector('.voice-text').textContent = 'Recording...';
        voiceRecordBtn.querySelector('.voice-subtext').textContent = 'Click to stop';
        recordingIndicator.classList.remove('hidden');
      } else {
        // Stop recording and process
        isRecording = false;
        voiceRecordBtn.classList.remove('recording');
        voiceRecordBtn.querySelector('.voice-text').textContent = 'Voice with AI';
        voiceRecordBtn.querySelector('.voice-subtext').textContent = 'Click to start recording';
        recordingIndicator.classList.add('hidden');
        
        // Show processing
        voiceRecordCard.classList.add('hidden');
        voiceProcessingCard.classList.remove('hidden');
        
        // Simulate processing delay
        setTimeout(() => {
          voiceProcessingCard.classList.add('hidden');
          voiceChatCard.classList.remove('hidden');
          
          // Generate AI results based on assessment type
          generateVoiceAIResults(assessment);
          
          // Show results after chat animation
          setTimeout(() => {
            voiceChatCard.classList.add('hidden');
            voiceResultsCard.classList.remove('hidden');
            displayVoiceAIResults();
          }, 2000);
        }, 3000);
      }
    });
  }

  // Generate AI results for voice
  function generateVoiceAIResults(assessment) {
    voiceAiResults = {};
    
    // Get max marks based on assessment
    let maxMarks;
    switch(assessment) {
      case 'quiz1': 
      case 'quiz2': 
      case 'quiz3': maxMarks = 15; break;
      case 'assignment': maxMarks = 5; break;
      case 'midterm': maxMarks = 25; break;
      case 'final': maxMarks = 40; break;
      default: maxMarks = 15;
    }
    
    // Generate random marks for valid student IDs
    validStudentIds.forEach(id => {
      const randomMark = Math.floor(Math.random() * (maxMarks + 1));
      voiceAiResults[id] = randomMark;
    });
    
    // Add some mismatched IDs
    const extraIds = ['232-15-999', '232-15-888'];
    extraIds.forEach(id => {
      voiceAiResults[id] = Math.floor(Math.random() * (maxMarks + 1));
    });
  }

  // Display voice AI results
  function displayVoiceAIResults() {
    const matchedIds = Object.keys(voiceAiResults).filter(id => validStudentIds.includes(id));
    const mismatchedIds = Object.keys(voiceAiResults).filter(id => !validStudentIds.includes(id));

    // Display matched results
    voiceAiResultsContent.innerHTML = matchedIds.map(id => `
      <div class="result-item">
        <span class="result-id">${id}</span>
        <span class="result-score">${voiceAiResults[id]}</span>
      </div>
    `).join('');

    // Display mismatched IDs
    if (mismatchedIds.length > 0) {
      voiceMismatchSection.classList.remove('hidden');
      voiceMismatchList.innerHTML = mismatchedIds.map(id => `
        <span class="mismatch-item">${id}</span>
      `).join('');
    } else {
      voiceMismatchSection.classList.add('hidden');
    }
  }

  // Fill AI results from voice
  if (voiceFillAIBtn) {
    voiceFillAIBtn.addEventListener('click', function() {
      const assessment = voiceAssessmentType.value;
      
      // Filter only matched IDs
      const matchedData = {};
      Object.keys(voiceAiResults).forEach(id => {
        if (validStudentIds.includes(id)) {
          matchedData[id] = voiceAiResults[id];
        }
      });

      // Save to storage
      const storageKey = 'marks_' + assessment;
      chrome.storage.local.set({ [storageKey]: matchedData }, function() {
        showStatus(voiceStatus, `Saved ${Object.keys(matchedData).length} AI voice records!`, 'success');
        loadSavedData();
        
        // Auto-fill on page
        chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
          if (tabs.length > 0) {
            const columnIndex = columnMapping[assessment];
            chrome.tabs.sendMessage(tabs[0].id, {
              action: 'fillMarks',
              data: matchedData,
              columnIndex: columnIndex,
              columnName: assessment
            }, function(response) {
              if (response && response.success) {
                showStatus(voiceStatus, `Successfully filled ${response.filledCount} marks from voice AI!`, 'success');
              }
            });
          }
        });
      });
    });
  }

  // Reset voice recording
  if (voiceResetBtn) {
    voiceResetBtn.addEventListener('click', function() {
      voiceAiResults = {};
      voiceResultsCard.classList.add('hidden');
      voiceRecordCard.classList.remove('hidden');
      voiceAssessmentType.value = '';
    });
  }

  // ==================== QR SCAN TAB ====================
  const qrAssessmentType = document.getElementById('qrAssessmentType');
  const startScanBtn = document.getElementById('startScanBtn');
  const qrDisplayCard = document.getElementById('qrDisplayCard');
  const qrProcessingCard = document.getElementById('qrProcessingCard');
  const qrResultsCard = document.getElementById('qrResultsCard');
  const qrCode = document.getElementById('qrCode');
  const scanStatus = document.getElementById('scanStatus');
  const timerContainer = document.getElementById('timerContainer');
  const timerCountdown = document.getElementById('timerCountdown');
  const timerProgress = document.getElementById('timerProgress');
  const qrAiResultsContent = document.getElementById('qrAiResultsContent');
  const qrMismatchSection = document.getElementById('qrMismatchSection');
  const qrMismatchList = document.getElementById('qrMismatchList');
  const qrFillAIBtn = document.getElementById('qrFillAIBtn');
  const qrResetBtn = document.getElementById('qrResetBtn');
  const qrStatus = document.getElementById('qrStatus');

  let qrAiResults = {};
  let scanTimer = null;
  let countdownValue = 10;

  // Start QR Scan
  if (startScanBtn) {
    startScanBtn.addEventListener('click', function() {
      const assessment = qrAssessmentType.value;
      
      if (!assessment) {
        showStatus(qrStatus, 'Please select an assessment type first!', 'error');
        return;
      }

      // Start scanning
      startScanBtn.classList.add('hidden');
      timerContainer.classList.remove('hidden');
      scanStatus.textContent = 'Scanning QR code...';
      scanStatus.classList.add('scanning');
      qrCode.classList.add('qr-scanned');

      // Start countdown
      countdownValue = 10;
      timerCountdown.textContent = countdownValue;
      timerProgress.style.width = '100%';

      scanTimer = setInterval(() => {
        countdownValue--;
        timerCountdown.textContent = countdownValue;
        timerProgress.style.width = (countdownValue / 10 * 100) + '%';

        if (countdownValue <= 0) {
          clearInterval(scanTimer);
          completeScan(assessment);
        }
      }, 1000);
    });
  }

  // Complete scan and show processing
  function completeScan(assessment) {
    scanStatus.textContent = 'Scan complete!';
    scanStatus.classList.remove('scanning');
    scanStatus.classList.add('complete');

    // Show processing
    setTimeout(() => {
      qrDisplayCard.classList.add('hidden');
      qrProcessingCard.classList.remove('hidden');

      // Generate AI results
      generateQRResults(assessment);

      // Show results after processing
      setTimeout(() => {
        qrProcessingCard.classList.add('hidden');
        qrResultsCard.classList.remove('hidden');
        displayQRResults();
      }, 2000);
    }, 500);
  }

  // Generate QR scan results
  function generateQRResults(assessment) {
    qrAiResults = {};

    // Get max marks based on assessment
    let maxMarks;
    switch(assessment) {
      case 'quiz1':
      case 'quiz2':
      case 'quiz3': maxMarks = 15; break;
      case 'assignment': maxMarks = 5; break;
      case 'midterm': maxMarks = 25; break;
      case 'final': maxMarks = 40; break;
      default: maxMarks = 15;
    }

    // Generate random marks for valid student IDs
    validStudentIds.forEach(id => {
      const randomMark = Math.floor(Math.random() * (maxMarks + 1));
      qrAiResults[id] = randomMark;
    });

    // Add some mismatched IDs
    const extraIds = ['232-15-999', '232-15-888'];
    extraIds.forEach(id => {
      qrAiResults[id] = Math.floor(Math.random() * (maxMarks + 1));
    });
  }

  // Display QR scan results
  function displayQRResults() {
    const matchedIds = Object.keys(qrAiResults).filter(id => validStudentIds.includes(id));
    const mismatchedIds = Object.keys(qrAiResults).filter(id => !validStudentIds.includes(id));

    // Display matched results
    qrAiResultsContent.innerHTML = matchedIds.map(id => `
      <div class="result-item">
        <span class="result-id">${id}</span>
        <span class="result-score">${qrAiResults[id]}</span>
      </div>
    `).join('');

    // Display mismatched IDs
    if (mismatchedIds.length > 0) {
      qrMismatchSection.classList.remove('hidden');
      qrMismatchList.innerHTML = mismatchedIds.map(id => `
        <span class="mismatch-item">${id}</span>
      `).join('');
    } else {
      qrMismatchSection.classList.add('hidden');
    }
  }

  // Fill AI results from QR scan
  if (qrFillAIBtn) {
    qrFillAIBtn.addEventListener('click', function() {
      const assessment = qrAssessmentType.value;

      // Filter only matched IDs
      const matchedData = {};
      Object.keys(qrAiResults).forEach(id => {
        if (validStudentIds.includes(id)) {
          matchedData[id] = qrAiResults[id];
        }
      });

      // Save to storage
      const storageKey = 'marks_' + assessment;
      chrome.storage.local.set({ [storageKey]: matchedData }, function() {
        showStatus(qrStatus, `Saved ${Object.keys(matchedData).length} QR scan records!`, 'success');
        loadSavedData();

        // Auto-fill on page
        chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
          if (tabs.length > 0) {
            const columnIndex = columnMapping[assessment];
            chrome.tabs.sendMessage(tabs[0].id, {
              action: 'fillMarks',
              data: matchedData,
              columnIndex: columnIndex,
              columnName: assessment
            }, function(response) {
              if (response && response.success) {
                showStatus(qrStatus, `Successfully filled ${response.filledCount} marks from QR scan!`, 'success');
              }
            });
          }
        });
      });
    });
  }

  // Reset QR scan
  if (qrResetBtn) {
    qrResetBtn.addEventListener('click', function() {
      qrAiResults = {};
      if (scanTimer) clearInterval(scanTimer);
      countdownValue = 10;

      qrResultsCard.classList.add('hidden');
      qrDisplayCard.classList.remove('hidden');
      startScanBtn.classList.remove('hidden');
      timerContainer.classList.add('hidden');
      scanStatus.textContent = 'Ready to scan';
      scanStatus.classList.remove('complete', 'scanning');
      qrCode.classList.remove('qr-scanned');
      timerCountdown.textContent = '10';
      timerProgress.style.width = '100%';
    });
  }

  // ==================== UPLOAD IMAGES TAB ====================
  const assessmentType = document.getElementById('assessmentType');
  const uploadDropzone = document.getElementById('uploadDropzone');
  const fileInput = document.getElementById('fileInput');
  const uploadCard = document.getElementById('uploadCard');
  const fileListCard = document.getElementById('fileListCard');
  const fileList = document.getElementById('fileList');
  const fileCount = document.getElementById('fileCount');
  const clearAllFiles = document.getElementById('clearAllFiles');
  const processBtn = document.getElementById('processBtn');
  const processingCard = document.getElementById('processingCard');
  const resultsCard = document.getElementById('resultsCard');
  const aiResultsContent = document.getElementById('aiResultsContent');
  const mismatchSection = document.getElementById('mismatchSection');
  const mismatchList = document.getElementById('mismatchList');
  const fillAIBtn = document.getElementById('fillAIBtn');
  const resetUploadBtn = document.getElementById('resetUploadBtn');
  const uploadStatus = document.getElementById('uploadStatus');

  let uploadedFiles = [];
  let aiGeneratedResults = {};

  // Valid student IDs in the portal
  const validStudentIds = [
    '232-15-012', '232-15-019', '232-15-028', '232-15-038', '232-15-045',
    '232-15-047', '232-15-103', '232-15-130', '232-15-138', '232-15-146'
  ];

  // Click to browse
  uploadDropzone.addEventListener('click', () => fileInput.click());

  // File input change
  fileInput.addEventListener('change', handleFiles);

  // Drag and drop
  uploadDropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadDropzone.classList.add('dragover');
  });

  uploadDropzone.addEventListener('dragleave', () => {
    uploadDropzone.classList.remove('dragover');
  });

  uploadDropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadDropzone.classList.remove('dragover');
    
    const files = Array.from(e.dataTransfer.files);
    addFiles(files);
  });

  function handleFiles(e) {
    const files = Array.from(e.target.files);
    addFiles(files);
  }

  function addFiles(files) {
    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'application/pdf'];
    
    files.forEach(file => {
      if (validTypes.includes(file.type) || file.name.endsWith('.pdf')) {
        if (!uploadedFiles.find(f => f.name === file.name && f.size === file.size)) {
          uploadedFiles.push(file);
        }
      }
    });

    updateFileList();
  }

  function formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  function updateFileList() {
    if (uploadedFiles.length === 0) {
      fileListCard.classList.add('hidden');
      uploadCard.classList.remove('hidden');
      return;
    }

    uploadCard.classList.add('hidden');
    fileListCard.classList.remove('hidden');
    fileCount.textContent = `Uploaded Files (${uploadedFiles.length})`;

    fileList.innerHTML = uploadedFiles.map((file, index) => `
      <div class="file-item">
        <div class="file-info">
          <span class="file-icon">${file.type === 'application/pdf' ? '📄' : '🖼️'}</span>
          <div class="file-details">
            <div class="file-name">${file.name}</div>
            <div class="file-size">${formatFileSize(file.size)}</div>
          </div>
        </div>
        <button class="file-remove" data-index="${index}">✕</button>
      </div>
    `).join('');

    // Add remove handlers
    fileList.querySelectorAll('.file-remove').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const index = parseInt(e.target.dataset.index);
        uploadedFiles.splice(index, 1);
        updateFileList();
      });
    });
  }

  clearAllFiles.addEventListener('click', () => {
    uploadedFiles = [];
    updateFileList();
  });

  // Process with AI
  processBtn.addEventListener('click', function() {
    const assessment = assessmentType.value;
    
    if (!assessment) {
      showStatus(uploadStatus, 'Please select an assessment type first!', 'error');
      return;
    }

    if (uploadedFiles.length === 0) {
      showStatus(uploadStatus, 'Please upload at least one file!', 'error');
      return;
    }

    // Show processing state
    fileListCard.classList.add('hidden');
    processingCard.classList.remove('hidden');

    // Simulate AI processing (3 seconds)
    setTimeout(() => {
      generateAIResults(assessment);
      processingCard.classList.add('hidden');
      resultsCard.classList.remove('hidden');
    }, 3000);
  });

  function generateAIResults(assessment) {
    aiGeneratedResults = {};
    
    // Generate random marks based on assessment type
    validStudentIds.forEach(id => {
      let maxMarks;
      switch(assessment) {
        case 'quiz1': 
        case 'quiz2': 
        case 'quiz3': maxMarks = 15; break;
        case 'midterm': maxMarks = 25; break;
        case 'final': maxMarks = 40; break;
        default: maxMarks = 15;
      }
      
      // Generate random mark between 0 and maxMarks
      const randomMark = Math.floor(Math.random() * (maxMarks + 1));
      aiGeneratedResults[id] = randomMark;
    });

    // Add some "extra" IDs that won't match (for demo purposes)
    const extraIds = ['232-15-999', '232-15-888', '232-15-777'];
    extraIds.forEach(id => {
      let extraMaxMarks;
      switch(assessment) {
        case 'quiz1': 
        case 'quiz2': 
        case 'quiz3': extraMaxMarks = 15; break;
        case 'midterm': extraMaxMarks = 25; break;
        case 'final': extraMaxMarks = 40; break;
        default: extraMaxMarks = 15;
      }
      aiGeneratedResults[id] = Math.floor(Math.random() * (extraMaxMarks + 1));
    });

    displayAIResults();
  }

  function displayAIResults() {
    const matchedIds = Object.keys(aiGeneratedResults).filter(id => validStudentIds.includes(id));
    const mismatchedIds = Object.keys(aiGeneratedResults).filter(id => !validStudentIds.includes(id));

    // Display matched results
    aiResultsContent.innerHTML = matchedIds.map(id => `
      <div class="result-item">
        <span class="result-id">${id}</span>
        <span class="result-score">${aiGeneratedResults[id]}</span>
      </div>
    `).join('');

    // Display mismatched IDs
    if (mismatchedIds.length > 0) {
      mismatchSection.classList.remove('hidden');
      mismatchList.innerHTML = mismatchedIds.map(id => `
        <span class="mismatch-item">${id}</span>
      `).join('');
    } else {
      mismatchSection.classList.add('hidden');
    }
  }

  // Fill AI results
  fillAIBtn.addEventListener('click', function() {
    const assessment = assessmentType.value;
    
    // Map assessment type to column
    let column;
    switch(assessment) {
      case 'quiz1': column = 'quiz1'; break;
      case 'quiz2': column = 'quiz2'; break;
      case 'quiz3': column = 'quiz3'; break;
      case 'midterm': column = 'midterm'; break;
      case 'final': column = 'final'; break;
      default: column = 'quiz1';
    }

    // Filter only matched IDs
    const matchedData = {};
    Object.keys(aiGeneratedResults).forEach(id => {
      if (validStudentIds.includes(id)) {
        matchedData[id] = aiGeneratedResults[id];
      }
    });

    // Save to storage
    const storageKey = 'marks_' + column;
    chrome.storage.local.set({ [storageKey]: matchedData }, function() {
      showStatus(uploadStatus, `Saved ${Object.keys(matchedData).length} AI-generated records!`, 'success');
      loadSavedData();
      
      // Auto-fill on page
      chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
        if (tabs.length > 0) {
          const columnIndex = columnMapping[column];
          chrome.tabs.sendMessage(tabs[0].id, {
            action: 'fillMarks',
            data: matchedData,
            columnIndex: columnIndex,
            columnName: column
          }, function(response) {
            if (response && response.success) {
              showStatus(uploadStatus, `Successfully filled ${response.filledCount} marks from AI analysis!`, 'success');
            }
          });
        }
      });
    });
  });

  // Reset upload
  resetUploadBtn.addEventListener('click', function() {
    uploadedFiles = [];
    aiGeneratedResults = {};
    resultsCard.classList.add('hidden');
    uploadCard.classList.remove('hidden');
    fileInput.value = '';
  });

  // ==================== UTILITY FUNCTIONS ====================
  function showStatus(element, message, type) {
    element.textContent = message;
    element.className = 'status ' + type;
    
    setTimeout(() => {
      element.className = 'status';
    }, 5000);
  }
});
