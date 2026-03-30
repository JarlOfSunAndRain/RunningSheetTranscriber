const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    // Settings
    settings: {
        get: () => ipcRenderer.invoke('settings:get'),
        set: (settings) => ipcRenderer.invoke('settings:set', settings),
    },

    // Dialogs
    dialog: {
        selectDirectory: (title) => ipcRenderer.invoke('dialog:selectDirectory', title),
        saveFile: (options) => ipcRenderer.invoke('dialog:saveFile', options),
    },

    // File system
    fs: {
        readDir: (dirPath) => ipcRenderer.invoke('fs:readDir', dirPath),
        readFile: (filePath) => ipcRenderer.invoke('fs:readFile', filePath),
        writeFile: (filePath, data) => ipcRenderer.invoke('fs:writeFile', filePath, data),
        exists: (filePath) => ipcRenderer.invoke('fs:exists', filePath),
        mkdir: (dirPath) => ipcRenderer.invoke('fs:mkdir', dirPath),
        rmdir: (dirPath) => ipcRenderer.invoke('fs:rmdir', dirPath),
        stat: (filePath) => ipcRenderer.invoke('fs:stat', filePath),
    },

    // Audio
    audio: {
        scanFolder: (folderPath) => ipcRenderer.invoke('audio:scanFolder', folderPath),
        getPlayableUrl: (filePath) => ipcRenderer.invoke('audio:getPlayableUrl', filePath),
    },

    // App
    app: {
        getUserDataPath: () => ipcRenderer.invoke('app:getUserDataPath'),
    },

    // Export
    export: {
        toExcel: (data) => ipcRenderer.invoke('export:excel', data),
        toPdf: (data) => ipcRenderer.invoke('export:pdf', data),
    },
});
