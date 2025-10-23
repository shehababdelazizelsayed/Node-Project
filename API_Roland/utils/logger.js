const fs = require('fs').promises;
const path = require('path');

// Ensure logs directory exists
const logsDir = path.join(__dirname, '..', 'logs');
fs.mkdir(logsDir, { recursive: true }).catch(console.error);

const logFile = path.join(logsDir, 'login-activity.log');

async function logLoginActivity(activity) {
    const timestamp = new Date().toISOString();
    const logEntry = {
        timestamp,
        ...activity,
    };
    
    const logLine = JSON.stringify(logEntry) + '\n';
    
    try {
        await fs.appendFile(logFile, logLine, 'utf8');
        return true;
    } catch (error) {
        console.error('Failed to write to log file:', error);
        return false;
    }
}

async function getRecentLoginLogs(limit = 50) {
    try {
        const data = await fs.readFile(logFile, 'utf8');
        return data
            .split('\n')
            .filter(Boolean)
            .map(line => JSON.parse(line))
            .slice(-limit);
    } catch (error) {
        if (error.code === 'ENOENT') return []; // File doesn't exist yet
        console.error('Failed to read log file:', error);
        return [];
    }
}

module.exports = {
    logLoginActivity,
    getRecentLoginLogs
};