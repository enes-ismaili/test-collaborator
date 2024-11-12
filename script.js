// Constants and Configurations
const CONFIG = {
    MAX_LOGS: 100,
    AUTO_CLEANUP_INTERVAL: 24 * 60 * 60 * 1000, // 24 hours
    NOTIFICATION_DURATION: 3000, // 3 seconds
    DEFAULT_REFRESH_INTERVAL: 5000 // 5 seconds
};

// State management
let autoRefreshInterval;
let logs = [];

// DOM Elements
const elements = {
    loading: null,
    notification: null,
    logs: null,
    filters: null
};

// Initialize DOM elements after page load
function initializeElements() {
    elements.loading = document.getElementById('loadingIndicator');
    elements.notification = document.getElementById('notification');
    elements.logs = document.getElementById('logs');
    elements.filters = {
        ip: document.getElementById('ipFilter'),
        method: document.getElementById('methodFilter'),
        status: document.getElementById('statusFilter')
    };
}

// Utility Functions
const generateUniqueId = () => crypto.randomUUID();

const getCurrentTimestamp = () => new Date().toISOString();

const showLoading = () => elements.loading.classList.add('active');
const hideLoading = () => elements.loading.classList.remove('active');

// Update the showNotification function
const showNotification = (message) => {
    const notification = document.getElementById('notification');
    notification.textContent = message;
    notification.classList.add('show');
    
    // Hide notification after 3 seconds
    setTimeout(() => {
        notification.classList.remove('show');
    }, 3000);
};

async function getVisitorInfo() {
    showLoading();
    try {
        const [ipResponse, uaResponse] = await Promise.all([
            fetch('https://api.ipify.org?format=json'),
            fetch('https://api.useragent.app')
        ]);
        
        const ipData = await ipResponse.json();
        const uaData = await uaResponse.json();
        
        return {
            ip: ipData.ip,
            userAgent: uaData.ua || navigator.userAgent,
            timestamp: getCurrentTimestamp()
        };
    } catch (error) {
        console.error('Failed to retrieve visitor information:', error);
        return {
            ip: 'Unknown',
            userAgent: navigator.userAgent,
            timestamp: getCurrentTimestamp()
        };
    } finally {
        hideLoading();
    }
}

// Log Management
function addLogEntry(logData) {
    const logEntry = {
        id: generateUniqueId(),
        timestamp: getCurrentTimestamp(),
        ...logData
    };

    logs.unshift(logEntry);
    
    // Maintain max logs limit
    if (logs.length > CONFIG.MAX_LOGS) {
        logs = logs.slice(0, CONFIG.MAX_LOGS);
    }

    saveLogsToLocalStorage();
    renderLogs();
}

function clearLogs() {
    logs = [];
    saveLogsToLocalStorage();
    renderLogs();
    showNotification('Logs cleared successfully');
}

function downloadLogs() {
    const logsText = JSON.stringify(logs, null, 2);
    const blob = new Blob([logsText], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const downloadLink = document.createElement('a');
    downloadLink.href = url;
    downloadLink.download = `security_logs_${getCurrentTimestamp()}.json`;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
    URL.revokeObjectURL(url);
    showNotification('Logs downloaded successfully');
}

// Storage Management
function saveLogsToLocalStorage() {
    try {
        localStorage.setItem('securityLogs', JSON.stringify(logs));
    } catch (error) {
        console.error('Failed to save logs to localStorage:', error);
        showNotification('Failed to save logs');
    }
}

function loadLogsFromLocalStorage() {
    try {
        const storedLogs = localStorage.getItem('securityLogs');
        if (storedLogs) {
            logs = JSON.parse(storedLogs);
            renderLogs();
        }
    } catch (error) {
        console.error('Failed to load logs from localStorage:', error);
        showNotification('Failed to load logs');
    }
}

// Filtering and Rendering
function filterLogs() {
    const ipFilter = elements.filters.ip.value.toLowerCase();
    const methodFilter = elements.filters.method.value.toLowerCase();
    const statusFilter = elements.filters.status.value;

    return logs.filter(log => {
        const matchesIp = log.ip.toLowerCase().includes(ipFilter);
        const matchesMethod = !methodFilter || (log.method || '').toLowerCase().includes(methodFilter);
        const matchesStatus = !statusFilter || log.status === parseInt(statusFilter);
        return matchesIp && matchesMethod && matchesStatus;
    });
}

function renderLogs() {
    const filteredLogs = filterLogs();
    
    elements.logs.innerHTML = filteredLogs.map(log => `
        <div class="p-2 border rounded hover:bg-gray-50">
            <div class="flex justify-between">
                <span class="font-semibold">${dateFns.format(new Date(log.timestamp), 'yyyy-MM-dd HH:mm:ss')}</span>
                <span class="text-blue-600">${log.ip}</span>
            </div>
            <div class="mt-1">
                <span class="text-gray-600">Method: ${log.method || 'N/A'}</span>
                <span class="ml-2 text-gray-600">Status: ${log.status || 'N/A'}</span>
            </div>
            ${log.userAgent ? `<div class="text-gray-500 text-xs mt-1">UA: ${log.userAgent}</div>` : ''}
            ${log.headers ? `<div class="text-gray-500 text-xs mt-1">Headers: ${JSON.stringify(log.headers)}</div>` : ''}
        </div>
    `).join('');
}

// Auto-refresh functionality
function toggleAutoRefresh() {
    const autoRefreshCheckbox = document.getElementById('autoRefresh');
    const refreshInterval = parseInt(document.getElementById('refreshInterval').value);

    if (autoRefreshCheckbox.checked) {
        autoRefreshInterval = setInterval(() => {
            renderLogs();
            showNotification('Logs refreshed');
        }, refreshInterval);
    } else {
        clearInterval(autoRefreshInterval);
    }
}

// Event Listeners
function initializeEventListeners() {
    document.getElementById('clearLogs').addEventListener('click', clearLogs);
    document.getElementById('downloadLogs').addEventListener('click', downloadLogs);
    document.getElementById('copyPayloadUrl').addEventListener('click', async () => {
        const currentUrl = window.location.origin;
        await navigator.clipboard.writeText(currentUrl);
        showNotification('Payload URL copied to clipboard!');
    });

    // Filter event listeners
    Object.values(elements.filters).forEach(filter => {
        filter.addEventListener('input', renderLogs);
    });

    // Auto-refresh event listeners
    document.getElementById('autoRefresh').addEventListener('change', toggleAutoRefresh);
    document.getElementById('refreshInterval').addEventListener('change', () => {
        if (document.getElementById('autoRefresh').checked) {
            clearInterval(autoRefreshInterval);
            toggleAutoRefresh();
        }
    });
}

// Initialize application
document.addEventListener('DOMContentLoaded', async () => {
    initializeElements();
    initializeEventListeners();
    loadLogsFromLocalStorage();

    // Setup periodic cleanup
    setInterval(() => {
        const now = new Date();
        logs = logs.filter(log => {
            const logDate = new Date(log.timestamp);
            return now - logDate < CONFIG.AUTO_CLEANUP_INTERVAL;
        });
        saveLogsToLocalStorage();
        renderLogs();
    }, CONFIG.AUTO_CLEANUP_INTERVAL);

    // Log initial page load
    const visitorInfo = await getVisitorInfo();
    addLogEntry({
        method: 'PAGE_LOAD',
        status: 200,
        ...visitorInfo,
        headers: {
            'User-Agent': visitorInfo.userAgent,
            'Referer': document.referrer
        }
    });
});
